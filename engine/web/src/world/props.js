// Elementos 3D de cena: anéis (neon / vidro / halo / túnel), formas candy
// (coração, estrela, bala, cristal, nuvem, pirulito, rosquinha), chão (grid / xadrez)
// e lasers. Todos com entrada/saída animada e movimento como função de t.
import * as THREE from 'three';
import { RNG } from '../core/rng.js';
import { createMaterial, setMaterialState } from './materials.js';
import { clamp, getEase } from '../core/easing.js';
import { mergeSimple } from '../text/glyphs.js';

// ---------- geometrias de formas ----------
function heartShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.9);
  s.bezierCurveTo(-0.15, -0.72, -1.0, -0.25, -1.0, 0.25);
  s.bezierCurveTo(-1.0, 0.72, -0.55, 0.95, -0.28, 0.95);
  s.bezierCurveTo(-0.1, 0.95, 0, 0.78, 0, 0.62);
  s.bezierCurveTo(0, 0.78, 0.1, 0.95, 0.28, 0.95);
  s.bezierCurveTo(0.55, 0.95, 1.0, 0.72, 1.0, 0.25);
  s.bezierCurveTo(1.0, -0.25, 0.15, -0.72, 0, -0.9);
  return s;
}
function starShape(points = 5, inner = 0.48) {
  const s = new THREE.Shape();
  for (let i = 0; i <= points * 2; i++) {
    const r = i % 2 ? inner : 1;
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  return s;
}
const extrudeOpts = { depth: 0.45, bevelEnabled: true, bevelThickness: 0.18, bevelSize: 0.16, bevelSegments: 5, curveSegments: 18 };
const geoCache = {};
export function shapeGeometry(kind) {
  if (geoCache[kind]) return geoCache[kind];
  let g;
  switch (kind) {
    case 'heart': g = new THREE.ExtrudeGeometry(heartShape(), extrudeOpts); g.center(); break;
    case 'star': g = new THREE.ExtrudeGeometry(starShape(), { ...extrudeOpts, bevelSize: 0.1, bevelThickness: 0.14 }); g.center(); break;
    case 'gumball': g = new THREE.SphereGeometry(0.8, 40, 24); break;
    case 'crystal': g = new THREE.OctahedronGeometry(0.9, 0); g.scale(0.6, 1.3, 0.6); break;
    case 'shard': g = new THREE.TetrahedronGeometry(0.8, 0); g.scale(0.4, 1.4, 0.25); break;
    case 'cube': g = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1); break;
    case 'donut': g = new THREE.TorusGeometry(0.62, 0.3, 24, 64); break;
    case 'pill': g = new THREE.CapsuleGeometry(0.35, 0.8, 8, 24); break;
    case 'cloud': {
      const parts = [];
      const blobs = [[0, 0, 0, 0.62], [0.55, -0.1, 0.05, 0.48], [-0.55, -0.12, 0, 0.46], [0.25, 0.32, -0.05, 0.42], [-0.28, 0.28, 0.05, 0.4]];
      for (const [x, y, z, r] of blobs) { const sg = new THREE.SphereGeometry(r, 24, 16); sg.translate(x, y, z); parts.push(sg.toNonIndexed()); }
      g = new THREE.BufferGeometry();
      let n = 0; parts.forEach((p) => (n += p.attributes.position.count));
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
      let o = 0;
      for (const p of parts) { pos.set(p.attributes.position.array, o); nor.set(p.attributes.normal.array, o); o += p.attributes.position.array.length; }
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      break;
    }
    case 'lollipop': {
      g = new THREE.CylinderGeometry(0.85, 0.85, 0.28, 48, 1);
      g.rotateX(Math.PI / 2);
      break;
    }
    default: g = new THREE.IcosahedronGeometry(0.8, 1);
  }
  geoCache[kind] = g;
  return g;
}

