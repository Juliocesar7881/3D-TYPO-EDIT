# Referência completa do `scene.json`

O arquivo aceita comentários `//` e `/* */` e vírgula sobrando. Caminhos são relativos à pasta da cena.
Tempos em **segundos da edit** (t = 0 é o primeiro frame), exceto onde indicado "tempo da música".

## Raiz

| campo | tipo / padrão | descrição |
|---|---|---|
| `theme` | `"neon"` | tema base: `neon`, `candy`, `candyNight`, `chrome`, `ice`, `inferno`, `sunset` |
| `themeOverrides` | objeto | sobrescreve qualquer parte do tema (deep merge): `palette`, `background`, `env`, `styles` (pesos), `anims`, `camera`, `layouts`, `decor`, `decorPerShot`, `particles`, `fx`, `shadow` |
| `palette` | `["#hex", ...]` | atalho para `themeOverrides.palette` (cores de destaque, uma por shot) |
| `format` | `"landscape"` | `landscape`/`youtube` 1920×1080, `vertical`/`tiktok`/`reels`/`shorts` 1080×1920, `square`, `4k`, `vertical4k`, `720p` |
| `output` | `{fps:30, crf:16}` | `width`, `height`, `fps`, `crf` (menor = melhor), `file` (saída final), `codec` (`h264`, `prores`, `png`) |
| `audio` | — | `{ "file": "musica.mp3", "offset": 0, "fadeOut": 0.6 }` — `offset` = tempo da música no t=0 da edit |
| `lyrics` | caminho ou texto | importa palavras com tempo (LRC, LRC estendido, SRT ou "tempo PALAVRA" por linha). LRC/SRT = tempo da música |
| `lyricsTimeBase` | auto | força `"song"` ou `"edit"` para o arquivo de `lyrics` |
| `words` | lista | palavras (ver abaixo). Somadas às de `lyrics` |
| `snapToBeats` | `false` | `true` ou distância máx. em s (ex. `0.08`): puxa cada palavra para o onset/beat mais próximo |
| `duration` | auto | duração da edit (auto = última palavra + 1,8 s, limitado pelo áudio) |
| `seed` | `7` | muda todas as escolhas aleatórias do diretor (troque para ver outra versão) |
| `director` | — | ver "Diretor" |
| `shots` | lista | overrides por shot (ver "Shots") |
| `fx` | — | pós-processamento (ver "FX") |
| `quality` | `"final"` | `final`, `preview`, `draft` (o CLI ajusta com `--preview/--draft`) |
| `qualityOverrides` | — | `{ msaa, bloomLevels, particleScale, curveSegments, bevelSegments, geoScale, resScale }` |
| `fadeIn` / `fadeOut` | `0.35` / `0.6` | fade de/para preto em s (`false` desliga) |
| `intro` | — | card 2D de abertura (estilo referências): `{ "title": "NOME", "subtitle": "artista", "until": 2.0, "label": "presents", "bg": "dark", "font": "serif" }` |
| `outro` | — | card de encerramento, mesmos campos + `from` (padrão: últimos 2 s) |
| `cards` | lista | cards 2D em qualquer tempo: `{ from, to, title, subtitle, label, bg: dark/light/transparent, font: serif/cond/bold/round, size, tracking, frame, waveform, typewriter, color }` |
| `start` | `0` | desloca o t do primeiro frame (raro) |

## Palavras (`words[]`)

```jsonc
{ "text": "SWEET", "t": 1.25 }   // mínimo
```

| campo | descrição |
|---|---|
| `text`, `t` | texto e tempo de entrada (onset). `timeBase: "song"` = `t` em tempo da música |
| `accent` | `true` = hero word (maior, outra cor/estilo, entrada especial) |
| `break` | `true` = começa um shot novo nesta palavra |
| `breakAfter` | `true` = fecha o shot depois desta palavra |
| `solo` | `true` = palavra sozinha no shot |
| `line` | número da frase (mudança de `line` quebra shot; vem automático do LRC/SRT) |
| `style` | nome de estilo (abaixo) ou `styleObj` com estilo completo (`{ "base": "candy", "depth": 0.5 }`) |
| `color` | cor de destaque desta palavra (substitui `$accent`) |
| `font` | nome de fonte (abaixo) ou arquivo `.ttf/.otf` na pasta do projeto |
| `size` | multiplicador de tamanho |
| `tracking` | espaçamento entre letras (em cap-height; padrão 0.04) |
| `case` | `upper` (padrão do diretor), `lower`, `asis` |
| `in` / `out` / `idle` | animação de entrada / saída / enquanto visível (listas abaixo) |
| `order` | ordem do stagger por letra: `forward`, `reverse`, `center`, `edges`, `random` |
| `letterLayout` | `line`, `vertical`, `arc`, `ring`, `scatter3d`, `wave` |
| `exit` | tempo em que a palavra começa a sair (padrão: quando a câmera sai do shot) |
| `pos`, `rot` | posição/rotação manual dentro do shot (unidades de cap-height / radianos) |

