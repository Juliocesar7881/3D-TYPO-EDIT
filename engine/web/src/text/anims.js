// Presets de animação por letra. Cada preset devolve deltas de transformação
// em função do progresso u (0 = começo, 1 = repouso para "in"; 0 = repouso,
// 1 = sumiu para "out"). Unidades em "size" da letra (cap height = 1).
import { getEase, clamp, lerp } from '../core/easing.js';
import { hashString, mulberry32 } from '../core/rng.js';

const D = Math.PI / 180;

function rnd3(seed) {
  const r = mulberry32(seed);
  return [r() * 2 - 1, r() * 2 - 1, r() * 2 - 1, r(), r()];
}

// T: transform acumulável
export function identity() {
  return { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1, sz: 1, op: 1, flash: 0 };
}

export function combine(a, b) {
  a.px += b.px || 0; a.py += b.py || 0; a.pz += b.pz || 0;
  a.rx += b.rx || 0; a.ry += b.ry || 0; a.rz += b.rz || 0;
  a.sx *= b.sx ?? 1; a.sy *= b.sy ?? 1; a.sz *= b.sz ?? 1;
  a.op *= b.op ?? 1;
  a.flash = Math.max(a.flash, b.flash || 0);
  return a;
}

const fadeQuick = (u, k = 0.25) => clamp(u / k);

