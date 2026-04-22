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
      <div className="neo-screen-card mx-auto w-full max-w-[28rem] rounded-[12px] px-5 py-6 pt-5 sm:px-7 sm:py-7">
          <Link
            href="/"
            className="neo-link-accent mb-7 inline-block text-sm hover:underline"
          >
            ← Back
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Welcome Back!
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Login to continue with {brandName}
          </p>
          {sessionExpiredBanner ? (
            <p className="mt-4 rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
              Your session ended after 24 hours for security. Please sign in again.
            </p>
          ) : null}

          <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
            <div>
              <label className="mb-2 block text-xs font-semibold tracking-wide text-slate-600">
                Email or Username
              </label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="neo-input text-sm"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold tracking-wide text-slate-600">
                Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="neo-input text-sm"
                placeholder="••••••••"
              />
              <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                  className="h-4 w-4 accent-[#2563eb]"
                />
                Show password
              </label>
            </div>
            {err ? (
              <p className="text-sm text-red-700" role="alert">
                {err}
              </p>
            ) : null}
            <GradientButton type="submit" disabled={loading} className="!mt-1 w-full !rounded-[12px] !py-3.5 disabled:opacity-60">
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
