/**
 * Procedural AI Lofi Music Synthesizer
 *
 * Generates continuous, soothing & cinematic lofi tracks using the Web Audio API:
 * 1. Warm electric piano (Rhodes-style chords with analog tape vibrato)
 * 2. Cinematic atmospheric pads with slow attack and shimmering warmth
 * 3. Deep sub-basslines following chord roots
 * 4. Vinyl crackle & warm tape saturation for authentic vintage texture
 * 5. Motivational chillhop beat (kick, rimshot, hi-hat) in cinematic workout mode
 *
 * Supports zero-latency native audio, auto-ducking during TTS coach speech,
 * and a small play/pause toggle for in-app controls.
 */

import { getSharedAudioContext } from "./audio";

export type LofiMode = "soothing" | "cinematic";

interface LofiState {
  isPlaying: boolean;
  mode: LofiMode;
  volume: number;
}

type StateListener = (state: LofiState) => void;

class LofiMusicEngine {
  private ctx: AudioContext | null = null;
  private isPlaying: boolean = false;
  private mode: LofiMode = "soothing";
  private baseVolume: number = 0.5;
  /**
   * The synthesized notes peak around 0.02-0.09 each, so at the old 0.26
   * master level the music sat roughly 40 dB down and was effectively
   * inaudible even with the phone at full volume. The boost brings the mix
   * to a normal listening level; the compressor below keeps stacked chords
   * from clipping.
   */
  private readonly boost: number = 3.6;
  private compressor: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;
  private isDucked: boolean = false;
  private timerId: number | null = null;
  private vinylNode: AudioBufferSourceNode | null = null;
  private vinylBuffer: AudioBuffer | null = null;
  private hiHatBuffer: AudioBuffer | null = null;
  private listeners: Set<StateListener> = new Set();

  // Musical sequences
  private step: number = 0;

  // Cinematic motivational progression (Am9 -> Fmaj9 -> Cmaj9 -> G6/B)
  private readonly cinematicChords = [
    { name: "Am9", bass: 55.0, notes: [220.0, 261.63, 329.63, 392.0, 493.88] }, // A1 bass, A3, C4, E4, G4, B4
    { name: "Fmaj9", bass: 43.65, notes: [174.61, 261.63, 329.63, 392.0, 440.0] }, // F1 bass, F3, C4, E4, G4, A4
    { name: "Cmaj9", bass: 65.41, notes: [261.63, 329.63, 392.0, 493.88, 587.33] }, // C2 bass, C4, E4, G4, B4, D5
    { name: "G6/B", bass: 61.74, notes: [246.94, 293.66, 392.0, 493.88, 659.25] }, // B1 bass, B3, D4, G4, B4, E5
  ];

  // Soothing ambient progression (Dm9 -> G13 -> Cmaj9 -> Am9)
  private readonly soothingChords = [
    { name: "Dm9", bass: 73.42, notes: [146.83, 220.0, 261.63, 329.63, 392.0] }, // D2 bass, D3, A3, C4, E4, G4
    { name: "G13", bass: 49.0, notes: [196.0, 246.94, 293.66, 329.63, 440.0] }, // G1 bass, G3, B3, D4, E4, A4
    { name: "Cmaj9", bass: 65.41, notes: [130.81, 261.63, 329.63, 392.0, 493.88] }, // C2 bass, C3, C4, E4, G4, B4
    { name: "Am9", bass: 55.0, notes: [164.81, 220.0, 261.63, 329.63, 392.0] }, // A1 bass, E3, A3, C4, E4, G4
  ];

  constructor() {
    if (typeof window !== "undefined") {
      const savedMute = localStorage.getItem("kinetic_lofi_music_muted");
      if (savedMute === "true") {
        this.isPlaying = false;
      }
    }
  }

