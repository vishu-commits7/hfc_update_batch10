# Bug-fix batch notes

## Steps you must do once (can't be done from code)
1. **Google sign-in** – put your Firebase *Web client ID* in `.env` as `VITE_GOOGLE_WEB_CLIENT_ID=...`
   and add the app's SHA-1 (`cd android && ./gradlew signingReport`) in Firebase Console →
   Project settings → your Android app. Without both, the Google button shows a clear message and
   Email / Guest sign-in still work.
2. **Firestore rules** – open `firestore.rules` in this folder, copy ALL of it into Firebase Console →
   Firestore Database → Rules, and click Publish. It replaces the older small rule. Follows, DMs,
   comments, likes and arena rooms all need it.
3. Rebuild the native app: `npm run build && npx cap sync android`, then run from Android Studio
   (a new native plugin + manifest permissions were added, so a fresh APK is required).
4. Optional: set `VITE_APP_SHARE_URL` to the public web address used inside shared links.
5. The "Sign in to fitness-app-1e5f0.firebaseapp.com" text only appears on the web popup flow.
   To brand it, set the public-facing name/logo in Google Cloud Console → OAuth consent screen.

## What changed
- Profile photo now persists (stored as a compressed data URL instead of a temporary blob URL).
- Real Android share sheet for stories, reels, flex cards, backups, duel invites, profile.
- Native Google sign-in (Credential Manager) – no Firebase popup, no black screen.
- Dedicated Cloud Sync page (back up / restore via Firestore).
- Black screen when leaving a workout: the quit dialog referenced an un-imported icon; fixed, and an
  error boundary now stops any screen error from blanking the app.
- Lo-fi music: boosted ~11x (was ~40 dB too quiet), AudioContext resumes before scheduling,
  music button overrides the global mute flag, stopped suspending the shared audio context.
- Share-card "Building your card…" hang: render no longer restarts every second; font wait is capped.
- Exercise thumbnails: human photo (one skin tone) on cards/lists; demo player shows video only.
- Reels: no still frame before playback; only on-screen reels mount a video.
- Performance: removed full-screen blur layers, blanket GPU-layer promotion, backdrop blur on phones,
  render-blocking font @import, side-effects inside state updaters in the workout timer.
- Theme follows the phone (System / Light / Dark in Settings → Appearance); header toggles removed.
- Search: theme-aware, no ESC, descriptive rows, no reset/theme/premium commands.
- Settings, profile, coach, arena, rest screen: re-skinned on theme tokens.
- Trophies: rank + level system, five discipline trophies (3 tiers each), milestone badges.
- Posts: camera permissions added to the manifest; camera option no longer vanishes.
- Breathing cue auto-advances; stat tile "+N" no longer clips; biometrics no longer shows Start Workout.

## Batch 2: social backend, reels, arena, profile
- **Backend (Firestore, no Storage needed):** public profiles with @handle and search keys, follow
  requests (pending -> accepted), DMs unlocked after accept, reel comments + likes, live arena rooms,
  arena leaderboard. Code: `src/lib/social.ts`, hooks in `src/lib/useSocial.ts`.
- **Reels:** likes counted once (was +1 twice), live shared like/comment counts, only the visible reel
  decodes video, blank poster hides the Android grey play glyph, spinner + retry instead of a black card.
- **Comments:** open above the bottom bar with a visible text box; post under your real name and photo;
  tap anyone's avatar or name to open their profile (follow, message, challenge).
- **Search in Reels:** athletes, @handles and videos; follow from the results.
- **Messages:** Chats + Requests tabs; accept a request, then chat. Challenge sends a private arena
  room code into the chat with a one-tap Join button.
- **Arena:** mock opponents removed. Create/join rooms by code, open-matches lobby, live 1v1 with both
  rep counts updating in real time, wins leaderboard. Reps are counted by tapping (no camera counting).
- **Profile:** photo saves on the phone and on your public profile; edit name, bio and privacy from
  Athlete Profile -> Public profile. Community screen no longer hangs on a skeleton, uses the app theme,
  and posts photos without Firebase Storage.
