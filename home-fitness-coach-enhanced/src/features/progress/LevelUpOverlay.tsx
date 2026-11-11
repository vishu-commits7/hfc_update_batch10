import { useBackClose } from "../../core/backStack";
import { useEffect } from "react";
import { motion } from "motion/react";
import { useState } from "react";
import { Sparkles, ChevronUp, Share2, Loader2, Snowflake, CheckCircle2, Flame } from "lucide-react";
import OverlayPortal from "../../shared/ui/OverlayPortal";
import TrophyIcon from "./TrophyIcon";
import { celebrateFeedback } from "../../core/haptics";
import { cardLink, levelCard, renderFlexCard, shareFlexCard } from "./flexCard";
import { getShowNameOnCards } from "../../core/shareLink";
import { useMyIdentity } from "../social/useSocial";
import type { RewardResult } from "./progress";

/** Full-screen reward moment: level up, new rank and any trophies just earned. */
export default function LevelUpOverlay({ reward, onClose }: { reward: RewardResult; onClose: () => void }) {
  useBackClose(true, onClose);
  useEffect(() => { void celebrateFeedback(); }, []);
  const [sharing, setSharing] = useState(false);
  const me = useMyIdentity();
  const share = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const card = levelCard({
        level: reward.level, rank: reward.rank, xpGained: reward.xpGained, streak: reward.streakDays,
        trophies: reward.newTrophies.length, headline: reward.rankUp ? "Rank up" : reward.levelUp ? "Level up" : "Keep it up",
      });
      if (getShowNameOnCards() && me.name) card.name = me.name; // only if the user turned it on in the share sheet
      const blob = await renderFlexCard(card, "story");
      await shareFlexCard(blob, "apex-pulse-level.png", `I just hit level ${reward.level} (${reward.rank}) on Apex Pulse!`, cardLink(card));
    } catch { /* user cancelled or share unsupported */ } finally { setSharing(false); }
  };
  const headline = reward.rankUp ? `${reward.rank} rank!` : reward.levelUp ? `Level ${reward.level}!` : reward.newTrophies.length ? "New trophy!" : reward.questsCompleted?.length ? "Quest complete!" : reward.freezeUsed ? "Streak saved!" : reward.weekGoalHit ? "Weekly goal reached!" : "Nice work!";

  return (
    <OverlayPortal>
      <motion.div
        className="fixed inset-0 z-[400] flex flex-col items-center justify-center overflow-y-auto bg-void/95 px-6 py-10 text-center text-ink"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
      >
        {/* expanding rings */}
        {[0, 1, 2].map(i => (
          <motion.span
            key={i}
            className="pointer-events-none absolute left-1/2 top-[30%] h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
            style={{ borderColor: "var(--volt)" }}
            initial={{ scale: 0.4, opacity: 0.7 }}
            animate={{ scale: 3.2, opacity: 0 }}
            transition={{ duration: 2.2, delay: i * 0.5, repeat: Infinity, ease: "easeOut" }}
          />
        ))}

        <motion.div
          className="relative flex h-36 w-36 items-center justify-center rounded-full"
          style={{ background: "radial-gradient(circle at 30% 25%, var(--volt), color-mix(in srgb, var(--volt) 35%, transparent))", boxShadow: "0 0 60px color-mix(in srgb, var(--volt) 45%, transparent)" }}
          initial={{ scale: 0, rotate: -25 }} animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 14 }}
        >
          <span className="text-6xl font-black text-void">{reward.level}</span>
          {reward.levelUp && (
            <motion.span className="absolute -right-2 -top-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white"
              initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}>
              <ChevronUp className="h-6 w-6" />
            </motion.span>
          )}
        </motion.div>

        <motion.h1 className="mt-8 text-3xl font-black tracking-tight" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }}>
          {headline}
        </motion.h1>
        <motion.p className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-ink-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <Sparkles className="h-4 w-4 text-volt" /> +{reward.xpGained} XP · {reward.rank}
          {reward.streakDays && reward.streakDays > 1 ? ` · ${reward.streakDays}-day streak` : ""}
        </motion.p>

        {reward.inviteReward && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-volt/40 bg-volt/10 px-3 py-2 text-xs font-semibold">
            <Snowflake className="h-4 w-4 text-sky-300" />Invite reward: {reward.inviteReward.freeze ? "a streak freeze and " : ""}the "{reward.inviteReward.badge}" badge. Your friend got theirs too.
          </div>
        )}
        {(reward.questsCompleted?.length || reward.freezeUsed || reward.freezeEarned || reward.weekGoalHit) ? (
          <div className="mt-6 w-full max-w-sm space-y-2 text-left">
            {reward.questsCompleted?.map(q => (
              <div key={q.title} className="flex items-center gap-2 rounded-xl border border-line bg-carbon px-3 py-2 text-xs font-semibold"><CheckCircle2 className="h-4 w-4 text-emerald-400" />Quest complete: {q.title}<span className="ml-auto text-volt">+{q.xp} XP</span></div>
            ))}
            {reward.freezeUsed && <div className="flex items-center gap-2 rounded-xl border border-line bg-carbon px-3 py-2 text-xs font-semibold"><Snowflake className="h-4 w-4 text-sky-300" />A streak freeze saved your streak</div>}
            {reward.weekGoalHit && <div className="flex items-center gap-2 rounded-xl border border-line bg-carbon px-3 py-2 text-xs font-semibold"><Flame className="h-4 w-4 text-orange-400" />You hit your weekly workout goal</div>}
            {reward.freezeEarned && <div className="flex items-center gap-2 rounded-xl border border-line bg-carbon px-3 py-2 text-xs font-semibold"><Snowflake className="h-4 w-4 text-sky-300" />You earned a streak freeze</div>}
          </div>
        ) : null}

        {reward.newTrophies.length > 0 && (
          <div className="mt-8 w-full max-w-sm space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-widest text-ink-3">Unlocked</p>
            {reward.newTrophies.map((t, i) => (
              <motion.div key={t.id}
                className="flex items-center gap-3 rounded-2xl border border-line bg-carbon p-3 text-left"
                initial={{ x: -30, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.6 + i * 0.2 }}>
                <TrophyIcon def={t} size={52} />
                <div className="min-w-0">
                  <p className="text-sm font-bold">{t.title}</p>
                  <p className="text-xs text-ink-2">{t.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <motion.div className="mt-10 flex w-full max-w-sm gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>
          <button
            onClick={e => { e.stopPropagation(); void share(); }}
            className="flex min-h-[50px] flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-carbon text-sm font-bold active:scale-[0.98]"
          >
            {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} Share
          </button>
          <button
            onClick={e => { e.stopPropagation(); onClose(); }}
            className="min-h-[50px] flex-[2] rounded-xl bg-volt text-sm font-bold text-void active:scale-[0.98]"
          >
            Keep going
          </button>
        </motion.div>
      </motion.div>
    </OverlayPortal>
  );
}
