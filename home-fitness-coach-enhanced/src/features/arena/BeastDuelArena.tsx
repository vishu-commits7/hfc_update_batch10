import OneTimeHint from "../../shared/OneTimeHint";
import LeagueView from "./LeagueView";
import FriendsView from "./FriendsView";
import CrewView from "./CrewView";
import { QuickMatchCard, LiveRoomsCard, SpectateScreen } from "./ArenaExtras";
import { callFn } from "../../core/functions";
import { motionFor, usePoseCounter, cameraCountingPlan, rememberCamChoice, allowCameraAnyway } from "./poseCounter";
import { useBackClose } from "../../core/backStack";
import { ErrorState, EmptyState, EmptyAction, SkeletonRows } from "../../shared/ui/StateViews";
import { track, trackOnce } from "../../core/track";
import { EV } from "../../core/analyticsEvents";
import DuelVideo from "./DuelVideo";
import { useDuelVideo } from "./useDuelVideo";
import { repsAt } from "./ghost";
import DailyChallenge from "./DailyChallenge";
import { joinLink } from "../../core/shareLink";
import { onJoinLink, peekPendingJoin } from "../../core/deepLink";
import ReportSheet from "../safety/ReportSheet";
import { DEMO } from "../../core/demo";
import FlexCardSheet from "../progress/FlexCardSheet";
import { arenaCard } from "../progress/flexCard";
import { useEffect, useMemo, useRef, useState, memo } from "react";
import {
  ArrowLeft, Swords, Share2, Copy, Check, Trophy, Loader2, Plus, Minus, Globe, Lock, Users, LogIn, Hand, X, ChevronRight, Flame, Dumbbell, Crown, RotateCcw, Zap, Camera, Flag,
} from "lucide-react";
import { shareContent } from "../../core/nativeBridge";
import Avatar from "../../shared/ui/Avatar";
import {
  createRoom, joinRoom, leaveRoom, startRoomMatch, reportReps, finishSide, forceFinishRoom, subscribeRoom,
  subscribeOpenRooms, recordArenaResult, friendlySocialError,
  type ArenaRoom,
} from "../social/social";
import { useMyIdentity } from "../social/useSocial";
import { BODY_PARTS, POPULAR, exerciseById, type ArenaExercise, type PlanItem } from "./arenaCatalog";
import { subscribeLeaderboard, rankFor, useProgress, type LeaderRow } from "../progress/progress";
import { audio } from "../../core/audio";
import { useT, type TKey } from "../../i18n";
import { tapFeedback, celebrateFeedback } from "../../core/haptics";

export interface ExerciseDiscipline {
  id: string;
  name: string;
  defaultReps: number;
  defaultTime: number;
}

export const EXERCISE_DISCIPLINES: ExerciseDiscipline[] = [
  { id: "pushups", name: "Classic Push-ups", defaultReps: 30, defaultTime: 45 },
  { id: "squats", name: "Bodyweight Squats", defaultReps: 40, defaultTime: 45 },
  { id: "jumpsquats", name: "Jump Squats", defaultReps: 30, defaultTime: 45 },
  { id: "diamond", name: "Diamond Push-ups", defaultReps: 20, defaultTime: 45 },
  { id: "situps", name: "Sit-ups", defaultReps: 35, defaultTime: 45 },
  { id: "climbers", name: "Mountain Climbers", defaultReps: 50, defaultTime: 30 },
];

interface Props {
  onBack: () => void;
  onLogWorkout?: (log: any) => void;
  /** open straight into this room (used by chat challenges) */
  initialRoomCode?: string | null;
  onSignIn?: () => void;
}

