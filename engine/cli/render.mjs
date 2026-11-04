#!/usr/bin/env node
// CLI de render: node engine/cli/render.mjs <cena.json> [opções]
//
//   --preview            meia resolução, 30fps (rápido p/ revisar movimento)
//   --draft              ainda mais rápido (sem MSAA, menos partículas)
//   --stills auto|t,t,.. renderiza PNGs (auto = 1 por shot) + contact sheet
//   --plan               só imprime/salva o plano do diretor (shots, câmera...)
//   --from S --to S      renderiza só um trecho (segundos da edit)
//   --fps N  --scale F   --crf N  --out arquivo.mp4  --workers N
//   --gl auto|gpu|swiftshader   --codec h264|prores|png   --no-audio
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { startServer } from './lib/server.mjs';
import { rawEncoder, concatAndMux, contactSheet, probeDuration } from './lib/ffmpeg.mjs';
import { analyzeAudio } from './lib/audio.mjs';
import { parseLyrics, snapWords } from './lib/lyrics.mjs';

const require = createRequire(import.meta.url);
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const FORMATS = {
  landscape: [1920, 1080], youtube: [1920, 1080], '1080p': [1920, 1080],
  vertical: [1080, 1920], tiktok: [1080, 1920], reels: [1080, 1920], shorts: [1080, 1920],
  square: [1080, 1080], '4k': [3840, 2160], vertical4k: [2160, 3840], '720p': [1280, 720],
};

function parseArgs(argv) {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const s = argv[i];
    if (s.startsWith('--')) {
      const k = s.slice(2);
      const nxt = argv[i + 1];
      if (nxt !== undefined && !nxt.startsWith('--')) { a[k] = nxt; i++; } else a[k] = true;
    } else a._.push(s);
  }
  return a;
}

// JSON com comentários // e /* */ e vírgulas sobrando (strings só com aspas duplas)
export function loadLooseJson(file) {
  const src = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  let out = '';
  let i = 0;
  let inStr = false;
  while (i < src.length) {
    const c = src[i];
    const n = src[i + 1];
    if (inStr) {
      out += c;
      if (c === '\\') { out += n ?? ''; i += 2; continue; }
      if (c === '"') inStr = false;
      i++;
      continue;
    }
    if (c === '"') { inStr = true; out += c; i++; continue; }
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; continue; }
    out += c;
    i++;
  }
  // vírgula antes de } ou ] (fora de strings já que comentários foram removidos)
  out = out.replace(/,(\s*[}\]])/g, '$1');
  try {
    return JSON.parse(out);
  } catch (e) {
    throw new Error(`cena inválida (${file}): ${e.message}`);
  }
}

