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

  public playTick() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(800, this.ctx.currentTime); // High tick sound

      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.1);
    } catch (e) {
      console.warn("Audio Context failed to play tick", e);
    }
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
  private pickVoiceIndex(voices: VoiceLike[], gender?: SpeakGender): number | undefined {
    if (!voices.length) return undefined;
    const english = voices.filter(v => v.lang?.toLowerCase().startsWith("en"));
    const pool = english.length ? english : voices;

    const MALE_HINTS = [/\bdavid\b/i, /\bmark\b/i, /\bguy\b/i, /\bdaniel\b/i, /\balex\b/i, /\bfred\b/i, /\baaron\b/i, /\bryan\b/i, /\boliver\b/i, /\bgeorge\b/i, /\bthomas\b/i, /\bmale\b/i, /\barthur\b/i, /\beddy\b/i];
    const FEMALE_HINTS = [/\bzira\b/i, /\bsamantha\b/i, /\bvictoria\b/i, /\bkaren\b/i, /\bsusan\b/i, /\baria\b/i, /\bfiona\b/i, /\bmoira\b/i, /\btessa\b/i, /\bfemale\b/i, /\bkate\b/i, /\bserena\b/i, /google us english/i];

    const hints = gender === "male" ? MALE_HINTS : gender === "female" ? FEMALE_HINTS : [];
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
      opts?.onEnd?.();
    } catch (e) {
      console.warn("Text-to-speech failed", e);
      this.speaking = false;
      opts?.onEnd?.();
    }
  }

  public stopSpeaking() {
    this.speaking = false;
    TextToSpeech.stop().catch(() => {});
  }

  public isSpeaking(): boolean {
    return this.speaking;
  }
}

export const audio = new SoundSynthesizer();
