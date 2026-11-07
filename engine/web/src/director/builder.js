// Constrói o mundo 3D a partir do plano do diretor.
import * as THREE from 'three';
import { RNG } from '../core/rng.js';
import { Word3D } from '../text/word.js';
import { Particles } from '../world/particles.js';
import { Streak } from '../world/streaks.js';
import { Prop, RingTunnel } from '../world/props.js';
import { ShotRig, CameraDirector } from '../camera/rig.js';
import { GlassShards, Lightning, Sparks, LightBeams, BackGlow } from '../world/fx3d.js';
import { MediaCard } from '../world/media.js';
import { Spectrum } from '../world/spectrum.js';
import { clamp } from '../core/easing.js';

const CANDY_KINDS = { hearts: 'heart', stars: 'star', gumballs: 'gumball', clouds: 'cloud', lollipops: 'lollipop', donuts: 'donut', pills: 'pill', cubes: 'cube' };

function resolveColorToken(c, palette) {
  if (typeof c === 'string' && c.startsWith('$p')) return palette[parseInt(c.slice(2), 10) % palette.length];
  return c;
}

// partículas com janela de tempo (sparkle burst por shot)
class TimedParticles extends Particles {
  constructor(cfg, ctx) {
    super(cfg, ctx);
    this.t0 = cfg.t0 ?? 0;
    this.t1 = cfg.t1 ?? 1e9;
    this.baseOpacity = cfg.opacity ?? 1;
  }
  update(t, fctx) {
    const vis = t >= this.t0 && t <= this.t1 + 0.4;
    this.points.visible = vis;
    if (!vis) return;
    super.update(t, fctx);
    this.uniforms.uOpacity.value = this.baseOpacity * clamp((t - this.t0) / 0.3) * clamp((this.t1 + 0.4 - t) / 0.4);
  }
}

