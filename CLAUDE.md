# CLAUDE.md — Contexto do projeto ELDORIA

Este arquivo orienta o Claude Code ao trabalhar neste repositório. Leia-o antes de editar.

## O que é

**ELDORIA — O Último Amanhecer** é um RPG de mundo aberto 3D que roda **100% offline no
navegador** (PC e Android). Stack: **JavaScript puro + Three.js r128 (UMD)**. Sem build
step, sem framework, sem bundler, sem npm em runtime. Áudio e modelos 3D são **gerados
proceduralmente** — não há assets externos (nenhuma imagem, som ou modelo em arquivo).

Idioma do jogo e dos textos de UI: **português (pt-BR)**. Comentários no código também.

## Como rodar / testar

- Abrir `eldoria-standalone.html` no navegador (arquivo único, tudo embutido). **É a forma
  recomendada de testar rápido**, porque não depende da pasta `src/` nem de servidor.
- Ou abrir `index.html` (versão modular) — precisa da pasta `src/` ao lado. Se `file://`
  bloquear, sirva com `python3 -m http.server` e acesse `http://localhost:8000`.
- Não há testes unitários no repo. Durante o desenvolvimento original usou-se um "smoke
  test" headless com jsdom + um **stub do THREE** para validar que tudo carrega, o mundo
  gera, N frames simulam sem erro, painéis renderizam e save/load funciona. Esses
  artefatos (`smoke.js`, `node_modules/`, `package.json`) **não são versionados** (ver
  `.gitignore`). Se precisar recriar um smoke test, lembre que o stub do THREE precisa
  implementar: `Vector3` (com `project`, `setScalar`, etc.), `Matrix4.clone`, materiais
  cujo `color`/`emissive` sejam objetos com `setHSL/lerp/set`, atributos de geometria com
  `getX/getY/getZ/setXYZ`, `Object3D.add` retornando `this`, e `shadow.mapSize.set`.

## Regenerar o arquivo único

Depois de editar qualquer coisa em `src/`, rode:

```bash
node build_standalone.js
```

Isso concatena `src/three.min.js` + os 11 módulos (na ordem correta) num único
`<script>` e injeta em `eldoria-standalone.html`, preservando o HTML/CSS e o `<script>`
inline final. **Sempre regenere o standalone após mudar o código-fonte**, senão as duas
versões divergem.

## Arquitetura

Tudo compartilha **um único escopo global** (como `<script>` clássicos). Não há
`import`/`export`. Objetos globais principais, todos definidos em `src/utils.js` ou no
topo do seu módulo:

- `G` — estado global do jogo (`state`, `scene`, `camera`, `renderer`, `player`, `time`,
  `flags`, `rep`, `discovered`, `achievements`, `stats`, `quality`, `isMobile`, ...).
- `INPUT` — entrada unificada (movimento, olhar, flags de ação pontuais, `consume()`).
- `AUDIO` — áudio procedural WebAudio.
- `ITEMS`, `RECIPES`, `LOOT`, `SHOPS` — dados de itens/economia (`src/items.js`).
- `WORLD` — mundo e geração procedural (`src/world.js`).
- `ENV` — instância de `Environment` (céu/clima/ciclo dia-noite), criada em `_buildWorld`.
- `ENT` — gerenciador de entidades (`all`, `add`, `remove`, `populate`, `update`, ...).
- `QUESTS` — campanha, secundárias, finais.
- `UI` — HUD, painéis, mapa, diálogos, toasts.
- `CONTROLS` — bind de teclado/mouse/toque.
- `GAME` — orquestração: `boot`, `showTitle`, `showCreator`, `_buildWorld`, `loop`,
  `updateCamera`, `handleInteract`, diálogos, comércio, crafting, save/load.

### Ordem de carregamento (crítica — mantê-la)

```
three.min.js → utils.js → audio.js → items.js → world.js → sky.js →
entities.js → player.js → quests.js → ui.js → input.js → game.js
```

`game.js` chama `GAME.boot()` no `DOMContentLoaded`. Se adicionar um módulo novo,
insira a tag `<script>` em `index.html` **e** a entrada em `build_standalone.js`.

### Fluxo de execução

`boot()` (renderer/scene/camera + `UI.init` + `CONTROLS.init`) → `showTitle()` →
`showCreator()` → `startWorld()` → `_buildWorld()` (chama `initWorld()`, cria `Player`,
`ENV`, `ENT.populate()`, `QUESTS.start()`) → `loop()` roda a cada frame:
avança tempo do mundo, `player.update`, `ENT.update`, `ENV.update`, partículas,
pickups, água, chunks, descobertas, câmera, HUD, `render`.

