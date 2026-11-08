import { useEffect, useState, useCallback } from "react";
import { ArrowLeft, Loader2, Ban, ShieldAlert, Trash2, RefreshCw } from "lucide-react";
import OverlayPortal from "./ui/OverlayPortal";
import Avatar from "./ui/Avatar";
import { useBlocked, unblockUser } from "../lib/blocks";
import { useProfiles } from "../lib/useProfiles";
import { callFn } from "../lib/functions";

function Shell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-[300] overflow-y-auto bg-void px-4 pb-16 pt-5 text-ink">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-4 flex items-center gap-3">
            <button onClick={onClose} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-carbon active:scale-95"><ArrowLeft className="h-5 w-5" /></button>
            <h1 className="text-base font-bold">{title}</h1>
          </div>
          {children}
        </div>
      </div>
    </OverlayPortal>
  );
}

export function BlockedUsersScreen({ onClose }: { onClose: () => void }) {
  const blocked = useBlocked();
  const ids = [...blocked];
  const profiles = useProfiles(ids);
  return (
    <Shell title="Blocked users" onClose={onClose}>
      {ids.length === 0 ? (
        <div className="rounded-2xl border border-line bg-carbon p-8 text-center">
          <Ban className="mx-auto h-8 w-8 text-ink-3" />
          <p className="mt-3 text-sm font-semibold">You haven't blocked anyone</p>
          <p className="mt-1 text-xs text-ink-3">Blocked people can't follow or message you, and you won't see their reels or comments.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {ids.map(uid => {
            const p = profiles.get(uid);
            return (
              <li key={uid} className="flex items-center gap-3 rounded-2xl border border-line bg-carbon p-3">
                <Avatar src={p?.avatarUrl ?? null} name={p?.displayName || "Athlete"} size={42} />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{p?.displayName || "Athlete"}</span><span className="block truncate text-xs text-ink-3">@{p?.handle || uid.slice(0, 6)}</span></span>
                <button onClick={() => void unblockUser(uid)} className="rounded-full border border-line bg-graphite px-4 py-2 text-xs font-bold active:scale-95">Unblock</button>
              </li>
            );
          })}
        </ul>
      )}
    </Shell>
  );
}

interface ReportRow { id: string; type: string; targetId: string; reason: string; details: string; ownerUid: string; audience: string; reporterUid: string; at: number }

export function ModerationScreen({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<ReportRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const load = useCallback(async () => {
    setErr(null);
    try { setRows((await callFn<{ reports: ReportRow[] }>("modListReports")).reports); }
    catch (e: any) { setRows([]); setErr(e?.message || "Couldn't load reports."); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const act = async (id: string, action: "dismiss" | "remove" | "ban") => {
    if (action === "ban" && !window.confirm("Ban this user? Their account will be disabled.")) return;
    setBusyId(id);
    try { await callFn("modResolveReport", { id, action }); setRows(r => (r || []).filter(x => x.id !== id)); }
    catch (e: any) { setErr(e?.message || "Action failed."); }
    finally { setBusyId(null); }
  };

  return (
    <Shell title="Moderation queue" onClose={onClose}>
      <button onClick={() => void load()} className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-volt"><RefreshCw className="h-3.5 w-3.5" /> Refresh</button>
      {err && <p className="mb-3 rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{err}</p>}
      {rows === null ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-ink-3" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-line bg-carbon p-8 text-center"><ShieldAlert className="mx-auto h-8 w-8 text-ink-3" /><p className="mt-3 text-sm font-semibold">No open reports</p></div>
      ) : (
        <ul className="space-y-3">
          {rows.map(r => (
            <li key={r.id} className="rounded-2xl border border-line bg-carbon p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-rose-300">{r.type} · {r.reason}</p>
              <p className="mt-1 break-all text-xs text-ink-2">Target: {r.targetId}</p>
              {r.ownerUid && <p className="break-all text-xs text-ink-3">Owner: {r.ownerUid}</p>}
              {r.details && <p className="mt-1 text-xs text-ink-2">"{r.details}"</p>}
              <p className="mt-1 text-[11px] text-ink-3">{r.at ? new Date(r.at).toLocaleString() : ""}</p>
              <div className="mt-3 flex gap-2">
                <button disabled={busyId === r.id} onClick={() => act(r.id, "dismiss")} className="flex-1 rounded-xl border border-line bg-graphite py-2.5 text-xs font-bold disabled:opacity-50">Dismiss</button>
                {(r.type === "reel" || r.type === "comment") && <button disabled={busyId === r.id} onClick={() => act(r.id, "remove")} className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-amber-500 py-2.5 text-xs font-bold text-black disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />Remove</button>}
                <button disabled={busyId === r.id} onClick={() => act(r.id, "ban")} className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white disabled:opacity-50">Ban user</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}

/** Real account deletion: server removes profile, reels, chats, follows and the sign-in. */
export function DeleteAccountDialog({ onClose, onDeleted }: { onClose: () => void; onDeleted: () => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const go = async () => {
    if (text !== "DELETE" || busy) return;
    setBusy(true); setErr(null);
    try { await callFn("deleteAccount", { confirm: "DELETE" }); onDeleted(); }
    catch (e: any) { setErr(e?.message || "Couldn't delete your account. Check your connection and try again."); setBusy(false); }
  };
  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-[460] flex items-center justify-center bg-black/75 p-5" onClick={() => !busy && onClose()}>
        <div className="w-full max-w-sm rounded-3xl border border-line bg-carbon p-6 text-ink" onClick={e => e.stopPropagation()}>
          <Trash2 className="h-7 w-7 text-rose-400" />
          <h2 className="mt-3 text-base font-bold">Delete your account?</h2>
          <p className="mt-2 text-xs leading-relaxed text-ink-2">This permanently removes your profile, reels, comments, follows, chats, trophies and XP from our servers. It cannot be undone. Training data stored on this phone is cleared too.</p>
          <p className="mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Type DELETE to confirm</p>
          <input value={text} onChange={e => setText(e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" className="w-full rounded-xl border border-line-strong bg-graphite px-3 py-3 text-center text-sm font-bold tracking-widest outline-none focus:border-rose-400" />
          {err && <p className="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{err}</p>}
          <div className="mt-4 flex gap-2">
            <button onClick={onClose} disabled={busy} className="flex-1 rounded-xl bg-graphite py-3 text-sm font-bold disabled:opacity-50">Cancel</button>
            <button onClick={go} disabled={text !== "DELETE" || busy} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 py-3 text-sm font-bold text-white disabled:opacity-40">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Delete
            </button>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
}
