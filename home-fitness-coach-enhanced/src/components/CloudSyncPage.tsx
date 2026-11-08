import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Cloud, CloudDownload, CloudUpload, LogIn, LogOut, ShieldCheck } from "lucide-react";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuthUser, logOut } from "../lib/useAuth";
import { exportBackupJson, restoreFromJson } from "../lib/backup";
import { tapFeedback } from "../lib/haptics";

interface Props {
  onBack: () => void;
  onSignIn: () => void;
}

type Status = { kind: "idle" | "busy" | "ok" | "error"; message?: string };

/**
 * Dedicated Cloud Sync screen. Backs the athlete's data up to their own
 * Firestore document and restores it on any device they sign in on.
 */
export default function CloudSyncPage({ onBack, onSignIn }: Props) {
  const { user } = useAuthUser();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);

  const backupRef = user ? doc(db, "users", user.uid, "backups", "latest") : null;

  const loadMeta = useCallback(async () => {
    if (!backupRef) return;
    try {
      const snap = await getDoc(backupRef);
      const at = snap.exists() ? (snap.data().exportedAt as string | undefined) : undefined;
      setLastSynced(at ?? null);
    } catch {
      /* offline or rules not deployed — shown on the first action instead */
    }
  }, [backupRef?.path]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  const backupNow = async () => {
    if (!backupRef) return;
    tapFeedback();
    setStatus({ kind: "busy", message: "Backing up…" });
    try {
      const payload = exportBackupJson(true);
      const exportedAt = new Date().toISOString();
      await setDoc(backupRef, { payload, exportedAt, updatedAt: serverTimestamp() });
      setLastSynced(exportedAt);
      setStatus({ kind: "ok", message: "Backed up. Your data is safe in the cloud." });
    } catch (e: any) {
      setStatus({
        kind: "error",
        message:
          e?.code === "permission-denied"
            ? "Cloud rules are not deployed yet. Allow signed-in users to read/write users/{uid}/backups in Firestore."
            : "Could not reach the cloud. Check your connection and try again.",
      });
    }
  };

  const restoreNow = async () => {
    if (!backupRef) return;
    setConfirmRestore(false);
    tapFeedback();
    setStatus({ kind: "busy", message: "Restoring…" });
    try {
      const snap = await getDoc(backupRef);
      if (!snap.exists()) {
        setStatus({ kind: "error", message: "No cloud backup found for this account yet." });
        return;
      }
      const res = restoreFromJson(String(snap.data().payload || ""));
      if (!res.ok) {
        setStatus({ kind: "error", message: res.error });
        return;
      }
      setStatus({ kind: "ok", message: "Restored. Reloading your data…" });
      setTimeout(() => window.location.reload(), 900);
    } catch {
      setStatus({ kind: "error", message: "Could not restore. Check your connection and try again." });
    }
  };

  const card = { background: "var(--carbon)", borderColor: "var(--line)" } as const;
  const name = user?.displayName || user?.email || "Athlete";
  const isGuest = !!user?.isAnonymous;

  return (
    <div className="mx-auto max-w-md pb-10" style={{ color: "var(--ink)" }}>
      <div className="mb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="grid h-11 w-11 place-items-center rounded-xl border"
          style={card}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold tracking-tight">Cloud Sync</h1>
      </div>

      <div className="rounded-2xl border p-5" style={card}>
        <div className="flex items-center gap-3">
          <div
            className="grid h-12 w-12 place-items-center rounded-xl"
            style={{ background: "var(--graphite)", color: "var(--ink)" }}
          >
            <Cloud className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold">
              {user ? (isGuest ? "Guest athlete" : name) : "Not signed in"}
            </p>
            <p className="text-xs" style={{ color: "var(--ink-3)" }}>
              {user
                ? lastSynced
                  ? `Last backup ${new Date(lastSynced).toLocaleString()}`
                  : "No backup yet"
                : "Sign in to back up workouts, streaks and progress."}
            </p>
          </div>
        </div>

        {!user ? (
          <button
            type="button"
            onClick={() => {
              tapFeedback();
              onSignIn();
            }}
            className="mt-5 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl text-sm font-bold"
            style={{ background: "var(--volt)", color: "var(--void)" }}
          >
            <LogIn className="h-4 w-4" /> Sign in to sync
          </button>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={backupNow}
              disabled={status.kind === "busy"}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl text-sm font-bold disabled:opacity-50"
              style={{ background: "var(--volt)", color: "var(--void)" }}
            >
              <CloudUpload className="h-4 w-4" /> Back up now
            </button>
            <button
              type="button"
              onClick={() => setConfirmRestore(true)}
              disabled={status.kind === "busy"}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border text-sm font-semibold disabled:opacity-50"
              style={{ borderColor: "var(--line-strong)", color: "var(--ink)" }}
            >
              <CloudDownload className="h-4 w-4" /> Restore
            </button>
          </div>
        )}

        {status.kind !== "idle" && (
          <p
            role="status"
            className="mt-4 rounded-xl px-3 py-2.5 text-xs font-medium"
            style={{
              background: status.kind === "error" ? "var(--crimson-wash)" : "var(--graphite)",
              color: status.kind === "error" ? "var(--crimson)" : "var(--ink-2)",
            }}
          >
            {status.message}
          </p>
        )}

        {isGuest && (
          <p className="mt-3 text-xs" style={{ color: "var(--ink-3)" }}>
            Guest accounts are tied to this device. Sign in with Google or email to restore on another phone.
          </p>
        )}
      </div>

      <div className="mt-3 flex items-start gap-2.5 rounded-2xl border p-4" style={card}>
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--emerald)" }} />
        <p className="text-xs leading-relaxed" style={{ color: "var(--ink-2)" }}>
          Backups are stored under your own account only. Progress photos stay on this device.
        </p>
      </div>

      {user && (
        <button
          type="button"
          onClick={() => {
            tapFeedback();
            void logOut();
          }}
          className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border text-sm font-semibold"
          style={{ borderColor: "var(--line)", color: "var(--ink-2)" }}
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      )}

      {confirmRestore && (
        <div
          className="fixed inset-0 z-[120] grid place-items-center p-5"
          style={{ background: "var(--scrim)" }}
          onClick={() => setConfirmRestore(false)}
        >
          <div
            className="w-full max-w-xs rounded-3xl border p-6 text-center"
            style={card}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold">Restore from cloud?</h3>
            <p className="mt-2 text-xs" style={{ color: "var(--ink-2)" }}>
              This replaces the data on this phone with your latest cloud backup.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmRestore(false)}
                className="min-h-[44px] flex-1 rounded-xl border text-sm font-semibold"
                style={{ borderColor: "var(--line)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={restoreNow}
                className="min-h-[44px] flex-1 rounded-xl text-sm font-bold"
                style={{ background: "var(--volt)", color: "var(--void)" }}
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
