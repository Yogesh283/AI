"use client";

import { useCallback, useEffect, useState } from "react";
import { NeoPageShell } from "@/components/neo/NeoPageShell";
import { apiOrigin } from "@/lib/apiBase";
import type { SubscriptionPlansResponse } from "@/lib/api";

const DEFAULT_PLANS: SubscriptionPlansResponse = {
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
};

const MODES: { title: string; body: string; accent: string }[] = [
  {
    title: "Personal Assistant Mode",
    accent: "Daily rhythm",
    body:
      "This mode helps with your daily needs—reminders, scheduling, and productivity tools—so you stay organized without friction.",
  },
  {
    title: "Life Guidance Mode (Personal Coach)",
    accent: "Mindset & clarity",
    body:
      "This mode offers personal advice, motivation, and life guidance to support better decisions and mindset.",
  },
  {
    title: "Learning & Skill Mode",
    accent: "Grow skills",
    body:
      "Focus on education, new skills, and personal development across any subject with structured help.",
  },
  {
    title: "Market Analyst Mode",
    accent: "Markets insight",
    body:
      "Deep trading-oriented insight—Forex, equities, or cryptocurrency—with chart-oriented analysis to support decision-making (not financial advice).",
  },
];

function formatBand(sym: string, lo: number, hi: number): string {
  const a = lo.toLocaleString("en-IN");
  const b = hi.toLocaleString("en-IN");
  if (lo === hi) return `${sym}${a}`;
  return `${sym}${a} – ${sym}${b}`;
}

const PLAN_STYLES: Record<string, { gradient: string; badge?: string }> = {
  basic: {
    gradient: "from-slate-50 via-white to-blue-50/80",
    badge: "Starter",
  },
  standard: {
    gradient: "from-indigo-50 via-white to-violet-50/90",
    badge: "Popular",
  },
  premium: {
    gradient: "from-amber-50/90 via-white to-orange-50/80",
    badge: "Full power",
  },
};

export default function PersonalAssistantPage() {
  const [pricing, setPricing] = useState<SubscriptionPlansResponse>(DEFAULT_PLANS);
  const [pricingError, setPricingError] = useState(false);
  const [comingSoon, setComingSoon] = useState<string | null>(null);

  const load = useCallback(async () => {
    const base = apiOrigin().replace(/\/$/, "");
    try {
      const r = await fetch(`${base}/api/public/subscription-plans`, {
        cache: "no-store",
      });
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as SubscriptionPlansResponse;
      if (j && typeof j === "object" && j.plans && typeof j.plans === "object") {
        setPricing({
          currency: j.currency || DEFAULT_PLANS.currency,
          currency_symbol: j.currency_symbol || DEFAULT_PLANS.currency_symbol,
          plans: { ...DEFAULT_PLANS.plans, ...j.plans },
        });
        setPricingError(false);
      }
    } catch {
      setPricing(DEFAULT_PLANS);
      setPricingError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!comingSoon) return;
    const t = window.setTimeout(() => setComingSoon(null), 3200);
    return () => window.clearTimeout(t);
  }, [comingSoon]);

  const sym = pricing.currency_symbol || "₹";
  const order: (keyof SubscriptionPlansResponse["plans"])[] = ["basic", "standard", "premium"];

  return (
    <>
    <NeoPageShell innerClassName="pb-4">
            <header className="mb-10 text-center sm:text-left">
              <p className="text-sm font-medium text-blue-600">Neo AI</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                Assistant modes & plans
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-slate-600">
                Choose how Neo supports you. Pricing is indicative ({pricing.currency}); admins can update amounts in
                the database or API.
              </p>
            </header>

            <article className="space-y-12 rounded-2xl border border-slate-200/80 bg-white/95 p-6 shadow-lg shadow-slate-200/40 ring-1 ring-slate-100/80 sm:p-10">
              <section>
                <h2 className="text-lg font-semibold tracking-tight text-slate-900">Modes</h2>
                <ul className="mt-5 space-y-4">
                  {MODES.map((m) => (
                    <li
                      key={m.title}
                      className="rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 to-white px-5 py-4 shadow-sm ring-1 ring-slate-100/90"
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600/90">{m.accent}</p>
                      <h3 className="mt-1 text-[15px] font-semibold text-slate-900">{m.title}</h3>
                      <p className="mt-2 text-[15px] leading-relaxed text-slate-700">{m.body}</p>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h2 className="text-lg font-semibold tracking-tight text-slate-900">Subscription plans</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Tap a plan to subscribe — checkout opens soon. Indicative ranges ({sym}, India).
                </p>
                {pricingError ? (
                  <p className="mt-3 text-sm text-amber-700">
                    Could not load live pricing; showing defaults. Check API connectivity.
                  </p>
                ) : null}

                <div className="mt-8 grid gap-5 sm:grid-cols-3">
                  {order.map((key) => {
                    const p = pricing.plans[key];
                    if (!p) return null;
                    const title = p.title || key.charAt(0).toUpperCase() + key.slice(1);
                    const style = PLAN_STYLES[key] ?? PLAN_STYLES.basic;
                    const featured = key === "standard";
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setComingSoon(title)}
                        className={`group relative flex w-full flex-col rounded-2xl border bg-gradient-to-br px-5 pb-6 pt-6 text-left shadow-md transition hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:scale-[0.99] ${style.gradient} ${
                          featured
                            ? "border-indigo-200 ring-2 ring-indigo-400/30 sm:scale-[1.02] sm:shadow-xl"
                            : "border-slate-200/90 hover:border-slate-300"
                        }`}
                      >
                        {style.badge ? (
                          <span
                            className={`absolute right-4 top-4 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                              featured ? "bg-indigo-600 text-white" : "bg-slate-200/80 text-slate-700"
                            }`}
                          >
                            {style.badge}
                          </span>
                        ) : null}
                        <h3 className="text-lg font-bold tracking-tight text-slate-900">{title}</h3>
                        <div className="mt-5 space-y-3 border-t border-slate-200/60 pt-4">
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Monthly</p>
                            <p className="mt-1 text-lg font-semibold text-blue-700 tabular-nums">
                              {formatBand(sym, p.monthly_min, p.monthly_max)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Annual</p>
                            <p className="mt-1 text-lg font-semibold text-blue-700 tabular-nums">
                              {formatBand(sym, p.annual_min, p.annual_max)}
                            </p>
                          </div>
                        </div>
                        <span className="mt-6 inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-md transition group-hover:bg-slate-800">
                          Continue with {title}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            </article>
    </NeoPageShell>

      {comingSoon ? (
        <div
          className="fixed inset-x-0 bottom-0 z-[100] flex justify-center px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-2 pointer-events-none"
          role="status"
          aria-live="polite"
        >
          <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-2xl shadow-slate-900/15 ring-1 ring-slate-100">
            <p className="text-center text-[15px] font-semibold text-slate-900">Coming soon</p>
            <p className="mt-1 text-center text-sm text-slate-600">
              {comingSoon} checkout and billing are not live yet. We’ll notify you when you can subscribe.
            </p>
            <button
              type="button"
              className="mt-4 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              onClick={() => setComingSoon(null)}
            >
              OK
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
