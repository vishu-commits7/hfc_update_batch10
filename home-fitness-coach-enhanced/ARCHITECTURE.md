# Apex Pulse: how the code is organised

Updated 11 Nov 2026 (Batch 50). Before this, every screen lived in one `components` folder (75 files) and every
helper in one `lib` folder (70 files). They are now sorted by what they are for. Nothing was rewritten in the move:
168 files were renamed and their imports updated by `tools/restructure.py`; `tools/restructure-map.json` lists
every old path and its new one.

## The three places code runs

| Where | What it does | What it must never do |
|---|---|---|
| **Server** (`functions/src`, Firebase Cloud Functions) | Owns every number that matters: XP, level, streak, rating, league, Arena results, daily challenge, invites, Pro status, moderation. | Trust a number sent by a phone without checking it. |
| **Database rules** (`firestore.rules`, `storage.rules`) | Stop a phone from writing those numbers directly. | Allow a client write to a server-owned field. |
| **App** (`src`) | Draws screens, collects taps, asks the server, shows the answer. Also keeps on-device things: workout history, settings, cached answers. | Decide a reward, a rating or a match result. |

So the "backend" is not in the UI: a modified app cannot give itself XP or a win. What *was* true is that the
app code had no structure, and that screens waited on the network before drawing. Both are addressed below.

## Inside the app (`src`)

Arrows show who may import whom. `npm run arch:check` fails the build check if an arrow is reversed.

```
app  ->  features  ->  shared  ->  core
              \___________________^
(all of them may use the base folders: types.ts, constants.ts, data, anim, design, hooks, i18n, styles, assets)
```

| Folder | What belongs there |
|---|---|
| `src/app` | The shell: `App.tsx` (which screen is showing), the bottom bar, first-run flow (intro, goal setup, personalise), command palette, error boundary. |
| `src/core` | Platform services with no screens: Firebase set-up, server calls, caches, sign-in, native bridge (share sheet, haptics, audio), links, push and local notifications, analytics, error logging. |
| `src/shared` | Small building blocks any feature can use: buttons, cards, avatar, dialogs, loading and error states (`shared/ui`). |
| `src/features/home` | Today screen: dashboard, Today card, daily plan, reminders. |
| `src/features/workout` | Doing a workout: the player, rest, warm-up/cool-down, voice coach, AI generator, programs, form scanner, offline report queue. |
| `src/features/exercises` | The exercise library and every way an exercise is shown (clips, photos, animated figure). |
| `src/features/arena` | Arena: matches, ghosts, quick match, leagues, daily challenge, crews, friends board, invites, rep counting. |
| `src/features/reels` | Feed, reel studio, comments, stories. |
| `src/features/social` | Profiles, follows, chat, community posts, inbox. |
| `src/features/safety` | Report, block, moderation screens, content policy. |
| `src/features/progress` | XP and levels, trophies, history, charts, share cards, level-up screen, rating prompt, Health Connect. |
| `src/features/account` | Sign-in, settings, cloud backup, notification settings, own profile hub. |
| `src/features/billing` | Paywall and Pro. |

Rules of thumb:
- A new screen goes in the feature it belongs to, next to the helper that feeds it.
- Anything that talks to Firebase directly belongs in a helper file (`*.ts`), not inside a screen (`*.tsx`).
- If two features need the same helper and it has no screen, it moves to `core`; if it is a visual piece, to `shared`.
- Features may import each other (the check prints the count). Keep it to "use their screen or their data", not their internals.

## How data reaches a screen (the speed rules)

1. **Firestore keeps a copy on the phone** (`core/firebase.ts`). A list draws from the copy at once, then updates.
2. **Server answers are remembered** (`core/callCache.ts`): today's plan, the daily challenge, your league group and
   your invite card show the last answer immediately and refresh behind it. Rewards never come from the cache.
3. **Shared listeners** (`core/sharedQuery.ts`): leaderboards and tables keep one live connection, reused across tabs.
4. **Only the Today screen is in the first bundle.** Everything else loads on first use and is warmed in the
   background a moment after launch (`app/App.tsx`).
5. **The launch screen is static HTML** (`index.html`), so something is visible before any code runs, and the web font
   no longer blocks the first paint.

## Still to do (honest list)

- `src/app/App.tsx` is still about 1,600 lines: it holds navigation, workout logging and several overlays. It should
  be split into a navigation hook, a workout-log store and an overlay host. Not done here because it cannot be
  tested without running the app.
- Three screens still call Firestore directly: `account/CloudSyncPage.tsx`, `arena/ArenaExtras.tsx`, `safety/ContentPolicy.tsx`.
  They work; they should move behind their feature's helper file.
- `server.ts` still has the old in-memory `/api/duel/*` routes from before Arena moved to Cloud Functions. Unused by
  the app; remove after confirming on a device.
- `features/workout/WorkoutBuilder.tsx` is not used by any screen.
- Workout history lives on the phone (with optional cloud backup), by design. XP for it is granted by the server.