// ---------------- IN ----------------
// fn(u, L) -> deltas. L = { i, n, seed, dir, amp }
export const IN = {
  pop: { dur: 0.42, stagger: 0.035, fn: (u, L) => {
    const e = getEase('outBack')(u);
    const s = Math.max(0.0001, e);
    return { sx: s, sy: s, sz: s, op: fadeQuick(u, 0.15), flash: (1 - u) * 0.9 };
  } },
  popRot: { dur: 0.45, stagger: 0.04, fn: (u, L) => {
    const e = getEase('outBack')(u);
    const r = rnd3(L.seed);
    return { sx: Math.max(1e-4, e), sy: Math.max(1e-4, e), sz: Math.max(1e-4, e), rz: (1 - getEase('outCubic')(u)) * r[0] * 40 * D, op: fadeQuick(u, 0.15), flash: (1 - u) * 0.8 };
  } },
  drop: { dur: 0.6, stagger: 0.045, fn: (u, L) => {
    const e = getEase('outBounce')(u);
    return { py: (1 - e) * 2.2 * L.amp, rz: (1 - getEase('outCubic')(u)) * (L.i % 2 ? 1 : -1) * 18 * D, op: fadeQuick(u, 0.12) };
  } },
  rise: { dur: 0.5, stagger: 0.035, fn: (u, L) => {
    const e = getEase('outExpo')(u);
    return { py: -(1 - e) * 1.4 * L.amp, rx: (1 - e) * 75 * D, op: fadeQuick(u, 0.3) };
  } },
  slide: { dur: 0.5, stagger: 0.03, fn: (u, L) => {
    const e = getEase('outExpo')(u);
    return { px: (1 - e) * 3.0 * L.dir * L.amp, op: fadeQuick(u, 0.3), flash: (1 - u) * 0.4 };
  } },
  flip: { dur: 0.55, stagger: 0.045, fn: (u, L) => {
    const e = getEase('outBack')(u);
    return { rx: (1 - e) * -100 * D, op: fadeQuick(u, 0.25) };
  } },
  spin: { dur: 0.6, stagger: 0.04, fn: (u, L) => {
    const e = getEase('outExpo')(u);
    const s = lerp(0.5, 1, e);
    return { ry: (1 - e) * 200 * D * L.dir, sx: s, sy: s, sz: s, op: fadeQuick(u, 0.2) };
  } },
  scatter: { dur: 0.75, stagger: 0.02, fn: (u, L) => {
    const e = getEase('outExpo')(u);
    const r = rnd3(L.seed);
    const k = (1 - e) * L.amp;
    return {
      px: r[0] * 6 * k, py: r[1] * 4 * k, pz: (r[2] * 0.5 + 0.6) * 9 * k,
      rx: r[1] * 180 * D * (1 - e), ry: r[2] * 220 * D * (1 - e), rz: r[0] * 120 * D * (1 - e),
      op: fadeQuick(u, 0.2), flash: (1 - u) * 0.5,
    };
  } },
  zoom: { dur: 0.5, stagger: 0.03, fn: (u, L) => {
    const e = getEase('outExpo')(u);
    const s = lerp(2.4, 1, e);
    return { pz: (1 - e) * 7 * L.amp, sx: s, sy: s, sz: s, op: fadeQuick(u, 0.35) };
  } },
  typewriter: { dur: 0.12, stagger: 0.05, fn: (u) => ({ op: u > 0 ? 1 : 0, flash: u < 1 ? 1 - u : 0, sx: lerp(1.25, 1, u), sy: lerp(1.25, 1, u) }) },
  glitch: { dur: 0.45, stagger: 0.02, fn: (u, L, t) => {
    const f = Math.floor(t * 24);
    const r = rnd3((L.seed ^ hashString('g' + f)) >>> 0);
    const k = u < 0.75 ? 1 - u / 0.75 : 0;
    const vis = u < 0.75 ? (r[3] > 0.35 ? 1 : 0.15) : 1;
    return { px: r[0] * 0.6 * k, py: r[1] * 0.25 * k, sx: 1 + r[2] * 0.4 * k, op: vis * fadeQuick(u, 0.05), flash: k * r[4] };
  } },
  stretch: { dur: 0.55, stagger: 0.04, fn: (u) => {
    const e = getEase('spring')(u);
    return { sy: Math.max(1e-3, lerp(2.6, 1, e)), sx: Math.max(1e-3, lerp(0.25, 1, e)), op: fadeQuick(u, 0.15) };
  } },
  bounce: { dur: 0.6, stagger: 0.05, fn: (u, L) => {
    const e = getEase('spring')(u);
    const hop = Math.sin(clamp(u * 1.6) * Math.PI) * 0.6;
    return { sx: Math.max(1e-3, e), sy: Math.max(1e-3, e), sz: Math.max(1e-3, e), py: hop * L.amp, op: fadeQuick(u, 0.12) };
  } },
  fade: { dur: 0.45, stagger: 0.025, fn: (u) => {
    const e = getEase('outCubic')(u);
    return { op: e, pz: (1 - e) * 0.8 };
  } },
  unfold: { dur: 0.45, stagger: 0.03, fn: (u) => {
    const e = getEase('outExpo')(u);
    return { sx: Math.max(1e-3, e), op: fadeQuick(u, 0.1), flash: (1 - u) * 0.6 };
  } },
  swing: { dur: 0.7, stagger: 0.05, fn: (u, L) => {
    const e = getEase('outElastic')(u);
    return { rz: (1 - e) * 80 * D * L.dir, py: (1 - getEase('outCubic')(u)) * 0.6, op: fadeQuick(u, 0.15) };
  } },
  neonFlicker: { dur: 0.5, stagger: 0.03, fn: (u, L) => {
    const r = rnd3(L.seed);
    const steps = [0, 1, 0, 0.2, 1, 0.4, 1];
    const idx = Math.min(steps.length - 1, Math.floor((u + r[3] * 0.08) * steps.length));
    return { op: u >= 1 ? 1 : steps[idx], flash: u < 1 ? 0.6 : 0 };
  } },
  trackIn: { dur: 0.6, stagger: 0, fn: (u, L) => {
    const e = getEase('outExpo')(u);
    const off = (L.i - (L.n - 1) / 2) * 1.2;
    return { px: (1 - e) * off * L.amp, op: fadeQuick(u, 0.3), flash: (1 - u) * 0.4 };
  } },
  none: { dur: 0.001, stagger: 0, fn: () => ({}) },
};

