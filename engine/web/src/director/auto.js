// DIRETOR AUTOMÁTICO
// Recebe palavras com tempo (+ beats do áudio) e decide TUDO: agrupamento em
// shots, layout, estilo, cores, animações, movimento de câmera, transições,
// decoração e posição de cada shot no espaço 3D (a câmera voa entre eles).
// Qualquer decisão pode ser sobrescrita na cena (scene.shots[i] / word.*).
import { RNG } from '../core/rng.js';
import { STYLES, deepMerge } from './themes.js';
import { shade } from '../world/materials.js';
import { clamp } from '../core/easing.js';

const SHORT = new Set(['A', 'I', 'O', 'E', 'TO', 'THE', 'AN', 'OF', 'IN', 'ON', 'MY', 'ME', 'DE', 'DA', 'DO', 'EU', 'UM', 'SE', 'NO', 'NA', 'É', 'OH', 'SO', 'BE', 'IS', 'IT', 'AT', 'OR', 'YOU', 'AND', 'QUE', 'TE', 'TU', 'LA', 'EL', 'YA', 'OS', 'AS']);

function isShort(text) {
  const t = text.toUpperCase().replace(/[^\p{L}\p{N}]/gu, '');
  return t.length <= 2 || SHORT.has(t);
}

function cleanText(text, mode) {
  let s = String(text).trim();
  if (mode === 'upper') s = s.toUpperCase();
  else if (mode === 'lower') s = s.toLowerCase();
  return s;
}

// resolve tokens de cor ($accent...) num objeto de estilo
function resolveTokens(obj, ctx) {
  if (obj == null) return obj;
  if (typeof obj === 'string') {
    if (!obj.startsWith('$')) return obj;
    const k = obj.slice(1);
    if (k === 'palette') return ctx.palette.slice();
    if (/^p\d+$/.test(k)) return ctx.palette[parseInt(k.slice(1), 10) % ctx.palette.length];
    return ctx[k] ?? '#ffffff';
  }
  if (Array.isArray(obj)) return obj.map((x) => resolveTokens(x, ctx));
  if (typeof obj === 'object') {
    const o = {};
    for (const [k, v] of Object.entries(obj)) o[k] = resolveTokens(v, ctx);
    return o;
  }
  return obj;
}

export function colorCtx(theme, accent, accent2, accent3) {
  return {
    accent,
    accent2,
    accent3,
    accentDark: shade(accent, -0.2),
    accentLight: shade(accent, 0.16),
    white: '#ffffff',
    shadow: theme.shadow || '#000000',
    palette: theme.palette,
  };
}

export function resolveStyle(nameOrObj, theme, cctx) {
  let st = typeof nameOrObj === 'string' ? STYLES[nameOrObj] || STYLES.chrome : nameOrObj;
  if (typeof nameOrObj === 'object' && nameOrObj.base) st = deepMerge(STYLES[nameOrObj.base] || {}, nameOrObj);
  return resolveTokens(JSON.parse(JSON.stringify(st)), cctx);
}

function fitDistance(bw, bh, fovDeg, aspect, fillW = 0.8, fillH = 0.62) {
  const t = Math.tan((fovDeg * Math.PI) / 360);
  return Math.max(bw / 2 / (t * aspect * fillW), bh / 2 / (t * fillH), 2);
}

