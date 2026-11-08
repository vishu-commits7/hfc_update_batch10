/**
 * Weekly leagues: Bronze -> Silver -> Gold -> Platinum -> Diamond, groups of 30, ranked by XP earned this week.
 * Top 10 promote, bottom 5 demote (groups of 10+), weekly XP resets every Monday 00:00 IST.
 */
import "./init";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { weekIdIST } from "./timeutil";

const db = () => getFirestore();
export const LEAGUES = ["Bronze", "Silver", "Gold", "Platinum", "Diamond"] as const;
const GROUP_SIZE = 30, PROMOTE = 10, DEMOTE = 5;

/** Puts the caller into this week's league group (idempotent). */
export const joinLeague = onCall(async req => {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const week = weekIdIST();
  return db().runTransaction(async tx => {
    const uref = db().doc(`users/${uid}`);
    const u = await tx.get(uref);
    const x = (u.data() ?? {}) as Record<string, any>;
    if (x.public === false) throw new HttpsError("failed-precondition", "Make your account public in Settings to join leagues.");
    if (x.leagueWeek === week && x.leagueGroup) return { group: x.leagueGroup, tier: Number(x.leagueTier || 0) };
    const tier = Math.max(0, Math.min(LEAGUES.length - 1, Number(x.leagueTier || 0)));
    const cref = db().doc(`leagueCounters/${week}_${tier}`);
    const c = await tx.get(cref);
    let n = Number(c.data()?.n || 1), size = Number(c.data()?.size || 0);
    if (size >= GROUP_SIZE) { n += 1; size = 0; }
    tx.set(cref, { n, size: size + 1 });
    const group = `${week}_${tier}_${n}`;
    tx.set(uref, { leagueGroup: group, leagueWeek: week, leagueTier: tier }, { merge: true });
    return { group, tier };
  });
});

function previousWeekId() { return weekIdIST(Date.now() - 24 * 3600_000); }

export const leagueRollover = onSchedule({ schedule: "5 0 * * 1", timeZone: "Asia/Kolkata", timeoutSeconds: 540 }, async () => {
  const prev = previousWeekId();
  const groups = new Map<string, { id: string; xp: number; tier: number; wasPrev: boolean }[]>();
  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (;;) {
    let q = db().collection("users").where("leagueWeek", "==", prev).orderBy("__name__").limit(400);
    if (last) q = q.startAfter(last);
    const snap = await q.get();
    if (snap.empty) break;
    for (const d of snap.docs) {
      const x = d.data();
      const arr = groups.get(x.leagueGroup) ?? [];
      arr.push({ id: d.id, xp: x.weekId === prev ? Number(x.weekXp || 0) : 0, tier: Number(x.leagueTier || 0), wasPrev: x.weekId === prev });
      groups.set(x.leagueGroup, arr);
    }
    last = snap.docs[snap.docs.length - 1];
  }

  const writer = db().bulkWriter();
  for (const members of groups.values()) {
    members.sort((a, b) => b.xp - a.xp);
    members.forEach((m, i) => {
      const rank = i + 1, size = members.length;
      let outcome: "promoted" | "demoted" | "stayed" = "stayed";
      let tier = m.tier;
      if (rank <= PROMOTE && m.xp > 0 && tier < LEAGUES.length - 1) { tier += 1; outcome = "promoted"; }
      else if (size >= 10 && rank > size - DEMOTE && tier > 0) { tier -= 1; outcome = "demoted"; }
      writer.set(db().doc(`users/${m.id}`), {
        leagueTier: tier, leagueGroup: FieldValue.delete(), leagueWeek: FieldValue.delete(),
        // only reset weekly XP if it still belongs to the finished week (not XP earned after midnight)
        ...(m.wasPrev ? { weekXp: 0, weekId: FieldValue.delete() } : {}),
        lastLeagueResult: { week: prev, tier: m.tier, newTier: tier, rank, size, outcome, xp: m.xp },
      }, { merge: true });
      if (outcome === "promoted" && tier >= 1) {
        const id = `league_${LEAGUES[tier].toLowerCase()}`;
        writer.set(db().doc(`users/${m.id}/trophies/${id}`), {
          id, title: `${LEAGUES[tier]} League`, desc: `Promoted to the ${LEAGUES[tier]} league`,
          tier: tier >= 3 ? "diamond" : tier === 2 ? "gold" : "silver", icon: "medal", at: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    });
  }
  await writer.close();
});
