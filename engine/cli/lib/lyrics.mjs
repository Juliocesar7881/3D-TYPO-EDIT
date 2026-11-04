// Importa texto com tempo para a lista de palavras da cena.
// Formatos aceitos (auto-detectados):
//  1) Palavras com tempo, uma por linha:   "12.34 PALAVRA"  ou  "0:12.34 PALAVRA"
//     (linha em branco = quebra de frase/shot; "12.34 duas palavras" = mesma frase)
//  2) LRC: "[00:12.34] linha inteira" (+ tags de palavra "<00:12.50>pal" do LRC estendido)
//  3) SRT: blocos "00:00:12,340 --> 00:00:14,000" + texto
// Tempos em LRC/SRT são da MÚSICA; o CLI converte para tempo da edit com audio.offset.

function parseClock(s) {
  s = s.trim().replace(',', '.');
  const parts = s.split(':').map(Number);
  if (parts.some((x) => Number.isNaN(x))) return null;
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

// peso aproximado de duração de uma palavra (vogais ~ sílabas)
function weight(word) {
  const v = (word.match(/[aeiouyáéíóúâêôãõàAEIOUYÁÉÍÓÚÂÊÔÃÕÀ]+/g) || []).length;
  return Math.max(1, v) + word.length * 0.08;
}

function spreadLine(text, t0, t1, line) {
  const ws = text.split(/\s+/).filter(Boolean);
  if (!ws.length) return [];
  const total = ws.reduce((s, w) => s + weight(w), 0);
  const span = Math.max(0.2, t1 - t0) * 0.92;
  let acc = 0;
  return ws.map((w) => {
    const t = t0 + (acc / total) * span;
    acc += weight(w);
    return { text: w, t: +t.toFixed(3), line };
  });
}

export function parseLyrics(src, { lineGap = 3.5 } = {}) {
  const text = src.replace(/\r/g, '');
  const lines = text.split('\n');
  // SRT
  if (/\d{2}:\d{2}:\d{2}[,.]\d{1,3}\s*-->/.test(text)) {
    const words = [];
    const blocks = text.split(/\n\s*\n/);
    let li = 0;
    for (const b of blocks) {
      const m = b.match(/(\d{2}:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{1,3})/);
      if (!m) continue;
      const body = b.split('\n').filter((l) => l && !/-->/.test(l) && !/^\d+$/.test(l.trim())).join(' ');
      words.push(...spreadLine(body, parseClock(m[1]), parseClock(m[2]), li++));
    }
    return { words, timeBase: 'song' };
  }
  // LRC
  if (lines.some((l) => /^\s*\[\d+:\d+(\.\d+)?\]/.test(l))) {
    const entries = [];
    for (const l of lines) {
      const tags = [...l.matchAll(/\[(\d+:\d+(?:\.\d+)?)\]/g)];
      if (!tags.length) continue;
      const body = l.replace(/\[[^\]]*\]/g, '').trim();
      for (const tg of tags) entries.push({ t: parseClock(tg[1]), body });
    }
    entries.sort((a, b) => a.t - b.t);
    const words = [];
    entries.forEach((e, li) => {
      if (!e.body) return;
      const next = entries[li + 1];
      const t1 = next ? Math.min(next.t, e.t + lineGap) : e.t + lineGap;
      if (/<\d+:\d+(\.\d+)?>/.test(e.body)) {
        // LRC estendido com tempo por palavra
        const parts = [...e.body.matchAll(/<(\d+:\d+(?:\.\d+)?)>\s*([^<]+)/g)];
        for (const p of parts) {
          const ws = p[2].trim().split(/\s+/).filter(Boolean);
          const tt = parseClock(p[1]);
          ws.forEach((w, k) => words.push({ text: w, t: +(tt + k * 0.12).toFixed(3), line: li }));
        }
      } else words.push(...spreadLine(e.body, e.t, t1, li));
    });
    return { words, timeBase: 'song' };
  }
  // palavras com tempo
  const words = [];
  let li = 0;
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) { li++; continue; }
    if (l.startsWith('#')) continue;
    const m = l.match(/^(\d+(?::\d+)*(?:[.,]\d+)?)\s+(.+)$/);
    if (!m) continue;
    const t = parseClock(m[1]);
    const ws = m[2].trim().split(/\s+/);
    ws.forEach((w, k) => words.push({ text: w, t: +(t + k * 0.001).toFixed(3), line: li }));
  }
  return { words, timeBase: 'edit' };
}

// aproxima tempos das palavras dos onsets/beats mais próximos (corrige LRC por linha)
export function snapWords(words, analysis, { maxDist = 0.12, offset = 0 } = {}) {
  if (!analysis) return words;
  const marks = [...(analysis.onsets || []).filter((o) => o.s > 0.25).map((o) => o.t), ...(analysis.beats || [])].map((x) => x - offset).sort((a, b) => a - b);
  if (!marks.length) return words;
  return words.map((w) => {
    let best = w.t, bd = maxDist;
    for (const m of marks) {
      const d = Math.abs(m - w.t);
      if (d < bd) { bd = d; best = m; }
      if (m > w.t + maxDist) break;
    }
    return { ...w, t: +best.toFixed(3) };
  });
}
