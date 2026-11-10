import { shareContent } from "../lib/nativeBridge";
import React, { useEffect, useState, useRef } from "react";
import {
  ArrowLeft, UserCircle2, Lock, Globe, Lock as LockIcon, Share2, Moon,
  SunMedium, Volume2, VolumeX, Music, Music2 as MusicOff, Dumbbell, Trash2,
  LogOut, ChevronRight, Loader2, CheckCircle2, Bell, BellOff, 
  Download, Upload, Vibrate, FileText, ShieldCheck, X, Ban, ShieldAlert,
} from "lucide-react";
import { useAuthUser, logOut, getUserProfile, saveUserProfile, resetPassword, UserProfileDoc } from "../lib/useAuth";
import { audio } from "../lib/audio";
import { lofiMusic } from "../lib/lofiMusic";
import {
  loadNotificationPrefs, saveNotificationPrefs, requestNotificationPermission,
  applyDailyReminder, applyStreakWarning, applyWaterReminder, NotificationPrefs,
} from "../lib/notifications";
import NotificationSettings from "./NotificationSettings";
import { BlockedUsersScreen, ModerationScreen, DeleteAccountDialog } from "./SafetyScreens";
import { ContentPolicySheet } from "./ContentPolicy";
import { callFn } from "../lib/functions";
import { setAccountPublic } from "../lib/social";
import { useMyIdentity } from "../lib/useSocial";
import { loadSocialPrefs, saveSocialPrefs, requestPerm, type SocialNotifPrefs } from "../lib/notifyPrefs";
import { downloadBackup, shareBackup, importBackupFile } from "../lib/backup";
import { isHapticsEnabled, setHapticsEnabled, tapFeedback } from "../lib/haptics";
import { WorkoutLog } from "../types";
import { computeAnalytics, trainedToday } from "../lib/analytics";
import { planNudge, shouldNudgeToday } from "../lib/smartNudge";
import { useT, useLang } from "../i18n";
import LanguageSwitch from "./LanguageSwitch";

interface SettingsPageProps {
  onBack: () => void;
  onOpenCommunity: () => void;
  onOpenAuth?: () => void;
  themeMode: "system" | "light" | "dark";
  onSetThemeMode: (mode: "system" | "light" | "dark") => void;
  onEditProfile: () => void;
  onResetAllData: () => void;
}

