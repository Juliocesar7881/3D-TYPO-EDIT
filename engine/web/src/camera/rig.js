// Câmera: cada shot tem um "rig" orbital em volta da âncora do texto
// (azimute, elevação, distância, roll, fov, alvo) que interpola de "from"
// para "to" durante o shot. Entre shots, os dois rigs são misturados com
// easing (whip / smooth / spin / zoom-through) + arco opcional, então o
// movimento é contínuo e fluido. Shake vem de noise + impulsos de beat.
import * as THREE from 'three';
import { getEase, clamp, lerp, deg } from '../core/easing.js';

const tmpV = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();

export const MOVES = {
  // nome: (k = intensidade 0..2) => { from, to, ease }
  push: (k) => ({ from: { az: -6 * k, el: 4, dist: 1.15, roll: -3 * k }, to: { az: 4 * k, el: 1, dist: 0.88, roll: 2 * k }, ease: 'outCubic' }),
  pull: (k) => ({ from: { az: 8 * k, el: 2, dist: 0.78, roll: 4 * k }, to: { az: -4 * k, el: 5, dist: 1.08, roll: -2 * k }, ease: 'outQuart' }),
  orbitL: (k) => ({ from: { az: 34 * k, el: 6, dist: 1.0, roll: -6 * k }, to: { az: -14 * k, el: 2, dist: 0.95, roll: 3 * k }, ease: 'outCubic' }),
  orbitR: (k) => ({ from: { az: -34 * k, el: 6, dist: 1.0, roll: 6 * k }, to: { az: 14 * k, el: 2, dist: 0.95, roll: -3 * k }, ease: 'outCubic' }),
  craneUp: (k) => ({ from: { az: 6, el: -26 * k, dist: 1.0, roll: 0 }, to: { az: -4, el: 8 * k, dist: 0.92, roll: 0 }, ease: 'outCubic' }),
  craneDown: (k) => ({ from: { az: -8, el: 32 * k, dist: 1.05, roll: 0 }, to: { az: 4, el: 4, dist: 0.9, roll: 0 }, ease: 'outCubic' }),
  dutch: (k) => ({ from: { az: -12 * k, el: 3, dist: 0.98, roll: -16 * k }, to: { az: 8 * k, el: 2, dist: 0.9, roll: 9 * k }, ease: 'inOutSine' }),
  hero: (k) => ({ from: { az: -18 * k, el: -24, dist: 0.95, roll: 4 * k }, to: { az: -6 * k, el: -17, dist: 0.8, roll: 1 }, ease: 'outCubic' }),
  topDown: (k) => ({ from: { az: 0, el: 62, dist: 1.05, roll: 20 * k }, to: { az: 0, el: 38, dist: 0.95, roll: 0 }, ease: 'outQuart' }),
  spiral: (k) => ({ from: { az: -70 * k, el: 18, dist: 1.25, roll: -28 * k }, to: { az: 10 * k, el: 2, dist: 0.88, roll: 0 }, ease: 'outExpo' }),
  slideL: (k) => ({ from: { az: 22 * k, el: 3, dist: 0.9, roll: 0, tx: 0.35 }, to: { az: 22 * k, el: 3, dist: 0.9, roll: 0, tx: -0.35 }, ease: 'inOutSine' }),
  slideR: (k) => ({ from: { az: -22 * k, el: 3, dist: 0.9, roll: 0, tx: -0.35 }, to: { az: -22 * k, el: 3, dist: 0.9, roll: 0, tx: 0.35 }, ease: 'inOutSine' }),
  macro: (k) => ({ from: { az: 28 * k, el: 6, dist: 0.55, roll: -8, tx: -0.38 }, to: { az: 18 * k, el: 3, dist: 0.62, roll: -4, tx: 0.38 }, ease: 'inOutCubic' }),
  rollIn: (k) => ({ from: { az: 0, el: 0, dist: 1.2, roll: -90 * k }, to: { az: 0, el: 0, dist: 0.92, roll: 0 }, ease: 'outExpo' }),
  static: () => ({ from: { az: 0, el: 0, dist: 1.0, roll: 0 }, to: { az: 0, el: 0, dist: 0.97, roll: 0 }, ease: 'linear' }),
};

function poseDefaults(p) {
  return { az: 0, el: 0, dist: 1, roll: 0, fov: null, tx: 0, ty: 0, tz: 0, ...p };
}

