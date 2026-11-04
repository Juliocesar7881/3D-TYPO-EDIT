#!/usr/bin/env node
// Análise de áudio: BPM, beats, downbeats, onsets (ataques) e energia por banda.
// uso: node engine/cli/analyze-audio.mjs <audio> [--from S] [--to S] [--out arquivo.json]
// Imprime um resumo legível (beats/onsets no trecho) para ajudar a cronometrar palavras.
import fs from 'node:fs';
import path from 'node:path';
import { analyzeAudio } from './lib/audio.mjs';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
if (!file) {
  console.log('uso: node engine/cli/analyze-audio.mjs <audio> [--from S] [--to S] [--out arquivo.json]');
  process.exit(1);
}
const a = await analyzeAudio(path.resolve(file), { fps: 60 });
const out = opt('out', path.join(path.dirname(path.resolve(file)), path.basename(file).replace(/\.[^.]+$/, '') + '.analysis.json'));
fs.writeFileSync(out, JSON.stringify(a));
const from = Number(opt('from', 0)), to = Number(opt('to', a.duration));
const inRange = (t) => t >= from && t <= to;
console.log(`🎵 ${path.basename(file)}  ${a.duration}s  BPM ~${a.bpm}`);
console.log(`beats (${from}-${to}s):`, a.beats.filter(inRange).map((t) => t.toFixed(2)).join(' '));
console.log(`downbeats:`, a.downbeats.filter(inRange).map((t) => t.toFixed(2)).join(' '));
console.log(`onsets fortes (s>0.5):`, a.onsets.filter((o) => inRange(o.t) && o.s > 0.5).map((o) => `${o.t.toFixed(2)}(${o.s.toFixed(1)})`).join(' '));
// energia média por segundo (ajuda a achar refrão/drop)
const sec = [];
for (let s = Math.floor(from); s < Math.min(to, a.duration); s++) {
  const sl = a.energy.rms.slice(s * a.energy.fps, (s + 1) * a.energy.fps);
  sec.push(sl.reduce((x, y) => x + y, 0) / Math.max(1, sl.length));
}
const bars = sec.map((v, i) => `${String(Math.floor(from) + i).padStart(4)}s ${'█'.repeat(Math.round(v * 20))}`);
console.log('energia por segundo:\n' + bars.join('\n'));
console.log('JSON completo:', out);
