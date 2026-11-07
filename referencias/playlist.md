# Playlist "typo 3d" (referências do usuário)

21 vídeos (o link da playlist que circulou estava cortado; o download usa os **ids da tabela abaixo**).
Os vídeos em si não ficam no repositório. Para baixar no seu PC (yt-dlp + ffmpeg):
`powershell -ExecutionPolicy Bypass -File referencias\baixar_referencias.ps1`
(sem argumento ele lê os ids desta tabela; `-PlaylistUrl "<link completo>"` também funciona)
e depois `node engine/cli/ref-frames.mjs` para gerar os mosaicos de estudo em `referencias/frames/`.

| # | id | vídeo (canal) | família |
|---|---|---|---|
| 1 | nDwD8tm9r2s | Clarity — frooky | 3D typography |
| 2 | NrVY0wYInt0 | They don't know about us — BINVFX | AMV typography |
| 3 | G8Jay-QIln0 | Slow Down — frooky | 3D typography |
| 4 | Fyy40CkoB4c | Softcore — iluxhaep | 3D typography |
| 5 | lRcQo8G78gA | Perfect — MontagEdits | AMV typography |
| 6 | FD0DHWv3fQc | Closer — Pocket | AMV typography |
| 7 | 54NxGNuqH24 | Beautiful Angel — Pocket | AMV typography |
| 8 | LKHa0mxmGfY | Counting Stars — frooky | 3D typography |
| 9 | jSlRdjbu8zA | Love Me Not — iluxhaep | 3D typography (soft/claro) |
| 10 | 3VBcvXvX3aA | Die With A Smile — frooky | 3D typography |
| 11 | uGMRTAmCPGI | BIN (edit) — LuluBlox YT (edit do próprio usuário) | texto + clipes |
| 12 | XSWK7DgJlOI | Merry Christmas — iluxhaep | 3D typography |
| 13 | DxFt-DlBl7c | Make Your Beautiful — RulsMv | AMV typography (Node Video) |
| 14 | 17SxnPz2TKE | Part Mep 18 — v4nik | AMV typography |
| 15 | vKYd388dUsQ | Hate Me — iluxhaep | 3D typography |
| 16 | kefBAcadWxQ | Dandelions 3D cam — ica ai | AMV typography (Node Video) |
| 17 | dkVFVHSlJcU | Strangers — Flee | 3D typography |
| 18 | ItgJYmKqh6M | TiK ToK — iluxhaep | 3D typography (gráfico P&B) |
| 19 | OL4M6TI8DR0 | Die For You — iluxhaep | 3D typography |
| 20 | 3i1ifSmiTMw | I Just Wanna Be Loved — iluxhaep | 3D typography |
| 21 | pnqN_My711Y | Mamacita — MontagEdits | AMV typography |

Material estudado: em 07/11/2026 os **21 vídeos completos** foram baixados no PC do usuário e estudados
frame a frame (mosaicos de 1 frame/s + detecção de cortes do `ref-frames.mjs`). A análise abaixo vale
para os 21.

## Ritmo medido (ref-frames.mjs)

"mudanças bruscas" = cortes/flashes detectados pelo ffmpeg (scene > 0.32). Nos 3D typography a câmera
voa sem corte, então o número baixo não quer dizer edit lento: a palavra troca a cada ~0,4–0,8 s.

| # | duração | mudanças bruscas | s por mudança |
|---|---|---|---|
| 1 Clarity | 48 s | 39 | 0,93 |
| 2 They don't know | 62 s | 18 | 2,28 |
| 3 Slow Down | 55 s | 11 | 4,57 |
| 4 Softcore | 39 s | 12 | 3,15 |
| 5 Perfect | 50 s | 6 | 5,70 |
| 6 Closer | 30 s | 79 | 0,26 |
| 7 Beautiful Angel | 38 s | 164 | 0,18 |
| 8 Counting Stars | 64 s | 40 | 1,56 |
| 9 Love Me Not | 36 s | 6 | 5,53 |
| 10 Die With A Smile | 59 s | 11 | 4,67 |
| 11 BIN (usuário) | 32 s | 16 | 1,87 |
| 12 Merry Christmas | 104 s | 8 | 5,80 |
| 13 Make Your Beautiful | 61 s | 97 | 0,59 |
| 14 Part Mep 18 | 21 s | 3 | — |
| 15 Hate Me | 35 s | 18 | 1,47 |
| 16 Dandelions | 20 s | 3 | — |
| 17 Strangers | 20 s | 8 | 0,86 |
| 18 TiK ToK | 39 s | 10 | 3,05 |
| 19 Die For You | 43 s | 7 | 1,10 |
| 20 I Just Wanna Be Loved | 38 s | 8 | 2,10 |
| 21 Mamacita | 32 s | 6 | 4,88 |

