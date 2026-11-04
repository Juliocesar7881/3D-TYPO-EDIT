// Rastros de luz (ribbons/tubos HDR com bloom): swirl, orbit, cross, wave.
// mode 'draw' = o traço se desenha e some (tipo Saber no AE); 'flow' = pulsos correndo.
import * as THREE from 'three';
import { RNG } from '../core/rng.js';
import { clamp, getEase } from '../core/easing.js';

function curvePoints(kind, rng, s) {
  const pts = [];
  const R = s.radius ?? 6;
  const L = s.length ?? 18;
  if (kind === 'swirl') {
    const turns = s.turns ?? rng.range(1.2, 2.2);
    const dir = rng.sign();
    const ph = rng.range(0, Math.PI * 2);
    for (let i = 0; i <= 80; i++) {
      const u = i / 80;
      const a = ph + dir * u * turns * Math.PI * 2;
      const r = R * (0.75 + 0.35 * Math.sin(u * Math.PI));
      pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r * 0.55 + (u - 0.5) * R * 0.3, (u - 0.5) * -L));
    }
  } else if (kind === 'orbit') {
    const tilt = rng.range(-0.6, 0.6);
    const yaw = rng.range(0, Math.PI);
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(Math.PI / 2 + tilt, yaw, rng.range(-0.3, 0.3)));
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * R * 1.25, Math.sin(a) * R * 1.25, 0).applyMatrix4(m));
    }
  } else if (kind === 'cross') {
    const side = rng.sign();
    const y0 = rng.range(-0.8, 0.8) * R;
    const z0 = rng.range(-0.6, 0.9) * R;
    const ang = rng.range(-0.5, 0.5);
    for (let i = 0; i <= 40; i++) {
      const u = i / 40 - 0.5;
      const x = u * L * 2.2 * side;
      pts.push(new THREE.Vector3(x, y0 + x * Math.tan(ang) + Math.sin(u * 3) * R * 0.1, z0 + Math.cos(u * 2.5) * R * 0.4));
    }
  } else {
    // wave
    const y0 = rng.range(-1, 1) * R * 0.6;
    const z0 = rng.range(-1.2, -0.3) * R;
    const amp = rng.range(0.3, 0.9) * R * 0.4;
    const f = rng.range(1.5, 3);
    const ph = rng.range(0, 6.28);
    for (let i = 0; i <= 60; i++) {
      const u = i / 60 - 0.5;
      pts.push(new THREE.Vector3(u * L * 2, y0 + Math.sin(u * f * 6.28 + ph) * amp, z0 + Math.cos(u * f * 3 + ph) * amp));
    }
  }
  return pts;
}

export class Streak {
  /**
   * cfg: { kind, mode, colors:[c1,c2], radius, length, width, intensity, speed, t0, dur, seed, closed }
   */
  constructor(cfg, ctx) {
    const rng = new RNG(cfg.seed ?? 3);
    const kind = cfg.kind || 'swirl';
    const pts = cfg.points ? cfg.points.map((p) => new THREE.Vector3(...p)) : curvePoints(kind, rng, cfg);
    const closed = cfg.closed ?? kind === 'orbit';
    const curve = new THREE.CatmullRomCurve3(pts, closed, 'centripetal');
    const segs = Math.round((cfg.segments ?? 220) * (ctx.quality?.geoScale ?? 1));
    const geo = new THREE.TubeGeometry(curve, segs, cfg.width ?? 0.06, 6, closed);
    const c1 = new THREE.Color(cfg.colors?.[0] || '#ffffff');
    const c2 = new THREE.Color(cfg.colors?.[1] || cfg.colors?.[0] || '#2de2ff');
    this.uniforms = {
      uTime: { value: 0 },
      uC1: { value: c1 },
      uC2: { value: c2 },
      uIntensity: { value: cfg.intensity ?? 3.2 },
      uHead: { value: 0 },
      uTail: { value: cfg.tail ?? 0.35 },
      uMode: { value: cfg.mode === 'flow' ? 1 : 0 },
      uSpeed: { value: cfg.speed ?? 0.5 },
      uOpacity: { value: 1 },
      uPhase: { value: rng.float() },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){ vUv = uv; vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uIntensity, uHead, uTail, uMode, uSpeed, uOpacity, uPhase; uniform vec3 uC1, uC2;
        varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){
          float x = vUv.x;
          float a;
          float hot;
          if (uMode < 0.5) {
            float d = uHead - x;
            a = (d >= 0.0) ? exp(-d / max(uTail, 1e-3)) : 0.0;
            a *= smoothstep(0.0, 0.02, uHead - x + 0.02);
            hot = exp(-max(d,0.0) / (uTail*0.15));
          } else {
            float h = fract(uTime * uSpeed + uPhase);
            float d = fract(h - x);
            a = exp(-d / max(uTail, 1e-3)) + 0.12;
            hot = exp(-d / (uTail*0.12));
          }
          // tubo: centro mais forte que as bordas (visual de feixe de luz)
          float facing = pow(abs(dot(vN, vV)), 1.5);
          vec3 col = mix(uC2, uC1, clamp(hot, 0.0, 1.0)) * uIntensity * (0.35 + 0.65*facing) * (1.0 + hot*1.5);
          a *= uOpacity;
          if (a < 0.002) discard;
          gl_FragColor = vec4(col * a, a);
        }`,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.object = this.mesh;
    this.cfg = cfg;
    this.t0 = cfg.t0 ?? 0;
    this.dur = cfg.dur ?? 1.2;
    this.tEnd = cfg.tEnd ?? this.t0 + this.dur + 1;
  }

  update(t) {
    const visible = t >= this.t0 - 0.05 && t <= this.tEnd;
    this.mesh.visible = visible;
    if (!visible) return;
    this.uniforms.uTime.value = t;
    if (this.cfg.mode !== 'flow') {
      const u = clamp((t - this.t0) / this.dur);
      this.uniforms.uHead.value = getEase(this.cfg.ease || 'outCubic')(u) * (1 + (this.cfg.tail ?? 0.35) * 3);
      this.uniforms.uOpacity.value = 1;
    } else {
      const fin = clamp((t - this.t0) / 0.25);
      const fout = clamp((this.tEnd - t) / 0.3);
      this.uniforms.uOpacity.value = fin * fout;
    }
  }
}
