// Análise de áudio em JS puro (ffmpeg só decodifica): onsets (spectral flux),
// BPM (autocorrelação), beats (programação dinâmica estilo Ellis 2007),
// downbeats e energia por banda em fps fixo para reatividade.
import { spawn } from 'node:child_process';
import { findFfmpeg } from './ffmpeg.mjs';

export function decodeMono(file, sr = 22050) {
  const ff = findFfmpeg();
  return new Promise((resolve, reject) => {
    const p = spawn(ff, ['-hide_banner', '-loglevel', 'error', '-i', file, '-ac', '1', '-ar', String(sr), '-f', 'f32le', '-'], { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    let err = '';
    p.stdout.on('data', (d) => chunks.push(d));
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => {
      if (code !== 0) return reject(new Error('decodificação de áudio falhou: ' + err));
      const buf = Buffer.concat(chunks);
      const f = new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
      resolve(new Float32Array(f));
    });
  });
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k], ai = im[i + k];
        const br = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const bi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ar + br; im[i + k] = ai + bi;
        re[i + k + len / 2] = ar - br; im[i + k + len / 2] = ai - bi;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}

function percentile(arr, p) {
  const a = Array.from(arr).filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return 1;
  return a[Math.min(a.length - 1, Math.floor(p * a.length))] || 1e-9;
}

function smooth(arr, r) {
  const out = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    let s = 0, n = 0;
    for (let k = -r; k <= r; k++) { const j = i + k; if (j >= 0 && j < arr.length) { s += arr[j]; n++; } }
    out[i] = s / n;
  }
  return out;
}

