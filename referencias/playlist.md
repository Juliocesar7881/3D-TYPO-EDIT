# Playlist "typo 3d" (referências do usuário)

Link: https://www.youtube.com/playlist?list=PLHJ_3gLP63Zs — 21 vídeos.
Os vídeos em si não ficam no repositório. Para baixar no seu PC:
`powershell -ExecutionPolicy Bypass -File referencias\baixar_referencias.ps1 -PlaylistUrl "https://www.youtube.com/playlist?list=PLHJ_3gLP63Zs"`
e depois `node engine/cli/ref-frames.mjs` para gerar os mosaicos de estudo.

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

Material estudado (nov/2026): miniatura dos 21 + storyboards (~1 frame/s) de 12. Download dos vídeos
completos a partir da nuvem é bloqueado pelo YouTube; o estudo detalhado frame a frame precisa dos
vídeos baixados no PC.

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
