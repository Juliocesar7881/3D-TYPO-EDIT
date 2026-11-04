// Reatividade ao áudio: recebe a análise feita no Node (beats, onsets, energia
// por frame) e expõe funções puras do tempo t (segundos da edit).
import { clamp } from './easing.js';

export class AudioReactive {
  constructor(analysis, { offset = 0 } = {}) {
    this.a = analysis || null;
    this.offset = offset; // t da edit -> t da música = t + offset
    const a = this.a;
    this.beats = a?.beats ? a.beats.map((b) => b - offset) : [];
    this.downbeats = a?.downbeats ? a.downbeats.map((b) => b - offset) : [];
    this.onsets = a?.onsets ? a.onsets.map((o) => ({ t: o.t - offset, s: o.s })) : [];
    this.strongOnsets = this.onsets.filter((o) => o.s > 0.55);
    this.bpm = a?.bpm || 120;
    this.envFps = a?.energy?.fps || 60;
  }

  get hasAudio() { return !!this.a; }

  _band(name, t) {
    const arr = this.a?.energy?.[name];
    if (!arr || !arr.length) return 0;
    const x = (t + this.offset) * this.envFps;
    const i = Math.floor(x);
    if (i < 0) return arr[0];
    if (i >= arr.length - 1) return arr[arr.length - 1];
    const f = x - i;
    return arr[i] * (1 - f) + arr[i + 1] * f;
  }
  rms(t) { return this._band('rms', t); }
  low(t) { return this._band('low', t); }
  mid(t) { return this._band('mid', t); }
  high(t) { return this._band('high', t); }

  // índice do último beat <= t (busca binária)
  _lastIndex(list, t, key) {
    let lo = 0, hi = list.length - 1, ans = -1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      const v = key ? list[m][key] : list[m];
      if (v <= t) { ans = m; lo = m + 1; } else hi = m - 1;
    }
    return ans;
  }

  // pulso que dispara em cada beat e decai (0..1)
  beatPulse(t, decay = 0.18) {
    if (!this.beats.length) return 0;
    const i = this._lastIndex(this.beats, t);
    let v = 0;
    for (let k = Math.max(0, i - 1); k <= Math.min(this.beats.length - 1, i + 1); k++) {
      const d = t - this.beats[k];
      if (d >= 0) v = Math.max(v, Math.exp(-d / decay));
      else if (d > -0.01) v = Math.max(v, 1 + d / 0.01);
    }
    return v;
  }

  downbeatPulse(t, decay = 0.3) {
    if (!this.downbeats.length) return 0;
    const i = this._lastIndex(this.downbeats, t);
    if (i < 0) return 0;
    return Math.exp(-(t - this.downbeats[i]) / decay);
  }

  // pulso dos ataques fortes (kick/snare), ponderado pela força
  hitPulse(t, decay = 0.22) {
    const list = this.strongOnsets;
    if (!list.length) return this.beatPulse(t, decay);
    const i = this._lastIndex(list, t, 't');
    let v = 0;
    for (let k = Math.max(0, i - 2); k <= i; k++) {
      const d = t - list[k].t;
      if (d >= 0) v = Math.max(v, list[k].s * Math.exp(-d / decay));
    }
    return clamp(v);
  }

  beatPhase(t) {
    if (this.beats.length < 2) return ((t * this.bpm) / 60) % 1;
    const i = this._lastIndex(this.beats, t);
    if (i < 0 || i >= this.beats.length - 1) return ((t * this.bpm) / 60) % 1;
    return (t - this.beats[i]) / (this.beats[i + 1] - this.beats[i]);
  }

  nearestBeat(t, maxDist = 0.12) {
    if (!this.beats.length) return t;
    const i = this._lastIndex(this.beats, t);
    let best = t, bd = maxDist;
    for (const k of [i, i + 1]) {
      if (k < 0 || k >= this.beats.length) continue;
      const d = Math.abs(this.beats[k] - t);
      if (d < bd) { bd = d; best = this.beats[k]; }
    }
    return best;
  }

  beatsBetween(a, b) {
    return this.beats.filter((x) => x >= a && x < b);
  }
}
