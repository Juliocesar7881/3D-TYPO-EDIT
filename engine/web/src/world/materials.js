// Fábrica de materiais. Cada letra recebe sua própria instância (opacidade e
// flash independentes); os shaders são reaproveitados pelo cache do three.
import * as THREE from 'three';

const tmpColor = new THREE.Color();

function col(c, fallback = '#ffffff') {
  return new THREE.Color(c ?? fallback);
}

// injeta gradiente vertical (espaço do objeto) em qualquer material do three
function addGradient(mat, color2, range = [-0.5, 0.5], axis = 'y') {
  const uColor2 = { value: col(color2) };
  const uRange = { value: new THREE.Vector2(range[0], range[1]) };
  mat.userData.gradient = { uColor2, uRange };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uColor2 = uColor2;
    shader.uniforms.uGradRange = uRange;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vGradT;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvGradT = position.${axis};`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uColor2; uniform vec2 uGradRange; varying float vGradT;')
      .replace(
        'vec4 diffuseColor = vec4( diffuse, opacity );',
        'float gT = clamp((vGradT - uGradRange.x) / max(1e-4, uGradRange.y - uGradRange.x), 0.0, 1.0);\n vec4 diffuseColor = vec4( mix(uColor2, diffuse, gT), opacity );'
      );
  };
  mat.customProgramCacheKey = () => 'grad-' + axis;
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
      addGradient(m, spec.color2 ?? '#000000', spec.range, spec.axis);
      break;
    case 'gradient-glow':
      m = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(intensity) });
      addGradient(m, col(spec.color2 ?? '#000000').multiplyScalar(intensity), spec.range, spec.axis);
      break;
    default:
      m = new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.3 });
  }
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
