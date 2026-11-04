#!/usr/bin/env node
// Estuda os vídeos de referência: para cada vídeo em referencias/videos/ gera
//  - contact sheets (1 frame a cada --every s) em referencias/frames/<nome>/sheet_XX.jpg
//  - detecção de cortes/mudanças bruscas -> ritmo médio (segundos por "shot")
// uso: node engine/cli/ref-frames.mjs [--every 0.5] [--only "parte do nome"]
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findFfmpeg, run, probeDuration } from './lib/ffmpeg.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const every = Number(opt('every', 0.5));
const only = opt('only', '');
const vdir = path.join(REPO, 'referencias', 'videos');
const fdir = path.join(REPO, 'referencias', 'frames');

function sceneCuts(file) {
  return new Promise((resolve) => {
    const p = spawn(findFfmpeg(), ['-hide_banner', '-i', file, '-vf', "scale=320:-2,select='gt(scene,0.32)',showinfo", '-f', 'null', '-'], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', () => resolve([...err.matchAll(/pts_time:([\d.]+)/g)].map((m) => +m[1])));
  });
}

if (!fs.existsSync(vdir)) {
  console.log('Nenhum vídeo em referencias/videos/. Baixe primeiro com referencias/baixar_referencias.ps1 (ou .sh).');
  process.exit(0);
}
const vids = fs.readdirSync(vdir).filter((f) => /\.(mp4|mkv|webm|mov)$/i.test(f) && f.includes(only)).sort();
const summary = [];
for (const v of vids) {
  const file = path.join(vdir, v);
  const name = v.replace(/\.[^.]+$/, '').replace(/[^\w\- ]+/g, '').trim().slice(0, 60);
  const out = path.join(fdir, name);
  fs.mkdirSync(out, { recursive: true });
  const dur = await probeDuration(file);
  await run(['-i', file, '-vf', `fps=${1 / every},scale=320:-2,tile=6x5:padding=4:color=0x111111`, '-q:v', '3', path.join(out, 'sheet_%02d.jpg')]);
  const cuts = await sceneCuts(file);
  const avg = cuts.length > 1 ? (cuts[cuts.length - 1] - cuts[0]) / (cuts.length - 1) : null;
  fs.writeFileSync(path.join(out, 'cuts.json'), JSON.stringify({ duration: dur, cuts, avgShot: avg }, null, 1));
  summary.push({ video: v, duration: dur, cuts: cuts.length, avgShot: avg && +avg.toFixed(2) });
  console.log(`✓ ${v}  ${dur?.toFixed(1)}s  ${cuts.length} mudanças bruscas  ~${avg ? avg.toFixed(2) : '?'}s por shot`);
}
fs.mkdirSync(fdir, { recursive: true });
fs.writeFileSync(path.join(fdir, 'resumo.json'), JSON.stringify(summary, null, 1));
console.log(`\nContact sheets em ${fdir} (abra os sheet_XX.jpg / peça pro Claude analisar).`);
