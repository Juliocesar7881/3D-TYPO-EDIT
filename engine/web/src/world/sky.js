// Céu volumétrico cinematográfico (nuvens / fumaça / nebulosa iluminadas por trás).
// O volume é raymarchado UMA vez num panorama equiretangular HDR (com sombra e
// espalhamento frontal = bordas brilhando contra a luz) e depois só amostrado
// pela direção de visão a cada frame (barato). A rotação do céu é escolhida por
// shot para a luz ficar atrás do texto (contraluz), e mistura nas transições.
import * as THREE from 'three';

const NOISE = /* glsl */ `
float hash13(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float vnoise(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*f*(f*(f*6.0-15.0)+10.0);
  float a=hash13(i), b=hash13(i+vec3(1,0,0)), c=hash13(i+vec3(0,1,0)), d=hash13(i+vec3(1,1,0));
  float e=hash13(i+vec3(0,0,1)), f1=hash13(i+vec3(1,0,1)), g=hash13(i+vec3(0,1,1)), h=hash13(i+vec3(1,1,1));
  return mix(mix(mix(a,b,f.x),mix(c,d,f.x),f.y), mix(mix(e,f1,f.x),mix(g,h,f.x),f.y), f.z); }
float fbm5(vec3 p){ float s=0.0, a=0.5; for(int i=0;i<5;i++){ s+=a*vnoise(p); p=p*2.03+vec3(11.7,3.1,7.9); a*=0.5; } return s; }
float fbm3(vec3 p){ float s=0.0, a=0.5; for(int i=0;i<3;i++){ s+=a*vnoise(p); p=p*2.07+vec3(5.3,9.1,1.7); a*=0.5; } return s; }
`;

const KINDS = { clouds: 0, smoke: 1, space: 2 };

