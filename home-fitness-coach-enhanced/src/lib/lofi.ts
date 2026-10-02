/**
 * A tiny generative lo-fi ambience engine — soft evolving pad chords, a
 * warm sub-bass pulse and a gentle filtered vinyl-crackle bed, all built
 * from oscillators/noise buffers via the Web Audio API rather than a
 * streamed or bundled audio file.
 *
 * Why generated instead of a real track: the compiled Android/iOS app has
 * no network access to a streaming service, and bundling licensed music
 * into the APK isn't something this project can do safely. A procedural
 * ambience keeps this fully offline, free of any licensing question, and
 * — because it's generated, not looped — it never has an audible "seam"
 * the way a short looping mp3 would.
 *
 * Four moods give a bit of variety across challenges/workouts without
 * pretending to be four different licensed tracks — same gentle
 * lo-fi character throughout, matched to the existing chime library's
 * volume and tone so nothing here ever competes with the Vocal Coach.
 */

export type LofiMood = "chill" | "midnight" | "sunrise" | "deep-focus" | "morning";

export const LOFI_MOODS: { id: LofiMood; label: string; description: string }[] = [
  { id: "chill", label: "Chill Lo-fi", description: "Warm keys, soft vinyl crackle" },
  { id: "midnight", label: "Midnight", description: "Slow, deep and mellow" },
  { id: "sunrise", label: "Sunrise", description: "Bright, gentle and hopeful" },
  { id: "deep-focus", label: "Deep Focus", description: "Minimal drone, steady pulse" },
  { id: "morning", label: "Morning Energy", description: "Jolly, upbeat refresh — the workout mood" },
];

interface MoodConfig {
  /** Chord root frequencies (Hz), one chord per bar, looping. */
  chords: number[][];
  barMs: number;
  waveform: OscillatorType;
  padGain: number;
  bassGain: number;
  noiseGain: number;
  filterHz: number;
  /** When set, adds a steady rhythmic pulse (a soft kick-like thump this
   *  many times per bar) — what turns an ambient pad into something that
   *  actually feels like an upbeat "song" rather than a drone. */
  beatsPerBar?: number;
  beatGain?: number;
}

const MOOD_CONFIG: Record<LofiMood, MoodConfig> = {
  chill: {
    // Cmaj7 → Am7 → Fmaj7 → G7, a familiar warm lo-fi progression.
    chords: [
      [261.63, 329.63, 392.0, 493.88],
      [220.0, 261.63, 329.63, 392.0],
      [174.61, 220.0, 261.63, 349.23],
      [196.0, 246.94, 293.66, 349.23],
    ],
    barMs: 4200,
    waveform: "sine",
    padGain: 0.42,
    bassGain: 0.42,
    noiseGain: 0.06,
    filterHz: 1400,
  },
  midnight: {
    // Slower, lower and darker — Am7 → Dm7 → Gmaj7 → Cmaj7.
    chords: [
      [220.0, 261.63, 329.63, 392.0],
      [146.83, 174.61, 220.0, 261.63],
      [196.0, 246.94, 293.66, 369.99],
      [130.81, 164.81, 196.0, 246.94],
    ],
    barMs: 5200,
    waveform: "sine",
    padGain: 0.32,
    bassGain: 0.36,
    noiseGain: 0.05,
    filterHz: 1000,
  },
  sunrise: {
    // Brighter major-key movement — Fmaj7 → G → Cmaj7 → Am7.
    chords: [
      [174.61, 220.0, 261.63, 349.23],
      [196.0, 246.94, 293.66, 392.0],
      [261.63, 329.63, 392.0, 493.88],
      [220.0, 261.63, 329.63, 392.0],
    ],
    barMs: 3800,
    waveform: "triangle",
    padGain: 0.32,
    bassGain: 0.3,
    noiseGain: 0.04,
    filterHz: 1800,
  },
  "deep-focus": {
    // A single sustained-feeling drone with the smallest possible motion.
    chords: [
      [130.81, 196.0, 261.63],
      [130.81, 196.0, 261.63],
      [146.83, 220.0, 293.66],
      [146.83, 220.0, 293.66],
    ],
    barMs: 6000,
    waveform: "sine",
    padGain: 0.28,
    bassGain: 0.32,
    noiseGain: 0.04,
    filterHz: 900,
  },
  morning: {
    // Bright, jolly major-key movement — Cmaj → G → Am → F, at a peppier
    // tempo than the ambient moods, plus a steady soft kick pulse. This is
    // the one mood built to feel like an actual upbeat "song" rather than
    // a background pad — used specifically during exercise.
    chords: [
      [261.63, 329.63, 392.0],
      [196.0, 246.94, 293.66],
      [220.0, 261.63, 329.63],
      [174.61, 220.0, 261.63],
    ],
    barMs: 2200,
    waveform: "triangle",
    padGain: 0.34,
    bassGain: 0.36,
    noiseGain: 0.03,
    filterHz: 2400,
    beatsPerBar: 4,
    beatGain: 0.4,
  },
};

/** Deterministically picks a mood from a challenge/workout id so the same
 *  program always gets the same ambience, and different programs get
 *  audibly different ones, without needing per-challenge configuration. */
