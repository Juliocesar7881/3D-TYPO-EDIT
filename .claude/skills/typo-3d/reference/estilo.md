# Guia de estilo: o que faz um edit de tipografia 3D ficar absurdo

Baseado na análise frame a frame dos **21 vídeos completos** da playlist "typo 3d" do usuário (estudados em
07/11/2026: frooky, iluxhaep, Flee e oito AMV typography) + storyboards de edits do mesmo nicho.
Detalhe por vídeo, ritmo medido e assinaturas de cada editor: `referencias/playlist.md`.
Para refazer o estudo: `referencias/baixar_referencias.ps1` e `node engine/cli/ref-frames.mjs`
(mosaicos em `referencias/frames/`, fora do git).

## 0. As 8 assinaturas que mais aparecem nos 21 vídeos

1. **Respiro no preto**: 1–3 s quase pretos na abertura e no fim; entre frases o fundo volta ao escuro e só o
   texto brilha. Não encha todo shot de fumaça/cor — reserve cor forte e fumaça para o refrão.
2. **Intro em card** (iluxhaep): moldura fina com cantos, serifada pequena em caixa-alta, waveform, e o fundo
   **alternando preto ↔ branco a cada frase** (vários `cards` seguidos, `bg` dark/light).
3. **Lockup justificado com 1 palavra colorida** (`layout: "stack"`, hero com `color` vermelho/rosa).
4. **Cor dividida dentro da palavra**: `"OLD|ER"`, `"BIG|GER"`, `"D|IE"` — parte branca, parte colorida.
5. **Eco de letra** em sílaba esticada: `"echo": 5` ("WAYYYY", "IEEEE", "NOOOO").
6. **Texto em fita/anel** girando (`layout: "ring"`) e anéis/pílulas grossas atrás da frase.
7. **Assinatura no meio** ("BY FROOKY", "BY ILUXHA" como palavra de um shot, ~60% da edit) e no fim.
8. **Logo/avatar redondo brilhando** no preto para fechar (`media` com `frame: "circle"`) + "edited by" fino
   espaçado (`outro` ou `cards` com `font: "cond"`, `tracking` alto).

## 1. Linguagem comum dos 3D Typography Edits

**Estrutura**
- Intro curta (0,5–3 s): título pequeno e elegante (serifada ou condensada fina) centralizado, às vezes dentro de
  uma moldura fina com cantos/linhas e uma linha de áudio (waveform) — preto ou branco, quase sem cor.
- Corpo: **uma palavra (ou 2–4) por shot**, entrando exatamente no ataque do vocal; cada shot dura de meio a dois
  segundos e tem a sua própria composição 3D. Refrão = mais energia: mais cortes, flashes, cores mais quentes.
- Outro: assinatura ("EDITED BY …" / nome do editor) com o mesmo tratamento do texto, e fade.

**Tipografia**
- Caixa-alta, sans **condensada e pesada** (Anton/Bebas/Impact-like) para lockups; **arredondada/tech** para neon;
  serifada de alto contraste só em detalhes/intro.
- Materiais: cromado refletindo luzes coloridas, extrusão grossa com bevel, neon de contorno (tubo), letra sólida
  brilhando com miolo quase branco e halo colorido, iridescente/holográfico, degradê vertical.
- Layouts: palavra única gigante em perspectiva forte; **lockup empilhado justificado** (cada linha com a mesma
  largura, palavra curta fica enorme); texto em **arco/anel** em volta da câmera; letras **verticais**;
  **letras espalhadas em profundidade** que só formam a palavra de um ângulo; palavras em cascata na profundidade
  com a câmera viajando de uma para outra; palavra de destaque com cor diferente dentro do lockup.

**Câmera (o coração do estilo)**
- Sempre em movimento: drift/orbit lento durante o shot (dolly in, órbita de 20–40°, dutch roll de 5–15°,
  contra-plongée "hero", top-down girando).
- Entre shots: **whip** — acelera e freia forte (ease in-out exponencial), em arco, com um pouco de roll; ou barrel
  roll 360°; ou punch de zoom (FOV). As referências usam motion blur pesado; aqui a regra é **nitidez**: easing forte
  + 60 fps + flash/glitch no corte dão a energia sem borrar.
- A câmera "procura" a palavra nova: dentro do shot ela persegue cada palavra que entra.
- Perspectiva exagerada: o texto raramente está chapado de frente; inclinações de 15–60° e FOV variando.

**Elementos visuais**
- Fundo escuro com **nebula/fumaça colorida**, estrelas, bokeh de várias cores com profundidade.
- **Rastros de luz** (ribbons) espiralando em volta da palavra ou cruzando a tela; lasers finos.
- **Anéis**: neon (duplo), de vidro com reflexo de borda, halo atrás do texto, túnel de anéis no voo.
- Cristais/estilhaços cromados girando, faíscas (estrelas de 4 pontas) piscando.
- Pós: bloom forte (mas o texto continua legível), aberração cromática sutil que pulsa no beat, streak anamórfico,
  vinheta, grão fino, flashes brancos nos cortes fortes, glitch rápido em algumas entradas.
- **Cor por shot**: cada shot tem uma cor dominante (ciano, magenta, violeta, laranja/dourado, vermelho…) e o fundo
  acompanha; a cor muda a cada shot.

## 2. Linguagem do "Typography Candy"

