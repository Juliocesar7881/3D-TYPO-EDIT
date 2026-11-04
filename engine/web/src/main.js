// Entrada da página de render. Carrega a cena normalizada do servidor do CLI,
// monta o mundo e expõe window.__engine para o Node renderizar frame a frame.
import * as THREE from 'three';
import { loadFont } from './text/fonts.js';
import { STYLES, resolveTheme } from './director/themes.js';
import { planEdit } from './director/auto.js';
import { buildWorld } from './director/builder.js';
import { buildEnvironment } from './world/env.js';
import { Background } from './world/background.js';
import { Sky } from './world/sky.js';
import { SHARED } from './world/materials.js';
import { RNG } from './core/rng.js';
import { PostPipeline } from './post/pipeline.js';
import { Overlay2D, loadOverlayFonts } from './post/overlay.js';
import { AudioReactive } from './core/audio.js';
import { Simplex3 } from './core/noise.js';
import { clamp, impulse } from './core/easing.js';

const QUALITY = {
  draft: { resScale: 0.5, msaa: 0, bloomLevels: 5, particleScale: 0.5, curveSegments: 5, bevelSegments: 2, geoScale: 0.6 },
  preview: { resScale: 0.5, msaa: 4, bloomLevels: 6, particleScale: 0.8, curveSegments: 6, bevelSegments: 2, geoScale: 0.8 },
  final: { resScale: 1, msaa: 4, bloomLevels: 6, particleScale: 1, curveSegments: 9, bevelSegments: 3, geoScale: 1 },
};

const TONEMAP = { none: 0, aces: 1, neutral: 2 };