export function pickMoodForChallenge(id: string | undefined | null): LofiMood {
  const moods = LOFI_MOODS.map(m => m.id);
  if (!id) return moods[0];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return moods[hash % moods.length];
}

class LofiEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  // A limiter sitting after the master gain — it lets the volume be pushed
  // much louder (raising the *average* level) without the harsh digital
  // clipping/crackling that would otherwise kick in once several oscillators
  // peak at the same instant. This is what "louder" safely means past a
  // certain point, rather than just raising gain values further.
  private limiter: DynamicsCompressorNode | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;
  private schedulerTimer: ReturnType<typeof setTimeout> | null = null;
  private activeOscillators: OscillatorNode[] = [];
  private playing = false;
  private currentMood: LofiMood = "chill";
  private volume = 0.32;
  private barIndex = 0;

  private initContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  private makeNoiseBuffer(ctx: AudioContext) {
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  private playChord(ctx: AudioContext, freqs: number[], config: MoodConfig, durationMs: number) {
    if (!this.master) return;
    const now = ctx.currentTime;
    const dur = durationMs / 1000;
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = config.waveform;
      osc.frequency.setValueAtTime(freq, now);
      // Each note fades gently in and back out — no hard onset/offset
      // "click", which is what makes a generated pad sound synthetic.
      const g = i === 0 ? config.bassGain : config.padGain / freqs.length;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(g, now + dur * 0.35);
      gain.gain.linearRampToValueAtTime(g * 0.7, now + dur * 0.75);
      gain.gain.linearRampToValueAtTime(0, now + dur);
      osc.connect(gain);
      gain.connect(this.master!);
      osc.start(now);
      osc.stop(now + dur + 0.05);
      this.activeOscillators.push(osc);
      osc.onended = () => {
        this.activeOscillators = this.activeOscillators.filter(o => o !== osc);
      };
    });
  }

  /** A short, soft kick-like thump — the rhythmic pulse that makes the
   *  "morning" mood read as an actual upbeat song rather than a pad. */
  private playBeatPulse(ctx: AudioContext, gain: number, atTime: number) {
    if (!this.master) return;
    const kick = ctx.createOscillator();
    const kickGain = ctx.createGain();
    kick.type = "sine";
    kick.frequency.setValueAtTime(150, atTime);
    kick.frequency.exponentialRampToValueAtTime(48, atTime + 0.14);
    kickGain.gain.setValueAtTime(gain, atTime);
    kickGain.gain.exponentialRampToValueAtTime(0.001, atTime + 0.16);
    kick.connect(kickGain);
    kickGain.connect(this.master);
    kick.start(atTime);
    kick.stop(atTime + 0.18);
  }

  private scheduleLoop(config: MoodConfig) {
    if (!this.ctx || !this.playing) return;
    const chord = config.chords[this.barIndex % config.chords.length];
    this.playChord(this.ctx, chord, config, config.barMs);
    if (config.beatsPerBar && config.beatGain) {
      const beatInterval = config.barMs / config.beatsPerBar / 1000;
      for (let i = 0; i < config.beatsPerBar; i++) {
        this.playBeatPulse(this.ctx, config.beatGain, this.ctx.currentTime + i * beatInterval);
      }
    }
    this.barIndex++;
    this.schedulerTimer = setTimeout(() => this.scheduleLoop(config), config.barMs * 0.98);
  }

  private startNoiseBed(config: MoodConfig) {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = this.makeNoiseBuffer(ctx);
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = config.filterHz;

    const gain = ctx.createGain();
    gain.gain.value = config.noiseGain;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
    this.noiseSource = source;
  }

  public play(mood: LofiMood = this.currentMood) {
    this.stop();
    this.currentMood = mood;
    const ctx = this.initContext();
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -18;
    this.limiter.knee.value = 8;
    this.limiter.ratio.value = 16;
    this.limiter.attack.value = 0.002;
    this.limiter.release.value = 0.2;
    this.master.connect(this.limiter);
    this.limiter.connect(ctx.destination);
    this.playing = true;
    this.barIndex = 0;
    const config = MOOD_CONFIG[mood];
    this.scheduleLoop(config);
    this.startNoiseBed(config);
  }

  public stop() {
    this.playing = false;
    if (this.schedulerTimer) {
      clearTimeout(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    if (this.noiseSource) {
      try { this.noiseSource.stop(); } catch {}
      this.noiseSource = null;
    }
    this.activeOscillators.forEach(o => { try { o.stop(); } catch {} });
    this.activeOscillators = [];
    if (this.master) {
      try { this.master.disconnect(); } catch {}
      this.master = null;
    }
    if (this.limiter) {
      try { this.limiter.disconnect(); } catch {}
      this.limiter = null;
    }
  }

  public setMood(mood: LofiMood) {
    if (mood === this.currentMood && this.playing) return;
    const wasPlaying = this.playing;
    this.stop();
    this.currentMood = mood;
    if (wasPlaying) this.play(mood);
  }

  public setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master && this.ctx) {
      this.master.gain.linearRampToValueAtTime(this.volume, this.ctx.currentTime + 0.3);
    }
  }

  public getVolume() {
    return this.volume;
  }

  public isPlaying() {
    return this.playing;
  }

  public getMood() {
    return this.currentMood;
  }
}

export const lofi = new LofiEngine();
