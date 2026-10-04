import React, { useEffect, useState, useRef } from "react";
import {
  ArrowLeft, UserCircle2, Lock, Globe, Lock as LockIcon, Share2, Moon,
  SunMedium, Volume2, VolumeX, Music, Music2 as MusicOff, Dumbbell, Trash2,
  LogOut, ChevronRight, Loader2, CheckCircle2, Bell, BellOff, Flame, Droplets,
  Download, Upload, Vibrate,
} from "lucide-react";
import { useAuthUser, logOut, getUserProfile, saveUserProfile, resetPassword, UserProfileDoc } from "../lib/useAuth";
import { audio } from "../lib/audio";
import { lofi } from "../lib/lofi";
import {
  loadNotificationPrefs, saveNotificationPrefs, requestNotificationPermission,
  applyDailyReminder, applyStreakWarning, applyWaterReminder, NotificationPrefs,
} from "../lib/notifications";
import { downloadBackup, shareBackup, importBackupFile } from "../lib/backup";
import { isHapticsEnabled, setHapticsEnabled, tapFeedback } from "../lib/haptics";
import { WorkoutLog } from "../types";
import { computeAnalytics, trainedToday } from "../lib/analytics";
import { planNudge, shouldNudgeToday } from "../lib/smartNudge";

interface SettingsPageProps {
  onBack: () => void;
  onOpenCommunity: () => void;
  onOpenAuth?: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  onEditProfile: () => void;
  onResetAllData: () => void;
}

function Row({ icon, label, sub, onClick, right }: { icon: React.ReactNode; label: string; sub?: string; onClick?: () => void; right?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3.5 text-left last:border-0 disabled:cursor-default"
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-800">{label}</p>
        {sub && <p className="mt-0.5 truncate text-xs text-slate-400">{sub}</p>}
      </div>
      {right !== undefined ? right : (onClick && <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />)}
    </button>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${on ? "bg-slate-900" : "bg-slate-200"}`}>
      <span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : "translate-x-0"}`} />
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-wider text-slate-400">{title}</p>
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white">{children}</div>
    </div>
  );
}