export class Sky {
  /**
   * cfg (theme.background): { kind: 'clouds'|'smoke'|'space', light: '#hex', lightIntensity,
   *   ambient, dark, colors:[c1,c2,c3], coverage, density, scale, exposure, seed, stars }
   */
  constructor(renderer, theme, quality = {}) {
    this.renderer = renderer;
    const cfg = theme.background || {};
    this.cfg = cfg;
    const pal = theme.palette || ['#8a5cff', '#2de2ff', '#ff2bd6'];
    const hi = (quality.resScale ?? 1) >= 1;
    const PW = cfg.panoWidth ?? (hi ? 2048 : 1024);
    const PH = PW / 2;
    this.lightPano = new THREE.Vector3(0, 0.12, -1).normalize(); // luz "à frente" no espaço do panorama
    const kind = KINDS[cfg.kind] ?? 0;
    const genUniforms = {
      uKind: { value: kind },
      uLight: { value: this.lightPano.clone() },
      uLightColor: { value: new THREE.Color(cfg.light || pal[0]).multiplyScalar(cfg.lightIntensity ?? 1.5) },
      uAmbient: { value: new THREE.Color(cfg.ambient || '#040309') },
      uDark: { value: new THREE.Color(cfg.dark || '#030208') },
      uC1: { value: new THREE.Color(cfg.colors?.[0] || pal[0]) },
      uC2: { value: new THREE.Color(cfg.colors?.[1] || pal[1] || pal[0]) },
      uC3: { value: new THREE.Color(cfg.colors?.[2] || pal[2] || pal[0]) },
      uCoverage: { value: cfg.coverage ?? (kind === 0 ? 0.52 : kind === 1 ? 0.58 : 0.57) },
      uDensity: { value: cfg.density ?? (kind === 0 ? 5.5 : kind === 1 ? 3.2 : 2.2) },
      uScale: { value: cfg.scale ?? (kind === 0 ? 1.35 : kind === 1 ? 1.9 : 1.2) },
      uSeed: { value: new THREE.Vector3((cfg.seed ?? 3) * 17.13, (cfg.seed ?? 3) * 5.71, (cfg.seed ?? 3) * 11.37) },
    };
    const gen = new THREE.ShaderMaterial({
      uniforms: genUniforms,
      depthTest: false,
      depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uKind, uCoverage, uDensity, uScale; uniform vec3 uLight, uLightColor, uAmbient, uDark, uC1, uC2, uC3, uSeed;
        varying vec2 vUv;
        ${NOISE}
        vec3 dirFromUv(vec2 uv){ float phi = (uv.x - 0.5) * 6.2831853; float th = (uv.y - 0.5) * 3.1415927;
          return vec3(cos(th)*sin(phi), sin(th), -cos(th)*cos(phi)); }
        float dens(vec3 p){
          vec3 q = p * uScale + uSeed;
          if (uKind < 0.5) { // nuvens: bancos fofos, mais densos perto do "horizonte"
            float band = exp(-pow(p.y * 1.25, 2.0));
            float base = fbm5(q);
            float d = smoothstep(uCoverage, uCoverage + 0.22, base * (0.55 + 0.6 * band));
            d *= 0.55 + 0.45 * fbm3(q * 3.3);
            return d;
          } else if (uKind < 1.5) { // fumaça: tufos com domain warp
            vec3 w = vec3(fbm3(q), fbm3(q + 5.2), fbm3(q + 9.7));
            float base = fbm5(q * 1.1 + w * 2.2);
            float d = smoothstep(uCoverage, uCoverage + 0.38, base);
            return d * (0.6 + 0.4 * fbm3(q * 2.6 + w));
          } else { // nebulosa
            vec3 w = vec3(fbm3(q), fbm3(q + 3.7), fbm3(q + 7.1));
            float base = fbm5(q + w * 1.6);
            return smoothstep(uCoverage, uCoverage + 0.35, base);
          }
        }
        float hg(float c, float g){ float g2 = g*g; return (1.0 - g2) / (12.566 * pow(1.0 + g2 - 2.0*g*c, 1.5)); }
        void main(){
          vec3 dir = dirFromUv(vUv);
          float cosT = dot(dir, uLight);
          const int STEPS = 44;
          float r0 = 1.0, r1 = 2.8;
          float dr = (r1 - r0) / float(STEPS);
          float jit = hash13(dir * 431.7) * dr;
          float T = 1.0;
          vec3 col = vec3(0.0);
          // fase: lados escuros, bordas acendendo só perto da direção da luz (contraluz)
          float cf = max(cosT, 0.0);
          float phase = 0.025 + 0.28 * pow(cf, 2.0) + 1.5 * pow(cf, 8.0) + 2.6 * pow(cf, 40.0);
          for (int i = 0; i < STEPS; i++) {
            float r = r0 + dr * float(i) + jit;
            vec3 p = dir * r;
            float d = dens(p);
            if (d > 0.002) {
              float ld = 0.0;
              for (int j = 1; j <= 4; j++) ld += dens(p + uLight * 0.11 * float(j));
              float sh = exp(-ld * (uKind < 1.5 ? 2.3 : 0.8));
              float powder = 1.0 - exp(-d * 4.0);
              vec3 lit;
              if (uKind < 1.5) {
                lit = uLightColor * sh * phase * mix(0.45, 1.0, powder) + uAmbient * (0.15 + 0.85 * d);
              } else {
                vec3 em = mix(uC1, uC2, smoothstep(0.3, 0.8, fbm3(p * 3.0 + uSeed)));
                em = mix(em, uC3, smoothstep(0.55, 0.9, d));
                lit = em * (0.08 + 0.45 * d) + uLightColor * sh * phase * 0.3;
              }
              float a = 1.0 - exp(-d * uDensity * dr * 2.2);
              col += T * a * lit;
              T *= 1.0 - a;
              if (T < 0.015) break;
            }
          }
          // fundo atrás do volume: degradê escuro + halo e disco da luz
          float g = max(0.0, cosT);
          vec3 sky = uDark * (0.6 + 0.4 * (dir.y * 0.5 + 0.5));
          sky += uLightColor * (0.01 * pow(g, 3.0) + 0.14 * pow(g, 40.0) + 3.0 * pow(g, 5000.0));
          col += T * sky;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.rt = new THREE.WebGLRenderTarget(PW, PH, {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      wrapS: THREE.RepeatWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), gen);
    quad.frustumCulled = false;
    const sc = new THREE.Scene();
    sc.add(quad);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const t0 = performance.now();
    renderer.setRenderTarget(this.rt);
    renderer.render(sc, cam);
    renderer.setRenderTarget(null);
    this.genMs = performance.now() - t0;
    gen.dispose();
    quad.geometry.dispose();

    // exibição por frame
    this.uniforms = {
      tPano: { value: this.rt.texture },
      uInvProj: { value: new THREE.Matrix4() },
      uCamWorld: { value: new THREE.Matrix4() },
      uRot: { value: new THREE.Matrix3() },
      uExposure: { value: cfg.exposure ?? 0.45 },
      uTint: { value: new THREE.Color(1, 1, 1) },
      uTime: { value: 0 },
      uStars: { value: cfg.stars ?? (kind === 0 ? 0.0 : 0.7) },
      uPulse: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      depthTest: false,
      depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D tPano; uniform mat4 uInvProj, uCamWorld; uniform mat3 uRot;
        uniform float uExposure, uTime, uStars, uPulse; uniform vec3 uTint;
        varying vec2 vUv;
        float hash13(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
        void main(){
          vec4 clip = vec4(vUv*2.0-1.0, 1.0, 1.0);
          vec4 v = uInvProj * clip; v /= v.w;
          vec3 d = normalize((uCamWorld * vec4(normalize(v.xyz), 0.0)).xyz);
          vec3 pd = normalize(uRot * d);
          vec2 uv = vec2(atan(pd.x, -pd.z) / 6.2831853 + 0.5, asin(clamp(pd.y, -1.0, 1.0)) / 3.1415927 + 0.5);
          vec3 col = texture2D(tPano, uv).rgb * uTint * uExposure * (1.0 + uPulse * 0.25);
          if (uStars > 0.0) {
            vec3 p = pd * 160.0; vec3 c = floor(p);
            float h = hash13(c);
            float s = step(0.985, h) * smoothstep(0.32, 0.0, length(p - c - 0.5));
            float tw = 0.6 + 0.4 * sin(uTime * (2.0 + h * 6.0) + h * 40.0);
            float lum = dot(col, vec3(0.3, 0.59, 0.11));
            col += vec3(s * tw * uStars) * (1.0 - smoothstep(0.05, 0.4, lum)) * 1.6;
          }
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    this.mesh.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.mesh);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.rotQ = new THREE.Quaternion();
    this._m4 = new THREE.Matrix4();
  }

  // q: rotação mundo->panorama (quaternion)
  setRotation(q) {
    this.rotQ.copy(q);
    this._m4.makeRotationFromQuaternion(q);
    this.uniforms.uRot.value.setFromMatrix4(this._m4);
  }

  // direção da luz em espaço de mundo
  lightWorld(out = new THREE.Vector3()) {
    return out.copy(this.lightPano).applyQuaternion(this.rotQ.clone().invert());
  }

  update(t, cam, pulse = 0, tint = null) {
    this.uniforms.uTime.value = t;
    this.uniforms.uInvProj.value.copy(cam.projectionMatrixInverse);
    this.uniforms.uCamWorld.value.copy(cam.matrixWorld);
    this.uniforms.uPulse.value = pulse;
    if (tint) this.uniforms.uTint.value.copy(tint);
  }
}