  private initAudio() {
    if (!this.ctx) {
      this.ctx = getSharedAudioContext();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    if (!this.masterGain && this.ctx) {
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.baseVolume * this.boost, this.ctx.currentTime);
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -18;
      this.compressor.knee.value = 24;
      this.compressor.ratio.value = 6;
      this.compressor.attack.value = 0.01;
      this.compressor.release.value = 0.25;
      this.masterGain.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);
    }
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((l) => l(state));
  }

  public getState(): LofiState {
    return {
      isPlaying: this.isPlaying,
      mode: this.mode,
      volume: this.baseVolume,
    };
  }

  public setMode(mode: LofiMode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.notify();
  }

  public setVolume(vol: number) {
    this.baseVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx && !this.isDucked) {
      this.masterGain.gain.setTargetAtTime(this.baseVolume * this.boost, this.ctx.currentTime, 0.1);
    }
    this.notify();
  }

  public duck(ducked: boolean) {
    this.isDucked = ducked;
    if (!this.masterGain || !this.ctx) return;
    const targetGain = (ducked ? 0.07 : this.baseVolume) * this.boost;
    this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.15);
  }

  public toggle(): boolean {
    if (this.isPlaying) {
      this.pause();
    } else {
      // An explicit tap on the music button always wins over the global
      // "coach voice muted" flag — otherwise the button silently did nothing.
      this.play(undefined, true);
    }
    return this.isPlaying;
  }

  public play(mode?: LofiMode, force: boolean = false) {
    if (!force && typeof localStorage !== "undefined" && localStorage.getItem("kinetic_sound_muted") === "true") {
      this.isPlaying = false;
      return;
    }
    if (mode) this.mode = mode;
    this.initAudio();
    if (!this.ctx || !this.masterGain) return;

    if (this.isPlaying) {
      this.notify();
      return;
    }

    this.isPlaying = true;
    localStorage.setItem("kinetic_lofi_music_muted", "false");
    this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.masterGain.gain.setValueAtTime(this.baseVolume * this.boost, this.ctx.currentTime);
    this.notify();

    // Android WebView starts the context suspended until a gesture resumes
    // it. Scheduling notes against a frozen clock is what produced silence,
    // so only start the sequencer once the context is actually running.
    const ctx = this.ctx;
    const begin = () => {
      if (!this.isPlaying) return;
      this.startVinylCrackle();
      this.startSequencer();
    };
    if (ctx.state === "running") {
      begin();
    } else {
      ctx.resume().then(begin).catch(begin);
    }
  }

  public pause(immediate: boolean = false) {
    if (!this.isPlaying) {
      if (immediate && this.masterGain && this.ctx) {
        this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
      }
      return;
    }
    this.isPlaying = false;
    localStorage.setItem("kinetic_lofi_music_muted", "true");

    if (this.masterGain && this.ctx) {
      if (immediate) {
        this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
      } else {
        this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.15);
      }
    }

    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }

    this.stopVinylCrackle();
    // The context is shared with the coach voice and chimes, so it must not
    // be suspended here — silencing the gain is enough.
    this.notify();
  }

  /**
   * Generates a vintage vinyl crackle buffer for authentic lofi warmth (cached in memory)
   */
  private startVinylCrackle() {
    if (!this.ctx || !this.masterGain || this.vinylNode) return;
    try {
      if (!this.vinylBuffer) {
        const bufferSize = this.ctx.sampleRate * 4;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        // Warm pink noise with occasional tiny dust pops
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          let pink = b0 + b1 + b2 + white * 0.5362;

          // Random subtle crackle pop
          if (Math.random() < 0.0006) {
            pink += (Math.random() - 0.5) * 4.5;
          }

          data[i] = pink * 0.008; // very soft and cozy
        }
        this.vinylBuffer = buffer;
      }

      const source = this.ctx.createBufferSource();
      source.buffer = this.vinylBuffer;
      source.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 2800;

      const gain = this.ctx.createGain();
      gain.gain.value = 0.25;

      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      source.start();
      this.vinylNode = source;
    } catch {
      // Fallback gracefully if buffer generation fails
    }
  }

  private stopVinylCrackle() {
    if (this.vinylNode) {
      try {
        this.vinylNode.stop();
        this.vinylNode.disconnect();
      } catch {}
      this.vinylNode = null;
    }
  }

  /**
   * Sequencer loop that plays the evolving chords and beats
   */
  private startSequencer() {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
    }

    // Step duration: 2.2 seconds per measure/bar
    this.step = 0;
    this.playNextBar();

    this.timerId = window.setInterval(() => {
      this.step++;
      this.playNextBar();
    }, 2400);
  }

  private playNextBar() {
    if (!this.ctx || !this.masterGain || !this.isPlaying) return;

    const isCinematic = this.mode === "cinematic";
    const chordList = isCinematic ? this.cinematicChords : this.soothingChords;
    const chord = chordList[this.step % chordList.length];
    const now = this.ctx.currentTime;

    // 1. Play Electric Piano (Rhodes) Chord
    this.playRhodesChord(chord.notes, now, isCinematic ? 2.6 : 3.2);

    // 2. Play Warm Sub-Bass
    this.playSubBass(chord.bass, now, 2.2);

    // 3. Play Atmospheric Cinematic Pad
    this.playCinematicPad(chord.notes, now, 2.8);

    // 4. In Cinematic Workout mode: play lofi chillhop drum groove
    if (isCinematic) {
      this.playChillhopGroove(now);
    }
  }

  /**
   * Synthesizes warm electric piano chords with gentle tape chorus
   */
  private playRhodesChord(frequencies: number[], startTime: number, duration: number) {
    if (!this.ctx || !this.masterGain) return;

    frequencies.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const noteDelay = idx * 0.035; // Gentle strum
      const noteStart = startTime + noteDelay;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, noteStart);

      // Lowpass warmth
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(1400, noteStart);
      filter.frequency.exponentialRampToValueAtTime(800, noteStart + duration);

      // Dynamic envelope with smooth initial attack
      gain.gain.setValueAtTime(0, noteStart);
      gain.gain.linearRampToValueAtTime(0.045, noteStart + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, noteStart + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.onended = () => {
        try {
          osc.disconnect();
          filter.disconnect();
          gain.disconnect();
        } catch {}
      };

      osc.start(noteStart);
      osc.stop(noteStart + duration + 0.1);
    });
  }

  /**
   * Synthesizes warm sub-bass
   */
  private playSubBass(frequency: number, startTime: number, duration: number) {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(frequency, startTime);

    filter.type = "lowpass";
    filter.frequency.value = 180; // Pure deep low-end

    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.08, startTime + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.onended = () => {
      try {
        osc.disconnect();
        filter.disconnect();
        gain.disconnect();
      } catch {}
    };

    osc.start(startTime);
    osc.stop(startTime + duration + 0.1);
  }

  /**
   * Shimmering cinematic pad with slow atmospheric attack
   */
  private playCinematicPad(frequencies: number[], startTime: number, duration: number) {
    if (!this.ctx || !this.masterGain) return;

    // Pick top 3 notes for atmospheric pad wash
    const topNotes = frequencies.slice(1, 4);

    topNotes.forEach((freq) => {
      if (!this.ctx || !this.masterGain) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq * 0.5, startTime); // One octave down for body

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(550, startTime);
      filter.Q.value = 1.2;

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.022, startTime + 0.8);
      gain.gain.linearRampToValueAtTime(0.015, startTime + duration - 0.5);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration + 0.4);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.onended = () => {
        try {
          osc.disconnect();
          filter.disconnect();
          gain.disconnect();
        } catch {}
      };

      osc.start(startTime);
      osc.stop(startTime + duration + 0.5);
    });
  }

  /**
   * Chillhop groove for motivational workout mode (Kick, Rimshot, Hi-hats)
   */
  private playChillhopGroove(startTime: number) {
    if (!this.ctx || !this.masterGain) return;

    const beatInterval = 2.4 / 4; // 4 beats per bar

    // Beat 1: Kick
    this.playKick(startTime);

    // Beat 1.75: Ghost Kick
    this.playKick(startTime + beatInterval * 1.5, 0.04);

    // Beat 2: Rimshot / Soft Snare
    this.playRimshot(startTime + beatInterval);

    // Beat 3: Kick
    this.playKick(startTime + beatInterval * 2);

    // Beat 4: Rimshot
    this.playRimshot(startTime + beatInterval * 3);

    // 8th-note Hi-hats
    for (let i = 0; i < 8; i++) {
      const hiHatTime = startTime + i * (beatInterval / 2) + (i % 2 === 1 ? 0.025 : 0); // Subtle swing
      this.playHiHat(hiHatTime, i % 2 === 0 ? 0.018 : 0.01);
    }
  }

  private playKick(time: number, vol = 0.09) {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(130, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);

    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {}
    };

    osc.start(time);
    osc.stop(time + 0.18);
  }

  private playRimshot(time: number) {
    if (!this.ctx || !this.masterGain) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(260, time);

    gain.gain.setValueAtTime(0.045, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {}
    };

    osc.start(time);
    osc.stop(time + 0.1);
  }

  private playHiHat(time: number, vol = 0.015) {
    if (!this.ctx || !this.masterGain) return;

    if (!this.hiHatBuffer) {
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.04);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
      }
      this.hiHatBuffer = buffer;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = this.hiHatBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 6500;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    source.onended = () => {
      try {
        source.disconnect();
        filter.disconnect();
        gain.disconnect();
      } catch {}
    };

    source.start(time);
    source.stop(time + 0.05);
  }
}

export const lofiMusic = new LofiMusicEngine();