function BeastDuelArenaInner({ onBack, onLogWorkout, initialRoomCode, onSignIn }: Props) {
  const me = useMyIdentity();
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const tr = useT();
  // an invite link opens straight on the right tab (crew code -> Crew, friend code -> Friends)
  const [tab, setTab] = useState<"play" | "league" | "friends" | "crew" | "ladder">(() => {
    const p = peekPendingJoin();
    return p?.kind === "crew" ? "crew" : p?.kind === "invite" ? "friends" : "play";
  });
  useEffect(() => onJoinLink(t => { if (t.kind === "crew") setTab("crew"); else if (t.kind === "invite") setTab("friends"); }), []);
  const [watchCode, setWatchCode] = useState<string | null>(null);
  const [ladderBy, setLadderBy] = useState<"xp" | "rating">("xp");
  const prog = useProgress(me.uid);
  useBackClose(!!watchCode, () => setWatchCode(null));

  type Kind = "single" | "part" | "full";
  const [stage, setStage] = useState<"type" | "pick" | "parts" | "config">("type");
  const [kind, setKind] = useState<Kind>("single");
  const [plan, setPlan] = useState<PlanItem[]>([]);
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<"time" | "reps">("reps");
  const [duration, setDuration] = useState(45);
  const [pickPart, setPickPart] = useState(BODY_PARTS[0].id);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinText, setJoinText] = useState("");
  const [open, setOpen] = useState<ArenaRoom[] | null>(null);
  const [openFailed, setOpenFailed] = useState(false);
  const [openTry, setOpenTry] = useState(0);
  const [ladder, setLadder] = useState<LeaderRow[] | null>(null);
  const [ladderFailed, setLadderFailed] = useState(false);
  const [ladderTry, setLadderTry] = useState(0);
  useBackClose(stage !== "type" && !roomCode, () => setStage(s => (s === "config" ? (kind === "single" ? "pick" : kind === "part" ? "parts" : "type") : "type")));

  const player = useMemo(
    () => (me.uid ? { uid: me.uid, name: me.name, avatarUrl: me.avatar } : null),
    [me.uid, me.name, me.avatar],
  );

  // arriving from a chat challenge: join (or re-enter as host) that room
  useEffect(() => {
    if (!initialRoomCode || !player) return;
    let alive = true;
    setBusy(true);
    joinRoom(initialRoomCode, player)
      .then(c => { if (alive) setRoomCode(c); })
      .catch(e => { if (alive) setError(friendlySocialError(e)); })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRoomCode, player?.uid]);

  useEffect(() => {
    if (!me.uid || roomCode) return;
    setOpenFailed(false);
    return subscribeOpenRooms(me.uid, r => { setOpenFailed(false); setOpen(r); }, () => { setOpen([]); setOpenFailed(true); });
  }, [me.uid, roomCode, openTry]);

  useEffect(() => {
    if (tab !== "ladder" || !me.uid) return;
    return subscribeLeaderboard(rows => { setLadderFailed(false); setLadder(rows); }, () => { setLadder([]); setLadderFailed(true); }, ladderBy);
  }, [tab, me.uid, ladderTry, ladderBy]);

  const toItem = (e: ArenaExercise): PlanItem => ({ id: e.id, name: e.name, reps: e.defaultReps });
  const startSingle = (e: ArenaExercise) => { void tapFeedback(); setKind("single"); setTitle(e.name); setPlan([toItem(e)]); setStage("config"); };
  const startPart = (id: string) => {
    const b = BODY_PARTS.find(x => x.id === id)!;
    void tapFeedback(); setKind("part"); setTitle(`${b.name} challenge`); setPlan(b.exercises.slice(0, 4).map(toItem)); setStage("config");
  };
  const startFull = () => {
    void tapFeedback(); setKind("full"); setTitle("Full body challenge");
    setPlan(["pushups", "superman", "squats", "situps", "burpees"].map(i => toItem(exerciseById(i)!))); setStage("config");
  };
  const setReps = (id: string, d: number) => setPlan(pl => pl.map(i => i.id === id ? { ...i, reps: Math.max(5, Math.min(200, i.reps + d)) } : i));
  const dropItem = (id: string) => setPlan(pl => pl.length > 1 ? pl.filter(i => i.id !== id) : pl);
  const addItem = (e: ArenaExercise) => setPlan(pl => pl.some(i => i.id === e.id) ? pl : [...pl, toItem(e)]);
  const totalReps = plan.reduce((a, i) => a + i.reps, 0);

  const create = async () => {
    if (!player || busy) return;
    setBusy(true); setError(null);
    try {
      void tapFeedback();
      const multi = plan.length > 1;
      const useTime = !multi && mode === "time";
      const total = plan.reduce((a, i) => a + i.reps, 0);
      const code = await createRoom(player, {
        exercise: title || plan[0]?.name || "Challenge",
        plan,
        mode: useTime ? "time" : "reps",
        target: useTime ? duration : total,
        visibility,
      });
      setRoomCode(code);
      setStage("type");
    } catch (e) { setError(friendlySocialError(e)); } finally { setBusy(false); }
  };

  const join = async (code: string) => {
    if (!player || busy) return;
    setBusy(true); setError(null);
    try {
      void tapFeedback();
      setRoomCode(await joinRoom(code, player));
    } catch (e) { setError(friendlySocialError(e)); } finally { setBusy(false); }
  };

  if (watchCode) return <SpectateScreen code={watchCode} onExit={() => setWatchCode(null)} />;

  if (roomCode && player) {
    return (
      <RoomScreen
        key={roomCode}
        code={roomCode}
        onSwitch={c => { setRoomCode(c); setError(null); }}
        player={player}
        onExit={() => { setRoomCode(null); setError(null); }}
        onLogWorkout={onLogWorkout}
      />
    );
  }


  return (
    <div className="mx-auto w-full max-w-md space-y-4 pb-28 text-ink animate-fade-in">
      <div className="flex items-center justify-between">
        <button onClick={onBack} aria-label={tr("common.back")} className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-carbon text-ink-2 active:scale-95">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-bold">{tr("arena.title")}</h1>
        <div className="flex h-11 min-w-11 items-center justify-center gap-1 rounded-full border border-line bg-carbon px-3 text-xs font-bold">
          <Trophy className="h-3.5 w-3.5 text-volt" /> {me.profile?.arenaWins || 0}
          <span className="mx-0.5 h-3 w-px bg-line" /><Zap className="h-3.5 w-3.5 text-volt" /> {prog.rating}
        </div>
      </div>

      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
        {(["play", "league", "friends", "crew", "ladder"] as const).map(t => (
          <button
            key={t}
            onClick={() => { void tapFeedback(); setTab(t); }}
            className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-bold transition ${tab === t ? "bg-volt text-void" : "border border-line bg-carbon text-ink-2"}`}
          >
            {tr(`arena.tab.${t === "ladder" ? "global" : t}` as TKey)}
          </button>
        ))}
      </div>

      {!me.signedIn ? (
        <div className="rounded-2xl border border-line bg-carbon p-6 text-center">
          <Users className="mx-auto h-8 w-8 text-ink-3" />
          <p className="mt-3 text-sm font-semibold">Sign in to play real opponents</p>
          <p className="mx-auto mt-1 max-w-[16rem] text-xs text-ink-3">Matches are live 1v1 rooms with other athletes, so you need an account.</p>
          <button onClick={onSignIn} className="mt-4 inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-volt px-5 text-sm font-bold text-void active:scale-95">
            <LogIn className="h-4 w-4" /> Sign in
          </button>
        </div>
      ) : tab === "league" ? (
        <LeagueView meUid={me.uid!} onPlayArena={() => setTab("play")} />
      ) : tab === "friends" ? (
        <FriendsView meUid={me.uid!} />
      ) : tab === "crew" ? (
        <CrewView meUid={me.uid!} meName={me.name} />
      ) : tab === "ladder" ? (
        <>
        <DailyChallenge meUid={me.uid!} />
        <div className="mb-3 grid grid-cols-2 gap-1.5">
          {([["xp", "Most XP"], ["rating", "Arena rating"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => { void tapFeedback(); setLadder(null); setLadderBy(k); }} className={`rounded-xl py-2 text-xs font-semibold ${ladderBy === k ? "bg-graphite text-volt ring-1 ring-volt/40" : "border border-line bg-carbon text-ink-2"}`}>{l}</button>
          ))}
        </div>
        <LadderView by={ladderBy} rows={ladder} meUid={me.uid} failed={ladderFailed} onPlay={() => setTab("play")} onRetry={() => { setLadder(null); setLadderFailed(false); setLadderTry(n => n + 1); }} />
        </>
      ) : (
        <>
          {stage === "type" && <OneTimeHint id="quickmatch">Quick match pairs you with someone who picked the same exercise. Matches move your rating (RP).</OneTimeHint>}
          {stage === "type" && <QuickMatchCard meUid={me.uid!} onMatched={c => { setRoomCode(c); }} />}
          {stage === "type" && <LiveRoomsCard onWatch={setWatchCode} />}
          <section id="arena-create" className="rounded-2xl border border-line bg-carbon p-4">
            {stage === "type" && (
              <>
                <h2 className="text-sm font-bold">Start a challenge</h2>
                <p className="mb-1.5 mt-3 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-3"><Flame className="h-3.5 w-3.5 text-volt" /> Popular</p>
                <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
                  {POPULAR.map(e => (
                    <button key={e.id} onClick={() => startSingle(e)} className="shrink-0 rounded-full border border-line bg-graphite px-3 py-2 text-xs font-semibold text-ink active:scale-95">{e.name}</button>
                  ))}
                </div>
                <p className="mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Choose challenge type</p>
                <div className="space-y-2">
                  {([
                    ["single", "Single exercise", "One move. Most reps or first to a target.", Dumbbell, () => { setKind("single"); setStage("pick"); }],
                    ["part", "Body part challenge", "Chest, back, legs, core and more, several exercises.", Swords, () => setStage("parts")],
                    ["full", "Full body challenge", "A mix across your whole body. First to finish wins.", Crown, startFull],
                  ] as const).map(([k, t, d, Icon, fn]) => (
                    <button key={k} onClick={() => { void tapFeedback(); fn(); }} className="flex w-full items-center gap-3 rounded-xl border border-line bg-graphite p-3 text-left active:scale-[0.99]">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-carbon"><Icon className="h-5 w-5 text-volt" /></span>
                      <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{t}</span><span className="block text-xs text-ink-3">{d}</span></span>
                      <ChevronRight className="h-4 w-4 text-ink-3" />
                    </button>
                  ))}
                </div>
              </>
            )}

            {stage === "pick" && (
              <>
                <StageHeader title="Pick an exercise" onBack={() => setStage("type")} />
                <p className="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Popular</p>
                <div className="flex flex-wrap gap-1.5">
                  {POPULAR.map(e => <button key={e.id} onClick={() => startSingle(e)} className="rounded-full bg-volt/15 px-3 py-2 text-xs font-semibold text-volt active:scale-95">{e.name}</button>)}
                </div>
                <div className="-mx-1 mt-4 flex gap-1.5 overflow-x-auto px-1 pb-1">
                  {BODY_PARTS.map(b => (
                    <button key={b.id} onClick={() => { void tapFeedback(); setPickPart(b.id); }} className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold ${pickPart === b.id ? "bg-volt text-void" : "border border-line bg-graphite text-ink-2"}`}>{b.emoji} {b.name}</button>
                  ))}
                </div>
                <ul className="mt-2 space-y-1.5">
                  {BODY_PARTS.find(b => b.id === pickPart)!.exercises.map(e => (
                    <li key={e.id}><button onClick={() => startSingle(e)} className="flex w-full items-center justify-between rounded-xl border border-line bg-graphite px-3 py-3 text-left text-sm font-semibold active:scale-[0.99]">{e.name}<ChevronRight className="h-4 w-4 text-ink-3" /></button></li>
                  ))}
                </ul>
              </>
            )}

            {stage === "parts" && (
              <>
                <StageHeader title="Pick a body part" onBack={() => setStage("type")} />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {BODY_PARTS.filter(b => b.id !== "full").map(b => (
                    <button key={b.id} onClick={() => startPart(b.id)} className="rounded-xl border border-line bg-graphite p-3 text-left active:scale-[0.98]">
                      <span className="text-2xl">{b.emoji}</span>
                      <span className="mt-1 block text-sm font-bold">{b.name}</span>
                      <span className="block text-[11px] text-ink-3">{b.exercises.length} exercises</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {stage === "config" && (
              <>
                <StageHeader title={title} onBack={() => setStage(kind === "single" ? "pick" : kind === "part" ? "parts" : "type")} />
                <p className="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-3">{plan.length > 1 ? "Reps for each exercise" : "Reps"}</p>
                <ul className="space-y-1.5">
                  {plan.map((it, idx) => (
                    <li key={it.id} className={`flex items-center gap-2 rounded-xl border border-line bg-graphite px-3 py-2 ${plan.length === 1 && mode === "time" ? "opacity-50" : ""}`}>
                      {plan.length > 1 && <span className="w-4 text-center text-[11px] font-bold text-ink-3">{idx + 1}</span>}
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold">{it.name}</span>
                      <button onClick={() => setReps(it.id, -5)} aria-label="Fewer reps" className="flex h-8 w-8 items-center justify-center rounded-full bg-carbon active:scale-90"><Minus className="h-3.5 w-3.5" /></button>
                      <span className="w-8 text-center text-sm font-bold tabular-nums">{it.reps}</span>
                      <button onClick={() => setReps(it.id, 5)} aria-label="More reps" className="flex h-8 w-8 items-center justify-center rounded-full bg-carbon active:scale-90"><Plus className="h-3.5 w-3.5" /></button>
                      {plan.length > 1 && <button onClick={() => dropItem(it.id)} aria-label={`Remove ${it.name}`} className="flex h-8 w-8 items-center justify-center rounded-full text-ink-3 active:scale-90"><X className="h-3.5 w-3.5" /></button>}
                    </li>
                  ))}
                </ul>
                {kind !== "single" && (
                  <details className="mt-2 rounded-xl border border-line bg-graphite px-3 py-2">
                    <summary className="cursor-pointer text-xs font-semibold text-ink-2">Add an exercise</summary>
                    <div className="mt-2 flex flex-wrap gap-1.5 pb-1">
                      {BODY_PARTS.flatMap(b => b.exercises).filter(e => !plan.some(i => i.id === e.id)).map(e => (
                        <button key={e.id} onClick={() => addItem(e)} className="rounded-full border border-line bg-carbon px-2.5 py-1.5 text-[11px] font-semibold text-ink-2 active:scale-95">+ {e.name}</button>
                      ))}
                    </div>
                  </details>
                )}

                {plan.length === 1 ? (
                  <>
                    <p className="mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Format</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {([["reps", "First to target"], ["time", "Most reps in time"]] as const).map(([m, label]) => (
                        <button key={m} onClick={() => { void tapFeedback(); setMode(m); }} className={`rounded-xl py-2.5 text-xs font-semibold transition ${mode === m ? "bg-volt text-void" : "border border-line bg-graphite text-ink-2"}`}>{label}</button>
                      ))}
                    </div>
                    {mode === "time" && (
                      <div className="mt-3 flex items-center justify-between rounded-xl border border-line bg-graphite px-3 py-2">
                        <span className="text-xs font-semibold text-ink-2">Duration</span>
                        <div className="flex items-center gap-3">
                          <button onClick={() => setDuration(t => Math.max(15, t - 15))} aria-label="Shorter" className="flex h-9 w-9 items-center justify-center rounded-full bg-carbon active:scale-90"><Minus className="h-4 w-4" /></button>
                          <span className="w-14 text-center text-lg font-bold tabular-nums">{duration}s</span>
                          <button onClick={() => setDuration(t => Math.min(120, t + 15))} aria-label="Longer" className="flex h-9 w-9 items-center justify-center rounded-full bg-carbon active:scale-90"><Plus className="h-4 w-4" /></button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="mt-3 rounded-xl bg-graphite px-3 py-2 text-xs text-ink-2">{plan.length} exercises · {totalReps} reps total. First to finish all of them wins.</p>
                )}

                <button
                  onClick={() => setVisibility(v => (v === "public" ? "private" : "public"))}
                  className="mt-3 flex w-full items-center justify-between rounded-xl border border-line bg-graphite px-3 py-2.5 text-xs font-semibold text-ink-2"
                >
                  <span className="flex items-center gap-2">
                    {visibility === "public" ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                    {visibility === "public" ? "Public: anyone can join from the lobby" : "Private: join with the room code only"}
                  </span>
                  <span className="text-ink-3">Change</span>
                </button>

                <button onClick={create} disabled={busy} className="mt-4 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-volt text-sm font-bold text-void active:scale-[0.98] disabled:opacity-60">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />} Create room
                </button>
              </>
            )}
          </section>

          <section className="rounded-2xl border border-line bg-carbon p-4">
            <h2 className="text-sm font-bold">Join with a code</h2>
            <div className="mt-3 flex gap-2">
              <input
                value={joinText}
                onChange={e => setJoinText(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                placeholder="ROOM CODE"
                autoCapitalize="characters"
                autoComplete="off"
                className="min-w-0 flex-1 rounded-xl border border-line-strong bg-graphite px-3 py-3 text-center text-base font-bold tracking-[0.3em] text-ink placeholder:font-medium placeholder:tracking-normal placeholder:text-ink-3 outline-none focus:border-volt"
              />
              <button onClick={() => join(joinText)} disabled={busy || joinText.length < 4} className="rounded-xl bg-graphite px-5 text-sm font-bold text-ink active:scale-95 disabled:opacity-40">Join</button>
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-carbon p-4">
            <h2 className="text-sm font-bold">Open matches</h2>
            {openFailed ? (
              <div className="mt-2"><ErrorState message="Couldn't load open matches." onRetry={() => { setOpen(null); setOpenTry(n => n + 1); }} /></div>
            ) : open === null ? (
              <div className="mt-2"><SkeletonRows rows={2} /></div>
            ) : open.length === 0 ? (
              <div className="mt-2"><EmptyState icon={<Swords className="h-6 w-6" />} title="Nobody is waiting right now" body="Start a match and share the code with a friend." action={<EmptyAction label="Create a room" onClick={() => document.getElementById("arena-create")?.scrollIntoView({ behavior: "smooth", block: "center" })} />} /></div>
            ) : (
              <ul className="mt-2 space-y-1">
                {open.map(r => (
                  <li key={r.code} className="flex items-center gap-3 py-2">
                    <Avatar src={r.hostAvatar} name={r.hostName} size={42} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{r.hostName}</span>
                      <span className="block truncate text-xs text-ink-3">{r.exercise} · {r.mode === "time" ? `${r.target}s` : r.plan && r.plan.length > 1 ? `${r.plan.length} exercises` : `first to ${r.target}`}</span>
                    </span>
                    <button onClick={() => join(r.code)} disabled={busy} className="rounded-full border border-volt/60 bg-volt/10 px-4 py-2 text-xs font-bold text-volt active:scale-95 disabled:opacity-50">Join</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {error && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-center text-xs text-rose-300">{error}</p>}
    </div>
  );
}

function StageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={onBack} aria-label="Back" className="flex h-9 w-9 items-center justify-center rounded-full bg-graphite text-ink-2 active:scale-90"><ArrowLeft className="h-4 w-4" /></button>
      <h2 className="min-w-0 flex-1 truncate text-sm font-bold">{title}</h2>
    </div>
  );
}

const MEDAL = ["#F5C451", "#C0C6D0", "#D08B5B"];

function LadderView({ rows, meUid, failed, onRetry, onPlay, by = "xp" }: { rows: LeaderRow[] | null; meUid: string | null; failed?: boolean; onRetry?: () => void; onPlay?: () => void; by?: "xp" | "rating" }) {
  const val = (r: LeaderRow) => (by === "rating" ? r.rating : r.xp);
  const unit = by === "rating" ? "RP" : "XP";
  if (failed) return <ErrorState message="Couldn't load the leaderboard." onRetry={onRetry} />;
  if (rows === null) return <SkeletonRows rows={6} />;
  if (rows.length === 0) return (
    <EmptyState icon={<Trophy className="h-6 w-6" />} title="No one is ranked yet" body="Finish a workout or play an Arena match to take rank #1." action={onPlay ? <EmptyAction label="Play a match" onClick={onPlay} /> : undefined} />
  );
  const top = rows.slice(0, 3);
  const order = top.length === 3 ? [1, 0, 2] : top.map((_, i) => i);
  const myIdx = rows.findIndex(r => r.uid === meUid);
  return (
    <div className="space-y-3">
      <div className="flex items-end justify-center gap-2 rounded-2xl border border-line bg-carbon px-3 pb-4 pt-6">
        {order.map(i => {
          const r = top[i];
          const h = i === 0 ? "h-24" : i === 1 ? "h-16" : "h-12";
          return (
            <div key={r.uid} className="flex w-1/3 flex-col items-center text-center">
              {i === 0 && <Crown className="mb-1 h-5 w-5" style={{ color: MEDAL[0] }} />}
              <Avatar src={r.avatarUrl} name={r.name} size={i === 0 ? 60 : 48} />
              <p className="mt-1 w-full truncate text-xs font-bold">{r.uid === meUid ? "You" : r.name}</p>
              <p className="text-[11px] text-ink-3">Lv {r.level} · {val(r).toLocaleString()} {unit}</p>
              <div className={`mt-2 flex w-full items-start justify-center rounded-t-xl ${h}`} style={{ background: `${MEDAL[i]}30`, borderTop: `3px solid ${MEDAL[i]}` }}>
                <span className="mt-1 text-lg font-black" style={{ color: MEDAL[i] }}>{i + 1}</span>
              </div>
            </div>
          );
        })}
      </div>
      {myIdx >= 0 && <p className="text-center text-xs font-semibold text-ink-2">You are #{myIdx + 1} of {rows.length}</p>}
      <ul className="rounded-2xl border border-line bg-carbon p-2">
        {rows.map((r, i) => {
          const rk = rankFor(r.xp).rank;
          return (
            <li key={r.uid} className={`flex items-center gap-3 rounded-xl px-2 py-2.5 ${r.uid === meUid ? "bg-volt/10" : ""}`}>
              <span className={`w-6 text-center text-sm font-bold tabular-nums ${i < 3 ? "" : "text-ink-3"}`} style={i < 3 ? { color: MEDAL[i] } : undefined}>{i + 1}</span>
              <Avatar src={r.avatarUrl} name={r.name} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{r.uid === meUid ? `${r.name} (you)` : r.name}</span>
                <span className="block truncate text-xs" style={{ color: rk.color }}>{rk.name} · Lv {r.level}{r.streakDays > 1 ? ` · ${r.streakDays}d streak` : ""}</span>
              </span>
              <span className="text-right">
                <span className="block text-sm font-bold tabular-nums">{val(r).toLocaleString()} <span className="text-[11px] font-medium text-ink-3">{unit}</span></span>
                <span className="block text-[11px] text-ink-3">{r.arenaWins} arena wins</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* room                                                                */
/* ------------------------------------------------------------------ */

const pendingLeaves = new Map<string, number>();

function RoomScreen({
  code, player, onExit, onLogWorkout, onSwitch,
}: {
  code: string;
  onSwitch: (code: string) => void;
  player: { uid: string; name: string; avatarUrl: string | null };
  onExit: () => void;
  onLogWorkout?: (log: any) => void;
}) {
  const [room, setRoom] = useState<ArenaRoom | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [rematchBusy, setRematchBusy] = useState(false);
  const [shareWin, setShareWin] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMsg, setReportMsg] = useState<string | null>(null);
  const [camPlan] = useState(cameraCountingPlan);
  const [camCount, setCamCount] = useState(camPlan.start);
  const [camBlocked, setCamBlocked] = useState<"device" | "slow" | null>(camPlan.blocked);

  const [phase, setPhase] = useState<"idle" | "countdown" | "battle" | "done">("idle");
  const [count, setCount] = useState(3);
  const [timeLeft, setTimeLeft] = useState(0);
  const [myReps, setMyReps] = useState(0);
  const myRepsRef = useRef(0);
  const finishedRef = useRef(false);
  const recordedRef = useRef(false);
  const exitedRef = useRef(false);
  const lastSentRef = useRef(0);
  const sendTimer = useRef<number | null>(null);

  useEffect(() => {
    return subscribeRoom(code, setRoom, e => { setError(friendlySocialError(e)); setRoom(null); });
  }, [code]);

  // leave the room if the player navigates away without finishing
  useEffect(() => {
    // A remount of the same room (React StrictMode in dev, or a quick re-render)
    // must NOT count as leaving, otherwise the host cancels their own room.
    const pending = pendingLeaves.get(code);
    if (pending) { clearTimeout(pending); pendingLeaves.delete(code); }
    return () => {
      if (!exitedRef.current) {
        const uid = player.uid;
        pendingLeaves.set(code, window.setTimeout(() => { pendingLeaves.delete(code); void leaveRoom(code, uid); }, 1500));
      }
      if (sendTimer.current) clearTimeout(sendTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // ghost duel: the opponent's reps come from a recorded timeline, read against the server's start time
  const [ghostReps, setGhostReps] = useState(0);
  useEffect(() => { setGhostReps(0); }, [code]);
  useEffect(() => {
    if (!room?.ghost || !room.startedAt || room.status !== "live") return;
    const started = room.startedAt, tl = room.ghostTl, cap = room.mode === "reps" ? room.target : Infinity;
    const tick = () => setGhostReps(Math.min(cap, repsAt(tl, Date.now() - started)));
    tick();
    const id = window.setInterval(tick, 200);
    return () => clearInterval(id);
  }, [room?.ghost, room?.status, room?.startedAt, room?.ghostTl.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const role: "host" | "guest" | null = room ? (room.hostUid === player.uid ? "host" : room.guestUid === player.uid ? "guest" : null) : null;
  const opp = room && role ? (role === "host"
    ? room.ghost
      ? { name: `${room.guestName || "Ghost"} · ghost`, avatar: null, reps: room.status === "finished" ? room.guestReps : ghostReps, done: room.status === "finished", present: true }
      : { name: room.guestName, avatar: room.guestAvatar, reps: room.guestReps, done: room.guestDone, present: !!room.guestUid }
    : { name: room.hostName, avatar: room.hostAvatar, reps: room.hostReps, done: room.hostDone, present: true }) : null;

  // live video between the two players
  const [videoOn, setVideoOn] = useState(true);
  const duel = useDuelVideo(code, role, !!room?.guestUid, !DEMO && videoOn && !!role && room !== undefined && room !== null && room.status !== "finished" && room.status !== "cancelled");

  // room went live -> local countdown then battle
  useEffect(() => {
    if (!room || phase !== "idle" || room.status !== "live") return;
    myRepsRef.current = 0; setMyReps(0); finishedRef.current = false;
    setPhase("countdown"); setCount(3);
  }, [room?.status, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (phase !== "countdown") return;
    if (count <= 0) { setPhase("battle"); setTimeLeft(room?.target || 45); void celebrateFeedback(); return; }
    audio.playBeastClick();
    const t = setTimeout(() => setCount(c => c - 1), 900);
    return () => clearTimeout(t);
  }, [phase, count]); // eslint-disable-line react-hooks/exhaustive-deps

  const finishMe = (reps: number) => {
    if (finishedRef.current || !role) return;
    finishedRef.current = true;
    setPhase("done");
    void finishSide(code, role, reps).catch(() => {});
  };

  // time mode countdown
  useEffect(() => {
    if (phase !== "battle" || room?.mode !== "time") return;
    if (timeLeft <= 0) { finishMe(myRepsRef.current); return; }
    const t = setTimeout(() => setTimeLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timeLeft]); // eslint-disable-line react-hooks/exhaustive-deps

  // reps mode: opponent reached target first -> stop
  useEffect(() => {
    if (phase !== "battle" || !room || room.mode !== "reps" || !opp) return;
    if (opp.reps >= room.target) finishMe(myRepsRef.current);
  }, [opp?.reps, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // opponent dropped: close out after a grace period
  useEffect(() => {
    if (phase !== "done" || !room || room.status === "finished") return;
    const t = setTimeout(() => { void forceFinishRoom(code); }, 9000);
    return () => clearTimeout(t);
  }, [phase, room?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // opponent closed the match while I was still playing: stop and show the result
  useEffect(() => {
    if (room?.status === "finished" && (phase === "battle" || phase === "countdown")) finishMe(myRepsRef.current);
  }, [room?.status, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // record the result once
  useEffect(() => {
    if (room?.status !== "finished" || recordedRef.current || !role) return;
    recordedRef.current = true;
    trackOnce(EV.firstArenaMatch);
    track(EV.arenaMatchPlayed, { exercises: room.plan?.length || 1, mode: room.mode, quick: !!room.quick });
    const mine = role === "host" ? room.hostReps : room.guestReps;
    const theirs = role === "host" ? room.guestReps : room.hostReps;
    void recordArenaResult(player.uid, mine > theirs);
    if (mine > theirs) void celebrateFeedback();
    setPhase("done");
  }, [room?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // quick-match rooms: the host's device starts the match as soon as both players are in
  useEffect(() => {
    if (!room?.quick || role !== "host" || room.status !== "ready" || (!room.guestUid && !room.ghost)) return;
    const t = setTimeout(() => { void startRoomMatch(code).catch(e => setError(friendlySocialError(e))); }, 2500);
    return () => clearTimeout(t);
  }, [room?.quick, room?.status, room?.guestUid, room?.ghost, role]); // eslint-disable-line react-hooks/exhaustive-deps

  const goRematch = async (existing?: string | null) => {
    if (rematchBusy) return;
    setRematchBusy(true); setError(null);
    try {
      void tapFeedback();
      let target = existing || null;
      let host = false;
      if (!target) { const r = await callFn<{ code: string; host: boolean }>("arenaRematch", { code }); target = r.code; host = r.host; }
      if (!host) await joinRoom(target, player);
      track(EV.arenaRematch);
      exitedRef.current = true;
      onSwitch(target);
    } catch (e) { setError(friendlySocialError(e)); } finally { setRematchBusy(false); }
  };

  const addRep = () => {
    if (phase !== "battle" || !role || !room) return;
    const next = myRepsRef.current + 1;
    myRepsRef.current = next;
    setMyReps(next);
    audio.playBeastClick();
    void tapFeedback();
    // throttle network writes to ~2.5/second (each one is a server call plus a read for both players)
    const now = Date.now();
    const push = () => { lastSentRef.current = Date.now(); void reportReps(code, role, myRepsRef.current).catch(() => {}); };
    if (now - lastSentRef.current > REPORT_EVERY_MS) push();
    else if (!sendTimer.current) sendTimer.current = window.setTimeout(() => { sendTimer.current = null; push(); }, REPORT_EVERY_MS);
    if (room.mode === "reps" && next >= room.target) finishMe(next);
  };

  // which exercise is the player on right now (multi-exercise plans advance by reps)
  const curName = (() => {
    if (!room) return "";
    const pl = room.plan;
    if (pl && pl.length > 1) { let left = myReps, i = 0; for (; i < pl.length - 1 && left >= pl[i].reps; i++) left -= pl[i].reps; return pl[i].name; }
    return pl?.[0]?.name || room.exercise;
  })();
  const motion = motionFor(curName);
  const addRepRef = useRef(addRep);
  addRepRef.current = addRep;
  const camStatus = usePoseCounter(duel.local, camCount && phase === "battle", motion, () => addRepRef.current());
  // while the camera is counting, taps are ignored (unless the camera failed)
  const tap = () => { if (camCount && camStatus !== "error" && camStatus !== "slow") return; addRep(); };
  // too slow on this phone: switch to taps for good (remembered), with a short message on the button
  useEffect(() => { if (camStatus === "slow") { setCamCount(false); setCamBlocked("slow"); } }, [camStatus]);

  const exit = () => { exitedRef.current = true; void leaveRoom(code, player.uid); onExit(); };
  useBackClose(phase !== "battle" && phase !== "countdown", exit); // Back leaves the lobby/result, never a live match by accident

  const finishAndLog = () => {
    if (room && onLogWorkout) {
      const mine = role === "host" ? room.hostReps : room.guestReps;
      onLogWorkout({
        id: `arena-${Date.now()}`,
        workoutId: `arena-${code}`,
        workoutTitle: `Arena 1v1: ${room.exercise}`,
        completedAt: new Date().toISOString(),
        durationMinutes: Math.max(1, Math.round((room.mode === "time" ? room.target : 60) / 60)),
        exercisesCompleted: room.plan?.length || 1,
        feeling: "Energetic",
        estimatedCaloriesBurned: Math.round(mine * 0.5),
        targetArea: "Full Body",
      });
    }
    exitedRef.current = true;
    onExit();
  };

  const copyCode = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  const invite = () => {
    void tapFeedback();
    void shareContent({ title: "Apex Arena challenge", text: `Join my Apex Arena match (${room?.exercise ?? "1v1"}). Tap the link, or open Arena and enter the code ${code}.`, url: joinLink("room", code) });
  };

  if (room === undefined) {
    return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-ink-3" /></div>;
  }
  if (room === null || room.status === "cancelled" || !role) {
    return (
      <div className="mx-auto max-w-md py-20 text-center text-ink">
        <p className="text-sm font-semibold">{room === null ? "Room not available" : room.status === "cancelled" ? "The host left this room." : "You are not part of this room."}</p>
        {error && <p className="mt-2 text-xs text-rose-300">{error}</p>}
        <button onClick={exit} className="mt-5 rounded-xl bg-volt px-6 py-3 text-sm font-bold text-void">Back to Arena</button>
      </div>
    );
  }

  const mineFinal = role === "host" ? room.hostReps : room.guestReps;
  const theirFinal = role === "host" ? room.guestReps : room.hostReps;

  /* ----- result ----- */
  if (room.status === "finished" && phase !== "countdown" && phase !== "battle") {
    const won = mineFinal > theirFinal;
    const draw = mineFinal === theirFinal;
    return (
      <div className="mx-auto w-full max-w-md space-y-4 pb-28 pt-6 text-center text-ink animate-fade-in">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-3">{room.exercise}</p>
        <h1 className={`text-3xl font-bold ${won ? "text-volt" : ""}`}>{draw ? "Draw" : won ? "You win" : "You lost"}</h1>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <ScoreCard label="You" name={player.name} avatar={player.avatarUrl} reps={mineFinal} highlight={won} />
          <ScoreCard label="Opponent" name={opp?.name || "Athlete"} avatar={opp?.avatar || null} reps={theirFinal} highlight={!won && !draw} />
        </div>
        {room.ratingDelta && room.ratingAfter && (() => {
          const d = role === "host" ? room.ratingDelta.host : room.ratingDelta.guest;
          const after = role === "host" ? room.ratingAfter.host : room.ratingAfter.guest;
          return (
            <p className="flex items-center justify-center gap-2 rounded-xl bg-graphite py-2.5 text-sm font-bold">
              <Zap className="h-4 w-4 text-volt" /> Rating {after}
              <span className={d > 0 ? "text-volt" : d < 0 ? "text-rose-300" : "text-ink-3"}>{d > 0 ? `+${d}` : d}</span>
              {room.ghostHalf && <span className="text-[11px] font-medium text-ink-3">half weight vs a ghost</span>}
            </p>
          );
        })()}
        {room.ghost && room.unrated && (
          <p className="rounded-xl bg-graphite px-3 py-2.5 text-xs font-medium text-ink-3">
            {room.ghostKind === "self" ? "Your own best run: no rating change." : room.ghostKind === "pacer" ? "Practice pacer: no rating change." : "Daily ghost limit reached: no rating change."}
          </p>
        )}
        {won && (
          <button onClick={() => { void tapFeedback(); setShareWin(true); }} className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl border border-volt bg-volt/10 text-sm font-bold text-volt active:scale-[0.98]">
            <Share2 className="h-4 w-4" /> Share this win
          </button>
        )}
        {shareWin && (
          <FlexCardSheet
            data={arenaCard({
              mine: mineFinal, theirs: theirFinal, exercise: room.exercise,
              ratingAfter: room.ratingAfter ? (role === "host" ? room.ratingAfter.host : room.ratingAfter.guest) : null,
              ratingDelta: room.ratingDelta ? (role === "host" ? room.ratingDelta.host : room.ratingDelta.guest) : null,
            })}
            shareText={`I just won ${mineFinal}\u2013${theirFinal} at ${room.exercise} in the Apex Pulse Arena.`}
            onClose={() => setShareWin(false)}
          />
        )}
        {room.rematchCode && room.rematchBy !== player.uid ? (
          <button onClick={() => void goRematch(room.rematchCode)} disabled={rematchBusy} className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl border border-volt bg-volt/10 text-sm font-bold text-volt active:scale-[0.98] disabled:opacity-60">
            {rematchBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} {opp?.name || "Opponent"} wants a rematch. Join
          </button>
        ) : room.guestUid ? (
          <button onClick={() => void goRematch()} disabled={rematchBusy} className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl border border-line bg-carbon text-sm font-bold text-ink active:scale-[0.98] disabled:opacity-60">
            {rematchBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} {room.rematchCode ? "Open rematch room" : "Rematch"}
          </button>
        ) : null}
        <button onClick={finishAndLog} className="min-h-[50px] w-full rounded-xl bg-volt text-sm font-bold text-void active:scale-[0.98]">Log workout &amp; finish</button>
        <button onClick={exit} className="min-h-[46px] w-full rounded-xl border border-line bg-carbon text-sm font-semibold text-ink-2">Back to Arena</button>
        {(() => { // report the other player (never offered against a ghost)
          const oppUid = role === "host" ? room.guestUid : room.hostUid;
          if (room.ghost || !oppUid) return null;
          return (
            <>
              {reportMsg ? <p className="text-xs text-ink-3">{reportMsg}</p> : (
                <button onClick={() => { void tapFeedback(); setReportOpen(true); }} className="flex min-h-[44px] w-full items-center justify-center gap-1.5 text-xs font-semibold text-ink-3 active:scale-[0.98]">
                  <Flag className="h-3.5 w-3.5" /> Report this match
                </button>
              )}
              {reportOpen && <ReportSheet target={{ type: "match", targetId: code, ownerUid: oppUid, ownerName: opp?.name || "this player" }} onClose={() => setReportOpen(false)} onDone={setReportMsg} />}
            </>
          );
        })()}
      </div>
    );
  }

  /* ----- countdown / battle / waiting-after-done ----- */
  if (phase === "countdown" || phase === "battle" || (phase === "done" && room.status !== "finished")) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col gap-3 pb-28 text-ink animate-fade-in">
        <div className="flex items-center justify-between text-xs font-semibold text-ink-3">
          <span>{room.exercise}</span>
          <span>{room.mode === "time" ? "Most reps wins" : `First to ${room.target}`}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <ScoreCard label="You" name={player.name} avatar={player.avatarUrl} reps={phase === "done" ? mineFinal || myReps : myReps} highlight />
          <ScoreCard label="Opponent" name={opp?.name || "Athlete"} avatar={opp?.avatar || null} reps={opp?.reps || 0} />
        </div>

        <DuelVideo local={duel.local} remote={duel.remote} state={duel.state} error={duel.error} oppName={opp?.name || "Opponent"} compact />

        {phase === "countdown" ? (
          <div className="flex h-72 items-center justify-center rounded-3xl border border-line bg-carbon">
            <span className="text-8xl font-bold tabular-nums text-volt">{count > 0 ? count : "GO"}</span>
          </div>
        ) : phase === "battle" ? (
          <>
            {room.plan && room.plan.length > 1 && (() => {
              let left = myReps, idx = 0;
              for (; idx < room.plan.length - 1 && left >= room.plan[idx].reps; idx++) left -= room.plan[idx].reps;
              const cur = room.plan[idx];
              return (
                <div className="rounded-2xl border border-line bg-carbon p-3 text-center">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-ink-3">Exercise {idx + 1} of {room.plan.length}</p>
                  <p className="mt-0.5 text-lg font-black text-volt">{cur.name}</p>
                  <p className="text-xs text-ink-2">{Math.max(0, cur.reps - left)} reps left in this move</p>
                  <div className="mt-2 flex gap-1">{room.plan.map((_, i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i < idx ? "bg-volt" : i === idx ? "bg-volt/50" : "bg-graphite"}`} />)}</div>
                </div>
              );
            })()}
            <div className="text-center">
              {room.mode === "time" ? (
                <p className="text-5xl font-bold tabular-nums">{timeLeft}<span className="text-xl text-ink-3">s</span></p>
              ) : (
                <p className="text-5xl font-bold tabular-nums">{myReps}<span className="text-xl text-ink-3"> / {room.target}</span></p>
              )}
            </div>
            {duel.local && (
              motion ? (
                <button onClick={() => { void tapFeedback(); if (camBlocked) { allowCameraAnyway(); setCamBlocked(null); setCamCount(true); return; } const next = !camCount; rememberCamChoice(next); setCamCount(next); }} className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold ${camCount ? "bg-volt/15 text-volt ring-1 ring-volt/40" : "border border-line bg-carbon text-ink-2"}`}>
                  <Camera className="h-4 w-4" />
                  {camBlocked === "slow" ? "Camera counting was too slow on this phone, so taps are on. Try again" : camBlocked === "device" ? "Taps are on for this phone. Try camera counting anyway" : !camCount ? "Count reps with camera" : camStatus === "loading" ? "Starting camera counter…" : camStatus === "error" ? "Camera counting unavailable. Tap instead." : camStatus === "lost" ? "Can't see you. Step back so your body is in frame." : "Camera is counting. Tap to switch back."}
                </button>
              ) : (
                <p className="text-center text-[11px] text-ink-3">Camera counting supports push-ups, squats, lunges and sit-ups. Tap for {curName}.</p>
              )
            )}
            <button
              onPointerDown={tap}
              className="flex h-64 w-full touch-manipulation select-none flex-col items-center justify-center gap-2 rounded-3xl bg-volt text-void active:scale-[0.98]"
              aria-label="Tap to count a rep"
            >
              <Hand className="h-10 w-10" />
              <span className="text-2xl font-bold">{camCount && camStatus !== "error" ? "CAMERA COUNTING" : "TAP EACH REP"}</span>
              <span className="text-xs font-semibold opacity-70">{room.ghost ? "Count honestly. The ghost runs its recorded pace." : "Count honestly. Your opponent sees it live."}</span>
            </button>
          </>
        ) : (
          <div className="rounded-3xl border border-line bg-carbon p-8 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-ink-3" />
            <p className="mt-3 text-sm font-semibold">Waiting for {opp?.name || "your opponent"} to finish…</p>
          </div>
        )}
      </div>
    );
  }

  /* ----- lobby (waiting / ready) ----- */
  const ready = room.status === "ready" && (!!room.guestUid || room.ghost);
  return (
    <div className="mx-auto w-full max-w-md space-y-4 pb-28 text-ink animate-fade-in">
      <div className="flex items-center justify-between">
        <button onClick={exit} aria-label="Leave room" className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-carbon text-ink-2 active:scale-95"><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="text-base font-bold">Match room</h1>
        <span className="w-11" />
      </div>

      <div className="rounded-2xl border border-line bg-carbon p-5 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-3">Room code</p>
        <p className="mt-1 text-4xl font-bold tracking-[0.25em] tabular-nums">{code}</p>
        <p className="mt-2 text-xs text-ink-3">{room.exercise} · {room.mode === "time" ? `${room.target}s, most reps` : `first to ${room.target}`}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={copyCode} className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-line bg-graphite text-xs font-bold text-ink active:scale-95">
            {copied ? <Check className="h-4 w-4 text-volt" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy code"}
          </button>
          <button onClick={invite} className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-line bg-graphite text-xs font-bold text-ink active:scale-95">
            <Share2 className="h-4 w-4" /> Invite
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <PlayerSlot name={room.hostName} avatar={room.hostAvatar} label="Host" you={role === "host"} />
        <PlayerSlot name={room.guestName} avatar={room.guestAvatar} label={room.ghost ? "Ghost" : "Challenger"} you={role === "guest"} empty={!room.guestUid && !room.ghost} />
      </div>

      <DuelVideo local={duel.local} remote={duel.remote} state={duel.state} error={duel.error} oppName={opp?.name || "Opponent"} />
      <button onClick={() => setVideoOn(v => !v)} className="w-full rounded-xl border border-line bg-carbon py-2.5 text-xs font-bold text-ink-2">
        {videoOn ? "Turn camera off" : "Turn camera on"}
      </button>

      {role === "host" ? (
        <button
          onClick={() => void startRoomMatch(code).catch(e => setError(friendlySocialError(e)))}
          disabled={!ready}
          className="min-h-[52px] w-full rounded-xl bg-volt text-sm font-bold text-void active:scale-[0.98] disabled:opacity-40"
        >
          {ready ? "Start match" : "Waiting for an opponent…"}
        </button>
      ) : (
        <p className="rounded-xl border border-line bg-carbon py-3.5 text-center text-sm font-semibold text-ink-2">Waiting for the host to start…</p>
      )}
      {error && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-center text-xs text-rose-300">{error}</p>}
    </div>
  );
}

function PlayerSlot({ name, avatar, label, you, empty }: { name: string | null; avatar: string | null; label: string; you?: boolean; empty?: boolean }) {
  return (
    <div className={`flex flex-col items-center rounded-2xl border bg-carbon p-4 ${you ? "border-volt/60" : "border-line"}`}>
      {empty ? (
        <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-line-strong text-ink-3"><Users className="h-6 w-6" /></div>
      ) : (
        <Avatar src={avatar} name={name || "A"} size={64} />
      )}
      <p className="mt-2 max-w-full truncate text-sm font-bold">{empty ? "Open slot" : name}{you ? " (you)" : ""}</p>
      <p className="text-[11px] text-ink-3">{label}</p>
    </div>
  );
}

function ScoreCard({ label, name, avatar, reps, highlight }: { label: string; name: string; avatar: string | null; reps: number; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border bg-carbon p-3 ${highlight ? "border-volt/60" : "border-line"}`}>
      <div className="flex items-center gap-2">
        <Avatar src={avatar} name={name} size={32} />
        <div className="min-w-0 text-left">
          <p className="truncate text-xs font-bold">{name}</p>
          <p className="text-[11px] text-ink-3">{label}</p>
        </div>
      </div>
      <p className="mt-2 text-4xl font-bold tabular-nums">{reps}</p>
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-3">reps</p>
    </div>
  );
}

/** How often a player's rep count is sent during a match. */
const REPORT_EVERY_MS = 400;

const BeastDuelArena = memo(BeastDuelArenaInner);
export default BeastDuelArena;
