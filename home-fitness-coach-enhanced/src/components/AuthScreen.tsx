import React, { useState } from "react";
import { Loader2, Mail, Lock, User as UserIcon, ArrowLeft, CheckCircle2 } from "lucide-react";
import { signUp, logIn, resetPassword, friendlyAuthError } from "../lib/useAuth";

interface AuthScreenProps {
  onBack: () => void;
  onAuthed: () => void;
}

type Mode = "login" | "signup" | "reset";

export default function AuthScreen({ onBack, onAuthed }: AuthScreenProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await logIn(email.trim(), password);
        onAuthed();
      } else if (mode === "signup") {
        if (!displayName.trim()) throw new Error("Please enter a display name.");
        await signUp(email.trim(), password, displayName.trim());
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

  return (
    <div className="max-w-3xl mx-auto animate-fade-in text-slate-800 pb-12">
      <div className="mb-5 flex items-center gap-4">
        <button
          onClick={onBack}
          className="group flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-xs transition-all hover:border-slate-300 hover:bg-slate-50"
          title="Back"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        </button>
      </div>

      <div className="mx-auto max-w-sm">
        <h1 className="text-2xl font-black text-slate-900">
          {mode === "login" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset password"}
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">
          {mode === "login" && "Log in to share progress, like and comment in the Community Gallery."}
          {mode === "signup" && "Just an email and a display name — takes a few seconds."}
          {mode === "reset" && "We'll email you a link to set a new password."}
        </p>

        {resetSent ? (
          <div className="mt-8 flex flex-col items-center gap-3 rounded-3xl border border-emerald-100 bg-emerald-50 p-6 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <p className="text-sm font-bold text-emerald-800">Reset link sent to {email}. Check your inbox.</p>
            <button onClick={() => { setMode("login"); setResetSent(false); }} className="mt-1 text-xs font-black uppercase tracking-wider text-emerald-700 underline">
              Back to login
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-3.5">
            {mode === "signup" && (
              <label className="block">
                <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-400">Display name</span>
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-3">
                  <UserIcon className="h-4 w-4 shrink-0 text-slate-400" />
                  <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="e.g. Vishnu" className="w-full text-sm outline-none" required />
                </div>
              </label>
            )}

            <label className="block">
              <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-400">Email</span>
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-3">
                <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="w-full text-sm outline-none" required />
              </div>
            </label>

            {mode !== "reset" && (
              <label className="block">
                <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-slate-400">Password</span>
                <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-3">
                  <Lock className="h-4 w-4 shrink-0 text-slate-400" />
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" className="w-full text-sm outline-none" required minLength={6} />
                </div>
              </label>
            )}

            {error && <p className="rounded-xl bg-red-50 px-3 py-2.5 text-xs font-bold text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3.5 text-sm font-black uppercase tracking-wider text-white transition hover:bg-slate-800 active:scale-95 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "login" ? "Log in" : mode === "signup" ? "Sign up" : "Send reset link"}
            </button>

            <div className="flex items-center justify-between pt-1 text-xs font-bold">
              {mode === "login" && (
                <>
                  <button type="button" onClick={() => { setMode("reset"); setError(null); }} className="text-slate-500 underline">Forgot password?</button>
                  <button type="button" onClick={() => { setMode("signup"); setError(null); }} className="text-blue-600 underline">Create an account</button>
                </>
              )}
              {mode === "signup" && (
                <button type="button" onClick={() => { setMode("login"); setError(null); }} className="mx-auto text-blue-600 underline">Already have an account? Log in</button>
              )}
              {mode === "reset" && (
                <button type="button" onClick={() => { setMode("login"); setError(null); }} className="mx-auto text-blue-600 underline">Back to login</button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
