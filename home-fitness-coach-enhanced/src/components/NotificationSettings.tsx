import { useState } from "react";
import { ArrowLeft, Bell, BellOff, ChevronRight, Droplets, Flame, Heart, MessageCircle, MessageSquare, UserPlus, Film, Users, AlarmClock } from "lucide-react";
import OverlayPortal from "./ui/OverlayPortal";
import type { SocialNotifPrefs, NotifMode, NotifCategory } from "../lib/notifyPrefs";
import type { NotificationPrefs } from "../lib/notifications";

type View = "home" | "messages" | "activity" | "reminders";

interface Props {
  onClose: () => void;
  socialPrefs: SocialNotifPrefs;
  setSocial: (patch: Partial<SocialNotifPrefs>) => void;
  notifPrefs: NotificationPrefs;
  updateNotifPrefs: (patch: Partial<NotificationPrefs>) => void;
}

const MODE_LABEL: Record<NotifMode, string> = { sound: "Sound", silent: "Muted", off: "Off" };

function Toggle({ on }: { on: boolean }) {
  return (
    <span className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${on ? "bg-volt" : "bg-zinc-600/70"}`}>
      <span className={`h-5 w-5 rounded-full transition-transform ${on ? "translate-x-5 bg-void" : "translate-x-0 bg-white"}`} />
    </span>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-2xl border border-line bg-carbon">{children}</div>;
}

function NavRow({ icon, title, sub, onClick }: { icon: React.ReactNode; title: string; sub: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 border-b border-line px-4 py-3.5 text-left last:border-0 active:bg-graphite">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-graphite text-ink-2">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-ink">{title}</span>
        <span className="mt-0.5 block text-xs text-ink-2">{sub}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-ink-3" />
    </button>
  );
}

function ToggleRow({ icon, title, sub, on, onClick }: { icon: React.ReactNode; title: string; sub: string; on: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 border-b border-line px-4 py-3.5 text-left last:border-0">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-graphite text-ink-2">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-ink">{title}</span>
        <span className="mt-0.5 block text-xs text-ink-2">{sub}</span>
      </span>
      <Toggle on={on} />
    </button>
  );
}

function ModeRow({ icon, title, sub, value, onChange }: { icon: React.ReactNode; title: string; sub: string; value: NotifMode; onChange: (m: NotifMode) => void }) {
  return (
    <div className="border-b border-line px-4 py-3.5 last:border-0">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-graphite text-ink-2">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-ink">{title}</span>
          <span className="mt-0.5 block text-xs text-ink-2">{sub}</span>
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {(["sound", "silent", "off"] as NotifMode[]).map(m => (
          <button
            key={m}
            onClick={() => onChange(m)}
            className={`min-h-[40px] rounded-lg text-xs font-bold transition ${value === m ? "bg-volt text-void" : "border border-line bg-graphite text-ink-2"}`}
          >
            {m === "silent" ? "Mute" : MODE_LABEL[m]}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function NotificationSettings({ onClose, socialPrefs, setSocial, notifPrefs, updateNotifPrefs }: Props) {
  const [view, setView] = useState<View>("home");
  const pad2 = (n: number) => String(n).padStart(2, "0");

  const summary = (cats: NotifCategory[]) => {
    if (!socialPrefs.all) return "Off";
    const on = cats.filter(c => socialPrefs[c] !== "off").length;
    return on === 0 ? "All off" : `${on} of ${cats.length} on`;
  };
  const reminderCount = [notifPrefs.dailyReminderEnabled, notifPrefs.streakWarningEnabled, notifPrefs.waterReminderEnabled].filter(Boolean).length;

  const titles: Record<View, string> = { home: "Notifications", messages: "Messages", activity: "Activity", reminders: "Reminders" };
  const back = () => (view === "home" ? onClose() : setView("home"));
  const mode = (key: NotifCategory) => (m: NotifMode) => setSocial({ [key]: m } as Partial<SocialNotifPrefs>);

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-[300] flex flex-col bg-void text-ink animate-fade-in">
        <div
          className="flex shrink-0 items-center gap-2 border-b border-line bg-carbon px-2 pb-2"
          style={{ paddingTop: "max(var(--safe-t), env(safe-area-inset-top, 24px))" }}
        >
          <button onClick={back} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full text-ink-2 active:scale-95">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h2 className="text-base font-bold">{titles[view]}</h2>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {view === "home" && (
            <>
              <Card>
                <ToggleRow
                  icon={socialPrefs.all ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                  title="Allow notifications"
                  sub={socialPrefs.all ? "On. Choose what you hear about below." : "Off. Social alerts are paused."}
                  on={socialPrefs.all}
                  onClick={() => setSocial({ all: !socialPrefs.all })}
                />
              </Card>
              <Card>
                <NavRow icon={<MessageSquare className="h-4 w-4" />} title="Messages" sub={`Chats, groups · ${summary(["chats", "groups"])}`} onClick={() => setView("messages")} />
                <NavRow icon={<Heart className="h-4 w-4" />} title="Activity" sub={`Follows, likes, comments, new reels · ${summary(["follows", "likes", "comments", "newReels"])}`} onClick={() => setView("activity")} />
                <NavRow icon={<AlarmClock className="h-4 w-4" />} title="Reminders" sub={`Workout, streak, water · ${reminderCount} on`} onClick={() => setView("reminders")} />
              </Card>
              <p className="px-1 text-[11px] text-ink-3">Alerts arrive while the app is open or running in the background.</p>
            </>
          )}

          {view === "messages" && (
            <>
              <Card>
                <ModeRow icon={<MessageCircle className="h-4 w-4" />} title="Chat messages" sub="Direct messages from people you follow" value={socialPrefs.chats} onChange={mode("chats")} />
                <ModeRow icon={<Users className="h-4 w-4" />} title="Group chats" sub="Groups are coming soon" value={socialPrefs.groups} onChange={mode("groups")} />
              </Card>
              <p className="px-1 text-[11px] text-ink-3">Sound = banner with sound. Mute = shows quietly, no sound. Off = nothing.</p>
            </>
          )}

          {view === "activity" && (
            <>
              <Card>
                <ModeRow icon={<UserPlus className="h-4 w-4" />} title="Follows & requests" sub="New followers and follow requests" value={socialPrefs.follows} onChange={mode("follows")} />
                <ModeRow icon={<Film className="h-4 w-4" />} title="New reels" sub="When someone you follow posts a reel" value={socialPrefs.newReels} onChange={mode("newReels")} />
                <ModeRow icon={<Heart className="h-4 w-4" />} title="Likes" sub="When someone likes your posts or reels" value={socialPrefs.likes} onChange={mode("likes")} />
                <ModeRow icon={<MessageCircle className="h-4 w-4" />} title="Comments" sub="When someone comments on your posts or reels" value={socialPrefs.comments} onChange={mode("comments")} />
              </Card>
              <p className="px-1 text-[11px] text-ink-3">Sound = banner with sound. Mute = shows quietly, no sound. Off = nothing.</p>
            </>
          )}

          {view === "reminders" && (
            <Card>
              <ToggleRow
                icon={<AlarmClock className="h-4 w-4" />}
                title="Daily workout reminder"
                sub={notifPrefs.dailyReminderEnabled ? `Every day at ${pad2(notifPrefs.dailyReminderHour)}:${pad2(notifPrefs.dailyReminderMinute)}` : "Off"}
                on={notifPrefs.dailyReminderEnabled}
                onClick={() => updateNotifPrefs({ dailyReminderEnabled: !notifPrefs.dailyReminderEnabled })}
              />
              {notifPrefs.dailyReminderEnabled && (
                <div className="border-b border-line px-4 py-3">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-ink-2">Reminder time</label>
                  <input
                    type="time"
                    value={`${pad2(notifPrefs.dailyReminderHour)}:${pad2(notifPrefs.dailyReminderMinute)}`}
                    onChange={e => {
                      const [h, m] = e.target.value.split(":").map(Number);
                      updateNotifPrefs({ dailyReminderHour: h, dailyReminderMinute: m });
                    }}
                    className="mt-1.5 w-full rounded-xl border border-line bg-graphite px-3 py-2 text-sm font-bold text-ink"
                  />
                </div>
              )}
              <ToggleRow
                icon={<Flame className="h-4 w-4" />}
                title="Streak-break warning"
                sub="A nudge at 9 PM if you haven't trained yet today"
                on={notifPrefs.streakWarningEnabled}
                onClick={() => updateNotifPrefs({ streakWarningEnabled: !notifPrefs.streakWarningEnabled })}
              />
              <ToggleRow
                icon={<Droplets className="h-4 w-4" />}
                title="Water reminder"
                sub="Regular nudges to drink a glass of water"
                on={notifPrefs.waterReminderEnabled}
                onClick={() => updateNotifPrefs({ waterReminderEnabled: !notifPrefs.waterReminderEnabled })}
              />
            </Card>
          )}
        </div>
      </div>
    </OverlayPortal>
  );
}