export class ShotRig {
  /**
   * anchor: THREE.Object3D (âncora do shot, define o frame local)
   * p: { start, end, move, k, from, to, ease, baseDist, fov }
   */
  constructor(anchor, p) {
    this.anchor = anchor;
    this.start = p.start;
    this.end = p.end;
    const preset = (MOVES[p.move] || MOVES.push)(p.k ?? 1);
    this.from = poseDefaults({ ...preset.from, ...(p.from || {}) });
    this.to = poseDefaults({ ...preset.to, ...(p.to || {}) });
    this.ease = getEase(p.ease || preset.ease);
    this.baseDist = p.baseDist ?? 12;
    this.fov = p.fov ?? 40;
    this.extend = p.extend ?? 0.6; // o rig continua derivando além do fim (para blends)
    // a câmera persegue a palavra que acabou de entrar (shots com várias palavras)
    this.focusTrack = (p.focusTrack || []).slice().sort((a, b) => a.t - b.t);
    this.follow = p.follow ?? 0;
    this.followDur = p.followDur ?? 0.38;
  }

  focusAt(t) {
    const tr = this.focusTrack;
    if (!tr.length || !this.follow) return null;
    const f = new THREE.Vector3(...tr[0].p);
    const ease = getEase('inOutCubic');
    for (let k = 1; k < tr.length; k++) {
      const u = clamp((t - tr[k].t + 0.06) / this.followDur);
      if (u <= 0) break;
      f.lerp(new THREE.Vector3(...tr[k].p), ease(u));
    }
    return f.multiplyScalar(this.follow);
  }

  // pose no tempo t (pode extrapolar levemente fora de [start, end])
  sample(t, out) {
    const span = Math.max(0.001, this.end - this.start);
    let u = (t - this.start) / span;
    // fora do intervalo: continua com velocidade suave (linear) para o blend não travar
    let e;
    if (u < 0) {
      const d = 1e-3;
      const v = (this.ease(d) - this.ease(0)) / d;
      e = v * u * 0.6;
    } else if (u > 1) {
      const d = 1e-3;
      const v = (this.ease(1) - this.ease(1 - d)) / d;
      e = 1 + v * (u - 1) * 0.6;
    } else e = this.ease(u);
    const f = this.from, g = this.to;
    const az = deg(lerp(f.az, g.az, e));
    const el = deg(lerp(f.el, g.el, e));
    const dist = lerp(f.dist, g.dist, e) * this.baseDist;
    const roll = deg(lerp(f.roll, g.roll, e));
    const fov = lerp(f.fov ?? this.fov, g.fov ?? this.fov, e);
    const tx = lerp(f.tx, g.tx, e), ty = lerp(f.ty, g.ty, e), tz = lerp(f.tz, g.tz, e);
    // alvo e posição no frame local da âncora (texto olhando para +Z)
    const target = new THREE.Vector3(tx * this.baseDist, ty * this.baseDist, tz * this.baseDist);
    const focus = this.focusAt(t);
    if (focus) target.add(focus);
    const pos = new THREE.Vector3(
      Math.sin(az) * Math.cos(el) * dist,
      Math.sin(el) * dist,
      Math.cos(az) * Math.cos(el) * dist
    ).add(target);
    this.anchor.updateMatrixWorld();
    pos.applyMatrix4(this.anchor.matrixWorld);
    target.applyMatrix4(this.anchor.matrixWorld);
    // "up" do frame local para o roll ficar relativo ao texto
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.anchor.getWorldQuaternion(tmpQ));
    out.pos = pos;
    out.target = target;
    out.up = up;
    out.roll = roll;
    out.fov = fov;
    return out;
  }
}

export class CameraDirector {
  constructor(camera, { noise, audio, shake = 0.5, aspect = 16 / 9 }) {
    this.camera = camera;
    this.noise = noise;
    this.audio = audio;
    this.shakeAmt = shake;
    this.rigs = []; // { rig, transIn: {dur, ease, style, arc, spin, at} }
    this.aspect = aspect;
    this.impulses = []; // {t, amp, decay}
    this.fovKicks = []; // {t, amp, decay}
  }

  add(rig, trans) {
    this.rigs.push({ rig, trans: trans || { dur: 0.4, style: 'whip' } });
  }

  addImpulse(t, amp = 1, decay = 0.25) { this.impulses.push({ t, amp, decay }); }
  addFovKick(t, amp = 6, decay = 0.25) { this.fovKicks.push({ t, amp, decay }); }

  _findIndex(t) {
    // shot ativo = último cujo start <= t (considerando a janela de transição)
    let idx = 0;
    for (let i = 0; i < this.rigs.length; i++) {
      if (t >= this.rigs[i].rig.start) idx = i;
    }
    return idx;
  }

