"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  clearSession,
  fetchMe,
  getStoredToken,
  getStoredUser,
  patchMe,
  type AuthUser,
} from "@/lib/auth";
import { HelloNeoVoiceStrip } from "@/components/neo/HelloNeoVoiceStrip";
import { ProfileNeoAssistantToggle } from "@/components/neo/ProfileNeoAssistantToggle";
import { ProfileVoiceSettings } from "@/components/neo/ProfileVoiceSettings";
import { getNeoAvatar, readStoredAvatarId } from "@/lib/avatars";
import { normalizeVoicePersonaId } from "@/lib/voicePersonas";
import { MainTopNav } from "@/components/neo/MainTopNav";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [nameDraft, setNameDraft] = useState("");
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  /** `null` until mount so avatar image matches SSR + first client paint. */
  const [avatarId, setAvatarId] = useState<string | null>(null);

  const refreshLocal = useCallback(() => {
    setAvatarId(readStoredAvatarId());
  }, []);

  const loadUser = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const u = await fetchMe();
      setUser(u);
      setNameDraft(u.display_name ?? "");
    } catch {
      setUser(getStoredUser());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  useEffect(() => {
    setAvatarId(readStoredAvatarId());
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") refreshLocal();
    };
    window.addEventListener("focus", refreshLocal);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", refreshLocal);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refreshLocal]);

  const avatar = getNeoAvatar(avatarId);

  useEffect(() => {
    if (user?.display_name !== undefined) {
      setNameDraft(user.display_name);
    }
  }, [user?.display_name]);

  function onLogout() {
    clearSession();
    router.replace("/login");
  }

  async function saveDisplayName() {
    if (!user) return;
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setOkMsg(null);
      setErr("Display name is required.");
      return;
    }
    setErr(null);
    setOkMsg(null);
    setSavingProfile(true);
    try {
      const u = await patchMe({ display_name: trimmed });
      setUser(u);
      setOkMsg("Profile updated.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingProfile(false);
    }
  }

  function goBackFromProfile() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/dashboard");
    }
  }

  async function savePassword() {
    setErr(null);
    setOkMsg(null);
    if (newPw.length < 6) {
      setErr("New password: at least 6 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      setErr("New password and confirmation do not match.");
      return;
    }
    setSavingPw(true);
    try {
      await patchMe({ current_password: curPw, new_password: newPw });
      setCurPw("");
      setNewPw("");
      setConfirmPw("");
      setOkMsg("Password updated.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Password change failed");
    } finally {
      setSavingPw(false);
    }
  }

  const navCenter = (
    <span className="text-sm font-semibold text-white/90">Profile</span>
  );

  if (loading) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#080a0f]">
        <MainTopNav center={navCenter} />
        <div className="relative z-[1] min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-4 md:px-8">
          <p className="text-center text-sm text-white/45">Loading profile…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#080a0f]">
        <MainTopNav center={navCenter} />
        <div className="relative z-[1] min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-4 md:px-8">
          <div className="mx-auto max-w-md rounded-[26px] border border-white/[0.08] bg-white/[0.04] p-8 text-center ring-1 ring-white/[0.06]">
            <p className="text-white/80">Sign in to view and edit your profile.</p>
            <Link
              href="/login"
              className="mt-6 inline-flex rounded-xl bg-gradient-to-r from-[#00c8f0] to-[#a855f7] px-6 py-3 text-sm font-semibold text-white"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isPasswordAccount = user.auth_provider === "password";

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#080a0f]">
      <MainTopNav center={navCenter} />
      <div className="flex shrink-0 items-center border-b border-white/[0.07] bg-[#080a0f]/95 px-4 py-2 md:px-8">
        <button
          type="button"
          onClick={goBackFromProfile}
          className="text-sm font-semibold text-[#00D4FF]/90 transition hover:text-[#00D4FF]"
        >
          ← Back
        </button>
      </div>
      <div className="relative z-[1] min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-4 md:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-3 h-24 w-24 overflow-hidden rounded-full border-2 border-[#00D4FF]/35 bg-[#0a0f18] shadow-[0_0_36px_rgba(0,212,255,0.2)] ring-2 ring-black/20">
            <Image
              src={avatar.imageSrc}
              alt=""
              fill
              className="object-cover object-top"
              sizes="96px"
              priority
              unoptimized={avatar.imageSrc.endsWith(".svg")}
            />
          </div>
          <h1 className="text-xl font-bold text-white">
            {user.display_name?.trim() || "Add your display name below"}
          </h1>
          <p className="mt-1 max-w-sm truncate text-sm text-white/45">{user.email}</p>
          <p className="mt-2 rounded-full border border-[#BD00FF]/35 bg-[#BD00FF]/10 px-4 py-1.5 text-xs font-semibold text-[#e9c2ff]">
            {user.auth_provider === "google" ? "Google account" : "Email account"}
          </p>
        </div>

        {(err || okMsg) && (
          <div
            className={`rounded-xl px-4 py-3 text-sm ${
              err ? "border border-red-500/30 bg-red-500/10 text-red-300" : "border border-emerald-500/25 bg-emerald-500/10 text-emerald-200/95"
            }`}
            role={err ? "alert" : "status"}
          >
            {err ?? okMsg}
          </div>
        )}

        {/* Account */}
        <section className="neo-glass overflow-hidden rounded-[22px] ring-1 ring-white/[0.06]">
          <div className="border-b border-white/[0.07] px-5 py-3.5">
            <h2 className="text-sm font-semibold text-white/90">Account</h2>
            <p className="mt-0.5 text-xs text-white/40">Email, display name &amp; password</p>
          </div>
          <div className="space-y-4 px-5 py-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/40">
                Email
              </label>
              <input
                readOnly
                value={user.email}
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-sm text-white/55 outline-none"
              />
              <p className="mt-1 text-[11px] text-white/30">Email change — coming soon.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-white/40">
                Display name <span className="text-rose-400/90">*</span>
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  className="min-w-0 flex-1 rounded-xl border border-white/[0.12] bg-[#0c1018] px-3 py-2.5 text-sm text-white outline-none ring-1 ring-transparent focus:border-[#00D4FF]/40 focus:ring-[#00D4FF]/20"
                  maxLength={80}
                  minLength={1}
                  required
                  aria-required="true"
                  placeholder="Your name (required)"
                  autoComplete="name"
                />
                <button
                  type="button"
                  onClick={() => void saveDisplayName()}
                  disabled={
                    savingProfile ||
                    !nameDraft.trim() ||
                    nameDraft.trim() === (user.display_name ?? "").trim()
                  }
                  className="rounded-xl bg-gradient-to-r from-[#00c8f0] to-[#7c3aed] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(0,200,240,0.25)] transition hover:brightness-110 disabled:opacity-40"
                >
                  {savingProfile ? "Saving…" : "Save name"}
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-white/35">Shown in the header and voice chat — cannot be empty.</p>
            </div>

            {isPasswordAccount ? (
              <div className="border-t border-white/[0.06] pt-4">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                  Change password
                </p>
                <div className="space-y-3">
                  <input
                    type="password"
                    value={curPw}
                    onChange={(e) => setCurPw(e.target.value)}
                    placeholder="Current password"
                    className="w-full rounded-xl border border-white/[0.12] bg-[#0c1018] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25"
                    autoComplete="current-password"
                  />
                  <input
                    type="password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="New password (min 6)"
                    className="w-full rounded-xl border border-white/[0.12] bg-[#0c1018] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25"
                    autoComplete="new-password"
                  />
                  <input
                    type="password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full rounded-xl border border-white/[0.12] bg-[#0c1018] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => void savePassword()}
                    disabled={savingPw || !curPw || !newPw}
                    className="w-full rounded-xl border border-[#00D4FF]/35 bg-[#00D4FF]/10 py-2.5 text-sm font-semibold text-[#00D4FF] transition hover:bg-[#00D4FF]/15 disabled:opacity-40 sm:w-auto sm:px-6"
                  >
                    {savingPw ? "Updating…" : "Update password"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="border-t border-white/[0.06] pt-4 text-xs text-white/38">
                Signed in with Google — password is managed by Google.
              </p>
            )}
          </div>
        </section>

        <ProfileNeoAssistantToggle />

        <HelloNeoVoiceStrip variant="profile" />

        <ProfileVoiceSettings
          key={normalizeVoicePersonaId(user.voice_persona_id)}
          user={user}
          onUserUpdated={(u) => setUser(u)}
          onMessage={(ok, err) => {
            if (err) {
              setOkMsg(null);
              setErr(err);
            } else if (ok) {
              setErr(null);
              setOkMsg(ok);
            } else {
              setOkMsg(null);
              setErr(null);
            }
          }}
        />

        <section className="neo-glass overflow-hidden rounded-[22px] ring-1 ring-white/[0.06]">
          <div className="border-b border-white/[0.07] px-5 py-3.5">
            <h2 className="text-sm font-semibold text-white/90">Avatar</h2>
            <p className="mt-0.5 text-xs text-white/40">
              Current: <span className="text-white/70">{avatar.name}</span>
            </p>
          </div>
          <div className="px-5 py-4">
            <Link
              href="/avatars"
              className="flex w-full items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.05] py-3 text-sm font-medium text-white/90 transition hover:bg-white/[0.09]"
            >
              Change avatar
            </Link>
          </div>
        </section>

        <button
          type="button"
          onClick={onLogout}
          className="w-full rounded-[22px] border border-red-500/35 bg-red-500/5 py-4 text-sm font-semibold text-red-400/95 transition hover:bg-red-500/10"
        >
          Logout
        </button>
      </div>
      </div>
    </div>
  );
}
