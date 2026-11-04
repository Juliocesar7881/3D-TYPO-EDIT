// Ambientes procedurais (reflexos). O visual cromado/glossy das letras depende
// muito disso: "softboxes" coloridas num estúdio escuro geram reflexos neon.
import * as THREE from 'three';

function gradientSphere(top, mid, bottom, midPos = 0.5) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      cTop: { value: new THREE.Color(top) },
      cMid: { value: new THREE.Color(mid) },
      cBot: { value: new THREE.Color(bottom) },
      midPos: { value: midPos },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `uniform vec3 cTop,cMid,cBot; uniform float midPos; varying vec3 vP;
      void main(){ float h = vP.y*0.5+0.5; vec3 c = h<midPos ? mix(cBot,cMid,smoothstep(0.0,midPos,h)) : mix(cMid,cTop,smoothstep(midPos,1.0,h)); gl_FragColor=vec4(c,1.0);} `,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(50, 48, 24), mat);
}

function panel(color, intensity, w, h, pos, lookAt = [0, 0, 0]) {
  const c = new THREE.Color(color).multiplyScalar(intensity);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
  m.position.set(...pos);
  m.lookAt(...lookAt);
  return m;
}

// spec.env: { kind: 'studio-neon' | 'candy' | 'chrome-white' | 'sunset', colors: [...] }
export function buildEnvironment(renderer, theme) {
  const env = theme.env || {};
  const pal = theme.palette || ['#2de2ff', '#ff2bd6', '#8a5cff'];
  const kind = env.kind || 'studio-neon';
  const scene = new THREE.Scene();
  if (kind === 'candy') {
    // base escura + softboxes brancas: brilho "de bala" nítido sem véu leitoso
    scene.add(gradientSphere(env.top || '#7a5a86', env.mid || '#3e2c4c', env.bottom || '#2a1d36', 0.5));
    scene.add(panel('#ffffff', 3.6, 22, 7, [0, 16, 28]));
    scene.add(panel('#ffffff', 2.6, 5, 22, [-24, 2, 22]));
    scene.add(panel('#fff0f8', 2.0, 5, 18, [24, -2, 22]));
    scene.add(panel('#ffffff', 3.2, 34, 3, [0, 27, 0]));
    scene.add(panel(pal[1] || '#8fd3ff', 1.2, 12, 18, [30, 2, -8]));
    scene.add(panel(pal[0] || '#ff8fc7', 1.1, 40, 6, [0, -18, -20]));
  } else if (kind === 'chrome-white') {
    scene.add(gradientSphere('#0b0d12', '#2a2f3a', '#020203', 0.52));
    scene.add(panel('#ffffff', 6, 60, 3, [0, 14, -30]));
    scene.add(panel('#ffffff', 4, 3, 40, [-30, 0, 10]));
    scene.add(panel('#cfe3ff', 3, 3, 40, [30, 0, 0]));
    scene.add(panel('#ffffff', 2.5, 40, 2, [0, -10, 30]));
  } else if (kind === 'sunset') {
    scene.add(gradientSphere('#1a0630', '#ff6a3d', '#12030a', 0.5));
    scene.add(panel('#ffd28a', 5, 40, 6, [0, 4, -30]));
    scene.add(panel(pal[1] || '#ff3d7f', 3, 6, 30, [-28, 0, 4]));
    scene.add(panel(pal[2] || '#7a3dff', 3, 6, 30, [28, 0, 4]));
  } else {
    // studio-neon (padrão): estúdio escuro com tiras de neon na paleta
    // O ambiente gira junto com a câmera (main.js), então +Z = "atrás da câmera":
    // é o que a face frontal das letras reflete. Ali ficam softbox branca + tiras coloridas.
    scene.add(gradientSphere(env.top || '#0d0a24', env.mid || '#1b1236', env.bottom || '#030208', 0.5));
    const cols = env.colors || pal;
    const c = (i) => cols[i % cols.length];
    // atrás da câmera (reflexo principal da face das letras)
    scene.add(panel('#ffffff', 3.4, 26, 7, [0, 15, 30]));
    scene.add(panel(c(0), 4.2, 5, 30, [-21, 0, 27]));
    scene.add(panel(c(1), 4.2, 5, 30, [21, -1, 27]));
    scene.add(panel(c(2), 3.2, 34, 4, [0, -13, 29]));
    scene.add(panel('#ffffff', 1.6, 8, 8, [0, 2, 34]));
    // topo e laterais (bordas, bevel e laterais da extrusão)
    scene.add(panel('#ffffff', 4.5, 40, 3, [0, 27, 0]));
    scene.add(panel(c(3) || c(0), 3.6, 3, 34, [-31, 0, -4]));
    scene.add(panel(c(1), 3.6, 3, 34, [31, 0, -6]));
    // atrás do texto (rim)
    scene.add(panel(c(2), 3.0, 36, 3, [0, 5, -32]));
    scene.add(panel('#ffffff', 2.2, 3, 22, [-12, -4, -31]));
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.035);
  pmrem.dispose();
  scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  return rt.texture;
}