export function planEdit(scene, theme, fonts, audio) {
  const D = scene.director || {};
  const seed = scene.seed ?? 7;
  const rng = new RNG(seed);
  const out = scene.output || {};
  const aspect = (out.width || 1920) / (out.height || 1080);
  const portrait = aspect < 1;
  const energy = D.energy ?? 1;
  const caseMode = D.case ?? 'upper';
  const duration = scene.duration;
  const palette = theme.palette;

  // ---------- 1) palavras ----------
  const words = (scene.words || [])
    .map((w, i) => ({ ...w, i, text: cleanText(w.text, w.case || caseMode) }))
    .filter((w) => w.text.length)
    .sort((a, b) => a.t - b.t);
  words.forEach((w, i) => {
    const nxt = words[i + 1];
    w.end = w.end ?? (nxt ? Math.min(nxt.t, w.t + 1.6) : Math.min(duration, w.t + 1.6));
  });

  // ---------- 2) agrupar em shots ----------
  const maxWords = D.maxWordsPerShot ?? (energy > 1.15 ? 2 : portrait ? 3 : 3);
  const maxShotDur = D.maxShotDuration ?? 2.6 / Math.max(0.6, energy);
  const explicit = Array.isArray(scene.shots) && scene.shots.some((s) => s && Array.isArray(s.words));
  let groups = [];
  if (explicit) {
    // scene.shots[k].words = [índices das palavras]
    for (const s of scene.shots) groups.push(s.words.map((idx) => words.find((w) => w.i === idx)).filter(Boolean));
    groups = groups.filter((g) => g.length);
  } else {
    let cur = [];
    words.forEach((w, i) => {
      const prev = cur[cur.length - 1];
      let split = false;
      if (prev) {
        const gap = w.t - prev.end;
        const lineChange = w.line != null && prev.line != null && w.line !== prev.line;
        const lenSum = cur.reduce((s, x) => s + x.text.length, 0) + w.text.length;
        if (w.break || prev.breakAfter) split = true;
        else if (lineChange) split = true;
        else if (gap > 0.5) split = true;
        else if (cur.length >= maxWords) split = true;
        else if (w.t - cur[0].t > maxShotDur) split = true;
        else if (lenSum > (portrait ? 16 : 20)) split = true;
        // palavra curta grudada na próxima
        if (split && cur.length === 1 && isShort(prev.text) && !w.break && !lineChange && gap < 0.35 && cur.length < maxWords + 1) split = false;
        if (w.solo || prev.solo) split = true;
      }
      if (split) { groups.push(cur); cur = []; }
      cur.push(w);
    });
    if (cur.length) groups.push(cur);
  }

  // ---------- 3) cada shot ----------
  const recent = { style: [], move: [], layout: [], accent: [], decor: [], trans: [], inA: [] };
  const shots = [];
  const heading = { yaw: 0, pitch: 0 };
  const anchorPos = [0, 0, 0];
  let prevBlock = 0;
  const fovBase = D.fov ?? 40;

  groups.forEach((g, si) => {
    const ov = (scene.shots && !explicit ? scene.shots.find((s) => s && s.index === si) : explicit ? scene.shots[si] : null) || {};
    const r = rng.fork('shot' + si + ':' + g.map((w) => w.text).join(' '));
    const start = ov.start ?? g[0].t;
    const nextStart = groups[si + 1] ? scene.shots?.find?.((s) => s && s.index === si + 1)?.start ?? groups[si + 1][0].t : duration;
    // cores
    const accent = ov.accent || r.pickFresh(palette, recent.accent, Math.min(2, palette.length - 1));
    recent.accent.push(accent);
    const others = palette.filter((c) => c !== accent);
    const accent2 = ov.accent2 || r.pick(others.length ? others : palette);
    const accent3 = ov.accent3 || r.pick(palette);
    const cctx = colorCtx(theme, accent, accent2, accent3);

    // estilo
    const styleName = ov.style || r.pickFresh(Object.keys(theme.styles), recent.style, 1) ;
    const styleName2 = r.weighted(theme.styles);
    const chosenStyle = ov.style || (r.chance(0.5) ? styleName : styleName2);
    recent.style.push(chosenStyle);

    // layout
    const n = g.length;
    const longest = g.reduce((m, w) => Math.max(m, w.text.length), 0);
    const L = theme.layouts || { single: 1, stack: 1, line: 1 };
    let options;
    if (n === 1) {
      options = { single: L.single ?? 1 };
      if (longest >= 5) options.vertical = (L.vertical ?? 0) * (portrait ? 2 : 1);
      if (longest >= 4 && longest <= 10) options.arc = L.arc ?? 0;
      if (longest >= 3 && longest <= 9) options.scatter3d = L.scatter3d ?? 0;
      if (longest >= 5 && longest <= 12) options.ring = L.ring ?? 0;
    } else {
      options = { stack: L.stack ?? 1, line: (L.line ?? 1) * (portrait ? 0.3 : 1), cascade: L.cascade ?? 0.5 };
    }
    for (const k of recent.layout.slice(-1)) if (options[k] && Object.keys(options).length > 1) options[k] *= 0.35;
    const layout = ov.layout || r.weighted(options);
    recent.layout.push(layout);

    // animações (coerentes no shot)
    const inA = ov.in || r.weighted(Object.fromEntries(Object.entries(theme.anims.in).map(([k, v]) => [k, recent.inA.slice(-1).includes(k) ? v * 0.3 : v])));
    recent.inA.push(inA);
    const outA = ov.out || r.weighted(theme.anims.out);
    const idleA = ov.idle || r.weighted(theme.anims.idle);

    // palavras do shot (tamanhos + posições)
    const heroIdx = g.findIndex((w) => w.accent) >= 0 ? g.findIndex((w) => w.accent) : g.reduce((bi, w, i) => (w.text.length > g[bi].text.length ? i : bi), 0);
    const wordPlans = g.map((w, wi) => {
      const isHero = wi === heroIdx && n > 1;
      const wStyleName = w.style || (isHero && r.chance(0.6) ? r.weighted(theme.styles) : chosenStyle);
      const wcctx = w.color ? colorCtx(theme, w.color, accent2, accent3) : isHero ? colorCtx(theme, accent2 === accent ? accent : accent2, accent, accent3) : cctx;
      const style = resolveStyle(w.styleObj || wStyleName, theme, wcctx);
      const font = fonts[(w.font || style.font || 'anton').toLowerCase()] || fonts.anton;
      const tracking = w.tracking ?? style.tracking ?? 0.04;
      const natW = font.measure(w.text, tracking);
      return { w, isHero, styleName: wStyleName, style, font, fontName: (w.font || style.font || 'anton').toLowerCase(), tracking, natW, size: w.size ?? 1 };
    });

    // layout -> tamanho/posição (unidades de mundo; cap height base = 1)
    let letterLayout = 'line';
    let blockW = 0, blockH = 0;
    const gapY = 0.28;
    if (layout === 'stack' && n > 1) {
      // justificado: cada linha com a mesma largura (lockup tipográfico)
      const target = Math.max(...wordPlans.map((p) => p.natW * (p.w.size ?? 1)));
      const widthTarget = Math.min(target, Math.max(3.2, target));
      let y = 0;
      const sizes = wordPlans.map((p) => {
        const len = [...p.w.text].length;
        const maxS = len <= 2 ? 1.15 : len <= 3 ? 1.35 : p.isHero ? 2.2 : 1.7;
        return clamp((widthTarget / p.natW) * (p.isHero ? 1 : 0.92), 0.55, maxS) * (p.w.size ?? 1);
      });
      const totalH = sizes.reduce((s, x) => s + x, 0) + gapY * (n - 1);
      y = totalH / 2;
      wordPlans.forEach((p, i) => {
        p.size = sizes[i];
        y -= sizes[i] / 2;
        p.pos = [0, y, i * 0.02];
        y -= sizes[i] / 2 + gapY;
      });
      blockW = Math.max(...wordPlans.map((p) => p.natW * p.size));
      blockH = totalH;
    } else if (layout === 'line' && n > 1) {
      const space = 0.45;
      wordPlans.forEach((p) => (p.size = (p.isHero ? 1.25 : 1) * (p.w.size ?? 1)));
      const total = wordPlans.reduce((s, p) => s + p.natW * p.size, 0) + space * (n - 1);
      let x = -total / 2;
      wordPlans.forEach((p) => {
        const wW = p.natW * p.size;
        p.pos = [x + wW / 2, (p.size - 1) * 0.5 * 0 , 0];
        x += wW + space;
      });
      blockW = total;
      blockH = Math.max(...wordPlans.map((p) => p.size));
    } else if (layout === 'cascade' && n > 1) {
      const dir = r.sign();
      wordPlans.forEach((p, i) => {
        p.size = (p.isHero ? 1.35 : 1) * (p.w.size ?? 1);
        const u = i - (n - 1) / 2;
        p.pos = [u * 1.6 * dir, -u * 1.35, -i * 2.2];
        p.rot = [0, -dir * 0.12 * i, 0];
      });
      blockW = Math.max(...wordPlans.map((p) => p.natW * p.size)) + 1.6 * (n - 1);
      blockH = n * 1.35 + 0.6;
    } else {
      // single (ou fallback): uma palavra grande
      wordPlans.forEach((p, i) => {
        p.size = (p.w.size ?? 1) * (n > 1 ? 1 : 1.0);
        p.pos = [0, -i * 1.3, 0];
      });
      letterLayout = { vertical: 'vertical', arc: 'arc', scatter3d: 'scatter3d', ring: 'ring' }[layout] || 'line';
      const p0 = wordPlans[0];
      if (letterLayout === 'vertical') {
        const cnt = [...p0.w.text].length;
        blockW = 1.1 * p0.size;
        blockH = cnt * 1.18 * p0.size;
      } else if (letterLayout === 'ring') {
        const R = (p0.natW * 1.18) / (2 * Math.PI) + 0.4;
        blockW = blockH = R * 2 * p0.size + 1;
      } else if (letterLayout === 'arc') {
        blockW = p0.natW * p0.size * 0.92;
        blockH = 1.6 * p0.size;
      } else {
        blockW = p0.natW * p0.size;
        blockH = p0.size * n + 0.3 * (n - 1);
      }
    }
    blockW = Math.max(blockW, 1.2);
    blockH = Math.max(blockH, 1);
    const S = Math.max(blockW, blockH);

    // câmera
    const C = theme.camera;
    const movePool = Object.fromEntries(Object.entries(C.moves).map(([k, v]) => [k, recent.move.slice(-2).includes(k) ? v * 0.25 : v]));
    if (letterLayout === 'ring') { movePool.push = (movePool.push || 1) * 3; movePool.spiral = (movePool.spiral || 1) * 2; }
    if (letterLayout === 'scatter3d') { movePool.orbitL = (movePool.orbitL || 1) * 2; movePool.orbitR = (movePool.orbitR || 1) * 2; }
    const move = ov.move || r.weighted(movePool);
    recent.move.push(move);
    const fov = ov.fov ?? fovBase + r.range(-6, 10);
    const fillW = portrait ? 0.8 : 0.7;
    // cascade: a câmera segue palavra a palavra, então enquadra só a maior palavra
    const fitW = layout === 'cascade' && n > 1 ? Math.max(...wordPlans.map((p) => p.natW * p.size)) * 1.25 : blockW;
    const fitH = layout === 'cascade' && n > 1 ? Math.max(...wordPlans.map((p) => p.size)) * 2.2 : blockH;
    const baseDist = ov.baseDist ?? fitDistance(fitW, fitH, fov, aspect, fillW, 0.56) * (ov.zoom ?? 1);
    const k = (ov.k ?? C.k ?? 1) * clamp(energy, 0.4, 1.6) * r.range(0.8, 1.15);

    // transição de entrada
    const prevShot = shots[si - 1];
    const shotDur = nextStart - start;
    let trans = null;
    if (prevShot) {
      const avail = Math.max(0.12, start - prevShot.start);
      let style = ov.transition || r.weighted(Object.fromEntries(Object.entries(C.transitions).map(([kk, v]) => [kk, recent.trans.slice(-1).includes(kk) && kk !== 'whip' ? v * 0.4 : v])));
      const gapBefore = start - (prevShot.words[prevShot.words.length - 1].end ?? start);
      let dur = clamp((0.62 - 0.18 * energy) * r.range(0.85, 1.2), 0.2, 0.85);
      if (gapBefore > 0.9 && !ov.transition) { style = r.chance(0.5) ? 'smooth' : style; dur = clamp(gapBefore * 0.8, 0.5, 1.1); }
      dur = Math.min(dur, avail * 0.9);
      if (ov.transitionDur) dur = ov.transitionDur;
      trans = {
        style, dur,
        ease: ov.transitionEase,
        arc: ov.arc ?? (style === 'smooth' ? r.range(0.1, 0.25) : r.range(0.15, 0.4)),
        arcSide: r.sign(),
        spinDir: r.sign(),
        spins: 1,
        whipRoll: r.range(6, 16),
        lead: 0.62,
        flash: ov.flash ?? (style === 'cut' || (gapBefore > 0.7 && r.chance(0.35 * energy))),
        glitch: ov.glitch ?? r.chance(0.12 * energy),
      };
      recent.trans.push(style);
    }

    // posicionamento no espaço (voo da câmera)
    if (si > 0) {
      heading.yaw += r.range(-32, 32) * (D.curviness ?? 1);
      heading.pitch = clamp(heading.pitch + r.range(-12, 12), -20, 20);
      const step = ((prevBlock + S) * 0.75 + baseDist * 0.6 + r.range(2, 7)) * (D.spacing ?? 1);
      const yaw = (heading.yaw * Math.PI) / 180, pitch = (heading.pitch * Math.PI) / 180;
      anchorPos[0] += Math.sin(yaw) * Math.cos(pitch) * step;
      anchorPos[1] += Math.sin(pitch) * step * 0.6;
      anchorPos[2] -= Math.cos(yaw) * Math.cos(pitch) * step;
    }
    prevBlock = S;
    const faceYaw = (heading.yaw + r.range(-40, 40) * (D.tilt ?? 1)) * (Math.PI / 180);
    const anchor = {
      pos: ov.anchor?.pos || anchorPos.slice(),
      // texto "olha" para trás no caminho (para a câmera que chega) com desvio
      rot: ov.anchor?.rot || [r.range(-0.18, 0.18) * (D.tilt ?? 1), -faceYaw, r.chance(0.35) ? r.range(-0.3, 0.3) * (D.tilt ?? 1) : 0],
    };

    // palavras: tempos de entrada/saída
    const outT = Math.max(start + 0.2, nextStart - (groups[si + 1] ? 0.18 : 0.45));
    const finalWords = wordPlans.map((p, wi) => {
      const w = p.w;
      return {
        text: w.text,
        t0: w.t,
        tOut: w.exit ?? outT,
        size: p.size,
        pos: w.pos || p.pos || [0, 0, 0],
        rot: w.rot || p.rot || [0, 0, 0],
        font: p.fontName,
        tracking: p.tracking,
        styleName: p.styleName,
        style: p.style,
        letterLayout: w.letterLayout || (wi === 0 ? letterLayout : 'line'),
        viewDist: baseDist,
        anim: {
          in: w.in || (p.isHero && r.chance(0.4) ? r.weighted(theme.anims.in) : inA),
          out: w.out || outA,
          idle: w.idle || idleA,
          maxInSpan: Math.max(0.25, Math.min(0.9, (w.end - w.t) * 0.95)),
          dir: r.sign(),
          order: w.order || r.weighted({ forward: 3, center: 1, random: 0.8, reverse: 0.5 }),
          amp: 1,
        },
        hero: p.isHero,
      };
    });

    // decoração
    const [dmin, dmax] = theme.decorPerShot || [1, 2];
    const nDecor = ov.decor ? ov.decor.length : r.int(dmin, dmax);
    const decorNames = [];
    if (ov.decor) decorNames.push(...ov.decor);
    else {
      const pool = { ...theme.decor };
      for (let d = 0; d < nDecor; d++) {
        const pick = r.weighted(Object.fromEntries(Object.entries(pool).map(([kk, v]) => [kk, recent.decor.slice(-3).includes(kk) ? v * 0.35 : v])));
        decorNames.push(pick);
        delete pool[pick];
        if (!Object.keys(pool).length) break;
      }
    }
    recent.decor.push(...decorNames);
    const decor = decorNames.map((name, di) => ({ type: name, seed: r.int(1, 1e9), t0: start - (trans ? trans.dur * 0.6 : 0.2), t1: nextStart, S, blockW, blockH, accent, accent2, accent3 }));

    shots.push({
      index: si,
      start,
      end: nextStart,
      layout,
      letterLayout,
      styleName: chosenStyle,
      accent, accent2, accent3,
      mood: ov.mood || [accent, accent2, accent3],
      anchor,
      block: { w: blockW, h: blockH, S },
      camera: { move, k, fov, baseDist, from: ov.from, to: ov.to, ease: ov.ease, follow: ov.follow },
      transition: trans,
      words: finalWords,
      decor,
      flashAtStart: trans?.flash || false,
    });
  });

  // ---------- 4) eventos de batida (shake / fov kick) ----------
  const impulses = [];
  const fovKicks = [];
  shots.forEach((s, i) => {
    if (i > 0) impulses.push({ t: s.start, amp: 0.25 * energy, decay: 0.2 });
  });
  if (audio && audio.hasAudio) {
    let last = -10;
    for (const o of audio.strongOnsets) {
      if (o.t < 0 || o.t > duration) continue;
      if (o.t - last < 0.32) continue;
      last = o.t;
      if (o.s > 0.75) fovKicks.push({ t: o.t, amp: 2.2 * energy * o.s, decay: 0.18 });
      impulses.push({ t: o.t, amp: 0.12 * energy * o.s, decay: 0.16 });
    }
  }

  return { shots, impulses, fovKicks, aspect, portrait, energy };
}
