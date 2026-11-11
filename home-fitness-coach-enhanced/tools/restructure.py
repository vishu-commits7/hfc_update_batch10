#!/usr/bin/env python3
"""
One-off: sorts src/components and src/lib into feature folders and rewrites every relative import.
  python3 tools/restructure.py check   -> only verifies that every relative import in src resolves
  python3 tools/restructure.py apply   -> moves the files (refuses if anything would not resolve)
Kept in the repo as the record of what moved where (see ARCHITECTURE.md).
"""
import os, re, sys, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "src")

def group(dest, comps=(), libs=(), ext_c=".tsx", ext_l=".ts"):
    m = {}
    for c in comps: m[f"src/components/{c}{ext_c}"] = f"src/{dest}/{c}{ext_c}"
    for l in libs:  m[f"src/lib/{l}{ext_l}"] = f"src/{dest}/{l}{ext_l}"
    return m

MAP = {}
MAP["src/App.tsx"] = "src/app/App.tsx"
# the shell: navigation, first-run flow, global overlays
MAP.update(group("app", ["HubCommandCenter", "CommandPalette", "ErrorBoundary", "CoachTour", "Onboarding", "GoalSetup", "PersonalizeFlow"]))
# platform services: no screens in here, usable by every feature
MAP.update(group("core", [], ["firebase", "functions", "callCache", "sharedQuery", "apiBase", "nativeBridge", "haptics", "audio", "backStack",
    "errorLog", "track", "analyticsEvents", "flags", "navEvents", "deepLink", "shareLink", "qr", "imageCompress", "useOnline", "demo",
    "push", "notifications", "notifyPrefs", "useAuth", "lofi", "lofiMusic", "usePingPongFrame"]))
# small building blocks shared by features
for f in (os.listdir(os.path.join(SRC, "components", "ui")) if os.path.isdir(os.path.join(SRC, "components", "ui")) else []):
    MAP[f"src/components/ui/{f}"] = f"src/shared/ui/{f}"
MAP.update(group("shared", ["ConfirmDialog", "OneTimeHint", "Confetti", "LanguageSwitch", "LofiMusicButton"]))
# features
MAP.update(group("features/home", ["Dashboard", "TodayCard", "DashboardInsights", "DailyReminderNudge"], ["smartNudge", "weeklyRecap", "plan"]))
MAP.update(group("features/workout", ["ActiveWorkout", "RestWindow", "SessionPacing", "WorkoutCard", "WorkoutBuilder", "AiGenerator", "ProgramsView", "SmartFormScanner"],
    ["warmup", "voiceCoach", "proceduralWorkout", "scientificRest", "fitness", "programs", "reportQueue"]))
MAP.update(group("features/exercises", ["ExerciseLibrary", "ExerciseAnimation", "ExerciseClip", "ExerciseFlipbook", "ExerciseThumb", "PhotoExerciseDemo",
    "PhotoExerciseThumb", "HumanFigure", "Dumbbell3D", "Dumbbell3DLazy"],
    ["exercisePhotos", "exercisePhotos.generated", "exerciseVideos", "clipCache", "customExercises", "signaturePoseGenerator", "demoPrefs"]))
MAP.update(group("features/arena", ["BeastDuelArena", "ArenaExtras", "LeagueView", "DailyChallenge", "CrewView", "FriendsView", "InviteFriend", "DuelVideo", "LiveStreamDuelModal"],
    ["arenaCatalog", "ghost", "daily", "league", "duelVideo", "challenge", "invite", "phase3", "poseCounter"]))
MAP["src/lib/duelVideo.ts"] = "src/features/arena/useDuelVideo.ts"   # renamed: DuelVideo.tsx sits in the same folder
MAP.update(group("features/reels", ["ReelsFeedView", "ReelCreatorStudio", "ReelCommentsDrawer", "ReelExtras", "GymBeastMotivationReel", "GymMotivationGallery",
    "ViralFlexStudio", "CreatorProfileModal"], ["reelsStore", "socialFeed"]))
MAP.update(group("features/social", ["FriendsAndChatHub", "PeopleSearch", "PublicProfileSheet", "CommunityGallery"], ["social", "useSocial", "useProfiles", "community", "inbox"]))
MAP.update(group("features/safety", ["ReportSheet", "SafetyScreens", "ContentPolicy"], ["blocks"]))
MAP.update(group("features/progress", ["AnalyticsDrawer", "HistoryLogs", "ProgressTracker", "ProgressGallery", "ProgressSummary", "TrophyRoom", "TrophyIcon",
    "LevelUpOverlay", "FlexCardSheet", "BiometricRecoveryHub", "ReviewPrompt"],
    ["progress", "ranks", "achievements", "milestones", "analytics", "recovery", "wellness", "flexCard", "review", "health"]))
