# Home Fitness Coach — Premium Build

A clean-start React/Vite home fitness app with a locally activated Premium mode, an expanded animated exercise library, multi-week programs, an achievements system, a wellness toolkit, and a full dark mode.

## What's included

- **Fresh install, zero records.** No pre-filled profile, workouts, history, favorites or water log. A versioned local marker guarantees this build starts empty even if it's replacing an older copy.
- **Premium activated by default**, with a Basic/Premium switch in the top bar and inside the Hub. Every screen shows a clear "Premium activated" / "Basic version" indicator.
- **32 premium coaching modules** covering adaptive plans, readiness, warm-up/cool-down, form coaching, smart rest, PRs, insights, habits, reminders, quick workouts, mobility, nutrition prompts, sleep mode, safety guardrails, coach voice, roadmaps, programs, exercise academy, favorites, calendar, recovery, notes, offline-first UI, accessibility, the BMI/TDEE toolkit, the water tracker, the breathing timer and the achievement badge system.
- **39-exercise animated local motion-demo library** (Exercise Academy) — every movement has a looping original SVG/CSS motion graphic, tempo, key coaching cues, common mistakes, a category filter, search, and a persisted Favorites list. No remote video or image assets are required.
- **The Hub** — a five-tab command center reached from the bottom nav:
  - **Overview** — the original premium feature grid, coach controls and membership card.
  - **Toolkit** — a box-breathing timer, a daily water tracker (resets at midnight), and a BMI + TDEE/calorie calculator (Mifflin-St Jeor) that saves to your local profile.
  - **Programs** — four real multi-week programs (Foundation Builder, Strength Surge, Cardio Kickstart, Mobility Reset). Every day launches an actual workout — nothing is a placeholder.
  - **Badges** — 24 achievements computed purely from your real logged activity (streaks, totals, favorites, exercise variety, time-of-day). Everything starts locked.
  - **Calendar** — a monthly view of the days you actually logged a workout.
- **Dark mode** — a persistent light/dark toggle in the top bar, applied consistently across every screen.
- **Onboarding walkthrough** on first launch explaining Premium activation and what's inside, dismissible and shown only once.
- **Confetti + achievement toasts** on finishing a workout, plus an in-app toast whenever a new badge unlocks.
- Existing AI workout generator and active-workout flow retained. AI generation still requires the server-side Gemini API configuration.
- Progress tracker never seeds fake/mock activity — analytics stay empty until you log a session.
- Reset All Data returns the app to a completely empty profile (including favorites and the water log).

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Production build

```bash
npm run build
```

## Capacitor / Android APK

After the web build succeeds:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init
npx cap add android
npx cap sync android
npx cap open android
```

Then build the APK/AAB in Android Studio.

### Important

The Premium switch in this build is a product-mode switch, not a real payment system. For a production paid subscription, connect Google Play Billing for Android and App Store subscriptions for iOS, then validate entitlements on a backend. The membership pricing card in the Hub is a demo UI only — no payment is ever processed by this build.

The exercise demos are motion graphics, not licensed real-person video footage. Replace them with licensed video assets if you need photoreal human demonstrations.

The BMI/TDEE calculator provides estimates only (not medical advice) and stores the numbers you enter locally on your device.
