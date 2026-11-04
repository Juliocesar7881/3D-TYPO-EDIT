// Uma palavra 3D: cada letra é um pivô próprio (animação por letra), com
// face extrudada, contorno opcional (neon / adesivo candy) e sombra.
import * as THREE from 'three';
import { glyphGeometry } from './glyphs.js';
import { createMaterial, setMaterialState, shade } from '../world/materials.js';
import { resolveIn, resolveOut, resolveIdle, identity, combine } from './anims.js';
import { clamp } from '../core/easing.js';
import { hashString, mulberry32 } from '../core/rng.js';

function orderIndex(order, i, n, seed) {
  switch (order) {
    case 'reverse': return n - 1 - i;
    case 'center': return Math.abs(i - (n - 1) / 2);
    case 'edges': return (n - 1) / 2 - Math.abs(i - (n - 1) / 2);
    case 'random': {
      const r = mulberry32(seed + i * 7919);
      return r() * (n - 1);
    }
    default: return i;
  }
}

export class Word3D {
  /**
   * p: { text, font(LoadedFont), size, tracking, style, anim, t0, tOut, seed, palette }
   */
  constructor(p, ctx) {
    this.p = p;
    this.ctx = ctx;
    this.text = p.text;
    this.size = p.size ?? 1;
    this.t0 = p.t0 ?? 0;
    this.tOut = p.tOut ?? this.t0 + 1;
    this.seed = p.seed ?? hashString(p.text);
    this.group = new THREE.Group();
    this.group.name = 'word:' + p.text;
    this.letters = [];
    this.build();
  }

