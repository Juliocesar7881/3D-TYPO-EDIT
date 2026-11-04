# Baixa TODOS os vídeos de referência da playlist (ex.: "typo 3d") para referencias/videos/
# Uso (PowerShell, na pasta do repositório):
#   powershell -ExecutionPolicy Bypass -File referencias\baixar_referencias.ps1 -PlaylistUrl "https://www.youtube.com/playlist?list=PL..."
# Precisa de: yt-dlp e ffmpeg  ->  winget install yt-dlp.yt-dlp ; winget install Gyan.FFmpeg
# Playlist "não listada" funciona com o link. Se o YouTube pedir login, o script tenta usar
# os cookies do seu navegador (feche o Chrome antes, ou use -Browser edge / firefox).
param(
  [Parameter(Mandatory = $true)][string]$PlaylistUrl,
  [string]$Browser = "chrome",
  [int]$MaxHeight = 1080
)

$ErrorActionPreference = "Continue"
$out = Join-Path $PSScriptRoot "videos"
New-Item -ItemType Directory -Force -Path $out | Out-Null

if (-not (Get-Command yt-dlp -ErrorAction SilentlyContinue)) {
  Write-Host "yt-dlp não encontrado. Instale com: winget install yt-dlp.yt-dlp" -ForegroundColor Red
  exit 1
}

$common = @(
  "--yes-playlist",
  "-f", "bv*[height<=$MaxHeight]+ba/b[height<=$MaxHeight]/b",
  "--merge-output-format", "mp4",
  "-o", "$out/%(playlist_index)02d - %(title).80B [%(id)s].%(ext)s",
  "--download-archive", "$out/archive.txt",
  "--write-info-json", "--no-overwrites", "--ignore-errors"
)

Write-Host "Baixando playlist para $out ..." -ForegroundColor Cyan
yt-dlp @common $PlaylistUrl
if ($LASTEXITCODE -ne 0) {
  Write-Host "Tentando de novo com cookies do navegador ($Browser)..." -ForegroundColor Yellow
  yt-dlp @common --cookies-from-browser $Browser $PlaylistUrl
}

$n = (Get-ChildItem $out -Filter *.mp4).Count
Write-Host "Pronto: $n vídeo(s) em $out" -ForegroundColor Green
Write-Host "Depois rode:  node engine/cli/ref-frames.mjs   (gera contact sheets para o Claude estudar)"
