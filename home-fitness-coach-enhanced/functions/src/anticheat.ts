/**
 * Anti-cheat record. `cheatFlags/{uid}` is server-only: refused rep counts ("strikes") and cheating reports.
 * 3 strikes in 7 days, or 3 different players reporting cheating, flags the account for a moderator to look at.
 * Flagging never bans by itself: a person decides (Settings > Moderation, ADMIN_EMAILS only).
 */
import "./init";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { FLAG_REPORTERS, addStrike } from "./repLimits";

const db = getFirestore();
export type StrikeKind = "arena-rate" | "daily-rate";

/** Counts one refused rep count against an account. Never throws: anti-cheat must not break a match. */
export async function strike(uid: string, kind: StrikeKind, detail: string): Promise<void> {
  try {
    const ref = db.doc(`cheatFlags/${uid}`);
    await db.runTransaction(async tx => {
      const x = (await tx.get(ref)).data() ?? {};
      const now = Date.now();
      const next = addStrike(Array.isArray(x.recent) ? x.recent : [], now);
      const flagged = next.flagged || !!x.flagged;
      tx.set(ref, {
        uid, strikes: Number(x.strikes || 0) + 1, recent: next.recent, flagged, lastAt: now,
        last: { kind, detail: detail.slice(0, 200), at: now },
        ...(flagged && !x.flagged ? { flaggedAt: now, flagReason: "strikes" } : {}),
      }, { merge: true });
    });
  } catch { /* best effort */ }
}

/** A player reported this account for cheating in a match they both played. */
export async function noteCheatReport(target: string, reporter: string): Promise<void> {
  try {
    const ref = db.doc(`cheatFlags/${target}`);
    await db.runTransaction(async tx => {
      const x = (await tx.get(ref)).data() ?? {};
      const reporters: string[] = Array.from(new Set([...(Array.isArray(x.reporters) ? x.reporters : []), reporter])).slice(-30);
      const flagged = !!x.flagged || reporters.length >= FLAG_REPORTERS;
      tx.set(ref, {
        uid: target, reporters, flagged, lastAt: Date.now(),
        ...(flagged && !x.flagged ? { flaggedAt: Date.now(), flagReason: "reports" } : {}),
      }, { merge: true });
    });
  } catch { /* best effort */ }
}

export const clearFlag = (uid: string) => db.doc(`cheatFlags/${uid}`).set({ flagged: false, recent: [], reporters: [], clearedAt: FieldValue.serverTimestamp() }, { merge: true });