function Row({ icon, label, sub, onClick, right }: { icon: React.ReactNode; label: string; sub?: string; onClick?: () => void; right?: React.ReactNode }) {
  return (
    <button
      onClick={() => onClick?.()}
      disabled={!onClick}
      className="flex w-full items-center gap-3 border-b border-line px-4 py-3.5 text-left last:border-0 disabled:cursor-default hover:bg-graphite transition-colors"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-graphite text-ink-2">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ink">{label}</p>
        {sub && <p className="mt-0.5 text-xs text-ink-3 leading-snug">{sub}</p>}
      </div>
      {right !== undefined ? right : (onClick && <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" />)}
    </button>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 ${on ? "bg-volt" : "bg-zinc-600/70"}`}>
      <span className={`h-5 w-5 rounded-full shadow-xs transition-transform duration-200 ${on ? "translate-x-5 bg-void" : "translate-x-0 bg-white"}`} />
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="mb-2 px-1 text-[11px] font-black uppercase tracking-wider text-ink-3">{title}</p>
      <div className="overflow-hidden rounded-2xl border border-line bg-carbon shadow-sm">{children}</div>
    </div>
  );
}

export default function SettingsPage({ onBack, onOpenCommunity, onOpenAuth, themeMode, onSetThemeMode, onEditProfile, onResetAllData }: SettingsPageProps) {
  const t = useT();
  const [lang] = useLang();
  const { user } = useAuthUser();
  // The tap that opens a modal can also land on the freshly-mounted backdrop
  // (ghost click on touch screens) and close it instantly; ignore that.
  const modalOpenedAt = useRef(0);
  const [profile, setProfile] = useState<UserProfileDoc | null>(null);
  const [muted, setMuted] = useState(() => localStorage.getItem("kinetic_sound_muted") === "true");
  const [lofiOn, setLofiOn] = useState(() => localStorage.getItem("kinetic_lofi_enabled") !== "false");
  const [hapticsOn, setHapticsOn] = useState(() => isHapticsEnabled());
  const [resetBusy, setResetBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);
  const [showMod, setShowMod] = useState(false);
  const [isMod, setIsMod] = useState(false);
  useEffect(() => {
    if (!user) { setIsMod(false); return; }
    callFn<{ admin: boolean }>("modIsAdmin").then(r => setIsMod(!!r.admin)).catch(() => setIsMod(false));
  }, [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [socialPrefs, setSocialPrefs] = useState<SocialNotifPrefs>(() => loadSocialPrefs());
  const setSocial = async (patch: Partial<SocialNotifPrefs>) => {
    const next = { ...socialPrefs, ...patch };
    setSocialPrefs(next);
    saveSocialPrefs(next);
    if (Object.values(patch).some(v => v === "sound" || v === "silent" || v === true)) void requestPerm();
  };
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(() => loadNotificationPrefs());
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState<File | null>(null);
  const backupFileRef = useRef<HTMLInputElement | null>(null);

  const logs: WorkoutLog[] = (() => {
    try {
      const raw = JSON.parse(localStorage.getItem("kinetic_logs") || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch { return []; }
  })();
  const workedOutToday = trainedToday(logs);

  /**
   * The reminder lands at the hour this person actually trains, not the
   * fixed 18:00 everybody used to get. `shouldNudgeToday` refuses hours
   * nobody wants a notification at, and the scheduler falls back to the
   * hand-set time when it returns nothing.
   */
  const smartNudge = (() => {
    const n = planNudge(computeAnalytics(logs));
    return shouldNudgeToday(n, workedOutToday) ? n : undefined;
  })();

  const updateNotifPrefs = async (patch: Partial<NotificationPrefs>) => {
    const next = { ...notifPrefs, ...patch };
    // Turning any reminder on for the first time needs the OS permission
    // prompt — ask right here so the toggle's effect is immediate.
    const turningOn = Object.entries(patch).some(([k, v]) => k.endsWith("Enabled") && v === true);
    if (turningOn) {
      const granted = await requestNotificationPermission();
      if (!granted) {
        setToast(t("set.notifsDenied"));
        return;
      }
    }
    setNotifPrefs(next);
    saveNotificationPrefs(next);
    applyDailyReminder(next, smartNudge);
    applyStreakWarning(next, workedOutToday);
    applyWaterReminder(next);
  };

  useEffect(() => {
    if (user) getUserProfile(user.uid).then(setProfile);
    else setProfile(null);
  }, [user]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    localStorage.setItem("kinetic_sound_muted", String(next));
    audio.setMute(next);
  };

  const toggleLofi = () => {
    const next = !lofiOn;
    setLofiOn(next);
    localStorage.setItem("kinetic_lofi_enabled", String(next));
    if (!next) lofiMusic.pause(true);
    else lofiMusic.play("soothing");
  };

  const toggleHaptics = () => {
    const next = !hapticsOn;
    setHapticsOn(next);
    setHapticsEnabled(next);
    if (next) tapFeedback(); // immediate confirmation buzz when turning it back on
  };

  const myIdentity = useMyIdentity();
  const acctPublic = myIdentity.profile?.accountPublic === true;
  const setPrivacy = async (next: boolean) => {
    if (!user || next === acctPublic) return;
    try {
      await setAccountPublic(user.uid, next);
      await saveUserProfile(user.uid, { public: next });
      if (profile) setProfile({ ...profile, public: next });
      setToast(next ? t("set.privacyToastPublic") : t("set.privacyToastPrivate"));
    } catch {
      setToast(t("set.privacyToastFail"));
    }
  };

  const sendReset = async () => {
    if (!user?.email) return;
    setResetBusy(true);
    try {
      await resetPassword(user.email);
      setResetSent(true);
    } finally { setResetBusy(false); }
  };

  const shareApp = async () => {
    const result = await shareContent({
      title: "Apex Pulse",
      text: t("set.shareText"),
    });
    if (result === "copied") setToast(t("set.shareCopied"));
  };

  const handleExportBackup = async () => {
    const shared = await shareBackup();
    if (!shared) downloadBackup();
  };

  const handlePickBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) setRestoreConfirm(file);
  };

  const handleConfirmRestore = async () => {
    if (!restoreConfirm) return;
    setRestoreBusy(true);
    try {
      const result = await importBackupFile(restoreConfirm);
      if (result.ok) {
        setToast(`Restored ${result.restoredKeys ?? 0} saved items — reloading...`);
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setToast(result.error || "Could not restore that backup.");
      }
    } finally {
      setRestoreBusy(false);
      setRestoreConfirm(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in pb-28 text-ink">
      <div className="mb-5 flex items-center gap-4">
        <button
          onClick={onBack}
          className="group flex h-10 w-10 items-center justify-center rounded-full border border-line bg-graphite text-ink-2 shadow-xs transition-all hover:border-line hover:bg-graphite"
          title={t("common.back")}
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        </button>
        <div>
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-cyan-400">APEX PULSE</span>
          <h1 className="font-sans text-2xl font-black uppercase tracking-tight text-ink">{t("set.title")}</h1>
        </div>
      </div>

      <div>
        <Section title={t("set.account")}>
          {user ? (
            <>
              <Row icon={<UserCircle2 className="h-4 w-4" />} label={profile?.displayName || t("set.yourProfile")} sub={user.email || undefined} onClick={onOpenCommunity} />
              <Row
                icon={<Lock className="h-4 w-4" />}
                label={resetBusy ? t("set.resetSending") : resetSent ? t("set.resetSent") : t("set.resetPw")}
                sub={t("set.resetSub")}
                onClick={resetBusy || resetSent ? undefined : sendReset}
                right={resetBusy ? <Loader2 className="h-4 w-4 animate-spin text-ink-3" /> : resetSent ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : undefined}
              />
              <div className="border-b border-line px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-graphite text-ink-2">
                    {acctPublic ? <Globe className="h-4 w-4" /> : <LockIcon className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-ink">{t("set.privacy")}</p>
                    <p className="mt-0.5 text-xs text-ink-2 leading-snug">
                      {acctPublic ? t("set.privacyPublic") : t("set.privacyPrivate")}
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-1.5 rounded-xl bg-graphite p-1">
                  {([[true, t("set.public")], [false, t("set.private")]] as const).map(([val, label]) => (
                    <button
                      key={label}
                      onClick={() => void setPrivacy(val)}
                      className={`min-h-[42px] rounded-lg text-sm font-bold transition ${acctPublic === val ? "bg-volt text-void" : "text-ink-2"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <Row icon={<LogOut className="h-4 w-4" />} label={t("set.logout")} onClick={() => logOut()} />
            </>
          ) : (
            <Row
              icon={<UserCircle2 className="h-4 w-4 text-cyan-600" />}
              label={t("set.login")}
              sub={t("set.loginSub")}
              onClick={onOpenAuth || onOpenCommunity}
            />
          )}
        </Section>

        <Section title={t("set.app")}>
          <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">{t("lang.title")}</p>
              <p className="mt-0.5 text-xs text-ink-3">{t("lang.sub")}</p>
            </div>
            <LanguageSwitch />
          </div>
          <Row icon={<Dumbbell className="h-4 w-4" />} label={t("set.fitnessProfile")} sub={t("set.fitnessProfileSub")} onClick={onEditProfile} />
          <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-graphite text-ink-2">
              {themeMode === "dark" ? <Moon className="h-4 w-4" /> : <SunMedium className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">{t("set.appearance")}</p>
              <p className="mt-0.5 text-xs text-ink-3">{t("set.appearanceSub")}</p>
            </div>
            <div role="radiogroup" aria-label={t("set.appearance")} className="flex shrink-0 rounded-xl bg-graphite p-0.5">
              {(["system", "light", "dark"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={themeMode === m}
                  onClick={() => { tapFeedback(); onSetThemeMode(m); }}
                  className={`min-h-[32px] rounded-[10px] px-2.5 text-[11px] font-bold capitalize transition-colors ${themeMode === m ? "bg-carbon text-ink shadow-sm" : "text-ink-3"}`}
                >
                  {t(`set.theme.${m}` as "set.theme.system")}
                </button>
              ))}
            </div>
          </div>
          <Row icon={<Share2 className="h-4 w-4" />} label={t("set.share")} sub={t("set.shareSub")} onClick={shareApp} />
          <Row icon={<Vibrate className="h-4 w-4" />} label={t("set.haptic")} sub={t("set.hapticSub")} onClick={toggleHaptics} right={<Toggle on={hapticsOn} />} />
        </Section>

        <Section title={t("set.soundMusic")}>
          <Row icon={muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />} label={t("set.coachVoice")} onClick={toggleMute} right={<Toggle on={!muted} />} />
          <Row icon={lofiOn ? <Music className="h-4 w-4" /> : <MusicOff className="h-4 w-4" />} label={t("set.lofi")} sub={t("set.lofiSub")} onClick={toggleLofi} right={<Toggle on={lofiOn} />} />
        </Section>

        <Section title={t("set.notifs")}>
          <Row
            icon={socialPrefs.all ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            label={t("set.notifs")}
            sub={t("set.notifsSub")}
            onClick={() => setShowNotifSettings(true)}
          />
        </Section>

        {user && (
          <Section title={t("set.safety")}>
            <Row icon={<Ban className="h-4 w-4" />} label={t("set.blocked")} sub={t("set.blockedSub")} onClick={() => setShowBlocked(true)} />
            {isMod && <Row icon={<ShieldAlert className="h-4 w-4 text-amber-400" />} label={t("set.mod")} sub={t("set.modSub")} onClick={() => setShowMod(true)} />}
          </Section>
        )}

        <Section title={t("set.legal")}>
          <Row
            icon={<ShieldCheck className="h-4 w-4 text-volt" />}
            label={t("set.privacyPolicy")}
            sub={t("set.privacyPolicySub")}
            onClick={() => { modalOpenedAt.current = Date.now(); setShowPrivacy(true); }}
          />
          <Row
            icon={<FileText className="h-4 w-4 text-ink-3" />}
            label={t("set.terms")}
            sub={t("set.termsSub")}
            onClick={() => { modalOpenedAt.current = Date.now(); setShowTerms(true); }}
          />
          <Row
            icon={<ShieldCheck className="h-4 w-4 text-ink-3" />}
            label={t("set.policy")}
            sub={t("set.policySub")}
            onClick={() => setShowPolicy(true)}
          />
        {lang === "hi" && <p className="px-4 py-2 text-[11px] text-ink-3">{t("set.legalEnglishNote")}</p>}
        </Section>

        <Section title={t("set.data")}>
          <Row icon={<Download className="h-4 w-4" />} label={t("set.backup")} sub={t("set.backupSub")} onClick={handleExportBackup} />
          <Row icon={<Upload className="h-4 w-4" />} label={t("set.restore")} sub={t("set.restoreSub")} onClick={() => backupFileRef.current?.click()} />
          <input ref={backupFileRef} type="file" accept="application/json" onChange={handlePickBackupFile} className="hidden" />
          {!confirmClear ? (
            <Row icon={<Trash2 className="h-4 w-4 text-amber-400" />} label={t("set.resetAll")} sub={t("set.resetAllSub")} onClick={() => setConfirmClear(true)} />
          ) : (
            <div className="px-4 py-3.5 border-t border-line">
              <p className="mb-3 text-xs font-bold text-ink-2">{t("set.resetConfirm")}</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmClear(false)} className="flex-1 rounded-xl bg-graphite py-2.5 text-xs font-black text-ink-2 hover:bg-graphite cursor-pointer">{t("common.cancel")}</button>
                <button onClick={() => { onResetAllData(); setConfirmClear(false); setToast(t("set.resetDone")); }} className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-500 py-2.5 text-xs font-black text-white cursor-pointer">{t("set.resetYes")}</button>
              </div>
            </div>
          )}

          {user && (
            <Row
              icon={<Trash2 className="h-4 w-4 text-rose-500" />}
              label={t("set.deleteAccount")}
              sub={t("set.deleteAccountSub")}
              onClick={() => setConfirmDeleteAccount(true)}
            />
          )}
        </Section>
      </div>

      {showBlocked && <BlockedUsersScreen onClose={() => setShowBlocked(false)} />}
      {showMod && <ModerationScreen onClose={() => setShowMod(false)} />}
      {confirmDeleteAccount && (
        <DeleteAccountDialog
          onClose={() => setConfirmDeleteAccount(false)}
          onDeleted={() => {
            void logOut().catch(() => {});
            onResetAllData();
            setConfirmDeleteAccount(false);
            setToast(t("set.deletedToast"));
            onBack();
          }}
        />
      )}

      {restoreConfirm && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-5 backdrop-blur-sm" onClick={() => !restoreBusy && setRestoreConfirm(null)}>
          <div className="w-full max-w-xs rounded-3xl bg-carbon border border-line p-6 text-center shadow-2xl" onClick={e => e.stopPropagation()}>
            <Upload className="mx-auto h-8 w-8 text-cyan-400" />
            <h3 className="mt-3 text-sm font-black text-ink">Restore this backup?</h3>
            <p className="mt-2 text-xs text-ink-3">This will overwrite your current workouts, logs and progress on this device with what's inside <span className="font-bold text-ink">{restoreConfirm.name}</span>.</p>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setRestoreConfirm(null)} disabled={restoreBusy} className="flex-1 rounded-xl bg-graphite py-2.5 text-xs font-black text-ink-2 hover:bg-graphite disabled:opacity-50">Cancel</button>
              <button onClick={handleConfirmRestore} disabled={restoreBusy} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-cyan-500 py-2.5 text-xs font-black text-slate-950 hover:bg-cyan-400 disabled:opacity-50">
                {restoreBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {showNotifSettings && (
        <NotificationSettings
          onClose={() => setShowNotifSettings(false)}
          socialPrefs={socialPrefs}
          setSocial={setSocial}
          notifPrefs={notifPrefs}
          updateNotifPrefs={updateNotifPrefs}
        />
      )}
      {showPolicy && <ContentPolicySheet onClose={() => setShowPolicy(false)} />}
      {showPrivacy && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => { if (Date.now() - modalOpenedAt.current > 450) setShowPrivacy(false); }}>
          <div className="w-full max-w-md rounded-2xl bg-carbon border border-line p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-volt" />
                <h3 className="text-base font-bold text-ink">Privacy Policy</h3>
              </div>
              <button onClick={() => setShowPrivacy(false)} className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-ink-3 hover:text-ink cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs text-ink-2 leading-relaxed">
              <p className="font-semibold text-ink">Apex Pulse ("Home Fitness Coach") Commitment:</p>
              <p>1. <strong className="text-ink">On-Device Processing:</strong> Exercise pose scanning and camera tracking run entirely in on-device memory. Camera feeds are never uploaded, recorded, or transmitted to any remote servers.</p>
              <p>2. <strong className="text-ink">Data Storage & Sync:</strong> Your workout history, streak milestones, and custom routines are stored locally on your device. When signed in, optional encrypted cloud sync is provided via Firebase to back up your progress across devices.</p>
              <p>3. <strong className="text-ink">Zero Third-Party Tracking:</strong> We do not sell your biometric or personal data to data brokers, advertisers, or third-party networks.</p>
              <p>4. <strong className="text-ink">Account & Data Deletion:</strong> You have full control over your data. You may delete your account and all associated cloud records at any time directly from Settings ("Delete Account & Cloud Data") or clear local logs with "Reset all training data".</p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowPrivacy(false)}
                className="w-full min-h-[48px] rounded-xl bg-volt text-void font-bold text-xs uppercase tracking-wider cursor-pointer active:scale-98"
              >
                Understood & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Terms of Service Modal */}
      {showTerms && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onClick={() => { if (Date.now() - modalOpenedAt.current > 450) setShowTerms(false); }}>
          <div className="w-full max-w-md rounded-2xl bg-carbon border border-line p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-ink-3" />
                <h3 className="text-base font-bold text-ink">Terms of Service</h3>
              </div>
              <button onClick={() => setShowTerms(false)} className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-ink-3 hover:text-ink cursor-pointer">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs text-ink-2 leading-relaxed">
              <p>1. <strong className="text-ink">Medical & Fitness Advisory:</strong> Apex Pulse provides exercise demonstrations and biometric pacing cues for general fitness guidance. Always consult a healthcare professional before initiating high-intensity physical training.</p>
              <p>2. <strong className="text-ink">Athlete Conduct:</strong> In Community Duels and public challenges, users must maintain sportsmanship and integrity.</p>
              <p>3. <strong className="text-ink">Subscriptions & Purchases:</strong> Pro features are billed through standard Google Play billing protocols and may be managed or cancelled at any time through Google Play Subscriptions.</p>
            </div>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowTerms(false)}
                className="w-full min-h-[48px] rounded-xl bg-graphite border border-line text-ink font-bold text-xs uppercase tracking-wider cursor-pointer active:scale-98"
              >
                Close Terms
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-carbon border border-line px-5 py-2.5 text-xs font-bold text-ink shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
