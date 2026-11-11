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

## Batch 15 — App Check on Android (enforcement still OFF)
- New `ApexAppCheckPlugin.java`: Play Integrity provider in release builds, debug provider in debuggable builds; `getToken()` feeds a `CustomProvider` in `src/lib/firebase.ts`. Web keeps reCAPTCHA v3 (needs `VITE_APPCHECK_SITE_KEY`).
- `android/app/build.gradle`: firebase-bom 33.7.0 + appcheck-playintegrity + appcheck-debug. Not compiled by me.
- `ENFORCE_APPCHECK` stays `false` in functions/.env until tokens are confirmed in Console metrics. Play Integrity only passes for installs from Google Play, so sideloaded APKs would be blocked once enforced.

## Batch 16 — Hardening: likes, Arena pairs, reel fields, account deletion
- (a) `firestore.rules`: post and reel-comment likes can only add or remove the caller's own uid, one at a time, with likeCount moving by exactly 1 (`likeOnlyChange`). Post owners can no longer edit likedBy/likeCount or change `uid`. New posts and comments must start at 0 likes. `reelLikes` create must carry `uid` and `createdAt == request.time`; updates are blocked.
- (b) `finalize` in functions: same two players get rating/XP from at most 3 matches per IST day (`arenaPairs/{day}_{uidA}_{uidB}`, server-only). Extra matches finish with `unrated: true`.
- (c) Rules `reelFieldsOk`: createdAt must equal server time; tags max 5; thumb must be a small JPEG data URL; caption max 300; `mediaPath` must be inside the owner's own folder; `mediaUrl` must be a Firebase Storage URL. Triggers re-clean tags/thumb/caption after create. Reel delete cleanup only deletes files under the owner's folder (a forged mediaPath could previously delete another user's file) and also removes the reel's likes and comments.
- (d) `deleteAccount` removes the user's reel likes (by new `uid` field, plus a scan of existing reels for older likes). New collection-group index override on `users.uid`.
- Needs deploy of rules, indexes and functions. Rules were not run through the emulator here; test likes, posting a reel, and Arena after deploy.

## Batch 17 — Pose model bundled for offline counting
- `src/lib/poseCounter.ts` now loads MediaPipe from `/mediapipe` (inside the app) and only falls back to the CDN if those files are missing.
- Run once on a PC with internet: `npm run fetch:mediapipe` (downloads roughly 20-25 MB (estimate) into `public/mediapipe`, using `tools/fetch-mediapipe.mjs`), then `npm run build` and `npx cap sync android`. The files make the APK/AAB larger by that amount.
- Not tested on a device. The bundle is saved as `vision_bundle.js` (not .mjs) to avoid a WebView MIME-type problem.

## Batch 18 — Camera counting: device and speed check
- `poseCounter.ts`: low-end check (under 3 GB RAM or under 4 cores, when the WebView reports them) keeps taps on by default; a speed check watches detection time (two windows of 20 frames averaging over 110 ms) and switches to taps with status `slow`.
- The choice is remembered in localStorage (`apex_cam_count_v1`): the player's own on/off, and an automatic switch-off. The Arena button reads "Try camera counting anyway" / "Try again", which clears the automatic switch-off.
- Thresholds are my estimates; not measured on a real low-end phone.

## Batch 19 — Crashlytics
- Gradle: `firebase-crashlytics-gradle:3.0.2` (root) and `com.google.firebase.crashlytics` plugin applied next to google-services; `firebase-crashlytics` and `firebase-analytics` dependencies (versions from the Firebase BoM). Native crashes are reported by the SDK.
- `ApexCrashPlugin.java` + `src/lib/errorLog.ts`: JS errors, unhandled rejections and render crashes also go to Crashlytics as non-fatal reports (message, where, version, trimmed stack; no user data). The existing Firestore `clientErrors` logging still runs.
- Adding Analytics means the Play Data safety form must mention analytics/diagnostics. Not compiled by me; first report appears only after a build that crashes or logs an error is run on a phone.

## Batch 20 — Release build setup
- `versionCode 2`, `versionName "1.0.1"`. Raise `versionCode` by at least 1 for every new Play upload.
- `android/app/build.gradle` signs the release build from `android/keystore.properties` (git-ignored; template in `keystore.properties.example`). Without it the AAB is unsigned.
- Minify/shrink left OFF for the first release (untested on a device). Keep rules prepared in `proguard-rules.pro`.
- Root `.gitignore` now ignores `*.jks`, `*.keystore`, `keystore.properties`.
- Not built by me: Gradle and the Android SDK are not available here.

## Batch 21 — Analytics funnel
- All event names are in `src/lib/analyticsEvents.ts`. `src/lib/track.ts` sends them through the native Firebase SDK on Android (`ApexAnalyticsPlugin.java`) and the web SDK on the website.
- Funnel events: app_open, signup_complete (method email/google), goal_set (goal, level), first_workout_started, first_workout_finished, return_d1/d7/d30, paywall_seen, arena_match_played (exercises, mode, quick), challenge_sent (days).
- No personal data: no user id (setAnalyticsUser now does nothing), no names, emails or free text. `first_open` is no longer logged by hand because Firebase collects it itself and reserves the name.
- Old event names (first_workout, return_day_1/7, paywall_view, goalsetup_complete, arena_match_finished) are replaced, so old and new data will not join up in reports.
- Funnel steps built in Console: see chat. Events show in DebugView immediately and in reports after about a day.

## Batch 22 — Push notifications
- New settings screen: Notifications > "Challenges & streaks" with on/off for streak at risk, challenge received, rematch waiting, crew activity (`NotificationSettings.tsx`, prefs in `notifyPrefs.ts`, synced to `users/{uid}.notifPrefs`).
- Permission is no longer asked at launch. `registerPush` only registers if already allowed; `requestPushAfterFirstWorkout` asks once, 3 s after a finished workout (`push.ts`, `App.tsx`).
- Server (`notifyLib.ts`): the four engagement types share a cap of 1 push per user per day (`pushState/{uid}`), skip 22:00-07:00 in the user's local time (`tzOffset` synced by the app; unknown = India +330), and never send if the type is off. Blocked pushes are dropped, not delayed.
- New hourly function `streakAtRiskPush` (`streakPush.ts`); rematch push added in `arena2.ts`; crew pushes use category "crew"; account deletion removes `pushState`.
- Not tested on a device; Android push channels and FCM delivery unverified.

## Batch 23 — Streak freeze + weekly goal
- Streak freeze (server, `recordWorkout`): 1 earned each time the streak hits a multiple of 7, max 2 held, used automatically on missed days. Now one freeze per missed day (before, only a single missed day could be covered). If there are not enough freezes the streak restarts and none are spent. New accounts still start with 1 freeze (unchanged).
- Weekly goal (3, 4 or 5): new callable `setWeeklyGoal` (`functions/src/weekly.ts`). `recordWorkout` counts days with a workout per ISO week (`weekDone`, `weekDoneId`; a second workout the same day does not count) and returns `weekGoalHit` once. Default goal 3.
- Rules: `weeklyGoal`, `weekDone`, `weekDoneId` added to the server-only keys in `firestore.rules` (create and update), so the app cannot write them.
- Today card: streak and freeze chips as before, plus a "This week 2/4 workouts" row with dots; tapping it cycles the goal 3, 4, 5 through the server. Loading/error text shown inline. Finishing the goal shows one line on the reward screen.
- Week boundary follows the phone's calendar day (the same day the streak uses), not India time.
- Not tested on a device; rules not run in the emulator.

## Batch 24 — Welcome-back card
- After 3+ days since the last logged workout, the Today card shows one friendly "Welcome back" note and its primary button becomes "Start a 5-minute easy session" (three simple moves, two gentle rounds, `buildEasyWorkout` in `src/lib/plan.ts`). A small "Not now" link dismisses it. No guilt wording; no streak or "missed" text in the card.
- Never twice for the same break: the break is identified by the day of the last workout before it and stored in localStorage (`ap_welcome_back_for`) the moment the card is first shown. A new workout starts a new break.
- Display only, no progression written. Works for guests too (uses the local workout log).
- Limits: clearing app data or reinstalling can show it once more; it is per device. Not tested on a device.

## Batch 25 — Screen audit: one primary action, same bottom bar, back button
Back button (App.tsx): workouts now remember where they were started (hardware Back and the in-workout Back return there, not always Today); AI generator, History, Arena and Sign-in Back buttons use the real back stack; Exercise Library to Progress log goes through `nav` so Back returns to the library; popstate fallback no longer leaves a blank workout screen.
Bottom bar: Settings, Community, Sign-in and Cloud sync reserved only 24px under their content, so the bar covered the bottom of them; every screen now reserves room for the bar.
One primary action: Today screen had 5 filled start buttons (Today card, hero, first-workout card, empty routines, Athlete Spotlight); only the Today card button is filled now. Feed "Challenge", Arena lobby "Join" and the AI key "Save" were also filled and are now outlined or neutral.
Left as is (on purpose): bar hidden during an active workout; desktop side rail has Academy where the phone bar has Coach; Progress, Premium and Library have no on-screen back arrow (hardware Back works); the Pro gate on the AI Coach covers the bar while shown (everyone is Pro while billing is off).
Not tested on a device.

## Batch 26 — Accessibility pass (contrast, 130% font scale, TalkBack labels)
Contrast (WCAG AA 4.5:1, computed from the design tokens): dark theme `ink-4` 3.5 to 4.2 -> 4.8+ (`#8c8c97`); light theme `ink-3` 4.0 -> 5.3+, `ink-4` 2.2 -> 4.5+, accent blue 4.1 -> 5.9, green 2.5 -> 5.5, red 3.8 -> 6.5, gold and orange darkened. Light theme gets darker versions of the bright text colours (sky, emerald, orange, rose, amber) on white cards. `text-white/40` and `/35` -> `/60`; grey `zinc-500` and the AI key placeholder -> `zinc-400`; light-card screens (History, Progress, Photos) `slate-400` -> `slate-500`; Community buttons had white text on the blue button (2.5:1) -> dark text.
Font scale: the app already caps system font scale at 130% (`MainActivity`). Fixed-height controls that would clip a wrapping label now grow (`min-h`): shared buttons, Onboarding, Rest window, Friends challenge button, workout step badges; the Today card main action no longer cuts its subtitle with "...". Shared button sizes are now 40 to 56 px tall at least.
TalkBack: added labels to the icon-only buttons found by a scan (mute, show password, strain info, profile avatar, like, send comment, copy invite code, previous step, water +/- and month arrows, remove set); notification switches announce as on/off switches; small targets raised to 44 to 48 px.
Not changed: unused Workout Builder screen (not reachable in the app); light-card screens still look different from the dark app.
Checked by code only: nothing was run on a phone. See chat for what to check on a device.

## Batch 27 — Loading, empty and error states for every list
Shared kit in `src/components/ui/StateViews.tsx` (`SkeletonRows`, `SkeletonLines`, `SkeletonGrid`, `EmptyState`, `EmptyAction`, `ErrorState`). `src/lib/navEvents.ts` lets an empty state send the user to a main screen.
Fixed: Community feed (error had no retry and showed dev wording; empty had no action), post comments, reel comments, chat list, chat messages, follow requests, people search, Arena open matches, Arena ladder empty, Friends empty, Crew (a failed load was an endless skeleton), trending reels, hashtag feed, profile reels, Pro plans, moderation queue, public profile loading, Arena history loading, daily quests (endless skeleton).
Already complete before: friends board, league table, ladder error, profile reels error.
By design without a state: Live now (hidden when empty), reels feed (always has built-in reels), trophies (always shows locked trophies), blocked users (nothing to do), on-device lists need no loading or error.
Not tested on a device; the error states were only checked by reading the code (no way here to simulate a failed Firestore call).

## Batch 28 — Sign-in screen: Google first, funnel events, switchable gate
- Sign-in screen: "Beat friends, climb ranks" line above a 64px Google button (the largest control); the email Sign In / Create Account button is now an outlined 48px button so Google is the one primary action.
- Analytics: `signin_shown` (param `gate`: login-first, after-first-workout or optional), `signin_started` and `signin_completed` (param `method`: google, email, guest). No personal data. A Google sign-in that returns through the browser redirect (web only) is not counted as completed.
- Gate switch (`src/lib/flags.ts`): Firestore `appConfig/auth` field `gate` = `login-first` (default) or `after-first-workout`; build default via `VITE_AUTH_GATE`. Read once per launch from a cache so the screen never flips mid-session; a fetched change applies on the next launch. Rules: `appConfig/*` is public read, no client writes (deploy rules).
- In `after-first-workout` mode the intro and goal setup work signed out, and the gate appears once the first workout is logged (never during a workout). That first workout is stored on the phone but not sent to the server, so it earns no XP.
- Not tested on a device.

## Batch 29 — Exercise demo clip pipeline (Storage, lazy player, offline cache)
- `src/data/exerciseClips.ts`: one entry per exercise id (52 Academy + 21 that had no clip anywhere). File name contract: `<id>.mp4`, Storage path `exercise-demos/<id>.mp4`, 5-8 s, under 1,000,000 bytes, silent, H.264. Matching is exact (id, name, alias) only.
- `src/data/exerciseClips.generated.ts`: written by `npm run clips`; an id is only "ready" after its file passes the checks. Until then the bundled clip in `public/videos` keeps playing.
- `tools/clips.mjs` (`npm run clips`, `-- --migrate` copies existing bundled clips to the new names): checks size, length (reads the mp4 header), H.264, faststart; prints the missing list and the upload command.
- `src/components/ExerciseClip.tsx`: still image first, lazy (starts near screen, pauses off screen), offline copy, then direct Storage stream, then bundled clip, then retry (48dp). Reduced-motion users get a Play button. Used by `ExerciseThumb` (active workout) and the Academy detail view.
- `src/lib/clipCache.ts`: Cache Storage, 40 MB cap, least-recently-used eviction, stale-hash purge; next exercise's clip is prefetched in `ActiveWorkout` (skipped offline or with Data Saver).
- `storage.rules`: `exercise-demos/*` public read, no client write. `storage-cors.json` added (needed only for offline caching).
- BUG FIXED: `getExerciseVideo` no longer falls back to a fuzzy motion match (it played e.g. the Sumo Squat clip for Wide Push-ups and Bicep Curls for Prone Y Raises).
- BUG FOUND: Dead Bug has no file in `public/videos` (it never played).
- Not tested on a device; the cache and CORS path were not exercised.

## Batch 30 — Early-win XP (server only)
- Review: with the real server formulas a new user already gets Level 2 and the "First Rep" trophy in session 1. The gap was session 3 for people whose first three sessions cross a week boundary: no level-up, no trophy.
- `functions/src/index.ts` (`recordWorkout`): one-time bonus XP for a user's first three workouts, +90 / +80 / +70 (240 in total), decided by the server-side `totalWorkouts`. Response now includes `earlyBonus`. Level formula, ranks and trophies are unchanged (the app keeps its own copy of the level formula, so changing it would make levels differ between screens).
- Model (15-min workouts, week split): session 3 went from 735 XP / Level 3 / nothing to 975 XP / Level 4. Shortest sessions (5 min): 606 -> 846 XP, Level 3 -> 4. Sessions to reach Level 5/10/20 at 4 workouts a week: 5/24/107 -> 4/23/106.
- Known weakness, not new: every workout gives a flat 120 XP, so fake 1-minute workouts can farm XP and this bonus. The anti-cheat prompt (3.5) should cover it.
- Deploy: `firebase deploy --only functions`. Existing users with 3+ workouts get nothing.

## Batch 31 — Programs (roadmap 2.2)

**What:** 4–8 week training programs with a browse/start screen, per-week progress and a completion trophy.

- Data: `src/data/programs.ts` (Program → weeks → sessions → exercises, ids from the exercise list only). Two sample programs, both `status: "draft"` for a trainer to review: `beginner-foundations` (4 wks × 3) and `fat-loss-no-equipment` (6 wks × 4). Muscle and mobility have no program yet (the filter shows an empty state).
- Server (`functions/src/programs.ts`, `index.ts`, `progression.ts`): `startProgram` / `stopProgram`; `recordWorkout` credits a program session only if the claimed session equals the server count, one per day, minimum 5 minutes. Finishing sets `completedAt` and awards trophy `program_complete` ("Program Finisher"). No XP bonus for completion.
- Rules: `users/{uid}/program/{id}` read-own, write false; `programsDone` added to the server-key blocklists.
- App: `ProgramsView` (lazy, view `programs`), `src/lib/programs.ts`, TodayCard outlined entry row, trophy mirrored in `TROPHY_CATALOG`, events `program_started` / `program_completed`.
- Adding a program: edit `src/data/programs.ts` AND `PROGRAM_SHAPES` in `functions/src/programs.ts`, then `npm run programs:check`.

**Run:** `npm run programs:check`, `cd functions && npm run build`, `npx tsc --noEmit -p .`
**Deploy (at the end):** `firebase deploy --only firestore:rules,functions`
**Not tested:** on a device, rules in the emulator, or a real program run-through.

## Batch 32 — Voice coaching (roadmap 2.3)

- `src/lib/voiceCoach.ts` (new): on/off setting (`ap_voice_coach`, default OFF), `coachSay` (only when on), `coachSayNow` (tap-triggered lines), silent-phone check, audio ducking.
- Workout screen: a "Voice coaching" switch on the ready screen and a "Coach" button in the active header; the old "Voice" button is now "Sound" (it mutes chimes, music and voice together).
- Cues: exercise name + set + target at the start of each block; "Halfway there." for blocks of 20 s or more; 3-2-1 in the last 3 seconds of a block and of a rest; "Rest for N seconds. Next: X." at rest start; short finish line. Replay and the hype button still speak when tapped, even with coaching off.
- Native (`ApexNativePlugin.java`): `audioState()` reports ringer silent/vibrate (coach stays quiet; the switch shows a note); `voiceFocus({on})` requests transient audio focus that lets other apps duck, released after each line.
- Behaviour change: the old always-on narrator is gone. Everyone, including existing users, starts with coaching off.
- Rebuild the Android app (`npx cap sync android` then build) for the native part. Web builds speak through the browser and cannot detect silent mode.
- Not tested on a device: Android code has never been compiled here.

## Batch 33 — Warm-up and cool-down (roadmap 2.4)

- `src/lib/warmup.ts` (new): warm-up = Arm Circles, Standing Knee Raises, Cat-Cow Stretch; cool-down = Standing Chest & Shoulder Stretch, Standing Forward Fold, Child's Pose. 30 s each, one set, 10 s change-over.
- Added when the workout is played (ActiveWorkout), not saved into the workout. Only workouts with `wrap: true` get them: AI-generated (`AiGenerator`) and plan-built (`buildWorkoutFromPlan`). The 2-minute starter (`GoalSetup`), the easy restart, programs and hand-built workouts are unchanged.
- One-tap skip: "Skip warm-up" / "Skip cool-down" bar shows during those moves (active and rest screens). The ready screen has a "Warm-up and cool-down" switch (remembered; `ap_warmup_off`).
- The added moves count as time but not as "exercises completed" in the log. They add about 3 minutes (`totalDurationMinutes` + 3).
- Not tested on a device. No server change, no deploy.

## Batch 34 — Plan reason and 3-day outlook (roadmap 2.5)

- `functions/src/plan.ts`: the pick logic moved into `decide()` so it can run for today and for simulated days. `reason` is now one short line, e.g. "Upper body is rested, so push day." / "Legs are rested, so leg day."
- Pro: `planNext` returns the reason plus `upcoming` (next 3 days, assuming today's session is done and each pick is followed; the outlook never steps the level up).
- Free: `planNext` returns `{ locked: true, reason: <generic line> }`, no personal pick. Today card shows the generic line plus a Pro upsell ("tells you why, and shows your next 3 days").
- Today card: Pro sees the reason line and a 3-chip row (Tomorrow / weekday / weekday).
- Deploy: `cd functions && npm run build`, then `firebase deploy --only functions`. Not tested against real accounts; the outlook is a simple projection, not a promise.

## Batch 35 — Offline sessions and a safe report queue (roadmap 2.6)

- **Never paid twice (server):** `recordWorkout` now writes a receipt `users/{uid}/workoutReceipts/{sha1(workoutId)}` inside the same transaction and returns `duplicate: true` if it exists. Before, only the most recent workout id was remembered, so an older queued report retried after a newer one could be paid again. Receipts carry `expireAt` (45 days). Optional: in the Firebase Console add a TTL policy on collection group `workoutReceipts`, field `expireAt`. Clients cannot read or write receipts (no rule = denied).
- **Queue (app):** `src/lib/reportQueue.ts`. The report is saved on the phone first, then sent one at a time, oldest first. It leaves the queue only when the server answers (credited or duplicate) or refuses it for good (invalid-argument etc.). Retries: at launch/sign-in, when the connection returns, when the app comes back to the front, and after 65 s when the server says "slow down". Reports older than 3 days or beyond 20 are dropped (the server only accepts today ±1 day, so a workout finished more than about 2 days before reconnecting is not rewarded; it stays in the local history).
- **Rewards:** immediate results show as before; results of reports sent later show through the same celebration/notice. Offline finish shows "Saved on your phone. Rewards arrive when you're back online."
- **Program offline:** the program record is cached on the phone (`ap_prog_<uid>`), sessions finished offline count at once so the next offline session claims the right number, and the server stays the authority. Program data and exercise names are bundled, so the session itself needs no network. Starting or switching a program still needs a connection (inline error).
- **Clips:** the whole session's clips are fetched when the workout screen opens (online); the next two program sessions are fetched in the background from the Today card. Clips never fetched fall back to the bundled clip or still image.
- **Badge:** small "Offline · workout saves on this phone · N waiting to sync" pill in the workout screen (the app-wide amber bar still shows too).
- **Known limits:** two program sessions finished offline on the same day: the second still earns workout XP but not program credit (one program session per day). Not tested on a device or against real reconnects.
- **Deploy:** `cd functions && npm run build`, `firebase deploy --only functions`, then `npm run build` and `npx cap sync android`.

## Batch 36 — English + Hindi (roadmap 2.7)

- New `src/i18n/` layer (no library): `en.ts` is the source of truth (280 keys), `hi.ts` holds Hindi (missing key falls back to English), `index.ts` exposes `t()`, `useT()`, `tSplit()`, `useLang()`, `setLang()`.
- Language is stored on the device (`ap_lang`), default English (no auto-detect). Switch is on onboarding, sign-in and Settings > App.
- Converted: onboarding, goal setup, sign-in (incl. error messages), Today card, workout screen (ready, phases, active, finished), Arena title and tabs, Settings main page.
- Not converted (English): Privacy/Terms text, restore/delete-account/notification/blocked/moderation sub-screens, rest window, exercise names and tips, quest titles, plan reasons, league names, spoken voice cues, feeling labels, `wo.voiceNote` (defined, not yet shown).
- `npm run i18n:check` verifies keys, placeholders, unknown keys, and writes `HINDI_REVIEW.md` (15 lines flagged for a native speaker).
- No deploy needed. Only `tsc --noEmit` run; nothing tried on a device.

## Batch 37 — Ghost opponents (roadmap 3.1)

- Timelines: `arenaReport` now records when each rep happened (server clock, spread between reports) in `hostTl`/`guestTl` on the room. When a rated first-to-N, single-exercise match finishes, each player's best run for that setup is kept in `ghosts/{uid}_{key}` (server-only; rules deny all client access; owner uid never goes to a client). 60-day `expireAt`; account deletion removes the user's ghosts.
- Ghost duel (`arenaGhostMatch`): `peer` = recorded player nearest your rating (±200, widening to ±500, then any), skipping you and anyone blocked either way; `self` = your own best run; `auto` = peer, else a practice "Pacer". Opponent name is anonymous ("Swift Falcon"), no avatar. The ghost room is a normal room with `ghost: true` and the timeline; the phone plays it against the server's start time, the server settles the final score (`settleReps`).
- Rating: against a peer ghost the Elo change is half weight (`GHOST_WEIGHT = 0.5`); XP is half too. Your own run and the Pacer are unrated. Safeguards: at most 8 rated ghost matches per player per day, leaving a live ghost match is a loss, ghost wins do not count on the wins leaderboard or arena-win trophies.
- Quick match: after 8 s with no live opponent the app asks for a ghost. If a live opponent appeared in the meantime the server returns that room instead. If the ghost call fails the search just keeps waiting.
- Needs deploy: `firestore:rules`, `firestore:indexes` (new `ghosts` index key+rating; until it is built, peer ghosts are not found and quick match falls back to the Pacer), `functions`.
- Only first-to-N matches with one exercise make or use ghosts (what quick match offers). `npm run ghosts:check` tests the rules. Not run against the emulator or a device.

## Batch 38 — Daily global challenge (roadmap 3.2)

- Server (`functions/src/daily.ts`, rules in `dailyCore.ts`): one exercise per IST day from a pool of 10, picked from the date (same for everyone, never two days running). 60 seconds, 3 attempts a day, best counts.
- `dailyChallengeStart` records the start on the server clock; `dailyChallengeSubmit` refuses counts sent before 58 s or after 180 s, and counts above the exercise's rep-rate limit (e.g. push-ups 1.6/s => 99 max). A refused attempt is spent and counted (`rejected`) on `users/{uid}/daily/{day}`.
- Board: `dailyBoard/{day}/entries/{uid}` (server writes, signed-in users read), ordered by reps then earlier finish. App shows top 10 with "show all" up to 100, and your position. Fewer than 5 reps is not listed.
- XP: 75, once per day per user (flag on the user's daily doc, inside the same transaction). Banned users are refused.
- `dailyChallengeSweep` (00:40 IST) deletes boards older than 14 days; account deletion removes the user's entries.
- UI: `DailyChallenge` card at the top of Arena > Global. Taps only (no camera counting). Text is English only (not in the Hindi dictionary yet). Blocked users are not hidden on this board.
- Needs deploy: `firestore:rules`, `functions`. No new index. `npm run daily:check` tests the rules. Not run on emulator or device.

## Batch 39 — Weekly leagues finished (roadmap 3.3)

- Rules now live in `functions/src/leagueCore.ts` (mirrored for the screen in `src/lib/league.ts`): groups of up to 30, top 5 promoted, bottom 5 demoted. Was top 10 / bottom 5.
- Groups by rating: `joinLeague` fills groups per league and Arena-rating band (below 900, 900-1099, 1100-1299, 1300+). Players already grouped this week keep their group.
- Small groups move fewer places (under 15 players: about a third go up, 3 go down only from 10 players, none below that). No promotion with 0 XP. Bronze cannot go down, Diamond cannot go up.
- `leagueRollover` (Monday 00:05 IST) uses the shared rules and a fixed tie order (XP, then user id).
- League screen: time left ("Last day" in amber under 24 h), rule line, a status card ("120 XP to reach the top 5 and move up to Silver" / lead / demotion warning) with the primary button "Start a workout" and a secondary "play an Arena match".
- No push on promotion/demotion: the rollover runs inside quiet hours, so the existing Today card result is the notice.
- Needs deploy: `functions` only (no rules or index change). `npm run leagues:check` tests the rules. Not run on emulator or device.

## Batch 40 — Share cards (roadmap 3.4)

- Found already in the working tree when this prompt arrived (files changed 11:13-11:20 IST on 10 Nov by another session, not written in this one). Checked here: `tsc --noEmit` passes with it and `npm run share:check` passes.
- Cards are drawn on the phone (`src/lib/flexCard.ts`): app name, the result, three stat tiles, a QR code and "Free on Google Play" line. Arena win shows score, rating and rating change (reps and margin when the match was unrated). Level-up and streak cards exist too.
- Where: "Share this win" on the Arena result, "Share" on the level-up screen, "Share" on the streak/milestone banner on the dashboard.
- Link (`src/lib/shareLink.ts`): the https Play Store listing with a referrer code per card type (s_ar, s_lv, s_st, s_se, s_mi, s_ap), in the QR and in the shared message. Sharing goes through the native Android share sheet (`ApexNative.share`).
- Name: off by default. Printed only if the user ticks "Show my name on the card" in the share sheet (saved on the device). The opponent is never named.
- Nothing to deploy. Scanning the QR and the share sheet need a real phone to confirm.

## Batch 41 — Anti-cheat (roadmap 3.5)

- Per-exercise rep-rate limits (`functions/src/repLimits.ts`, 31 Arena exercises, default 2.5/s, never above 5/s). `arenaReport` cuts a count to the limit (as before, but per exercise and not counting the 3-2-1). A count more than 5 reps over the limit is a strike (once per player per match); that match is unrated and makes no ghost.
- Daily challenge: a "too fast" refusal is a strike.
- `cheatFlags/{uid}` (server-only): 3 strikes in 7 days, or 3 different players reporting cheating, sets `flagged`. Flagging never bans by itself.
- Reports: new type `match` (reason "Cheating or fake reps" and others) from "Report this match" on the Arena result. The server checks the reporter played that match and reads the other player from the room. Reels already had a report button.
- Admin: Settings > Moderation now has "Flagged accounts" (callables `modListFlagged`, `modReviewFlag`, ADMIN_EMAILS only): clear the flag or ban.
- Needs deploy: `firestore:rules`, `functions`. `npm run anticheat:check`. Limits are estimates for a trainer to review.
- What a determined cheater can still do: see the report for this batch (taps are not proof of a rep; a modified app can tap at just under the limit; second accounts; camera counting runs on the phone).

## Batch 42 — Moderation end to end (roadmap 3.6)

- Reports now also cover community posts and post comments (flag button on each; own content has no flag). 3 open reports hide a post until a moderator looks (reels already did this); the author cannot un-hide it (rules). Blocked users' posts and comments are filtered out of the community feed.
- Admin "Remove" works for reel, reel comment, post (with its photo and comments) and post comment, and closes the other open reports about the same thing.
- Clear message to the user: removal or ban writes a `moderation` notice to `notifs/{uid}/items`; the app shows it as a banner until "OK" (`ModerationGate` in App). A banned account sees a full-screen "Account disabled" with sign out; a disabled sign-in shows a clear error.
- Content policy page (`ContentPolicy.tsx`), linked from Settings > Terms section and from the sign-up form. English only; needs a legal read.
- Test: `npm run moderation:check` runs the real `moderation.ts` functions against an in-memory database (44 checks: report post/reel/comment/post comment/user/match, duplicates, daily limit, auto-hide, block, admin-only, remove, dismiss, ban, owner notices). It does not test the deployed rules or the screens.
- Needs deploy: `firestore:rules`, `functions`. Chat messages can be reported but not removed by a moderator (unchanged). No support email exists in the app yet; the messages point to the Play Store page.

## Batch 43 — Invite a friend (roadmap 3.7)

- Personal 7-character code per user (`inviteInfo`, stored in `inviteCodes/{CODE}`); card with copy/share and a "have a friend's code?" box in Arena > Friends (`InviteFriend.tsx`).
- `inviteRedeem`: only for an account with no workout yet, in its first 14 days, once, not your own code, and only with a device id.
- Reward: inside `recordWorkout`, on the invited account's first workout. Both get +1 streak freeze if they hold fewer than 2, and a badge ("Brought by a Friend" / "Recruiter"). One decision per invited account (`inviteDone`), paid or refused. An inviter is rewarded for at most 10 friends.
- Same device: the app sends a device id (Android `ANDROID_ID` through a new `ApexNative.deviceId` method; a random id in the browser or an old build); the server keeps only a hash in `devices/{hash}` with every account seen on it. If the invited person's device has ever had another account, nobody is rewarded.
- All invite fields on the user document are blocked for client writes in the rules; `inviteCodes` and `devices` are server-only.
- Needs deploy: `firestore:rules`, `functions`, and a new app build (Java change, not compiled here). `npm run invites:check`.
- Limits: a factory reset or a second phone gets round the device rule; the browser id is cleared with site data. The inviter is not notified by push; they see the count on the card and the new badge. Data safety form: declare "Device or other IDs" (hashed, fraud prevention).

## Batch 44 — Cost control (roadmap 3.8)

- "Live now" list: was a live listener on room documents that change on every rep (one read per change per viewer); now fetched every 20 s, 10 rooms at most, paused in the background.
- Shared listeners (`src/lib/sharedQuery.ts`): the XP/rating boards, league table, community board and Arena-wins board use one listener each, kept 60 s after the screen closes, so tab-hopping does not re-read 30 to 50 documents. Cleared on sign-out.
- Limits and paging: chat opens with the newest 50 messages (was 300) with "Earlier messages"; reel comments 40 (was 150) with "Older comments"; post comments newest 100 (was unlimited); community feed 30 (was 60) with "Load more"; open rooms 20 (was 40); daily board 10 live, 100 on request; follow links capped at 1,000 each way (was unlimited).
- Rep reports at most every 400 ms (was 250 ms).
- `COSTS.md` has the before/after table and the estimate per daily active user, with guesses marked. `npm run costs:check` fails on any collection query without a limit.
- Nothing to deploy (app only). An account with more than 1,000 followers or follows will see follow state only for the first 1,000.

## Batch 45 — Store listing, screenshot brief and demo mode (roadmap 4.1, 4.2)

- `launch/4.1-store-listing.md`: titles, short and full description, 5 captions, English and Hindi (Hindi needs native review). Lengths counted by script.
- Hindi: "reps" is no longer transliterated as रेप्स (reads as an offensive word); the two app strings now use बार and are in the review list.
- `launch/4.2-screenshots-and-icon.md`: 8 screenshots, 2 icon directions, capture steps.
- Demo mode (`src/lib/demo.ts`): on only with `VITE_DEMO_MODE=1` at build time, or `?demo=1` on the dev server. Sample identity, progress, plan, quests, league, boards, daily challenge and one scripted Arena match; every server call is answered from the file or refused; no Firebase listeners for those screens. Reels, community, chat, crew, friends and programs are not covered.
- `npm run demo:check` fails if `.env` still has `VITE_DEMO_MODE=1`. Demo screens were not looked at (the app cannot be run here).

## Batch 46 — Rating prompt and Play declarations (roadmap 4.3, 4.4)

- Rating prompt: after the level-up screen closes for a level-up or a finished program week, never in the first 3 days of an install, at most once per 60 days (`src/lib/review.ts`). The sheet offers "Rate on Google Play" (Play in-app review through a new `ApexNative.requestReview`, Play library added to `build.gradle`), "Send private feedback" (`sendFeedback` function, `feedback` collection, server-only, 5 a day) and "Not now".
- It does not ask "do you like the app?" first. Google's in-app review rules forbid an opinion question before the rating card, so both choices are offered side by side instead of sending only unhappy users to feedback.
- Needs deploy: `firestore:rules`, `firestore:indexes` (feedback uid+at), `functions`, new app build (Java and Gradle change, not compiled here). `npm run review:check`.
- `launch/4.4-play-console-declarations.md`: Data safety answers, Health Connect wording, subscription checklist, and 12 mismatches between the code and what would be declared (privacy text about camera and tracking, no privacy URL, no web deletion page, AD_ID, body measurements in Cloud Sync).

## Batch 47 — Billing test plan and paywall tuning (roadmap 4.5, 4.6)

- `launch/4.5-billing-test.md`: setup, 12 test steps with what to check in Firestore and the logs, a failure table, and 10 checks before `BILLING_ENABLED=true`.
- Paywall is offered only after 3 finished workouts (`paywallUnlocked`): every entry point goes through one check; before that the AI generator is not locked and the Today card shows no Pro prompt.
- Paywall sheet: yearly plan first and pre-selected with "Best value · save N%" (worked out from Play's prices, shown only when it is real), per-month price, free-trial line and button when the Play offer has a trial, one "Continue" button, a full-size "Restore purchases" button, and a line that Arena and social are free. All prices come from Google Play in the user's currency; none are written in the app.
- `ApexBillingPlugin.getProducts` now also returns the trial period, price in micros and currency (Java, not compiled here).
- Fixes found on the way: "Restore purchases" reported failure whenever billing was not enforced, and a verified subscriber could be shown the plans again; both now go by a verified, unexpired `proUntil`. First perk reworded to what Pro really adds.
- Needs a new app build. `npm run paywall:check`.

## Batch 48 — Rollout plan and launch review (roadmap 4.8, 4.9)

- `launch/4.8-rollout-plan.md`: step 0 (internal and closed testing), 5% for 3 days, 20% for 4 days, 100%, with gates (crash, ANR, sign-in, first workout, retention, rating, cost), which numbers are Play's limits and which are guesses, and what to do when a gate fails.
- `launch/4.9-launch-review.md`: tsc and functions build pass, all 13 check scripts pass, standing rules held. Verdict: no-go for production today, go for an internal-testing build. 9 blockers (Android never compiled, nothing run on a device, nothing deployed, no privacy URL, no deletion page, privacy text does not match the code, signing, Play forms, closed-test rule) and 9 should-fix items.
- 4.7 (listing in two more languages) is waiting for the two languages.
- No code change in this batch.

## Batch 49 — First phone test fixes (10 Nov video)

- Workout demo: the gym photo no longer shows before the demo clip. While the clip loads the box is a plain light panel with a spinner; the clip's first frame shows as soon as it is decoded, so a paused workout shows the real demo frozen (before, a paused workout kept the photo and a spinner forever). The photo is only used if the clip cannot load at all. (`ExerciseClip.tsx`)
- Workout header: the "02 / 07" counter no longer wraps onto two lines; on narrow phones the Sound and Coach buttons show icons only so "End" and "Coach" are not cut off. (`ActiveWorkout.tsx`)
- Feed: liking a sample reel while signed in now sticks (it was sent to the server for a reel that only exists on the phone, then reset to 0 when the card was redrawn). (`ReelsFeedView.tsx`)
- App only: `npm run build`, `npx cap sync android`, run again. Checked with `tsc --noEmit` only.

## Batch 50 — Structure, speed, invite links, Arena in the centre, reel studio (11 Nov video)

**Structure**
- `src/components` (75 files) and `src/lib` (70 files) are sorted into `src/app`, `src/core`, `src/shared` and ten `src/features/*` folders. 168 files renamed, imports rewritten by `tools/restructure.py`; old-to-new list in `tools/restructure-map.json`; rules in `ARCHITECTURE.md`. No logic changed by the move. `lib/duelVideo.ts` became `features/arena/useDuelVideo.ts` (it clashed with `DuelVideo.tsx` on Windows).
- `npm run arch:check`: every relative import exists with exact upper/lower case, and the layers only point one way (app -> features -> shared -> core). Currently 0 problems.
- Older notes in this file use the old paths; look them up in `tools/restructure-map.json`.
- Deleting is blocked for me in this folder, so the empty old folders and one stray copy were parked in `_to_delete/`. Delete that folder.

**Speed**
- Firestore now keeps its data on the phone (`persistentLocalCache`): lists draw from the saved copy at once, then update.
- Remembered server answers (`core/callCache.ts`): today's plan, daily challenge, league group, invite card show the last answer immediately and refresh behind it. Cleared on sign-out.
- First bundle is smaller: the workout player, analytics drawer, command palette, personalise flow, level-up screen and tour load on first use; Arena, the player and the other tabs are warmed one at a time from 1.2 s after launch (was 3.5 s, all at once).
- `index.html`: the Google font no longer blocks the first paint; a static launch screen (logo + bar) shows before any code runs.
- Bottom bar no longer uses a blur (repainted on every scroll frame).
- Not measured: none of this was timed on a phone.

**Invite links**
- Shares used to attach the Render address, which opened the old web app. Now every share links to `/join` on the server: a small page with "Open in the Apex Pulse app", "Get the app on Google Play" and the code. Crew, match-room and friend-invite shares carry the code (`/join?crew=CODE`, `?room=`, `?invite=`).
- The app opens those links (`core/deepLink.ts`): crew code is filled in on Arena > Crew, friend code on Arena > Friends, a match code joins the room. Kept for a day so it survives sign-in on a new install.
- Android: `apexpulse://join` (used by the page's button) and an https App Link for the Render host. For the link to open the app directly with no browser page, set `ANDROID_CERT_SHA256` on Render (see below). Until then the landing page shows and the button opens the app.
- Needs: `git push` (Render must serve `/join`), and a new app build (manifest change, not compiled here).

**Screens**
- Bottom bar: Arena is the raised centre button; order is Train, Feed, Arena, Coach, Profile.
- Reel studio: drawn above the bottom bar, full screen on a phone, with a large "Share reel" button at the bottom and Back to close. (It was under the bar because it was drawn inside the animated screen.) The profile's reel viewer had the same layer problem.

Checked with `tsc --noEmit`, the 13 check scripts and `arch:check`. `npm run build` (Vite) cannot be run here: run it first.
