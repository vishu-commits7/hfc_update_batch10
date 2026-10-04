// Social Feed, Creators, Comments & Live Challenges Engine

export interface Creator {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  verified: boolean;
  bio: string;
  followers: number;
  following: number;
  postsCount: number;
  tier: string;
  ratingElo: number;
  specialtyExercise: string;
  targetMuscle: string;
  scientificFocus: string;
  reels: string[];
}

export interface ReelComment {
  id: string;
  reelId: string;
  authorName: string;
  authorHandle: string;
  authorAvatar: string;
  text: string;
  createdAt: string;
  likes: number;
  isLiked?: boolean;
}

export interface CreatorReel {
  id: string;
  creatorId: string;
  type: "video" | "photo";
  mediaUrl: string;
  thumbnailUrl?: string;
  caption: string;
  badge: string;
  musicTrack: string;
  publishedDate: string;
  isRecent: boolean;
  views: string;
  likes: number;
  shares: number;
  exerciseChallenge: {
    exerciseName: string;
    targetReps: number;
    timeLimitSeconds: number;
    targetMuscle: string;
    scientificMetric: string;
    biologicalMechanism: string;
    videoDemoUrl?: string;
  };
}

const CREATORS_INIT: Creator[] = [
  {
    id: "c_marcus",
    name: "Marcus Vance",
    handle: "@iron_marcus",
    avatar: "/assets/coaches/coach-upper-male.jpg",
    verified: true,
    bio: "IFBB Pro & Biomechanics Coach. Specializing in chest moment arm overload & kinetic chain power.",
    followers: 0,
    following: 0,
    postsCount: 4,
    tier: "Master Instructor",
    ratingElo: 1600,
    specialtyExercise: "Classic Push-ups",
    targetMuscle: "Pectoralis Major & Triceps Brachii",
    scientificFocus: "Sternocostal motor unit recruitment under eccentric loading",
    reels: ["r_marcus_1", "r_marcus_2", "r_marcus_old1", "r_marcus_old2"],
  },
  {
    id: "c_chloe",
    name: "Chloe Thorne",
    handle: "@chloe_flex",
    avatar: "/assets/coaches/coach-female-flex.jpg",
    verified: true,
    bio: "Calisthenics Champion & Exercise Physiologist. Pushing human power-to-weight ratios to peak velocity.",
    followers: 0,
    following: 0,
    postsCount: 3,
    tier: "Master Instructor",
    ratingElo: 1600,
    specialtyExercise: "Jump Squats",
    targetMuscle: "Quadriceps & Gluteus Maximus",
    scientificFocus: "Stretch-shortening cycle & elastic recoil optimization in knee extensors",
    reels: ["r_chloe_1", "r_chloe_2", "r_chloe_old1"],
  },
  {
    id: "c_viktor",
    name: "Viktor Steele",
    handle: "@steele_physique",
    avatar: "/assets/coaches/coach-beast-male.jpg",
    verified: true,
    bio: "Olympic Conditioning Coach. High-intensity hypertrophy & isometric tendon stiffness specialist.",
    followers: 0,
    following: 0,
    postsCount: 2,
    tier: "Master Instructor",
    ratingElo: 1600,
    specialtyExercise: "Diamond Push-ups",
    targetMuscle: "Medial Triceps & Sternum Pectorals",
    scientificFocus: "Narrow base moment arm shifting peak joint torque directly to triceps leverage",
    reels: ["r_viktor_1", "r_viktor_old1"],
  },
  {
    id: "c_elena",
    name: "Elena Rostova",
    handle: "@elena_mobility",
    avatar: "/assets/coaches/coach-flex-towel.jpg",
    verified: true,
    bio: "Neuromuscular & Core Dynamics Researcher. Unlocking spinal decompression and core stability.",
    followers: 0,
    following: 0,
    postsCount: 2,
    tier: "Master Instructor",
    ratingElo: 1600,
    specialtyExercise: "Mountain Climbers",
    targetMuscle: "Rectus Abdominis & Hip Flexors",
    scientificFocus: "High cadence cardiopulmonary VO2 surge paired with anti-rotation spinal stability",
    reels: ["r_elena_1", "r_elena_old1"],
  },
];