// material espiral para o pirulito
function lollipopMaterial(c1, c2) {
  const m = createMaterial({ type: 'candy', color: '#ffffff' });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uA = { value: new THREE.Color(c1) };
    sh.uniforms.uB = { value: new THREE.Color(c2) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uA, uB; varying vec3 vLP;')
      .replace('vec4 diffuseColor = vec4( diffuse, opacity );', 'float ang = atan(vLP.y, vLP.x); float rr = length(vLP.xy); float sp = step(0.5, fract(ang/6.2831853*3.0 + rr*2.2)); vec4 diffuseColor = vec4(mix(uA, uB, sp), opacity);');
  };
  m.customProgramCacheKey = () => 'lolli';
  return m;
}

// ---------- prop genérico com entrada/saída ----------
export class Prop {
  /**
   * cfg: { kind, material:{...}, pos:[x,y,z], scale, rot:[..], spin:[x,y,z] (rad/s), bob,
   *        t0, t1, inAnim:'pop'|'fade'|'grow', outAnim, seed }
   */
  constructor(cfg, ctx) {
    this.cfg = cfg;
    const rng = new RNG(cfg.seed ?? 11);
    this.rng = rng;
    this.group = new THREE.Group();
    this.object = this.group;
    this.mats = [];
    this.t0 = cfg.t0 ?? 0;
    this.t1 = cfg.t1 ?? this.t0 + 3;
    this.baseScale = cfg.scale ?? 1;
    this.spin = cfg.spin || [rng.range(-0.6, 0.6), rng.range(-0.9, 0.9), rng.range(-0.4, 0.4)];
    this.phase = rng.range(0, 6.28);
    this.build(ctx);
    if (cfg.pos) this.group.position.set(...cfg.pos);
    this.basePos = this.group.position.clone();
    if (cfg.rot) this.group.rotation.set(...cfg.rot);
    this.baseRot = this.group.rotation.clone();
  }

