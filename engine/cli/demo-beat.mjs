#!/usr/bin/env node
// Gera uma batida sintética (120 BPM) para as cenas demo — sem música de terceiros.
// uso: node engine/cli/demo-beat.mjs <saida.wav> [segundos] [bpm]
import { run } from './lib/ffmpeg.mjs';

const out = process.argv[2] || 'beat.wav';
const dur = Number(process.argv[3] || 24);
const bpm = Number(process.argv[4] || 120);
const b = 60 / bpm; // duração do beat
const expr = [
  // kick em todo beat
  `0.85*sin(2*PI*t*(42+130*exp(-32*mod(t,${b}))))*exp(-6.5*mod(t,${b}))`,
  // snare nos tempos 2 e 4
  `0.32*(random(0)*2-1)*exp(-17*mod(t+${b},${2 * b}))`,
  // chimbal em colcheias
  `0.09*(random(1)*2-1)*exp(-70*mod(t,${b / 2}))`,
  // baixo
  `0.22*sin(2*PI*55*t)*exp(-2.5*mod(t,${b}))`,
  // pad
  `0.05*(sin(2*PI*220*t)+sin(2*PI*277.18*t)+sin(2*PI*329.63*t)+sin(2*PI*415.3*t))*(0.6+0.4*sin(2*PI*t/${8 * b}))`,
].join('+');
await run(['-f', 'lavfi', '-i', `aevalsrc='${expr}':s=44100:d=${dur}`, '-af', 'alimiter=limit=0.9,afade=t=in:d=0.05', '-ac', '2', out]);
console.log('✅ batida demo:', out);
