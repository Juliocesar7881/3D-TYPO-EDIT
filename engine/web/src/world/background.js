// Fundo em tela cheia calculado pela direção de visão (fica "no infinito",
// gira junto com a câmera sem distorcer). Tipos: nebula | candy | void | sunset | dream
import * as THREE from 'three';

const NOISE_GLSL = /* glsl */ `
vec3 hash33(vec3 p){ p = fract(p*vec3(.1031,.1030,.0973)); p += dot(p, p.yxz+33.33); return fract((p.xxy+p.yxx)*p.zyx); }
float hash13(vec3 p){ p = fract(p*.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float vnoise(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  float n000=hash13(i), n100=hash13(i+vec3(1,0,0)), n010=hash13(i+vec3(0,1,0)), n110=hash13(i+vec3(1,1,0));
  float n001=hash13(i+vec3(0,0,1)), n101=hash13(i+vec3(1,0,1)), n011=hash13(i+vec3(0,1,1)), n111=hash13(i+vec3(1,1,1));
  return mix(mix(mix(n000,n100,f.x),mix(n010,n110,f.x),f.y), mix(mix(n001,n101,f.x),mix(n011,n111,f.x),f.y), f.z); }
float fbm(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<5;i++){ s+=a*vnoise(p); p=p*2.02+vec3(1.7,9.2,3.1); a*=0.5;} return s; }
`;