  build(ctx) {
    const c = this.cfg;
    const kind = c.kind;
    if (kind === 'neonRing' || kind === 'ring') {
      const r = c.radius ?? 3;
      const g = new THREE.TorusGeometry(r, c.tube ?? 0.035 * r, 10, 160);
      const m = createMaterial(c.material || { type: 'neon', color: '#2de2ff', intensity: 3 });
      this.mats.push(m);
      this.group.add(new THREE.Mesh(g, m));
      if (c.double) {
        const m2 = createMaterial({ ...(c.material || { type: 'neon', color: '#ff2bd6', intensity: 3 }), color: c.color2 || '#ff2bd6' });
        const g2 = new THREE.TorusGeometry(r * 1.12, (c.tube ?? 0.035 * r) * 0.6, 8, 160);
        this.mats.push(m2);
        this.inner = new THREE.Mesh(g2, m2);
        this.group.add(this.inner);
      }
    } else if (kind === 'glassRing') {
      const r = c.radius ?? 3;
      const g = new THREE.TorusGeometry(r, c.tube ?? 0.28 * r, 24, 120);
      const m = createMaterial(c.material || { type: 'glass', color: '#bfe9ff', opacity: 0.32 });
      this.mats.push(m);
      this.group.add(new THREE.Mesh(g, m));
      // reflexo de borda (fresnel aditivo) para ler como vidro
      const rim = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uC: { value: new THREE.Color(c.rimColor || '#9fe8ff') }, uO: { value: 1 } },
        vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }',
        fragmentShader: 'uniform vec3 uC; uniform float uO; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0-abs(dot(vN,vV)), 3.0); gl_FragColor = vec4(uC*f*2.2*uO, f*uO); }',
      });
      rim.userData = { rim: true };
      this.rim = rim;
      this.group.add(new THREE.Mesh(g, rim));
    } else if (kind === 'halo') {
      const r = c.radius ?? 4;
      const m = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uC: { value: new THREE.Color(c.color || '#8a5cff') }, uI: { value: c.intensity ?? 1.6 }, uO: { value: 1 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
        fragmentShader: 'uniform vec3 uC; uniform float uI, uO; varying vec2 vUv; void main(){ float r = length(vUv-0.5)*2.0; float ring = exp(-pow((r-0.72)*9.0,2.0)); float glow = exp(-r*3.0)*0.35; float a = (ring+glow)*uO; gl_FragColor = vec4(uC*uI*a, a); }',
      });
      this.halo = m;
      this.group.add(new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), m));
    } else if (kind === 'grid' || kind === 'checker') {
      const size = c.size ?? 400;
      const m = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: {
          uC: { value: new THREE.Color(c.color || '#ff2bd6') }, uC2: { value: new THREE.Color(c.color2 || '#ffffff') },
          uI: { value: c.intensity ?? 1.4 }, uO: { value: 1 }, uTime: { value: 0 }, uKind: { value: kind === 'grid' ? 0 : 1 },
          uCell: { value: c.cell ?? 2.5 }, uFade: { value: c.fade ?? 60 },
        },
        vertexShader: 'varying vec3 vW; varying vec3 vL; void main(){ vL = position; vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
        fragmentShader: /* glsl */ `uniform vec3 uC, uC2; uniform float uI, uO, uTime, uKind, uCell, uFade; varying vec3 vW; varying vec3 vL;
          void main(){
            vec2 p = vL.xy / uCell;
            float fade = exp(-length(vL.xy)/uFade);
            if (uKind < 0.5) {
              vec2 g = abs(fract(p - 0.5) - 0.5) / fwidth(p);
              float line = 1.0 - min(min(g.x, g.y), 1.0);
              float a = line * fade * uO;
              gl_FragColor = vec4(uC * uI * a, a);
            } else {
              vec2 f = floor(p); float ch = mod(f.x + f.y, 2.0);
              vec3 col = mix(uC, uC2, ch);
              float a = fade * uO * 0.95;
              gl_FragColor = vec4(col * a, a);
            }
          }`,
      });
      if (kind === 'grid') m.blending = THREE.AdditiveBlending;
      this.floorMat = m;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), m);
      mesh.rotation.x = -Math.PI / 2;
      this.group.add(mesh);
    } else if (kind === 'laser') {
      const len = c.length ?? 120;
      const g = new THREE.CylinderGeometry(c.width ?? 0.03, c.width ?? 0.03, len, 6, 1, true);
      g.rotateZ(Math.PI / 2);
      const m = createMaterial({ type: 'neon', color: c.color || '#ff2bd6', intensity: c.intensity ?? 5 });
      this.mats.push(m);
      this.group.add(new THREE.Mesh(g, m));
    } else {
      // formas sólidas
      const g = shapeGeometry(kind);
      let m;
      if (kind === 'lollipop') {
        m = lollipopMaterial(c.color || '#ff8fc7', c.color2 || '#ffffff');
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.8, 12), createMaterial({ type: 'glossy', color: '#ffffff' }));
        stick.position.y = -1.4;
        this.group.add(stick);
        this.mats.push(stick.material);
      } else {
        m = createMaterial(c.material || { type: 'candy', color: c.color || '#ff8fc7' });
      }
      this.mats.push(m);
      const mesh = new THREE.Mesh(g, m);
      this.group.add(mesh);
      if (c.outline) {
        // contorno candy tipo adesivo (casca invertida)
        const om = new THREE.MeshBasicMaterial({ color: c.outline, side: THREE.BackSide });
        const o = new THREE.Mesh(g, om);
        o.scale.setScalar(1.08);
        this.group.add(o);
        this.mats.push(om);
        om.userData = { baseOpacity: 1, isBasic: true, baseColor: om.color.clone(), spec: { type: 'flat' } };
      }
    }
  }

  update(t, fctx) {
    const c = this.cfg;
    const visible = t >= this.t0 && t <= this.t1 + (c.outDur ?? 0.35);
    this.group.visible = visible;
    if (!visible) return;
    const inDur = c.inDur ?? 0.45;
    const outDur = c.outDur ?? 0.35;
    const uin = clamp((t - this.t0) / inDur);
    const uout = clamp((t - this.t1) / outDur);
    let s = 1, op = 1;
    const inAnim = c.inAnim || 'pop';
    if (inAnim === 'pop') s *= Math.max(1e-4, getEase('outBack')(uin));
    else if (inAnim === 'grow') s *= Math.max(1e-4, getEase('outExpo')(uin));
    else op *= getEase('outCubic')(uin);
    const outAnim = c.outAnim || 'shrink';
    if (outAnim === 'shrink') s *= Math.max(1e-4, 1 - getEase('inBack')(uout));
    else op *= 1 - uout;
    const tt = t - this.t0;
    const beat = fctx.beat || 0;
    const pulse = 1 + (c.reactive ?? 0.12) * beat;
    // fade por proximidade da câmera (formas sólidas)
    if (fctx.camPos && !this.floorMat && c.kind !== 'laser' && !c.kind.endsWith('Ring') && c.kind !== 'halo' && c.kind !== 'ring') {
      this.group.getWorldPosition(this._wp || (this._wp = new THREE.Vector3()));
      const d = this._wp.distanceTo(fctx.camPos);
      const R = Math.max(0.2, this.baseScale * 1.2);
      const near = Math.min(1, Math.max(0, (d - R * 1.2) / (R * 2.5)));
      op *= near * near * (3 - 2 * near);
    }
    this.group.scale.setScalar(this.baseScale * s * pulse);
    this.group.rotation.set(
      this.baseRot.x + this.spin[0] * tt,
      this.baseRot.y + this.spin[1] * tt,
      this.baseRot.z + this.spin[2] * tt
    );
    const bob = c.bob ?? 0.25;
    this.group.position.set(
      this.basePos.x + Math.sin(tt * 0.9 + this.phase) * bob * 0.6,
      this.basePos.y + Math.sin(tt * 1.3 + this.phase * 1.7) * bob,
      this.basePos.z + Math.cos(tt * 0.7 + this.phase) * bob * 0.5
    );
    if (this.inner) this.inner.rotation.z = -tt * 1.4;
    for (const m of this.mats) setMaterialState(m, op, (1 - uin) * 0.6);
    if (this.rim) this.rim.uniforms.uO.value = op;
    if (this.halo) this.halo.uniforms.uO.value = op * (1 + beat * 0.4);
    if (this.floorMat) { this.floorMat.uniforms.uO.value = op; this.floorMat.uniforms.uTime.value = t; }
  }
}

