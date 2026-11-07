// Helpers de ffmpeg: localizar o binário, encoder de frames crus, concat e mux.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

let cached = null;
export function findFfmpeg() {
  if (cached) return cached;
  const candidates = [process.env.FFMPEG_PATH, 'ffmpeg'];
  try {
    const req = createRequire(import.meta.url);
    const st = req('ffmpeg-static');
    if (st) candidates.push(st);
  } catch {}
  for (const c of candidates) {
    if (!c) continue;
    const r = spawnSync(c, ['-version'], { encoding: 'utf8' });
    if (r.status === 0) {
      cached = c;
      return c;
    }
  }
  throw new Error('ffmpeg não encontrado. Instale (https://ffmpeg.org/download.html) ou defina FFMPEG_PATH.');
}

export function run(args, { quiet = true } = {}) {
  const ff = findFfmpeg();
  return new Promise((resolve, reject) => {
    const p = spawn(ff, ['-hide_banner', '-loglevel', quiet ? 'error' : 'info', '-y', ...args], { stdio: ['ignore', 'inherit', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg falhou: ' + err.slice(-2000)))));
  });
}

// processo ffmpeg que recebe RGBA cru (de baixo pra cima) no stdin
export function rawEncoder({ width, height, fps, out, crf = 16, preset = 'medium', codec = 'h264', still = false }) {
  const ff = findFfmpeg();
  const input = ['-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${width}x${height}`, '-r', String(fps), '-i', '-'];
  let outArgs;
  if (still) outArgs = ['-vf', 'vflip', '-frames:v', '1', out];
  else if (codec === 'prores') outArgs = ['-vf', 'vflip', '-c:v', 'prores_ks', '-profile:v', '3', '-pix_fmt', 'yuv422p10le', out];
  else if (codec === 'png') outArgs = ['-vf', 'vflip', path.join(out, 'frame_%05d.png')];
  else outArgs = ['-vf', 'vflip,format=yuv420p', '-c:v', 'libx264', '-preset', preset, '-crf', String(crf), '-tune', 'film', '-g', String(Math.round(fps * 2)), '-bf', '2', '-movflags', '+faststart', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', out];
  const p = spawn(ff, ['-hide_banner', '-loglevel', 'error', '-y', ...input, ...outArgs], { stdio: ['pipe', 'inherit', 'pipe'] });
  let err = '';
  p.stderr.on('data', (d) => (err += d));
  const done = new Promise((resolve, reject) => {
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error('ffmpeg encoder falhou: ' + err.slice(-2000)))));
  });
  return {
    write(buf) {
      return new Promise((resolve, reject) => {
        const ok = p.stdin.write(buf, (e) => (e ? reject(e) : null));
        if (ok) resolve();
        else p.stdin.once('drain', resolve);
      });
    },
    async end() {
      p.stdin.end();
      await done;
    },
  };
}

export async function concatAndMux({ segments, out, audio, audioOffset = 0, duration, workDir, audioFadeOut = 0.6 }) {
  let video = segments[0];
  if (segments.length > 1) {
    const list = path.join(workDir, 'concat.txt');
    fs.writeFileSync(list, segments.map((s) => `file '${s.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
    video = path.join(workDir, 'video_concat.mp4');
    await run(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', video]);
  }
  if (audio) {
    const af = [];
    if (audioFadeOut > 0 && duration) af.push(`afade=t=out:st=${Math.max(0, duration - audioFadeOut).toFixed(3)}:d=${audioFadeOut}`);
    await run([
      '-i', video,
      '-ss', String(audioOffset), '-t', String(duration), '-i', audio,
      '-map', '0:v:0', '-map', '1:a:0',
      '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k',
      ...(af.length ? ['-af', af.join(',')] : []),
      '-shortest', '-movflags', '+faststart', out,
    ]);
  } else {
    fs.copyFileSync(video, out);
  }
}

export async function contactSheet(pattern, out, { cols = 4, rows, width = 480 } = {}) {
  const r = rows ?? 3;
  await run(['-i', pattern, '-vf', `scale=${width}:-2,tile=${cols}x${r}:padding=6:margin=6:color=0x111111`, '-frames:v', '1', out]);
}

export async function probeDuration(file) {
  const ff = findFfmpeg();
  return new Promise((resolve) => {
    const p = spawn(ff, ['-hide_banner', '-i', file], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', () => {
      const m = err.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
      resolve(m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : null);
    });
  });
}

// largura/altura de imagem ou vídeo (lê o stderr do ffmpeg -i)
export async function probeSize(file) {
  const ff = findFfmpeg();
  return new Promise((resolve) => {
    const p = spawn(ff, ['-hide_banner', '-i', file], { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', () => {
      const m = err.match(/Video:[^\n]*?\b(\d{2,5})x(\d{2,5})\b/);
      resolve(m ? { width: +m[1], height: +m[2] } : null);
    });
  });
}
