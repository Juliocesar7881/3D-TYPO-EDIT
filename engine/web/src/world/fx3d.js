// Elementos "premium" do estilo 3D typography: cacos de vidro, raios elétricos,
// faíscas com rastro, feixes de luz volumétricos e brilho de contraluz.
// Tudo determinístico (função de t) e com janela de visibilidade.
import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { RNG, mulberry32 } from '../core/rng.js';
import { clamp, getEase } from '../core/easing.js';

const fadeWin = (t, t0, t1, fin = 0.25, fout = 0.3) => clamp((t - t0) / fin) * clamp((t1 + fout - t) / fout);

// ---------------- cacos de vidro ----------------
function shardShape(r) {
  const n = 4 + Math.floor(r() * 4);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.6;
    const rad = 0.45 + r() * 0.6;
    pts.push(new THREE.Vector2(Math.cos(a) * rad * (0.6 + r() * 0.8), Math.sin(a) * rad));
  }
  return new THREE.Shape(pts);
}

export class GlassShards {
  /** cfg: { S, blockW, blockH, count, t0, t1, seed, tint, edge, burst } */
  constructor(cfg) {
    this.cfg = cfg;
    const r = mulberry32(cfg.seed ?? 1);
    this.group = new THREE.Group();
    this.object = this.group;
    this.items = [];
    const S = cfg.S;
    const n = cfg.count ?? 16;
    const tint = new THREE.Color(cfg.tint || '#cfe8ff');
    const edgeCol = new THREE.Color(cfg.edge || '#ffffff').multiplyScalar(2.2);
    for (let i = 0; i < n; i++) {
      const size = S * (0.05 + r() * 0.11);
      const geo = new THREE.ExtrudeGeometry(shardShape(r), { depth: 0.04, bevelEnabled: false });
      geo.center();
      const mat = new THREE.MeshPhysicalMaterial({
        color: tint, metalness: 0.05, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02,
        transparent: true, opacity: 0.2, envMapIntensity: 3.2, side: THREE.DoubleSide, depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), new THREE.LineBasicMaterial({ color: edgeCol, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      const holder = new THREE.Group();
      holder.add(mesh, edges);
      holder.scale.setScalar(size);
      // posição: casca em volta do bloco de texto, evitando o miolo
      let x = (r() * 2 - 1), y = (r() * 2 - 1);
      if (Math.abs(x) < 0.55 && Math.abs(y) < 0.5) { if (Math.abs(x) > Math.abs(y)) x = Math.sign(x || 1) * (0.55 + r() * 0.4); else y = Math.sign(y || 1) * (0.5 + r() * 0.45); }
      const pos = new THREE.Vector3(x * (cfg.blockW * 0.6 + S * 0.25), y * (cfg.blockH * 0.6 + S * 0.22), (r() * 1.1 - 0.55) * S);
      const dir = pos.clone().normalize();
      this.group.add(holder);
      this.items.push({ holder, mats: [mat, edges.material], pos, dir, rot: new THREE.Euler(r() * 6, r() * 6, r() * 6), spin: new THREE.Vector3((r() - 0.5) * 1.6, (r() - 0.5) * 1.6, (r() - 0.5) * 1.2), delay: r() * 0.18 });
    }
    this.t0 = cfg.t0 ?? 0;
    this.t1 = cfg.t1 ?? this.t0 + 3;
  }
  update(t, fctx) {
    const vis = t >= this.t0 - 0.05 && t <= this.t1 + 0.4;
    this.group.visible = vis;
    if (!vis) return;
    const S = this.cfg.S;
    const fade = fadeWin(t, this.t0, this.t1, 0.18, 0.35);
    const hit = fctx.hit || 0;
    for (const it of this.items) {
      const tt = Math.max(0, t - this.t0 - it.delay);
      // "estouro" de vidro na entrada: vem do centro rápido e desacelera
      const burst = this.cfg.burst === false ? 1 : getEase('outExpo')(clamp(tt / 0.7));
      const drift = tt * S * 0.035;
      const p = it.pos.clone().multiplyScalar(0.35 + 0.65 * burst).addScaledVector(it.dir, drift + hit * S * 0.02);
      it.holder.position.copy(p);
      it.holder.rotation.set(it.rot.x + it.spin.x * tt, it.rot.y + it.spin.y * tt, it.rot.z + it.spin.z * tt);
      it.mats[0].opacity = 0.2 * fade;
      it.mats[1].opacity = fade * (0.55 + 0.45 * Math.sin(tt * 3 + it.delay * 40) ** 2);
    }
  }
}

// ---------------- raios elétricos ----------------
function jagged(a, b, seed, depth = 6, rough = 0.32) {
  const r = mulberry32(seed);
  let pts = [a.clone(), b.clone()];
  let disp = a.distanceTo(b) * rough;
  for (let d = 0; d < depth; d++) {
    const next = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1];
      const m = p.clone().add(q).multiplyScalar(0.5);
      m.x += (r() - 0.5) * disp; m.y += (r() - 0.5) * disp; m.z += (r() - 0.5) * disp * 0.6;
      next.push(m, q);
    }
    pts = next;
    disp *= 0.55;
  }
  return pts;
}

export class Lightning {
  /** cfg: { S, blockW, blockH, count, color, t0, t1, seed, width, resolution:[w,h] } */
  constructor(cfg) {
    this.cfg = cfg;
    this.group = new THREE.Group();
    this.object = this.group;
    const r = new RNG(cfg.seed ?? 5);
    const n = cfg.count ?? 3;
    const res = new THREE.Vector2(...(cfg.resolution || [1920, 1080]));
    const col = new THREE.Color(cfg.color || '#9fd8ff');
    this.arcs = [];
    for (let i = 0; i < n; i++) {
      // de uma borda do texto para outra / para fora
      const side = r.sign();
      const a = new THREE.Vector3(side * cfg.blockW * r.range(0.2, 0.55), r.range(-0.6, 0.6) * cfg.blockH, r.range(-0.2, 0.2) * cfg.S);
      const b = new THREE.Vector3(-side * cfg.blockW * r.range(0.3, 0.75), r.range(-0.9, 0.9) * cfg.blockH, r.range(-0.4, 0.3) * cfg.S);
      const core = new LineMaterial({ color: col.clone().lerp(new THREE.Color('#ffffff'), 0.6).multiplyScalar(3.2), linewidth: (cfg.width ?? 2.2) * (res.y / 1080), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
      const glow = new LineMaterial({ color: col.clone().multiplyScalar(1.1), linewidth: (cfg.width ?? 2.2) * 4 * (res.y / 1080), transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending });
      core.resolution.copy(res);
      glow.resolution.copy(res);
      const g1 = new LineGeometry(), g2 = new LineGeometry();
      const l1 = new Line2(g1, core), l2 = new Line2(g2, glow);
      l1.frustumCulled = false; l2.frustumCulled = false;
      this.group.add(l2, l1);
      this.arcs.push({ a, b, g1, g2, core, glow, seed: r.int(1, 1e9), phase: r.float(), l1, l2 });
    }
    this.t0 = cfg.t0 ?? 0;
    this.t1 = cfg.t1 ?? this.t0 + 2;
    this.lastKey = -1;
  }
  update(t, fctx) {
    const vis = t >= this.t0 && t <= this.t1;
    this.group.visible = vis;
    if (!vis) return;
    const fps = 24;
    const key = Math.floor(t * fps / 2); // raio muda de forma a cada 2 quadros (12/s)
    const hit = fctx.hit || 0;
    for (const arc of this.arcs) {
      const h = mulberry32((arc.seed ^ (key * 2654435761)) >>> 0)();
      const intro = clamp(1 - (t - this.t0) / 0.5);
      const on = intro > 0.05 || hit > 0.35 || h > 0.62;
      arc.l1.visible = arc.l2.visible = on;
      if (!on) continue;
      if (key !== arc.key) {
        arc.key = key;
        const pts = jagged(arc.a, arc.b, (arc.seed + key * 97) >>> 0, 6, 0.3);
        const flat = [];
        for (const p of pts) flat.push(p.x, p.y, p.z);
        arc.g1.setPositions(flat);
        arc.g2.setPositions(flat);
      }
      const k = Math.max(intro, hit, 0.55 + 0.45 * h);
      arc.core.opacity = k;
      arc.glow.opacity = 0.45 * k;
    }
  }
}

// ---------------- faíscas com rastro ----------------
export class Sparks {
  /** cfg: { S, blockW, blockH, events:[t...], perEvent, color, t1, seed, gravity } */
  constructor(cfg) {
    this.cfg = cfg;
    const r = new RNG(cfg.seed ?? 9);
    const per = cfg.perEvent ?? 70;
    const events = cfg.events || [cfg.t0 ?? 0];
    this.sparks = [];
    events.forEach((te, ei) => {
      for (let i = 0; i < per; i++) {
        const [ux, uy, uz] = r.onSphere();
        const speed = cfg.S * r.range(0.35, 1.25);
        this.sparks.push({
          te: te + r.range(0, 0.06),
          o: new THREE.Vector3(r.range(-0.45, 0.45) * cfg.blockW, r.range(-0.4, 0.4) * cfg.blockH, r.range(0, 0.15) * cfg.S),
          v: new THREE.Vector3(ux * 1.3, uy + 0.35, uz * 0.8).normalize().multiplyScalar(speed),
          life: r.range(0.45, 1.1),
        });
      }
    });
    const n = this.sparks.length;
    this.pos = new Float32Array(n * 6);
    this.col = new Float32Array(n * 6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.geo = geo;
    this.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.lines.frustumCulled = false;
    this.object = this.lines;
    this.head = new THREE.Color('#ffffff').multiplyScalar(3.5);
    this.tail = new THREE.Color(cfg.color || '#ffb36b').multiplyScalar(1.6);
    this.tStart = Math.min(...events) - 0.05;
    this.tEnd = Math.max(...events) + 1.3;
  }
  update(t) {
    const vis = t >= this.tStart && t <= this.tEnd;
    this.lines.visible = vis;
    if (!vis) return;
    const g = this.cfg.S * (this.cfg.gravity ?? 0.9);
    const p = this.pos, c = this.col;
    this.sparks.forEach((s, i) => {
      const age = t - s.te;
      const o = i * 6;
      if (age < 0 || age > s.life) {
        for (let k = 0; k < 6; k++) { p[o + k] = 0; c[o + k] = 0; }
        return;
      }
      const drag = (1 - Math.exp(-age * 2.2)) / 2.2;
      const hx = s.o.x + s.v.x * drag, hy = s.o.y + s.v.y * drag - 0.5 * g * age * age, hz = s.o.z + s.v.z * drag;
      const vx = s.v.x * Math.exp(-age * 2.2), vy = s.v.y * Math.exp(-age * 2.2) - g * age, vz = s.v.z * Math.exp(-age * 2.2);
      const L = 0.045;
      p[o] = hx; p[o + 1] = hy; p[o + 2] = hz;
      p[o + 3] = hx - vx * L; p[o + 4] = hy - vy * L; p[o + 5] = hz - vz * L;
      const f = 1 - age / s.life;
      c[o] = this.head.r * f; c[o + 1] = this.head.g * f; c[o + 2] = this.head.b * f;
      c[o + 3] = this.tail.r * f * 0.4; c[o + 4] = this.tail.g * f * 0.4; c[o + 5] = this.tail.b * f * 0.4;
    });
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}

// ---------------- feixes de luz volumétricos ----------------
export class LightBeams {
  /** cfg: { S, count, color, t0, t1, seed } */
  constructor(cfg) {
    this.cfg = cfg;
    const r = new RNG(cfg.seed ?? 13);
    this.group = new THREE.Group();
    this.object = this.group;
    this.mats = [];
    const n = cfg.count ?? 4;
    const S = cfg.S;
    for (let i = 0; i < n; i++) {
      const len = S * r.range(2.2, 3.5);
      const geo = new THREE.CylinderGeometry(S * 0.02, S * r.range(0.16, 0.3), len, 24, 1, true);
      geo.translate(0, -len / 2, 0);
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uC: { value: new THREE.Color(cfg.color || '#bfa8ff') }, uO: { value: 0 }, uLen: { value: len } },
        vertexShader: 'varying vec3 vN; varying vec3 vV; varying float vY; uniform float uLen; void main(){ vY = -position.y / uLen; vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
        fragmentShader: 'uniform vec3 uC; uniform float uO; varying vec3 vN; varying vec3 vV; varying float vY; void main(){ float f = pow(abs(dot(vN, vV)), 2.5); float along = smoothstep(0.0, 0.12, vY) * (1.0 - smoothstep(0.45, 1.0, vY)); float a = f * along * uO * 0.55; gl_FragColor = vec4(uC * a, a); }',
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(r.range(-0.7, 0.7) * S, S * r.range(1.1, 1.5), -S * r.range(0.3, 0.9));
      m.rotation.set(r.range(-0.35, 0.35), 0, r.range(-0.5, 0.5));
      m.userData.sway = r.range(0.2, 0.5) * r.sign();
      m.userData.base = m.rotation.z;
      m.userData.ph = r.range(0, 6.28);
      this.group.add(m);
      this.mats.push(mat);
    }
    this.t0 = cfg.t0 ?? 0;
    this.t1 = cfg.t1 ?? this.t0 + 3;
  }
  update(t, fctx) {
    const vis = t >= this.t0 && t <= this.t1 + 0.4;
    this.group.visible = vis;
    if (!vis) return;
    const f = fadeWin(t, this.t0, this.t1, 0.35, 0.4);
    this.group.children.forEach((m, i) => {
      m.rotation.z = m.userData.base + Math.sin(t * m.userData.sway + m.userData.ph) * 0.12;
      this.mats[i].uniforms.uO.value = f * (0.75 + 0.25 * Math.sin(t * 2.3 + m.userData.ph)) * (1 + (fctx.beat || 0) * 0.3);
    });
  }
}

// ---------------- brilho de contraluz atrás do texto ----------------
export class BackGlow {
  /** cfg: { S, color, t0, t1, intensity } */
  constructor(cfg) {
    this.cfg = cfg;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uC: { value: new THREE.Color(cfg.color || '#8a5cff') }, uI: { value: cfg.intensity ?? 0.9 }, uO: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uC; uniform float uI, uO; varying vec2 vUv; void main(){ vec2 d = (vUv - 0.5) * vec2(1.0, 1.8); float r = length(d) * 2.0; float a = exp(-r * r * 3.2) * uI * uO; gl_FragColor = vec4(uC * a, a); }',
    });
    this.mat = mat;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(cfg.S * 2.6, cfg.S * 2.6), mat);
    this.mesh.position.z = -cfg.S * 0.6;
    this.object = this.mesh;
    this.t0 = cfg.t0 ?? 0;
    this.t1 = cfg.t1 ?? this.t0 + 3;
  }
  update(t, fctx) {
    const vis = t >= this.t0 && t <= this.t1 + 0.4;
    this.mesh.visible = vis;
    if (!vis) return;
    this.mat.uniforms.uO.value = fadeWin(t, this.t0, this.t1, 0.3, 0.4) * (1 + (fctx.beat || 0) * 0.35);
  }
}