## Diretor (`director`)

| campo | padrão | descrição |
|---|---|---|
| `energy` | `1.0` | 0.6 calmo (shots longos, transições suaves) … 1.4 frenético (mais cortes, whips curtos, mais shake) |
| `maxWordsPerShot` | 3 (2 se energy>1.15) | máximo de palavras por shot |
| `maxShotDuration` | `2.6/energy` | duração máx. de um shot |
| `case` | `"upper"` | caixa do texto |
| `fov` | `40` | FOV base da câmera (o diretor varia -6..+10) |
| `curviness` | `1` | quanto o caminho da câmera faz curvas entre shots |
| `tilt` | `1` | quanto o texto fica inclinado/rotacionado no espaço |
| `spacing` | `1` | distância entre shots (menor = transições mais curtas, menos vazio no voo) |
| `shake` | do tema | intensidade do shake de câmera (impulsos nos beats/hits) |

## Shots (`shots[]`)

Override por índice (veja os índices com `--plan`):
```jsonc
"shots": [ { "index": 2, "layout": "stack", "style": "holo", "move": "spiral", "transition": "spin", "decor": ["glassRing", "shards"] } ]
```

| campo | descrição |
|---|---|
| `layout` | `single`, `stack` (lockup justificado), `line`, `cascade` (palavras em diagonal na profundidade; câmera segue), e para 1 palavra: `vertical`, `arc`, `ring`, `scatter3d` (anamórfico: letras em profundidades diferentes que só "fecham" a palavra de frente) |
| `style` | estilo de texto do shot |
| `accent`, `accent2`, `accent3` | cores do shot |
| `mood` | `[c1,c2,c3]` cores do fundo neste shot (temas com `moodFollow`) |
| `in`, `out`, `idle` | animações das palavras do shot |
| `move` | movimento de câmera (lista abaixo) |
| `k` | intensidade do movimento (padrão ~1; 1.6 = exagerado) |
| `from`, `to` | pose de câmera manual: `{az, el, dist, roll, fov, tx, ty, tz}` — graus; `dist` multiplica a distância de enquadramento; `tx/ty/tz` deslocam o alvo (em múltiplos da distância) |
| `ease` | easing do movimento dentro do shot |
| `fov`, `zoom` | FOV do shot; `zoom` multiplica a distância (0.8 = mais perto) |
| `follow` | 0..1: quanto a câmera persegue cada palavra nova (padrão cascade 1, line 0.45, stack 0.3) |
| `transition` | transição de ENTRADA neste shot: `whip`, `smooth`, `spin`, `zoom`, `cut` |
| `transitionDur`, `transitionEase`, `arc` | duração (s), easing e curvatura (0..0.5) do voo |
| `flash`, `glitch` | `true` = flash branco / glitch no corte de entrada |
| `decor` | lista de decorações (substitui a escolha do diretor; `[]` = nenhuma) |
| `anchor` | `{pos:[x,y,z], rot:[x,y,z]}` posição do shot no mundo (avançado) |
| `start` | força o início do shot |
| `words` | (avançado) agrupamento explícito: índices das palavras de cada shot — se um shot tiver `words`, todos devem ter |

## Nomes disponíveis

**Estilos de texto** (cores `$accent` etc. vêm do shot):
- escuros / 3D typography: `chrome`, `chromeTint`, `chromeBold`, `neon` (tubo de contorno), `neonTube`, `neonFill` (letra sólida brilhando), `neonDuo` (miolo branco + contorno neon), `glowWhite`, `gradient`, `glossy`, `holo` (iridescente), `outline`, `serif`, `card` (serifada plana p/ intro), `tech`
- candy: `candy`, `candyRainbow` (cada letra de uma cor), `candyWhite`, `bubble`, `gummy`, `candyNeon`

**Fontes** (todas OFL/Apache, em `fonts/`): `anton`, `bebas`, `archivo`, `sixcaps` (condensadas/pesadas) · `titan`, `lilita`, `luckiest`, `chewy`, `bowlby`, `bungee`, `rubikmono` (candy/display) · `righteous`, `audiowide`, `russo`, `blackops`, `monoton` (neon/tech) · `abril`, `dmserif` (serifadas) · `pacifico` (script).

