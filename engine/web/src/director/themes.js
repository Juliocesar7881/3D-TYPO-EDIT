// Estilos de texto e temas. Tokens de cor: $accent, $accent2, $accent3,
// $accentDark, $accentLight, $palette, $shadow, $white — resolvidos por shot.

export const STYLES = {
  // ---- neon / 3D typography escuro ----
  chrome: { font: 'anton', depth: 0.28, bevel: 0.035, face: { type: 'chrome', color: '#ffffff' }, side: { type: 'chrome', color: '#8d96aa', roughness: 0.22 } },
  chromeTint: { font: 'anton', depth: 0.28, bevel: 0.035, face: { type: 'chrome', color: '$accentLight' }, side: { type: 'chrome', color: '$accentDark', roughness: 0.2 } },
  chromeBold: { font: 'archivo', depth: 0.34, bevel: 0.04, face: { type: 'chrome', color: '#ffffff' }, side: { type: 'metal', color: '$accent', roughness: 0.3 } },
  neon: { font: 'righteous', depth: 0, hideFace: true, stroke: { width: 0.07, mat: { type: 'neon', color: '$accent', intensity: 2.6 }, z: 'center' } },
  neonTube: { font: 'audiowide', depth: 0, hideFace: true, stroke: { width: 0.06, mat: { type: 'neon', color: '$accent', intensity: 2.8 }, z: 'center' } },
  neonFill: { font: 'archivo', depth: 0.12, bevel: 0.012, face: { type: 'glow', color: '$accent', intensity: 1.45 }, side: { type: 'glow', color: '$accentDark', intensity: 0.55 } },
  neonDuo: { font: 'bebas', depth: 0.08, bevel: 0.01, face: { type: 'glow', color: '#ffffff', intensity: 1.05 }, stroke: { width: 0.1, mat: { type: 'neon', color: '$accent', intensity: 2.2 }, z: 'back' } },
  glowWhite: { font: 'bebas', depth: 0.1, bevel: 0.01, face: { type: 'glow', color: '#ffffff', intensity: 1.1 }, side: { type: 'glow', color: '$accent', intensity: 0.75 } },
  gradient: { font: 'anton', depth: 0.26, bevel: 0.03, face: { type: 'gradient', color: '$accentLight', color2: '$accent2', metalness: 0.4, roughness: 0.18 }, side: { type: 'metal', color: '$accentDark' } },
  glossy: { font: 'archivo', depth: 0.3, bevel: 0.05, face: { type: 'glossy', color: '$accent' }, side: { type: 'glossy', color: '$accentDark' } },
  holo: { font: 'bowlby', depth: 0.3, bevel: 0.05, bevelSegments: 4, face: { type: 'iridescent', color: '#ffffff' }, side: { type: 'iridescent', color: '#d9c9ff' } },
  outline: { font: 'bebas', depth: 0, hideFace: true, stroke: { width: 0.045, mat: { type: 'glow', color: '#ffffff', intensity: 1.3 }, z: 'center' } },
  serif: { font: 'abril', depth: 0.16, bevel: 0.02, face: { type: 'chrome', color: '#ffffff' }, side: { type: 'chrome', color: '$accentDark' } },
  card: { font: 'dmserif', depth: 0, face: { type: 'flat', color: '#efece4' }, tracking: 0.12 },
  tech: { font: 'russo', depth: 0.22, bevel: 0.02, face: { type: 'gradient', color: '#ffffff', color2: '$accent', metalness: 0.6 }, side: { type: 'neon', color: '$accent', intensity: 1.1 } },
  // ---- candy ----
  candy: {
    font: 'titan', depth: 0.34, bevel: 0.08, bevelSegments: 4,
    face: { type: 'candy', color: '$accent' }, side: { type: 'candy', color: '$accentDark' },
    stroke: { width: 0.24, mat: { type: 'flat', color: '#ffffff' }, z: 'back' },
    shadow: { offset: [0.09, -0.13], color: '$shadow', opacity: 0.6 },
  },
  candyRainbow: {
    font: 'titan', depth: 0.34, bevel: 0.08, bevelSegments: 4, letterColors: '$palette',
    face: { type: 'candy', color: '$accent' }, side: { type: 'candy', color: '$accentDark', followLetter: -0.18 },
    stroke: { width: 0.24, mat: { type: 'flat', color: '#ffffff' }, z: 'back' },
    shadow: { offset: [0.09, -0.13], color: '$shadow', opacity: 0.6 },
  },
  candyWhite: {
    font: 'luckiest', depth: 0.3, bevel: 0.06, bevelSegments: 4,
    face: { type: 'candy', color: '#ffffff' }, side: { type: 'candy', color: '$accent' },
    stroke: { width: 0.22, mat: { type: 'flat', color: '$accent' }, z: 'back' },
    shadow: { offset: [0.08, -0.12], color: '$shadow', opacity: 0.55 },
  },
  bubble: {
    font: 'lilita', depth: 0.42, bevel: 0.12, bevelSegments: 5,
    face: { type: 'glossy', color: '$accent', roughness: 0.14 }, side: { type: 'glossy', color: '$accentDark', roughness: 0.2 },
    stroke: { width: 0.2, mat: { type: 'flat', color: '#ffffff' }, z: 'back' },
    shadow: { offset: [0.08, -0.13], color: '$shadow', opacity: 0.55 },
  },
  gummy: {
    font: 'chewy', depth: 0.4, bevel: 0.1, bevelSegments: 5,
    face: { type: 'candy', color: '$accent', roughness: 0.2 }, side: { type: 'candy', color: '$accentLight' },
    stroke: { width: 0.18, mat: { type: 'flat', color: '#ffffff' }, z: 'back' },
  },
  candyNeon: {
    font: 'titan', depth: 0.26, bevel: 0.06, bevelSegments: 4,
    face: { type: 'candy', color: '$accentLight' }, side: { type: 'candy', color: '$accent' },
    stroke: { width: 0.13, mat: { type: 'neon', color: '$accent', intensity: 2.2 }, z: 'back' },
  },
};