  build() {
    const { font } = this.p;
    const st = this.p.style || {};
    const tracking = this.p.tracking ?? st.tracking ?? 0.04;
    const chars = [...this.text];
    const q = this.ctx.quality || {};
    const geoOpts = {
      depth: st.depth ?? 0.22,
      bevel: st.bevel ?? 0.025,
      bevelSegments: q.bevelSegments ?? st.bevelSegments ?? 3,
      curveSegments: q.curveSegments ?? st.curveSegments ?? 8,
      strokeWidth: st.stroke?.width ?? 0,
      strokeWidth2: st.stroke2?.width ?? 0,
      plate: !!(st.shadow || st.plate),
    };
    // layout horizontal com kerning
    let x = 0;
    const placed = [];
    chars.forEach((ch, i) => {
      const adv = font.advance(ch);
      placed.push({ ch, x });
      x += adv + (i < chars.length - 1 ? font.kerning(ch, chars[i + 1]) + tracking : 0);
    });
    const width = x;
    this.width = width * this.size;
    this.height = this.size; // cap height
    const letterColors = st.letterColors;
    let li = 0;
    const nVisible = chars.filter((c) => c.trim()).length;
    placed.forEach(({ ch, x: lx }, idx) => {
      if (!ch.trim()) return;
      const g = glyphGeometry(font, ch, geoOpts);
      if (g.empty || !g.face) return;
      const pivot = new THREE.Group();
      const bx = lx + g.center[0] - width / 2;
      const by = g.center[1] - 0.5; // cap center em y=0
      pivot.position.set(bx, by, 0);
      const mats = [];
      // face + laterais
      const faceSpec = { ...(st.face || { type: 'chrome' }) };
      if (letterColors && letterColors.length) faceSpec.color = letterColors[li % letterColors.length];
      if (faceSpec.type === 'gradient' || faceSpec.type === 'gradient-glow') {
        faceSpec.range = [g.bbox.y1 - g.center[1], g.bbox.y2 - g.center[1]];
      }
      const faceMat = createMaterial(faceSpec, this.ctx);
      let sideSpec = st.side ? { ...st.side } : null;
      if (sideSpec && letterColors && letterColors.length && sideSpec.followLetter) {
        sideSpec.color = shade(letterColors[li % letterColors.length], sideSpec.followLetter);
      }
      const sideMat = sideSpec ? createMaterial(sideSpec, this.ctx) : faceMat;
      mats.push(faceMat);
      if (sideMat !== faceMat) mats.push(sideMat);
      const faceMesh = new THREE.Mesh(g.face, (st.depth ?? 0.22) > 0 ? [faceMat, sideMat] : faceMat);
      faceMesh.renderOrder = 2;
      if (st.face !== null && st.hideFace !== true) pivot.add(faceMesh);
      const depth = st.depth ?? 0.22;
      // contorno (neon ou adesivo)
      if (g.stroke && st.stroke) {
        const sMat = createMaterial(st.stroke.mat || { type: 'flat', color: '#ffffff' }, this.ctx);
        const sMesh = new THREE.Mesh(g.stroke, sMat);
        const zMode = st.stroke.z ?? 'back';
        sMesh.position.z = zMode === 'front' ? depth / 2 + 0.004 : zMode === 'center' ? 0 : -depth / 2 - 0.012;
        sMesh.renderOrder = 1;
        pivot.add(sMesh);
        mats.push(sMat);
        if (st.plate || zMode === 'back') {
          // preenche o miolo atrás da letra para o adesivo não ficar vazado
          if (g.plate) {
            const pMesh = new THREE.Mesh(g.plate, sMat);
            pMesh.position.z = sMesh.position.z - 0.001;
            pivot.add(pMesh);
          }
        }
      }
      // segundo contorno (núcleo quente do neon de tubo duplo)
      if (g.stroke2 && st.stroke2) {
        const s2Mat = createMaterial(st.stroke2.mat || { type: 'neon', color: '#ffffff', intensity: 3 }, this.ctx);
        const s2Mesh = new THREE.Mesh(g.stroke2, s2Mat);
        const z2 = st.stroke2.z ?? 'front';
        s2Mesh.position.z = z2 === 'front' ? depth / 2 + 0.008 : z2 === 'center' ? 0.004 : -depth / 2 - 0.006;
        s2Mesh.renderOrder = 3;
        pivot.add(s2Mesh);
        mats.push(s2Mat);
      }
      // sombra projetada "drop shadow" (chapa escura deslocada)
      if (st.shadow && g.plate) {
        const sh = st.shadow;
        const shMat = createMaterial({ type: 'flat', color: sh.color || '#000000', opacity: sh.opacity ?? 0.35 }, this.ctx);
        shMat.depthWrite = false;
        const group = new THREE.Group();
        const plate = new THREE.Mesh(g.plate, shMat);
        group.add(plate);
        if (g.stroke && st.stroke) group.add(new THREE.Mesh(g.stroke, shMat));
        const off = sh.offset || [0.06, -0.08];
        group.position.set(off[0], off[1], -depth / 2 - (sh.z ?? 0.05));
        group.renderOrder = 0;
        pivot.add(group);
        mats.push(shMat);
      }
      this.group.add(pivot);
      this.letters.push({ ch, pivot, base: pivot.position.clone(), baseRot: [0, 0, 0], baseScale: 1, mats, i: li, idx, seed: (this.seed + li * 2654435761) >>> 0, gx: lx + g.center[0] - width / 2 });
      li++;
    });
    this.n = nVisible;
    this.natWidth = width;
    this.applyLetterLayout(this.p.letterLayout || 'line');
    this.group.scale.setScalar(this.size);
  }

  // reposiciona as letras: line | vertical | arc | ring | scatter3d | wave
  applyLetterLayout(kind) {
    const n = this.letters.length;
    const W = Math.max(0.5, this.natWidth);
    if (kind === 'vertical') {
      this.letters.forEach((L, i) => {
        L.base.set(0, ((n - 1) / 2 - i) * 1.18, 0);
      });
    } else if (kind === 'arc') {
      const span = this.p.arcSpan ?? 1.7;
      const R = W / span;
      const sag = R * (1 - Math.cos(span / 2));
      this.letters.forEach((L) => {
        const a = L.gx / R;
        L.base.set(R * Math.sin(a), R * Math.cos(a) - R + sag / 2 + (L.base.y), 0);
        L.baseRot = [0, 0, -a];
      });
    } else if (kind === 'ring') {
      const R = (W * 1.18) / (2 * Math.PI) + 0.4;
      this.ringRadius = R;
      this.letters.forEach((L) => {
        const a = ((L.gx + W / 2) / (W * 1.18)) * Math.PI * 2;
        L.base.set(R * Math.sin(a), R * Math.cos(a), 0);
        L.baseRot = [0, 0, -a];
      });
    } else if (kind === 'scatter3d') {
      const Dv = Math.max(4, (this.p.viewDist ?? 14) / Math.max(0.3, this.size));
      const r = mulberry32(this.seed ^ 0xabcdef);
      this.letters.forEach((L) => {
        const z = (r() * 0.9 - 0.6) * Dv;
        const f = (Dv - z) / Dv;
        L.base.set(L.base.x * f, L.base.y * f, z);
        L.baseScale = f;
      });
    } else if (kind === 'wave') {
      this.letters.forEach((L, i) => L.base.setY(L.base.y + Math.sin(i * 0.9) * 0.22));
    }
    for (const L of this.letters) {
      L.pivot.position.copy(L.base);
      L.pivot.rotation.set(...L.baseRot);
      L.pivot.scale.setScalar(L.baseScale);
    }
  }