// ---------------- OUT ----------------
export const OUT = {
  fade: { dur: 0.3, stagger: 0.01, fn: (u) => ({ op: 1 - getEase('inQuad')(u) }) },
  scatter: { dur: 0.5, stagger: 0.01, fn: (u, L) => {
    const e = getEase('inCubic')(u);
    const r = rnd3(L.seed ^ 0x9e3779b9);
    return { px: r[0] * 7 * e, py: r[1] * 5 * e, pz: (r[2] + 0.4) * 10 * e, rx: r[1] * 3 * e, ry: r[2] * 3 * e, rz: r[0] * 2 * e, op: 1 - clamp((u - 0.5) / 0.5) };
  } },
  explode: { dur: 0.45, stagger: 0, fn: (u, L) => {
    const e = getEase('outCubic')(u);
    const r = rnd3(L.seed ^ 0x51ed27);
    return { px: r[0] * 12 * e, py: r[1] * 9 * e, pz: (r[2] + 0.2) * 14 * e, rx: r[1] * 5 * e, ry: r[2] * 5 * e, rz: r[0] * 4 * e, op: 1 - clamp((u - 0.35) / 0.65), flash: (1 - u) * 0.5 * (u > 0 ? 1 : 0) };
  } },
  shrink: { dur: 0.3, stagger: 0.015, fn: (u) => {
    const s = Math.max(1e-4, 1 - getEase('inBack')(u));
    return { sx: s, sy: s, sz: s };
  } },
  flyBack: { dur: 0.45, stagger: 0.015, fn: (u) => ({ pz: -getEase('inExpo')(u) * 25, op: 1 - clamp((u - 0.6) / 0.4) }) },
  flyForward: { dur: 0.45, stagger: 0.015, fn: (u) => ({ pz: getEase('inExpo')(u) * 18, op: 1 - clamp((u - 0.7) / 0.3) }) },
  drop: { dur: 0.5, stagger: 0.02, fn: (u, L) => {
    const e = getEase('inQuad')(u);
    return { py: -e * 6, rz: e * (L.i % 2 ? 1 : -1) * 60 * D, op: 1 - clamp((u - 0.6) / 0.4) };
  } },
  collapse: { dur: 0.3, stagger: 0.01, fn: (u) => ({ sy: Math.max(1e-3, 1 - getEase('inExpo')(u)), flash: u * 0.5 }) },
  glitch: { dur: 0.3, stagger: 0.01, fn: (u, L, t) => {
    const r = rnd3((L.seed ^ hashString('o' + Math.floor(t * 30))) >>> 0);
    return { px: r[0] * 0.8 * u, op: u < 0.95 ? (r[3] > u ? 1 : 0) : 0, flash: u * r[4] };
  } },
  none: { dur: 0.001, stagger: 0, fn: () => ({}) },
};

// ---------------- IDLE (enquanto visível) ----------------
// fn(time since word start, L, ctx) -> deltas
export const IDLE = {
  none: () => ({}),
  float: (tt, L, ctx) => {
    const n = ctx.noise;
    const k = 0.07 * L.amp;
    return { px: n(L.seed * 0.01, tt * 0.6, 1) * k, py: n(L.seed * 0.01, tt * 0.6, 7) * k, rz: n(L.seed * 0.01, tt * 0.5, 13) * 3 * D };
  },
  wave: (tt, L) => ({ py: Math.sin(tt * 5 - L.i * 0.55) * 0.12 * L.amp }),
  pulse: (tt, L, ctx) => {
    const p = ctx.beat ? ctx.beat : 0;
    const s = 1 + p * 0.07;
    return { sx: s, sy: s, sz: s };
  },
  shimmer: (tt, L) => ({ flash: Math.max(0, Math.sin(tt * 6 - L.i * 0.7)) ** 6 * 0.6 }),
  jelly: (tt, L) => {
    const w = Math.sin(tt * 9 - L.i * 0.8) * 0.05;
    return { sx: 1 + w, sy: 1 - w };
  },
};

export function resolveIn(name) { return IN[name] || IN.pop; }
export function resolveOut(name) { return OUT[name] || OUT.fade; }
export function resolveIdle(name) { return IDLE[name] || IDLE.none; }