const ANIMS_NEON = {
  in: { scatter: 2.2, zoom: 1.6, slide: 1.4, flip: 1.1, spin: 1.1, pop: 1.0, rise: 1.0, glitch: 0.9, trackIn: 1.0, unfold: 0.8, neonFlicker: 0.7 },
  out: { scatter: 2, explode: 1.2, flyForward: 1, fade: 0.8, glitch: 0.6, flyBack: 0.6 },
  idle: { float: 2.2, shimmer: 1, pulse: 1.2 },
};
const ANIMS_CANDY = {
  in: { bounce: 2.6, pop: 2, drop: 2, stretch: 2, popRot: 1.6, swing: 1.1, spin: 0.6 },
  out: { shrink: 2.2, drop: 1, explode: 1, fade: 0.4 },
  idle: { jelly: 1.6, wave: 1.1, float: 1, pulse: 1.6 },
};

const CAM_NEON = {
  moves: { push: 2, pull: 1, orbitL: 2, orbitR: 2, craneUp: 1, craneDown: 1, dutch: 1.5, hero: 1.1, spiral: 1.2, slideL: 0.7, slideR: 0.7, macro: 0.5, rollIn: 0.5, topDown: 0.3 },
  transitions: { whip: 3, smooth: 1, spin: 0.7, zoom: 1.1 },
  shake: 0.5,
  k: 1.0,
};
const CAM_CANDY = {
  moves: { push: 2, pull: 1.4, orbitL: 1.4, orbitR: 1.4, dutch: 2, rollIn: 1, spiral: 0.8, topDown: 0.5, hero: 0.6 },
  transitions: { whip: 2, spin: 1.5, zoom: 1.6, smooth: 0.5 },
  shake: 0.75,
  k: 1.1,
};