const REELS_INIT: CreatorReel[] = [
  {
    id: "r_marcus_1",
    creatorId: "c_marcus",
    type: "video",
    mediaUrl: "/videos/Classic pushup.mp4",
    thumbnailUrl: "/assets/ui/gym-beast-chalk.jpg",
    caption: "45-second Pushup Challenge: Locked in on 90° elbow depth and zero hip sag.",
    badge: "⚡ TECHNIQUE DRILL",
    musicTrack: "Phonk Apex 808 - Heavy Drift",
    publishedDate: "Oct 3, 2026",
    isRecent: true,
    views: "0",
    likes: 0,
    shares: 0,
    exerciseChallenge: {
      exerciseName: "Classic Push-ups",
      targetReps: 35,
      timeLimitSeconds: 45,
      targetMuscle: "Sternocostal Pectorals & Triceps",
      scientificMetric: "~64% BW Load · 2-0-2 Cadence",
      biologicalMechanism: "Triggers rapid motor unit recruitment across fast-twitch Type IIx pectoralis fibers.",
      videoDemoUrl: "/videos/Classic pushup.mp4",
    },
  },
  {
    id: "r_chloe_1",
    creatorId: "c_chloe",
    type: "video",
    mediaUrl: "/videos/jumpsquat.mp4",
    thumbnailUrl: "/assets/ui/gym-beast-squat.jpg",
    caption: "Explosive triple extension jump squats! Maximum vertical impulse on every repetition.",
    badge: "🔥 APEX POWER TEST",
    musicTrack: "Hypertrophy Beats - Nitro Kick",
    publishedDate: "Oct 2, 2026",
    isRecent: true,
    views: "0",
    likes: 0,
    shares: 0,
    exerciseChallenge: {
      exerciseName: "Jump Squats",
      targetReps: 30,
      timeLimitSeconds: 45,
      targetMuscle: "Quadriceps, Glutes & Gastrocnemius",
      scientificMetric: "3.2x Ground Reaction Force · 1-0-1 Cadence",
      biologicalMechanism: "Maximizes neuromuscular rate of force development (RFD) and kinetic tendon rebound.",
      videoDemoUrl: "/videos/jumpsquat.mp4",
    },
  },
  {
    id: "r_viktor_1",
    creatorId: "c_viktor",
    type: "video",
    mediaUrl: "/videos/Diamond Push-ups.mp4",
    thumbnailUrl: "/assets/ui/gym-beast-iron.jpg",
    caption: "Narrow diamond base push-ups isolate triceps leverage with strict eccentric control.",
    badge: "⚔️ TECHNIQUE DRILL",
    musicTrack: "Hardstyle Savage Horns",
    publishedDate: "Oct 1, 2026",
    isRecent: true,
    views: "0",
    likes: 0,
    shares: 0,
    exerciseChallenge: {
      exerciseName: "Diamond Push-ups",
      targetReps: 25,
      timeLimitSeconds: 45,
      targetMuscle: "Triceps Brachii & Medial Pecs",
      scientificMetric: "~75% BW Load · Narrow Moment Arm",
      biologicalMechanism: "Minimizes pec moment arm to direct 78% shear load straight through medial triceps.",
      videoDemoUrl: "/videos/Diamond Push-ups.mp4",
    },
  },
  {
    id: "r_elena_1",
    creatorId: "c_elena",
    type: "video",
    mediaUrl: "/videos/Mountain Climbers.mp4",
    thumbnailUrl: "/assets/ui/gym-beast-abs.jpg",
    caption: "Sprint climbers at full tempo! Keep hips neutral while driving knees forward.",
    badge: "⚡ CARDIO CORE SPRINT",
    musicTrack: "Cyberpunk Industrial Pulse",
    publishedDate: "Sep 30, 2026",
    isRecent: true,
    views: "0",
    likes: 0,
    shares: 0,
    exerciseChallenge: {
      exerciseName: "Mountain Climbers",
      targetReps: 45,
      timeLimitSeconds: 30,
      targetMuscle: "Rectus Abdominis & Ilio-Psoas",
      scientificMetric: "120 bpm cadence · Anti-rotational trunk stability",
      biologicalMechanism: "Dynamic hip flexor cycling demands intense isometric co-contraction of anterior core.",
      videoDemoUrl: "/videos/Mountain Climbers.mp4",
    },
  },
  // --- OLD REELS (Vault) ---
  {
    id: "r_marcus_old1",
    creatorId: "c_marcus",
    type: "video",
    mediaUrl: "/videos/Incline Push-ups.mp4",
    thumbnailUrl: "/assets/coaches/coach-upper-male.jpg",
    caption: "Foundations of chest activation: Incline tempo press for glenohumeral safety. From the archive.",
    badge: "🏛️ VAULT ARCHIVE",
    musicTrack: "Lo-Fi Instrumental Drift",
    publishedDate: "Aug 15, 2026",
    isRecent: false,
    views: "0",
    likes: 0,
    shares: 0,
    exerciseChallenge: {
      exerciseName: "Incline Push-up",
      targetReps: 30,
      timeLimitSeconds: 45,
      targetMuscle: "Lower Pectorals & Triceps",
      scientificMetric: "~45% BW Load · Low Shear",
      biologicalMechanism: "Elevated trunk angle reduces glenohumeral shear while priming neuromuscular firing patterns.",
      videoDemoUrl: "/videos/Incline Push-ups.mp4",
    },
  },
  {
    id: "r_marcus_old2",
    creatorId: "c_marcus",
    type: "photo",
    mediaUrl: "/assets/ui/gym-daily-motivation.jpg",
    caption: "The secret to 50 unbroken pushups is posterior pelvic tilt and diaphragm breathing rhythm.",
    badge: "💡 MASTERCLASS",
    musicTrack: "Deep Motivation Synth",
    publishedDate: "Jul 22, 2026",
    isRecent: false,
    views: "0",
    likes: 0,
    shares: 0,
    exerciseChallenge: {
      exerciseName: "Classic Push-ups",
      targetReps: 40,
      timeLimitSeconds: 60,
      targetMuscle: "Chest & Shoulders",
      scientificMetric: "Endurance Threshold",
      biologicalMechanism: "Tests aerobic lactic clearance inside upper body musculature.",
      videoDemoUrl: "/videos/Classic pushup.mp4",
    },
  },
  {
    id: "r_chloe_old1",
    creatorId: "c_chloe",
    type: "video",
    mediaUrl: "/videos/Reverse Lunges.mp4",
    thumbnailUrl: "/assets/coaches/coach-female-flex.jpg",
    caption: "Single-leg knee alignment drill: Eliminating valgus collapse during reverse lunges.",
    badge: "🏛️ VAULT ARCHIVE",
    musicTrack: "Chillwave Atmospheric",
    publishedDate: "Aug 29, 2026",
    isRecent: false,
    views: "0",
    likes: 0,
    shares: 0,
    exerciseChallenge: {
      exerciseName: "Reverse Lunges",
      targetReps: 24,
      timeLimitSeconds: 45,
      targetMuscle: "Glutes & Hamstrings",
      scientificMetric: "Unilateral Knee Stability",
      biologicalMechanism: "Focuses eccentric load on the gluteus medius and stabilizes patellar tracking.",
      videoDemoUrl: "/videos/Reverse Lunges.mp4",
    },
  },
  {
    id: "r_viktor_old1",
    creatorId: "c_viktor",
    type: "video",
    mediaUrl: "/videos/pikepushup.mp4",
    thumbnailUrl: "/assets/coaches/coach-beast-male.jpg",
    caption: "Pike press inversion: The holy grail for building bulletproof boulder deltoids without weights.",
    badge: "🏛️ VAULT ARCHIVE",
    musicTrack: "Heavy Metal Industrial",
    publishedDate: "Sep 04, 2026",
    isRecent: false,
    views: "0",
    likes: 0,
    shares: 0,
    exerciseChallenge: {
      exerciseName: "Pike Push-ups",
      targetReps: 20,
      timeLimitSeconds: 45,
      targetMuscle: "Anterior Deltoids & Serratus",
      scientificMetric: "~80% BW Axial Load",
      biologicalMechanism: "Vertical angle directs gravity vector directly through anterior deltoid motor units.",
      videoDemoUrl: "/videos/pikepushup.mp4",
    },
  },
  {
    id: "r_elena_old1",
    creatorId: "c_elena",
    type: "video",
    mediaUrl: "/videos/Forearm plank.mp4",
    thumbnailUrl: "/assets/coaches/coach-ironcore.jpg",
    caption: "Unbroken hollow body plank hold. Glutes contracted, scapulae protracted. Biomechanics 101.",
    badge: "🏛️ VAULT ARCHIVE",
    musicTrack: "Ambient Meditation Bass",
    publishedDate: "Aug 10, 2026",
    isRecent: false,
    views: "0",
    likes: 0,
    shares: 0,
    exerciseChallenge: {
      exerciseName: "Forearm Plank",
      targetReps: 60,
      timeLimitSeconds: 60,
      targetMuscle: "Transverse Abdominis & Rectus",
      scientificMetric: "100% Isometric Core Stiffness",
      biologicalMechanism: "Trains deep transverse abdominis co-activation for intra-abdominal pressure stabilization.",
      videoDemoUrl: "/videos/Forearm plank.mp4",
    },
  },
];

