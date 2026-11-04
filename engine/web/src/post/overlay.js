// Overlays 2D (Canvas2D -> textura) compostos por cima do 3D:
// cards de intro/outro no estilo das referências (moldura fina com cantos,
// título serifado com letter-spacing, waveform reagindo ao áudio, timecode).
import * as THREE from 'three';
import { clamp, getEase } from '../core/easing.js';

const FONT_FACES = [
  ['CardSerif', '/fonts/DMSerifDisplay-Regular.ttf'],
  ['CardCond', '/fonts/BebasNeue-Regular.ttf'],
  ['CardBold', '/fonts/Anton-Regular.ttf'],
  ['CardRound', '/fonts/TitanOne-Regular.ttf'],
];

export async function loadOverlayFonts() {
  await Promise.all(FONT_FACES.map(async ([name, url]) => {
    try {
      const f = new FontFace(name, `url(${url})`);
      await f.load();
      document.fonts.add(f);
    } catch (e) {
      console.warn('[overlay] fonte', name, e);
    }
  }));
}

export class Overlay2D {
  constructor(W, H, cards, audio, theme) {
    this.W = W;
    this.H = H;
    this.cards = (cards || []).map((c) => ({ from: 0, to: 2, bg: 'dark', frame: true, waveform: true, ...c }));
    this.audio = audio;
    this.theme = theme;
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.g = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.NoColorSpace;
    this.tex.flipY = true;
    this.tex.minFilter = THREE.LinearFilter;
    this.tex.magFilter = THREE.LinearFilter;
    this.tex.generateMipmaps = false;
    this.active = false;
  }

  // desenha o frame; retorna true se algo foi desenhado
  draw(t) {
    const g = this.g;
    const { W, H } = this;
    const live = this.cards.filter((c) => t >= c.from - 0.001 && t <= c.to + (c.outDur ?? 0.35));
    if (!live.length) {
      if (this.active) { g.clearRect(0, 0, W, H); this.tex.needsUpdate = true; }
      this.active = false;
      return false;
    }
    g.clearRect(0, 0, W, H);
    for (const c of live) this.drawCard(c, t);
    this.tex.needsUpdate = true;
    this.active = true;
    return true;
  }

