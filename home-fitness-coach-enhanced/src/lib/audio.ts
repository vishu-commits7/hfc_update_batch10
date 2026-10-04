/**
 * Web Audio API synthesizer for home workout chimes and sound effects, plus
 * a Text-to-Speech "Vocal Coach" narrator.
 *
 * The narrator goes through the `@capacitor-community/text-to-speech` plugin
 * rather than calling `window.speechSynthesis` directly. That one change is
 * what makes voice-over actually audible on a real installed Android app:
 * inside a plain Capacitor WebView, `window.speechSynthesis` frequently has
 * zero registered voices and silently does nothing (there is no bundled
 * browser TTS engine in a WebView the way there is in real Chrome). This
 * plugin instead calls the phone's own on-device Android TextToSpeech
 * engine natively, which is reliably present because it's what powers
 * TalkBack/Google Assistant/etc. system-wide. On a plain web build (running
 * this app in an actual browser tab) the same plugin transparently falls
 * back to `window.speechSynthesis` under the hood, so behavior there is
 * unchanged.
 */
import { TextToSpeech, QueueStrategy } from "@capacitor-community/text-to-speech";
import { lofiMusic } from "./lofiMusic";

export type SpeakGender = "male" | "female" | "neutral";

interface VoiceLike {
  name: string;
  lang: string;
}