// Authentic real comments store — user comments persist in localStorage
const COMMENTS_INIT: Record<string, ReelComment[]> = {};

const FOLLOWING_KEY = "kinetic_following_creators";
const COMMENTS_KEY = "kinetic_reel_comments_authentic_v3";

const LIKED_REELS_KEY = "kinetic_liked_reels";

export function getLikedReelIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(LIKED_REELS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch {}
  return new Set();
}

export function isReelLiked(reelId: string): boolean {
  return getLikedReelIds().has(reelId);
}

export function toggleLikeReel(reelId: string): boolean {
  if (typeof window === "undefined") return false;
  const current = getLikedReelIds();
  let nextState = false;
  if (current.has(reelId)) {
    current.delete(reelId);
    nextState = false;
  } else {
    current.add(reelId);
    nextState = true;
  }
  try {
    localStorage.setItem(LIKED_REELS_KEY, JSON.stringify(Array.from(current)));
    window.dispatchEvent(new CustomEvent("kinetic_reel_like_change", { detail: { reelId, liked: nextState } }));
  } catch {}
  return nextState;
}

export function getCreators(): Creator[] {
  const following = getFollowingCreatorIds();
  return CREATORS_INIT.map((c) => ({
    ...c,
    followers: following.has(c.id) ? 1 : 0,
  }));
}

