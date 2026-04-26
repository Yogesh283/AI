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

  const navCenter = <span className="text-sm font-semibold text-black">Profile</span>;

  if (loading) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#F5F7FA]">
        <MainTopNav center={navCenter} />
        <div className="relative z-[1] flex-1 px-4 pb-10 pt-4 md:px-8">
          <p className="text-center text-sm text-black">Loading profile…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#F5F7FA]">
        <MainTopNav center={navCenter} />
        <div className="relative z-[1] flex-1 px-4 pb-10 pt-4 md:px-8">
          <div className="neo-screen-card mx-auto max-w-md rounded-[26px] p-8 text-center">
            <p className="text-black">Sign in to view and edit your profile.</p>
            <Link
              href="/login"
              className="mt-6 inline-flex rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
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
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#F5F7FA]">
      <MainTopNav center={navCenter} />
      <div className="neo-topbar flex shrink-0 items-center px-4 py-2 md:px-8">
        <button
          type="button"
          onClick={goBackFromProfile}
          className="text-sm font-semibold text-emerald-700 transition hover:text-emerald-800"
        >
          ← Back
        </button>
      </div>
      <div
        className="relative z-[1] overflow-y-auto overscroll-y-contain px-4 pb-10 pt-4 [touch-action:pan-y] md:px-8"
        style={{
          /*
           * Hard mobile WebView fallback:
           * give Profile its own explicit viewport scroll shell so parent flex sizing cannot block touch scroll.
           */
          height:
            "calc(100dvh - 52px - 40px - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px))",
          WebkitOverflowScrolling: "touch",
        }}
      >
      <div className="mx-auto max-w-3xl space-y-6 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
        <div className="neo-screen-card flex flex-col items-center rounded-[24px] px-5 py-6 text-center md:rounded-[12px]">
          <div className="relative mb-3 h-24 w-24 overflow-hidden rounded-full border-2 border-[#64bdff]/45 bg-[#0a0f18] shadow-[0_0_36px_rgba(35,136,255,0.35)] ring-2 ring-slate-200/50 max-md:ring-slate-200/40 md:ring-black/20">
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
          <h1 className="text-xl font-bold text-black">
            {user.display_name?.trim() || "Add your display name below"}
          </h1>
          <p className="mt-1 max-w-sm truncate text-sm text-black">
            {user.email}
          </p>
          <p className="mt-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-black">
            {user.auth_provider === "google" ? "Google account" : "Email account"}
          </p>
        </div>

        {(err || okMsg) && (
          <div
            className={`rounded-xl px-4 py-3 text-sm ${
              err ? "border border-red-200 bg-red-50 text-red-800" : "border border-emerald-200 bg-emerald-50 text-emerald-900"
            }`}
            role={err ? "alert" : "status"}
          >
            {err ?? okMsg}
          </div>
        )}

        {/* Account */}
        <section className="neo-screen-card overflow-hidden rounded-[12px]">
          <div className="border-b border-slate-200/80 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-black">Account</h2>
            <p className="mt-0.5 text-xs text-black/75">
              Email, display name &amp; password
            </p>
          </div>
          <div className="space-y-4 px-5 py-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-black">
                Email
              </label>
              <input
                readOnly
                value={user.email}
                className="neo-input text-sm text-black"
              />
              <p className="mt-1 text-[11px] text-black/60">Email change — coming soon.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-black">
                Display name <span className="text-rose-600">*</span>
              </label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  className="neo-input min-w-0 flex-1 text-sm text-black"
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
                  className="rounded-[12px] bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-40"
                >
                  {savingProfile ? "Saving…" : "Save name"}
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-black/65">Shown in the header and voice chat — cannot be empty.</p>
            </div>

            {isPasswordAccount ? (
              <div className="border-t border-slate-200/80 pt-4">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-black">
                  Change password
                </p>
                <div className="space-y-3">
                  <input
                    type="password"
                    value={curPw}
                    onChange={(e) => setCurPw(e.target.value)}
                    placeholder="Current password"
                    className="neo-input text-sm text-black"
                    autoComplete="current-password"
                  />
                  <input
                    type="password"
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="New password (min 6)"
                    className="neo-input text-sm text-black"
                    autoComplete="new-password"
                  />
                  <input
                    type="password"
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder="Confirm new password"
                    className="neo-input text-sm text-black"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => void savePassword()}
                    disabled={savingPw || !curPw || !newPw}
                    className="w-full rounded-[12px] border border-emerald-600 bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-40 sm:w-auto sm:px-6"
                  >
                    {savingPw ? "Updating…" : "Update password"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="border-t border-slate-200/80 pt-4 text-xs text-black/75">
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

        <button
          type="button"
          onClick={onLogout}
          className="w-full rounded-[12px] bg-red-600 py-4 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700"
        >
          Logout
        </button>
      </div>
      </div>
    </div>
  );
}