async function prepareScene(scenePath, args) {
  const abs = path.resolve(scenePath);
  const dir = path.dirname(abs);
  const scene = loadLooseJson(abs);
  const name = path.basename(abs, path.extname(abs)) === 'scene' ? path.basename(dir) : path.basename(abs, path.extname(abs));
  // saída
  const fmt = FORMATS[(scene.format || scene.output?.format || 'landscape').toLowerCase()] || FORMATS.landscape;
  scene.output = { width: fmt[0], height: fmt[1], fps: 30, crf: 16, ...(scene.output || {}) };
  if (args.fps) scene.output.fps = Number(args.fps);
  if (args.preview && !args.fps) scene.output.fps = Math.min(scene.output.fps, 30);
  scene.quality = args.draft ? 'draft' : args.preview ? 'preview' : scene.quality || 'final';
  if (args.scale) scene.resScale = Number(args.scale);
  // áudio
  let analysis = null;
  if (scene.audio?.file && !args['no-audio']) {
    const af = path.resolve(dir, scene.audio.file);
    if (!fs.existsSync(af)) throw new Error('arquivo de áudio não encontrado: ' + af);
    scene.audio.path = af;
    const st = fs.statSync(af);
    const key = crypto.createHash('md5').update(af + st.size + st.mtimeMs).digest('hex').slice(0, 12);
    const cacheDir = path.join(dir, '.cache');
    const cacheFile = path.join(cacheDir, `audio-${key}.json`);
    if (fs.existsSync(cacheFile)) analysis = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    else {
      console.log('🎵 analisando áudio (beats/onsets/energia)...');
      analysis = await analyzeAudio(af, { fps: 60 });
      fs.mkdirSync(cacheDir, { recursive: true });
      fs.writeFileSync(cacheFile, JSON.stringify(analysis));
    }
    console.log(`   BPM ~${analysis.bpm}, ${analysis.beats.length} beats, ${analysis.onsets.length} onsets, ${analysis.duration}s`);
  } else if (scene.audio?.file && args['no-audio']) {
    scene.audio = null;
  }
  const offset = scene.audio?.offset || 0;
  // letra com tempo (arquivo ou texto)
  if (scene.lyrics) {
    const src = typeof scene.lyrics === 'string' && fs.existsSync(path.resolve(dir, scene.lyrics)) ? fs.readFileSync(path.resolve(dir, scene.lyrics), 'utf8') : String(scene.lyrics);
    const parsed = parseLyrics(src);
    let ws = parsed.words;
    const base = scene.lyricsTimeBase || parsed.timeBase;
    if (base === 'song') ws = ws.map((w) => ({ ...w, t: +(w.t - offset).toFixed(3) }));
    scene.words = [...ws, ...(scene.words || [])];
  }
  scene.words = (scene.words || []).map((w) => (w.timeBase === 'song' ? { ...w, t: w.t - offset } : w));
  if (scene.snapToBeats && analysis) scene.words = snapWords(scene.words, analysis, { maxDist: typeof scene.snapToBeats === 'number' ? scene.snapToBeats : 0.1, offset });
  scene.words.sort((a, b) => a.t - b.t);
  // duração
  const lastWord = scene.words.length ? scene.words[scene.words.length - 1].t : 0;
  if (!scene.duration) {
    let d = lastWord + 1.8;
    if (analysis) d = Math.min(d, analysis.duration - offset);
    scene.duration = +d.toFixed(3);
  }
  scene.words = scene.words.filter((w) => w.t >= -0.01 && w.t < scene.duration);
  scene.audioAnalysis = analysis;
  return { scene, dir, name };
}

function glMode(args) {
  const g = args.gl || process.env.TYPO3D_GL || 'auto';
  if (g !== 'auto') return g;
  if (process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) return 'swiftshader';
  return 'gpu';
}