export const THEMES = {
  neon: {
    palette: ['#2de2ff', '#ff2bd6', '#8a5cff', '#ff4f9a', '#3a6bff', '#ffd166', '#46ffb5'],
    shadow: '#000000',
    background: { kind: 'nebula', base: '#030108', intensity: 0.95, stars: 1, moodFollow: true },
    env: { kind: 'studio-neon' },
    styles: { chrome: 3, chromeTint: 2, neon: 2, neonFill: 1.6, neonDuo: 1.5, gradient: 1.4, holo: 0.7, glowWhite: 1, neonTube: 0.8, chromeBold: 1 },
    anims: ANIMS_NEON,
    camera: CAM_NEON,
    layouts: { single: 2, stack: 2, line: 1.4, cascade: 1, vertical: 0.5, arc: 0.6, scatter3d: 0.7, ring: 0.4 },
    decor: { streakSwirl: 2, streakCross: 1.6, streakOrbit: 1, neonRing: 1.2, glassRing: 0.9, halo: 1, shards: 1.3, sparkleBurst: 1.2, lasers: 0.5, tunnel: 0.3, grid: 0.3 },
    decorPerShot: [1, 3],
    particles: [
      { type: 'dust', count: 12000, size: [0.02, 0.07], colors: ['#ffffff', '#cfe8ff', '$p0', '$p2'], intensity: 1.6, drift: 0.5, twinkle: 0.6 },
      { type: 'bokeh', count: 420, size: [0.12, 0.42], colors: ['$p0', '$p1', '$p2', '$p3'], intensity: 0.9, drift: 0.8, twinkle: 0.2 },
      { type: 'sparkle', count: 260, size: [0.08, 0.26], colors: ['#ffffff', '$p0', '$p1'], intensity: 2.6, drift: 0.4, twinkle: 0.9 },
    ],
    fx: { bloom: 1.0, bloomThreshold: 0.95, chromatic: 0.35, vignette: 0.42, grain: 0.16, saturation: 1.14, contrast: 1.06, anamorphic: 0.22, exposure: 1.0, tonemap: 'aces' },
  },
  chrome: {
    palette: ['#ffffff', '#9fd8ff', '#ff4f6d', '#c084ff', '#ffd27a'],
    shadow: '#000000',
    background: { kind: 'void', base: '#010103', stars: 0.8 },
    env: { kind: 'chrome-white' },
    styles: { chrome: 5, chromeTint: 1.5, chromeBold: 1.5, serif: 0.8, glowWhite: 0.8 },
    anims: { in: { slide: 2, zoom: 2, trackIn: 1.5, rise: 1.2, flip: 1, scatter: 1 }, out: { flyForward: 1.5, scatter: 1, fade: 1, flyBack: 1 }, idle: { float: 2, none: 1 } },
    camera: { ...CAM_NEON, moves: { push: 2, hero: 2, orbitL: 1.5, orbitR: 1.5, dutch: 1.5, craneUp: 1, slideL: 1, slideR: 1, spiral: 0.6 } },
    layouts: { stack: 3, single: 2, line: 1, cascade: 1 },
    decor: { streakCross: 2, halo: 0.6, sparkleBurst: 1, lasers: 0.6, shards: 0.6 },
    decorPerShot: [0, 2],
    particles: [
      { type: 'dust', count: 10000, size: [0.02, 0.06], colors: ['#ffffff', '#dfe9ff'], intensity: 1.5, drift: 0.4, twinkle: 0.5 },
      { type: 'bokeh', count: 380, size: [0.12, 0.45], colors: ['#ffffff', '#ffd9a8', '#9fd8ff', '$p2'], intensity: 0.9, drift: 0.7, twinkle: 0.2 },
    ],
    fx: { bloom: 0.95, bloomThreshold: 0.9, chromatic: 0.28, vignette: 0.5, grain: 0.22, saturation: 1.0, contrast: 1.1, anamorphic: 0.55, exposure: 1.05, tonemap: 'aces' },
  },
  candy: {
    // cores do TEXTO saturadas (o fundo é que é pastel) => contraste de adesivo
    palette: ['#ff3d9a', '#2fb4ff', '#9b6bff', '#18c99a', '#ffb81f', '#ff6f4f'],
    shadow: '#b2246f',
    background: { kind: 'candy', top: '#ffb6df', bottom: '#d7c1ff', colors: ['#ff9fd2', '#b9a4ff', '#9fe3ff'], pattern: 'dots', intensity: 1.0, moodFollow: false },
    env: { kind: 'candy' },
    styles: { candy: 3, candyRainbow: 2.2, candyWhite: 1.6, bubble: 2, gummy: 1.2 },
    anims: ANIMS_CANDY,
    camera: CAM_CANDY,
    layouts: { single: 2, stack: 2.4, line: 1, arc: 1.2, cascade: 0.8, vertical: 0.5 },
    decor: { hearts: 3, stars: 2, gumballs: 1.8, clouds: 1.4, lollipops: 1.1, donuts: 0.9, sparkleBurst: 1.6, checker: 0.6 },
    decorPerShot: [2, 3],
    particles: [
      { type: 'hearts', count: 140, size: [0.18, 0.5], colors: ['$p0', '$p1', '$p2', '#ffffff'], intensity: 1.0, drift: 0.9, twinkle: 0.0, blending: 'normal', opacity: 0.85 },
      { type: 'confetti', count: 480, size: [0.12, 0.26], colors: ['$p0', '$p1', '$p2', '$p3', '$p4', '#ffffff'], intensity: 1.0, drift: 0.7, twinkle: 0.0, blending: 'normal', spin: 2.5 },
      { type: 'sparkle', count: 260, size: [0.1, 0.3], colors: ['#ffffff', '#fff6c8'], intensity: 1.4, drift: 0.4, twinkle: 0.9 },
    ],
    fx: { bloom: 0.22, bloomThreshold: 2.2, chromatic: 0.1, vignette: 0.16, grain: 0.04, saturation: 1.1, contrast: 1.08, anamorphic: 0, exposure: 1.0, tonemap: 'neutral', letterFlash: 0.2, speedLines: 0.7, speedColor: '#ffffff' },
  },
  candyNight: {
    palette: ['#ff6ec7', '#7af0ff', '#b98bff', '#fff07a', '#7dffb2', '#ff9a6e'],
    shadow: '#14051f',
    background: { kind: 'dream', colors: ['#3b0f5c', '#0f3a5c', '#5c0f3f'], intensity: 0.9, moodFollow: true },
    env: { kind: 'studio-neon' },
    styles: { candyNeon: 2.5, bubble: 1.6, candyRainbow: 1.4, holo: 1.6, neonFill: 1.2, neonDuo: 1 },
    anims: { in: { bounce: 2, pop: 2, scatter: 1.4, stretch: 1.4, drop: 1.2, popRot: 1.2, zoom: 1 }, out: ANIMS_CANDY.out, idle: { float: 1.5, jelly: 1, pulse: 1.5, shimmer: 1 } },
    camera: CAM_CANDY,
    layouts: { single: 2, stack: 2.2, line: 1, arc: 1, cascade: 1, ring: 0.5 },
    decor: { hearts: 2.2, stars: 2, gumballs: 1.2, streakSwirl: 1.6, neonRing: 1.2, sparkleBurst: 2, halo: 1, glassRing: 0.7, lollipops: 0.8 },
    decorPerShot: [2, 3],
    particles: [
      { type: 'dust', count: 9000, size: [0.02, 0.07], colors: ['#ffffff', '$p1', '$p0'], intensity: 1.6, drift: 0.5, twinkle: 0.6 },
      { type: 'hearts', count: 120, size: [0.15, 0.4], colors: ['$p0', '$p2', '$p1'], intensity: 1.8, drift: 0.9, twinkle: 0.3 },
      { type: 'sparkle', count: 320, size: [0.08, 0.26], colors: ['#ffffff', '$p3', '$p1'], intensity: 2.6, drift: 0.4, twinkle: 0.9 },
      { type: 'bokeh', count: 260, size: [0.12, 0.4], colors: ['$p0', '$p1', '$p2'], intensity: 0.8, drift: 0.8, twinkle: 0.2 },
    ],
    fx: { bloom: 1.05, bloomThreshold: 0.85, chromatic: 0.28, vignette: 0.35, grain: 0.12, saturation: 1.12, contrast: 1.04, anamorphic: 0.12, exposure: 1.0, tonemap: 'aces', letterFlash: 0.6, speedLines: 0.35, speedColor: '#ffd6f5' },
  },
  inferno: {
    palette: ['#ff3d2e', '#ff9a1f', '#ffd36b', '#ff2f6e', '#ffffff'],
    shadow: '#000000',
    background: { kind: 'nebula', base: '#060100', colors: ['#ff3d2e', '#ff9a1f', '#5c0a00'], intensity: 0.9, moodFollow: false },
    env: { kind: 'sunset' },
    styles: { chromeTint: 3, chrome: 2, neonFill: 1.5, gradient: 2, neonDuo: 1 },
    anims: ANIMS_NEON,
    camera: CAM_NEON,
    layouts: { single: 2, stack: 2, line: 1, cascade: 1, scatter3d: 0.8 },
    decor: { streakSwirl: 2, streakCross: 1.5, shards: 1.5, sparkleBurst: 1.5, halo: 1, lasers: 0.6 },
    decorPerShot: [1, 3],
    particles: [
      { type: 'dust', count: 10000, size: [0.02, 0.07], colors: ['#ffd9a0', '#ff9a1f', '#ffffff'], intensity: 1.8, drift: 0.7, twinkle: 0.7 },
      { type: 'bokeh', count: 380, size: [0.12, 0.45], colors: ['$p0', '$p1', '$p2'], intensity: 0.9, drift: 0.9, twinkle: 0.3 },
      { type: 'sparkle', count: 220, size: [0.08, 0.24], colors: ['#ffffff', '$p2'], intensity: 2.6, drift: 0.5, twinkle: 0.9 },
    ],
    fx: { bloom: 1.2, bloomThreshold: 0.8, chromatic: 0.35, vignette: 0.45, grain: 0.2, saturation: 1.15, contrast: 1.08, anamorphic: 0.3, exposure: 1.0, tonemap: 'aces' },
  },
  ice: {
    palette: ['#7ff6ff', '#4aa8ff', '#ffffff', '#b6a8ff', '#63ffd9'],
    shadow: '#000000',
    background: { kind: 'nebula', base: '#00040a', colors: ['#0a4cff', '#00e0ff', '#5b2bff'], intensity: 0.85, moodFollow: false },
    env: { kind: 'studio-neon', colors: ['#7ff6ff', '#4aa8ff', '#ffffff', '#b6a8ff'] },
    styles: { chrome: 3, chromeTint: 2, neon: 1.5, glowWhite: 1.5, holo: 1.2, neonTube: 1 },
    anims: ANIMS_NEON,
    camera: CAM_NEON,
    layouts: { single: 2, stack: 2, line: 1.2, cascade: 1, vertical: 0.6, arc: 0.6 },
    decor: { glassRing: 1.6, shards: 2, streakSwirl: 1.4, neonRing: 1, sparkleBurst: 1.5, halo: 1 },
    decorPerShot: [1, 3],
    particles: [
      { type: 'dust', count: 12000, size: [0.02, 0.07], colors: ['#ffffff', '#bff8ff'], intensity: 1.7, drift: 0.5, twinkle: 0.6 },
      { type: 'bokeh', count: 380, size: [0.12, 0.42], colors: ['$p0', '$p1', '$p3'], intensity: 0.9, drift: 0.7, twinkle: 0.2 },
      { type: 'sparkle', count: 300, size: [0.08, 0.26], colors: ['#ffffff', '$p0'], intensity: 2.8, drift: 0.4, twinkle: 0.9 },
    ],
    fx: { bloom: 1.1, bloomThreshold: 0.85, chromatic: 0.3, vignette: 0.4, grain: 0.15, saturation: 1.1, contrast: 1.06, anamorphic: 0.35, exposure: 1.0, tonemap: 'aces' },
  },
  sunset: {
    palette: ['#ff4fa3', '#ff9b3d', '#7a3dff', '#ffd36b', '#3dd6ff'],
    shadow: '#000000',
    background: { kind: 'sunset', base: '#0a0218', colors: ['#7a1fff', '#ff4f8a', '#ffb347'], intensity: 1.0, moodFollow: false },
    env: { kind: 'sunset' },
    styles: { chromeTint: 2.5, gradient: 2.5, neon: 1.5, neonDuo: 1.5, chrome: 1.5, tech: 1 },
    anims: ANIMS_NEON,
    camera: CAM_NEON,
    layouts: { single: 2, stack: 2, line: 1.4, cascade: 1 },
    decor: { grid: 2.5, streakCross: 1.4, neonRing: 1, lasers: 1.2, sparkleBurst: 1, halo: 0.8 },
    decorPerShot: [1, 2],
    particles: [
      { type: 'dust', count: 9000, size: [0.02, 0.07], colors: ['#ffffff', '#ffd6f0'], intensity: 1.6, drift: 0.5, twinkle: 0.6 },
      { type: 'bokeh', count: 300, size: [0.12, 0.42], colors: ['$p0', '$p1', '$p2'], intensity: 0.9, drift: 0.7, twinkle: 0.2 },
    ],
    fx: { bloom: 1.1, bloomThreshold: 0.85, chromatic: 0.3, vignette: 0.45, grain: 0.18, saturation: 1.12, contrast: 1.06, anamorphic: 0.4, exposure: 1.0, tonemap: 'aces' },
  },
};

export function deepMerge(a, b) {
  if (b === undefined) return a;
  if (Array.isArray(b) || typeof b !== 'object' || b === null) return b;
  const out = { ...(a || {}) };
  for (const k of Object.keys(b)) {
    out[k] = typeof b[k] === 'object' && b[k] !== null && !Array.isArray(b[k]) ? deepMerge(a?.[k], b[k]) : b[k];
  }
  return out;
}

export function resolveTheme(name, overrides) {
  const base = THEMES[name] || THEMES.neon;
  return deepMerge(base, overrides || {});
}