export function getCreatorById(id: string): Creator | undefined {
  const creators = getCreators();
  return creators.find((c) => c.id === id);
}

export function getAllFeedReels(): CreatorReel[] {
  const liked = getLikedReelIds();
  const baseReels = REELS_INIT.map((r) => ({
    ...r,
    likes: liked.has(r.id) ? 1 : 0,
  }));

  // Also include user-created posts if any
  if (typeof window !== "undefined") {
    try {
      const userReelsRaw = localStorage.getItem("kinetic_user_reels");
      if (userReelsRaw) {
        const userReels = JSON.parse(userReelsRaw);
        if (Array.isArray(userReels)) {
          return [...userReels, ...baseReels];
        }
      }
    } catch {}
  }
  return baseReels;
}

export function getReelsForCreator(creatorId: string): { newReels: CreatorReel[]; oldReels: CreatorReel[] } {
  const all = getAllFeedReels().filter((r) => r.creatorId === creatorId);
  return {
    newReels: all.filter((r) => r.isRecent),
    oldReels: all.filter((r) => !r.isRecent),
  };
}

export function getFollowingCreatorIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(FOLLOWING_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch {}
  return new Set();
}

export function isFollowingCreator(creatorId: string): boolean {
  return getFollowingCreatorIds().has(creatorId);
}

export function toggleFollowCreator(creatorId: string): boolean {
  if (typeof window === "undefined") return false;
  const current = getFollowingCreatorIds();
  let nextState = false;
  if (current.has(creatorId)) {
    current.delete(creatorId);
    nextState = false;
  } else {
    current.add(creatorId);
    nextState = true;
  }
  try {
    localStorage.setItem(FOLLOWING_KEY, JSON.stringify(Array.from(current)));
    window.dispatchEvent(new CustomEvent("kinetic_social_follow_change", { detail: { creatorId, following: nextState } }));
  } catch {}
  return nextState;
}

export function getCommentsForReel(reelId: string): ReelComment[] {
  if (typeof window === "undefined") return COMMENTS_INIT[reelId] || [];
  try {
    const raw = localStorage.getItem(COMMENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed[reelId]) return parsed[reelId];
    }
  } catch {}
  return COMMENTS_INIT[reelId] || [];
}

export function addCommentToReel(
  reelId: string,
  text: string,
  author = { name: "Apex Athlete", handle: "@athlete_pro", avatar: "/assets/coaches/coach-beast-male.jpg" }
): ReelComment {
  const currentComments = getCommentsForReel(reelId);
  const newComment: ReelComment = {
    id: `comm_${Date.now()}`,
    reelId,
    authorName: author.name,
    authorHandle: author.handle,
    authorAvatar: author.avatar,
    text: text.trim(),
    createdAt: "Just now",
    likes: 0,
    isLiked: false,
  };

  const nextList = [newComment, ...currentComments];
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(COMMENTS_KEY);
      const all = raw ? JSON.parse(raw) : { ...COMMENTS_INIT };
      all[reelId] = nextList;
      localStorage.setItem(COMMENTS_KEY, JSON.stringify(all));
      window.dispatchEvent(new CustomEvent("kinetic_comment_added", { detail: { reelId, count: nextList.length } }));
    } catch {}
  }
  return newComment;
}

export function toggleLikeComment(reelId: string, commentId: string): ReelComment[] {
  const current = getCommentsForReel(reelId);
  const updated = current.map((c) => {
    if (c.id === commentId) {
      const isLiked = !c.isLiked;
      return {
        ...c,
        isLiked,
        likes: isLiked ? c.likes + 1 : Math.max(0, c.likes - 1),
      };
    }
    return c;
  });

  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(COMMENTS_KEY);
      const all = raw ? JSON.parse(raw) : { ...COMMENTS_INIT };
      all[reelId] = updated;
      localStorage.setItem(COMMENTS_KEY, JSON.stringify(all));
    } catch {}
  }
  return updated;
}
