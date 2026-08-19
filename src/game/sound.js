/**
 * Synthesised sound effects — no audio files, no network requests.
 * The context is created lazily on the first user gesture, which is also
 * the only point at which browsers will let it start.
 */

let ctx = null;
let master = null;
let muted = false;

function ensure() {
  if (ctx) return ctx;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  ctx = new AudioCtx();
  master = ctx.createGain();
  master.gain.value = 0.35;
  master.connect(ctx.destination);
  return ctx;
}

export function setMuted(value) {
  muted = value;
  if (master) master.gain.value = value ? 0 : 0.35;
}

export const isMuted = () => muted;

function envelope(node, peak, attack, decay) {
  const t = ctx.currentTime;
  node.gain.setValueAtTime(0.0001, t);
  node.gain.exponentialRampToValueAtTime(peak, t + attack);
  node.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

/** Short filtered noise burst — the basis of every impact sound. */
function noise(duration, filterType, freq, peak, decay) {
  if (!ensure() || muted) return;
  const frames = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  }
  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = freq;
  filter.Q.value = 1.1;

  const gain = ctx.createGain();
  envelope(gain, peak, 0.005, decay);

  src.connect(filter).connect(gain).connect(master);
  src.start();
  src.stop(ctx.currentTime + duration + 0.05);
}

function tone(freq, endFreq, duration, peak, type = 'sine') {
  if (!ensure() || muted) return;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(endFreq, ctx.currentTime + duration);

  const gain = ctx.createGain();
  envelope(gain, peak, 0.008, duration);

  osc.connect(gain).connect(master);
  osc.start();
  osc.stop(ctx.currentTime + duration + 0.05);
}

/* ── the kit ──────────────────────────────────────────────────── */

export const sfx = {
  /** Rubber band stretching — pitch rises with draw strength (0..1). */
  stretch(power) {
    tone(160 + power * 190, 180 + power * 240, 0.07, 0.05, 'triangle');
  },
  /** Slingshot release. */
  launch() {
    noise(0.16, 'bandpass', 900, 0.5, 0.14);
    tone(420, 120, 0.16, 0.16, 'triangle');
  },
  /** Bird glancing off a crate without breaking it. */
  thud() {
    noise(0.13, 'lowpass', 320, 0.42, 0.11);
  },
  /** Crate destroyed. */
  crack() {
    noise(0.4, 'highpass', 1300, 0.55, 0.3);
    noise(0.32, 'lowpass', 480, 0.5, 0.26);
    tone(280, 70, 0.3, 0.2, 'square');
  },
  /** Section revealed. */
  chime() {
    tone(660, 660, 0.16, 0.14, 'sine');
    setTimeout(() => tone(990, 990, 0.28, 0.11, 'sine'), 90);
  },
  /** Crates re-hung. */
  reset() {
    tone(300, 620, 0.22, 0.12, 'triangle');
  },
  /** Must be called from inside a user gesture. */
  unlock() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume();
  },
};