export class Background {
  constructor(theme) {
    const bg = theme.background || {};
    const pal = theme.palette || ['#2de2ff', '#ff2bd6', '#8a5cff'];
    const kinds = { nebula: 0, candy: 1, void: 2, sunset: 3, dream: 4, checker: 5 };
    this.uniforms = {
      uInvProj: { value: new THREE.Matrix4() },
      uCamWorld: { value: new THREE.Matrix4() },
      uTime: { value: 0 },
      uKind: { value: kinds[bg.kind || 'nebula'] ?? 0 },
      uC1: { value: new THREE.Color(bg.colors?.[0] || pal[0]) },
      uC2: { value: new THREE.Color(bg.colors?.[1] || pal[1]) },
      uC3: { value: new THREE.Color(bg.colors?.[2] || pal[2] || pal[0]) },
      uBase: { value: new THREE.Color(bg.base || '#04020a') },
      uTop: { value: new THREE.Color(bg.top || '#ffd1ea') },
      uBottom: { value: new THREE.Color(bg.bottom || '#e9d7ff') },
      uIntensity: { value: bg.intensity ?? 1 },
      uStars: { value: bg.stars ?? 1 },
      uPulse: { value: 0 },
      uHue: { value: 0 },
      uPattern: { value: bg.pattern === 'none' ? 0 : bg.pattern === 'checker' ? 2 : bg.pattern === 'stripes' ? 3 : 1 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      depthTest: false,
      depthWrite: false,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform mat4 uInvProj, uCamWorld; uniform float uTime, uKind, uIntensity, uStars, uPulse, uPattern;
        uniform vec3 uC1, uC2, uC3, uBase, uTop, uBottom;
        varying vec2 vUv;
        ${NOISE_GLSL}
        vec3 viewDir(){
          vec4 clip = vec4(vUv*2.0-1.0, 1.0, 1.0);
          vec4 v = uInvProj * clip; v /= v.w;
          return normalize((uCamWorld * vec4(normalize(v.xyz), 0.0)).xyz);
        }
        float stars(vec3 d, float dens, float sz){
          vec3 p = d * dens; vec3 c = floor(p); vec3 h = hash33(c);
          vec3 sp = c + 0.15 + 0.7*h; float dist = length(p - sp);
          float tw = 0.6 + 0.4*sin(uTime*(1.5+h.x*3.0) + h.y*20.0);
          return step(0.82, h.z) * smoothstep(sz, 0.0, dist) * tw;
        }
        float dots(vec3 d, float dens, float r){
          vec3 p = d * dens; vec3 c = floor(p) + 0.5; float dist = length(p - c);
          return smoothstep(r, r - 0.04, dist);
        }
        void main(){
          vec3 d = viewDir();
          vec3 col;
          if (uKind < 0.5) { // nebula espacial colorida
            vec3 q = d*2.2 + vec3(0.0, 0.0, uTime*0.015);
            vec3 w = vec3(fbm(q+vec3(0.0,1.3,4.1)), fbm(q+vec3(5.2,2.8,1.7)), fbm(q+vec3(2.1,7.3,3.3)));
            float n = fbm(q*1.3 + w*2.4);
            float m = fbm(q*0.7 - w + 3.0);
            vec3 neb = mix(uC1, uC2, smoothstep(0.35, 0.75, m));
            neb = mix(neb, uC3, smoothstep(0.55, 0.9, w.x));
            float dens = smoothstep(0.42, 0.95, n);
            col = uBase + neb * dens * dens * 0.55 * uIntensity;
            col += neb * pow(dens, 6.0) * 1.2 * uIntensity;
            col += vec3(1.0) * stars(d, 120.0, 0.12) * 0.9 * uStars;
            col += mix(uC1,vec3(1.0),0.5) * stars(d, 60.0, 0.09) * 0.7 * uStars;
          } else if (uKind < 1.5) { // candy pastel
            float h = d.y*0.5+0.5;
            col = mix(uBottom, uTop, smoothstep(0.1, 0.9, h));
            float n = fbm(d*1.6 + vec3(uTime*0.02));
            col = mix(col, mix(uC1, uC2, n), 0.3);
            if (uPattern > 0.5 && uPattern < 1.5) col = mix(col, vec3(1.0), dots(d, 12.0, 0.2) * 0.5);
            if (uPattern > 1.5 && uPattern < 2.5) {
              vec3 p = floor(d*10.0); float ch = mod(p.x+p.y+p.z, 2.0);
              col = mix(col, mix(col, vec3(1.0), 0.45), ch);
            }
            if (uPattern > 2.5) { float s = step(0.5, fract((d.x+d.y)*9.0 + uTime*0.2)); col = mix(col, vec3(1.0), s*0.22); }
            // bokeh suaves
            vec3 p = d*5.0; vec3 c = floor(p); vec3 hh = hash33(c);
            float b = smoothstep(0.42, 0.15, length(p - (c + 0.2 + 0.6*hh))) * step(0.6, hh.z);
            col = mix(col, vec3(1.0), b * 0.35);
            col *= uIntensity;
          } else if (uKind < 2.5) { // void preto com poeira
            col = uBase + uC1 * 0.02 * (d.y*0.5+0.5);
            col += vec3(1.0) * stars(d, 140.0, 0.1) * 0.5 * uStars;
          } else if (uKind < 3.5) { // sunset
            float h = d.y*0.5+0.5;
            col = mix(uC1*0.35, uC2*0.6, smoothstep(0.35, 0.55, h));
            col = mix(col, uBase, smoothstep(0.55, 1.0, h));
            col += uC3 * pow(max(0.0, 1.0-abs(d.y)*6.0), 3.0) * 0.6;
            col += vec3(1.0) * stars(d, 120.0, 0.1) * 0.6 * smoothstep(0.55,0.8,h) * uStars;
            col *= uIntensity;
          } else if (uKind < 4.5) { // dream (nebula pastel brilhante)
            vec3 q = d*1.8 + vec3(uTime*0.01);
            float n = fbm(q + fbm(q*1.7)*1.5);
            col = mix(uC1, uC2, smoothstep(0.3, 0.7, n));
            col = mix(col, uC3, smoothstep(0.6, 0.85, fbm(q*2.3+4.0)));
            col *= (0.25 + 0.5*n) * uIntensity;
            col += vec3(1.0) * stars(d, 90.0, 0.12) * 0.8 * uStars;
          } else { // checker 3D (candy forte)
            vec3 p = floor(d*8.0 + vec3(uTime*0.05, 0.0, 0.0)); float ch = mod(p.x+p.y+p.z, 2.0);
            col = mix(uTop, uBottom, ch) * uIntensity;
          }
          col *= 1.0 + uPulse*0.35;
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    this.mesh.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.mesh);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  update(t, cam, pulse = 0) {
    this.uniforms.uTime.value = t;
    this.uniforms.uInvProj.value.copy(cam.projectionMatrixInverse);
    this.uniforms.uCamWorld.value.copy(cam.matrixWorld);
    this.uniforms.uPulse.value = pulse;
  }
}
