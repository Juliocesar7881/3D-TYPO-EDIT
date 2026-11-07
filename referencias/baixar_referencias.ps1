# Baixa os vídeos de referência para referencias/videos/
# Uso (PowerShell, na pasta do repositório):
#   powershell -ExecutionPolicy Bypass -File referencias\baixar_referencias.ps1
#       -> sem argumento: baixa os ids listados na tabela de referencias\playlist.md
#   powershell -ExecutionPolicy Bypass -File referencias\baixar_referencias.ps1 -PlaylistUrl "https://www.youtube.com/playlist?list=PL..."
#       -> baixa uma playlist inteira (o link precisa estar completo)
# Precisa de: yt-dlp e ffmpeg  ->  winget install yt-dlp.yt-dlp ; winget install Gyan.FFmpeg
# Se o YouTube pedir login, rode de novo com -Browser chrome (ou edge / firefox) para usar os cookies do
# seu navegador (feche o navegador antes).
param(
  [string]$PlaylistUrl = "",
  [string]$Browser = "",
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
  "-f", "bv*[height<=$MaxHeight]+ba/b[height<=$MaxHeight]/b",
  "--merge-output-format", "mp4",
  "--download-archive", "$out/archive.txt",
  "--write-info-json", "--no-overwrites", "--ignore-errors"
)
if ($Browser) { $common += @("--cookies-from-browser", $Browser) }

if ($PlaylistUrl) {
  Write-Host "Baixando playlist para $out ..." -ForegroundColor Cyan
  yt-dlp @common --yes-playlist -o "$out/%(playlist_index)02d - %(title).80B [%(id)s].%(ext)s" $PlaylistUrl
} else {
  # ids da tabela "| # | id | ..." de playlist.md
  $md = Get-Content (Join-Path $PSScriptRoot "playlist.md") -Encoding UTF8
  $rows = $md | Where-Object { $_ -match '^\|\s*(\d+)\s*\|\s*([\w-]{11})\s*\|' } | ForEach-Object {
    $null = $_ -match '^\|\s*(\d+)\s*\|\s*([\w-]{11})\s*\|'; [pscustomobject]@{ n = [int]$Matches[1]; id = $Matches[2] }
  }
  Write-Host "Baixando $($rows.Count) vídeos de playlist.md para $out ..." -ForegroundColor Cyan
  foreach ($r in $rows) {
    $n = '{0:D2}' -f $r.n
    yt-dlp @common -o "$out/$n - %(title).80B [%(id)s].%(ext)s" "https://www.youtube.com/watch?v=$($r.id)"
  }
}

$n = (Get-ChildItem $out -Filter *.mp4).Count
Write-Host "Pronto: $n vídeo(s) em $out" -ForegroundColor Green
Write-Host "Depois rode:  node engine/cli/ref-frames.mjs   (gera contact sheets para o Claude estudar)"
