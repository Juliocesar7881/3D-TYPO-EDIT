// Biblioteca de easing. Na cena, use o nome em string ("outExpo", "inOutCubic",
// "outBack", "spring", ...) ou um array cubic-bezier [x1, y1, x2, y2] igual ao
// After Effects / CSS.

const PI = Math.PI;
const c1 = 1.70158;
const c2 = c1 * 1.525;
const c3 = c1 + 1;
const c4 = (2 * PI) / 3;
const c5 = (2 * PI) / 4.5;

function bounceOut(x) {
  const n1 = 7.5625, d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
}

export const easings = {
  linear: (x) => x,
  inSine: (x) => 1 - Math.cos((x * PI) / 2),
  outSine: (x) => Math.sin((x * PI) / 2),
  inOutSine: (x) => -(Math.cos(PI * x) - 1) / 2,
  inQuad: (x) => x * x,
  outQuad: (x) => 1 - (1 - x) * (1 - x),
  inOutQuad: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
  inCubic: (x) => x * x * x,
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  inQuart: (x) => x * x * x * x,
  outQuart: (x) => 1 - Math.pow(1 - x, 4),
  inOutQuart: (x) => (x < 0.5 ? 8 * x ** 4 : 1 - Math.pow(-2 * x + 2, 4) / 2),
  inQuint: (x) => x ** 5,
  outQuint: (x) => 1 - Math.pow(1 - x, 5),
  inOutQuint: (x) => (x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2),
  inExpo: (x) => (x === 0 ? 0 : Math.pow(2, 10 * x - 10)),
  outExpo: (x) => (x === 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inOutExpo: (x) =>
    x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2,
  inCirc: (x) => 1 - Math.sqrt(1 - x * x),
  outCirc: (x) => Math.sqrt(1 - Math.pow(x - 1, 2)),
  inOutCirc: (x) =>
    x < 0.5 ? (1 - Math.sqrt(1 - Math.pow(2 * x, 2))) / 2 : (Math.sqrt(1 - Math.pow(-2 * x + 2, 2)) + 1) / 2,
  inBack: (x) => c3 * x ** 3 - c1 * x * x,
  outBack: (x) => 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2),
  inOutBack: (x) =>
    x < 0.5
      ? (Math.pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2
      : (Math.pow(2 * x - 2, 2) * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2,
  inElastic: (x) => (x === 0 ? 0 : x === 1 ? 1 : -Math.pow(2, 10 * x - 10) * Math.sin((x * 10 - 10.75) * c4)),
  outElastic: (x) => (x === 0 ? 0 : x === 1 ? 1 : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1),
  inOutElastic: (x) =>
    x === 0 ? 0 : x === 1 ? 1 : x < 0.5
      ? -(Math.pow(2, 20 * x - 10) * Math.sin((20 * x - 11.125) * c5)) / 2
      : (Math.pow(2, -20 * x + 10) * Math.sin((20 * x - 11.125) * c5)) / 2 + 1,
  inBounce: (x) => 1 - bounceOut(1 - x),
  outBounce: bounceOut,
  inOutBounce: (x) => (x < 0.5 ? (1 - bounceOut(1 - 2 * x)) / 2 : (1 + bounceOut(2 * x - 1)) / 2),
  // mola amortecida (overshoot suave, ótimo pro estilo candy)
  spring: (x) => {
    const f = (u) => 1 - Math.exp(-6.5 * u) * Math.cos(u * 4.2 * PI);
    return f(x) + (1 - f(1)) * x; // garante spring(1) === 1
  },
  // "whip": acelera forte e freia longo (movimento de câmera de edit)
  whip: (x) => (x < 0.35 ? 0.5 * Math.pow(x / 0.35, 3) : 1 - 0.5 * Math.pow(1 - (x - 0.35) / 0.65, 4)),
  smoothstep: (x) => x * x * (3 - 2 * x),
  smootherstep: (x) => x * x * x * (x * (x * 6 - 15) + 10),
};

// cubic-bezier igual ao CSS (resolve x->t por Newton + bisseção)
export function cubicBezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (t) => ((ax * t + bx) * t + cx) * t;
  const sy = (t) => ((ay * t + by) * t + cy) * t;
  const dsx = (t) => (3 * ax * t + 2 * bx) * t + cx;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sx(t) - x;
      if (Math.abs(err) < 1e-6) return sy(t);
      const d = dsx(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0, hi = 1;
    t = x;
    for (let i = 0; i < 30; i++) {
      const v = sx(t);
      if (Math.abs(v - x) < 1e-6) break;
      if (v < x) lo = t; else hi = t;
      t = (lo + hi) / 2;
    }
    return sy(t);
  };
}

const bezierCache = new Map();
export function getEase(e) {
  if (typeof e === 'function') return e;
  if (Array.isArray(e) && e.length === 4) {
    const k = e.join(',');
    if (!bezierCache.has(k)) bezierCache.set(k, cubicBezier(...e));
    return bezierCache.get(k);
  }
  if (typeof e === 'string') {
    if (easings[e]) return easings[e];
    // aceita "easeOutExpo" / "ease-out-expo" / "outexpo"
    const norm = e.replace(/^ease[-_]?/i, '').replace(/[-_](\w)/g, (_, c) => c.toUpperCase());
    const key = Object.keys(easings).find((k) => k.toLowerCase() === norm.toLowerCase());
    if (key) return easings[key];
  }
  return easings.inOutCubic;
}

export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => (b === a ? 0 : (x - a) / (b - a));
export const remap = (x, a, b, c, d) => lerp(c, d, clamp(invLerp(a, b, x)));
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const fract = (x) => x - Math.floor(x);
export const deg = (d) => (d * Math.PI) / 180;

// progresso 0..1 de t dentro de [start, start+dur] com easing
export function prog(t, start, dur, ease = 'linear') {
  if (dur <= 0) return t >= start ? 1 : 0;
  return getEase(ease)(clamp((t - start) / dur));
}

// pulso que sobe rápido e decai exponencialmente depois de t0
export function impulse(t, t0, decay = 0.25, attack = 0.012) {
  const d = t - t0;
  if (d < -attack) return 0;
  if (d < 0) return 1 + d / attack;
  return Math.exp(-d / decay);
}