**Animações de entrada** (`in`): `pop`, `popRot`, `drop`, `rise`, `slide`, `flip`, `spin`, `scatter` (letras voam de longe e montam a palavra), `zoom`, `typewriter`, `glitch`, `stretch`, `bounce`, `fade`, `unfold`, `swing`, `neonFlicker`, `trackIn`, `none`.
**Saída** (`out`): `fade`, `scatter`, `explode`, `shrink`, `flyBack`, `flyForward`, `drop`, `collapse`, `glitch`, `none`.
**Idle** (`idle`): `none`, `float`, `wave`, `pulse` (no beat), `shimmer`, `jelly`.

**Movimentos de câmera** (`move`): `push`, `pull`, `orbitL`, `orbitR`, `craneUp`, `craneDown`, `dutch`, `hero` (contra-plongée), `topDown`, `spiral`, `slideL`, `slideR`, `macro` (bem perto, desliza pela palavra), `rollIn`, `static`.

**Transições** (`transition`): `whip` (acelera e freia, com arco e roll), `smooth`, `spin` (barrel roll 360°), `zoom` (punch de FOV), `cut` (+ `flash`/`glitch`).

**Decor** (`decor`): `streakSwirl`, `streakCross`, `streakOrbit` (rastros de luz) · `neonRing`, `glassRing`, `halo`, `tunnel` (anéis no voo até o próximo shot) · `shards` (cristais) · `sparkleBurst` · `lasers` · `grid`, `checker` (chão) · candy: `hearts`, `stars`, `gumballs`, `clouds`, `lollipops`, `donuts`, `pills`, `cubes`.

**Easing**: `linear`, `in|out|inOut` + `Sine|Quad|Cubic|Quart|Quint|Expo|Circ|Back|Elastic|Bounce` (ex. `outExpo`), `spring`, `whip`, `smoothstep`, `smootherstep`, ou cubic-bezier `[x1,y1,x2,y2]` (igual AE/CSS).

## FX (`fx`)

| campo | neon padrão | descrição |
|---|---|---|
| `bloom` | 1.0 | intensidade do glow |
| `bloomThreshold` | 0.95 | a partir de que brilho (HDR) brilha |
| `bloomRadius` | 1.0 | espalhamento |
| `bloomPulse` | 0.3 | bloom extra em cada beat |
| `chromatic` | 0.35 | aberração cromática radial (sutil) |
| `chromaticPulse` | 0.35 | aberração extra nos hits fortes |
| `anamorphic` | 0.22 | streak horizontal de lente nos pontos brilhantes |
| `streakTint` | `#9fd8ff` | cor do streak |
| `vignette`, `grain` | 0.42 / 0.16 | vinheta e grão (o grão também evita banding) |
| `saturation`, `contrast`, `exposure` | 1.14 / 1.06 / 1.0 | grading |
| `lift`, `gain` | `[0,0,0]` / `[1,1,1]` | grading por canal |
| `tonemap` | `aces` | `aces` (neon), `neutral` (candy, preserva pastel), `none` |
| `letterbox` | 0 | barras cinema (0.12 = 2.39:1 aprox.) |
| `flashes` | `[]` | flashes manuais: `[2.5, {"t": 6.0, "decay": 0.2, "amount": 0.7}]` |
| `bgPulse` | 0.4 | fundo pulsa no beat |
| `letterFlash` | 1 (candy 0.2) | brilho branco quando cada letra entra |
| `speedLines` | 0 (candy 0.7) | linhas radiais de velocidade (anime) durante as transições; `speedColor` |

## Temas (resumo)

| tema | visual |
|---|---|
| `neon` | nebula colorida escura, cromado/neon/glow/holo, rastros, anéis, cristais (estilo 3D Typography Edit) |
| `chrome` | preto, cromado branco, bokeh quente, streak anamórfico forte, lockups empilhados |
| `candy` | fundo rosa pastel com bolinhas, letras 3D glossy saturadas + contorno branco + sombra, corações/balas/nuvens/confete |
| `candyNight` | candy em fundo escuro "dream" com neon, corações brilhando |
| `ice` / `inferno` / `sunset` | variações de paleta (gelo, fogo, synthwave com chão grid) |

## Exemplo completo comentado

Veja `projects/_template/scene.json`, `projects/demo-neon/scene.json` e `projects/demo-candy/scene.json`.