MAP.update(group("features/account", ["AuthScreen", "SettingsPage", "CloudSyncPage", "NotificationSettings", "AthleteProfileHub"], ["backup"]))
MAP.update(group("features/billing", ["PremiumHub", "PaywallSheet"], ["billing"]))

CODE_EXT = (".ts", ".tsx", ".css")
SPEC = re.compile(r'''(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\(\s*|@import\s+)(["'])(\.{1,2}/[^"'\n]*)\2''')
TRY = ["", ".ts", ".tsx", ".d.ts", "/index.ts", "/index.tsx"]

def rel(p): return os.path.relpath(p, ROOT).replace(os.sep, "/")
def walk():
    for d, _, fs in os.walk(SRC):
        for f in fs:
            if f.endswith(CODE_EXT): yield os.path.join(d, f)

def resolve(from_file, spec):
    base = os.path.normpath(os.path.join(os.path.dirname(from_file), spec))
    for t in TRY:
        if os.path.isfile(base + t): return base + t, t
    return None, None

def check():
    bad = []
    for f in walk():
        s = open(f, encoding="utf-8").read()
        for m in SPEC.finditer(s):
            if not resolve(f, m.group(3))[0]: bad.append((rel(f), m.group(3)))
    return bad

def spec_for(new_from, new_target, old_spec, tried):
    r = os.path.relpath(new_target, os.path.dirname(new_from)).replace(os.sep, "/")
    if not r.startswith("."): r = "./" + r
    if tried and r.endswith(tried): r = r[: -len(tried)]   # keep "no extension" / "folder" style as it was written
    return r

def apply():
    missing = [k for k in MAP if not os.path.isfile(os.path.join(ROOT, k))]
    if missing: sys.exit("not found: " + ", ".join(missing))
    clash = [v for v in MAP.values() if os.path.exists(os.path.join(ROOT, v))]
    if clash: sys.exit("already exists: " + ", ".join(clash))
    bad = check()
    if bad: sys.exit("unresolved before moving: " + json.dumps(bad[:20]))
    new_of = lambda abs_old: os.path.join(ROOT, MAP.get(rel(abs_old), rel(abs_old)))
    out = {}
    for f in walk():
        s = open(f, encoding="utf-8").read()
        nf = new_of(f)
        def sub(m):
            target, tried = resolve(f, m.group(3))
            return m.group(1) + m.group(2) + spec_for(nf, new_of(target), m.group(3), tried) + m.group(2)
        out[f] = (nf, SPEC.sub(sub, s))
    for f, (nf, s) in out.items():
        os.makedirs(os.path.dirname(nf), exist_ok=True)
        if nf != f: os.rename(f, nf)                       # a rename, so nothing is ever deleted
        with open(nf, "w", encoding="utf-8", newline="\n") as h: h.write(s)
    for d in ("components/ui", "components", "lib"):
        p = os.path.join(SRC, d)
        if os.path.isdir(p) and not os.listdir(p):
            try: os.rmdir(p)
            except OSError:                                # deleting may be blocked: park the empty folder instead
                os.makedirs(os.path.join(ROOT, "_to_delete"), exist_ok=True)
                os.rename(p, os.path.join(ROOT, "_to_delete", "empty-" + d.replace("/", "-")))
    # tools and docs that name files by path
    for d, _, fs in os.walk(os.path.join(ROOT, "tools")):
        for name in fs:
            if not name.endswith(".mjs"): continue
            p = os.path.join(d, name); s = open(p, encoding="utf-8").read(); o = s
            for old, new in sorted(MAP.items(), key=lambda kv: -len(kv[0])):
                s = s.replace(old, new)
                s = s.replace('"' + old[4:] + '"', '"' + new[4:] + '"')            # "lib/x.ts" style (relative to src)
                s = s.replace('"' + old[4:-3] + '.js"', '"' + new[4:-3] + '.js"') if old.endswith(".ts") else s
            if s != o: open(p, "w", encoding="utf-8", newline="\n").write(s)
    with open(os.path.join(ROOT, "tools", "restructure-map.json"), "w", encoding="utf-8", newline="\n") as h:
        json.dump(MAP, h, indent=1, sort_keys=True); h.write("\n")
    bad = check()
    print(f"moved {sum(1 for k, v in MAP.items() if k != v)} files; unresolved imports after: {len(bad)}")
    for b in bad[:30]: print("  ", b)

if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "check"
    if mode == "apply": apply()
    else:
        bad = check()
        print("unresolved relative imports:", len(bad))
        for b in bad[:40]: print("  ", b)
        sys.exit(1 if bad else 0)
