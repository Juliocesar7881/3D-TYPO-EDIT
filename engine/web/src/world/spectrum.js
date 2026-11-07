// Barras de espectro de áudio (como nas edits do frooky): fileira sob o texto
// ou anel em volta, reagindo às bandas de energia da música.
import * as THREE from 'three';
import { RNG } from '../core/rng.js';
import { clamp } from '../core/easing.js';

export class Spectrum {
  /** cfg: { S, blockW, blockH, color, color2, t0, t1, seed, ring, bars } */
  constructor(cfg, ctx) {
    this.cfg = cfg;
    this.audio = ctx.audio;
    const n = cfg.bars ?? 56;
    this.n = n;
    const r = new RNG(cfg.seed ?? 3);
    this.phase = Array.from({ length: n }, () => r.range(0, 6.28));
    const c1 = new THREE.Color(cfg.color || '#3fd2ff'), c2 = new THREE.Color(cfg.color2 || '#ff3fb4');
    const geo = new THREE.BoxGeometry(1, 1, 1);
    geo.translate(0, 0.5, 0); // cresce para cima a partir da base
    const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, n);
    this.mesh.frustumCulled = false;
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      col.copy(c1).lerp(c2, i / (n - 1)).multiplyScalar(2.2);
      this.mesh.setColorAt(i, col);
    }
    this.mat = mat;
    this.object = this.mesh;
    this.dummy = new THREE.Object3D();
    this.t0 = cfg.t0 ?? 0;
    this.t1 = cfg.t1 ?? this.t0 + 3;
  }
  level(i, t) {
    const a = this.audio;
    const u = i / (this.n - 1);
    const mirror = Math.abs(u - 0.5) * 2; // graves no centro, agudos nas pontas
    if (a && a.hasAudio) {
      const tt = t - mirror * 0.05;
      const band = mirror < 0.35 ? a.low(tt) : mirror < 0.7 ? a.mid(tt) : a.high(tt);
      return clamp(band * (0.55 + 0.45 * Math.sin(t * 7 + this.phase[i]) ** 2) * (1.15 - mirror * 0.4), 0.03, 1.4);
    }
    return 0.15 + 0.35 * Math.abs(Math.sin(t * 5 + this.phase[i]));
  }
  update(t) {
    const vis = t >= this.t0 && t <= this.t1 + 0.3;
    this.mesh.visible = vis;
    if (!vis) return;
    const S = this.cfg.S;
    const fade = clamp((t - this.t0) / 0.3) * clamp((this.t1 + 0.3 - t) / 0.3);
    this.mat.opacity = fade;
    const d = this.dummy;
    const ring = this.cfg.ring;
    const W = Math.max(this.cfg.blockW * 1.15, S * 0.9);
    const R = Math.max(this.cfg.blockW, this.cfg.blockH) * 0.62 + S * 0.08;
    for (let i = 0; i < this.n; i++) {
      const h = this.level(i, t) * S * 0.22 * fade + S * 0.004;
      const bw = (ring ? (2 * Math.PI * R) / this.n : W / this.n) * 0.55;
      if (ring) {
        const a = (i / this.n) * Math.PI * 2;
        d.position.set(Math.cos(a) * R, Math.sin(a) * R, -S * 0.2);
        d.rotation.set(0, 0, a - Math.PI / 2);
      } else {
        d.position.set(-W / 2 + (i + 0.5) * (W / this.n), -this.cfg.blockH * 0.55 - S * 0.12, 0);
        d.rotation.set(0, 0, 0);
      }
      d.scale.set(bw, h, bw * 0.4);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
