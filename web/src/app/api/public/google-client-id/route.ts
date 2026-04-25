import { NextResponse } from "next/server";

/**
 * OAuth web client IDs are public; this lets the app load Google sign-in when the ID is
 * set only at runtime (e.g. server `.env` / PM2) without rebuilding with NEXT_PUBLIC_*.
 */
export async function GET() {
  const clientId =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ||
    process.env.GOOGLE_OAUTH_WEB_CLIENT_ID?.trim() ||
    "";
  const androidClientId =
    process.env.NEXT_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() ||
    process.env.GOOGLE_OAUTH_ANDROID_CLIENT_ID?.trim() ||
    "";
  return NextResponse.json({ clientId, androidClientId });
}
