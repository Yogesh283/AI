"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { NeoPublicShell } from "@/components/neo/NeoPublicShell";
import { GradientButton } from "@/components/neo/GradientButton";
import { AuthGoogleSection } from "@/components/neo/AuthGoogleSection";
import { useNativeAuthResumeRedirect } from "@/lib/useNativeAuthResumeRedirect";
import { useSiteBrand } from "@/components/SiteBrandProvider";
import { getStoredToken, googleLoginApi, registerApi, saveSession } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const { brandName } = useSiteBrand();
  useNativeAuthResumeRedirect();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const didAutoRedirect = useRef(false);

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
    if (password !== confirm) {
      setErr("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setErr("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      const data = await registerApi({
        email: email.trim(),
        password,
        display_name: displayName.trim() || undefined,
      });
      saveSession(data.access_token, data.user);
      router.replace("/onboarding");
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Registration failed");
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
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Create Account
          </h1>
          <p className="mt-2 text-sm text-white/55">
            Start your AI journey with {brandName}
          </p>

          <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
            <div>
              <label className="mb-2 block text-xs font-semibold tracking-wide text-white/55">
                Display name
              </label>
              <input
                type="text"
                autoComplete="name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="neo-input text-sm"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold tracking-wide text-white/55">
                Email
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
              <label className="mb-2 block text-xs font-semibold tracking-wide text-white/55">
                Password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="neo-input text-sm"
                placeholder="At least 6 characters"
              />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold tracking-wide text-white/55">
                Confirm password
              </label>
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="neo-input text-sm"
                placeholder="Repeat password"
              />
              <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-xs text-white/55">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                  className="h-4 w-4 accent-[#00D4FF]"
                />
                Show passwords
              </label>
            </div>
            {err ? (
              <p className="text-sm text-red-400/95" role="alert">
                {err}
              </p>
            ) : null}
            <GradientButton type="submit" disabled={loading} className="!mt-1 w-full !rounded-[12px] !py-3.5 disabled:opacity-60">
              {loading ? "Creating account…" : "Register"}
            </GradientButton>
          </form>

          <AuthGoogleSection
            intent="signup"
            layout="afterForm"
            disabled={loading || googleLoading}
            onCredential={onGoogleCredential}
            onGoogleError={(msg) => setErr(msg)}
          />
      </div>
    </NeoPublicShell>
  );
}