function buildDecor(d, shot, anchor, ctx, theme, nextShot, worldRoot, updatables) {
  const r = new RNG(d.seed);
  const S = d.S;
  const t0 = d.t0, t1 = d.t1;
  const pal = theme.palette;
  const add = (obj, parent = anchor) => { parent.add(obj.object); updatables.push(obj); return obj; };
  switch (d.type) {
    case 'glassShards': {
      add(new GlassShards({ S, blockW: d.blockW, blockH: d.blockH, count: r.int(12, 20), t0: shot.start - 0.05, t1, seed: d.seed, tint: r.pick(['#d8ecff', '#ffffff', d.accent]), edge: r.chance(0.5) ? '#ffffff' : d.accent }));
      break;
    }
    case 'lightning': {
      add(new Lightning({ S, blockW: d.blockW, blockH: d.blockH, count: r.int(2, 4), color: d.accent, t0: shot.start, t1, seed: d.seed, resolution: [ctx.W || 1920, ctx.H || 1080] }));
      break;
    }
    case 'sparks': {
      const ev = [shot.start];
      if (ctx.audio && ctx.audio.hasAudio) {
        for (const o of ctx.audio.strongOnsets) {
          if (o.t > shot.start + 0.25 && o.t < t1 - 0.1 && o.s > 0.7 && ev.length < 3 && o.t - ev[ev.length - 1] > 0.35) ev.push(o.t);
        }
      }
      add(new Sparks({ S, blockW: d.blockW, blockH: d.blockH, events: ev, perEvent: r.int(50, 80), color: r.chance(0.5) ? d.accent : '#ffb36b', seed: d.seed }));
      break;
    }
    case 'beams': {
      add(new LightBeams({ S, count: r.int(3, 5), color: d.accent, t0, t1, seed: d.seed }));
      break;
    }
    case 'spectrum': {
      add(new Spectrum({ S, blockW: d.blockW, blockH: d.blockH, color: d.accent, color2: d.accent2, t0, t1, seed: d.seed, ring: r.chance(0.35) }, ctx));
      break;
    }
    case 'glow': {
      add(new BackGlow({ S, color: d.accent, t0, t1, intensity: 0.8 }));
      break;
    }
    case 'chromeStars': {
      const n = r.int(4, 7);
      for (let i = 0; i < n; i++) {
        let [x, y] = [r.range(-1, 1), r.range(-1, 1)];
        if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5) x = Math.sign(x || 1) * r.range(0.55, 1);
        add(new Prop({ kind: 'star', material: { type: 'chrome', color: r.chance(0.5) ? '#ffffff' : d.accent }, pos: [x * (d.blockW * 0.6 + S * 0.2), y * (d.blockH * 0.6 + S * 0.2), -S * r.range(-0.2, 0.6)], scale: S * r.range(0.05, 0.1), spin: [r.range(-1.2, 1.2), r.range(-1.6, 1.6), r.range(-0.8, 0.8)], bob: S * 0.02, t0: t0 + i * 0.04, t1, inAnim: 'pop', seed: d.seed + i }, ctx));
      }
      break;
    }
    case 'streakSwirl': {
      const n = r.int(1, 2);
      for (let i = 0; i < n; i++) {
        add(new Streak({ kind: 'swirl', mode: 'draw', radius: S * r.range(0.5, 0.72), length: S * r.range(1.2, 1.8), width: Math.max(0.025, S * 0.012), colors: i ? [d.accent2, d.accent] : ['#ffffff', d.accent], intensity: 2.5, t0: shot.start - 0.15 + i * 0.12, dur: r.range(0.8, 1.3), tEnd: t1 + 0.2, tail: r.range(0.25, 0.45), seed: d.seed + i }, ctx));
      }
      break;
    }
    case 'streakCross': {
      const n = r.int(2, 4);
      for (let i = 0; i < n; i++) {
        add(new Streak({ kind: 'cross', mode: 'draw', radius: S * 0.55, length: S * r.range(1.4, 2.2), width: Math.max(0.02, S * 0.007), colors: [r.pick(['#ffffff', d.accent2]), d.accent], intensity: 2.6, t0: shot.start - 0.1 + i * r.range(0.06, 0.18), dur: r.range(0.5, 0.9), tEnd: t1 + 0.2, tail: 0.3, ease: 'outQuart', seed: d.seed + i * 13 }, ctx));
      }
      break;
    }
    case 'streakOrbit': {
      const n = r.int(1, 2);
      for (let i = 0; i < n; i++) {
        add(new Streak({ kind: 'orbit', mode: 'flow', radius: S * r.range(0.48, 0.62), width: Math.max(0.02, S * 0.008), colors: ['#ffffff', i ? d.accent2 : d.accent], intensity: 2.4, speed: r.range(0.4, 0.8) * r.sign(), tail: 0.45, t0, tEnd: t1, seed: d.seed + i * 7 }, ctx));
      }
      break;
    }
    case 'neonRing': {
      add(new Prop({ kind: 'neonRing', radius: S * r.range(0.55, 0.7), tube: S * 0.01, double: true, color2: d.accent2, material: { type: 'neon', color: d.accent, intensity: 2.4 }, pos: [0, 0, -S * r.range(0.25, 0.45)], rot: [r.range(-0.5, 0.5), r.range(-0.4, 0.4), 0], spin: [0, 0, r.range(-0.6, 0.6)], bob: 0, t0, t1, inAnim: 'grow', seed: d.seed, reactive: 0.05 }, ctx));
      break;
    }
    case 'glassRing': {
      add(new Prop({ kind: 'glassRing', radius: S * r.range(0.5, 0.62), tube: S * 0.11, material: { type: 'glass', color: d.accent, opacity: 0.25 }, rimColor: d.accent, pos: [0, 0, -S * 0.05], rot: [r.range(-0.9, 0.9), r.range(-0.5, 0.5), 0], spin: [r.range(-0.3, 0.3), r.range(-0.3, 0.3), r.range(-0.4, 0.4)], bob: 0, t0, t1, inAnim: 'grow', seed: d.seed }, ctx));
      break;
    }
    case 'halo': {
      add(new Prop({ kind: 'halo', radius: S * 0.85, color: d.accent, intensity: 1.4, pos: [0, 0, -S * 0.55], spin: [0, 0, 0], bob: 0, t0, t1, inAnim: 'grow', seed: d.seed }, ctx));
      break;
    }
    case 'shards': {
      const n = Math.round(r.range(8, 14));
      const mat = r.chance(0.5) ? { type: 'chrome', color: d.accent } : { type: 'iridescent', color: '#ffffff' };
      for (let i = 0; i < n; i++) {
        let [x, y, z] = r.onSphere();
        if (Math.abs(x) < 0.45 && Math.abs(y) < 0.45) { x += Math.sign(x || 1) * 0.5; }
        const rad = S * r.range(0.55, 0.95);
        add(new Prop({ kind: r.pick(['crystal', 'shard', 'shard']), material: mat, pos: [x * rad * 1.1, y * rad * 0.7, z * rad * 0.6 - S * 0.1], scale: S * r.range(0.035, 0.09), spin: [r.range(-2, 2), r.range(-2, 2), r.range(-1, 1)], bob: S * 0.02, t0: t0 + i * 0.025, t1, inAnim: 'pop', seed: d.seed + i }, ctx));
      }
      break;
    }
    case 'sparkleBurst': {
      add(new TimedParticles({ type: 'sparkle', count: 110, size: [S * 0.012, S * 0.05], colors: ['#ffffff', d.accent, d.accent2], intensity: 2.2, drift: S * 0.05, twinkle: 1, regions: [{ c: [0, 0, 0], r: S * 0.75, flat: 0.7 }], seed: d.seed, t0, t1, maxPx: 90 }, ctx));
      break;
    }
    case 'lasers': {
      const n = r.int(3, 5);
      for (let i = 0; i < n; i++) {
        add(new Prop({ kind: 'laser', length: S * 6, width: Math.max(0.015, S * 0.004), color: r.pick([d.accent, d.accent2, '#ffffff']), intensity: 3.0, pos: [0, r.range(-0.6, 0.6) * S, -S * r.range(0.5, 1.4)], rot: [r.range(-0.4, 0.4), r.range(-0.6, 0.6), r.range(-0.8, 0.8)], spin: [0, 0, r.range(-0.15, 0.15)], bob: 0, t0: t0 + i * 0.05, t1, inAnim: 'grow', seed: d.seed + i, reactive: 0.4 }, ctx));
      }
      break;
    }
    case 'tunnel': {
      if (!nextShot) break;
      const a = new THREE.Vector3(...shot.anchor.pos);
      const b = new THREE.Vector3(...nextShot.anchor.pos);
      const dir = b.clone().sub(a);
      const A = a.clone().addScaledVector(dir, 0.38), B = a.clone().addScaledVector(dir, 0.86);
      const tun = new RingTunnel({ a: A.toArray(), b: B.toArray(), count: 16, radius: Math.max(S * 0.6, 4), tube: Math.max(0.04, S * 0.008), colors: [d.accent, d.accent2], t0: nextShot.start - (nextShot.transition?.dur ?? 0.4), t1: nextShot.start + 0.1 }, ctx);
      worldRoot.add(tun.object);
      updatables.push(tun);
      break;
    }
    case 'grid':
    case 'checker': {
      const floorColors = d.type === 'checker' ? [r.pick(pal), '#ffffff'] : [d.accent, d.accent2];
      add(new Prop({ kind: d.type, size: S * 40, cell: S * 0.22, color: floorColors[0], color2: floorColors[1], intensity: 1.5, fade: S * 4, pos: [0, -d.blockH * 0.5 - S * 0.35, 0], spin: [0, 0, 0], bob: 0, t0, t1, inAnim: 'fade', outAnim: 'fade', seed: d.seed }, ctx));
      break;
    }
    default: {
      const kind = CANDY_KINDS[d.type];
      if (!kind) break;
      const n = r.int(3, 6);
      const a0 = r.range(0, Math.PI * 2);
      for (let i = 0; i < n; i++) {
        const a = a0 + (i / n) * Math.PI * 2 + r.range(-0.3, 0.3);
        const rx = d.blockW * 0.55 + S * r.range(0.15, 0.32);
        const ry = d.blockH * 0.55 + S * r.range(0.15, 0.3);
        const color = r.pick(pal);
        add(new Prop({ kind, color, color2: '#ffffff', material: { type: kind === 'cloud' ? 'glossy' : 'candy', color: kind === 'cloud' ? '#ffffff' : color }, outline: theme.background?.kind === 'candy' ? '#ffffff' : null, pos: [Math.cos(a) * rx, Math.sin(a) * ry, -S * r.range(0.05, 0.45)], scale: S * r.range(0.08, 0.15) * (kind === 'cloud' ? 1.5 : 1), rot: [r.range(-0.4, 0.4), r.range(-0.6, 0.6), r.range(-0.5, 0.5)], spin: [r.range(-0.5, 0.5), r.range(-1, 1), r.range(-0.4, 0.4)], bob: S * 0.03, t0: t0 + 0.08 + i * 0.05, t1, inAnim: 'pop', seed: d.seed + i, reactive: 0.15 }, ctx));
      }
    }
  }
}