  get inSpan() {
    const a = this.p.anim || {};
    const pre = resolveIn(a.in || 'pop');
    const dur = a.inDur ?? pre.dur;
    const stg = this.stagger('in');
    return dur + stg * Math.max(0, this.n - 1);
  }

  stagger(kind) {
    const a = this.p.anim || {};
    const pre = kind === 'in' ? resolveIn(a.in || 'pop') : resolveOut(a.out || 'fade');
    let s = kind === 'in' ? a.stagger ?? pre.stagger : a.outStagger ?? pre.stagger;
    if (kind === 'in' && a.maxInSpan) {
      const dur = a.inDur ?? pre.dur;
      const maxS = (a.maxInSpan - dur) / Math.max(1, this.n - 1);
      s = Math.max(0, Math.min(s, maxS));
    }
    return s;
  }

  get endTime() {
    const a = this.p.anim || {};
    const pre = resolveOut(a.out || 'fade');
    return this.tOut + (a.outDur ?? pre.dur) + this.stagger('out') * this.n + 0.05;
  }

  update(t, frameCtx) {
    const a = this.p.anim || {};
    const inP = resolveIn(a.in || 'pop');
    const outP = resolveOut(a.out || 'fade');
    const idle = resolveIdle(a.idle || 'none');
    const inDur = a.inDur ?? inP.dur;
    const outDur = a.outDur ?? outP.dur;
    const sIn = this.stagger('in');
    const sOut = this.stagger('out');
    const visible = t >= this.t0 - 0.001 && t <= this.endTime;
    this.group.visible = visible;
    if (!visible) return;
    const amp = a.amp ?? 1;
    const dirBase = a.dir ?? 1;
    for (const L of this.letters) {
      const info = { i: L.i, n: this.n, seed: L.seed, dir: dirBase, amp };
      const oi = orderIndex(a.order, L.i, this.n, this.seed);
      const tin = t - (this.t0 + oi * sIn);
      const T = identity();
      if (tin < 0) {
        L.pivot.visible = false;
        continue;
      }
      combine(T, inP.fn(clamp(tin / inDur), info, t));
      combine(T, idle(t - this.t0, info, frameCtx));
      const ooi = orderIndex(a.outOrder || a.order, L.i, this.n, this.seed);
      const tout = t - (this.tOut + ooi * sOut);
      if (tout > 0) combine(T, outP.fn(clamp(tout / outDur), info, t));
      const op = clamp(T.op);
      L.pivot.visible = op > 0.002;
      if (!L.pivot.visible) continue;
      L.pivot.position.set(L.base.x + T.px, L.base.y + T.py, L.base.z + T.pz);
      L.pivot.rotation.set(L.baseRot[0] + T.rx, L.baseRot[1] + T.ry, L.baseRot[2] + T.rz);
      const bs = L.baseScale;
      L.pivot.scale.set(T.sx * bs, T.sy * bs, T.sz * bs);
      const flash = clamp(T.flash * (this.ctx.letterFlash ?? 1) + (frameCtx.wordFlash || 0));
      for (const m of L.mats) setMaterialState(m, op, flash);
    }
  }

  dispose() {
    for (const L of this.letters) for (const m of L.mats) m.dispose();
  }
}
