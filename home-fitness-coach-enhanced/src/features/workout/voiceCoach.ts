import { useEffect, useState } from "react";
import { audio } from "../../core/audio";
import { ApexNative, isNative } from "../../core/nativeBridge";

/**
 * Optional spoken coaching during a workout (countdowns, next move, halfway, rest prompts).
 * - OFF until the person turns it on; the choice is remembered.
 * - Silent when the phone's ringer is on silent or vibrate (Android). A browser cannot tell, so it speaks.
 * - Other apps' audio is ducked (asked to lower) only while a line is being spoken.
 * Speech itself is done by audio.speak (on-device text-to-speech).
 */
const KEY = "ap_voice_coach";
const listeners = new Set<(on: boolean) => void>();

export function readVoiceCoach(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

export function setVoiceCoach(on: boolean) {
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* ignore */ }
  if (!on) stopCoach();
  listeners.forEach(l => l(on));
}

export function useVoiceCoach(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(readVoiceCoach);
  useEffect(() => { listeners.add(setOn); return () => { listeners.delete(setOn); }; }, []);
  return [on, setVoiceCoach];
}

/** True when the phone is on silent or vibrate. Unknown (web, error) counts as not silent. */
export async function phoneIsSilent(): Promise<boolean> {
  if (!isNative()) return false;
  try { return !!(await ApexNative.audioState()).silent; } catch { return false; }
}

export function useSilentPhone(): boolean {
  const [silent, setSilent] = useState(false);
  useEffect(() => {
    let live = true;
    const check = () => { void phoneIsSilent().then(s => { if (live) setSilent(s); }); };
    check();
    const t = window.setInterval(check, 5000);
    return () => { live = false; window.clearInterval(t); };
  }, []);
  return silent;
}

async function focus(on: boolean) {
  if (!isNative()) return;
  try { await ApexNative.voiceFocus({ on }); } catch { /* ignore */ }
}

let focused = false;
let latest = 0;

async function speak(text: string) {
  const mine = ++latest;
  if (await phoneIsSilent()) return;
  if (mine !== latest) return;
  if (!focused) { focused = true; await focus(true); }
  await audio.speak(text, {
    // a newer line may have replaced this one; only the last line gives the audio back
    onEnd: () => { if (mine === latest && focused) { focused = false; void focus(false); } },
  });
}

/** A coaching line. Does nothing unless coaching is on. */
export function coachSay(text: string) {
  if (!readVoiceCoach()) return;
  void speak(text);
}

/** A line the person asked for with a tap (replay, hype). Works even with coaching off; still respects silent mode. */
export function coachSayNow(text: string) {
  void speak(text);
}

export function stopCoach() {
  latest++;
  audio.stopSpeaking();
  if (focused) { focused = false; void focus(false); }
}
