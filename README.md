# ⚔️ ELDORIA — O Último Amanhecer

Um RPG de mundo aberto 3D que roda **100% offline no navegador** (PC e Android), sem
instalação e sem dependências externas. Construído com Three.js (r128), HTML, CSS e
JavaScript puro. Áudio e modelos 3D são gerados proceduralmente — zero assets externos.

## ▶️ Como jogar

**Opção A — arquivo único (mais simples):**
Abra **`eldoria-standalone.html`** no navegador. É só isso. Tudo está embutido nesse
único arquivo.

**Opção B — versão modular:**
Abra **`index.html`**. Requer que a pasta `src/` esteja ao lado dele (com os 12 `.js`).

> Dica: se abrir `index.html` direto do disco (`file://`) e a tela ficar preta, use a
> versão standalone, ou sirva a pasta com um servidor local:
> `python3 -m http.server` e acesse `http://localhost:8000`.

## 🎮 Controles

**PC:** WASD mover · Shift correr · Ctrl agachar · Espaço pular · Mouse olhar ·
Botão esquerdo atacar · Botão direito bloquear · Q esquivar · E interagir · R magia ·
F tocha · H assobiar pet · 1–5 atalhos · Tab inventário · M mapa · J missões ·
K habilidades · P companheiros · C ficha · B criação · Esc menu.

**Mobile:** joystick virtual (esquerda) · arrastar (direita) para olhar · botões de ação.

## ✨ Recursos

- Mundo procedural enorme: florestas, montanhas, rios, lagos, pântanos, praias, cavernas
- Ciclo dia/noite completo + clima dinâmico (chuva, tempestade, neve, névoa, relâmpagos)
- 9 vilarejos, castelo, ruínas, acampamentos, fazendas, naufrágio e o Círculo das Luas
- Criação de personagem com preview 3D
- Combate: espadas, machados, lanças, arcos, bestas, magias, bloqueio, esquiva, combos, chefes
- Sobrevivência: fome, sede, temperatura, doenças, pesca, caça, fogueiras
- NPCs com rotina diária, memória e reputação; guardas que reagem a crimes
- Pets adotáveis (cão, gato, lobo, raposa, papagaio, coruja) com níveis e evolução
- Cavalos: capturar, domar, nomear, montar, galopar
- Progressão: níveis, XP, 4 árvores de habilidade, 16 conquistas
- Economia: lojas, ferraria, alquimista, casa de leilões, crafting
- Campanha ramificada em 6 atos com **3 finais diferentes** + 8 missões secundárias
- Save/load em localStorage com auto-save

## 📁 Estrutura

```
eldoria/
├── eldoria-standalone.html   # versão de arquivo único (recomendada p/ abrir local)
├── index.html                # versão modular
└── src/
    ├── three.min.js          # Three.js r128 (UMD)
    ├── utils.js              # estado global, helpers, ruído procedural
    ├── audio.js              # áudio procedural (WebAudio)
    ├── items.js              # itens, receitas, loot, lojas
    ├── world.js              # geração do mundo, terreno, estruturas
    ├── sky.js                # céu, clima, ciclo dia/noite
    ├── entities.js           # NPCs, animais, inimigos, pets, cavalos
    ├── player.js             # jogador, movimento, combate, sobrevivência
    ├── quests.js             # missões e finais
    ├── ui.js                 # HUD, menus, mapa, diálogos
    ├── input.js              # teclado, mouse, toque
    └── game.js               # loop principal, câmera, interações
```

## 🛠️ Desenvolvimento

Não há build step — é JavaScript puro. Para editar, mexa nos arquivos em `src/` e
recarregue `index.html`. Para regenerar o arquivo único depois de editar:

```bash
node build_standalone.js
```

## Licença

Three.js © 2010–2021 Three.js Authors (MIT). Código do jogo: use como quiser.
