/** Trending: score = recent likes + comments + views, decayed by age. Refreshed every 30 minutes. */
import "./init";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";

const db = getFirestore();

export const trendingRefresh = onSchedule("every 30 minutes", async () => {
  const now = Date.now();
  const week = Timestamp.fromMillis(now - 7 * 86_400_000);
  const recentCut = Timestamp.fromMillis(now - 48 * 3_600_000);
  const reels = await db.collection("publicReels").where("createdAt", ">", week).orderBy("createdAt", "desc").limit(150).get();
  const writer = db.bulkWriter();
  for (const d of reels.docs) {
    const x = d.data();
    if (x.hidden === true) { writer.update(d.ref, { trendScore: 0 }); continue; }
    const recent = (await db.collection(`reelLikes/${d.id}/users`).where("createdAt", ">", recentCut).count().get()).data().count;
    const ageH = Math.max(0, (now - (x.createdAt?.toMillis?.() ?? now)) / 3_600_000);
    const raw = recent * 5 + Number(x.commentCount || 0) * 3 + Number(x.views || 0) * 0.1 + Number(x.likeCount || 0) * 0.5 + 1;
    writer.update(d.ref, { trendScore: Math.round((raw / Math.pow(ageH / 24 + 1, 1.2)) * 100) / 100 });
  }
  await writer.close();
});
