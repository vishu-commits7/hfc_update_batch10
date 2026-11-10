import "./init";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

/** The only way a weekly workout goal (3, 4 or 5 days a week) is changed. The app never writes it. */
export const setWeeklyGoal = onCall(async req => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Sign in first.");
  const goal = Number(req.data?.goal);
  if (![3, 4, 5].includes(goal)) throw new HttpsError("invalid-argument", "Pick 3, 4 or 5 workouts a week.");
  await db.doc(`users/${req.auth.uid}`).set({ weeklyGoal: goal }, { merge: true });
  return { weeklyGoal: goal };
});