export default function SettingsPage({ onBack, onOpenCommunity, onOpenAuth, theme, onToggleTheme, onEditProfile, onResetAllData }: SettingsPageProps) {
  const { user } = useAuthUser();
  const [profile, setProfile] = useState<UserProfileDoc | null>(null);
  const [muted, setMuted] = useState(() => localStorage.getItem("kinetic_sound_muted") === "true");
  const [lofiOn, setLofiOn] = useState(() => localStorage.getItem("kinetic_lofi_enabled") !== "false");
  const [hapticsOn, setHapticsOn] = useState(() => isHapticsEnabled());
  const [resetBusy, setResetBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
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
        setToast("Enable notifications for this app in your phone settings to use reminders.");
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
    if (!next) lofi.stop();
    else lofi.play("chill"); // matches the "home screen = chill lofi" identity used everywhere else
  };

  const toggleHaptics = () => {
    const next = !hapticsOn;
    setHapticsOn(next);
    setHapticsEnabled(next);
    if (next) tapFeedback(); // immediate confirmation buzz when turning it back on
  };

  const togglePrivacy = async () => {
    if (!user || !profile) return;
    const next = !profile.public;
    await saveUserProfile(user.uid, { public: next });
    setProfile({ ...profile, public: next });
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
    const shareData = { title: "Home Fitness Coach", text: "I'm training with this home fitness app — check it out!", url: "https://home-fitness-coach.app" };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        setToast("Link copied — paste it anywhere to share!");
      }
    } catch { /* user cancelled the share sheet — not an error */ }
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
    <div className="max-w-3xl mx-auto animate-fade-in pb-24 text-slate-800">
      <div className="mb-5 flex items-center gap-4">
        <button
          onClick={onBack}
          className="group flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-xs transition-all hover:border-slate-300 hover:bg-slate-50"
          title="Back"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        </button>
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-500">APEX PULSE</span>
          <h1 className="font-sans text-2xl font-black uppercase tracking-tight text-slate-900">Settings</h1>
        </div>
      </div>

      <div>
        <Section title="Account">
          {user ? (
            <>
              <Row icon={<UserCircle2 className="h-4 w-4" />} label={profile?.displayName || "Your profile"} sub={user.email || undefined} onClick={onOpenCommunity} />
              <Row
                icon={<Lock className="h-4 w-4" />}
                label={resetBusy ? "Sending reset link..." : resetSent ? "Reset link sent" : "Reset password"}
                sub="We'll email you a link"
                onClick={resetBusy || resetSent ? undefined : sendReset}
                right={resetBusy ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : resetSent ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : undefined}
              />
              <Row
                icon={profile?.public ? <Globe className="h-4 w-4" /> : <LockIcon className="h-4 w-4" />}
                label="Public profile"
                sub={profile?.public ? "Visible to everyone in Community" : "Hidden from the Community feed"}
                onClick={togglePrivacy}
                right={<Toggle on={!!profile?.public} />}
              />
              <Row icon={<LogOut className="h-4 w-4" />} label="Log out" onClick={() => logOut()} />
            </>
          ) : (
            <Row
              icon={<UserCircle2 className="h-4 w-4 text-cyan-600" />}
              label="Log In or Sign Up"
              sub="1-Tap Google (Gmail) or Email & Password sync"
              onClick={onOpenAuth || onOpenCommunity}
            />
          )}
        </Section>

        <Section title="App">
          <Row icon={<Dumbbell className="h-4 w-4" />} label="Fitness profile" sub="Goal, level, equipment" onClick={onEditProfile} />
          <Row icon={theme === "dark" ? <Moon className="h-4 w-4" /> : <SunMedium className="h-4 w-4" />} label="Dark mode" onClick={onToggleTheme} right={<Toggle on={theme === "dark"} />} />
          <Row icon={<Share2 className="h-4 w-4" />} label="Share this app" sub="Tell a friend" onClick={shareApp} />
          <Row icon={<Vibrate className="h-4 w-4" />} label="Haptic feedback" sub="Vibration on taps, likes and milestones" onClick={toggleHaptics} right={<Toggle on={hapticsOn} />} />
        </Section>

        <Section title="Sound & Music">
          <Row icon={muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />} label="Coach voice & chimes" onClick={toggleMute} right={<Toggle on={!muted} />} />
          <Row icon={lofiOn ? <Music className="h-4 w-4" /> : <MusicOff className="h-4 w-4" />} label="Lo-fi ambience" sub="Soothing background music" onClick={toggleLofi} right={<Toggle on={lofiOn} />} />
        </Section>

        <Section title="Reminders">
          <Row
            icon={notifPrefs.dailyReminderEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            label="Daily workout reminder"
            sub={notifPrefs.dailyReminderEnabled ? `Every day at ${String(notifPrefs.dailyReminderHour).padStart(2, "0")}:${String(notifPrefs.dailyReminderMinute).padStart(2, "0")}` : "Off"}
            onClick={() => updateNotifPrefs({ dailyReminderEnabled: !notifPrefs.dailyReminderEnabled })}
            right={<Toggle on={notifPrefs.dailyReminderEnabled} />}
          />
          {notifPrefs.dailyReminderEnabled && (
            <div className="border-b border-slate-100 px-4 py-3">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Reminder time</label>
              <input
                type="time"
                value={`${String(notifPrefs.dailyReminderHour).padStart(2, "0")}:${String(notifPrefs.dailyReminderMinute).padStart(2, "0")}`}
                onChange={e => {
                  const [h, m] = e.target.value.split(":").map(Number);
                  updateNotifPrefs({ dailyReminderHour: h, dailyReminderMinute: m });
                }}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800"
              />
            </div>
          )}
          <Row
            icon={<Flame className="h-4 w-4" />}
            label="Streak-break warning"
            sub="A nudge at 9 PM if you haven't trained yet today"
            onClick={() => updateNotifPrefs({ streakWarningEnabled: !notifPrefs.streakWarningEnabled })}
            right={<Toggle on={notifPrefs.streakWarningEnabled} />}
          />
          <Row
            icon={<Droplets className="h-4 w-4" />}
            label="Water reminder"
            sub="Hourly nudges to log a glass of water"
            onClick={() => updateNotifPrefs({ waterReminderEnabled: !notifPrefs.waterReminderEnabled })}
            right={<Toggle on={notifPrefs.waterReminderEnabled} />}
          />
        </Section>

        <Section title="Data">
          <Row icon={<Download className="h-4 w-4" />} label="Backup my data" sub="Save everything to a file — keep it somewhere safe" onClick={handleExportBackup} />
          <Row icon={<Upload className="h-4 w-4" />} label="Restore from backup" sub="Bring back data from a saved backup file" onClick={() => backupFileRef.current?.click()} />
          <input ref={backupFileRef} type="file" accept="application/json" onChange={handlePickBackupFile} className="hidden" />
          {!confirmClear ? (
            <Row icon={<Trash2 className="h-4 w-4 text-red-400" />} label="Reset all training data" sub="Workouts, logs and progress" onClick={() => setConfirmClear(true)} />
          ) : (
            <div className="px-4 py-3.5">
              <p className="mb-3 text-xs font-bold text-slate-600">This permanently erases your saved workouts, logs and progress on this device. Are you sure?</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmClear(false)} className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-black text-slate-600">Cancel</button>
                <button onClick={() => { onResetAllData(); setConfirmClear(false); setToast("All training data reset."); }} className="flex-1 rounded-xl bg-red-500 py-2.5 text-xs font-black text-white">Yes, reset</button>
              </div>
            </div>
          )}
        </Section>
      </div>

      {restoreConfirm && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-5" onClick={() => !restoreBusy && setRestoreConfirm(null)}>
          <div className="w-full max-w-xs rounded-3xl bg-white p-6 text-center" onClick={e => e.stopPropagation()}>
            <Upload className="mx-auto h-8 w-8 text-blue-600" />
            <h3 className="mt-3 text-sm font-black text-slate-900">Restore this backup?</h3>
            <p className="mt-2 text-xs text-slate-500">This will overwrite your current workouts, logs and progress on this device with what's inside <span className="font-bold">{restoreConfirm.name}</span>.</p>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setRestoreConfirm(null)} disabled={restoreBusy} className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-black text-slate-600 disabled:opacity-50">Cancel</button>
              <button onClick={handleConfirmRestore} disabled={restoreBusy} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2.5 text-xs font-black text-white disabled:opacity-50">
                {restoreBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Restore
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
