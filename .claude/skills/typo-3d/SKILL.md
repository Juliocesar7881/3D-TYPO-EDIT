---
name: typo-3d
description: Cria edits de TIPOGRAFIA 3D sincronizados com música no nível dos "3D Typography Edit" (texto 3D neon/cromado voando no espaço, câmera fluida passando de palavra em palavra, rastros de luz, anéis, bokeh, bloom) e do estilo "Typography Candy" (pastel, letras 3D gordinhas e glossy com contorno de adesivo, corações, balas, nuvens, bounce). Use sempre que o usuário pedir edit de tipografia, typography edit, lyric edit, edit com a letra da música, texto 3D animado, kinetic typography, estilo candy/neon/cromado, ou vídeo para TikTok/Reels/Shorts/YouTube com a letra aparecendo no ritmo.
---

# Typo 3D — edits de tipografia 3D (neon / candy)

O repositório tem um motor próprio: **Three.js renderizado frame a frame em Chromium headless → ffmpeg**.
A cena é uma **função pura do tempo** (determinística), então o vídeo sai igual toda vez e pode ser
renderizado em paralelo. Você descreve a edit num `scene.json`; um **diretor automático** decide
agrupamento em shots, layout, estilo, cor, animação por letra, movimento de câmera, transição,
decoração e o voo da câmera entre os shots — e **tudo pode ser sobrescrito**.

Arquivos de referência (leia quando precisar do detalhe):
- `reference/cena.md` — **todos** os campos da cena, nomes de estilos/animações/movimentos/decor/temas.
- `reference/estilo.md` — o que faz esses edits ficarem absurdos (análise das referências + receitas).

## 0. Setup (uma vez por máquina)

```bash
npm install                      # three, opentype.js, playwright
npx playwright install chromium  # só fora do container da nuvem (aqui já existe)
ffmpeg -version                  # precisa estar no PATH (ou FFMPEG_PATH=...)
```
No PC com GPU o render é rápido (`--gl gpu`, padrão no Windows/mac). Na nuvem/Linux sem tela usa
SwiftShader (CPU): ~0,5 s/frame em 1080p, ~0,27 s/frame no preview.

## 1. Fluxo de trabalho (siga nesta ordem)

1. **Coletar o briefing** (pergunte só o que faltar):
   - áudio (arquivo na pasta do projeto) e o **trecho** da música (`audio.offset` = segundo da música onde a edit começa; `duration`);
   - a letra **com tempo** (LRC/SRT/"tempo palavra") ou só o texto (aí você cronometra — passo 3);
   - formato: `vertical` (TikTok/Reels/Shorts 1080×1920) ou `landscape` (YouTube 1920×1080);
   - estilo: `neon` (padrão 3D typography), `amv` (texto sobre clipes/fotos), `candy`, `candyNight`, `chrome`, `ice`, `inferno`, `sunset` — ou misture via `themeOverrides`;
   - clipes/fotos para usar (AMV): coloque na pasta do projeto e use `media` (ver `reference/cena.md`);
   - palavras de destaque (viram "hero": maiores, outra cor) e assinatura final (ex.: `EDITED BY @nome`).
2. **Criar o projeto**: `projects/<nome>/scene.json` (copie `projects/_template/scene.json`) e coloque o áudio na pasta.
   Áudio e saídas não vão pro git (ver `.gitignore`). **Nunca** commite músicas/letras de terceiros no repositório.
3. **Timing das palavras** (o que mais importa para ficar profissional):
   - a letra **vem do usuário** (arquivo ou colada na conversa). Não escreva letra de música de memória;
   - com LRC/SRT: `"lyrics": "letra.lrc"` (tempos da música; o motor desconta `audio.offset`) + `"snapToBeats": true`;
   - só com o texto: **cronometragem automática** com Whisper (precisa `pip install faster-whisper` + ffmpeg):
     `python -I engine/tools/align_lyrics.py projects/<nome>/musica.mp3 --lyrics projects/<nome>/letra.txt --from <offset> --to <offset+duração> --out projects/<nome>/palavras.txt`
     → use `"lyrics": "palavras.txt"` (já sai em tempo da edit, quebras de linha = quebras de shot). Modelo `small`
     (padrão) ou `medium` se a voz estiver enterrada no instrumental. Depois confira 2–3 palavras no preview;
   - sem Whisper: rode `npm run audio -- projects/<nome>/musica.mp3 --from <offset> --to <fim>` e use os
     `onsets fortes` para posicionar cada palavra no ataque mais próximo de onde é cantada; confirme com o usuário;
   - regras: uma palavra por ataque; palavras curtas (I, TO, THE, DE, O...) grudam na próxima; use `"break": true`
     para começar shot novo e `"solo": true` para uma palavra sozinha em destaque; `"accent": true` = hero.
4. **Plano**: `npm run render -- projects/<nome>/scene.json --plan` → confira a lista de shots (palavras, layout,
   estilo, câmera, transição, decor). Ajuste com `break`/`solo`/`accent` nas palavras ou `shots: [{index, ...}]`.
5. **Stills** (OBRIGATÓRIO antes de vídeo): `--stills auto` gera 1 PNG por shot + `out/stills/sheet.png`.
   **Abra o sheet com Read e critique**: legibilidade, enquadramento (nada cortado sem querer), contraste,
   excesso de elementos, cor repetida em shots seguidos, brilho estourado. Corrija e repita. Use
   `--stills 1.2,3.4` para tempos específicos (ex.: meio das transições).
