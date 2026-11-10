# Firestore read costs (roadmap 3.8, 10 Nov 2026)

How many documents the app reads, per screen and per daily active user (DAU), before and after Batch 44.
"Limit" columns are facts read from the code. Everything in the "per day" estimate that depends on how people
use the app is a guess, and is marked.

## Per screen (facts: the most documents one open can read)

| Screen | Before | After | What changed |
|---|---|---|---|
| App start (profile, trophies, matches, quests, blocks, follows, inbox, chats list) | no cap on follows | follows capped at 1,000 each way | cap only; typical cost unchanged |
| Arena > Global: XP / rating board | 50 on every open | 50, then free for 60 s after leaving | shared listener |
| Arena > Global: daily board | 100 live | 10 live, 100 only on "Show top 100" | smaller default |
| Arena > League | 30 on every open | 30, then free for 60 s after leaving | shared listener |
| Arena > Play: "Live now" list | 20 + 1 read for every rep in every listed match, for every viewer | at most 10 every 20 s | polling instead of a live listener |
| Arena > Play: open rooms | 40 | 20 | lower limit |
| A match (each player) | 1 per rep report from either player | same; reports at most every 400 ms (was 250 ms) | only matters when tapping faster than 2.5 a second |
| Chat thread | up to 300 per open | 50, +100 per "Earlier messages" | newest first |
| Reel comments | up to 150 | 40, +80 per "Older comments" | paged |
| Community post comments | no limit | newest 100 | limit |
| Community feed | 60 | 30, +30 per "Load more" | paged |
| Community / Arena-wins boards | 50 / 25 on every open | same, free for 60 s after leaving | shared listener |
| Reels feed | 40 public + 40 followers | unchanged | not touched |

## Per DAU per day (estimate)

Usage assumed for one active user in a day. **All of these are guesses**: 2 app starts; Global tab 2 times;
League 2 times; Play tab open 2 minutes; 1 Arena match of 20 reps each; 2 chat threads with 80 messages of
history; 2 comment sheets with 20 comments; half a visit to the community feed; 1 visit to reels.

| Part | Before | After | Guess or fact |
|---|---|---|---|
| 2 app starts (about 70 each) | 140 | 142 | 70 is a guess (depends on trophies, follows, inbox size) |
| Global tab | 100 + 200 (daily board) | 50 to 100 + 20 | limits are facts, visit count is a guess |
| League | 60 | 30 to 60 | same |
| "Live now" with 3 public matches running | about 1,080 | about 18 | **biggest guess**: 0 when nobody is playing in public |
| Open rooms | 15 | 15 | guess |
| 1 match | about 50 | about 50 | reps are a guess |
| 2 chat threads | 160 | 100 | history length is a guess |
| Comments, community, reels | 150 | 135 | guess |
| **Total, public matches running** | **about 1,950** | **about 600** | |
| **Total, no public matches running** | **about 870** | **about 580** | |

So: roughly a third fewer reads in a quiet app, and about a third of the old number when public matches are
running, because the "Live now" list was the one place where cost grew with other people's activity.

Money, for scale only (prices are from memory and vary by region; check the Firebase pricing page): the free
tier is 50,000 reads a day, which at 600 reads is about 80 DAU. Beyond that reads cost on the order of
$0.03 to $0.06 per 100,000, so 1,000 DAU at 600 reads a day is well under $1 a day.

## Not fixed here (what to watch next)

- **Cloud Function calls in a match.** Every rep report is one function call and one transaction. A 20-rep
  match is about 40 calls. This will reach the free 2 million calls a month long before reads cost anything.
- **Reels.** The feed listens to up to 80 documents, and older reels keep their media as document chunks in
  Firestore, which are read each time such a reel is played. Not measured.
- **No offline cache.** Firestore runs with the in-memory cache, so every app start reads everything again.
  Turning on the persistent cache would cut repeat reads but changes start-up behaviour; not done without a device test.
- **Avatars are stored inside user documents** as images. That does not add reads, but every leaderboard row downloads one.
- `npm run costs:check` fails the build check if someone adds a collection query without a limit.
