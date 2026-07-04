/**
 * Foreground notification tones, synthesized with the Web Audio API.
 *
 * Why synthesized (not audio files): the background push path can't play a
 * custom sound anyway (service workers have no audio; browsers ignore the
 * Notification `sound` option), so the only place a *chosen* sound applies is
 * the foreground, while a page is open. Synthesizing avoids shipping binaries
 * and gives the user a real, distinguishable choice.
 */

import type { NotificationSound } from "@pm/types";

export const NOTIFICATION_SOUND_OPTIONS: { value: NotificationSound; label: string }[] = [
  { value: "chime", label: "Chime" },
  { value: "bell", label: "Bell" },
  { value: "ding", label: "Ding" },
  { value: "none", label: "None (silent)" },
];

// A tone = one note: frequency (Hz) and start offset + duration (seconds).
interface Tone {
  freq: number;
  start: number;
  duration: number;
}

const TONE_PRESETS: Record<Exclude<NotificationSound, "none">, Tone[]> = {
  // Rising two-note chime.
  chime: [
    { freq: 660, start: 0, duration: 0.18 },
    { freq: 880, start: 0.16, duration: 0.28 },
  ],
  // Single struck bell with a longer tail.
  bell: [{ freq: 830, start: 0, duration: 0.6 }],
  // Short high ding.
  ding: [{ freq: 1050, start: 0, duration: 0.16 }],
};

// Lazily-created shared AudioContext (browsers cap the number of contexts).
let sharedCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedCtx) sharedCtx = new Ctor();
  return sharedCtx;
}

/**
 * Plays the given notification tone. No-op for "none", on the server, or when
 * Web Audio is unavailable. Resumes a suspended context (autoplay policies).
 */
export function playNotificationSound(sound: NotificationSound): void {
  if (sound === "none") return;
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();

  const tones = TONE_PRESETS[sound];
  const now = ctx.currentTime;

  for (const tone of tones) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = tone.freq;

    const startAt = now + tone.start;
    const endAt = startAt + tone.duration;
    // Quick attack, exponential decay — a soft "notification" envelope.
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.28, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt);

    osc.connect(gain).connect(ctx.destination);
    osc.start(startAt);
    osc.stop(endAt + 0.02);
  }
}