- **Coach voice:** always the deep male voice.
- Screens open faster: heavy screens are prefetched while the app is idle.
- Reels you create still live only on your phone (publishing videos to everyone needs Firebase Storage).

## Batch 3 — look & privacy
- Dark theme recoloured: calm blue accent (#7AA2FF) replaces neon yellow-green; softer surfaces (#0F1013 / #16181D / #1F2229); brighter secondary/muted text for readable contrast. Green is now only used for "success".
- Account privacy: Profile -> "Account: Public/Private". Public = follow instantly; Private = approve requests.
- Follow requests: bell icon in the top bar (red badge) -> Requests tab; also Reels -> Chat -> Requests.
- RE-PUBLISH firestore.rules: Firebase -> Firestore Database -> Rules (not Realtime Database) -> paste -> Publish.

## Batch 4 — chat ticks & notifications
- Message ticks: single grey = sending/offline or sent; double grey = delivered to their phone; double blue = read.
- Messages queue offline and send when the net returns.
- Settings -> Notifications: master switch + per-type Sound / Mute / Off (chats, groups, follows, new reels, likes, comments). Reminders & water reminder remain under Reminders.
- Limits: alerts arrive while the app is open or in background; when Android fully kills the app, real push needs Firebase Cloud Messaging + Cloud Functions (not set up).
- Re-publish firestore.rules (adds notifs collection).

## Batch 5 — shared reels, live arena video, account fixes
- Reels are now shared through Firestore (publicReels / followerReels + chunked media). Public accounts: everyone sees; Private accounts: approved followers only. Max 8 MB per reel.
- Arena rooms have live WebRTC video (signalling in rooms/{code}/rtc). STUN only.
- Profile: Public/Private segmented control; bad name "user_not_found" is auto-repaired.
- Like/comment/new-reel notifications work for real reels.
- RE-PUBLISH firestore.rules (Firestore -> Rules).

## Batch 6 — real backend (Cloud Functions)
Deploy order (from project root):
  npm i -g firebase-tools ; firebase login
  npm install                      (adds @capacitor/push-notifications)
  cd functions ; npm install ; cd ..
  firebase deploy --only firestore:rules,storage,functions
Then: npm run build ; npx cap sync android ; rebuild APK.
Also enable Storage in the Firebase console (Storage -> Get started) before deploying storage rules.
Functions: arenaStart/arenaReport/arenaFinish/arenaLeave (referee), sweepRooms (cron), notification triggers (chat, follow, like, comment, new reel), follow auto-accept for public accounts, reel cleanup.

## Batch 7 — progression, arena catalog, navigation
- Back button: real navigation stack (App.tsx). Settings -> back returns to where you came from; no more Settings <-> Progress Feed loop.
- Privacy (Public/Private) lives only in Settings. Profile now shows level, rank + XP bar, streak, trophies (locked ones dimmed) and Arena match history.
- Server-owned progression: `recordWorkout` function awards XP, level, streak, trophies; arena matches award XP/trophies and write users/{uid}/matches. Clients can no longer write xp/level/stats (firestore.rules).
- Level-up / rank-up / trophy celebration overlay after logging a workout.
- Leaderboard moved to Arena tab "Leaderboard": ranked by XP, highest first, podium for top 3, only people with XP > 0 (workouts or arena).
- Arena: pick challenge type (Single / Body part / Full body), Popular exercises on top, 7 body-part groups (~30 exercises), per-exercise rep steppers. Multi-exercise rooms = first to finish all; live "Exercise 2 of 4" banner.
- DEPLOY: firebase deploy --only firestore:rules,functions ; npm run build ; npx cap sync android ; rebuild APK. Deploy BEFORE installing the new app.

## Batch 8 — safety, counters, telemetry
New server modules (functions/src): init, counters, account, moderation, media, telemetry.
- Counters: followers/following (users.followerCount/followingCount), reel likeCount/commentCount/views are written ONLY by the server (rules block clients). Triggers re-count, so numbers can't drift. Views: recordReelView (once per user per reel).
- Delete account (Settings -> Data & Account): deleteAccount removes profile, reels + media, follows, chats, posts, comments, rooms, inbox and the sign-in. Type DELETE to confirm.
- Block / report: flag button on reels, comments and profiles. Blocking removes follows both ways, hides content, stops messages/follow requests. 3 distinct reports auto-hide a reel. Settings -> Safety -> Blocked users.
- Moderation queue: Settings -> Safety -> Moderation queue (only for emails in functions/.env ADMIN_EMAILS). Dismiss / Remove / Ban user.
- Private reels: new uploads from private accounts go to reels-private/ (no client read) and followers get a 1-hour signed URL via getReelUrl. Older private reels keep working through their old links.
- Analytics events (Firebase Analytics): first_open, onboarding_step, onboarding_complete, first_workout, workout_logged, level_up, first_arena_match, arena_match_finished, return_day_1, return_day_7 (src/lib/track.ts).
- Error log: uncaught errors + render crashes -> Firestore `clientErrors` (src/lib/errorLog.ts). Native Crashlytics needs a native plugin; this covers JS errors.
- Offline banner + retry/skeleton states on leaderboard, open rooms and reels feed.
- App Check wired but OFF until you set VITE_APPCHECK_SITE_KEY.

DEPLOY (order matters)
1. In functions/.env set ADMIN_EMAILS=your-login-email@example.com
2. cd functions && npm run build && cd ..
3. firebase deploy --only firestore:rules,firestore:indexes,storage,functions
4. ONE-TIME for private reel links: Google Cloud console -> IAM & Admin -> IAM -> principal 672829940611-compute@developer.gserviceaccount.com -> Edit -> Add role "Service Account Token Creator" -> Save.
5. Firebase console -> Firestore -> TTL -> add policy: collection clientErrors, field expireAt (auto-deletes old error logs).
6. npm run build ; npx cap sync android ; rebuild APK.
APP CHECK (optional, later): Firebase console -> App Check -> register the web app with reCAPTCHA v3 -> put the site key in .env as VITE_APPCHECK_SITE_KEY -> rebuild -> watch App Check metrics a few days -> then set ENFORCE_APPCHECK=true in functions/.env and redeploy functions.
BUDGET: Google Cloud console -> Billing -> Budgets & alerts: alerts at 50% / 90% / 100% (you already created a budget).

## Batch 9 — retention (onboarding, streaks, quests, leagues)
- Onboarding: after the intro slides -> 3 quick screens (goal, level, equipment) -> a first workout is built on the spot and starts immediately. Skippable. Then a one-time 3-step tour (Arena, Reels, Profile).
- Home "Today" card: one big next action, streak + streak freezes, daily goal (editable, default 20 min), daily + weekly quests, last week's league result, optional 9 PM streak reminder.
- Streak freeze (server): everyone starts with 1; one missed day is forgiven automatically; earn +1 every 7-day streak (max 2).
- Quests (server): 3 daily + 2 weekly, progress and XP paid by the server on workouts and Arena matches. 10/50 quests earn trophies.
- Weekly leagues (server): Bronze -> Silver -> Gold -> Platinum -> Diamond, groups of 30, weekly XP, top 10 promote, bottom 5 demote (groups of 10+), resets Monday 00:00 IST. Arena -> League tab. Needs a public account. Promotions earn league trophies.
- Share: level-up screen has a Share button (story image). Workout summary sharing already existed.
- New server fields are blocked from client writes in firestore.rules (freezes, weekXp, leagueTier, ...).
DEPLOY: cd functions && npm run build && cd .. ; firebase deploy --only firestore:rules,firestore:indexes,functions ; npm run build ; npx cap sync android ; rebuild APK.
The new index (users: leagueGroup + weekXp) takes a few minutes to build; the League tab may show an error until it finishes.

## Batch 10 — social (friends, crews, challenges, arena upgrades, reels discovery)
- Arena tabs: Play | League | Friends | Crew | Global (row scrolls). Global has "Most XP" and "Arena rating".
- Arena rating (Elo): separate from XP. Start 1000, K=40 for the first 10 matches then 24, written by the server when a match finishes. Shown in the Arena header, profile, result screen (+/-), and the rating leaderboard.
- Rematch: result screen -> Rematch. First tap creates a private room with the same settings, the other player sees "wants a rematch. Join".
- Quick match: Play tab. Pairs you with the oldest waiting player who picked the SAME exercise and reps (not by rating). Gives up after 60 s. Match starts automatically.
- Spectate: "Live now" list of public live matches. Scores only, no video (camera feed stays between the two players).
- Friends tab: friends = accepted follows either direction. This week / All-time XP. Challenge a friend (3, 5 or 7 days, most workouts). Server counts workouts, an hourly job closes it, winner +150 XP, loser +40, draw +75, trophies for 1 and 5 wins.
- Crews (Crew tab): create or join by 6-letter code, max 20, shared weekly workout goal (owner can change), member leaderboard, group chat with push (uses the existing "groups" notification setting), owner can remove members.
- Reels: thumbnail made at upload, #hashtags saved as tags, tap a hashtag to open its feed, reels grid on every profile (private-account reels only for accepted followers), Latest / Trending toggle (trending is recalculated by the server every 30 minutes from recent likes, comments and views with age decay).
- New server fields blocked from client writes: rating, ratingPeak, crewId, challengeWins, trendScore.
- Limits: reels uploaded before this update have no thumbnail or tags. Hashtag search from the search box is not added yet (tap hashtags in captions instead). Quick-match is not rating-based yet.
DEPLOY: cd functions && npm run build && cd .. ; firebase deploy --only firestore:rules,firestore:indexes,functions ; npm run build ; npx cap sync android ; rebuild APK.
New indexes (matchQueue, challenges, reels by owner/tag) take a few minutes; Friends/Crew/Trending screens may show an error until they finish. Trending stays empty until the first 30-minute job has run.

## Batch 11 — adaptive plans + camera rep counting
- Adaptive plans (server `planNext`): reads your recent sessions (area, minutes, how it felt) and recovery. Picks the most rested area (Upper, Lower, Core, Cardio), nudged by your goal, never the same area twice in a row if avoidable. Suggests a rest day after 6 days in a row or two sore/exhausted sessions. Eases off (shorter) when everything is still recovering, steps the level up after a strong fortnight (8+ sessions, last 3 felt good). Shown on the Today card; the big button starts that exact workout. New installs/older users: the last 20 local sessions are sent as a one-off seed so advice works immediately (suggestion only, no rewards come from it).
- recordWorkout now also stores users/{uid}/workoutLog (area, minutes, feeling); read-only for the owner in rules.
- Camera rep counting (Arena room, during the match): "Count reps with camera" button under the video. Supports push-ups, squats, lunges, sit-ups (joint-angle based, ~15 fps, on-device). Taps are ignored while the camera counts; if the camera counter fails you can tap again. Body must be in frame (it says so if not).
  - Loads MediaPipe from jsdelivr + Google storage on first use, so it needs internet that one time (adds nothing to app size). To bundle it offline later: npm i @mediapipe/tasks-vision and ship the wasm + model in /public.
  - Honest limit: counting still happens on the player's phone, so this is fairer than tapping but not cheat-proof.
  - Needs a real-device test: phone propped so your whole body is visible, side-on for push-ups and sit-ups.
DEPLOY: cd functions && npm run build && cd .. ; firebase deploy --only firestore:rules,functions ; npm run build ; npx cap sync android ; rebuild APK.

## Batch 12 — Health Connect + Pro subscription (Android native code, NOT compiled yet)
Written without being able to build Android, so the first Gradle sync/build is the real test. If Gradle complains, send me the error.

HEALTH CONNECT (steps + active calories, read-only, stays on the phone, no XP from it)
- Native: android/.../ApexHealthPlugin.kt (Kotlin; the Kotlin Gradle plugin 2.0.21 was added, same version @capacitor/local-notifications already uses). Manifest: READ_STEPS, READ_ACTIVE_CALORIES_BURNED, permission-rationale intent + Android 14 activity-alias.
- App: Today card shows steps + active kcal, or a "Connect Health Connect" row. Android 13 and below need the Health Connect app from Play; Android 14+ has it built in.
- Play Console (required before release): App content -> Health apps declaration + Data safety form (health & fitness data: steps, calories, collected: no / processed on device) and a privacy policy URL mentioning it.

PRO SUBSCRIPTION (Google Play Billing 8.0.0)
- Native: ApexBillingPlugin.java. Server: functions/src/billing.ts (getEntitlement, verifyPurchase). The server asks Google Play, stores users/{uid}.proUntil (clients cannot write it), one purchase token = one account, acknowledges purchases itself.
- Pro unlocks: adaptive plans (enforced on the server), AI generator + coaching hub (client gate, so a determined user could bypass those two; adaptive plans cannot be bypassed). Arena, leagues, crews, friends, reels stay free.
- SAFE ROLLOUT: functions/.env BILLING_ENABLED=false (default). While false, EVERYONE keeps Pro and nothing is locked. Flip to true and redeploy functions only when the subscription is live.
- Renewals/cancels: each app launch re-verifies active Play subscriptions with the server. (Instant server-side renewal notifications via RTDN are not set up; add later if you want exact cancel timing.)
SETUP (one time)
1. Play Console -> your app -> Monetize -> Subscriptions -> Create subscription, Product ID: apex_pro. Add two base plans (monthly P1M, yearly P1Y) and activate them. Needs a merchant/payments profile.
2. Upload a build to Internal testing (the app must be uploaded for billing to work), add yourself as a License tester (Setup -> License testing) and install from the Play testing link.
3. Cloud console -> APIs -> enable "Google Play Android Developer API".
4. Play Console -> Users and permissions -> Invite new users -> the email 672829940611-compute@developer.gserviceaccount.com -> permissions "View financial data" and "Manage orders and subscriptions" -> Invite. (Can take a few hours to start working.)
5. cd functions && npm install && npm run build && cd .. ; firebase deploy --only firestore:rules,functions ; npm run build ; npx cap sync android ; build the AAB/APK in Android Studio.
6. Test with BILLING_ENABLED=false first (everything unlocked), then set true, redeploy functions, and test a license-tester purchase.
Limits: billing and Health Connect only work on a real Android device installed from Play (billing) or any device (Health Connect). Not testable in the browser.

## Batch 13 — UX rules pass
- First session: intro cut to 2 slides; setup (goal, level, equipment) now builds a "2-Minute Starter" (3 simple moves, 1 set, 10 s rests) and starts it at once. Needs a real-device stopwatch test.
- Bottom bar: same 4 tabs everywhere; it no longer disappears on Settings, Community, Sign-in or Cloud sync (only during a live workout).
- Hints: one-line "Got it" hint, shown once each (OneTimeHint): Quick match, Friends, Crew, Trending, Adaptive plan.
- Back: new overlay back-stack (lib/backStack.ts). Back closes the top-most sheet first (profile, comments, report, chat hub, search, level-up, tour, paywall, reel viewer, hashtag feed, spectate, Arena sub-steps, Arena lobby/result). Back is ignored during a live match so it can't forfeit by accident.
- Motion: removed press-scale on buttons/cards/tiles (CSS + whileTap), reduced-motion honoured (MotionConfig + CSS). Kept for rewards: level-up, trophies, confetti. Some decorative loops remain in onboarding backgrounds, exercise demos and the paywall icon.
- Accessibility: pinch-zoom allowed (viewport no longer blocks it), Android system font size is followed up to 130% (MainActivity), 9/10 px text raised to 11 px, every button gets an invisible hit area so targets are about 48dp.
- Lists: loading/empty/error checked on Arena lists, friends, crews, reels grid (error + retry added), trending, chats, comments, search.
Not done / honest limits: "one primary action per screen" is a design judgement I did not audit screen by screen (Dashboard has several actions). Text contrast was not measured with a tool. Large-font layouts need a device check at 130%.

## Release v1.0.0 — verification and security review (2026-11-08)
BUILD CHECKS (run on this machine): app `tsc --noEmit` clean, `functions` `npm run build` clean. Nothing has been run on a device, in the Firebase emulator, or against Google Play. Android native code (Health Connect, Billing) has never been compiled.

FIRESTORE RULES REVIEW (read through firestore.rules line by line; not emulator-tested)
Confirmed: a client cannot write, on create or update of users/{uid}: xp, level, rankId, totalWorkouts, streakDays, totalMinutes, lastWorkoutId/Day/At, arenaWins, arenaMatches, rating, ratingPeak, weekXp, weekId, leagueTier/Group/Week, lastLeagueResult, questsDone, freezes, challengeWins, crewId, followerCount, followingCount, banned, proUntil, proState, proProduct.
Confirmed: no client writes to users/*/trophies, matches, quests, workoutLog; challenges; crews and crews/*/members; matchQueue; playTokens; notifs (create). Rooms: a client can only create an empty waiting room and join as guest; reps, results, rating and rematch fields are written only by server functions. Crew chat: members only, text up to 500 chars. Chat messages are blocked if the recipient blocked the sender.
Fixed in this pass: (1) a chat member could rewrite the chat's `members` list; now it must stay unchanged. (2) lastWorkoutId/Day/At are now also blocked on user-doc create.
NOT TRUE, so not claimed: "no client can write other people's data". Known remaining cases:
 1. posts: any signed-in user can update likedBy/likeCount on ANY post with arbitrary values (inflate or reset likes).
 2. reelComments: same for comment likes.
 3. Reels: createdAt, tags and thumb are client-supplied (can fake "newest" order or a misleading thumbnail).
 4. Arena farming: rules cannot stop two accounts owned by one person from playing each other for XP/rating. Needs server limits (for example a cap on rated matches against the same opponent per day).
 5. Every signed-in user can read other users' profile docs, trophies and match history (by design for profiles and leaderboards).
Next hardening step: move post/comment likes behind a callable (or a rule that only allows adding/removing your own uid with a +1/-1 count), and add the Arena same-opponent cap.
Storage rules were reviewed earlier (Batch 8) and not re-reviewed in this pass.

RELEASE CONTENTS (v1.0.0 = Batches 7 to 13): progression and profile, safety and moderation, private reels, analytics and error log, onboarding and 2-minute starter, streaks, quests, weekly leagues, friends, challenges, crews, Arena rating/rematch/quick match/spectate, camera rep counting, adaptive plans, Health Connect, Pro subscription (off until BILLING_ENABLED=true), UX and accessibility pass.
BEFORE USERS GET IT: deploy functions + rules + indexes first (cd functions && npm install && npm run build && cd .. ; firebase deploy --only firestore:rules,firestore:indexes,storage,functions), then npm run build, npx cap sync android, rebuild. If the web app is auto-deployed from main (Render), merge to main only AFTER the Firebase deploy, otherwise the new screens call functions that don't exist yet.
Also bump versionCode in android/app/build.gradle (it is still 1) before uploading to Play.

Fix: minSdkVersion raised 24 -> 26 in android/variables.gradle (Health Connect requires Android 8.0+). Android 7 phones can no longer install the app.

## Batch 14 — Login first
- After the 2 intro slides, signed-out users see a full-screen sign-in/sign-up (Google or email). No Back, no guest button (`AuthScreen required`). GoalSetup and the app start only once signed in. Existing guest (anonymous) sessions keep working. To revert, remove the gate block in App.tsx.
