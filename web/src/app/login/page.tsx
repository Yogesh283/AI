"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NeoPublicShell } from "@/components/neo/NeoPublicShell";
import { GradientButton } from "@/components/neo/GradientButton";
import { AuthGoogleSection } from "@/components/neo/AuthGoogleSection";
import { useNativeAuthResumeRedirect } from "@/lib/useNativeAuthResumeRedirect";
import { useSiteBrand } from "@/components/SiteBrandProvider";
import { getStoredToken, googleLoginApi, loginApi, saveSession } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { brandName } = useSiteBrand();
  useNativeAuthResumeRedirect();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [sessionExpiredBanner, setSessionExpiredBanner] = useState(false);
  const didAutoRedirect = useRef(false);

  useEffect(() => {
    try {
      setSessionExpiredBanner(new URLSearchParams(window.location.search).get("expired") === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (didAutoRedirect.current) return;
    if (getStoredToken()) {
      didAutoRedirect.current = true;
      router.replace("/dashboard");
    }
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const data = await loginApi({ email: email.trim(), password });
      saveSession(data.access_token, data.user);
      router.replace("/dashboard");
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function onGoogleCredential(idToken: string) {
    setErr("");
    setGoogleLoading(true);
    try {
      const data = await googleLoginApi(idToken);
      saveSession(data.access_token, data.user);
      router.replace(data.is_new_user ? "/onboarding" : "/dashboard");
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Google sign-in failed");
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <NeoPublicShell>
      <div className="pt-2">
          <Link
            href="/"
            className="mb-8 inline-block text-sm text-[#00D4FF]/90 hover:underline"
          >
            ← Back
          </Link>
          <h1 className="neo-gradient-text text-2xl font-bold tracking-tight">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-white/45">
            Sign in to continue with {brandName}
          </p>
          {sessionExpiredBanner ? (
            <p className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/95" role="status">
              Your session ended after 24 hours for security. Please sign in again.
            </p>
          ) : null}

          <form onSubmit={onSubmit} className="mt-10 flex flex-col gap-5">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/40">
                Email
              </label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="neo-glass w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3.5 text-sm text-white outline-none ring-1 ring-white/[0.06] placeholder:text-white/30 focus:border-[#00D4FF]/40"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/40">
                Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="neo-glass w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3.5 text-sm text-white outline-none ring-1 ring-white/[0.06] placeholder:text-white/30 focus:border-[#00D4FF]/40"
                placeholder="••••••••"
              />
              <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-xs text-white/55">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                  className="h-4 w-4 accent-[#00D4FF]"
                />
                Show password
              </label>
            </div>
            {err ? (
              <p className="text-sm text-red-400/95" role="alert">
                {err}
              </p>
            ) : null}
            <GradientButton
              type="submit"
              disabled={loading}
              className="!mt-2 w-full !py-4 disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in"}
            </GradientButton>
          </form>

          <AuthGoogleSection
            intent="signin"
            layout="afterForm"
            disabled={loading || googleLoading}
            onCredential={onGoogleCredential}
            onGoogleError={(msg) => setErr(msg)}
          />
      </div>
    </NeoPublicShell>
  );
}