export function buildWorld(plan, theme, fonts, ctx, env, media = null) {
  const scene = new THREE.Scene();
  scene.environment = env;
  const camera = new THREE.PerspectiveCamera(40, ctx.aspect, 0.05, 3000);
  scene.add(camera);
  const isCandy = theme.background?.kind === 'candy';
  const hemi = new THREE.HemisphereLight('#ffffff', isCandy ? '#ffd0ea' : '#1a1030', isCandy ? 1.1 : 0.45);
  scene.add(hemi);
  const key = new THREE.DirectionalLight('#ffffff', isCandy ? 2.0 : 1.3);
  key.position.set(-4, 6, 3);
  const keyTarget = new THREE.Object3D();
  keyTarget.position.set(0, 0, -10);
  camera.add(key);
  camera.add(keyTarget);
  key.target = keyTarget;
  const rim = new THREE.DirectionalLight(isCandy ? '#ffffff' : theme.palette[1] || '#ff2bd6', isCandy ? 0.6 : 1.2);
  rim.position.set(6, -2, -4);
  const rimTarget = new THREE.Object3D();
  rimTarget.position.set(0, 0, -10);
  camera.add(rim);
  camera.add(rimTarget);
  rim.target = rimTarget;

  const updatables = [];
  const camDir = new CameraDirector(camera, { noise: ctx.noise, audio: ctx.audio, shake: ctx.shake, aspect: ctx.aspect });
  const anchors = [];

  plan.shots.forEach((shot, si) => {
    const anchor = new THREE.Group();
    anchor.name = 'shot' + si;
    anchor.position.set(...shot.anchor.pos);
    anchor.rotation.set(...shot.anchor.rot);
    scene.add(anchor);
    anchor.updateMatrixWorld(true);
    anchors.push(anchor);
    for (const wp of shot.words) {
      const font = fonts[wp.font] || fonts.anton;
      const word = new Word3D({
        text: wp.text, font, size: wp.size, tracking: wp.tracking, style: wp.style, anim: wp.anim,
        t0: wp.t0, tOut: wp.tOut, letterLayout: wp.letterLayout, viewDist: wp.viewDist, seed: (ctx.seed * 31 + si * 977 + wp.t0 * 1000) >>> 0,
      }, ctx);
      const holder = new THREE.Group();
      holder.position.set(...wp.pos);
      holder.rotation.set(...wp.rot);
      holder.add(word.group);
      anchor.add(holder);
      if (wp.letterLayout === 'ring') {
        const spin = (wp.spin ?? 0.6) * (si % 2 ? 1 : -1);
        updatables.push({ update: (t) => { holder.rotation.z = wp.rot[2] + spin * (t - wp.t0); } });
      }
      updatables.push(word);
    }
    for (const d of shot.decor) buildDecor(d, shot, anchor, ctx, theme, plan.shots[si + 1], scene, updatables);
    const followDefault = { cascade: 1, line: 0.45, stack: 0.3 }[shot.layout] ?? 0;
    const rig = new ShotRig(anchor, {
      start: shot.start, end: shot.end, move: shot.camera.move, k: shot.camera.k, from: shot.camera.from, to: shot.camera.to,
      ease: shot.camera.ease, baseDist: shot.camera.baseDist, fov: shot.camera.fov,
      focusTrack: shot.words.map((w) => ({ t: w.t0, p: w.pos })),
      follow: shot.camera.follow ?? (shot.words.length > 1 ? followDefault : 0),
    });
    camDir.add(rig, shot.transition || { dur: 0.4, style: 'cut' });
  });
  for (const im of plan.impulses) camDir.addImpulse(im.t, im.amp, im.decay);
  for (const fk of plan.fovKicks) camDir.addFovKick(fk.t, fk.amp, fk.decay);

  // partículas globais ao longo do caminho
  const regions = plan.shots.map((s) => ({ c: s.anchor.pos, r: s.block.S * 1.3 + 8 }));
  const segments = [];
  for (let i = 0; i < plan.shots.length - 1; i++) {
    segments.push({ a: plan.shots[i].anchor.pos, b: plan.shots[i + 1].anchor.pos, r: Math.max(plan.shots[i].block.S, plan.shots[i + 1].block.S) * 0.9 + 9 });
  }
  const totalLen = segments.reduce((s, g) => s + Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1], g.b[2] - g.a[2]), 0);
  const lenFactor = clamp(totalLen / 400, 0.6, 3);
  (theme.particles || []).forEach((pc, k) => {
    const colors = (pc.colors || ['#ffffff']).map((c) => resolveColorToken(c, theme.palette));
    const isDust = pc.type === 'dust';
    const p = new Particles({ ...pc, colors, count: Math.round((pc.count ?? 2000) * (isDust ? lenFactor : clamp(plan.shots.length / 8, 0.6, 2.5))), regions, segments: isDust ? segments : [], seed: ctx.seed * 13 + k }, ctx);
    scene.add(p.object);
    updatables.push(p);
  });

  // cards de foto/vídeo: presos à âncora do shot ativo em t0, alternando lados
  if (media) {
    media.cards().forEach((item, k) => {
      let si = 0;
      plan.shots.forEach((s, i) => { if (item.t0 >= s.start - 0.3) si = i; });
      const s = plan.shots[si];
      const card = new MediaCard(item, { S: s.block.S, blockW: s.block.w, blockH: s.block.h, accent: s.accent, slot: k });
      anchors[si].add(card.object);
      updatables.push(card);
    });
  }
  return { scene, camera, camDir, updatables, anchors };
}