  pose(t) {
    if (!this.rigs.length) return null;
    const out = {};
    const i = this._findIndex(t);
    const cur = this.rigs[i];
    const next = this.rigs[i + 1];
    let A = cur.rig.sample(t, {});
    // 1) transição de entrada ainda em andamento (parte depois do start)
    if (i > 0) {
      const tr = cur.trans;
      const lead = tr.lead ?? 0.62;
      const a = cur.rig.start - tr.dur * lead;
      const b = a + tr.dur;
      if (t < b && tr.style !== 'cut') {
        const u = clamp((t - a) / tr.dur);
        const P = this.rigs[i - 1].rig.sample(t, {});
        A = this._blend(P, A, u, tr);
      }
    }
    // 2) transição para o próximo shot começa antes do start dele
    if (next) {
      const tr = next.trans;
      const lead = tr.lead ?? 0.62;
      const a = next.rig.start - tr.dur * lead;
      if (t >= a && tr.style !== 'cut') {
        const u = clamp((t - a) / tr.dur);
        const B = next.rig.sample(t, {});
        A = this._blend(A, B, u, tr);
      }
    }
    Object.assign(out, A);
    return out;
  }

  _blend(A, B, u, tr) {
    const style = tr.style || 'whip';
    const ease = getEase(tr.ease || (style === 'smooth' ? 'inOutSine' : style === 'zoom' ? 'inOutExpo' : 'whip'));
    const e = ease(u);
    const pos = A.pos.clone().lerp(B.pos, e);
    // o olhar vira para o próximo texto antes da posição chegar (menos frame vazio no voo)
    const eT = tr.lookAhead === false ? e : 1 - Math.pow(1 - e, 2.2);
    const target = A.target.clone().lerp(B.target, eT);
    // arco: desvia o caminho perpendicularmente (swoop)
    const arc = tr.arc ?? (style === 'smooth' ? 0.15 : 0.28);
    if (arc) {
      const dir = B.pos.clone().sub(A.pos);
      const len = dir.length();
      if (len > 1e-3) {
        const side = new THREE.Vector3().crossVectors(dir, A.up).normalize();
        const lift = A.up.clone().multiplyScalar(0.5);
        const off = side.multiplyScalar(tr.arcSide ?? 1).add(lift).normalize().multiplyScalar(Math.sin(Math.PI * e) * len * arc);
        pos.add(off);
        target.add(off.multiplyScalar(0.5));
      }
    }
    const up = A.up.clone().lerp(B.up, e).normalize();
    let roll = lerp(A.roll, B.roll, e);
    if (style === 'spin') roll += Math.PI * 2 * (tr.spins ?? 1) * (tr.spinDir ?? 1) * e;
    if (style === 'whip') roll += Math.sin(Math.PI * e) * deg(tr.whipRoll ?? 10) * (tr.spinDir ?? 1);
    let fov = lerp(A.fov, B.fov, e);
    if (style === 'zoom' || style === 'whip') fov += Math.sin(Math.PI * e) * (tr.fovPunch ?? (style === 'zoom' ? 18 : 6));
    return { pos, target, up, roll, fov };
  }

  apply(t) {
    const P = this.pose(t);
    if (!P) return;
    const cam = this.camera;
    // shake: base constante leve + impulsos (beat/hit)
    let amp = 0.02 * this.shakeAmt;
    for (const im of this.impulses) {
      const d = t - im.t;
      if (d >= 0 && d < im.decay * 6) amp += im.amp * this.shakeAmt * Math.exp(-d / im.decay);
    }
    if (this.audio && this.audio.hasAudio) amp += this.audio.hitPulse(t, 0.16) * 0.12 * this.shakeAmt;
    const n = this.noise;
    const f = 9.0;
    const sx = n(t * f, 0.3, 11) * amp, sy = n(t * f, 5.1, 3) * amp, sr = n(t * f * 0.7, 9.7, 17) * amp * 0.6;
    const dist = P.pos.distanceTo(P.target);
    cam.position.copy(P.pos);
    cam.up.copy(P.up);
    cam.lookAt(P.target);
    // roll em volta do eixo de visão
    cam.rotateZ(P.roll + sr * 0.35);
    // shake em espaço de câmera (proporcional à distância)
    tmpV.set(sx * dist * 0.08, sy * dist * 0.08, 0).applyQuaternion(cam.quaternion);
    cam.position.add(tmpV);
    let fov = P.fov;
    for (const k of this.fovKicks) {
      const d = t - k.t;
      if (d >= 0 && d < k.decay * 6) fov -= k.amp * Math.exp(-d / k.decay) * (1 - Math.exp(-d / 0.02));
    }
    cam.fov = clamp(fov, 8, 120);
    cam.updateProjectionMatrix();
  }
}
