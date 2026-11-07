// Pós-processamento próprio (mais leve que o UnrealBloomPass):
// cena HDR com MSAA -> bloom em cadeia de mips (13-tap down / tent up) ->
// streak anamórfico -> composição final (tonemap ACES, aberração cromática,
// vinheta, grão, grading, flash, fade) com dither para não bandear degradês.
import * as THREE from 'three';

const FS_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function rt(w, h, opts = {}) {
  return new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: false,
    ...opts,
  });
}

export class PostPipeline {
  constructor(renderer, w, h, fx = {}, quality = {}) {
    this.renderer = renderer;
    this.w = w;
    this.h = h;
    this.fx = fx;
    const samples = quality.msaa ?? 4;
    this.sceneRT = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      samples,
      depthBuffer: true,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.qScene = new THREE.Scene();
    this.qScene.add(this.quad);
    this.qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // cadeia de bloom
    this.levels = quality.bloomLevels ?? 6;
    this.down = [];
    this.up = [];
    let bw = w >> 1, bh = h >> 1;
    for (let i = 0; i < this.levels; i++) {
      this.down.push(rt(bw, bh));
      this.up.push(rt(bw, bh));
      bw = Math.max(1, bw >> 1);
      bh = Math.max(1, bh >> 1);
    }
    // streak anamórfico em baixa resolução
    this.streakA = rt(w >> 2, h >> 3);
    this.streakB = rt(w >> 2, h >> 3);
    // raios de luz volumétricos (god rays) em 1/4 de resolução
    this.raysRT = rt(w >> 2, h >> 2);
    this.raysMat = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, uLight: { value: new THREE.Vector2(0.5, 0.5) }, uDensity: { value: 0.9 }, uDecay: { value: 0.955 }, uWeight: { value: 0.06 } },
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tSrc; uniform vec2 uLight; uniform float uDensity, uDecay, uWeight; varying vec2 vUv;
        void main(){
          vec2 uv = vUv;
          vec2 delta = (uv - uLight) * uDensity / 48.0;
          float illum = 1.0;
          vec3 acc = vec3(0.0);
          for (int i = 0; i < 48; i++) {
            uv -= delta;
            acc += texture2D(tSrc, uv).rgb * illum;
            illum *= uDecay;
          }
          gl_FragColor = vec4(acc * uWeight, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });

