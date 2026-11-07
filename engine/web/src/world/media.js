// Fotos e clipes de vídeo (estilo AMV typography): como FUNDO de tela inteira
// (backdrop) ou como CARDS 3D com moldura girando ao lado do texto.
// Vídeos chegam como sequência de JPGs extraída pelo CLI (ffmpeg), carregada
// frame a frame => render determinístico e sem depender de <video>.
import * as THREE from 'three';
import { clamp, getEase } from '../core/easing.js';

export class MediaItem {
  /** e: { file, mode, t0, t1, image?:url, frames?:{url,count,fps}, width, height, ... } */
  constructor(e) {
    this.e = e;
    this.t0 = e.t0 ?? 0;
    this.t1 = e.t1 ?? this.t0 + 3;
    this.aspect = (e.width && e.height) ? e.width / e.height : 16 / 9;
    this.tex = new THREE.Texture();
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.magFilter = THREE.LinearFilter;
    this.tex.generateMipmaps = false;
    this.cur = -1;
    this.ready = false;
  }
  active(t, pad = 0.6) { return t >= this.t0 - pad && t <= this.t1 + pad; }
  async _load(url) {
    const blob = await (await fetch(url)).blob();
    const bmp = await createImageBitmap(blob, { imageOrientation: 'flipY' });
    if (this.tex.image && this.tex.image.close) this.tex.image.close();
    this.tex.image = bmp;
    this.tex.flipY = false;
    this.tex.needsUpdate = true;
    this.ready = true;
  }
  async prepare(t) {
    if (!this.active(t)) return;
    const e = this.e;
    if (e.image) {
      if (this.cur !== 0) { this.cur = 0; await this._load(e.image); }
      return;
    }
    if (e.frames) {
      const f = e.frames;
      const idx = clamp(Math.floor((t - this.t0) * f.fps), 0, f.count - 1);
      if (idx !== this.cur) {
        this.cur = idx;
        await this._load(`${f.url}${String(idx + 1).padStart(5, '0')}.jpg`);
      }
    }
  }
}

export class MediaManager {
  constructor(entries) {
    this.items = (entries || []).map((e) => new MediaItem(e));
  }
  async prepare(t) {
    await Promise.all(this.items.map((it) => it.prepare(t)));
  }
  backdrops() { return this.items.filter((it) => (it.e.mode || 'card') === 'backdrop'); }
  cards() { return this.items.filter((it) => (it.e.mode || 'card') === 'card'); }
}

