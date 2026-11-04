// Partículas em shader (sem estado acumulado: movimento é função fechada de t).
// Tipos: dust | bokeh | sparkle | hearts | confetti | stars
import * as THREE from 'three';
import { RNG } from '../core/rng.js';

const SHAPES = { dust: 0, bokeh: 1, sparkle: 2, hearts: 3, confetti: 4, stars: 2, orbs: 0 };

export class Particles {
  /**
   * cfg: { type, count, size:[min,max] (unidades de mundo), colors:[], intensity,
   *        drift, twinkle, regions:[{c:[x,y,z], r}], segments:[{a:[..], b:[..], r}], seed,
   *        opacity, focus, dof }
   */
  constructor(cfg, ctx) {
    const rng = new RNG(cfg.seed ?? 7);
    const type = cfg.type || 'dust';
    const count = Math.max(1, Math.round((cfg.count ?? 3000) * (ctx.quality?.particleScale ?? 1)));
    const pos = new Float32Array(count * 3);
    const rnd = new Float32Array(count * 4);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const regions = cfg.regions || [];
    const segments = cfg.segments || [];
    const pal = (cfg.colors && cfg.colors.length ? cfg.colors : ['#ffffff']).map((c) => new THREE.Color(c));
    const total = regions.length + segments.length;
    const [smin, smax] = cfg.size || [0.03, 0.08];
    for (let i = 0; i < count; i++) {
      let x = 0, y = 0, z = 0;
      const pick = total ? rng.int(0, total - 1) : -1;
      if (pick >= 0 && pick < regions.length) {
        const R = regions[pick];
        const [ux, uy, uz] = rng.onSphere();
        const rr = R.r * Math.cbrt(rng.float());
        x = R.c[0] + ux * rr; y = R.c[1] + uy * rr * (R.flat ?? 1); z = R.c[2] + uz * rr;
      } else if (pick >= regions.length) {
        const S = segments[pick - regions.length];
        const t = rng.float();
        const [ux, uy, uz] = rng.onSphere();
        const rr = S.r * Math.sqrt(rng.float());
        x = S.a[0] + (S.b[0] - S.a[0]) * t + ux * rr;
        y = S.a[1] + (S.b[1] - S.a[1]) * t + uy * rr;
        z = S.a[2] + (S.b[2] - S.a[2]) * t + uz * rr;
      } else {
        const [ux, uy, uz] = rng.onSphere();
        const rr = 60 * Math.cbrt(rng.float());
        x = ux * rr; y = uy * rr; z = uz * rr;
      }
      pos.set([x, y, z], i * 3);
      rnd.set([rng.float(), rng.float(), rng.float(), rng.float()], i * 4);
      const c = pal[rng.int(0, pal.length - 1)];
      colors.set([c.r, c.g, c.b], i * 3);
      // distribuição de tamanho com cauda (poucos grandes, muitos pequenos)
      const s = rng.float();
      sizes[i] = smin + (smax - smin) * s * s;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 4));
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    this.uniforms = {
      uTime: { value: 0 },
      uProjScale: { value: 800 },
      uShape: { value: SHAPES[type] ?? 0 },
      uDrift: { value: cfg.drift ?? 0.6 },
      uTwinkle: { value: cfg.twinkle ?? 0.5 },
      uIntensity: { value: cfg.intensity ?? 1.5 },
      uOpacity: { value: cfg.opacity ?? 1 },
      uPulse: { value: 0 },
      uFocus: { value: cfg.focus ?? 14 },
      uDof: { value: cfg.dof ?? (type === 'bokeh' ? 1 : 0) },
      uMaxPx: { value: (cfg.maxPx ?? 140) * (ctx.resScale ?? 1) },
      uSpin: { value: cfg.spin ?? 1 },
      uFall: { value: cfg.fall ?? 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: cfg.blending === 'normal' ? THREE.NormalBlending : THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        uniform float uTime, uProjScale, uDrift, uTwinkle, uPulse, uFocus, uDof, uMaxPx, uSpin, uFall;
        attribute vec4 aRand; attribute vec3 aColor; attribute float aSize;
        varying vec3 vColor; varying float vAlpha; varying float vRot; varying float vSoft;
        void main(){
          vec3 p = position;
          float ph = aRand.x * 6.2831853;
          p += uDrift * vec3(
            sin(uTime*(0.25+aRand.y*0.6)+ph),
            cos(uTime*(0.2+aRand.z*0.5)+ph*1.3),
            sin(uTime*(0.18+aRand.w*0.45)+ph*0.7));
          p.y -= uFall * mod(uTime*(0.6+aRand.y) + aRand.z*20.0, 20.0);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float dist = max(0.05, -mv.z);
          float tw = mix(1.0, 0.35 + 0.65*pow(0.5+0.5*sin(uTime*(2.0+aRand.w*5.0)+ph*3.0), 2.0), uTwinkle);
          float size = aSize * (1.0 + uPulse*0.6);
          float px = size * uProjScale / dist;
          float coc = uDof * abs(dist - uFocus) / max(dist, 1.0) * 0.22 * uProjScale * aSize;
          px += coc;
          float soft = clamp(coc / max(px, 1.0), 0.0, 0.85);
          gl_PointSize = clamp(px, 1.0, uMaxPx);
          // some quando muito perto da câmera (evita bolhas gigantes) e longe demais
          float nearFade = smoothstep(0.6, 3.0, dist);
          float farFade = 1.0 - smoothstep(140.0, 260.0, dist);
          // partículas subpixel perdem brilho em vez de piscar
          float sub = clamp(px / 1.5, 0.25, 1.0);
          vAlpha = tw * nearFade * farFade * sub * (1.0 - soft*0.55);
          vColor = aColor;
          vRot = aRand.z * 6.2831853 + uTime * (aRand.y - 0.5) * 2.0 * uSpin;
          vSoft = soft;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uShape, uIntensity, uOpacity;
        varying vec3 vColor; varying float vAlpha; varying float vRot; varying float vSoft;
        float heart(vec2 p){ p.y = -p.y + 0.15; p *= 1.25; float a = atan(p.x, p.y)/3.141593; float r = length(p);
          float h = abs(a); float d = (13.0*h - 22.0*h*h + 10.0*h*h*h)/(6.0-5.0*h); return smoothstep(d*0.5+0.03, d*0.5-0.03, r); }
        void main(){
          vec2 uv = gl_PointCoord * 2.0 - 1.0;
          float a = 0.0;
          if (uShape < 0.5) { // disco suave
            float r = length(uv); a = smoothstep(1.0, 0.0, r); a = a*a;
          } else if (uShape < 1.5) { // bokeh com borda
            float r = length(uv);
            float body = smoothstep(1.0, 0.86 - vSoft*0.5, r);
            float ring = smoothstep(0.7, 0.95, r) * body;
            a = body * (0.55 + ring*0.6);
          } else if (uShape < 2.5) { // brilho estrela de 4 pontas
            float c = cos(vRot*0.15), s = sin(vRot*0.15);
            vec2 q = mat2(c,-s,s,c) * uv;
            float r = length(q);
            float cross = max(0.0, 1.0 - abs(q.x)*12.0) * max(0.0, 1.0 - abs(q.y)) + max(0.0, 1.0 - abs(q.y)*12.0) * max(0.0, 1.0 - abs(q.x));
            a = clamp(cross*0.9 + smoothstep(0.35, 0.0, r), 0.0, 1.0);
          } else if (uShape < 3.5) { // coração
            float c = cos(vRot*0.3), s = sin(vRot*0.3);
            a = heart(mat2(c,-s,s,c) * uv);
          } else { // confete retangular girando
            float c = cos(vRot), s = sin(vRot);
            vec2 q = mat2(c,-s,s,c) * uv;
            float sq = abs(sin(vRot*0.7))*0.6+0.25;
            a = step(abs(q.x), 0.75) * step(abs(q.y), 0.75*sq);
          }
          a *= vAlpha * uOpacity;
          if (a < 0.003) discard;
          gl_FragColor = vec4(vColor * uIntensity * a, a);
        }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.object = this.points;
    this.cfg = cfg;
  }

  update(t, fctx) {
    this.uniforms.uTime.value = t;
    this.uniforms.uProjScale.value = fctx.projScale;
    this.uniforms.uPulse.value = (this.cfg.reactive ?? 0.6) * (fctx.beat || 0);
    if (this.cfg.focusFollow !== false && fctx.focusDist) this.uniforms.uFocus.value = fctx.focusDist;
  }
}
