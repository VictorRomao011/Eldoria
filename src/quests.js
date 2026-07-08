/* =====================================================================
   quests.js — Missões principais, secundárias e finais múltiplos
   ===================================================================== */
'use strict';

const QUESTS = {
  main: 0,               /* progresso da campanha */
  active: [],            /* missões secundárias ativas */
  completed: {},
  choices: {},           /* escolhas que ramificam a história */
  ending: null,

  /* ----- campanha principal (O Último Amanhecer) ----- */
  mainSteps: [
    { id: 'm0', title: 'O Despertar', desc: 'Fale com a Anciã Mira em Eldervale.', hint: 'Procure a Anciã Mira (⭐) na praça da vila inicial.' },
    { id: 'm1', title: 'Sombras Crescentes', desc: 'Investigue as Ruínas de Kareth e derrote o que habita lá.', hint: 'As ruínas ficam marcadas no mapa após descobertas. Cuidado com o Rei Esqueleto.' },
    { id: 'm2', title: 'O Fragmento', desc: 'Leve o Fragmento do Eclipse ao Lorde Aldric no castelo.', hint: 'Vá ao Castelo de Aldric (🏰).' },
    { id: 'm3', title: 'A Ameaça das Estradas', desc: 'Confronte Garrick, o Lorde Bandido, em seu acampamento.', hint: 'Decida o destino de Garrick — você pode lutar ou poupá-lo.' },
    { id: 'm4', title: 'Coração da Montanha', desc: 'Encontre a Ursa Anciã nas profundezas de uma caverna.', hint: 'Entre na Caverna do Uivo e derrote a Ursa Anciã para obter a segunda relíquia.' },
    { id: 'm5', title: 'O Último Amanhecer', desc: 'Retorne ao Círculo das Luas ao amanhecer para o ritual final.', hint: 'Reúna as relíquias e vá ao Círculo das Luas entre 5h e 7h.' },
  ],

  /* ----- catálogo de secundárias ----- */
  sideDefs: {
    caca: { title: 'Fornecimento de Caça', giver: 'mercador', desc: 'Entregue 3 de Carne Crua ao açougueiro.', need: { carne_crua: 3 }, reward: { gold: 40, xp: 40 }, repeat: true },
    ervas: { title: 'Colheita de Ervas', giver: 'alquimista', desc: 'Colha 5 Erva-do-Sol para o alquimista.', need: { erva: 5 }, reward: { gold: 35, xp: 50, item: ['pocao_hp', 2] }, repeat: true },
    lobos: { title: 'Praga de Lobos', giver: 'guarda', desc: 'Elimine 4 lobos que ameaçam a vila.', kills: { lobo: 4 }, reward: { gold: 60, xp: 70 } },
    minerio: { title: 'Encomenda do Ferreiro', giver: 'ferreiro', desc: 'Traga 4 Minérios de Ferro.', need: { ferro: 4 }, reward: { gold: 55, xp: 45, item: ['espada_ferro', 1] } },
    prisioneiro: { title: 'O Escoteiro Cativo', giver: 'mira', desc: 'Liberte o Escoteiro Bren no acampamento de bandidos.', reward: { gold: 80, xp: 90 } },
    pesca: { title: 'Banquete do Pescador', giver: 'geral', desc: 'Pesque e cozinhe 3 peixes.', need: { peixe: 3 }, reward: { gold: 50, xp: 55 } },
    perdido: { title: 'Viajante Perdido', giver: 'perdido', desc: 'Escolte o viajante de volta a uma vila.', reward: { gold: 45, xp: 40 } },
    tesouro: { title: 'Mapa do Tesouro', giver: 'geral', desc: 'Siga o Mapa do Tesouro até o local marcado.', reward: { gold: 120, xp: 80, item: ['gema', 2] } },
  },

  start() {
    this.setMain(0);
  },
  serialize() { return { main: this.main, active: this.active, completed: this.completed, choices: this.choices, ending: this.ending }; },
  load(d) { if (!d) return; Object.assign(this, d); UI.refreshQuests(); },

  setMain(n) {
    this.main = n;
    const s = this.mainSteps[n];
    if (s) { UI.toast('📜 ' + s.title, 'gold'); AUDIO.play('quest'); }
    UI.refreshQuests();
  },

  addSide(key, giverVillage) {
    if (this.active.find(q => q.key === key)) return false;
    const def = this.sideDefs[key];
    if (!def) return false;
    const q = { key, title: def.title, desc: def.desc, progress: {}, village: giverVillage, tx: null };
    if (key === 'tesouro') {
      /* escolhe um local aleatório para o tesouro */
      const a = rand(0, TAU), d = rand(200, 600);
      q.tx = clamp(G.player.pos.x + Math.cos(a) * d, -WORLD.extent + 50, WORLD.extent - 50);
      q.tz = clamp(G.player.pos.z + Math.sin(a) * d, -WORLD.extent + 50, WORLD.extent - 50);
      invAdd(G.player.inv, 'mapa_tesouro', 1);
    }
    if (key === 'perdido') { q.escortFrom = { x: G.player.pos.x, z: G.player.pos.z }; }
    this.active.push(q);
    UI.toast('📜 Missão aceita: ' + def.title, 'gold');
    AUDIO.play('quest');
    UI.refreshQuests();
    return true;
  },

  /* eventos vindos do jogo (kill, gather, discover, etc.) */
  event(type, data) {
    /* progresso da campanha por marcos */
    if (type === 'kill') {
      if (data.id === 'rei' && this.main === 1) this.advanceMain();
      if (data.id === 'garrick' && this.main === 3) { this.choices.garrick = 'morto'; this.advanceMain(); }
      if (data.id === 'ursa' && this.main === 4) this.advanceMain();
    }
    /* secundárias baseadas em kills */
    for (const q of this.active) {
      const def = this.sideDefs[q.key];
      if (def.kills && type === 'kill' && def.kills[data.kind]) {
        q.progress[data.kind] = (q.progress[data.kind] || 0) + 1;
        UI.refreshQuests();
        this.checkComplete(q);
      }
    }
    if (type === 'discover') UI.refreshQuests();
    if (type === 'gather' || type === 'craft' || type === 'cook') this.checkAllTurnins(false);
  },

  checkAllTurnins(silent) {
    for (const q of this.active) this.checkComplete(q, silent);
  },
  canComplete(q) {
    const def = this.sideDefs[q.key];
    if (def.need) for (const id in def.need) if (invCount(G.player.inv, id) < def.need[id]) return false;
    if (def.kills) for (const k in def.kills) if ((q.progress[k] || 0) < def.kills[k]) return false;
    if (q.key === 'prisioneiro' && !G.flags.brenFreed) return false;
    if (q.key === 'perdido' && !q.delivered) return false;
    if (q.key === 'tesouro' && !q.dug) return false;
    return true;
  },
  checkComplete(q, silent) { /* apenas marca; entrega é feita ao falar com quem deu */ },

  complete(q) {
    const def = this.sideDefs[q.key];
    if (!this.canComplete(q)) return false;
    if (def.need) for (const id in def.need) invRemove(G.player.inv, id, def.need[id]);
    const r = def.reward;
    if (r.gold) { G.player.gold += r.gold; }
    if (r.xp) G.player.gainXP(r.xp);
    if (r.item) invAdd(G.player.inv, r.item[0], r.item[1]);
    this.active.splice(this.active.indexOf(q), 1);
    this.completed[q.key] = (this.completed[q.key] || 0) + 1;
    G.stats.quests++;
    if (G.stats.quests >= 10) unlock('heroi');
    AUDIO.play('questDone');
    UI.toast('✅ Missão concluída: ' + def.title + '  (+' + (r.gold || 0) + '🪙)', 'gold');
    UI.refreshQuests();
    return true;
  },

  advanceMain() {
    this.completed['main_' + this.main] = true;
    G.player.gainXP(120);
    G.player.gold += 100;
    AUDIO.play('questDone');
    if (this.main < this.mainSteps.length - 1) this.setMain(this.main + 1);
    else this.setMain(this.main);
    UI.refreshQuests();
  },

  /* chamada quando o jogador chega ao ritual final */
  triggerEnding() {
    /* determina final pelas escolhas */
    const g = this.choices.garrick;
    const spared = g === 'poupado';
    const rep = Object.values(G.rep).reduce((a, b) => a + b, 0);
    let ending;
    if (spared && rep >= 0) ending = 'harmonia';
    else if (!spared && rep < -20) ending = 'tirania';
    else ending = 'guardião';
    this.ending = ending;
    G.flags.eclipseBeaten = true;
    unlock('eclipse');
    UI.showEnding(ending);
  },
};