6. **Preview**: `--preview` (meia resolução, 30 fps). Para checar fluidez extraia uma tira das transições:
   `ffmpeg -ss <t> -t 1.2 -i out/<nome>-preview.mp4 -vf "select='not(mod(n\,2))',scale=320:-2,tile=6x3" -frames:v 1 out/strip.png`
   e olhe com Read. Frames vazios no voo da câmera → diminua `director.spacing` ou a transição.
7. **Final**: `npm run render -- projects/<nome>/scene.json` (qualidade final; use `"output": {"fps": 60}` para máxima fluidez).
   `--workers 2` acelera um pouco na CPU. Entregue o caminho do `.mp4` (em `projects/<nome>/out/`).

## 2. Regras de ouro do estilo (resumo de `reference/estilo.md`)

- **Legibilidade primeiro**: a palavra tem que ser lida em ~0,3 s. Se um still não lê, troque estilo/cor/decor.
- **Uma cor dominante por shot**, mudando a cada shot (o diretor faz isso com a paleta). Fundo segue a cor (`moodFollow`).
- **Câmera sempre viva**: todo shot tem drift/orbit lento; entre shots, whip rápido com easing forte (sem motion blur —
  a nitidez vem do easing e dos 60 fps). Variedade: nunca o mesmo movimento 2× seguidas.
- **Ritmo**: entrada da palavra NO onset; transição começa ~60% antes do próximo shot; shots de 0,5–2,5 s.
- **Hero words** (palavra forte do verso): `accent: true`, maiores, outro estilo/cor, `solo` às vezes, `flash` no corte.
- **Decor com moderação**: 1–3 elementos por shot; se poluir, `shots: [{index: N, decor: []}]`.
- **Candy**: texto saturado + contorno branco + sombra colorida sobre fundo pastel; animações com bounce/spring;
  câmera com dutch e zoom punch; formas (corações, estrelas, balas, nuvens) em volta, nunca na frente do texto.
- **Neon/3D typography**: fundo escuro com nebula, cromado/neon/glow, perspectiva forte (orbit, hero low-angle, spiral),
  letras que montam a palavra (scatter/zoom/flip), rastros de luz e anéis, bloom forte mas sem estourar o texto.

## 3. Comandos

| comando | o que faz |
|---|---|
| `npm run render -- <cena> --plan` | imprime/salva o plano do diretor (`out/plan.json`) |
| `npm run render -- <cena> --stills auto` | PNG por shot + contact sheet |
| `npm run render -- <cena> --stills 1.5,2.25` | PNGs em tempos específicos |
| `npm run render -- <cena> --preview` | vídeo meia resolução 30 fps |
| `npm run render -- <cena> --draft` | ainda mais rápido (sem MSAA) |
| `npm run render -- <cena> --from 4 --to 9` | só um trecho |
| `npm run render -- <cena>` | final (`--fps 60`, `--crf 14`, `--workers 2`, `--codec prores`) |
| `npm run audio -- <audio>` | BPM, beats, downbeats, onsets, energia (JSON) |
| `node engine/cli/demo-beat.mjs <saida.wav> 15` | batida sintética 120 BPM para testes |
| `node engine/cli/ref-frames.mjs` | contact sheets + ritmo dos vídeos em `referencias/videos/` |

## 4. Esqueleto mínimo de cena

```jsonc
{
  "theme": "neon",                 // neon | amv | candy | candyNight | chrome | ice | inferno | sunset
  "format": "vertical",            // vertical | landscape | square | 4k
  "output": { "fps": 60 },
  "audio": { "file": "musica.mp3", "offset": 42.0 },
  "lyrics": "letra.lrc",           // OU "words": [{ "text": "PALAVRA", "t": 0.52 }, ...]
  "snapToBeats": true,
  "duration": 15,
  "seed": 7,                       // troque para outra "sorte" do diretor
  "director": { "energy": 1.0 },   // 0.6 calmo … 1.4 frenético
  "intro": { "title": "NOME DA MÚSICA", "subtitle": "artista", "until": 1.8 },   // card 2D opcional
  "shots": [ { "index": 3, "move": "spiral", "style": "holo", "transition": "spin", "decor": ["neonRing", "shards"] } ],
  "fx": { "bloom": 1.0, "chromatic": 0.3, "grain": 0.15 }
}
```

## 5. Checklist antes de entregar

- [ ] todas as palavras aparecem no tempo certo (confira 2–3 pontos no preview com o áudio);
- [ ] stills: nada ilegível, nada cortado sem intenção, sem shot "vazio" (só fundo);
- [ ] variedade: cores, estilos e movimentos não repetem em sequência;
- [ ] transições fluidas (tira de frames) e sem frames vazios longos;
- [ ] final renderizado na resolução/fps pedidos, com áudio, duração correta.

## 6. Problemas comuns

- **Lento**: use `--preview`/`--draft` para iterar; no PC com GPU use `--gl gpu`. Partículas: `qualityOverrides.particleScale`.
- **Tela preta / erro WebGL**: `--gl swiftshader`. Fontes: nomes em `reference/cena.md` ou `.ttf` na pasta do projeto.
- **Palavra estourada de brilho**: troque estilo (ex.: `neonFill`→`chromeTint`) ou reduza `fx.bloom`.
- **Texto pequeno/grande demais**: `shots[i].zoom` (multiplica a distância da câmera) ou `word.size`.
- **YouTube bloqueia download na nuvem**: use `referencias/baixar_referencias.ps1` no PC do usuário.
