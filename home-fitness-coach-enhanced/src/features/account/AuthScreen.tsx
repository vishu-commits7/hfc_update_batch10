import React, { useState, useEffect } from "react";
import { Loader2, Mail, Lock, User as UserIcon, ArrowLeft, CheckCircle2, Eye, EyeOff, ShieldCheck, Zap, AlertCircle } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../core/firebase";
import { signUp, logIn, logInWithGoogle, logInAsGuest, resetPassword, friendlyAuthError } from "../../core/useAuth";
import { track } from "../../core/track";
import { EV } from "../../core/analyticsEvents";
import { getAuthGate } from "../../core/flags";
import { useT, tSplit } from "../../i18n";
import { ContentPolicySheet } from "../safety/ContentPolicy";
import LanguageSwitch from "../../shared/LanguageSwitch";

interface AuthScreenProps {
  onBack: () => void;
  onAuthed: () => void;
  /** Login-first: hides Back and guest access. */
  required?: boolean;
}

type Mode = "login" | "signup" | "reset";

function AuthScreenInner({ onBack, onAuthed, required = false }: AuthScreenProps) {
  const t = useT();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [guestBusy, setGuestBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPolicy, setShowPolicy] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // funnel: how many people see this screen, tap a sign-in method, and finish. `gate` says which gate mode they were in.
  useEffect(() => { track(EV.signinShown, { gate: required ? getAuthGate() : "optional" }); }, [required]);

  // Automatically advance if already authenticated or returning from mobile Google redirect
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        onAuthed();
      }
    });
    return unsub;
  }, [onAuthed]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        track(EV.signinStarted, { method: "email" });
        await logIn(email.trim(), password);
        track(EV.signinCompleted, { method: "email" });
        onAuthed();
      } else if (mode === "signup") {
        if (!displayName.trim()) throw new Error(t("auth.err.alias"));
        track(EV.signinStarted, { method: "email" });
        await signUp(email.trim(), password, displayName.trim());
        track(EV.signinCompleted, { method: "email" });
        onAuthed();
      } else {
        await resetPassword(email.trim());
        setResetSent(true);
      }
    } catch (err) {
      setError(err instanceof Error && !("code" in err) ? err.message : friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleBusy(true);
    track(EV.signinStarted, { method: "google" });

    // The native account picker can legitimately stay open for a while.
    const timeoutTimer = setTimeout(() => {
      setGoogleBusy(false);
      setError(t("auth.err.slow"));
    }, 120000);

    try {
      const user = await logInWithGoogle();
      clearTimeout(timeoutTimer);
      if (user) {
        track(EV.signinCompleted, { method: "google" });
        onAuthed();
      }
    } catch (err: any) {
      clearTimeout(timeoutTimer);
      console.warn("Google sign-in attempt failed:", err);
      const friendly = friendlyAuthError(err);
      setError(friendly);
    } finally {
      clearTimeout(timeoutTimer);
      setGoogleBusy(false);
    }
  };

  const handleGuestSignIn = async () => {
    setError(null);
    setGuestBusy(true);
    track(EV.signinStarted, { method: "guest" });
    try {
      await logInAsGuest();
      track(EV.signinCompleted, { method: "guest" });
      onAuthed();
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setGuestBusy(false);
    }
  };

  const isStorageBlocked = !!error && (error === t("auth.err.storage") || error === t("auth.err.popup"));
  const isAlreadyExists = !!error && error === t("auth.err.exists");

  return (
    <div className="max-w-md mx-auto animate-fade-in text-slate-100 pb-16 px-4">
      {/* Top Header */}
      <div className="mb-2 flex justify-end"><LanguageSwitch /></div>
      <div className="mb-5 flex items-center justify-between">
        {required ? <span className="h-10 w-10" /> : (
        <button
          onClick={onBack}
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-slate-900/80 text-slate-300 shadow-md backdrop-blur-md transition-all hover:border-cyan-500/40 hover:text-white active:scale-95"
          title={t("common.back")}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        )}

        <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-950/40 px-3 py-1 text-[11px] font-bold tracking-wider uppercase text-cyan-400">
          <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" /> {t("auth.cloudSync")}
        </span>
      </div>

      <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900/90 to-black/95 p-6 sm:p-7 shadow-2xl backdrop-blur-2xl">
        {/* Brand Header */}
        <div className="text-center mb-5">
          <div className="relative mx-auto mb-3 h-14 w-14 overflow-hidden rounded-2xl border-2 border-cyan-500/40 shadow-[0_0_24px_rgba(6,182,212,0.3)]">
            <img src="/app-logo.jpg" alt="APEX PULSE" className="h-full w-full object-cover" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            APEX <span className="bg-gradient-to-r from-cyan-400 to-amber-400 bg-clip-text text-transparent">PULSE</span>
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            {mode === "login" && t("auth.sub.login")}
            {mode === "signup" && t("auth.sub.signup")}
            {mode === "reset" && t("auth.sub.reset")}
          </p>
        </div>

        {/* 1-Tap Google Sign-In */}
        <div className="space-y-3">
          <p className="text-center text-base font-black text-cyan-300">{t("auth.tagline")}</p>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleBusy || busy || guestBusy}
            className="flex min-h-[64px] w-full items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white px-4 py-4 text-base font-black text-slate-900 shadow-lg transition-all hover:bg-slate-100 hover:shadow-cyan-500/20 active:scale-98 disabled:opacity-50 cursor-pointer"
          >
            {googleBusy ? (
              <Loader2 className="h-6 w-6 animate-spin text-slate-900" />
            ) : (
              <svg className="h-6 w-6 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>{t("auth.google")}</span>
          </button>

          {!required && (<>
          {/* Instant 1-Tap Guest Access */}
          <button
            type="button"
            onClick={handleGuestSignIn}
            disabled={busy || googleBusy || guestBusy}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-500/30 bg-cyan-950/30 text-cyan-300 hover:bg-cyan-900/40 py-3 px-4 font-bold text-xs tracking-wide transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
          >
            {guestBusy ? (
              <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
            ) : (
              <Zap className="h-4 w-4 text-cyan-400" />
            )}
            <span>{t("auth.guest")}</span>
          </button>

          </>)}

          <div className="relative my-4 flex items-center justify-center">
            <div className="w-full border-t border-white/10" />
            <span className="absolute bg-slate-900 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {t("auth.or")}
            </span>
          </div>
        </div>

        {/* Sign In vs Create Account Tabs */}
        <div className="mb-4 flex rounded-2xl bg-white/5 p-1 border border-white/10">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
            }}
            className={`flex-1 rounded-xl py-2 text-xs font-black uppercase tracking-wider transition ${
              mode === "login"
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {t("auth.signIn")}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError(null);
            }}
            className={`flex-1 rounded-xl py-2 text-xs font-black uppercase tracking-wider transition ${
              mode === "signup"
                ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {t("auth.create")}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-950/40 p-3.5 text-xs text-amber-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">{error}</p>
                {isAlreadyExists && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setError(null);
                    }}
                    className="mt-2 inline-flex items-center gap-1 rounded-lg bg-cyan-400 px-3 py-1 text-[11px] font-black text-slate-950 hover:bg-cyan-300"
                  >
                    {t("auth.switchToSignIn")}
                  </button>
                )}
                {isStorageBlocked && !required && (
                  <button
                    type="button"
                    onClick={handleGuestSignIn}
                    className="mt-2 inline-flex items-center gap-1 rounded-lg bg-amber-400 px-2.5 py-1 text-[11px] font-black text-slate-950"
                  >
                    <Zap className="h-3 w-3" /> {t("auth.guestInstead")}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {resetSent ? (
          <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-950/40 p-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            <p className="text-sm font-bold text-emerald-200">
              {tSplit("auth.resetSent", "email")[0]}<span className="text-white underline">{email}</span>{tSplit("auth.resetSent", "email")[1]}
            </p>
            <button
              onClick={() => {
                setMode("login");
                setResetSent(false);
              }}
              className="mt-2 text-xs font-black uppercase tracking-wider text-emerald-400 hover:text-emerald-300 underline"
            >
              {t("auth.backToSignIn")}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3.5">
            {mode === "signup" && (
              <p className="text-xs leading-relaxed text-slate-400">
                {tSplit("auth.policyLine", "link")[0]}
                <button type="button" onClick={() => setShowPolicy(true)} className="font-semibold text-cyan-400 underline underline-offset-2">{t("policy.title")}</button>
                {tSplit("auth.policyLine", "link")[1]}
              </p>
            )}
            {mode === "signup" && (
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">
                  {t("auth.athleteName")}
                </span>
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3.5 py-3 transition focus-within:border-cyan-400 focus-within:bg-black/60">
                  <UserIcon className="h-4 w-4 shrink-0 text-slate-400" />
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={t("auth.athletePlaceholder")}
                    className="w-full text-sm text-white placeholder-slate-500 outline-none bg-transparent"
                    required
                  />
                </div>
              </label>
            )}

            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">
                {t("auth.email")}
              </span>
              <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3.5 py-3 transition focus-within:border-cyan-400 focus-within:bg-black/60">
                <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="athlete@gmail.com"
                  className="w-full text-sm text-white placeholder-slate-500 outline-none bg-transparent"
                  required
                />
              </div>
            </label>

            {mode !== "reset" && (
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-400">
                  {t("auth.password")}
                </span>
                <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3.5 py-3 transition focus-within:border-cyan-400 focus-within:bg-black/60">
                  <Lock className="h-4 w-4 shrink-0 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("auth.passwordPlaceholder")}
                    className="w-full text-sm text-white placeholder-slate-500 outline-none bg-transparent"
                    required
                    minLength={6}
                  />
                  <button aria-label={showPassword ? t("auth.hidePw") : t("auth.showPw")}
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
            )}

            <button
              type="submit"
              disabled={busy || googleBusy || guestBusy}
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 py-3 text-xs font-black uppercase tracking-wider text-white transition hover:bg-white/10 active:scale-98 disabled:opacity-60 cursor-pointer"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "login" ? t("auth.signIn") : mode === "signup" ? t("auth.create") : t("auth.sendReset")}
            </button>

            <div className="flex items-center justify-between pt-2 text-xs font-bold">
              {mode === "login" && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("reset");
                      setError(null);
                    }}
                    className="text-slate-400 hover:text-white transition"
                  >
                    {t("auth.forgot")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("signup");
                      setError(null);
                    }}
                    className="text-cyan-400 hover:text-cyan-300 transition"
                  >
                    {t("auth.create")}
                  </button>
                </>
              )}
              {mode === "signup" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                  }}
                  className="mx-auto text-cyan-400 hover:text-cyan-300 transition"
                >
                  {t("auth.haveAccount")}
                </button>
              )}
              {mode === "reset" && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                  }}
                  className="mx-auto text-cyan-400 hover:text-cyan-300 transition"
                >
                  {t("auth.backToSignIn")}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
      {showPolicy && <ContentPolicySheet onClose={() => setShowPolicy(false)} />}
    </div>
  );
}

const AuthScreen = React.memo(AuthScreenInner);
export default AuthScreen;
