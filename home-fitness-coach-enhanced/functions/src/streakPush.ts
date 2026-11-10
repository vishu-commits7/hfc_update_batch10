/**
 * "Streak at risk" push. Runs every hour; at 20:00 in each user's own time it nudges people who trained
 * yesterday (so they have a streak of 3+ days) but not yet today. The user's timezone comes from
 * users/{uid}.tzOffset (minutes from UTC), which the app updates on every launch.
 * notifyLib.push() applies the user's on/off choice, quiet hours and the one-push-per-day cap.
 */
import "./init";
import { getFirestore, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { push } from "./notifyLib";

const db = getFirestore();
const SEND_HOUR = 20;
const MIN_STREAK = 3;

export const streakAtRiskPush = onSchedule("every 60 minutes", async () => {
  const now = Date.now();
  // timezone offsets (in 15-minute steps) whose local clock is in the 20:00 hour right now
  const offsets: number[] = [];
  for (let o = -720; o <= 840; o += 15) if (new Date(now + o * 60_000).getUTCHours() === SEND_HOUR) offsets.push(o);

  for (const o of offsets) {
    const yesterday = new Date(now + o * 60_000 - 86_400_000).toISOString().slice(0, 10);
    let last: QueryDocumentSnapshot | undefined;
    for (let page = 0; page < 20; page++) { // up to 6000 users per timezone per run
      let q = db.collection("users").where("tzOffset", "==", o).where("lastWorkoutDay", "==", yesterday).limit(300);
      if (last) q = q.startAfter(last);
      const snap = await q.get();
      if (snap.empty) break;
      await Promise.all(snap.docs.map(d => {
        const streak = Number(d.data().streakDays || 0);
        if (streak < MIN_STREAK) return Promise.resolve(false);
        return push(d.id, "streak", `${streak}-day streak at risk`, "A 2-minute workout keeps it alive tonight.", { type: "streak" }).catch(() => false);
      }));
      last = snap.docs[snap.docs.length - 1];
      if (snap.size < 300) break;
    }
  }
});