    this.prefilterMat = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 1 }, uKnee: { value: 0.5 } },
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThreshold, uKnee; varying vec2 vUv;
        vec3 s(vec2 o){ return texture2D(tSrc, vUv + o*uTexel).rgb; }
        float lum(vec3 c){ return dot(c, vec3(0.2126,0.7152,0.0722)); }
        vec3 karis(vec3 a, vec3 b, vec3 c, vec3 d){ float wa=1.0/(1.0+lum(a)), wb=1.0/(1.0+lum(b)), wc=1.0/(1.0+lum(c)), wd=1.0/(1.0+lum(d)); return (a*wa+b*wb+c*wc+d*wd)/(wa+wb+wc+wd); }
        void main(){
          vec3 A=s(vec2(-2,-2)),B=s(vec2(0,-2)),C=s(vec2(2,-2)),D=s(vec2(-1,-1)),E=s(vec2(1,-1)),F=s(vec2(-2,0)),G=s(vec2(0,0)),H=s(vec2(2,0)),I=s(vec2(-1,1)),J=s(vec2(1,1)),K=s(vec2(-2,2)),L=s(vec2(0,2)),M=s(vec2(2,2));
          vec3 c = karis(D,E,I,J)*0.5 + karis(A,B,F,G)*0.125 + karis(B,C,G,H)*0.125 + karis(F,G,K,L)*0.125 + karis(G,H,L,M)*0.125;
          float br = max(c.r, max(c.g, c.b));
          float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0*uKnee);
          soft = soft*soft / (4.0*uKnee + 1e-4);
          float contrib = max(soft, br - uThreshold) / max(br, 1e-4);
          gl_FragColor = vec4(c * contrib, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.downMat = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } },
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
        vec3 s(vec2 o){ return texture2D(tSrc, vUv + o*uTexel).rgb; }
        void main(){
          vec3 A=s(vec2(-2,-2)),B=s(vec2(0,-2)),C=s(vec2(2,-2)),D=s(vec2(-1,-1)),E=s(vec2(1,-1)),F=s(vec2(-2,0)),G=s(vec2(0,0)),H=s(vec2(2,0)),I=s(vec2(-1,1)),J=s(vec2(1,1)),K=s(vec2(-2,2)),L=s(vec2(0,2)),M=s(vec2(2,2));
          vec3 c = (D+E+I+J)*0.125 + (A+C+K+M)*0.03125 + (B+F+H+L)*0.0625 + G*0.125;
          gl_FragColor = vec4(c, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.upMat = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, tPrev: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 1 }, uMix: { value: 1 } },
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tSrc, tPrev; uniform vec2 uTexel; uniform float uRadius, uMix; varying vec2 vUv;
        void main(){
          vec2 o = uTexel * uRadius;
          vec3 c = texture2D(tPrev, vUv + vec2(-o.x, -o.y)).rgb + texture2D(tPrev, vUv + vec2(0.0, -o.y)).rgb*2.0 + texture2D(tPrev, vUv + vec2(o.x, -o.y)).rgb
                 + texture2D(tPrev, vUv + vec2(-o.x, 0.0)).rgb*2.0 + texture2D(tPrev, vUv).rgb*4.0 + texture2D(tPrev, vUv + vec2(o.x, 0.0)).rgb*2.0
                 + texture2D(tPrev, vUv + vec2(-o.x, o.y)).rgb + texture2D(tPrev, vUv + vec2(0.0, o.y)).rgb*2.0 + texture2D(tPrev, vUv + vec2(o.x, o.y)).rgb;
          c /= 16.0;
          gl_FragColor = vec4(texture2D(tSrc, vUv).rgb + c * uMix, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.streakMat = new THREE.ShaderMaterial({
      uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uStep: { value: 1 } },
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */ `
        uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uStep; varying vec2 vUv;
        void main(){
          vec3 c = vec3(0.0); float wsum = 0.0;
          for (int i = -7; i <= 7; i++) { float fi = float(i); float w = exp(-abs(fi)*0.28); c += texture2D(tSrc, vUv + vec2(fi*uStep*uTexel.x, 0.0)).rgb * w; wsum += w; }
          gl_FragColor = vec4(c / wsum, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.compMat = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null }, tBloom: { value: null }, tStreak: { value: null },
        uBloom: { value: 1 }, uStreak: { value: 0 }, uStreakTint: { value: new THREE.Color('#9fd8ff') },
        uExposure: { value: 1 }, uCA: { value: 0.3 }, uVignette: { value: 0.35 }, uGrain: { value: 0.2 },
        uSat: { value: 1.08 }, uContrast: { value: 1.06 }, uLift: { value: new THREE.Vector3(0, 0, 0) },
        uGain: { value: new THREE.Vector3(1, 1, 1) }, uFlash: { value: 0 }, uFlashColor: { value: new THREE.Color('#ffffff') },
        uFade: { value: 0 }, uTime: { value: 0 }, uFrame: { value: 0 }, uRes: { value: new THREE.Vector2(w, h) },
        uLetterbox: { value: 0 }, uTonemap: { value: 1 }, uGlitch: { value: 0 }, uSpeed: { value: 0 }, uSpeedColor: { value: new THREE.Color('#ffffff') }, tOverlay: { value: null }, uOverlayOn: { value: 0 }, tRays: { value: null }, uRays: { value: 0 }, uLightUV: { value: new THREE.Vector2(0.5, 0.5) }, uLightVis: { value: 0 }, uFlare: { value: 0 }, uFlareTint: { value: new THREE.Color('#ffd9b0') },
      },
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D tScene, tBloom, tStreak, tOverlay, tRays; uniform float uOverlayOn, uRays, uLightVis, uFlare; uniform vec2 uLightUV; uniform vec3 uFlareTint;
        uniform float uBloom, uStreak, uExposure, uCA, uVignette, uGrain, uSat, uContrast, uFlash, uFade, uTime, uFrame, uLetterbox, uTonemap, uGlitch, uSpeed; uniform vec3 uSpeedColor;
        uniform vec3 uLift, uGain, uFlashColor, uStreakTint; uniform vec2 uRes;
        varying vec2 vUv;
        float hash(vec2 p){ p = fract(p*vec2(443.897, 441.423)); p += dot(p, p.yx+19.19); return fract((p.x+p.y)*p.x); }
        vec3 aces(vec3 x){ const float a=2.51, b=0.03, c=2.43, d=0.59, e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0); }
        vec3 toSRGB(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
        void main(){
          vec2 uv = vUv;
          if (uGlitch > 0.0) {
            float band = floor(uv.y * 24.0 + floor(uTime*30.0)*3.0);
            float g = step(1.0 - uGlitch*0.35, hash(vec2(band, floor(uTime*30.0))));
            uv.x += (hash(vec2(band, 7.0)) - 0.5) * 0.08 * g * uGlitch;
          }
          vec2 dc = uv - 0.5;
          float r2 = dot(dc, dc);
          vec2 caOff = dc * r2 * uCA * 0.06 + vec2(uGlitch*0.006, 0.0);
          vec3 col;
          col.r = texture2D(tScene, uv + caOff).r;
          col.g = texture2D(tScene, uv).g;
          col.b = texture2D(tScene, uv - caOff).b;
          vec3 bloom = texture2D(tBloom, uv).rgb;
          vec3 bloomCA = vec3(texture2D(tBloom, uv + caOff*2.0).r, bloom.g, texture2D(tBloom, uv - caOff*2.0).b);
          col += bloomCA * uBloom;
          col += texture2D(tStreak, uv).rgb * uStreak * uStreakTint;
          if (uLightVis > 0.001) {
            col += texture2D(tRays, uv).rgb * uRays * uLightVis;
            // flare de lente: some quando o texto tampa a luz (lê o brilho da cena no ponto da luz)
            vec3 atL = texture2D(tScene, clamp(uLightUV, 0.001, 0.999)).rgb;
            float occ = smoothstep(0.4, 2.5, dot(atL, vec3(0.3, 0.59, 0.11)));
            float fv = uFlare * uLightVis * occ;
            if (fv > 0.001) {
              vec2 asp = vec2(uRes.x / uRes.y, 1.0);
              vec2 L = uLightUV;
              vec2 axis = vec2(0.5) - L;
              float dl = length((uv - L) * asp);
              float ang = atan((uv.y - L.y), (uv.x - L.x) * asp.x);
              float star = pow(max(0.0, cos(ang * 6.0)), 40.0) * exp(-dl * 7.0) * 0.5 + pow(max(0.0, cos(ang * 2.0 + 0.4)), 120.0) * exp(-dl * 3.0) * 0.4;
              float core = exp(-dl * 28.0) * 1.2;
              vec3 fl = uFlareTint * (star + core);
              // fantasmas ao longo do eixo luz->centro
              float g1 = smoothstep(0.07, 0.04, length((uv - (L + axis * 0.55)) * asp));
              float g2 = smoothstep(0.035, 0.015, length((uv - (L + axis * 0.95)) * asp));
              float g3 = smoothstep(0.12, 0.09, length((uv - (L + axis * 1.45)) * asp)) - smoothstep(0.09, 0.06, length((uv - (L + axis * 1.45)) * asp)) * 0.7;
              float g4 = smoothstep(0.05, 0.02, length((uv - (L + axis * 1.8)) * asp));
              fl += vec3(0.5, 0.8, 1.0) * g1 * 0.12 + vec3(1.0, 0.6, 0.9) * g2 * 0.2 + vec3(0.6, 1.0, 0.8) * max(0.0, g3) * 0.08 + uFlareTint * g4 * 0.15;
              // anel (halo) em volta do centro da tela
              float hr = length((uv - (L + axis * 1.0)) * asp);
              fl += uFlareTint * smoothstep(0.02, 0.0, abs(hr - 0.32)) * 0.05;
              col += fl * fv;
            }
          }
          col *= uExposure;
          col = mix(col, uFlashColor * 3.0, uFlash * 0.85);
          col = uTonemap > 0.5 ? aces(col) : clamp(col, 0.0, 1.0);
          // grading
          col = col * uGain + uLift * (1.0 - col);
          float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
          col = mix(vec3(l), col, uSat);
          col = clamp((col - 0.5) * uContrast + 0.5, 0.0, 1.0);
          // vinheta
          float vig = smoothstep(0.85, 0.2, length(dc * vec2(uRes.x/uRes.y, 1.0)) * 0.9);
          col *= mix(1.0, vig, uVignette);
          if (uSpeed > 0.001) {
            // linhas radiais de velocidade (estilo anime/candy)
            vec2 q = dc * vec2(uRes.x/uRes.y, 1.0);
            float ang = atan(q.y, q.x);
            float rr = length(q);
            float fr = floor(uTime * 24.0);
            float lineId = floor((ang + 3.14159) * 60.0);
            float h = hash(vec2(lineId, fr));
            float w = smoothstep(0.5, 0.0, abs(fract((ang + 3.14159) * 60.0) - 0.5) * 2.0 - (1.0 - h) * 0.6);
            float on = step(0.72, h) * smoothstep(0.32 + h * 0.15, 0.75, rr);
            col = mix(col, uSpeedColor, clamp(on * w * uSpeed * 0.85, 0.0, 1.0));
          }
          col = mix(col, vec3(0.0), uFade);
          col = toSRGB(col);
          if (uOverlayOn > 0.5) { vec4 ov = texture2D(tOverlay, vUv); col = mix(col, ov.rgb, ov.a); }
          // grão + dither (evita banding no degradê escuro)
          float n = hash(uv * uRes + vec2(uFrame * 17.0, uFrame * 31.0));
          float n2 = hash(uv * uRes * 1.37 + vec2(uFrame * 7.0, uFrame * 13.0));
          col += (n + n2 - 1.0) * (uGrain * 0.045 + 1.0/255.0);
          if (uLetterbox > 0.0) { float bar = uLetterbox * 0.5; if (uv.y < bar || uv.y > 1.0 - bar) col = vec3(0.0); }
          gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
  }

  _pass(mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.qScene, this.qCam);
  }

  // desenha fundo + cena no RT HDR
  renderScene(bg, scene, camera) {
    const r = this.renderer;
    r.setRenderTarget(this.sceneRT);
    r.autoClear = false;
    r.setClearColor(0x000000, 1);
    r.clear(true, true, true);
    const layers = Array.isArray(bg) ? bg : [bg];
    for (const l of layers) if (l) r.render(l.scene, l.camera);
    r.render(scene, camera);
    r.autoClear = true;
  }

  composite(state) {
    const fx = { ...this.fx, ...state };
    const src = this.sceneRT.texture;
    // bloom
    const p = this.prefilterMat.uniforms;
    p.tSrc.value = src;
    p.uTexel.value.set(1 / this.w, 1 / this.h);
    p.uThreshold.value = fx.bloomThreshold ?? 0.9;
    p.uKnee.value = 0.45;
    this._pass(this.prefilterMat, this.down[0]);
    for (let i = 1; i < this.levels; i++) {
      this.downMat.uniforms.tSrc.value = this.down[i - 1].texture;
      this.downMat.uniforms.uTexel.value.set(1 / this.down[i - 1].width, 1 / this.down[i - 1].height);
      this._pass(this.downMat, this.down[i]);
    }
    // sobe somando
    let prev = this.down[this.levels - 1];
    for (let i = this.levels - 2; i >= 0; i--) {
      const u = this.upMat.uniforms;
      u.tSrc.value = this.down[i].texture;
      u.tPrev.value = prev.texture;
      u.uTexel.value.set(1 / prev.width, 1 / prev.height);
      u.uRadius.value = fx.bloomRadius ?? 1.0;
      u.uMix.value = 1.0;
      this._pass(this.upMat, this.up[i]);
      prev = this.up[i];
    }
    const bloomTex = this.up[0].texture;
    // streak anamórfico (opcional)
    const streak = fx.anamorphic ?? 0;
    if (streak > 0) {
      const s = this.streakMat.uniforms;
      s.tSrc.value = this.down[1].texture;
      s.uTexel.value.set(1 / this.streakA.width, 1 / this.streakA.height);
      s.uStep.value = 1.5;
      this._pass(this.streakMat, this.streakA);
      s.tSrc.value = this.streakA.texture;
      s.uStep.value = 5.0;
      this._pass(this.streakMat, this.streakB);
      s.tSrc.value = this.streakB.texture;
      s.uStep.value = 14.0;
      this._pass(this.streakMat, this.streakA);
    }
    const c = this.compMat.uniforms;
    const vis = fx.lightUV ? (fx.lightVis ?? 0) : 0;
    if (vis > 0.001 && (fx.rays ?? 0) > 0) {
      const r = this.raysMat.uniforms;
      r.tSrc.value = this.down[1].texture;
      r.uLight.value.set(fx.lightUV[0], fx.lightUV[1]);
      r.uDensity.value = fx.raysLength ?? 0.95;
      this._pass(this.raysMat, this.raysRT);
    }
    c.tRays.value = this.raysRT.texture;
    c.uRays.value = fx.rays ?? 0;
    c.uLightVis.value = vis;
    if (fx.lightUV) c.uLightUV.value.set(fx.lightUV[0], fx.lightUV[1]);
    c.uFlare.value = fx.flare ?? 0;
    if (fx.flareTint) c.uFlareTint.value.set(fx.flareTint);
    c.tScene.value = src;
    c.tBloom.value = bloomTex;
    c.tStreak.value = this.streakA.texture;
    c.uBloom.value = (fx.bloom ?? 1) * 0.42;
    c.uStreak.value = streak;
    if (fx.streakTint) c.uStreakTint.value.set(fx.streakTint);
    c.uExposure.value = fx.exposure ?? 1;
    c.uCA.value = fx.chromatic ?? 0.3;
    c.uVignette.value = fx.vignette ?? 0.35;
    c.uGrain.value = fx.grain ?? 0.2;
    c.uSat.value = fx.saturation ?? 1.08;
    c.uContrast.value = fx.contrast ?? 1.05;
    const lift = fx.lift || [0, 0, 0], gain = fx.gain || [1, 1, 1];
    c.uLift.value.set(...lift);
    c.uGain.value.set(...gain);
    c.uFlash.value = fx.flash ?? 0;
    if (fx.flashColor) c.uFlashColor.value.set(fx.flashColor);
    c.uFade.value = fx.fade ?? 0;
    c.uTime.value = fx.time ?? 0;
    c.uFrame.value = fx.frame ?? 0;
    c.uLetterbox.value = fx.letterbox ?? 0;
    c.uGlitch.value = fx.glitch ?? 0;
    c.uSpeed.value = fx.speed ?? 0;
    c.tOverlay.value = fx.overlay || null;
    c.uOverlayOn.value = fx.overlay ? 1 : 0;
    if (fx.speedColor) c.uSpeedColor.value.set(fx.speedColor);
    this._pass(this.compMat, null);
  }
}
