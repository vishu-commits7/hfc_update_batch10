import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, limit as fsLimit, onSnapshot, query, where } from "firebase/firestore";
import { ShieldAlert, ShieldCheck, X } from "lucide-react";
import { db } from "../lib/firebase";
import { useBackClose } from "../lib/backStack";
import { useT } from "../i18n";
import OverlayPortal from "./ui/OverlayPortal";

/** The rules for anything a user posts or does in front of other users. Plain English; needs a legal read before launch. */
export const POLICY: { h: string; items: string[] }[] = [
  { h: "What is not allowed", items: [
    "Nudity or sexual content, including on camera in Arena matches.",
    "Harassment, bullying, threats, or hate speech about anyone's body, gender, religion, caste, race or disability.",
    "Violence, self-harm, or dangerous stunts presented as exercise.",
    "Spam, scams, ads, or links that try to take people off the app.",
    "Pretending to be someone else, or posting someone else's photos or videos without their permission.",
    "Cheating: fake rep counts, tools that count for you, or trading wins between accounts.",
    "Anything illegal where you live.",
  ] },
  { h: "What we ask of you", items: [
    "Post your own workouts and progress. Be kind in comments.",
    "Do not give medical advice. Share what worked for you, not what others must do.",
    "You must be 13 or older to use the social features.",
  ] },
  { h: "Reporting and blocking", items: [
    "Use Report on any reel, post, comment, profile or Arena match. Reports are private; the other person is not told who reported.",
    "Use Block to stop someone seeing you, following you or messaging you. You can undo it in Settings.",
    "A reel or post that several people report is hidden until a moderator checks it.",
  ] },
  { h: "What happens when a rule is broken", items: [
    "A moderator can remove the content. You get a message in the app saying what was removed and why.",
    "Repeated or serious breaks get the account disabled.",
    "If you think we got it wrong, reply through the support email on our Play Store page.",
  ] },
];

/** Full-screen content policy. Linked from Settings and from the sign-up screen. */
export function ContentPolicySheet({ onClose }: { onClose: () => void }) {
  useBackClose(true, onClose);
  const t = useT();
  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-[460] overflow-y-auto bg-void text-ink" role="dialog" aria-modal="true" aria-label={t("policy.title")}>
        <div className="mx-auto w-full max-w-md px-5 pb-16 pt-5">
          <div className="flex items-center justify-between">
            <h1 className="flex items-center gap-2 text-lg font-bold"><ShieldCheck className="h-5 w-5 text-volt" /> {t("policy.title")}</h1>
            <button onClick={onClose} aria-label={t("common.back")} className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-carbon"><X className="h-5 w-5" /></button>
          </div>
          <p className="mt-2 text-xs text-ink-3">{t("policy.intro")}</p>
          {POLICY.map(sec => (
            <section key={sec.h} className="mt-5">
              <h2 className="text-sm font-bold text-volt">{sec.h}</h2>
              <ul className="mt-2 space-y-2">
                {sec.items.map(i => <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-3" />{i}</li>)}
              </ul>
            </section>
          ))}
          <button onClick={onClose} className="mt-8 min-h-[50px] w-full rounded-xl bg-volt text-sm font-bold text-void active:scale-[0.98]">{t("policy.ok")}</button>
        </div>
      </div>
    </OverlayPortal>
  );
}

interface Notice { id: string; text: string }

/**
 * What the signed-in user sees after a moderator acts:
 *  - a banner for each "your reel/post/comment was removed" message, until they tap OK
 *  - a full-screen notice when the account has been disabled
 */
export function ModerationGate({ uid, onSignOut }: { uid: string | null | undefined; onSignOut: () => void }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [banned, setBanned] = useState(false);
  const [policy, setPolicy] = useState(false);
  const t = useT();

  useEffect(() => {
    setNotices([]); setBanned(false);
    if (!uid) return;
    const un1 = onSnapshot(query(collection(db, "notifs", uid, "items"), where("type", "==", "moderation"), fsLimit(5)),
      snap => setNotices(snap.docs.map(d => ({ id: d.id, text: String(d.data().text || "") }))), () => {});
    const un2 = onSnapshot(doc(db, "users", uid), snap => setBanned(snap.data()?.banned === true), () => {});
    return () => { un1(); un2(); };
  }, [uid]);

  if (!uid) return null;
  if (banned) {
    return (
      <OverlayPortal>
        <div className="fixed inset-0 z-[470] flex flex-col items-center justify-center bg-void px-6 text-center text-ink" role="alertdialog" aria-modal="true">
          <ShieldAlert className="h-12 w-12 text-rose-400" />
          <h1 className="mt-4 text-xl font-bold">{t("mod.banned.title")}</h1>
          <p className="mt-2 max-w-sm text-sm text-ink-2">{t("mod.banned.body")}</p>
          <button onClick={() => setPolicy(true)} className="mt-6 min-h-[48px] w-full max-w-xs rounded-xl border border-line bg-carbon text-sm font-bold">{t("mod.readPolicy")}</button>
          <button onClick={onSignOut} className="mt-2 min-h-[48px] w-full max-w-xs rounded-xl bg-volt text-sm font-bold text-void">{t("mod.signOut")}</button>
          {policy && <ContentPolicySheet onClose={() => setPolicy(false)} />}
        </div>
      </OverlayPortal>
    );
  }
  if (!notices.length) return null;
  const n = notices[0];
  return (
    <OverlayPortal>
      <div className="fixed inset-x-0 top-0 z-[440] px-3 pt-[max(12px,env(safe-area-inset-top))]" role="alert">
        <div className="mx-auto max-w-md rounded-2xl border border-rose-400/40 bg-carbon p-4 text-ink shadow-2xl">
          <p className="flex items-center gap-2 text-sm font-bold"><ShieldAlert className="h-4 w-4 text-rose-400" /> {t("mod.notice.title")}</p>
          <p className="mt-1 text-sm text-ink-2">{n.text}</p>
          <div className="mt-3 flex gap-2">
            <button onClick={() => setPolicy(true)} className="min-h-[44px] flex-1 rounded-xl border border-line bg-graphite text-xs font-bold">{t("mod.readPolicy")}</button>
            <button onClick={() => { setNotices(x => x.filter(y => y.id !== n.id)); void deleteDoc(doc(db, "notifs", uid, "items", n.id)).catch(() => {}); }} className="min-h-[44px] flex-1 rounded-xl bg-volt text-xs font-bold text-void">{t("mod.notice.ok")}</button>
          </div>
        </div>
      </div>
      {policy && <ContentPolicySheet onClose={() => setPolicy(false)} />}
    </OverlayPortal>
  );
}
