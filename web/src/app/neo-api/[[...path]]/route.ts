import type { NextRequest } from "next/server";
import http from "node:http";

/**
 * Server-side proxy to FastAPI. Browser never sees redirects to http://127.0.0.1:8010.
 *
 * Nginx: send /neo-api/* to Next (3000), not directly to 8010.
 *
 * We use `node:http` for localhost upstream — Node's global `fetch` may honor
 * HTTP_PROXY and break requests to 127.0.0.1 (shows as "fetch failed").
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UPSTREAM = (process.env.NEO_API_INTERNAL_URL ?? "http://127.0.0.1:8010").replace(
  /\/$/,
  ""
);

/** When FastAPI is down, public pricing page still loads (same defaults as backend `DEFAULT_SUBSCRIPTION_PLAN_PRICING`). */
const SUBSCRIPTION_PLANS_FALLBACK = {
  currency: "INR",
  currency_symbol: "₹",
  plans: {
    basic: {
      title: "Basic",
      monthly_min: 300,
      monthly_max: 500,
      annual_min: 3000,
      annual_max: 5000,
    },
    standard: {
      title: "Standard",
      monthly_min: 700,
      monthly_max: 1000,
      annual_min: 8000,
      annual_max: 10000,
    },
    premium: {
      title: "Premium",
      monthly_min: 1500,
      monthly_max: 1500,
      annual_min: 15000,
      annual_max: 15000,
    },
  },
} as const;

function isSubscriptionPlansPublicGet(req: NextRequest): boolean {
  if (req.method !== "GET") return false;
  const u = new URL(req.url);
  const path = u.pathname.replace(/^\/neo-api/, "") || "/";
  return path.replace(/\/$/, "") === "/api/public/subscription-plans";
}

function subscriptionPlansFallbackResponse(): Response {
  return Response.json(SUBSCRIPTION_PLANS_FALLBACK, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

function rewriteLoopbackLocation(location: string): string {
  const raw = location.trim();
  if (!raw) return raw;
  try {
    const loc = new URL(raw, UPSTREAM);
    const upstream = new URL(UPSTREAM);
    const loopbackHost = /^(127\.0\.0\.1|localhost|\[::1\])$/i.test(loc.hostname);
    const sameAsUpstream = loc.hostname === upstream.hostname && loc.port === upstream.port;
    if (loopbackHost || sameAsUpstream) {
      return `/neo-api${loc.pathname}${loc.search}${loc.hash}`;
    }
  } catch {
    if (/127\.0\.0\.1|localhost/i.test(raw)) {
      return raw.replace(/^https?:\/\/[^/]+/i, "/neo-api");
    }
  }
  return raw;
}

function targetUrl(req: NextRequest): string {
  const u = new URL(req.url);
  const suffix = u.pathname.replace(/^\/neo-api(\/|$)/, "") || "";
  const path = suffix ? `/${suffix}` : "/";
  return `${UPSTREAM}${path}${u.search}`;
}

function hopByHopSkip(key: string): boolean {
  const k = key.toLowerCase();
  return ["host", "connection", "content-length", "transfer-encoding", "keep-alive"].includes(
    k
  );
}

/** Use raw HTTP for same-host API — avoids undici/fetch + HTTP_PROXY breaking localhost */
function proxyViaHttpModule(req: NextRequest, target: string): Promise<Response> {
  const u = new URL(target);
  const port = u.port ? Number(u.port) : u.protocol === "https:" ? 443 : 80;

  return new Promise(async (resolve, reject) => {
    const headerObj: http.OutgoingHttpHeaders = {};
    req.headers.forEach((value, key) => {
      if (!hopByHopSkip(key) && key.toLowerCase() !== "host") headerObj[key] = value;
    });
    // Upstream must see 127.0.0.1:8010, not the public site Host (avoids bad redirects / validation)
    headerObj.host = u.host;

    let bodyBuf: Buffer | undefined;
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const ab = await req.arrayBuffer();
      if (ab.byteLength) bodyBuf = Buffer.from(ab);
    }

    const opts: http.RequestOptions = {
      hostname: u.hostname,
      port,
      path: u.pathname + u.search,
      method: req.method,
      headers: headerObj,
    };

    const pr = http.request(opts, (incoming) => {
      const out = new Headers();
      for (const [key, val] of Object.entries(incoming.headers)) {
        if (val === undefined) continue;
        const k = key.toLowerCase();
        if (k === "location") {
          if (Array.isArray(val)) val.forEach((v) => out.append(key, rewriteLoopbackLocation(v)));
          else out.set(key, rewriteLoopbackLocation(val));
          continue;
        }
        if (Array.isArray(val)) val.forEach((v) => out.append(key, v));
        else out.set(key, val);
      }
      /**
       * Must stream — buffering the full body breaks SSE (`text/event-stream`) so chat never
       * shows token-by-token / “Searching…” → live deltas until the entire reply finishes.
       */
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          incoming.on("data", (c: Buffer) => {
            controller.enqueue(new Uint8Array(c));
          });
          incoming.on("end", () => {
            controller.close();
          });
          incoming.on("error", (err) => {
            controller.error(err);
          });
        },
      });
      resolve(
        new Response(body, {
          status: incoming.statusCode ?? 502,
          statusText: incoming.statusMessage,
          headers: out,
        })
      );
    });

    pr.on("error", (e) => {
      reject(e);
    });

    if (bodyBuf?.length) pr.write(bodyBuf);
    pr.end();
  });
}