class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private speaking = false;

  // Supported voices rarely change mid-session, so fetch once and reuse —
  // avoids an extra native round-trip before every single narration line.
  private voiceCache: VoiceLike[] | null = null;
  private voiceCachePromise: Promise<VoiceLike[]> | null = null;

  private initContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    return this.isMuted;
  }

  /**
   * Crisp athletic stopwatch countdown tick for the final 5 seconds (5, 4, 3, 2, 1)
   */
  public playCountdownTick(secondsRemaining: number) {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const isFinal = secondsRemaining === 1;

      // Primary impulse click (woodblock/stopwatch snap)
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = "sine";
      osc.frequency.setValueAtTime(isFinal ? 1350 : 1000, now);
      osc.frequency.exponentialRampToValueAtTime(isFinal ? 850 : 600, now + 0.04);

      filter.type = "bandpass";
      filter.frequency.value = isFinal ? 1200 : 900;
      filter.Q.value = 3.0;

      gain.gain.setValueAtTime(isFinal ? 0.22 : 0.16, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.06);
    } catch (e) {
      console.warn("Audio Context failed to play countdown tick", e);
    }
  }

  /**
   * Resonant start bell (boxing/fitness gym bell chime) at the beginning of each exercise
   */
  public playExerciseStartBell() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      // Resonant fundamental E5 (659.25 Hz) with natural metallic overtone partials
      const partials = [
        { freq: 659.25, gain: 0.26, decay: 1.8 },
        { freq: 1318.5, gain: 0.14, decay: 1.3 },
        { freq: 1977.75, gain: 0.08, decay: 0.9 },
        { freq: 2637.0, gain: 0.04, decay: 0.5 },
      ];

      partials.forEach((p) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(p.freq, now);

        gain.gain.setValueAtTime(p.gain, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + p.decay);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + p.decay + 0.05);
      });
    } catch (e) {
      console.warn("Audio Context failed to play exercise start bell", e);
    }
  }

  /**
   * Resonant completion bell (double chime) at the end of each exercise before recovery
   */
  public playExerciseEndBell() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      // Double completion chime: G5 (783.99 Hz) then C6 (1046.5 Hz)
      const strikes = [
        { time: now, freq: 783.99, gain: 0.22 },
        { time: now + 0.2, freq: 1046.5, gain: 0.24 },
      ];

      strikes.forEach((s) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(s.freq, s.time);

        gain.gain.setValueAtTime(s.gain, s.time);
        gain.gain.exponentialRampToValueAtTime(0.0001, s.time + 1.4);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(s.time);
        osc.stop(s.time + 1.5);
      });
    } catch (e) {
      console.warn("Audio Context failed to play exercise end bell", e);
    }
  }

  public playTick() {
    this.playCountdownTick(3);
  }

  public playStartChime() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 (Sleek startup major chord)

      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.1 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.5);
      });
    } catch (e) {
      console.warn("Audio Context failed to play start chime", e);
    }
  }

  public playRestStart() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, this.ctx.currentTime); // D5 mellow note

      gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.4);
    } catch (e) {
      console.warn("Audio Context failed to play rest chime", e);
    }
  }

  public playSuccessChime() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const chord = [523.25, 659.25, 783.99]; // C Major

      // Let's make an arpeggio ending on a happy high C note
      chord.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.1, now + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.6);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.7);
      });

      // Play final high tone a bit louder
      setTimeout(() => {
        if (!this.ctx || this.isMuted) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(1046.50, this.ctx.currentTime); // C6
        gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.8);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.9);
      }, 250);

    } catch (e) {
      console.warn("Audio Context failed to play success chime", e);
    }
  }

  /**
   * Powerful beast bass drop / sub-bass hit for duel starts, hype moments and victory
   */
  public playBeastDrop() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.6);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.75);
    } catch (e) {
      console.warn("Audio Context failed to play beast drop", e);
    }
  }

  /**
   * Resonant energy fanfare for duel victories, PRs, and motivational achievements
   */
  public playBeastHypeFanfare() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      // Energetic heroic interval: D4, A4, D5, F#5
      const notes = [293.66, 440.00, 587.33, 739.99];

      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, now + idx * 0.09);

        // Lowpass to give it a warm brass/synth synthwave punch
        const filter = this.ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1800, now + idx * 0.09);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.09 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.55);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + idx * 0.09);
        osc.stop(now + idx * 0.09 + 0.6);
      });
    } catch (e) {
      console.warn("Audio Context failed to play beast hype fanfare", e);
    }
  }

  /**
   * Crisp athletic click for rep counters and story progress
   */
  public playBeastClick() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.03);

      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch (e) {
      console.warn("Audio Context failed to play beast click", e);
    }
  }

  private async getVoices(): Promise<VoiceLike[]> {
    if (this.voiceCache) return this.voiceCache;
    if (!this.voiceCachePromise) {
      this.voiceCachePromise = TextToSpeech.getSupportedVoices()
        .then(r => {
          this.voiceCache = r.voices || [];
          return this.voiceCache;
        })
        .catch(() => {
          this.voiceCache = [];
          return [];
        });
    }
    return this.voiceCachePromise;
  }

  /**
   * Picks a voice *index* matching the requested gender. Voice *gender* is
   * as far as this can honestly go — no TTS engine exposes race as a voice
   * trait, so the black/white model toggle stays purely visual and only
   * gender (male/female) ever changes the narrator. Matches common voice
   * names across desktop browsers (David/Zira/Samantha/...) as well as the
   * "female_1"/"male_2"-style names Android's on-device engine uses; falls
   * back to a pitch shift on whatever voice is available so the two genders
   * are always at least audibly distinct, even on a device with only one
   * installed voice.
   */
  private pickVoiceIndex(voices: VoiceLike[], _gender?: SpeakGender): number | undefined {
    if (!voices.length) return undefined;
    const english = voices.filter(v => v.lang?.toLowerCase().startsWith("en"));
    const pool = english.length ? english : voices;

    const MALE_HINTS = [/\bdavid\b/i, /\bmark\b/i, /\bguy\b/i, /\bdaniel\b/i, /\balex\b/i, /\bfred\b/i, /\baaron\b/i, /\bryan\b/i, /\boliver\b/i, /\bgeorge\b/i, /\bthomas\b/i, /\bmale\b/i, /\barthur\b/i, /\beddy\b/i];
    const hints = MALE_HINTS;
    for (const h of hints) {
      const match = pool.find(v => h.test(v.name));
      if (match) return voices.indexOf(match);
    }
    // No gendered name matched (common on some Android/Linux setups) — fall
    // back to the same "premium sounding" pick as before, or just voice 0.
    const premium = pool.find(v => /Google|Natural|Trainer/.test(v.name)) || pool[0];
    return premium ? voices.indexOf(premium) : undefined;
  }

  public async speak(text: string, opts?: { gender?: SpeakGender; onStart?: () => void; onEnd?: () => void }) {
    if (this.isMuted) return;
    try {
      await TextToSpeech.stop();
      const voices = await this.getVoices();
      const gender = opts?.gender;
      const voiceIndex = this.pickVoiceIndex(voices, gender);
      // Friendly pitch nudge in the gendered direction — audible even when
      // no gendered voice name is found and the device only ships one voice.
      const pitch = gender === "male" ? 0.92 : gender === "female" ? 1.12 : 1.02;

      this.speaking = true;
      lofiMusic.duck(true);
      opts?.onStart?.();
      await TextToSpeech.speak({
        text,
        lang: "en-US",
        rate: 1.0,
        pitch,
        volume: 1.0,
        voice: voiceIndex,
        queueStrategy: QueueStrategy.Flush,
      });
      this.speaking = false;
      lofiMusic.duck(false);
      opts?.onEnd?.();
    } catch (e) {
      console.warn("Text-to-speech failed", e);
      this.speaking = false;
      lofiMusic.duck(false);
      opts?.onEnd?.();
    }
  }

  public stopSpeaking() {
    this.speaking = false;
    lofiMusic.duck(false);
    TextToSpeech.stop().catch(() => {});
  }

  public isSpeaking(): boolean {
    return this.speaking;
  }
}

export const audio = new SoundSynthesizer();
