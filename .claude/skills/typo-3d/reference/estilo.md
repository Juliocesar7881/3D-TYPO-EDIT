# Guia de estilo: o que faz um edit de tipografia 3D ficar absurdo

Baseado na análise frame a frame (storyboards ~1 fps) de edits de referência do mesmo nicho da playlist
"typo 3d" do usuário: 3D Typography Edits (frooky, iluxhaep, lvcʌ…) e "AMV Typography Candy" (Xtuez e similares).
Para estudar os 21 vídeos da playlist em detalhe: baixe no PC (`referencias/baixar_referencias.ps1`) e rode
`node engine/cli/ref-frames.mjs` — depois abra os `referencias/frames/*/sheet_XX.jpg`.

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
| fim | assinatura como palavras finais (`style: "outline"`/`"neonTube"`), `out: "fade"`, `fadeOut: 0.8` |

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