### Mundo

`WORLD.extent = 2200` (mapa ~4400×4400). Terreno por **ruído procedural** (`rawHeight`,
`fbm`, `noise2`). Streaming por **chunks** (`ensureChunks`, classe `Chunk`) com 1
chunk/frame. Cavernas ficam na região `z > 5000` (salas em `z ≈ 8000`), acessadas por
portais de teleporte. Estruturas (vilas, castelo, ruínas, etc.) são construídas com
primitivas (`box`, `cyl`) e `InstancedMesh` para vegetação.

### Entidades

Hierarquia em `src/entities.js`: `Entity` (base) → `Animal`, `Bird`, `Enemy`, `NPC`,
`Horse extends Animal`, `Pet`. Modelos low-poly montados com `makeHumanoid`,
`makeQuadruped`, `makeBird`. Colisão compartilhada via `resolveCollide` +
grades espaciais (`queryColliders`, `queryInteract`).

## Convenções e restrições

- **Three.js é r128.** NÃO use APIs mais novas: sem `CapsuleGeometry` (use
  `CylinderGeometry`+`SphereGeometry`), sem `OrbitControls`, sem
  `BufferGeometryUtils.mergeBufferGeometries` (há um `mergeGeo` manual em `world.js`),
  sem WebGPU. Antes de usar uma API do THREE, confirme que existe em r128.
- **Zero assets externos.** Não referencie imagens, fontes web, sons ou modelos em
  arquivo. Tudo procedural. Áudio via `AUDIO` (WebAudio). Texturas via `CanvasTexture`
  desenhadas em runtime.
- **Offline-first.** Nada de CDN nem `fetch` de rede em runtime. `localStorage` é usado
  para save (`chave 'eldoria_save'`) e é válido aqui porque é um HTML standalone local.
- **Mobile importa.** `G.isMobile` reduz qualidade (sombras off, ondas off, menos
  partículas, pixel ratio menor). Controles de toque em `input.js`. Mantenha os dois
  caminhos (PC e toque) funcionando.
- **IDs do DOM** referenciados por `ui.js`/`input.js`/`game.js` precisam existir no
  `index.html`. Se adicionar um elemento de HUD, adicione o `<div id="...">` no HTML e o
  CSS correspondente. (Um bug real já ocorreu por faltar `<div id="toast">`.)
- **Ações pontuais** usam flags em `INPUT` (ex.: `jumpP`, `attackP`) que são zeradas por
  `INPUT.consume()` ao fim de cada frame. Não confie no estado entre frames sem isso.
- **Determinismo:** a geração do mundo usa `G.seed` e RNG `mulberry32`. `planWorld` é
  determinístico. Ao salvar/carregar, o `seed` é persistido para regenerar o mesmo mundo.

## Estado atual

Jogo **completo e funcional**. Todos os sistemas do escopo original implementados:
mundo/gráficos/clima, criação de personagem, movimento, combate, sobrevivência, NPCs com
IA/rotina, animais, pets, cavalos, inventário/craft/economia, progressão/skills/conquistas,
missões (campanha ramificada com 3 finais + 8 secundárias), UI PC+mobile, som procedural,
save/load. Validado por smoke test headless.

Bugs já corrigidos nesta base: `<div id="toast">` ausente no HTML; `tameHorse` adicionando
cavalo duplicado (agora tem guarda `if (h.owned) return`); código pendente `.children` em
`makeHumanoid`.

## Ideias de próximos passos (se pedirem)

- Balanceamento (dificuldade, velocidade do tempo `G.time.speed`, preços em `items.js`).
- Mais conteúdo: novos chefes/biomas/missões (padrões existentes em `entities.js`,
  `world.js`, `quests.js`).
- Tela de opções expandida, rebind de teclas, mais idiomas.
- PWA/manifest para "instalar" no celular (mantendo offline).

## Dicas ao editar

- Depois de qualquer mudança em `src/`, rode `node build_standalone.js` e teste os DOIS
  arquivos (`index.html` e `eldoria-standalone.html`).
- `node --check src/<arquivo>.js` valida sintaxe rápido antes de abrir no navegador.
- Erros de runtime só aparecem no **console do navegador (F12)** — o stub headless pega
  erros de lógica/referência, mas não problemas de render WebGL.