- Paleta: fundo **pastel** (rosa, lilás, azul bebê) com padrão (bolinhas, xadrez, listras, bokeh claro); texto em
  **cores saturadas** (pink choque, azul, roxo, menta, amarelo) para contrastar.
- Letras **gordinhas e arredondadas** (Titan/Lilita/Luckiest/Chewy), 3D glossy tipo bala, com **contorno branco
  grosso** (adesivo) e **sombra deslocada** colorida; às vezes cada letra de uma cor.
- Animação **bouncy**: pop com overshoot, spring, squash & stretch, letras caindo e quicando, balanço (swing),
  jelly/wave enquanto visível; texto em arco e empilhado.
- Câmera: dutch angles, zoom punch, giros rápidos (spin), shake no beat; menos voo longo, mais "pancada".
- Elementos: corações, estrelas, balas/gumballs, nuvens fofas, pirulitos espirais, rosquinhas, confete, brilhos
  brancos, chão xadrez; tudo **em volta** do texto, nunca cobrindo.
- Pós: bloom baixo (fundo claro não pode virar névoa), tonemap neutro (preserva o pastel), quase sem grão.

## 2b. Linguagem do "AMV Typography" (metade da playlist do usuário)

- Texto branco, **minúsculo e gordo** (tema `amv`, estilos `amvBold`/`amvGlow`), voando em perspectiva com zoom/whip.
- **Footage manda na cor**: clipes como fundo (`media` com `mode: "backdrop"`, `dim` 0.3–0.5) ou como **cards 3D**
  atrás do texto (`mode: "card"`, `frame: "polaroid"` ou `"glow"`), trocando a cada 1–2 shots.
- Barras de espectro sob o texto (`decor: ["spectrum"]`), faíscas e estrelas cromadas; anéis/plataformas com moderação.
- Detalhes por vídeo: `referencias/playlist.md`.

## 3. Receitas (como pedir ao diretor)

| momento | receita |
|---|---|
| abertura elegante | `"intro": {"title": "NOME DA MÚSICA", "subtitle": "artista", "until": 2.0}` (moldura + waveform + typewriter) ou 1ª palavra com `style: "card"`, `in: "fade"`, `move: "static"` |
| palavra-soco do refrão | `solo: true`, `accent: true`, `in: "zoom"` ou `"scatter"`, `transition: "zoom"` + `flash: true`, `decor: ["sparkleBurst","streakCross"]` |
| frase empilhada | 2–4 palavras no mesmo shot, `layout: "stack"`, `move: "orbitL"`/`"craneUp"` |
| viagem de palavra em palavra | `layout: "cascade"`, `move: "slideL"`, `follow: 1` |
| palavra que se monta | `layout: "scatter3d"`, `move: "orbitR"` com `k: 1.4` |
| anel de texto | palavra única `layout: "ring"`, `move: "push"` ou `"spiral"` |
| túnel | `decor: ["tunnel"]` no shot anterior ao corte, `transition: "whip"` |
| clima calmo | `director.energy: 0.7`, `transition: "smooth"`, `in: "fade"`/`"rise"`, `idle: "float"` |
| candy fofo | tema `candy`, `in: "bounce"`/`"drop"`, `idle: "jelly"`, `decor: ["hearts","clouds"]` |
| AMV com clipes | tema `amv`, `media` com 1 backdrop por verso e cards nas palavras fortes, `decor: ["spectrum"]` no refrão |
| fim | assinatura como palavras finais (`style: "outline"`/`"neonTube"`), `out: "fade"`, `fadeOut: 0.8` |
| intro iluxhaep | 3–5 `cards` de ~0,7 s, um por frase, `bg` alternando `"dark"`/`"light"`, `font: "serif"`, `frame: true`, `waveform: true`, `size: 0.035` |
| palavra meio colorida | `{ "text": "OLD\|ER", "accent": true }` (ou `splitColor`) em lockup `stack` |
| sílaba esticada | `{ "text": "WAY", "echo": 5 }` + `in: "trackIn"` ou `"stretch"` |
| fecho com avatar | última palavra/assinatura solo + `media: [{ "file": "avatar.png", "mode": "card", "frame": "circle", "t0": …, "t1": …, "size": 1.2 }]` |

## 4. Ritmo e timing

- Entrada no onset da sílaba tônica; se a letra vem por linha (LRC), use `snapToBeats`.
- Tempo médio por shot nas referências: ~0,7–1,5 s no refrão, 1,5–3 s em partes lentas.
- A transição começa antes do próximo shot (≈60% antes) e termina logo depois — a palavra nova entra com a câmera
  ainda freando (fica dinâmico e legível).
- Pausas na música = shot mais longo com órbita lenta ou transição `smooth` longa; drop/refrão = `energy` alta,
  `whip`/`spin`/`zoom` e flashes nos downbeats.

## 5. Erros que matam a qualidade

- Texto estourado de bloom (vira mancha) → estilo com menos glow ou `fx.bloom` menor.
- Elementos na frente da palavra (anéis, lasers, formas) → tire o decor do shot.
- Mesma cor/movimento em shots seguidos → mude `seed` ou faça override.
- Voo longo por espaço vazio entre shots → `director.spacing: 0.7` ou transição mais curta.
- Motion blur pesado / desfoque → não use; nitidez é a assinatura de qualidade aqui.
- Fundo claro com bloom alto (candy) → névoa leitosa; mantenha `bloomThreshold` alto.
