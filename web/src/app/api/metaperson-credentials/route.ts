import { NextResponse } from "next/server";

/**
 * Serves Avatar SDK MetaPerson credentials to our own page only (same origin).
 * Set in web/.env.local (server-side — do NOT use NEXT_PUBLIC_* for the secret):
 *   METAPERSON_CLIENT_ID=...
 *   METAPERSON_CLIENT_SECRET=...
 *
 * For production, restrict this route (e.g. auth middleware) — anyone who can call it receives the secret.
 */
export async function GET() {
  const clientId = process.env.METAPERSON_CLIENT_ID?.trim();
  const clientSecret = process.env.METAPERSON_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      {
        error: "metaperson_not_configured",
        hint: "Add METAPERSON_CLIENT_ID and METAPERSON_CLIENT_SECRET to web/.env.local",
      },
      { status: 503 },
    );
  }

  return NextResponse.json({ clientId, clientSecret });
}
