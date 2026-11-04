#!/usr/bin/env python3
"""Cronometra a letra automaticamente (palavra por palavra) com faster-whisper.

Uso:
  pip install faster-whisper
  python -I engine/tools/align_lyrics.py musica.mp3 --lyrics letra.txt --from 42 --to 60 --out palavras.txt

- Sem --lyrics: transcreve e devolve as palavras ouvidas com tempo.
- Com --lyrics (texto puro, uma frase por linha): a letra é usada como prompt e
  alinhada às palavras ouvidas; palavras que o modelo não ouviu recebem tempo
  interpolado. A saída mantém as quebras de linha (= quebras de shot).
- Tempos de saída são da EDIT (0 = --from). Formato "tempo PALAVRA" por linha,
  pronto para usar em "lyrics" da cena (lyricsTimeBase: "edit").
Dica: vocal com muito instrumento erra mais; use --model medium se o PC aguentar.
"""
import argparse
import difflib
import json
import os
import re
import subprocess
import sys
import unicodedata


def norm(w):
    w = unicodedata.normalize("NFD", w.lower())
    w = "".join(c for c in w if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "", w)


def cut_audio(src, start, end):
    """Decodifica com ffmpeg direto para float32 16 kHz mono (evita depender do PyAV)."""
    import numpy as np

    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error"]
    if start:
        cmd += ["-ss", str(start)]
    cmd += ["-i", src]
    if end:
        cmd += ["-t", str(end - (start or 0))]
    cmd += ["-ac", "1", "-ar", "16000", "-f", "f32le", "-"]
    raw = subprocess.run(cmd, check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def transcribe(path, model_name, lang, prompt):
    from faster_whisper import WhisperModel

    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        path,
        language=lang,
        word_timestamps=True,
        vad_filter=False,
        condition_on_previous_text=False,
        initial_prompt=prompt[:800] if prompt else None,
        beam_size=5,
    )
    words = []
    for seg in segments:
        for w in seg.words or []:
            t = w.word.strip()
            if t:
                words.append({"text": t, "start": float(w.start), "end": float(w.end), "p": float(w.probability)})
    # o Whisper costuma esticar o início da 1ª palavra de cada trecho para trás
    # (engole a pausa/instrumental). O fim é confiável: corrige palavras longas demais.
    durs = sorted(w["end"] - w["start"] for w in words if 0.05 < w["end"] - w["start"] < 1.0)
    med = durs[len(durs) // 2] if durs else 0.3
    limit = max(0.7, 2.2 * med)
    for w in words:
        if w["end"] - w["start"] > limit:
            w["start"] = round(w["end"] - min(limit, med * 1.4), 3)
            w["fixed"] = True
    return words, info


def align(lyric_lines, heard):
    lyr = []  # (linha, palavra)
    for li, line in enumerate(lyric_lines):
        for w in line.split():
            lyr.append((li, w))
    a = [norm(w) for _, w in lyr]
    b = [norm(h["text"]) for h in heard]
    times = [None] * len(lyr)
    sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    for blk in sm.get_matching_blocks():
        for k in range(blk.size):
            times[blk.a + k] = heard[blk.b + k]["start"]
    # palavras parecidas (não idênticas) dentro das lacunas
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "replace":
            for i in range(i1, i2):
                best, bt = 0.0, None
                for j in range(j1, j2):
                    r = difflib.SequenceMatcher(a=a[i], b=b[j]).ratio()
                    if r > best:
                        best, bt = r, heard[j]["start"]
                if best >= 0.6:
                    times[i] = bt
    # interpola o que sobrou
    known = [i for i, t in enumerate(times) if t is not None]
    if not known:
        return [(li, w, None) for li, w in lyr]
    for i in range(len(times)):
        if times[i] is not None:
            continue
        prev = max([k for k in known if k < i], default=None)
        nxt = min([k for k in known if k > i], default=None)
        if prev is None:
            times[i] = max(0.0, times[nxt] - 0.25 * (nxt - i))
        elif nxt is None:
            times[i] = times[prev] + 0.3 * (i - prev)
        else:
            times[i] = times[prev] + (times[nxt] - times[prev]) * (i - prev) / (nxt - prev)
    # garante ordem crescente
    for i in range(1, len(times)):
        if times[i] <= times[i - 1]:
            times[i] = times[i - 1] + 0.05
    return [(li, w, t) for (li, w), t in zip(lyr, times)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("audio")
    ap.add_argument("--lyrics", help="arquivo de texto com a letra (uma frase por linha)")
    ap.add_argument("--model", default="small", help="tiny | base | small | medium | large-v3")
    ap.add_argument("--lang", default=None, help="pt, en, es... (padrão: detectar)")
    ap.add_argument("--from", dest="start", type=float, default=0.0)
    ap.add_argument("--to", dest="end", type=float, default=None)
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    lines = []
    if args.lyrics:
        with open(args.lyrics, encoding="utf-8") as f:
            lines = [l.strip() for l in f if l.strip() and not l.strip().startswith("#")]
    audio = cut_audio(args.audio, args.start, args.end)
    heard, info = transcribe(audio, args.model, args.lang, " ".join(lines))
    print(f"idioma: {info.language} ({info.language_probability:.2f}), {len(heard)} palavras ouvidas", file=sys.stderr)

    out_lines = []
    if lines:
        res = align(lines, heard)
        cur = None
        for li, w, t in res:
            if cur is not None and li != cur:
                out_lines.append("")
            cur = li
            out_lines.append(f"{t:.3f} {w}")
    else:
        prev_end = None
        for h in heard:
            if prev_end is not None and h["start"] - prev_end > 0.6:
                out_lines.append("")
            out_lines.append(f"{h['start']:.3f} {h['text']}")
            prev_end = h["end"]
    text = "\n".join(out_lines) + "\n"
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text)
        with open(os.path.splitext(args.out)[0] + ".heard.json", "w", encoding="utf-8") as f:
            json.dump(heard, f, ensure_ascii=False, indent=1)
        print(f"salvo em {args.out}", file=sys.stderr)
    else:
        sys.stdout.write(text)


if __name__ == "__main__":
    main()