  drawCard(c, t) {
    const g = this.g;
    const { W, H } = this;
    const S = Math.min(W, H);
    const outDur = c.outDur ?? 0.35;
    const uIn = clamp((t - c.from) / (c.inDur ?? 0.4));
    const uOut = clamp((t - c.to) / outDur);
    const alpha = getEase('outCubic')(uIn) * (1 - getEase('inCubic')(uOut));
    if (alpha <= 0.001) return;
    const light = c.bg === 'light';
    const ink = c.color || (light ? '#141414' : '#f2efe8');
    const zoom = 1 + 0.035 * clamp((t - c.from) / Math.max(0.1, c.to - c.from)) + 0.25 * getEase('inExpo')(uOut);
    g.save();
    g.globalAlpha = alpha;
    if (c.bg !== 'transparent') {
      g.fillStyle = light ? '#f1eee6' : '#050506';
      g.fillRect(0, 0, W, H);
      // vinheta suave do card
      const rg = g.createRadialGradient(W / 2, H / 2, S * 0.1, W / 2, H / 2, Math.max(W, H) * 0.75);
      rg.addColorStop(0, 'rgba(0,0,0,0)');
      rg.addColorStop(1, light ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.6)');
      g.fillStyle = rg;
      g.fillRect(0, 0, W, H);
    }
    g.translate(W / 2, H / 2);
    g.scale(zoom, zoom);
    g.translate(-W / 2, -H / 2);
    g.strokeStyle = ink;
    g.fillStyle = ink;
    // moldura fina com cantos
    if (c.frame) {
      const m = S * 0.06;
      const x0 = m, y0 = m, x1 = W - m, y1 = H - m;
      const draw = getEase('outExpo')(clamp((t - c.from) / 0.7));
      g.lineWidth = Math.max(1, S * 0.0018);
      g.globalAlpha = alpha * 0.85;
      const L = (x1 - x0) * draw, Hh = (y1 - y0) * draw;
      g.beginPath();
      g.moveTo(x0, y0); g.lineTo(x0 + L, y0);
      g.moveTo(x1, y1); g.lineTo(x1 - L, y1);
      g.moveTo(x0, y1); g.lineTo(x0, y1 - Hh);
      g.moveTo(x1, y0); g.lineTo(x1, y0 + Hh);
      g.stroke();
      // cantoneiras mais grossas
      g.lineWidth = Math.max(2, S * 0.004);
      const k = S * 0.035;
      g.beginPath();
      for (const [cx, cy, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
        g.moveTo(cx - sx * S * 0.012, cy + sy * k); g.lineTo(cx - sx * S * 0.012, cy - sy * S * 0.012); g.lineTo(cx + sx * k, cy - sy * S * 0.012);
      }
      g.stroke();
      // detalhes: rótulo e timecode
      g.globalAlpha = alpha * 0.7;
      g.font = `${Math.round(S * 0.022)}px CardCond`;
      g.textBaseline = 'middle';
      g.textAlign = 'left';
      if (c.label !== false) g.fillText((c.label || 'PRESENTS').toUpperCase(), x0 + S * 0.03, y0 + S * 0.035);
      g.textAlign = 'right';
      const tc = Math.max(0, t);
      const ff = Math.floor((tc % 1) * 30);
      g.fillText(`00:${String(Math.floor(tc)).padStart(2, '0')}:${String(ff).padStart(2, '0')}`, x1 - S * 0.03, y1 - S * 0.035);
      g.globalAlpha = alpha;
    }
    // título (revela letra a letra) + subtítulo
    const title = String(c.title || '').toUpperCase();
    const fontName = { serif: 'CardSerif', cond: 'CardCond', bold: 'CardBold', round: 'CardRound' }[c.font || 'serif'] || 'CardSerif';
    const size = Math.round(S * (c.size ?? 0.06));
    g.font = `${size}px ${fontName}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const reveal = c.typewriter === false ? title.length : Math.floor(clamp((t - c.from - 0.15) / Math.max(0.2, (c.typeDur ?? 0.6))) * title.length + 0.0001);
    const spacing = size * (c.tracking ?? 0.18);
    const chars = [...title];
    const widths = chars.map((ch) => g.measureText(ch).width);
    const total = widths.reduce((s, w) => s + w, 0) + spacing * Math.max(0, chars.length - 1);
    let x = W / 2 - total / 2;
    const ty = H / 2 - (c.subtitle ? size * 0.35 : 0);
    chars.forEach((ch, i) => {
      if (i < reveal) {
        g.globalAlpha = alpha * (i === reveal - 1 && reveal < chars.length ? 0.6 : 1);
        g.fillText(ch, x + widths[i] / 2, ty);
      }
      x += widths[i] + spacing;
    });
    g.globalAlpha = alpha;
    if (c.subtitle) {
      g.globalAlpha = alpha * 0.75 * clamp((t - c.from - 0.5) / 0.4);
      g.font = `${Math.round(size * 0.36)}px CardCond`;
      const sub = String(c.subtitle).toUpperCase().split('').join(String.fromCharCode(8202));
      g.fillText(sub, W / 2, ty + size * 0.85);
      g.globalAlpha = alpha;
    }
    // waveform reagindo ao áudio
    if (c.waveform && this.audio) {
      const wy = H / 2 + size * (c.subtitle ? 1.75 : 1.2);
      const ww = Math.min(W * 0.5, S * 0.7);
      const n = 72;
      const bw = ww / n;
      g.globalAlpha = alpha * 0.9;
      for (let i = 0; i < n; i++) {
        const tt = t + (i / n - 0.5) * 1.6;
        const e = this.audio.hasAudio ? this.audio.rms(tt) * 0.7 + this.audio.high(tt) * 0.3 : 0.3 + 0.2 * Math.sin(tt * 9 + i);
        const env = Math.sin((i / (n - 1)) * Math.PI);
        const h = Math.max(1, S * 0.05 * e * env);
        g.fillRect(W / 2 - ww / 2 + i * bw + bw * 0.25, wy - h / 2, Math.max(1, bw * 0.5), h);
      }
    }
    g.restore();
  }
}