function shouldUseHttpModuleForTarget(target: string): boolean {
  try {
    const u = new URL(target);
    return u.protocol === "http:" && (u.hostname === "127.0.0.1" || u.hostname === "localhost");
  } catch {
    return false;
  }
}

async function proxy(req: NextRequest): Promise<Response> {
  const target = targetUrl(req);

  if (shouldUseHttpModuleForTarget(target)) {
    try {
      return await proxyViaHttpModule(req, target);
    } catch (err) {
      if (isSubscriptionPlansPublicGet(req)) {
        console.warn("[neo-api proxy] upstream down — serving subscription-plans fallback", target, err);
        return subscriptionPlansFallbackResponse();
      }
      const msg =
        err instanceof Error
          ? `${err.message}${err.cause instanceof Error ? ` (${err.cause.message})` : ""}`
          : String(err);
      console.error("[neo-api proxy] http.request failed", target, err);
      return Response.json(
        {
          detail: `Upstream unreachable: ${msg}. Check: pm2 status neo-api && curl -sS http://127.0.0.1:8010/health`,
          target,
        },
        { status: 502 }
      );
    }
  }

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!hopByHopSkip(key)) headers.set(key, value);
  });

  const init: RequestInit = {
    method: req.method,
    headers,
    redirect: "follow",
  };

  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const buf = await req.arrayBuffer();
    if (buf.byteLength) init.body = buf;
  }

  let res: Response;
  try {
    res = await fetch(target, init);
  } catch (err) {
    if (isSubscriptionPlansPublicGet(req)) {
      console.warn("[neo-api proxy] fetch failed — subscription-plans fallback", target, err);
      return subscriptionPlansFallbackResponse();
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[neo-api proxy] fetch failed", target, err);
    return Response.json(
      { detail: `Upstream unreachable: ${msg}`, target },
      { status: 502 }
    );
  }

  if (
    isSubscriptionPlansPublicGet(req) &&
    !res.ok &&
    res.status >= 502
  ) {
    return subscriptionPlansFallbackResponse();
  }

  const out = new Headers();
  res.headers.forEach((value, key) => {
    if (["transfer-encoding", "connection"].includes(key.toLowerCase())) return;
    if (key.toLowerCase() === "location") {
      out.set(key, rewriteLoopbackLocation(value));
      return;
    }
    out.set(key, value);
  });

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: out,
  });
}

export async function GET(req: NextRequest) {
  return proxy(req);
}
export async function HEAD(req: NextRequest) {
  return proxy(req);
}
export async function POST(req: NextRequest) {
  return proxy(req);
}
export async function PUT(req: NextRequest) {
  return proxy(req);
}
export async function PATCH(req: NextRequest) {
  return proxy(req);
}
export async function DELETE(req: NextRequest) {
  return proxy(req);
}
export async function OPTIONS(req: NextRequest) {
  return proxy(req);
}
