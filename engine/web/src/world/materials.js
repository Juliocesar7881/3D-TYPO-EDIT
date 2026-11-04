// Fábrica de materiais. Cada letra recebe sua própria instância (opacidade e
// flash independentes); os shaders são reaproveitados pelo cache do three.
import * as THREE from 'three';

const tmpColor = new THREE.Color();

function col(c, fallback = '#ffffff') {
  return new THREE.Color(c ?? fallback);
}

// tempo compartilhado por shaders animados (holo); main.js atualiza a cada frame
export const SHARED = { time: { value: 0 } };

const GNOISE = /* glsl */ `
float gh(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float gnoise(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(gh(i),gh(i+vec3(1,0,0)),f.x),mix(gh(i+vec3(0,1,0)),gh(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(gh(i+vec3(0,0,1)),gh(i+vec3(1,0,1)),f.x),mix(gh(i+vec3(0,1,1)),gh(i+vec3(1,1,1)),f.x),f.y), f.z); }
float gfbm(vec3 p){ float s=0.0, a=0.5; for(int i=0;i<4;i++){ s+=a*gnoise(p); p*=2.07; a*=0.5; } return s; }
`;

// Modificadores de shader combináveis em qualquer material do three:
//  gradient: { color2, range, axis }  -> degradê vertical no espaço do objeto
//  holo: [c1, c2, c3]                 -> holográfico que muda com o ângulo de visão
//  grunge: 0..1                       -> textura suja/arranhada (cor + rugosidade)
function applyMods(mat, mods) {
  const keys = Object.keys(mods).filter((k) => mods[k]);
  if (!keys.length) return mat;
  const U = {};
  const axis = mods.gradient?.axis || 'y';
  if (mods.gradient) {
    U.uColor2 = { value: col(mods.gradient.color2) };
    const rg = mods.gradient.range || [-0.5, 0.5];
    U.uGradRange = { value: new THREE.Vector2(rg[0], rg[1]) };
  }
  if (mods.holo) {
    U.uH1 = { value: col(mods.holo[0]) };
    U.uH2 = { value: col(mods.holo[1] ?? mods.holo[0]) };
    U.uH3 = { value: col(mods.holo[2] ?? mods.holo[0]) };
    U.uHoloTime = SHARED.time;
  }
  if (mods.grunge) U.uGrunge = { value: mods.grunge };
  mat.userData.mods = U;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjP = position;');
    let head = 'varying vec3 vObjP;\n';
    if (mods.gradient) head += 'uniform vec3 uColor2; uniform vec2 uGradRange;\n';
    if (mods.holo) head += 'uniform vec3 uH1, uH2, uH3; uniform float uHoloTime;\n';
    if (mods.grunge) head += 'uniform float uGrunge;\n' + GNOISE;
    let fs = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + head);
    if (mods.gradient) {
      fs = fs.replace(
        'vec4 diffuseColor = vec4( diffuse, opacity );',
        `float gT = clamp((vObjP.${axis} - uGradRange.x) / max(1e-4, uGradRange.y - uGradRange.x), 0.0, 1.0);\n vec4 diffuseColor = vec4( mix(uColor2, diffuse, gT), opacity );`
      );
    }
    if (mods.grunge) {
      const code = `
        float gN = gfbm(vObjP * 7.0);
        float gS = smoothstep(0.74, 0.8, gnoise(vObjP * vec3(60.0, 3.5, 60.0)));
        diffuseColor.rgb *= mix(1.0, (0.5 + 0.75 * gN) * (1.0 - 0.5 * gS), uGrunge);`;
      if (fs.includes('#include <roughnessmap_fragment>')) {
        fs = fs.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${code}\n roughnessFactor = clamp(roughnessFactor + (gN - 0.45) * 0.7 * uGrunge + gS * 0.35 * uGrunge, 0.02, 1.0);`);
      } else {
        fs = fs.replace('#include <color_fragment>', `#include <color_fragment>\n${code}`);
      }
    }
    if (mods.holo) {
      fs = fs.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          vec3 nV = normalize(normal); vec3 vV = normalize(vViewPosition);
          float fr = 1.0 - abs(dot(nV, vV));
          float hk = fract(fr * 1.35 + vObjP.x * 0.21 + vObjP.y * 0.33 + uHoloTime * 0.11);
          vec3 hc = hk < 0.3333 ? mix(uH1, uH2, hk * 3.0) : (hk < 0.6666 ? mix(uH2, uH3, (hk - 0.3333) * 3.0) : mix(uH3, uH1, (hk - 0.6666) * 3.0));
          diffuseColor.rgb = hc;
          totalEmissiveRadiance += hc * (0.16 + 0.55 * fr * fr);
        }`);
    }
    shader.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => 'mods-' + keys.join('-') + '-' + axis;
  return mat;
}

/**
 * spec: { type, color, color2, intensity, roughness, metalness, opacity, env }
 * types: chrome | metal | candy | glossy | iridescent | holo | glow | neon | flat |
 *        matte | glass | gradient | gradient-glow
 */
export function createMaterial(spec = {}, ctx = {}) {
  const type = spec.type || 'chrome';
  const color = col(spec.color, '#ffffff');
  const intensity = spec.intensity ?? 2.6;
  let m;
  switch (type) {
    case 'chrome':
      m = new THREE.MeshStandardMaterial({
        color, metalness: spec.metalness ?? 1, roughness: spec.roughness ?? 0.13,
        envMapIntensity: spec.env ?? 1.35,
      });
      break;
    case 'metal':
      m = new THREE.MeshStandardMaterial({
        color, metalness: spec.metalness ?? 0.85, roughness: spec.roughness ?? 0.28,
        envMapIntensity: spec.env ?? 1.2,
      });
      break;
    case 'candy':
    case 'glossy':
      m = new THREE.MeshPhysicalMaterial({
        color, metalness: spec.metalness ?? 0, roughness: spec.roughness ?? 0.3,
        clearcoat: 1, clearcoatRoughness: 0.05,
        sheen: type === 'candy' ? 0.22 : 0, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.35,
        envMapIntensity: spec.env ?? 1.05,
      });
      break;
    case 'iridescent':
    case 'holo':
      m = new THREE.MeshPhysicalMaterial({
        color, metalness: spec.metalness ?? 0.55, roughness: spec.roughness ?? 0.16,
        iridescence: 1, iridescenceIOR: 1.7, iridescenceThicknessMinimum: 180, iridescenceThicknessMaximum: 900,
        clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: spec.env ?? 1.4,
      });
      break;
    case 'glow':
    case 'neon':
      m = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(intensity) });
      break;
    case 'flat':
      m = new THREE.MeshBasicMaterial({ color });
      break;
    case 'matte':
      m = new THREE.MeshStandardMaterial({ color, roughness: spec.roughness ?? 0.75, metalness: 0, envMapIntensity: spec.env ?? 0.6 });
      break;
    case 'glass':
      m = new THREE.MeshPhysicalMaterial({
        color, metalness: 0, roughness: spec.roughness ?? 0.04, clearcoat: 1, clearcoatRoughness: 0.02,
        transparent: true, opacity: spec.opacity ?? 0.28, envMapIntensity: spec.env ?? 2.4,
        depthWrite: false, side: THREE.DoubleSide,
      });
      break;
    case 'gradient':
      m = new THREE.MeshPhysicalMaterial({
        color, metalness: spec.metalness ?? 0.35, roughness: spec.roughness ?? 0.22,
        clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: spec.env ?? 1.2,
      });
      applyMods(m, { gradient: { color2: spec.color2 ?? '#000000', range: spec.range, axis: spec.axis }, grunge: spec.grunge });
      spec.__modsApplied = true;
      break;
    case 'gradient-glow':
      m = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(intensity) });
      applyMods(m, { gradient: { color2: col(spec.color2 ?? '#000000').multiplyScalar(intensity), range: spec.range, axis: spec.axis } });
      spec.__modsApplied = true;
      break;
    case 'hologram':
      m = new THREE.MeshPhysicalMaterial({
        color: '#ffffff', metalness: spec.metalness ?? 0.3, roughness: spec.roughness ?? 0.12,
        clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: spec.env ?? 1.15,
      });
      applyMods(m, { holo: spec.colors || [spec.color || '#2de2ff', spec.color2 || '#ff3fb4', spec.color3 || '#9b5cff'], grunge: spec.grunge });
      spec.__modsApplied = true;
      break;
    default:
      m = new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.3 });
  }
  if (spec.grunge && !spec.__modsApplied) applyMods(m, { grunge: spec.grunge });
  delete spec.__modsApplied;
  if (spec.opacity != null && type !== 'glass') {
    m.opacity = spec.opacity;
    m.transparent = spec.opacity < 1;
  }
  if (spec.side === 'double') m.side = THREE.DoubleSide;
  if (spec.additive) {
    m.blending = THREE.AdditiveBlending;
    m.transparent = true;
    m.depthWrite = false;
  }
  m.userData.spec = spec;
  m.userData.baseOpacity = m.opacity;
  m.userData.baseColor = m.color ? m.color.clone() : null;
  m.userData.isBasic = m.isMeshBasicMaterial === true;
  return m;
}

// aplica opacidade/flash animados sem recriar material
export function setMaterialState(m, opacity = 1, flash = 0) {
  const base = m.userData.baseOpacity ?? 1;
  const o = base * opacity;
  m.opacity = o;
  const wantT = o < 0.999 || m.userData.spec?.type === 'glass' || m.userData.spec?.additive;
  if (m.transparent !== wantT) m.transparent = wantT;
  m.visible = o > 0.002;
  if (m.userData.isBasic) {
    if (m.userData.baseColor) {
      m.color.copy(m.userData.baseColor).multiplyScalar(1 + flash * 1.1);
    }
  } else if (m.emissive) {
    m.emissive.setRGB(1, 1, 1);
    m.emissiveIntensity = flash * 0.75;
  }
}

export function shade(hex, amount) {
  // amount < 0 escurece, > 0 clareia (em HSL)
  tmpColor.set(hex);
  const hsl = {};
  tmpColor.getHSL(hsl);
  hsl.l = Math.min(1, Math.max(0, hsl.l + amount));
  tmpColor.setHSL(hsl.h, hsl.s, hsl.l);
  return '#' + tmpColor.getHexString();
}
