#!/usr/bin/env bash
# Baixa TODOS os vídeos de referência da playlist para referencias/videos/
# Uso: bash referencias/baixar_referencias.sh "https://www.youtube.com/playlist?list=PL..." [navegador]
# Precisa de yt-dlp (pip install -U "yt-dlp[default]") e ffmpeg.
set -u
URL="${1:?passe o link da playlist}"
BROWSER="${2:-chrome}"
DIR="$(cd "$(dirname "$0")" && pwd)/videos"
mkdir -p "$DIR"
ARGS=(--yes-playlist -f "bv*[height<=1080]+ba/b[height<=1080]/b" --merge-output-format mp4
      -o "$DIR/%(playlist_index)02d - %(title).80B [%(id)s].%(ext)s"
      --download-archive "$DIR/archive.txt" --write-info-json --no-overwrites --ignore-errors)
yt-dlp "${ARGS[@]}" "$URL" || yt-dlp "${ARGS[@]}" --cookies-from-browser "$BROWSER" "$URL"
echo "Pronto: $(ls "$DIR"/*.mp4 2>/dev/null | wc -l) vídeo(s) em $DIR"
echo "Depois rode: node engine/cli/ref-frames.mjs"