AMVs com footage (6, 7, 13) cortam muito (0,2–0,6 s); os 3D typography quase não cortam, voam.

## Assinaturas vistas nos vídeos completos (07/11/2026)

**frooky (1, 3, 8, 10)**
- Abre com "FROOKY PRESENTS" pequeno + linha de áudio (waveform) horizontal; fecha com o logo se
  montando no escuro com uma varredura de luz. Antes e depois: 1–3 s de quase preto.
- **Eco de letra** nas sílabas esticadas: "WAYYYY", "IEEEEE", "WUUUGHHH" (última letra repetida, cada cópia
  menor e mais apagada) → `"echo": 5` na palavra.
- Texto **em cima de fita/anel**: frase escrita sobre uma faixa elíptica larga ("HAVE A LITTLE", "AND OUR
  TIME") → `layout: "ring"` com palavra longa, ou `letterLayout: "arc"`.
- Muito preto entre os shots: só o texto iluminado pelo próprio brilho, bokeh fino; cor forte só no refrão.
- Assinatura "FROOKY"/"BY FROOKY" aparece como palavra no meio da edit, não só no fim.

**iluxhaep (4, 9, 12, 15, 19, 20)**
- **Intro em card**: moldura fina com cantos, palavra serifada pequena em caixa-alta, waveform embaixo,
  e o fundo **alternando preto ↔ branco a cada frase** → vários `cards` seguidos com `bg` dark/light.
- Lockups empilhados **justificados** com tamanhos bem diferentes ("I WOULD / FOR DIE YOU"), condensada
  pesada (Bebas/Anton) branca com leve degradê, **uma palavra vermelha**.
- **Cor dividida dentro da palavra**: "OLD" branco + "ER" colorido, "BIG" + "GER" → `"text": "OLD|ER"`.
- Pílula/anel 3D grosso com o texto dentro ("WE GOT OLDER" numa cápsula rosa).
- UI: card de player (capa + nome da música, estilo Spotify), balões de chat num celular, janela de
  Bloco de Notas digitando no papel de parede do XP (Love Me Not), relógio, mãos de coração, colagem de jornal.
- Fim: **avatar redondo do editor brilhando** no preto (+ "THANKS FOR WATCHING") → `media` com `frame: "circle"`.
- Merry Christmas abre com uma TV de tubo numa mesa; TiK ToK é gráfico 2D chapado (preto/branco/azul-bebê + amarelo).

**Flee (17)**: glitch RGB forte, texto embaçado/fantasma que entra com blur, logo próprio no meio.

**AMV (2, 5, 6, 7, 13, 14, 16, 21)**: confirmado tudo o que está abaixo, mais: minúsculas gordas
(Poppins/Nunito) misturadas com 1 palavra em script; quadros de filme (film strip), cenário de mesa de madeira
com papel amassado, bússola e fotos (16); sala/estúdio 3D simples onde o texto fica no chão (2); logo do
editor no começo; marca d'água pequena no canto o tempo todo.

## O que cada família ensina (análise visual, só técnica)

**3D typography (frooky, iluxhaep, Flee)** — já coberto pelos temas `neon`, `chrome` e céu `clouds/smoke/space`:
- texto é o herói: grande, legível, perspectiva moderada; lockups empilhados com 1 palavra de destaque colorida;
- materiais ricos: cromado com reflexo, holográfico, contorno neon fino, textura suja, contorno branco;
- atmosfera: fumaça/nuvens iluminadas por trás, raios de luz, flares, bokeh; paleta de 2–3 cores por edit;
- elementos: cacos de vidro, estrelas cromadas, raios elétricos, faíscas, **barras de espectro de áudio** (frooky);
- intro em card com moldura fina, título serifado e waveform; outro com "edited by"; cards de UI de música (telas de player) às vezes.

**AMV typography (BINVFX, Pocket, MontagEdits, RulsMv, v4nik, Node Video)** — coberto pelo tema `amv` + `media`:
- texto branco, **minúsculo e muito gordo** (estilo Poppins/Nunito Black), às vezes manuscrito arredondado, voando em perspectiva;
- **footage** (clipes/imagens) como fundo e como **cards 3D**: polaroides, molduras com borda neon, fotos girando no espaço;
- plataformas e anéis circulares sob o texto, anéis de fogo com texto girando em volta, chão grid, cenários 3D simples;
- transições rápidas com zoom/whip/blur radial, flashes; cor vem muito do footage.

**Edit do usuário (#11)**: fundo preto com bokeh branco, texto branco que entra com blur, clipes com tinta vermelha,
emoji/coração 3D, card de player de música, título final em fogo. Bom candidato ao tema `amv` com `media` + `cards`.