// túnel de anéis entre dois pontos (a câmera atravessa)
export class RingTunnel {
  constructor(cfg, ctx) {
    this.group = new THREE.Group();
    this.object = this.group;
    this.cfg = cfg;
    const a = new THREE.Vector3(...cfg.a), b = new THREE.Vector3(...cfg.b);
    const n = cfg.count ?? 14;
    const cols = cfg.colors || ['#2de2ff', '#ff2bd6'];
    this.mats = [];
    const dir = b.clone().sub(a).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n;
      const m = createMaterial({ type: 'neon', color: cols[i % cols.length], intensity: cfg.intensity ?? 3 });
      const g = new THREE.TorusGeometry(cfg.radius ?? 5, cfg.tube ?? 0.06, 8, 96);
      const mesh = new THREE.Mesh(g, m);
      mesh.position.copy(a).lerp(b, u);
      mesh.quaternion.copy(q);
      mesh.rotateZ(i * 0.35);
      this.group.add(mesh);
      this.mats.push(m);
    }
    this.t0 = cfg.t0 ?? 0;
    this.t1 = cfg.t1 ?? this.t0 + 2;
  }
  update(t, fctx) {
    const vis = t >= this.t0 - 0.2 && t <= this.t1 + 0.3;
    this.group.visible = vis;
    if (!vis) return;
    const op = clamp((t - this.t0 + 0.2) / 0.3) * clamp((this.t1 + 0.3 - t) / 0.3);
    const beat = fctx.beat || 0;
    for (const m of this.mats) setMaterialState(m, op, beat * 0.5);
  }
}