async function launch(args) {
  const { chromium } = require('playwright');
  const mode = glMode(args);
  const common = ['--no-proxy-server', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--mute-audio', '--ignore-gpu-blocklist'];
  const opts = mode === 'swiftshader'
    ? { args: [...common, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] }
    : { channel: 'chromium', args: [...common, '--enable-gpu', '--enable-unsafe-swiftshader'] };
  if (process.env.CHROMIUM_PATH) opts.executablePath = process.env.CHROMIUM_PATH;
  try {
    return await chromium.launch(opts);
  } catch (e) {
    if (mode !== 'swiftshader') {
      console.warn('⚠️  não deu pra abrir o Chromium com GPU, usando SwiftShader (CPU):', e.message.split('\n')[0]);
      return chromium.launch({ args: [...common, '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    }
    throw e;
  }
}

async function openPage(browser, url, info = true) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.setDefaultTimeout(600000);
  page.on('console', (m) => {
    const t = m.text();
    if (/GL Driver Message|GPU stall|WebGL-/.test(t)) return;
    if (m.type() === 'error' || m.type() === 'warning') console.log('   [page]', t);
  });
  page.on('pageerror', (e) => console.log('   [page error]', e.message));
  await page.goto(url);
  await page.waitForFunction(() => window.__engine && (window.__engine.ready || window.__engine.error), null, { timeout: 600000 });
  const err = await page.evaluate(() => window.__engine.error);
  if (err) throw new Error('erro no motor: ' + err);
  if (info) {
    const inf = await page.evaluate(() => window.__engine.info);
    return { page, info: inf };
  }
  return { page };
}

function fmtTime(s) {
  const m = Math.floor(s / 60), ss = Math.round(s % 60);
  return m ? `${m}m${String(ss).padStart(2, '0')}s` : `${ss}s`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const scenePath = args._[0];
  if (!scenePath) {
    console.log('uso: node engine/cli/render.mjs projects/<nome>/scene.json [--preview|--draft] [--stills auto] [--plan]');
    process.exit(1);
  }
  const t0 = Date.now();
  const { scene, dir, name } = await prepareScene(scenePath, args);
  const outDir = path.join(dir, 'out');
  fs.mkdirSync(outDir, { recursive: true });
  let frameSink = null;
  const srv = await startServer({ repoRoot: REPO, projectDir: dir, getScene: () => scene, onFrame: (w, i, buf) => frameSink(w, i, buf) });
  const browser = await launch(args);
  try {
    // ---------- plano ----------
    if (args.plan) {
      const { page, info } = await openPage(browser, srv.url + '/');
      const plan = await page.evaluate(() => window.__engine.plan);
      fs.writeFileSync(path.join(outDir, 'plan.json'), JSON.stringify(plan, null, 1));
      console.log(`📋 ${plan.shots.length} shots, ${info.W}x${info.H}, ${scene.duration}s`);
      for (const s of plan.shots) {
        console.log(`  #${String(s.index).padStart(2)} ${s.start.toFixed(2)}s  [${s.words.map((w) => w.text).join(' ')}]  layout=${s.layout}${s.letterLayout !== 'line' ? '/' + s.letterLayout : ''} style=${s.styleName} cam=${s.camera.move} trans=${s.transition ? s.transition.style + '(' + s.transition.dur.toFixed(2) + ')' : '-'} decor=${s.decor.map((d) => d.type).join(',')}`);
      }
      console.log('   salvo em', path.join(outDir, 'plan.json'));
      return;
    }
    // ---------- stills ----------
    if (args.stills) {
      const { page, info } = await openPage(browser, srv.url + '/');
      let times;
      if (args.stills === true || args.stills === 'auto') {
        const plan = await page.evaluate(() => window.__engine.plan);
        times = plan.shots.map((s) => +(s.start + Math.min(0.55, (s.end - s.start) * 0.5)).toFixed(3));
      } else times = String(args.stills).split(',').map(Number).filter((x) => Number.isFinite(x));
      const sdir = path.join(outDir, 'stills');
      fs.rmSync(sdir, { recursive: true, force: true });
      fs.mkdirSync(sdir, { recursive: true });
      let pending = null;
      frameSink = async (w, i, buf) => {
        const enc = rawEncoder({ width: info.W, height: info.H, fps: 1, out: path.join(sdir, `still_${String(i).padStart(3, '0')}.png`), still: true });
        await enc.write(buf);
        pending = enc.end();
        await pending;
      };
      for (let k = 0; k < times.length; k++) {
        await page.evaluate(([t, k]) => window.__engine.renderTimeAndSend(t, 0, k), [times[k], k]);
        console.log(`   still ${k} @ ${times[k]}s`);
      }
      const cols = info.W >= info.H ? 4 : 6;
      const rows = Math.ceil(times.length / cols);
      const sheet = path.join(outDir, 'stills', 'sheet.png');
      await contactSheet(path.join(sdir, 'still_%03d.png'), sheet, { cols, rows, width: info.W >= info.H ? 480 : 270 });
      fs.writeFileSync(path.join(sdir, 'times.json'), JSON.stringify(times));
      console.log(`🖼️  ${times.length} stills em ${sdir}  (contact sheet: ${sheet})  ${fmtTime((Date.now() - t0) / 1000)}`);
      return;
    }
    // ---------- vídeo ----------
    const fps = scene.output.fps;
    const total = Math.round(scene.duration * fps);
    const fA = Math.max(0, Math.round((args.from ? Number(args.from) : 0) * fps));
    const fB = Math.min(total, args.to ? Math.round(Number(args.to) * fps) : total);
    const nWorkers = Math.max(1, Math.min(Number(args.workers || 1), 8, Math.ceil((fB - fA) / 30)));
    const codec = args.codec || scene.output.codec || 'h264';
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'typo3d-'));
    const chunk = Math.ceil((fB - fA) / nWorkers);
    const ranges = Array.from({ length: nWorkers }, (_, w) => [fA + w * chunk, Math.min(fB, fA + (w + 1) * chunk)]).filter(([a, b]) => b > a);
    const browsers = [browser];
    for (let w = 1; w < ranges.length; w++) browsers.push(await launch(args));
    const pages = await Promise.all(ranges.map((_, w) => openPage(browsers[w], srv.url + '/')));
    const info = pages[0].info;
    console.log(`🎬 ${name}: ${info.W}x${info.H} @${fps}fps, frames ${fA}-${fB} (${((fB - fA) / fps).toFixed(1)}s), ${info.shots} shots, ${ranges.length} worker(s), GL: ${glMode(args)}`);
    const encoders = ranges.map((_, w) => {
      const seg = codec === 'png' ? fs.mkdirSync(path.join(outDir, `frames_${w}`), { recursive: true }) || path.join(outDir, `frames_${w}`) : path.join(work, `seg_${w}.${codec === 'prores' ? 'mov' : 'mp4'}`);
      return { seg, enc: rawEncoder({ width: info.W, height: info.H, fps, out: seg, crf: Number(args.crf || scene.output.crf || 16), preset: scene.quality === 'final' ? 'slow' : 'veryfast', codec }) };
    });
    frameSink = (w, i, buf) => encoders[w].enc.write(buf);
    let done = 0;
    const tStart = Date.now();
    let lastLog = 0;
    await Promise.all(ranges.map(async ([a, b], w) => {
      const { page } = pages[w];
      for (let i = a; i < b; i++) {
        await page.evaluate(([i, w]) => window.__engine.renderAndSend(i, w), [i, w]);
        done++;
        const now = Date.now();
        if (now - lastLog > 3000 || done === fB - fA) {
          lastLog = now;
          const el = (now - tStart) / 1000;
          const rate = done / el;
          process.stdout.write(`\r   ${done}/${fB - fA} frames  ${rate.toFixed(2)} fps  ETA ${fmtTime((fB - fA - done) / Math.max(rate, 1e-3))}     `);
        }
      }
    }));
    process.stdout.write('\n');
    for (const e of encoders) await e.enc.end();
    if (codec === 'png') {
      console.log('✅ frames PNG em', outDir);
      return;
    }
    const suffix = scene.quality === 'final' ? '' : '-' + scene.quality;
    const range = args.from || args.to ? `-${(fA / fps).toFixed(1)}-${(fB / fps).toFixed(1)}` : '';
    const outFile = path.resolve(dir, args.out || (scene.output.file && !suffix && !range ? scene.output.file : path.join('out', `${name}${suffix}${range}.${codec === 'prores' ? 'mov' : 'mp4'}`)));
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    const audioPath = scene.audio?.path || null;
    await concatAndMux({
      segments: encoders.map((e) => e.seg),
      out: outFile,
      audio: audioPath,
      audioOffset: (scene.audio?.offset || 0) + fA / fps,
      duration: (fB - fA) / fps,
      workDir: work,
      audioFadeOut: fB === total ? scene.audio?.fadeOut ?? 0.6 : 0,
    });
    fs.rmSync(work, { recursive: true, force: true });
    const dur = await probeDuration(outFile);
    console.log(`✅ ${outFile}  (${dur ? dur.toFixed(2) + 's' : ''}, render ${fmtTime((Date.now() - t0) / 1000)})`);
    for (const b of browsers.slice(1)) await b.close();
  } finally {
    await browser.close().catch(() => {});
    await srv.close();
  }
}

main().catch((e) => {
  console.error('❌', e.stack || e.message || e);
  process.exit(1);
});
