/* =====================================================================
   ui.js — Toda a interface: HUD, menus, diálogos, lojas, mapa, etc.
   ===================================================================== */
'use strict';

const UI = {
  el: {}, dmgNums: [], _toastT: 0, activePanel: null,

  init() {
    ['hud', 'toast', 'interact', 'crosshair', 'compass', 'minimap', 'vignette',
     'panel', 'panelBody', 'panelTitle', 'dialog', 'floaters', 'bossbar', 'bossName', 'bossFill',
     'controlsMobile', 'hotbar', 'petbar', 'clock', 'weatherIcon', 'questTracker'].forEach(id => this.el[id] = document.getElementById(id));
    this.mmCtx = this.el.minimap.getContext('2d');
    this.bindHUDButtons();
  },

  bindHUDButtons() {
    document.querySelectorAll('[data-panel]').forEach(b => {
      b.onclick = () => { AUDIO.play('ui'); this.togglePanel(b.dataset.panel); };
    });
  },

  /* ---------------- notificações ---------------- */
  toast(msg, kind) {
    const d = document.createElement('div');
    d.className = 'toast-item' + (kind ? ' toast-' + kind : '');
    d.textContent = msg;
    this.el.toast.appendChild(d);
    requestAnimationFrame(() => d.classList.add('show'));
    setTimeout(() => { d.classList.remove('show'); setTimeout(() => d.remove(), 400); }, 3400);
    while (this.el.toast.children.length > 5) this.el.toast.removeChild(this.el.toast.firstChild);
  },

  damageNum(x, y, z, val, color) {
    this.dmgNums.push({ x, y, z, val, color: color || '#fff', t: 1, vy: 1.4 });
  },
  floatXP(n) { this.toast('+' + n + ' XP'); },
  hurtVignette() { this.el.vignette.style.opacity = '0.7'; setTimeout(() => this.el.vignette.style.opacity = '0', 120); },

  bearing(dx, dz) {
    const a = Math.atan2(dx, dz);
    const dirs = ['Norte', 'Nordeste', 'Leste', 'Sudeste', 'Sul', 'Sudoeste', 'Oeste', 'Noroeste'];
    return dirs[Math.round(((a < 0 ? a + TAU : a) / TAU) * 8) % 8];
  },

  /* ---------------- barras e status do HUD ---------------- */
  refreshBars() {
    const p = G.player; if (!p) return;
    const set = (id, v, mx) => { const e = document.getElementById(id); if (e) e.style.width = clamp(v / mx * 100, 0, 100) + '%'; };
    set('bar-hp', p.hp, p.maxhp); set('bar-stam', p.stam, p.maxstam); set('bar-mana', p.mana, p.maxmana);
    set('bar-hunger', p.hunger, 100); set('bar-thirst', p.thirst, 100);
    document.getElementById('num-hp').textContent = Math.ceil(p.hp) + '/' + p.maxhp;
    const tempEl = document.getElementById('temp-icon');
    if (tempEl) tempEl.textContent = p.temp < 15 ? '🥶' : (p.temp > 90 ? '🥵' : '🌡️');
    /* ícones de doença */
    const de = document.getElementById('disease-icons');
    if (de) {
      let s = '';
      if (p.diseases.veneno > 0) s += '🟢';
      if (p.diseases.sangrando > 0) s += '🩸';
      if (p.diseases.resfriado > 0) s += '🤧';
      de.textContent = s;
    }
  },
  refreshStats() {
    const p = G.player; if (!p) return;
    document.getElementById('lvl-badge').textContent = p.level;
    const xe = document.getElementById('bar-xp');
    if (xe) xe.style.width = (p.xp / p.xpNext * 100) + '%';
    document.getElementById('gold-count').textContent = p.gold;
    const sp = document.getElementById('skillpoint-dot');
    if (sp) sp.style.display = p.skillPoints > 0 ? 'block' : 'none';
    this.refreshBars();
  },

  refreshHotbar() {
    const p = G.player; if (!p) return;
    const bar = this.el.hotbar; bar.innerHTML = '';
    const slots = [
      { key: 'weapon', label: 'Arma' },
      { key: 'offhand', label: 'Mão sec.' },
      { key: 'spell', label: 'Magia', special: true },
    ];
    /* consumíveis rápidos */
    const potion = p.inv.find(s => ITEMS[s.id].t === 'pocao' && ITEMS[s.id].hp);
    const food = p.inv.find(s => ITEMS[s.id].t === 'comida' && !ITEMS[s.id].raw);
    const html = [];
    const w = p.equip.weapon ? ITEMS[p.equip.weapon] : null;
    html.push(`<div class="hslot" data-h="weapon"><span class="hicon">${w ? w.i : '✊'}</span></div>`);
    const of = p.equip.offhand ? ITEMS[p.equip.offhand] : null;
    html.push(`<div class="hslot" data-h="offhand"><span class="hicon">${of ? of.i : '—'}</span></div>`);
    const spellIcons = { gelo: '❄️', fogo: '🔥', cura: '💚' };
    html.push(`<div class="hslot" data-h="spell"><span class="hicon">${spellIcons[p.spell]}</span></div>`);
    html.push(`<div class="hslot" data-h="potion"><span class="hicon">${potion ? ITEMS[potion.id].i : '🧪'}</span><span class="hqty">${potion ? potion.q : 0}</span></div>`);
    html.push(`<div class="hslot" data-h="food"><span class="hicon">${food ? ITEMS[food.id].i : '🍖'}</span><span class="hqty">${food ? food.q : 0}</span></div>`);
    bar.innerHTML = html.join('');
    bar.querySelector('[data-h="potion"]').onclick = () => { if (potion) GAME.useItem(potion.id); };
    bar.querySelector('[data-h="food"]').onclick = () => { if (food) GAME.useItem(food.id); };
    bar.querySelector('[data-h="spell"]').onclick = () => this.cycleSpell();
    bar.querySelector('[data-h="weapon"]').onclick = () => this.togglePanel('inv');
    bar.querySelector('[data-h="offhand"]').onclick = () => this.togglePanel('inv');
  },
  cycleSpell() {
    const p = G.player;
    const avail = ['gelo'];
    if (p.has('chamas')) avail.push('fogo');
    if (p.has('cura')) avail.push('cura');
    const i = avail.indexOf(p.spell);
    p.spell = avail[(i + 1) % avail.length];
    this.refreshHotbar();
    AUDIO.play('ui');
    this.toast('Magia: ' + { gelo: '❄️ Estilhaço de Gelo', fogo: '🔥 Bola de Fogo', cura: '💚 Cura' }[p.spell]);
  },

  /* ---------------- prompt de interação ---------------- */
  setInteract(target, isEntity) {
    if (!target) { this.el.interact.style.display = 'none'; return; }
    let label = target.label || (target.name ? 'Falar com ' + target.name : 'Interagir');
    if (isEntity) {
      if (target instanceof Horse) label = target.owned ? ('Montar ' + (target.hname || 'cavalo')) : 'Acalmar cavalo selvagem';
      else if (target instanceof Pet) label = target.adoptable && !target.owner ? ('Adotar ' + target.kind) : ('Cuidar de ' + (target.pname || target.kind));
      else if (target instanceof NPC) label = 'Falar com ' + target.name;
    }
    this.el.interact.querySelector('.itxt').textContent = label;
    this.el.interact.style.display = 'flex';
  },

  /* ---------------- painel genérico ---------------- */
  togglePanel(name) {
    if (this.activePanel === name) return this.closePanel();
    this.openPanel(name);
  },
  openPanel(name, arg) {
    this.activePanel = name;
    G.paused = (name !== 'map');
    this.el.panel.style.display = 'flex';
    const titles = { inv: '🎒 Inventário', craft: '🔨 Criação', quests: '📜 Missões', map: '🗺️ Mapa do Mundo', skills: '✨ Habilidades', pets: '🐾 Companheiros', stats: '📊 Personagem', menu: '⚙️ Menu' };
    this.el.panelTitle.textContent = titles[name] || '';
    const r = { inv: () => this.renderInv(), craft: () => this.renderCraft(arg), quests: () => this.renderQuests(), map: () => this.renderMap(), skills: () => this.renderSkills(), pets: () => this.renderPets(), stats: () => this.renderCharStats(), menu: () => this.renderMenu() };
    if (r[name]) r[name]();
    AUDIO.play('open');
  },
  closePanel() {
    this.activePanel = null; G.paused = false;
    this.el.panel.style.display = 'none';
    if (this._mapRAF) { cancelAnimationFrame(this._mapRAF); this._mapRAF = null; }
  },

  /* ---------------- inventário ---------------- */
  renderInv() {
    const p = G.player;
    const cap = 60 + (p.equip.armor === 'placas' ? 20 : 0);
    const w = invWeight(p.inv);
    let h = `<div class="inv-head">
      <div>Peso: <b class="${w > cap ? 'over' : ''}">${fmtWeight(w)} / ${cap} kg</b></div>
      <div>🪙 ${p.gold}</div></div>`;
    /* equipamento atual */
    h += `<div class="equip-row">
      <div class="equip-slot"><small>Arma</small><span>${p.equip.weapon ? ITEMS[p.equip.weapon].i + ' ' + ITEMS[p.equip.weapon].n : '—'}</span></div>
      <div class="equip-slot"><small>Mão sec.</small><span>${p.equip.offhand ? ITEMS[p.equip.offhand].i + ' ' + ITEMS[p.equip.offhand].n : '—'}</span></div>
      <div class="equip-slot"><small>Armadura</small><span>${p.equip.armor ? ITEMS[p.equip.armor].i + ' ' + ITEMS[p.equip.armor].n : '—'}</span></div>
      <div class="equip-slot"><small>Amuleto</small><span>${p.equip.amulet ? ITEMS[p.equip.amulet].i + ' ' + ITEMS[p.equip.amulet].n : '—'}</span></div>
    </div><div class="inv-grid">`;
    const sorted = p.inv.slice().sort((a, b) => {
      const order = ['arma', 'arco', 'magiafoco', 'escudo', 'armadura', 'amuleto', 'luz', 'pocao', 'comida', 'bebida', 'ferramenta', 'material', 'especial'];
      return order.indexOf(ITEMS[a.id].t) - order.indexOf(ITEMS[b.id].t);
    });
    if (!sorted.length) h += '<p class="dim">Vazio.</p>';
    sorted.forEach(s => {
      const it = ITEMS[s.id];
      const equipped = Object.values(p.equip).includes(s.id);
      h += `<div class="inv-item ${it.lend ? 'legendary' : ''} ${equipped ? 'equipped' : ''}" data-id="${s.id}">
        <span class="ii-icon">${it.i}</span>
        <span class="ii-qty">${s.q > 1 ? s.q : ''}</span>
        <div class="ii-tip"><b>${it.n}</b><br>${this.itemTip(it)}<br><small>Peso ${it.w}kg · ${it.v}🪙</small></div>
      </div>`;
    });
    h += '</div>';
    this.el.panelBody.innerHTML = h;
    this.el.panelBody.querySelectorAll('.inv-item').forEach(el => {
      el.onclick = () => { GAME.useItem(el.dataset.id); this.renderInv(); };
    });
  },
  itemTip(it) {
    const parts = [];
    if (it.dmg) parts.push('Dano ' + it.dmg);
    if (it.def) parts.push('Defesa ' + it.def);
    if (it.warm) parts.push('Calor +' + it.warm);
    if (it.food) parts.push('Fome +' + it.food);
    if (it.water) parts.push('Sede +' + it.water);
    if (it.hp) parts.push('Vida +' + it.hp);
    if (it.stam) parts.push('Vigor +' + it.stam);
    if (it.mana) parts.push('Mana +' + it.mana);
    if (it.raw) parts.push('⚠️ cru');
    const tips = { arma: 'Clique para equipar', arco: 'Clique para equipar', magiafoco: 'Clique para equipar', escudo: 'Equipar na mão secundária', armadura: 'Clique para vestir', amuleto: 'Clique para usar', luz: 'Equipar tocha', comida: 'Clique para comer', bebida: 'Clique para beber', pocao: 'Clique para usar' };
    return (parts.join(' · ') || tips[it.t] || '') + (tips[it.t] && parts.length ? '<br>' + tips[it.t] : '');
  },

  /* ---------------- criação ---------------- */
  renderCraft(station) {
    const p = G.player;
    let h = `<p class="dim">${station ? 'Estação: ' + (station === 'fogueira' ? '🔥 Fogueira' : '⚒️ Bigorna') : 'Criação de mão. Aproxime-se de uma fogueira ou bigorna para mais receitas.'}</p><div class="craft-list">`;
    RECIPES.forEach(rc => {
      const where = rc.where;
      const available = where === null || where === station || (where === 'fogueira' && station === 'bigorna');
      if (!available) return;
      const can = Object.keys(rc.need).every(id => invCount(p.inv, id) >= rc.need[id]);
      const outDef = rc.out ? ITEMS[rc.out] : { i: rc.i, n: rc.n };
      const needStr = Object.keys(rc.need).map(id => `${ITEMS[id].i}${rc.need[id]} <small class="${invCount(p.inv, id) >= rc.need[id] ? 'ok' : 'no'}">(${invCount(p.inv, id)})</small>`).join(' ');
      h += `<div class="craft-row ${can ? '' : 'locked'}" data-r="${rc.id}">
        <span class="cr-icon">${outDef.i}</span>
        <div class="cr-mid"><b>${outDef.n}${rc.outQ ? ' ×' + rc.outQ : ''}</b><div class="cr-need">${needStr}</div></div>
        <button class="cr-btn" ${can ? '' : 'disabled'}>Criar</button>
      </div>`;
    });
    h += '</div>';
    this.el.panelBody.innerHTML = h;
    this.el.panelBody.querySelectorAll('.craft-row').forEach(el => {
      el.querySelector('.cr-btn').onclick = () => { GAME.craft(el.dataset.r, station); this.renderCraft(station); };
    });
  },

  /* ---------------- lojas ---------------- */
  openShop(npc) {
    this.activePanel = 'shop'; G.paused = true;
    this.el.panel.style.display = 'flex';
    this.el.panelTitle.textContent = { geral: '🛒 Loja Geral', ferreiro: '⚒️ Ferraria', alquimista: '⚗️ Alquimista', cacador: '🏹 Caçador', estabulo: '🐴 Estábulo', leiloeiro: '🎪 Casa de Leilões' }[npc.shopType] || '🛒 Mercado';
    npc._stock = npc._stock || shopStock(npc.shopType, G.time.day);
    this._shopNPC = npc; this._shopTab = 'buy';
    this.renderShop();
    AUDIO.play('open');
  },
  renderShop() {
    const p = G.player, npc = this._shopNPC;
    let h = `<div class="shop-head"><div>🪙 ${p.gold}</div>
      <div class="shop-tabs"><button class="${this._shopTab === 'buy' ? 'on' : ''}" data-t="buy">Comprar</button><button class="${this._shopTab === 'sell' ? 'on' : ''}" data-t="sell">Vender</button></div></div><div class="shop-list">`;
    if (this._shopTab === 'buy') {
      npc._stock.forEach((s, i) => {
        if (s.q <= 0) return;
        const it = ITEMS[s.id], price = priceBuy(s.id, s.mult);
        h += `<div class="shop-row ${it.lend ? 'legendary' : ''}" data-buy="${i}">
          <span class="sr-icon">${it.i}</span>
          <div class="sr-mid"><b>${it.n}</b><br><small>${this.itemTip(it)}</small></div>
          <div class="sr-right"><b class="${p.gold >= price ? '' : 'no'}">${price}🪙</b><span class="sr-stock">×${s.q}</span></div>
        </div>`;
      });
    } else {
      const sellable = p.inv.filter(s => !Object.values(p.equip).includes(s.id) && ITEMS[s.id].v > 0 && !ITEMS[s.id].lend);
      if (!sellable.length) h += '<p class="dim">Nada para vender aqui.</p>';
      sellable.forEach(s => {
        const it = ITEMS[s.id], price = priceSell(s.id);
        h += `<div class="shop-row" data-sell="${s.id}">
          <span class="sr-icon">${it.i}</span>
          <div class="sr-mid"><b>${it.n}</b> <small>×${s.q}</small></div>
          <div class="sr-right"><b>${price}🪙</b></div>
        </div>`;
      });
    }
    h += '</div>';
    this.el.panelBody.innerHTML = h;
    this.el.panelBody.querySelectorAll('.shop-tabs button').forEach(b => b.onclick = () => { this._shopTab = b.dataset.t; AUDIO.play('ui'); this.renderShop(); });
    this.el.panelBody.querySelectorAll('[data-buy]').forEach(el => el.onclick = () => { GAME.buy(npc, +el.dataset.buy); this.renderShop(); });
    this.el.panelBody.querySelectorAll('[data-sell]').forEach(el => el.onclick = () => { GAME.sell(npc, el.dataset.sell); this.renderShop(); });
  },

  /* ---------------- diálogos ---------------- */
  showDialog(npc, node) {
    this.el.dialog.style.display = 'flex';
    G.paused = true;
    let h = `<div class="dlg-name">${npc.name || npc.pname || 'Desconhecido'}</div>
      <div class="dlg-text">${node.text}</div><div class="dlg-opts">`;
    node.options.forEach((o, i) => { h += `<button class="dlg-opt" data-i="${i}">${o.label}</button>`; });
    h += '</div>';
    this.el.dialog.innerHTML = h;
    this.el.dialog.querySelectorAll('.dlg-opt').forEach(b => {
      b.onclick = () => { AUDIO.play('ui'); const o = node.options[+b.dataset.i]; if (o.action) o.action(); if (o.next) this.showDialog(npc, o.next); else this.closeDialog(); };
    });
  },
  closeDialog() { this.el.dialog.style.display = 'none'; if (this.activePanel !== 'shop' && !this.activePanel) G.paused = false; },

  /* ---------------- missões ---------------- */
  renderQuests() {
    let h = '<div class="quest-section"><h3>📖 Campanha Principal</h3>';
    const s = QUESTS.mainSteps[QUESTS.main];
    if (QUESTS.ending) h += `<div class="quest-card done"><b>✨ A jornada terminou</b><p>Final alcançado: ${this.endingName(QUESTS.ending)}</p></div>`;
    else if (s) h += `<div class="quest-card main"><b>${s.title}</b><p>${s.desc}</p><small class="q-hint">💡 ${s.hint}</small></div>`;
    h += '</div><div class="quest-section"><h3>📌 Missões Secundárias</h3>';
    if (!QUESTS.active.length) h += '<p class="dim">Nenhuma missão ativa. Visite o quadro de missões nas vilas.</p>';
    QUESTS.active.forEach(q => {
      const def = QUESTS.sideDefs[q.key];
      let prog = '';
      if (def.kills) prog = Object.keys(def.kills).map(k => `${k}: ${q.progress[k] || 0}/${def.kills[k]}`).join(', ');
      if (def.need) prog = Object.keys(def.need).map(id => `${ITEMS[id].n}: ${invCount(G.player.inv, id)}/${def.need[id]}`).join(', ');
      const ready = QUESTS.canComplete(q);
      h += `<div class="quest-card ${ready ? 'ready' : ''}"><b>${def.title}</b><p>${q.desc}</p>${prog ? '<small>' + prog + '</small>' : ''}${ready ? '<span class="q-ready">✅ Pronta para entregar!</span>' : ''}</div>`;
    });
    h += '</div>';
    this.el.panelBody.innerHTML = h;
  },
  endingName(e) { return { harmonia: '☀️ O Amanhecer da Harmonia', tirania: '🌑 O Trono das Sombras', guardião: '🌗 O Guardião Solitário' }[e] || e; },

  refreshQuests() {
    /* rastreador de missão no HUD */
    const t = this.el.questTracker;
    let h = '';
    const s = QUESTS.mainSteps[QUESTS.main];
    if (s && !QUESTS.ending) h += `<div class="qt-main">📜 ${s.title}<br><small>${s.desc}</small></div>`;
    QUESTS.active.slice(0, 2).forEach(q => {
      const def = QUESTS.sideDefs[q.key];
      let prog = '';
      if (def.kills) prog = ' (' + Object.keys(def.kills).map(k => (q.progress[k] || 0) + '/' + def.kills[k]).join(',') + ')';
      if (def.need) prog = ' (' + Object.keys(def.need).map(id => invCount(G.player.inv, id) + '/' + def.need[id]).join(',') + ')';
      h += `<div class="qt-side">• ${def.title}${prog}</div>`;
    });
    t.innerHTML = h;
    if (this.activePanel === 'quests') this.renderQuests();
  },

  /* ---------------- habilidades ---------------- */
  renderSkills() {
    const p = G.player;
    let h = `<p class="skill-points">Pontos disponíveis: <b>${p.skillPoints}</b></p><div class="skill-trees">`;
    for (const tk in SKILL_TREE) {
      const tree = SKILL_TREE[tk];
      h += `<div class="skill-tree"><h4>${tree.icon} ${tree.name}</h4>`;
      tree.skills.forEach(([id, name, desc, tier]) => {
        const owned = p.skills[id];
        const can = p.skillPoints > 0 && !owned;
        h += `<div class="skill-node ${owned ? 'owned' : ''} ${can ? 'can' : ''}" data-tree="${tk}" data-id="${id}">
          <b>${name}</b> <small class="tier">T${tier}</small><p>${desc}</p></div>`;
      });
      h += '</div>';
    }
    h += '</div>';
    this.el.panelBody.innerHTML = h;
    this.el.panelBody.querySelectorAll('.skill-node.can').forEach(el => {
      el.onclick = () => { if (p.learnSkill(el.dataset.tree, el.dataset.id)) { this.toast('✨ Habilidade aprendida!', 'gold'); this.renderSkills(); } };
    });
  },

  /* ---------------- companheiros ---------------- */
  renderPets() {
    const p = G.player;
    let h = '<div class="pets-wrap">';
    if (!p.petsOwned.length) h += '<p class="dim">Você ainda não adotou nenhum animal. Encontre filhotes pelo mundo!</p>';
    p.petsOwned.forEach((pet, i) => {
      const cfg = PET_CFG[pet.kind];
      const active = p.activePet === pet;
      h += `<div class="pet-card ${active ? 'active' : ''}">
        <div class="pet-head"><b>${this.petEmoji(pet.kind)} ${pet.pname}</b> <span class="pet-lvl">Nível ${pet.level}</span></div>
        <p class="dim">${cfg.desc}</p>
        <div class="pet-bars">
          <div class="pb"><small>❤️ Vida</small><div class="pbb"><i style="width:${pet.hp / pet.maxhp * 100}%;background:#d05050"></i></div></div>
          <div class="pb"><small>😊 Felicidade</small><div class="pbb"><i style="width:${pet.happiness}%;background:#e0c040"></i></div></div>
          <div class="pb"><small>🍖 Fome</small><div class="pbb"><i style="width:${pet.hunger}%;background:#c08040"></i></div></div>
          <div class="pb"><small>⭐ XP</small><div class="pbb"><i style="width:${pet.xp / (pet.level * 40) * 100}%;background:#60b0e0"></i></div></div>
        </div>
        ${pet.sick ? '<p class="no">🤒 Doente — use um Remédio de Ervas!</p>' : ''}
        <div class="pet-actions">
          <button data-pet="${i}" data-act="summon">${active ? '✔️ Ativo' : 'Chamar'}</button>
          <button data-pet="${i}" data-act="feed">🍖 Alimentar</button>
          <button data-pet="${i}" data-act="pet">❤️ Fazer carinho</button>
          ${pet.sick ? `<button data-pet="${i}" data-act="cure">🧪 Curar</button>` : ''}
        </div>
      </div>`;
    });
    h += '</div>';
    /* cavalos */
    if (p.horsesOwned.length) {
      h += '<h3 style="margin-top:14px">🐴 Cavalos</h3>';
      p.horsesOwned.forEach((hh, i) => {
        h += `<div class="pet-card"><div class="pet-head"><b>🐴 ${hh.hname}</b></div>
          <div class="pet-actions"><button data-horse="${i}" data-act="summon">Chamar cavalo</button></div></div>`;
      });
    }
    this.el.panelBody.innerHTML = h;
    this.el.panelBody.querySelectorAll('[data-pet]').forEach(el => {
      el.onclick = () => GAME.petAction(p.petsOwned[+el.dataset.pet], el.dataset.act, () => this.renderPets());
    });
    this.el.panelBody.querySelectorAll('[data-horse]').forEach(el => {
      el.onclick = () => { const hh = p.horsesOwned[+el.dataset.horse]; hh.summoned = true; hh.pos.set(p.pos.x + 3, 0, p.pos.z); hh.pos.y = terrainHeight(hh.pos.x, hh.pos.z); if (!ENT.all.includes(hh)) ENT.add(hh); this.toast('🐴 ' + hh.hname + ' está a caminho!'); this.closePanel(); };
    });
  },
  petEmoji(k) { return { cachorro: '🐕', gato: '🐈', lobo: '🐺', raposa: '🦊', papagaio: '🦜', coruja: '🦉' }[k] || '🐾'; },
  refreshPets() {
    const bar = this.el.petbar;
    const p = G.player;
    if (!p.activePet) { bar.style.display = 'none'; return; }
    bar.style.display = 'flex';
    const pet = p.activePet;
    bar.innerHTML = `<span class="pet-ic">${this.petEmoji(pet.kind)}</span>
      <div class="pet-mini"><b>${pet.pname} ⭐${pet.level}</b>
      <div class="pmb"><i style="width:${pet.hp / pet.maxhp * 100}%"></i></div></div>`;
    bar.onclick = () => this.openPanel('pets');
  },

  /* ---------------- estatísticas do personagem ---------------- */
  renderCharStats() {
    const p = G.player, s = G.stats;
    const achv = ACHV.map(a => `<div class="achv ${G.achievements[a[0]] ? 'unlocked' : ''}"><b>${G.achievements[a[0]] ? '🏆' : '🔒'} ${a[1]}</b><small>${a[2]}</small></div>`).join('');
    this.el.panelBody.innerHTML = `
      <div class="stats-grid">
        <div><small>Nível</small><b>${p.level}</b></div>
        <div><small>Dano de arma</small><b>${Math.round((p.weaponDef().dmg || 0) + p.level * 0.5)}</b></div>
        <div><small>Defesa</small><b>${p.totalDef()}</b></div>
        <div><small>Vida</small><b>${p.maxhp}</b></div>
        <div><small>Vigor</small><b>${p.maxstam}</b></div>
        <div><small>Mana</small><b>${p.maxmana}</b></div>
        <div><small>Ouro</small><b>${p.gold}🪙</b></div>
        <div><small>Inimigos derrotados</small><b>${s.kills}</b></div>
        <div><small>Missões</small><b>${s.quests}</b></div>
        <div><small>Peixes pescados</small><b>${s.fish}</b></div>
        <div><small>Locais descobertos</small><b>${WORLD.pois.filter(q => q.discovered).length}/${WORLD.pois.length}</b></div>
        <div><small>Distância</small><b>${Math.round(s.dist)}m</b></div>
      </div>
      <h3 style="margin-top:16px">🏆 Conquistas (${Object.keys(G.achievements).length}/${ACHV.length})</h3>
      <div class="achv-grid">${achv}</div>`;
  },

  /* ---------------- menu ---------------- */
  renderMenu() {
    this.el.panelBody.innerHTML = `
      <div class="menu-box">
        <button id="mb-save" class="menu-btn">💾 Salvar Jogo</button>
        <button id="mb-load" class="menu-btn">📂 Carregar Jogo</button>
        <h3>Volume</h3>
        <label>Geral <input type="range" min="0" max="1" step="0.05" value="${AUDIO.vol.master}" id="v-master"></label>
        <label>Música <input type="range" min="0" max="1" step="0.05" value="${AUDIO.vol.music}" id="v-music"></label>
        <label>Efeitos <input type="range" min="0" max="1" step="0.05" value="${AUDIO.vol.sfx}" id="v-sfx"></label>
        <h3>Gráficos</h3>
        <label><input type="checkbox" id="q-shadows" ${G.quality.shadows ? 'checked' : ''}> Sombras</label>
        <label><input type="checkbox" id="q-waves" ${G.quality.waves ? 'checked' : ''}> Ondas na água</label>
        <label>Distância de visão
          <select id="q-view"><option value="1" ${G.quality.viewDist === 1 ? 'selected' : ''}>Curta</option><option value="2" ${G.quality.viewDist === 2 ? 'selected' : ''}>Média</option><option value="3" ${G.quality.viewDist === 3 ? 'selected' : ''}>Longa</option></select></label>
        <h3>Controles</h3>
        <p class="dim">PC: WASD mover · Shift correr · Ctrl agachar · Espaço pular · Mouse olhar · Botão esq. atacar · Botão dir. bloquear · Q esquivar · E interagir · R magia · F tocha · 1-5 atalhos · Tab inventário · M mapa · P pets · J missões · K habilidades · C ficha · Esc menu</p>
        <button id="mb-restart" class="menu-btn danger">🔄 Recomeçar (novo mundo)</button>
      </div>`;
    document.getElementById('mb-save').onclick = () => { GAME.save(); };
    document.getElementById('mb-load').onclick = () => { GAME.load(); this.closePanel(); };
    document.getElementById('mb-restart').onclick = () => { if (confirm('Começar um novo mundo? O progresso não salvo será perdido.')) location.reload(); };
    document.getElementById('v-master').oninput = e => AUDIO.setVol('master', +e.target.value);
    document.getElementById('v-music').oninput = e => AUDIO.setVol('music', +e.target.value);
    document.getElementById('v-sfx').oninput = e => AUDIO.setVol('sfx', +e.target.value);
    document.getElementById('q-shadows').onchange = e => { G.quality.shadows = e.target.checked; G.renderer.shadowMap.enabled = e.target.checked; ENV.sun.castShadow = e.target.checked; };
    document.getElementById('q-waves').onchange = e => { G.quality.waves = e.target.checked; };
    document.getElementById('q-view').onchange = e => { G.quality.viewDist = +e.target.value; };
  },

  /* ---------------- mapa mundo ---------------- */
  renderMap() {
    this.el.panelBody.innerHTML = `<canvas id="worldmap" width="640" height="640"></canvas>
      <div class="map-legend">🏘️ Vila · 🏰 Castelo · 🏛️ Ruína · 🕳️ Caverna · ⛺ Acampamento · 🌾 Fazenda · 📍 Você</div>`;
    const cv = document.getElementById('worldmap');
    const ctx = cv.getContext('2d');
    const draw = () => {
      const W = cv.width, ext = WORLD.extent;
      const toX = x => (x + ext) / (2 * ext) * W;
      const toY = z => (z + ext) / (2 * ext) * W;
      /* fundo por amostragem de cor do terreno */
      const step = 8;
      for (let py = 0; py < W; py += step) for (let px = 0; px < W; px += step) {
        const wx = px / W * 2 * ext - ext, wz = py / W * 2 * ext - ext;
        const h = rawHeight(wx, wz);
        let c;
        if (h < 0) c = '#16394a';
        else if (h < 1.6) c = '#b7a374';
        else if (tempBase(wx, wz, h) < 4 || h > 50) c = '#dfe6ee';
        else if (h > 36) c = '#6d6a63';
        else { const col = colorAt(wx, wz, h); c = `rgb(${col[0] * 255 | 0},${col[1] * 255 | 0},${col[2] * 255 | 0})`; }
        ctx.fillStyle = c; ctx.fillRect(px, py, step, step);
      }
      /* estradas */
      ctx.strokeStyle = 'rgba(90,70,50,0.8)'; ctx.lineWidth = 2;
      WORLD.roads.forEach(r => { ctx.beginPath(); ctx.moveTo(toX(r.ax), toY(r.az)); ctx.lineTo(toX(r.bx), toY(r.bz)); ctx.stroke(); });
      /* locais descobertos */
      ctx.font = '18px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      WORLD.pois.forEach(p => {
        if (!p.discovered) return;
        ctx.fillText(p.icon, toX(p.x), toY(p.z));
      });
      /* missão de tesouro */
      QUESTS.active.forEach(q => { if (q.tx !== undefined && q.tx !== null && !q.dug) { ctx.fillStyle = '#ffcc00'; ctx.font = '20px serif'; ctx.fillText('❌', toX(q.tx), toY(q.tz)); ctx.font = '18px serif'; } });
      /* rastreador de fauna */
      if (G.player.has('rastreador')) {
        ctx.fillStyle = 'rgba(120,200,120,0.9)';
        ENT.all.forEach(e => { if (e instanceof Animal && !e.hostile) { ctx.beginPath(); ctx.arc(toX(e.pos.x), toY(e.pos.z), 2, 0, TAU); ctx.fill(); } });
      }
      /* jogador */
      const px = toX(G.player.pos.x), py = toY(G.player.pos.z);
      ctx.save(); ctx.translate(px, py); ctx.rotate(-G.player.yaw);
      ctx.fillStyle = '#ffe08a'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath();
      ctx.fill(); ctx.stroke(); ctx.restore();
      this._mapRAF = requestAnimationFrame(draw);
    };
    draw();
  },

  /* ---------------- minimapa e bússola (HUD) ---------------- */
  updateMinimap() {
    const ctx = this.mmCtx, sz = 140, R = sz / 2, range = 80;
    ctx.clearRect(0, 0, sz, sz);
    ctx.save();
    ctx.beginPath(); ctx.arc(R, R, R - 1, 0, TAU); ctx.clip();
    const p = G.player;
    /* terreno amostrado ao redor */
    const step = 10;
    for (let py = 0; py < sz; py += step) for (let px = 0; px < sz; px += step) {
      const dx = (px - R) / R * range, dz = (py - R) / R * range;
      const rot = -p.yaw;
      const wx = p.pos.x + (dx * Math.cos(rot) - dz * Math.sin(rot));
      const wz = p.pos.z + (dx * Math.sin(rot) + dz * Math.cos(rot));
      const h = rawHeight(wx, wz);
      let c;
      if (h < 0) c = '#1a4256';
      else if (h < 1.6) c = '#b7a374';
      else if (tempBase(wx, wz, h) < 4 || h > 50) c = '#e0e6ee';
      else if (h > 36) c = '#6d6a63';
      else { const col = colorAt(wx, wz, h); c = `rgb(${col[0] * 255 | 0},${col[1] * 255 | 0},${col[2] * 255 | 0})`; }
      ctx.fillStyle = c; ctx.fillRect(px, py, step, step);
    }
    /* POIs próximos */
    ctx.font = '13px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    WORLD.pois.forEach(poi => {
      if (!poi.discovered) return;
      const d = dist2(poi.x, poi.z, p.pos.x, p.pos.z);
      if (d > range * 1.4) return;
      const rot = -p.yaw, rx = poi.x - p.pos.x, rz = poi.z - p.pos.z;
      const mx = R + (rx * Math.cos(-rot) - rz * Math.sin(-rot)) / range * R;
      const my = R + (rx * Math.sin(-rot) + rz * Math.cos(-rot)) / range * R;
      ctx.fillText(poi.icon, mx, my);
    });
    /* entidades */
    ENT.all.forEach(e => {
      const d = dist2(e.pos.x, e.pos.z, p.pos.x, p.pos.z);
      if (d > range) return;
      const rot = -p.yaw, rx = e.pos.x - p.pos.x, rz = e.pos.z - p.pos.z;
      const mx = R + (rx * Math.cos(-rot) - rz * Math.sin(-rot)) / range * R;
      const my = R + (rx * Math.sin(-rot) + rz * Math.cos(-rot)) / range * R;
      let col = null;
      if (e instanceof Enemy || (e instanceof Animal && e.hostile)) col = '#e04040';
      else if (e === p.activePet) col = '#40e0a0';
      else if (e instanceof NPC) col = '#e0d040';
      else if (e instanceof Horse) col = '#c090e0';
      else if (e instanceof Animal) col = '#80c060';
      if (col) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(mx, my, e instanceof Enemy && e.boss ? 4 : 2.4, 0, TAU); ctx.fill(); }
    });
    ctx.restore();
    /* seta do jogador */
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(R, R - 6); ctx.lineTo(R + 4, R + 5); ctx.lineTo(R, R + 2); ctx.lineTo(R - 4, R + 5); ctx.closePath(); ctx.fill(); ctx.stroke();
    /* borda + Norte */
    ctx.strokeStyle = 'rgba(220,200,150,0.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(R, R, R - 1, 0, TAU); ctx.stroke();
    const na = -p.yaw - Math.PI / 2;
    ctx.fillStyle = '#ffdd88'; ctx.font = 'bold 11px serif';
    ctx.fillText('N', R + Math.cos(na) * (R - 10), R + Math.sin(na) * (R - 10));
  },

  updateClock() {
    this.el.clock.textContent = fmtTime(G.time.t) + ' · Dia ' + G.time.day;
    const icons = { limpo: '☀️', nublado: '☁️', chuva: '🌧️', tempestade: '⛈️', neblina: '🌫️', neve: '🌨️' };
    if (G.time.t < 6 || G.time.t > 19) { if (ENV && ENV.weather === 'limpo') this.el.weatherIcon.textContent = '🌙'; else this.el.weatherIcon.textContent = icons[ENV ? ENV.weather : 'limpo']; }
    else this.el.weatherIcon.textContent = icons[ENV ? ENV.weather : 'limpo'];
  },

  /* ---------------- barra de chefe ---------------- */
  updateBossBar() {
    const boss = ENT.all.find(e => e instanceof Enemy && e.boss && e.alive && e.hostile && e.distToPlayer() < 40);
    if (boss) {
      this.el.bossbar.style.display = 'block';
      this.el.bossName.textContent = boss.name;
      this.el.bossFill.style.width = clamp(boss.hp / boss.maxhp * 100, 0, 100) + '%';
    } else this.el.bossbar.style.display = 'none';
  },

  /* ---------------- números de dano flutuantes ---------------- */
  updateFloaters(dt) {
    const layer = this.el.floaters;
    /* limpa e redesenha via DOM leve */
    for (let i = this.dmgNums.length - 1; i >= 0; i--) {
      const d = this.dmgNums[i];
      d.t -= dt; d.y += d.vy * dt;
      if (d.t <= 0) { if (d.el) d.el.remove(); this.dmgNums.splice(i, 1); continue; }
      const sp = worldToScreen(d.x, d.y, d.z);
      if (!sp) { if (d.el) d.el.style.display = 'none'; continue; }
      if (!d.el) { d.el = document.createElement('div'); d.el.className = 'dmg-float'; layer.appendChild(d.el); d.el.textContent = d.val; d.el.style.color = d.color; }
      d.el.style.display = 'block';
      d.el.style.left = sp.x + 'px'; d.el.style.top = sp.y + 'px';
      d.el.style.opacity = clamp(d.t, 0, 1);
      d.el.style.transform = `translate(-50%,-50%) scale(${0.8 + (1 - d.t) * 0.4})`;
    }
  },

  /* ---------------- telas de morte / final ---------------- */
  showDeath() {
    const ov = document.getElementById('overlay');
    ov.style.display = 'flex';
    ov.innerHTML = `<div class="end-card">
      <h1>Você Caiu</h1>
      <p>A escuridão o envolve... mas sua jornada não termina aqui.</p>
      <button id="respawn-btn" class="big-btn">Despertar na cidade</button>
    </div>`;
    document.getElementById('respawn-btn').onclick = () => { ov.style.display = 'none'; G.player.respawn(); };
  },
  showEnding(ending) {
    G.state = 'ending';
    const ov = document.getElementById('overlay');
    ov.style.display = 'flex';
    const texts = {
      harmonia: 'Com o Eclipse desfeito e o perdão em seu coração, Eldoria floresce sob um novo amanhecer. Vilas prosperam, e cantam seu nome como o Guardião da Aurora. As estradas estão seguras, e a paz reina.',
      tirania: 'O Eclipse foi quebrado, mas à custa de muito sangue. As pessoas temem tanto quanto reverenciam você. Você governa pelas sombras que ajudou a dissipar — um poder solitário e frio.',
      guardião: 'O ritual se completa ao romper da manhã. O Eclipse recua e você parte sozinho, um guardião errante que carrega o peso e a glória de ter salvado a terra. Sua lenda ecoará por gerações.',
    };
    ov.innerHTML = `<div class="end-card ending">
      <h1>${this.endingName(ending)}</h1>
      <p>${texts[ending]}</p>
      <div class="end-stats">Nível ${G.player.level} · ${G.stats.kills} inimigos derrotados · ${G.stats.quests} missões · ${WORLD.pois.filter(q => q.discovered).length} locais descobertos · Dia ${G.time.day}</div>
      <p class="dim">Sua aventura continua — o mundo permanece aberto para explorar.</p>
      <button id="continue-btn" class="big-btn">Continuar Explorando</button>
    </div>`;
    document.getElementById('continue-btn').onclick = () => { ov.style.display = 'none'; G.state = 'play'; };
    AUDIO.play('achievement');
  },
};
