/**
 * SFX layer — synthesized via Web Audio API so we ship zero asset
 * weight. Three sounds: move (light tap), capture (lower thunk),
 * victory (3-note ascending arpeggio).
 *
 * Mute is persisted in localStorage so a player's preference survives
 * across sessions. AudioContext is lazy — we only instantiate it on
 * first play to avoid the autoplay-restrictions warning on iOS Safari.
 */

const STORAGE_KEY = "chesscito:sfx-muted";

let ctx: AudioContext | null = null;
let muted: boolean | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Klass =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Klass) return null;
  try {
    ctx = new Klass();
    return ctx;
  } catch {
    return null;
  }
}

function readMutedFromStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function isSfxMuted(): boolean {
  if (muted === null) muted = readMutedFromStorage();
  return muted;
}

export function setSfxMuted(next: boolean): void {
  muted = next;
  if (typeof window === "undefined") return;
  try {
    if (next) localStorage.setItem(STORAGE_KEY, "1");
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Plays a single oscillator note with an exponential decay envelope. */
function tone(
  audio: AudioContext,
  frequency: number,
  durationMs: number,
  type: OscillatorType = "sine",
  startGain = 0.18,
  startOffset = 0,
) {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  const t0 = audio.currentTime + startOffset;
  gain.gain.setValueAtTime(startGain, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);
  osc.connect(gain).connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + durationMs / 1000 + 0.02);
}

function play(playerFn: (audio: AudioContext) => void) {
  if (isSfxMuted()) return;
  const audio = getCtx();
  if (!audio) return;
  // iOS suspends the context until a user gesture — resume() is a no-op
  // when already running.
  audio.resume?.().catch(() => undefined);
  try {
    playerFn(audio);
  } catch {
    /* ignore — sfx are non-critical */
  }
}

export function sfxMove() {
  play((audio) => tone(audio, 520, 70, "triangle", 0.12));
}

export function sfxCapture() {
  play((audio) => {
    tone(audio, 180, 130, "sawtooth", 0.18);
    tone(audio, 90, 130, "square", 0.10, 0.005);
  });
}

export function sfxReject() {
  play((audio) => tone(audio, 140, 90, "square", 0.08));
}

export function sfxCheck() {
  play((audio) => tone(audio, 760, 110, "triangle", 0.15));
}

export function sfxVictory() {
  play((audio) => {
    tone(audio, 523, 160, "triangle", 0.16); // C5
    tone(audio, 659, 160, "triangle", 0.16, 0.12); // E5
    tone(audio, 784, 220, "triangle", 0.18, 0.24); // G5
  });
}