async function boot() {
  const params = new URLSearchParams(location.search);
  const sceneUrl = params.get('scene') || '/__scene';
  const S = await (await fetch(sceneUrl)).json();
  const out = S.output || {};
  const qName = S.quality || 'final';
  const quality = { ...(QUALITY[qName] || QUALITY.final), ...(S.qualityOverrides || {}) };
  const W = Math.round((out.width || 1920) * (S.resScale ?? quality.resScale) / 2) * 2;
  const H = Math.round((out.height || 1080) * (S.resScale ?? quality.resScale) / 2) * 2;
  const fps = out.fps || 30;

  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance', alpha: false });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  document.body.appendChild(renderer.domElement);

  const theme = resolveTheme(S.theme || 'neon', S.themeOverrides);
  if (S.palette) theme.palette = S.palette;
  const fx = { ...theme.fx, ...(S.fx || {}) };
  const audio = new AudioReactive(S.audioAnalysis, { offset: S.audio?.offset || 0 });
  const seed = S.seed ?? 7;
  const simplex = new Simplex3(seed);
  const noise = (x, y, z) => simplex.noise(x, y, z);

  // fontes usadas pelos estilos do tema + overrides
  const fontNames = new Set(['anton']);
  for (const k of Object.keys(theme.styles)) if (STYLES[k]?.font) fontNames.add(STYLES[k].font);
  for (const w of S.words || []) if (w.font) fontNames.add(String(w.font).toLowerCase());
  for (const s of S.shots || []) if (s?.style && STYLES[s.style]?.font) fontNames.add(STYLES[s.style].font);
  for (const w of S.words || []) if (w.style && STYLES[w.style]?.font) fontNames.add(STYLES[w.style].font);
  const fonts = {};
  await Promise.all([...fontNames].map(async (n) => { fonts[n] = await loadFont(n); }));

  const duration = S.duration;
  const plan = planEdit({ ...S, duration }, theme, fonts, audio);
  const ctx = { quality, noise, audio, seed, shake: (S.director?.shake ?? theme.camera.shake ?? 0.5), aspect: W / H, resScale: W / (out.width || 1920), letterFlash: fx.letterFlash ?? 1, W, H };
  const env = buildEnvironment(renderer, theme);
  const world = buildWorld(plan, theme, fonts, ctx, env);
  const bg = new Background(theme);
  const post = new PostPipeline(renderer, W, H, fx, quality);
  // céu volumétrico (clouds/smoke/space): luz sempre atrás do texto de cada shot
  const SKY_KINDS = ['clouds', 'smoke', 'space'];
  const sky = SKY_KINDS.includes(theme.background?.kind) ? new Sky(renderer, theme, { resScale: W / (out.width || 1920) }) : null;
  const shotSkyQ = [];
  if (sky) {
    const worldUp = new THREE.Vector3(0, 1, 0);
    const lp = sky.lightPano.clone();
    const rightP = new THREE.Vector3().crossVectors(lp, worldUp).normalize();
    const upP = new THREE.Vector3().crossVectors(rightP, lp).normalize();
    const MP = new THREE.Matrix4().makeBasis(rightP, upP, lp.clone().negate());
    plan.shots.forEach((s, i) => {
      const rig = world.camDir.rigs[i].rig;
      const P = rig.sample((s.start + s.end) / 2, {});
      const fwd = P.target.clone().sub(P.pos).normalize();
      const r = new RNG((seed * 7919 + i * 104729) >>> 0);
      const side = new THREE.Vector3().crossVectors(fwd, worldUp).normalize();
      const up2 = new THREE.Vector3().crossVectors(side, fwd).normalize();
      const Ld = fwd.clone().addScaledVector(side, r.range(-0.42, 0.42) * (theme.background.lightSpread ?? 1)).addScaledVector(up2, r.range(0.1, 0.32)).normalize();
      const rightW = new THREE.Vector3().crossVectors(Ld, worldUp).normalize();
      const upW = new THREE.Vector3().crossVectors(rightW, Ld).normalize();
      const MW = new THREE.Matrix4().makeBasis(rightW, upW, Ld.clone().negate());
      // mundo -> panorama
      const M = MP.clone().multiply(MW.clone().transpose());
      shotSkyQ.push(new THREE.Quaternion().setFromRotationMatrix(M));
    });
  }
  const skyQ = new THREE.Quaternion();
  const skyDrift = new THREE.Quaternion();
  const lightW = new THREE.Vector3();
  const camFwd = new THREE.Vector3();
  const tintC = new THREE.Color();
  const whiteC = new THREE.Color(1, 1, 1);
  function shotBlend(t) {
    let i = 0;
    for (let j = 0; j < plan.shots.length; j++) {
      const s = plan.shots[j];
      const lead = s.transition ? s.transition.dur * 0.62 : 0;
      if (t >= s.start - lead) i = j;
    }
    const s = plan.shots[i];
    let u = 1;
    if (i > 0 && s.transition) {
      const a = s.start - s.transition.dur * 0.62;
      u = clamp((t - a) / Math.max(0.05, s.transition.dur));
      u = u * u * (3 - 2 * u);
    }
    return { i, u };
  }
  // cards 2D (intro/outro): "cards": [...] ou atalhos "intro"/"outro"
  const cards = [...(S.cards || [])];
  if (S.intro) cards.push({ from: 0, ...S.intro, to: S.intro.to ?? S.intro.until ?? 2 });
  if (S.outro) cards.push({ ...S.outro, from: S.outro.from ?? Math.max(0, duration - 2), to: S.outro.to ?? duration });
  let overlay = null;
  if (cards.length) {
    await loadOverlayFonts();
    overlay = new Overlay2D(W, H, cards, audio, theme);
  }
  const moodFollow = theme.background?.moodFollow;
  const baseBg = [bg.uniforms.uC1.value.clone(), bg.uniforms.uC2.value.clone(), bg.uniforms.uC3.value.clone()];
  const moodCols = plan.shots.map((s) => s.mood.map((c) => new THREE.Color(c)));
  const tmpC = new THREE.Color();

  function moodAt(t, k) {
    // cor do fundo segue o shot atual, misturando durante a transição
    let i = 0;
    for (let j = 0; j < plan.shots.length; j++) {
      const s = plan.shots[j];
      const lead = s.transition ? s.transition.dur * 0.62 : 0;
      if (t >= s.start - lead) i = j;
    }
    const s = plan.shots[i];
    const cur = moodCols[i]?.[k] || baseBg[k];
    if (i > 0 && s.transition) {
      const a = s.start - s.transition.dur * 0.62;
      const u = clamp((t - a) / Math.max(0.05, s.transition.dur));
      return tmpC.copy(moodCols[i - 1][k]).lerp(cur, u * u * (3 - 2 * u));
    }
    return tmpC.copy(cur);
  }

  const startT = S.start || 0;
  const envQ = new THREE.Quaternion();
  const driftQ = new THREE.Quaternion();
  const yAxis = new THREE.Vector3(0, 1, 0);
  function renderAt(t, frame) {
    const beat = audio.hasAudio ? audio.beatPulse(t, 0.16) : 0;
    const hit = audio.hasAudio ? audio.hitPulse(t, 0.2) : 0;
    SHARED.time.value = t;
    world.camDir.apply(t);
    const cam = world.camera;
    cam.updateMatrixWorld(true);
    // reflexos presos à câmera (com leve deriva) => cromado sempre bem iluminado
    if (theme.env?.follow !== false) {
      envQ.copy(cam.quaternion).multiply(driftQ.setFromAxisAngle(yAxis, Math.sin(t * 0.37) * 0.4 + Math.sin(t * 0.13) * 0.25));
      world.scene.environmentRotation.setFromQuaternion(envQ);
    }
    const projScale = H / 2 / Math.tan((cam.fov * Math.PI) / 360);
    const pose = world.camDir.pose(t);
    const focusDist = pose ? pose.pos.distanceTo(pose.target) : 14;
    const fctx = { t, beat, hit, projScale, focusDist, noise, wordFlash: 0, camPos: cam.position };
    for (const u of world.updatables) u.update(t, fctx);
    if (moodFollow) {
      for (let k = 0; k < 3; k++) {
        const c = moodAt(t, k);
        const uni = [bg.uniforms.uC1, bg.uniforms.uC2, bg.uniforms.uC3][k];
        uni.value.copy(baseBg[k]).lerp(c, 0.85);
      }
    }
    let lightUV = null, lightVis = 0;
    if (sky) {
      const { i, u } = shotBlend(t);
      skyQ.copy(i > 0 && u < 1 ? shotSkyQ[i - 1] : shotSkyQ[i]);
      if (i > 0 && u < 1) skyQ.slerp(shotSkyQ[i], u);
      skyDrift.setFromAxisAngle(yAxis, t * (theme.background.drift ?? 0.012));
      sky.setRotation(skyDrift.multiply(skyQ));
      // tinta da seção (cor do shot) por cima do céu
      const k = theme.background.tint ?? 0.22;
      const mc = moodCols[i]?.[0];
      if (mc) {
        tintC.copy(whiteC).lerp(mc, k);
        if (i > 0 && u < 1) tintC.lerp(new THREE.Color().copy(whiteC).lerp(moodCols[i - 1][0], k), 1 - u);
        const l = tintC.r * 0.3 + tintC.g * 0.59 + tintC.b * 0.11;
        tintC.multiplyScalar(1 / Math.max(0.2, l));
      }
      sky.update(t, cam, beat * (fx.bgPulse ?? 0.3), mc ? tintC : null);
      // luz na tela (raios / flare)
      sky.lightWorld(lightW);
      cam.getWorldDirection(camFwd);
      const facing = camFwd.dot(lightW);
      if (facing > 0.05) {
        const p = cam.position.clone().addScaledVector(lightW, 500).project(cam);
        lightUV = [p.x * 0.5 + 0.5, p.y * 0.5 + 0.5];
        const edge = Math.max(Math.abs(p.x), Math.abs(p.y));
        lightVis = clamp((facing - 0.05) / 0.4) * clamp((1.6 - edge) / 0.6);
      }
      post.renderScene(sky, world.scene, cam);
    } else {
      bg.update(t, cam, beat * (fx.bgPulse ?? 0.4));
      post.renderScene(bg, world.scene, cam);
    }
    // efeitos de tempo
    let flash = 0, glitch = 0;
    for (const s of plan.shots) {
      if (s.flashAtStart) flash = Math.max(flash, impulse(t, s.start, 0.11) * 0.9);
      if (s.transition?.glitch) {
        const d = t - s.start;
        if (d > -0.08 && d < 0.14) glitch = Math.max(glitch, 1 - Math.abs(d - 0.02) / 0.12);
      }
    }
    for (const f of fx.flashes || []) flash = Math.max(flash, impulse(t, f.t ?? f, f.decay ?? 0.12) * (f.amount ?? 0.9));
    // speed lines (candy/anime) durante o voo da câmera
    let speed = 0;
    if (fx.speedLines) {
      for (const s of plan.shots) {
        if (!s.transition || s.transition.style === 'cut') continue;
        const a = s.start - s.transition.dur * 0.62;
        const u = (t - a) / s.transition.dur;
        if (u > 0 && u < 1) speed = Math.max(speed, Math.sin(Math.PI * u));
      }
      speed *= fx.speedLines;
    }
    let fade = 0;
    if (S.fadeIn !== false) fade = Math.max(fade, 1 - clamp((t - startT) / (S.fadeIn ?? 0.35)));
    if (S.fadeOut !== false && duration) fade = Math.max(fade, clamp((t - (duration - (S.fadeOut ?? 0.6))) / (S.fadeOut ?? 0.6)));
    const ovOn = overlay ? overlay.draw(t) : false;
    post.composite({
      overlay: ovOn ? overlay.tex : null,
      bloom: (fx.bloom ?? 1) * (1 + beat * (fx.bloomPulse ?? 0.3)),
      chromatic: (fx.chromatic ?? 0.3) + hit * (fx.chromaticPulse ?? 0.35) + glitch * 0.8,
      flash, glitch, fade, time: t, frame, speed, lightUV, lightVis: lightVis * (1 + beat * 0.25),
      tonemap: TONEMAP[fx.tonemap] ?? 1,
    });
  }

  // tonemap selecionável
  const origComposite = post.composite.bind(post);
  post.composite = (state) => {
    post.compMat.uniforms.uTonemap.value = state.tonemap ?? 1;
    origComposite(state);
  };

  const gl = renderer.getContext();
  let pixels = null;
  let uploads = 0;
  // Cada frame vira um Blob de vários MB; o Chromium só libera a memória dos Blobs
  // quando o GC roda (o heap JS é pequeno, então ele quase nunca roda sozinho) e
  // estoura em ~2 GB (ERR_BLOB_OUT_OF_MEMORY). O CLI abre o Chromium com
  // --js-flags=--expose-gc e aqui forçamos a coleta a cada 12 frames.
  async function upload(url) {
    if (!pixels) pixels = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, { method: 'POST', body: new Blob([pixels]) });
        if (!res.ok) throw new Error('frame upload failed ' + res.status);
        break;
      } catch (e) {
        if (window.gc) window.gc();
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
        if (attempt === 2) throw e;
      }
    }
    if (++uploads % 12 === 0 && window.gc) window.gc();
  }

  window.__engine = {
    ready: true,
    info: { W, H, fps, duration, shots: plan.shots.length, renderer: gl.getParameter(gl.VERSION) },
    plan,
    renderFrame(i) {
      const t = startT + i / fps;
      renderAt(t, i);
      return t;
    },
    renderTime(t) {
      renderAt(t, Math.round(t * fps));
    },
    async renderTimeAndSend(t, workerId = 0, index = 0, url = '/__frame') {
      renderAt(t, Math.round(t * fps));
      await upload(`${url}?w=${workerId}&i=${index}`);
      return t;
    },
    // renderiza e envia o frame cru (RGBA, de baixo pra cima) ao servidor do CLI
    async renderAndSend(i, workerId = 0, url = '/__frame') {
      const t = startT + i / fps;
      renderAt(t, i);
      await upload(`${url}?w=${workerId}&i=${i}`);
      return t;
    },
  };
  document.title = 'ready';
}

boot().catch((e) => {
  console.error('[engine] boot error', e && e.stack ? e.stack : e);
  window.__engine = { ready: false, error: String(e && e.stack ? e.stack : e) };
  document.title = 'error';
});
