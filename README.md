# 3D TYPO EDIT

Motor de **edits de tipografia 3D** sincronizados com música: estilo *3D Typography Edit* (texto neon/cromado
voando no espaço, câmera fluida, rastros de luz, anéis, bloom) e estilo *Typography Candy* (pastel, letras 3D
glossy com contorno de adesivo, corações, balas, nuvens, bounce).

Tudo é código: **Three.js** renderizado frame a frame num **Chromium headless** e codificado com **ffmpeg**.
A cena é uma função pura do tempo, então o resultado é nítido (sem motion blur), determinístico e reproduzível.

A pasta `.claude/skills/typo-3d/` tem a **skill do Claude Code**: peça "faz um edit de tipografia 3D com essa
música e essa letra" e o Claude segue o fluxo (timing → plano → stills → preview → final).

## Instalação

```bash
npm install
npx playwright install chromium
```
Precisa também do **ffmpeg** no PATH (Windows: `winget install Gyan.FFmpeg`).

## Uso rápido

```bash
# demo neon (gera uma batida sintética e renderiza)
node engine/cli/demo-beat.mjs projects/demo-neon/beat.wav 15
npm run render -- projects/demo-neon/scene.json --stills auto   # 1 imagem por shot
npm run render -- projects/demo-neon/scene.json --preview       # vídeo rápido (meia resolução)
npm run render -- projects/demo-neon/scene.json                 # final
```

Novo projeto: copie `projects/_template/` para `projects/minha-edit/`, coloque a música, preencha a letra com
tempos (ou um `.lrc`) e rode os mesmos comandos. Opções: `.claude/skills/typo-3d/reference/cena.md`.

## Estrutura

```
engine/web/        motor 3D (roda no navegador headless)
  src/director/    diretor automático, temas e estilos, construtor do mundo
  src/text/        fontes, glifos 3D, palavras e animações por letra
  src/camera/      rigs de câmera, transições, shake
  src/world/       materiais, ambiente, fundo, partículas, rastros, anéis, formas candy
  src/post/        bloom, streak anamórfico, tonemap, aberração, grão, flash
engine/cli/        render.mjs (CLI), análise de áudio, letras, ffmpeg, ferramentas
fonts/             fontes livres (OFL/Apache) + licenças
projects/          projetos (áudio e saídas ficam fora do git)
referencias/       scripts para baixar e estudar os vídeos de referência
```

## Referências

Os vídeos de referência (playlist "typo 3d") não são versionados. Para baixar todos no seu PC:
```powershell
powershell -ExecutionPolicy Bypass -File referencias\baixar_referencias.ps1   # lê os ids de referencias/playlist.md
node engine/cli/ref-frames.mjs
```

## Licenças

Código deste repositório: uso livre pelo dono do repositório. Fontes em `fonts/` seguem suas licenças
(`fonts/licenses/`). Músicas e letras usadas nas edits são de seus autores — não versione esse material.