export async function analyzeAudio(file, { sr = 22050, fps = 60 } = {}) {
  const x = await decodeMono(file, sr);
  const N = 1024, hop = 256;
  const nFrames = Math.max(1, Math.floor((x.length - N) / hop) + 1);
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
  const bins = N / 2;
  const binHz = sr / N;
  const bLow = [Math.floor(20 / binHz), Math.ceil(150 / binHz)];
  const bMid = [bLow[1], Math.ceil(2000 / binHz)];
  const bHigh = [bMid[1], Math.min(bins - 1, Math.ceil(8000 / binHz))];
  const flux = new Float32Array(nFrames), fluxLow = new Float32Array(nFrames);
  const eLow = new Float32Array(nFrames), eMid = new Float32Array(nFrames), eHigh = new Float32Array(nFrames), eRms = new Float32Array(nFrames);
  let prev = new Float32Array(bins);
  const re = new Float32Array(N), im = new Float32Array(N);
  for (let f = 0; f < nFrames; f++) {
    const o = f * hop;
    let rms = 0;
    for (let i = 0; i < N; i++) { const v = x[o + i] || 0; re[i] = v * win[i]; im[i] = 0; rms += v * v; }
    eRms[f] = Math.sqrt(rms / N);
    fft(re, im);
    let fl = 0, flL = 0, l = 0, m = 0, h = 0;
    const cur = new Float32Array(bins);
    for (let b = 1; b < bins; b++) {
      const mag = Math.log1p(100 * Math.hypot(re[b], im[b]));
      cur[b] = mag;
      const d = mag - prev[b];
      if (d > 0) { fl += d; if (b <= bLow[1]) flL += d; }
      const pw = re[b] * re[b] + im[b] * im[b];
      if (b >= bLow[0] && b < bLow[1]) l += pw; else if (b < bMid[1]) m += pw; else if (b < bHigh[1]) h += pw;
    }
    flux[f] = fl; fluxLow[f] = flL; eLow[f] = Math.sqrt(l); eMid[f] = Math.sqrt(m); eHigh[f] = Math.sqrt(h);
    prev = cur;
  }
  const frameT = hop / sr;
  // envelope de onset: flux menos média local, normalizado
  const local = smooth(flux, 8);
  const env = new Float32Array(nFrames);
  for (let i = 0; i < nFrames; i++) env[i] = Math.max(0, flux[i] - local[i]);
  const envN = percentile(env, 0.98);
  for (let i = 0; i < nFrames; i++) env[i] = Math.min(1.5, env[i] / envN);
  const lowLocal = smooth(fluxLow, 8);
  const envLow = new Float32Array(nFrames);
  for (let i = 0; i < nFrames; i++) envLow[i] = Math.max(0, fluxLow[i] - lowLocal[i]);
  const lowN = percentile(envLow, 0.98);
  for (let i = 0; i < nFrames; i++) envLow[i] = Math.min(1.5, envLow[i] / lowN);

  // picos -> onsets
  const onsets = [];
  const W = 3;
  for (let i = W; i < nFrames - W; i++) {
    const v = env[i];
    if (v < 0.18) continue;
    let isMax = true;
    for (let k = -W; k <= W; k++) if (env[i + k] > v) { isMax = false; break; }
    if (!isMax) continue;
    if (onsets.length && i * frameT - onsets[onsets.length - 1].t < 0.07) continue;
    const s = Math.min(1, 0.65 * v + 0.35 * envLow[i]);
    onsets.push({ t: +(i * frameT).toFixed(4), s: +s.toFixed(3) });
  }

  // tempo por autocorrelação (60..190 BPM) com prior em ~120
  const minLag = Math.round(60 / 190 / frameT), maxLag = Math.round(60 / 60 / frameT);
  let bestLag = Math.round(0.5 / frameT), bestScore = -1;
  const ac = [];
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = lag; i < nFrames; i++) s += env[i] * env[i - lag];
    const bpm = 60 / (lag * frameT);
    const prior = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 0.9, 2));
    const sc = (s / (nFrames - lag)) * prior;
    ac.push([lag, sc]);
    if (sc > bestScore) { bestScore = sc; bestLag = lag; }
  }
  // refinamento parabólico
  const period = bestLag;
  const bpm = 60 / (period * frameT);

  // beat tracking DP
  const alpha = 100;
  const score = new Float32Array(nFrames);
  const back = new Int32Array(nFrames).fill(-1);
  for (let i = 0; i < nFrames; i++) {
    let best = 0, bi = -1;
    const lo = Math.max(0, i - Math.round(period * 2)), hi = i - Math.round(period / 2);
    for (let j = lo; j <= hi; j++) {
      const r = Math.log((i - j) / period);
      const v = score[j] - alpha * r * r;
      if (v > best || bi < 0) { best = v; bi = j; }
    }
    score[i] = env[i] + (bi >= 0 ? Math.max(0, best) : 0);
    back[i] = bi;
  }
  let end = 0, endV = -1;
  for (let i = Math.max(0, nFrames - Math.round(period * 2)); i < nFrames; i++) if (score[i] > endV) { endV = score[i]; end = i; }
  const beatsIdx = [];
  for (let i = end; i >= 0 && beatsIdx.length < 100000; i = back[i]) {
    beatsIdx.push(i);
    if (back[i] < 0) break;
  }
  beatsIdx.reverse();
  const beats = beatsIdx.map((i) => +(i * frameT).toFixed(4));
  // downbeats: fase (mod 4) com mais energia grave
  let bestPh = 0, bestPhS = -1;
  for (let ph = 0; ph < 4; ph++) {
    let s = 0;
    for (let k = ph; k < beatsIdx.length; k += 4) s += envLow[beatsIdx[k]] + 0.5 * env[beatsIdx[k]];
    if (s > bestPhS) { bestPhS = s; bestPh = ph; }
  }
  const downbeats = beats.filter((_, k) => k % 4 === bestPh);

  // energia por frame de vídeo
  const duration = x.length / sr;
  const nOut = Math.ceil(duration * fps);
  const sample = (arr, norm) => {
    const outA = new Array(nOut);
    for (let i = 0; i < nOut; i++) {
      const f = Math.min(nFrames - 1, Math.floor((i / fps) / frameT));
      outA[i] = +Math.min(1.5, arr[f] / norm).toFixed(3);
    }
    return outA;
  };
  const sm = (a) => smooth(a, 2);
  const energy = {
    fps,
    rms: sample(sm(eRms), percentile(eRms, 0.95)),
    low: sample(sm(eLow), percentile(eLow, 0.95)),
    mid: sample(sm(eMid), percentile(eMid, 0.95)),
    high: sample(sm(eHigh), percentile(eHigh, 0.95)),
  };
  return { file: String(file), sr, duration: +duration.toFixed(3), bpm: +bpm.toFixed(2), beats, downbeats, onsets, energy };
}