// ---------- fundo de tela inteira (cover), com Ken Burns, escurecer e tinta ----------
export class BackdropLayer {
  constructor(item, aspect) {
    this.item = item;
    const e = item.e;
    this.uniforms = {
      tMap: { value: item.tex },
      uOpacity: { value: 0 },
      uDim: { value: e.dim ?? 0.35 },
      uSat: { value: e.saturation ?? 1.0 },
      uTint: { value: new THREE.Color(e.tint || '#ffffff') },
      uTintAmt: { value: e.tintAmount ?? (e.tint ? 0.35 : 0) },
      uScale: { value: new THREE.Vector2(1, 1) },
      uZoom: { value: 1 },
      uPan: { value: new THREE.Vector2(0, 0) },
    };
    // "cover": preenche a tela cortando o excesso
    const sa = aspect, ma = item.aspect;
    if (ma > sa) this.uniforms.uScale.value.set(sa / ma, 1); else this.uniforms.uScale.value.set(1, ma / sa);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: /* glsl */ `
        uniform sampler2D tMap; uniform float uOpacity, uDim, uSat, uTintAmt, uZoom; uniform vec2 uScale, uPan; uniform vec3 uTint;
        varying vec2 vUv;
        vec3 toLin(vec3 c){ return pow(c, vec3(2.2)); }
        void main(){
          vec2 uv = (vUv - 0.5) * uScale / uZoom + 0.5 + uPan;
          vec3 c = texture2D(tMap, uv).rgb; // já linear (textura sRGB)
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
          c = mix(vec3(l), c, uSat);
          c = mix(c, c * uTint * 1.6, uTintAmt);
          c *= (1.0 - uDim) * 1.25;
          gl_FragColor = vec4(c, uOpacity);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    this.mesh.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.mesh);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  update(t, beat = 0) {
    const it = this.item, e = it.e;
    const fin = e.fadeIn ?? 0.2, fout = e.fadeOut ?? 0.25;
    const o = clamp((t - it.t0) / fin) * clamp((it.t1 - t) / fout);
    this.uniforms.uOpacity.value = it.ready ? o * (e.opacity ?? 1) : 0;
    const u = clamp((t - it.t0) / Math.max(0.1, it.t1 - it.t0));
    this.uniforms.uZoom.value = (e.zoom ?? 1.04) + (e.kenBurns ?? 0.06) * u + beat * (e.beatZoom ?? 0.015);
    this.uniforms.uPan.value.set((e.panX ?? 0.015) * (u - 0.5), (e.panY ?? 0) * (u - 0.5));
    return o > 0.001;
  }
}

// ---------- card 3D (polaroide / moldura neon / sem moldura) ----------
export class MediaCard {
  /** opts: { S, blockW, blockH, side, accent, seed } */
  constructor(item, opts) {
    this.item = item;
    const e = item.e;
    const S = opts.S;
    // tamanho relativo ao bloco de texto (fica atrás dele, como nas AMVs)
    const frame = e.frame || 'polaroid';
    const round = frame === 'circle';
    let h = (e.size ?? 1.5) * Math.max(opts.blockH, S * 0.35);
    let w = round ? h : h * item.aspect;
    const maxW = S * 1.25;
    if (w > maxW) { w = maxW; h = round ? w : w / item.aspect; }
    this.h = h;
    this.group = new THREE.Group();
    this.object = this.group;
    this.mats = [];
    const photo = new THREE.MeshBasicMaterial({ map: item.tex, transparent: true, side: THREE.DoubleSide });
    photo.color.setScalar(e.brightness ?? 1.2); // compensa o tonemap ACES
    this.mats.push(photo);
    let geo;
    if (round) {
      // recorte redondo "cover" (avatar/logo do editor, como no fim dos edits do iluxhaep)
      geo = new THREE.CircleGeometry(h / 2, 96);
      const uv = geo.attributes.uv, a = item.aspect;
      for (let i = 0; i < uv.count; i++) {
        let u = uv.getX(i), v = uv.getY(i);
        if (a > 1) u = 0.5 + (u - 0.5) / a; else v = 0.5 + (v - 0.5) * a;
        uv.setXY(i, u, v);
      }
    } else geo = new THREE.PlaneGeometry(w, h);
    const plane = new THREE.Mesh(geo, photo);
    plane.renderOrder = 2;
    this.group.add(plane);
    if (round) {
      const c = new THREE.Color(e.frameColor || '#9fd8ff');
      const ringMat = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(2.8), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      const ring = new THREE.Mesh(new THREE.RingGeometry(h * 0.5, h * 0.525, 128), ringMat);
      ring.position.z = 0.001 * S;
      this.group.add(ring);
      // halo suave atrás (gradiente radial em textura de canvas)
      const cv = document.createElement('canvas');
      cv.width = cv.height = 256;
      const g = cv.getContext('2d');
      const grd = g.createRadialGradient(128, 128, 60, 128, 128, 128);
      grd.addColorStop(0, 'rgba(255,255,255,0.9)');
      grd.addColorStop(0.35, 'rgba(255,255,255,0.35)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 256, 256);
      const haloTex = new THREE.CanvasTexture(cv);
      const haloMat = new THREE.MeshBasicMaterial({ map: haloTex, color: c.clone().multiplyScalar(1.6), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(h * 1.9, h * 1.9), haloMat);
      halo.position.z = -0.003 * S;
      halo.renderOrder = 1;
      this.group.add(halo);
      this.mats.push(ringMat, haloMat);
    }
    if (frame === 'polaroid') {
      const m = h * 0.06;
      const bg = new THREE.MeshStandardMaterial({ color: '#f6f3ee', roughness: 0.55, metalness: 0, transparent: true, side: THREE.DoubleSide });
      const back = new THREE.Mesh(new THREE.PlaneGeometry(w + m * 2, h + m * 4.2), bg);
      back.position.set(0, -m * 1.1, -0.002 * S);
      this.group.add(back);
      this.mats.push(bg);
    } else if (frame === 'glow') {
      const c = new THREE.Color(e.frameColor || opts.accent || '#ff3fb4').multiplyScalar(2.6);
      const lm = new THREE.MeshBasicMaterial({ color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      const tW = h * 0.018;
      for (const [x, y, ww, hh] of [[0, h / 2, w + tW, tW], [0, -h / 2, w + tW, tW], [w / 2, 0, tW, h + tW], [-w / 2, 0, tW, h + tW]]) {
        const b = new THREE.Mesh(new THREE.PlaneGeometry(ww, hh), lm);
        b.position.set(x, y, 0.001 * S);
        this.group.add(b);
      }
      this.mats.push(lm);
    }
    // posição ao lado do texto
    // padrão "behind": atrás do texto, deslocado e inclinado (lado alterna por card)
    const side = e.side || 'behind';
    const alt = (opts.slot ?? 0) % 2 ? -1 : 1;
    const sx = side === 'left' ? -1 : side === 'right' ? 1 : alt;
    let px, py, pz;
    if (side === 'left' || side === 'right') { px = sx * (opts.blockW * 0.5 + w * 0.5); py = 0; pz = -S * 0.12; }
    else if (round) { px = 0; py = 0; pz = -S * 0.3; }
    else { px = sx * opts.blockW * 0.16; py = h * 0.06; pz = -S * 0.42; }
    if (e.pos) [px, py, pz] = e.pos;
    this.base = new THREE.Vector3(px, py, pz);
    this.baseRot = new THREE.Euler(e.rot?.[0] ?? (round ? 0 : 0.04), e.rot?.[1] ?? (round ? 0 : -sx * 0.2), e.rot?.[2] ?? (round ? 0 : -sx * 0.05));
    this.group.position.copy(this.base);
    this.group.rotation.copy(this.baseRot);
  }
  update(t, fctx) {
    const it = this.item, e = it.e;
    const vis = t >= it.t0 - 0.02 && t <= it.t1 + 0.4 && it.ready;
    this.group.visible = vis;
    if (!vis) return;
    const uin = clamp((t - it.t0) / (e.inDur ?? 0.45));
    const uout = clamp((t - it.t1) / 0.35);
    const s = Math.max(1e-3, getEase('outBack')(uin)) * Math.max(1e-3, 1 - getEase('inBack')(uout));
    const tt = t - it.t0;
    this.group.scale.setScalar(s * (1 + (fctx.beat || 0) * 0.02));
    this.group.position.set(this.base.x, this.base.y + Math.sin(tt * 1.3) * 0.015 * this.h, this.base.z);
    this.group.rotation.set(
      this.baseRot.x + Math.sin(tt * 0.9) * 0.04,
      this.baseRot.y + (1 - getEase('outCubic')(uin)) * 1.2 * (this.base.x >= 0 ? 1 : -1) + Math.sin(tt * 0.7) * 0.05,
      this.baseRot.z + (1 - getEase('outCubic')(uin)) * 0.3,
    );
    for (const m of this.mats) m.opacity = 1 - uout;
  }
}
