/* =====================================================================
   game.js — Loop principal, câmera, interações e orquestração
   ===================================================================== */
'use strict';

const GAME = {
  clock: null, acc: 0, lastT: 0, camDist: 5.2, camHeight: 2.2, targetCamDist: 5.2,

  boot() {
    /* renderer */
    const canvas = document.getElementById('gl');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !G.isMobile, powerPreference: 'high-performance' });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, G.isMobile ? 1.5 : 2));
    renderer.shadowMap.enabled = G.quality.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    G.renderer = renderer;
    G.scene = new THREE.Scene();
    G.camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.1, G.isMobile ? 420 : 620);
    addEventListener('resize', () => {
      renderer.setSize(innerWidth, innerHeight);
      G.camera.aspect = innerWidth / innerHeight; G.camera.updateProjectionMatrix();
    });
    UI.init();
    CONTROLS.init();
    G.frame = 0;
    this.showTitle();
  },

  showTitle() {
    G.state = 'title';
    const ov = document.getElementById('overlay');
    ov.style.display = 'flex';
    ov.innerHTML = `<div class="title-card">
      <div class="title-logo">ELDORIA</div>
      <div class="title-sub">✦ O Último Amanhecer ✦</div>
      <p class="title-desc">Um mundo aberto vivo aguarda: florestas, montanhas, castelos e mistérios sob um céu em constante mudança. Forje seu destino, dome bestas, adote companheiros e decida o fim desta história.</p>
      <button id="start-btn" class="big-btn">⚔️ Nova Aventura</button>
      ${localStorage.getItem('eldoria_save') ? '<button id="cont-btn" class="big-btn ghost">📂 Continuar</button>' : ''}
      <div class="title-hint">${G.isMobile ? '📱 Otimizado para toque' : '🖥️ Use WASD + mouse'}</div>
    </div>`;
    document.getElementById('start-btn').onclick = () => { AUDIO.init(); AUDIO.resume(); AUDIO.play('ui'); this.showCreator(); };
    const cb = document.getElementById('cont-btn');
    if (cb) cb.onclick = () => { AUDIO.init(); AUDIO.resume(); this.startWorld(null, true); };
  },

  showCreator() {
    G.state = 'create';
    const ov = document.getElementById('overlay');
    const A = { name: 'Aventureiro', gender: 'm', skin: 0xd8a37a, hair: 0x3a281a, eyes: 0x2a2a4a, hairStyle: 1, beard: false, build: 1, height: 1 };
    this._app = A;
    const skins = [0xf0d0b0, 0xe8b98a, 0xd8a37a, 0xb8825a, 0x8a5f3f, 0x5a3f2a];
    const hairs = [0x1a1a1a, 0x3a281a, 0x5a3a1a, 0x8a6a30, 0xb0a070, 0xc0c0c0, 0x9a3a2a];
    const eyes = [0x2a2a4a, 0x3a6a3a, 0x6a4a2a, 0x4a4a4a, 0x2a5a6a];
    ov.innerHTML = `<div class="creator">
      <h2>Crie seu Herói</h2>
      <div class="creator-body">
        <div id="char-preview"></div>
        <div class="creator-opts">
          <label>Nome <input id="c-name" maxlength="16" value="Aventureiro"></label>
          <div class="opt-row"><span>Sexo</span><div class="btn-group" id="c-gender">
            <button data-v="m" class="on">♂ Masculino</button><button data-v="f">♀ Feminino</button></div></div>
          <div class="opt-row"><span>Pele</span><div class="swatches" id="c-skin"></div></div>
          <div class="opt-row"><span>Cabelo</span><div class="swatches" id="c-hair"></div></div>
          <div class="opt-row"><span>Estilo cabelo</span><div class="btn-group" id="c-hairstyle">
            <button data-v="0">Careca</button><button data-v="1" class="on">Curto</button><button data-v="2">Longo</button><button data-v="4">Moicano</button></div></div>
          <div class="opt-row"><span>Olhos</span><div class="swatches" id="c-eyes"></div></div>
          <div class="opt-row"><span>Barba</span><div class="btn-group" id="c-beard"><button data-v="0" class="on">Não</button><button data-v="1">Sim</button></div></div>
          <div class="opt-row"><span>Altura</span><input type="range" id="c-height" min="0.88" max="1.12" step="0.02" value="1"></div>
          <div class="opt-row"><span>Porte</span><input type="range" id="c-build" min="0.85" max="1.2" step="0.02" value="1"></div>
        </div>
      </div>
      <button id="create-done" class="big-btn">Começar Jornada →</button>
    </div>`;
    /* preview 3D */
    const pv = document.getElementById('char-preview');
    const pr = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    pr.setSize(220, 300); pr.setPixelRatio(Math.min(devicePixelRatio, 2));
    pv.appendChild(pr.domElement);
    const ps = new THREE.Scene();
    const pc = new THREE.PerspectiveCamera(40, 220 / 300, 0.1, 20);
    pc.position.set(0, 1.5, 4.2); pc.lookAt(0, 1.1, 0);
    ps.add(new THREE.HemisphereLight(0xffffff, 0x444455, 1.1));
    const dl = new THREE.DirectionalLight(0xffffff, 0.8); dl.position.set(2, 4, 3); ps.add(dl);
    let pmodel = null, rot = 0;
    const rebuild = () => {
      if (pmodel) ps.remove(pmodel);
      const mk = makeHumanoid({ gender: A.gender, skin: A.skin, hair: A.hair, eyes: A.eyes, hairStyle: A.hairStyle, beard: A.beard, build: A.build, height: A.height, shirt: 0x4a5a6a, pants: 0x3a3028 });
      pmodel = mk.group; ps.add(pmodel);
    };
    rebuild();
    const anim = () => { if (G.state !== 'create') { pr.dispose(); return; } rot += 0.01; if (pmodel) pmodel.rotation.y = rot; pr.render(ps, pc); requestAnimationFrame(anim); };
    anim();
    /* swatches */
    const mkSwatches = (elId, arr, key) => {
      const c = document.getElementById(elId);
      arr.forEach((col, i) => {
        const s = document.createElement('button');
        s.className = 'swatch' + (A[key] === col ? ' on' : '');
        s.style.background = '#' + col.toString(16).padStart(6, '0');
        s.onclick = () => { A[key] = col; c.querySelectorAll('.swatch').forEach(x => x.classList.remove('on')); s.classList.add('on'); rebuild(); AUDIO.play('ui'); };
        c.appendChild(s);
      });
    };
    mkSwatches('c-skin', skins, 'skin');
    mkSwatches('c-hair', hairs, 'hair');
    mkSwatches('c-eyes', eyes, 'eyes');
    const grp = (id, cb) => document.querySelectorAll('#' + id + ' button').forEach(b => b.onclick = () => { document.querySelectorAll('#' + id + ' button').forEach(x => x.classList.remove('on')); b.classList.add('on'); cb(b.dataset.v); rebuild(); AUDIO.play('ui'); });
    grp('c-gender', v => A.gender = v);
    grp('c-hairstyle', v => A.hairStyle = +v);
    grp('c-beard', v => A.beard = v === '1');
    document.getElementById('c-height').oninput = e => { A.height = +e.target.value; rebuild(); };
    document.getElementById('c-build').oninput = e => { A.build = +e.target.value; rebuild(); };
    document.getElementById('c-name').oninput = e => A.name = e.target.value || 'Aventureiro';
    document.getElementById('create-done').onclick = () => { AUDIO.play('quest'); this.startWorld(A); };
  },

  startWorld(app, fromSave) {
    document.getElementById('overlay').style.display = 'none';
    document.getElementById('loading').style.display = 'flex';
    setTimeout(() => this._buildWorld(app, fromSave), 60);
  },
  _buildWorld(app, fromSave) {
    let saved = null;
    if (fromSave) { try { saved = JSON.parse(localStorage.getItem('eldoria_save')); } catch (e) {} }
    if (saved) { G.seed = saved.seed || G.seed; app = saved.app; }
    initWorld();
    G.player = new Player(app || this._app || { name: 'Aventureiro', gender: 'm', skin: 0xd8a37a, hair: 0x3a281a, eyes: 0x2a2a4a, hairStyle: 1 });
    ENV = new Environment(G.scene);
    const v = WORLD.villages[0];
    G.player.pos.set(v.x, terrainHeight(v.x, v.z), v.z + 20);
    ENT.populate();
    QUESTS.start();
    if (saved) this.applySave(saved);
    /* pré-carrega chunks ao redor */
    ensureChunks(G.player.pos.x, G.player.pos.z);
    G.state = 'play';
    document.getElementById('loading').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    UI.refreshStats(); UI.refreshHotbar(); UI.refreshQuests(); UI.refreshPets();
    this.clock = new THREE.Clock();
    if (!saved) {
      setTimeout(() => UI.toast('Bem-vindo a Eldervale. Fale com a Anciã Mira (⭐) para começar.', 'gold'), 800);
    }
    this.loop();
  },

  /* ---------------- loop ---------------- */
  loop() {
    requestAnimationFrame(() => this.loop());
    let dt = this.clock.getDelta();
    if (dt > 0.05) dt = 0.05;
    G.frame++;

    /* processa ações pontuais */
    if (INPUT.jumpP) { if (G.player.mount) G.player.dismount(); else G.player.jump(); }
    if (INPUT.attackP || INPUT.attackHeld) G.player.attack();
    if (INPUT.rollP) G.player.roll();
    if (INPUT.castP) G.player.cast();
    if (INPUT.interactP) G.player.interact();

    if (G.state === 'play' && !G.paused) {
      /* tempo do mundo */
      G.time.t += dt * G.time.speed * 24;
      if (G.time.t >= 24) { G.time.t -= 24; G.time.day++; this.onNewDay(); }

      G.player.update(dt);
      ENT.update(dt);
      ENV.update(dt);
      if (G.inCombat > 0) G.inCombat -= dt;
      this.updateParticles(dt);
      updatePickups(dt, G.player.pos.x, G.player.pos.z);
      updateWater(dt, G.player.pos.x, G.player.pos.z);
      ensureChunks(G.player.pos.x, G.player.pos.z);
      updateStructVisibility(G.player.pos.x, G.player.pos.z);
      checkDiscoveries(G.player.pos.x, G.player.pos.z);
      this.checkEndingTrigger();
      AUDIO.update(dt);
    } else if (ENV) {
      ENV.update(dt * 0.2);
    }

    this.updateCamera(dt);

    /* HUD por frame (throttle leve) */
    if ((G.frame & 1) === 0) { UI.refreshBars(); }
    if ((G.frame % 3) === 0) UI.updateMinimap();
    UI.updateClock();
    UI.updateBossBar();
    UI.updateFloaters(dt);
    UI.refreshPets();

    INPUT.consume();
    G.renderer.render(G.scene, G.camera);
  },

  updateCamera(dt) {
    const p = G.player;
    const focus = p.mount ? p.mount.pos : p.pos;
    const headY = (p.mount ? p.mount.cfg.leg + p.mount.cfg.bh + 1.4 : 1.5);
    /* colisão de câmera: encurta se bater em terreno/estrutura */
    this.targetCamDist = p.crouching ? 4 : (p.swimming ? 4.5 : 5.4);
    const desiredDist = this.targetCamDist;
    const cy = Math.sin(p.pitch);
    const back = new THREE.Vector3(-Math.sin(p.yaw) * Math.cos(p.pitch), cy + 0.35, -Math.cos(p.yaw) * Math.cos(p.pitch));
    /* raio de colisão simples contra o solo */
    let d = desiredDist;
    for (let s = 1; s <= 6; s++) {
      const t = s / 6 * desiredDist;
      const cx = focus.x + back.x * t, cz = focus.z + back.z * t;
      const cyPos = focus.y + headY + back.y * t;
      if (cyPos < terrainHeight(cx, cz) + 0.4) { d = t - 0.3; break; }
    }
    this.camDist = lerp(this.camDist, Math.max(1.5, d), dt * 10);
    const camPos = new THREE.Vector3(
      focus.x + back.x * this.camDist,
      focus.y + headY + back.y * this.camDist,
      focus.z + back.z * this.camDist);
    G.camera.position.lerp(camPos, dt * 14);
    G.camera.lookAt(focus.x + Math.sin(p.yaw) * 1.2, focus.y + headY + p.pitch * 1.5, focus.z + Math.cos(p.yaw) * 1.2);
  },

  updateParticles(dt) {
    for (let i = G.particles.length - 1; i >= 0; i--) {
      const pt = G.particles[i];
      pt.t -= dt;
      pt.mesh.position.y += pt.vy * dt;
      pt.mesh.material.opacity = clamp(pt.t * 3, 0, 1);
      pt.mesh.material.transparent = true;
      pt.mesh.scale.multiplyScalar(1 - dt * 1.5);
      if (pt.t <= 0) { G.scene.remove(pt.mesh); G.particles.splice(i, 1); }
    }
  },

  onNewDay() {
    /* renova estoques das lojas e alguns eventos */
    ENT.all.forEach(e => { if (e instanceof NPC) e._stock = null; });
    if (G.player.gold >= 1000) unlock('rico');
    if (G.player.diseases.sangrando) G.player.diseases.sangrando = 0;
    UI.toast('🌅 Dia ' + G.time.day + ' amanhece em Eldoria.');
  },

  checkEndingTrigger() {
    if (QUESTS.main >= 5 && !QUESTS.ending && !this._ritualReady) {
      const circle = WORLD.pois.find(p => p.kind === 'circulo');
      if (circle && dist2(G.player.pos.x, G.player.pos.z, circle.x, circle.z) < 8 && G.time.t >= 5 && G.time.t <= 7) {
        this._ritualReady = true;
        UI.toast('🌀 O Círculo das Luas ressoa com poder... o ritual começa!', 'gold');
        setTimeout(() => { if (G.state === 'play') QUESTS.triggerEnding(); }, 2500);
      }
    }
  },

  /* ================= INTERAÇÕES ================= */
  handleInteract(t) {
    if (t instanceof NPC) return this.talkTo(t);
    if (t instanceof Horse) return t.owned ? G.player.mountHorse(t) : this.tameHorse(t);
    if (t instanceof Pet) return this.petInteract(t);
    switch (t.type) {
      case 'colher': return this.gather(t);
      case 'mina': return this.mine(t);
      case 'chest': return this.openChest(t);
      case 'fogueira': return UI.openPanel('craft', 'fogueira');
      case 'bigorna': return UI.openPanel('craft', 'bigorna');
      case 'bed': return this.sleep(t);
      case 'poco': case 'water_drink': return this.drinkWater();
      case 'board': return this.questBoard(t.village);
      case 'portal': return this.usePortal(t);
      case 'fish': return this.fish(t);
    }
  },

  gather(t) {
    invAdd(G.player.inv, t.item, 1);
    UI.toast('+1 ' + ITEMS[t.item].i + ' ' + ITEMS[t.item].n);
    AUDIO.play('pickup');
    G.stats.gathered++;
    if (G.stats.gathered >= 30) unlock('botanico');
    G.player.gainXP(3);
    removeInteract(t);
    QUESTS.event('gather', { id: t.item });
  },
  mine(t) {
    const p = G.player;
    if (!p.equip.weapon || !(ITEMS[p.equip.weapon].chop || invCount(p.inv, 'picareta'))) {
      /* precisa de picareta ou machado equipado */
    }
    t.hp--;
    AUDIO.play('mine');
    spawnHitFX(t.x, t.y + 0.5, t.z);
    if (t.hp <= 0) {
      const n = randi(1, 3);
      spawnPickup(t.x, t.z, 'ferro', n);
      if (Math.random() < 0.2) spawnPickup(t.x, t.z, 'gema', 1);
      spawnPickup(t.x, t.z, 'pedra', randi(1, 2));
      removeInteract(t);
      G.stats.gathered++;
      p.gainXP(6);
    }
  },
  openChest(t) {
    if (G.flags['chest_' + t.cid]) { UI.toast('Baú vazio.'); return; }
    G.flags['chest_' + t.cid] = true;
    AUDIO.play('open');
    const loot = rollLoot(t.loot);
    loot.forEach(l => {
      if (l.id === 'ouro') { G.player.gold += l.q; UI.toast('+' + l.q + ' 🪙 ouro', 'gold'); }
      else { invAdd(G.player.inv, l.id, l.q); UI.toast('+' + l.q + ' ' + ITEMS[l.id].i + ' ' + ITEMS[l.id].n, 'gold'); }
    });
    AUDIO.play('coin');
    G.player.gainXP(20);
    if (t.mesh) { const lid = t.mesh.children[1]; if (lid) lid.rotation.x = -1; }
  },
  sleep(t) {
    if (G.time.t > 6 && G.time.t < 20) { UI.toast('Só dá para dormir à noite.'); return; }
    AUDIO.play('sleep');
    UI.toast('😴 Dormindo até o amanhecer...');
    G.paused = true;
    const fade = document.getElementById('fade');
    fade.style.opacity = '1';
    setTimeout(() => {
      G.time.t = 6.2; G.time.day++;
      G.player.energy = 100;
      G.player.hp = Math.min(G.player.maxhp, G.player.hp + G.player.maxhp * 0.5);
      G.player.stam = G.player.maxstam;
      if (G.player.diseases.resfriado > 0) G.player.diseases.resfriado = Math.max(0, G.player.diseases.resfriado - 40);
      this.onNewDay();
      fade.style.opacity = '0';
      G.paused = false;
      UI.refreshBars();
    }, 1400);
  },
  drinkWater() {
    G.player.thirst = Math.min(100, G.player.thirst + 35);
    /* rehidrata o cantil se tiver */
    const c = G.player.inv.find(s => s.id === 'cantil');
    AUDIO.play('drink');
    UI.toast('💧 Você bebe água fresca.');
    UI.refreshBars();
    /* pequena chance de doença em pântano */
    if (moistureAt(G.player.pos.x, G.player.pos.z) > 0.62 && Math.random() < 0.15 && !G.player.diseases.veneno) {
      G.player.diseases.veneno = 20; UI.toast('🤢 A água estava contaminada!', 'bad');
    }
  },
  fish(t) {
    if (this._fishing) return;
    this._fishing = true;
    UI.toast('🎣 Lançando a linha...');
    AUDIO.play('splash');
    G.paused = false;
    const wait = rand(1.5, 4);
    setTimeout(() => {
      this._fishing = false;
      if (Math.random() < 0.8) {
        const catchTable = ['peixe_cru', 'peixe_cru', 'peixe_cru', 'frutas', 'raiz'];
        if (Math.random() < 0.05) { invAdd(G.player.inv, 'gema', 1); UI.toast('💎 Você fisgou uma gema!', 'gold'); }
        else { const it = pick(catchTable); invAdd(G.player.inv, it, 1); UI.toast('🐟 Fisgou: ' + ITEMS[it].n + '!', 'gold'); G.stats.fish++; }
        AUDIO.play('pickup');
        G.player.gainXP(8);
        if (G.stats.fish >= 10) unlock('pescador');
        QUESTS.event('gather', { id: 'peixe_cru' });
      } else UI.toast('O peixe escapou...');
    }, wait * 1000);
  },
  usePortal(t) {
    const fade = document.getElementById('fade');
    fade.style.opacity = '1';
    AUDIO.play('open');
    setTimeout(() => {
      G.inCave = t.cave;
      G.player.pos.set(t.to.x, terrainHeight(t.to.x, t.to.z), t.to.z);
      G.player.model.position.copy(G.player.pos);
      ensureChunks(t.to.x, t.to.z);
      fade.style.opacity = '0';
      UI.toast(t.cave ? '🕳️ Você entra na escuridão...' : '☀️ De volta à superfície.');
    }, 700);
  },
  questBoard(v) {
    /* oferece missões secundárias disponíveis */
    const pool = ['caca', 'ervas', 'lobos', 'minerio', 'pesca', 'tesouro'];
    const avail = pool.filter(k => !QUESTS.active.find(q => q.key === k) && (!QUESTS.completed[k] || QUESTS.sideDefs[k].repeat));
    if (!avail.length) { UI.toast('Nenhuma missão nova no quadro agora.'); return; }
    const options = avail.slice(0, 4).map(k => ({
      label: '📜 ' + QUESTS.sideDefs[k].title, action: () => QUESTS.addSide(k, v && v.name)
    }));
    options.push({ label: 'Sair' });
    UI.showDialog({ name: '📋 Quadro de Missões' }, { text: 'Cartazes cobrem o quadro. Que trabalho você aceita?', options });
  },

  tameHorse(h) {
    if (h.owned) { G.player.mountHorse(h); return; }
    /* mini-jogo de aproximação: chance sobe se agachado e devagar */
    h.calm = (h.calm || 0) + (G.player.crouching ? 34 : 18);
    ENT.bubble(h, h.calm > 60 ? '💛' : '❔');
    AUDIO.play('horse');
    if (h.calm >= 100) {
      h.owned = true; h.hostile = false;
      h.hname = pick(['Trovão', 'Relâmpago', 'Bravo', 'Estrela', 'Sombra', 'Aurora', 'Brasa', 'Vento']);
      G.player.horsesOwned.push(h);
      unlock('domador');
      G.stats.tamed++;
      UI.toast('🐴 Você domou ' + h.hname + '! Interaja para montar.', 'gold');
      AUDIO.play('quest');
      /* dá uma sela se não tiver */
      if (invCount(G.player.inv, 'sela') === 0) { invAdd(G.player.inv, 'sela', 1); h.saddle = true; }
      G.player.gainXP(40);
    } else {
      UI.toast('🐴 O cavalo está ' + (h.calm > 60 ? 'quase calmo' : 'nervoso') + '... (' + Math.min(100, h.calm | 0) + '%) Agache e continue.');
    }
  },

  petInteract(pet) {
    if (pet.adoptable && !pet.owner) return this.adoptPet(pet);
    /* já é seu: menu rápido */
    const options = [
      { label: '❤️ Fazer carinho', action: () => pet.petAction() },
      { label: '🐾 ' + (G.player.activePet === pet ? 'Já ativo' : 'Tornar companheiro ativo'), action: () => this.setActive(pet) },
      { label: '🍖 Alimentar', action: () => { const food = G.player.inv.find(s => ITEMS[s.id].food || ITEMS[s.id].petfood); if (food && pet.feed(food.id)) { invRemove(G.player.inv, food.id, 1); UI.toast(pet.pname + ' comeu.'); } else UI.toast('Sem comida no inventário.'); } },
      { label: 'Sair' },
    ];
    UI.showDialog({ name: pet.pname + ' ' + UI.petEmoji(pet.kind) }, { text: 'Seu companheiro olha para você com carinho. Nível ' + pet.level + '.', options });
  },
  adoptPet(pet) {
    const doAdopt = (name) => {
      pet.owner = G.player; pet.adoptable = false; pet.wild = false;
      pet.pname = name;
      pet.persistent = true;
      pet.hostile = false;
      G.player.petsOwned.push(pet);
      this.setActive(pet);
      pet.updateLabel();
      unlock('melhor_amigo');
      UI.toast('🐾 Você adotou ' + name + '! Um novo amigo se junta a você.', 'gold');
      AUDIO.play('quest');
      G.player.gainXP(30);
    };
    const suggestions = { cachorro: ['Rex', 'Bidu', 'Thor'], gato: ['Frajola', 'Mimi', 'Félix'], papagaio: ['Loro', 'Pirata', 'Coco'], coruja: ['Atena', 'Hedwig', 'Sábio'], raposa: ['Ruiva', 'Flama', 'Fenn'], lobo: ['Fenrir', 'Luna', 'Ghost'] };
    const names = suggestions[pet.kind] || ['Amigo'];
    UI.showDialog({ name: 'Um ' + pet.kind + ' selvagem' }, {
      text: 'O ' + pet.kind + ' se aproxima cautelosamente. Deseja adotá-lo? Escolha um nome:',
      options: names.map(n => ({ label: '🐾 Chamar de "' + n + '"', action: () => doAdopt(n) })).concat([{ label: 'Agora não' }]),
    });
  },
  setActive(pet) {
    if (G.player.activePet && G.player.activePet !== pet) { /* guarda o anterior */ }
    G.player.setActivePet(pet);
    if (!ENT.all.includes(pet)) ENT.add(pet);
    pet.pos.set(G.player.pos.x + 1, 0, G.player.pos.z + 1);
    pet.pos.y = terrainHeight(pet.pos.x, pet.pos.z);
    UI.toast('🐾 ' + pet.pname + ' agora segue você!');
  },

  whistlePet() {
    if (!G.player.activePet) { UI.toast('Nenhum companheiro ativo.'); return; }
    AUDIO.play('whistle');
    const pet = G.player.activePet;
    pet.pos.set(G.player.pos.x + rand(-1, 1), 0, G.player.pos.z + rand(-1, 1));
    pet.pos.y = terrainHeight(pet.pos.x, pet.pos.z);
    /* cachorro busca item; combativos atacam alvo próximo */
    const hostile = ENT.nearestHostile(30);
    if (hostile && pet.combat) { pet.target = hostile; ENT.bubble(pet, '💢'); }
    else { pet.petAction(); }
  },

  petAction(pet, act, refresh) {
    const p = G.player;
    if (act === 'summon') { this.setActive(pet); }
    else if (act === 'feed') {
      const food = p.inv.find(s => ITEMS[s.id].food || ITEMS[s.id].petfood);
      if (food && pet.feed(food.id)) { invRemove(p.inv, food.id, 1); UI.toast(pet.pname + ' foi alimentado!'); }
      else UI.toast('Você não tem comida.', 'bad');
    } else if (act === 'pet') pet.petAction();
    else if (act === 'cure') {
      if (invCount(p.inv, 'remedio') > 0) { invRemove(p.inv, 'remedio', 1); pet.sick = false; pet.happiness = Math.min(100, pet.happiness + 20); pet.updateLabel(); UI.toast('💊 ' + pet.pname + ' foi curado!', 'gold'); AUDIO.play('heal'); }
      else UI.toast('Você precisa de um Remédio de Ervas.', 'bad');
    }
    if (refresh) refresh();
    UI.refreshPets();
  },

  /* ================= DIÁLOGOS DE NPC ================= */
  talkTo(npc) {
    npc.yaw = Math.atan2(G.player.pos.x - npc.pos.x, G.player.pos.z - npc.pos.z);
    /* mercadores abrem loja (com opção de conversar) */
    if (npc.special === 'mira') return this.talkMira(npc);
    if (npc.special === 'aldric') return this.talkAldric(npc);
    if (npc.special === 'bren') return this.talkBren(npc);
    if (npc.special === 'bardo') return this.talkBardo(npc);
    if (npc.special === 'perdido') return this.talkLost(npc);
    if (npc.role === 'mercador') {
      const opts = [{ label: '🛒 Comerciar', action: () => UI.openShop(npc) }];
      /* entrega de secundárias ligadas a este mercador */
      QUESTS.active.forEach(q => { if (QUESTS.sideDefs[q.key].giver === npc.shopType && QUESTS.canComplete(q)) opts.push({ label: '✅ Entregar: ' + QUESTS.sideDefs[q.key].title, action: () => QUESTS.complete(q) }); });
      opts.push({ label: '💬 Conversar', next: { text: this.npcChatter(npc), options: [{ label: 'Até logo' }] } });
      opts.push({ label: 'Sair' });
      return UI.showDialog(npc, { text: this.greet(npc) + ' Interessado em minhas mercadorias?', options: opts });
    }
    if (npc.role === 'guarda') {
      const opts = [];
      QUESTS.active.forEach(q => { if (QUESTS.sideDefs[q.key].giver === 'guarda' && QUESTS.canComplete(q)) opts.push({ label: '✅ Entregar: ' + QUESTS.sideDefs[q.key].title, action: () => QUESTS.complete(q) }); });
      opts.push({ label: '💬 Alguma novidade?', next: { text: this.guardChatter(npc), options: [{ label: 'Obrigado' }] } });
      opts.push({ label: 'Sair' });
      return UI.showDialog(npc, { text: this.greet(npc) + ' Mantenha a ordem, viajante.', options: opts });
    }
    if (npc.role === 'ferreiro') {
      const opts = [{ label: '⚒️ Usar bigorna', action: () => UI.openPanel('craft', 'bigorna') }];
      QUESTS.active.forEach(q => { if (QUESTS.sideDefs[q.key].giver === 'ferreiro' && QUESTS.canComplete(q)) opts.push({ label: '✅ Entregar: ' + QUESTS.sideDefs[q.key].title, action: () => QUESTS.complete(q) }); });
      opts.push({ label: 'Sair' });
      return UI.showDialog(npc, { text: 'O ferreiro limpa as mãos. Precisa forjar algo?', options: opts });
    }
    /* aldeão comum */
    const opts = [{ label: '💬 Conversar', next: { text: this.npcChatter(npc), options: [{ label: 'Até mais' }] } }];
    QUESTS.active.forEach(q => { if ((QUESTS.sideDefs[q.key].giver === 'mira' || QUESTS.sideDefs[q.key].giver === npc.role) && QUESTS.canComplete(q)) opts.push({ label: '✅ Entregar: ' + QUESTS.sideDefs[q.key].title, action: () => QUESTS.complete(q) }); });
    opts.push({ label: 'Sair' });
    UI.showDialog(npc, { text: this.greet(npc), options: opts });
  },
  greet(npc) {
    const g = { alegre: 'Que bom te ver por aqui!', rabugento: 'Hmpf. O que você quer?', timido: 'Ah... olá.', tagarela: 'Ora, ora, um rosto novo!', sabio: 'A jornada o trouxe até mim.' };
    return (g[npc.personality] || 'Saudações.') ;
  },
  npcChatter(npc) {
    const lines = [
      'Dizem que há um tesouro escondido nas montanhas ao norte.',
      'Os lobos têm descido famintos nas noites de tempestade.',
      'Ouvi falar de ruínas antigas onde mortos não descansam.',
      'O Lorde Aldric não sai do castelo há semanas...',
      'Cuidado com os bandidos de Garrick nas estradas.',
      'Minha colheita foi boa este ano, graças aos céus.',
      'Um mercador viajante passou por aqui vendendo coisas raras.',
      'A Anciã Mira sabe mais do que aparenta.',
    ];
    if (ENV && ENV.weather === 'chuva') return 'Esta chuva não passa... bom para as plantações, ao menos. ' + pick(lines);
    return pick(lines);
  },
  guardChatter() { return pick(['Tudo tranquilo no meu turno.', 'Se vir bandidos, avise-nos.', 'A vila dorme em paz graças à nossa vigília.', 'Não cause problemas e não teremos problemas.']); },

  talkMira(npc) {
    const m = QUESTS.main;
    if (m === 0) {
      return UI.showDialog(npc, {
        text: 'Eu esperava por você, andarilho. Um mal antigo desperta — o Eclipse Eterno ameaça engolir Eldoria. Você tem a marca de quem pode detê-lo. Aceita este chamado?',
        options: [
          { label: '⚔️ Aceito o chamado.', action: () => { QUESTS.advanceMain(); invAdd(G.player.inv, 'pocao_hp', 2); UI.toast('Mira lhe deu 2 Poções de Cura.'); }, next: { text: 'Que os antigos o guiem. Vá às Ruínas de Kareth, a leste. Lá jaz a primeira pista — e um perigo. Leve estas poções.', options: [{ label: 'Partirei já.' }] } },
          { label: 'Preciso pensar.', next: { text: 'O tempo é curto, mas a escolha é sua. Volte quando estiver pronto.', options: [{ label: 'Voltarei.' }] } },
        ],
      });
    }
    if (m === 1) return UI.showDialog(npc, { text: 'As Ruínas de Kareth aguardam. Derrote o que perturba os mortos e traga o Fragmento do Eclipse.', options: [{ label: 'A caminho.' }] });
    if (m === 2) {
      if (invCount(G.player.inv, 'fragmento') > 0) return UI.showDialog(npc, { text: 'Você o encontrou! O Fragmento pulsa com energia sombria. Leve-o ao Lorde Aldric no castelo — só ele conhece o ritual.', options: [{ label: 'Irei ao castelo.' }] });
      return UI.showDialog(npc, { text: 'Ainda não sinto o Fragmento com você. Volte a Kareth.', options: [{ label: 'Entendido.' }] });
    }
    /* oferece missão do prisioneiro */
    const opts = [{ label: '💬 Conselho', next: { text: 'Confie em seu coração nas escolhas que virão. Nem todo inimigo precisa cair pela espada.', options: [{ label: 'Obrigado, Anciã.' }] } }];
    if (!QUESTS.active.find(q => q.key === 'prisioneiro') && !QUESTS.completed.prisioneiro && m >= 2) opts.unshift({ label: '📜 Precisa de ajuda?', action: () => QUESTS.addSide('prisioneiro') });
    if (QUESTS.canComplete(QUESTS.active.find(q => q.key === 'prisioneiro') || {})) opts.unshift({ label: '✅ Bren está livre', action: () => QUESTS.complete(QUESTS.active.find(q => q.key === 'prisioneiro')) });
    opts.push({ label: 'Sair' });
    UI.showDialog(npc, { text: 'A profecia se desenrola através de você, andarilho.', options: opts });
  },
  talkAldric(npc) {
    const m = QUESTS.main;
    if (m === 2 && invCount(G.player.inv, 'fragmento') > 0) {
      return UI.showDialog(npc, {
        text: 'Então o Fragmento retorna a estas paredes... Há muito temo este dia. Para desfazer o Eclipse, precisamos de DUAS relíquias. A segunda repousa com a Ursa Anciã, guardiã das cavernas profundas. Mas primeiro — as estradas devem estar seguras. Garrick, o Lorde Bandido, bloqueia o caminho. Cuide dele.',
        options: [{ label: 'Farei o necessário.', action: () => { QUESTS.advanceMain(); } }],
      });
    }
    if (m === 3) return UI.showDialog(npc, { text: 'Garrick ainda perturba minhas estradas. Resolva isso — pela força ou pela razão, a escolha é sua.', options: [{ label: 'Entendido.' }] });
    if (m === 4) return UI.showDialog(npc, { text: 'Excelente trabalho com Garrick. Agora, a Ursa Anciã. Encontre a caverna, enfrente a fera e traga a segunda relíquia. Depois, ao Círculo das Luas ao amanhecer.', options: [{ label: 'Partirei.' }] });
    if (m === 5) return UI.showDialog(npc, { text: 'Você tem as relíquias! Vá ao Círculo das Luas quando o sol nascer. O destino de Eldoria está em suas mãos.', options: [{ label: 'É a hora.' }] });
    return UI.showDialog(npc, { text: 'Governar é um fardo solitário. Sirva bem a esta terra, andarilho.', options: [{ label: 'Milorde.' }] });
  },
  talkBren(npc) {
    if (!G.flags.brenFreed) {
      /* precisa ter limpado o acampamento? permitimos libertar se Garrick resolvido ou inimigos poucos */
      const enemiesNear = ENT.all.filter(e => e instanceof Enemy && e.alive && e.hostile && dist2(e.pos.x, e.pos.z, npc.pos.x, npc.pos.z) < 20).length;
      return UI.showDialog(npc, {
        text: enemiesNear > 0 ? 'Pelos céus, cuidado! Os bandidos ainda rondam! Livre-se deles antes de me soltar!' : 'Você conseguiu! Rápido, quebre a jaula e me tire daqui!',
        options: enemiesNear > 0 ? [{ label: 'Aguarde aqui.' }] : [
          { label: '🔓 Libertar Bren', action: () => { G.flags.brenFreed = true; npc.special = null; npc.home = WORLD.villages[0].homes[0] || { x: WORLD.villages[0].x, z: WORLD.villages[0].z }; npc.village = WORLD.villages[0]; UI.toast('🔓 Você libertou o Escoteiro Bren!', 'gold'); AUDIO.play('quest'); G.player.gainXP(50); } },
          { label: 'Ainda não.' },
        ],
      });
    }
    return UI.showDialog(npc, { text: 'Devo-lhe minha vida! A Anciã Mira ficará grata. Vá contar a ela.', options: [{ label: 'Fico feliz em ajudar.' }] });
  },
  talkBardo(npc) {
    UI.showDialog(npc, {
      text: 'Uma canção pela estrada? Posso lhe contar rumores... por uma moeda, ou de graça a um herói.',
      options: [
        { label: '🎵 Ouvir uma canção (grátis)', action: () => { AUDIO.play('quest'); G.player.stam = G.player.maxstam; UI.toast('🎶 A música restaura seu ânimo!'); } },
        { label: '💬 Rumores', next: { text: pick(['Dizem que a Espada Aurora só aparece a quem derrota o Cavaleiro do Eclipse.', 'Há gemas escondidas nos rios das montanhas geladas.', 'A casa de leilões de Ovídio às vezes tem itens lendários.']), options: [{ label: 'Fascinante.' }] } },
        { label: 'Adeus, bardo.' },
      ],
    });
  },
  talkLost(npc) {
    if (!QUESTS.active.find(q => q.key === 'perdido')) {
      return UI.showDialog(npc, {
        text: 'Graças aos céus, alguém! Perdi-me destes bosques. Pode me levar a uma vila? Eu recompenso!',
        options: [
          { label: '🧭 Escoltá-lo', action: () => { QUESTS.addSide('perdido'); npc.special = 'escorting'; npc.escortNpc = true; const q = QUESTS.active.find(x => x.key === 'perdido'); npc._quest = q; npc.follow = true; } },
          { label: 'Não posso agora.' },
        ],
      });
    }
    UI.showDialog(npc, { text: 'Estou logo atrás de você. Leve-me a uma vila!', options: [{ label: 'Vamos.' }] });
  },

  /* ================= COMÉRCIO ================= */
  buy(npc, i) {
    const s = npc._stock[i]; if (!s || s.q <= 0) return;
    const price = priceBuy(s.id, s.mult);
    if (G.player.gold < price) { UI.toast('Ouro insuficiente!', 'bad'); AUDIO.play('fail'); return; }
    G.player.gold -= price; s.q--;
    invAdd(G.player.inv, s.id, 1);
    G.stats.trades++;
    AUDIO.play('coin');
    UI.toast('Comprou ' + ITEMS[s.id].n);
    UI.refreshStats();
  },
  sell(npc, id) {
    if (invCount(G.player.inv, id) <= 0) return;
    const price = priceSell(id);
    invRemove(G.player.inv, id, 1);
    G.player.gold += price;
    AUDIO.play('coin');
    UI.refreshStats();
  },

  /* ================= CRIAÇÃO ================= */
  craft(rid, station) {
    const rc = RECIPES.find(r => r.id === rid); if (!rc) return;
    for (const id in rc.need) if (invCount(G.player.inv, id) < rc.need[id]) { AUDIO.play('fail'); return; }
    for (const id in rc.need) invRemove(G.player.inv, id, rc.need[id]);
    if (rc.place === 'campfire') {
      placeCampfire(G.player.pos.x + Math.sin(G.player.yaw) * 2, G.player.pos.z + Math.cos(G.player.yaw) * 2);
      UI.toast('🔥 Fogueira montada!');
    } else {
      invAdd(G.player.inv, rc.out, rc.outQ || 1);
      const isCook = rc.where === 'fogueira' && ITEMS[rc.out].t === 'comida';
      if (isCook) { G.stats.cooked++; QUESTS.event('cook', {}); if (G.stats.cooked >= 20) unlock('cozinheiro'); AUDIO.play('fire'); }
      else AUDIO.play(station === 'bigorna' ? 'anvil' : 'craft');
      UI.toast('🔨 Criou ' + ITEMS[rc.out].n + (rc.outQ ? ' ×' + rc.outQ : ''));
    }
    QUESTS.event('craft', {});
    G.player.gainXP(6);
    UI.refreshStats();
  },

  /* ================= USO DE ITENS ================= */
  useItem(id) {
    const p = G.player, def = ITEMS[id];
    if (!def || invCount(p.inv, id) <= 0) return;
    if (def.t === 'arma' || def.t === 'arco' || def.t === 'magiafoco') { p.equip.weapon = id; p.applyEquipVisual(); UI.refreshHotbar(); AUDIO.play('ui'); UI.toast('Equipou ' + def.n); }
    else if (def.t === 'escudo') { p.equip.offhand = id; p.applyEquipVisual(); UI.refreshHotbar(); AUDIO.play('ui'); UI.toast('Equipou ' + def.n); }
    else if (def.t === 'luz') { p.equip.offhand = p.equip.offhand === id ? null : id; p.applyEquipVisual(); UI.refreshHotbar(); UI.toast(p.equip.offhand ? '🔥 Tocha acesa' : 'Tocha guardada'); }
    else if (def.t === 'armadura') { p.equip.armor = id; p.applyEquipVisual(); UI.toast('Vestiu ' + def.n); AUDIO.play('ui'); }
    else if (def.t === 'amuleto') { p.equip.amulet = p.equip.amulet === id ? null : id; UI.toast(p.equip.amulet ? 'Usando ' + def.n : 'Removeu amuleto'); AUDIO.play('ui'); }
    else if (def.t === 'comida') {
      if (def.raw && Math.random() < 0.3) { p.diseases.veneno = 15; UI.toast('🤢 Comida crua caiu mal!', 'bad'); }
      const mult = p.has('cozinheiro') && !def.raw ? 1.5 : 1;
      p.hunger = Math.min(100, p.hunger + (def.food || 0) * mult);
      if (def.water) p.thirst = Math.min(100, p.thirst + def.water);
      if (def.hp) p.hp = Math.min(p.maxhp, p.hp + def.hp * mult);
      invRemove(p.inv, id, 1); AUDIO.play('eat'); UI.toast('Comeu ' + def.n); UI.refreshBars();
    }
    else if (def.t === 'bebida') { p.thirst = Math.min(100, p.thirst + (def.water || 0)); if (def.food) p.hunger = Math.min(100, p.hunger + def.food); invRemove(p.inv, id, 1); AUDIO.play('drink'); UI.refreshBars(); UI.toast('Bebeu ' + def.n); }
    else if (def.t === 'pocao') {
      const mult = p.has('alquimia') ? 1.5 : 1;
      if (def.hp) p.hp = Math.min(p.maxhp, p.hp + def.hp * mult);
      if (def.stam) p.stam = Math.min(p.maxstam, p.stam + def.stam * mult);
      if (def.mana) p.mana = Math.min(p.maxmana, p.mana + def.mana * mult);
      if (def.cure) delete p.diseases[def.cure];
      invRemove(p.inv, id, 1); AUDIO.play('heal'); UI.toast('Usou ' + def.n); UI.refreshBars();
    }
    else if (id === 'mapa_tesouro') UI.toast('🗺️ O X marca um local a ' + UI.bearing((QUESTS.active.find(q => q.key === 'tesouro') || {}).tx - p.pos.x, 0) + '. Veja o mapa (M).');
    else UI.toast(def.n + ' — ' + (def.t === 'material' ? 'material de criação' : 'sem uso direto'));
    UI.refreshHotbar();
  },
  quickPotion() { const s = G.player.inv.find(x => ITEMS[x.id].t === 'pocao' && ITEMS[x.id].hp); if (s) this.useItem(s.id); else UI.toast('Sem poções de cura.'); },
  quickFood() { const s = G.player.inv.find(x => ITEMS[x.id].t === 'comida' && !ITEMS[x.id].raw); if (s) this.useItem(s.id); else UI.toast('Sem comida pronta.'); },
  toggleTorch() { const p = G.player; if (invCount(p.inv, 'tocha') > 0) { p.equip.offhand = p.equip.offhand === 'tocha' ? null : 'tocha'; p.applyEquipVisual(); UI.refreshHotbar(); UI.toast(p.equip.offhand === 'tocha' ? '🔥 Tocha acesa' : 'Tocha guardada'); } else UI.toast('Você não tem uma tocha.'); },

  /* ================= SAVE / LOAD ================= */
  save() {
    try {
      const data = G.player.serialize();
      data.seed = G.seed;
      data.pets = G.player.petsOwned.map(p => p.serialize());
      data.time = { t: G.time.t, day: G.time.day, speed: G.time.speed };
      localStorage.setItem('eldoria_save', JSON.stringify(data));
      UI.toast('💾 Jogo salvo!', 'gold');
      AUDIO.play('quest');
    } catch (e) { UI.toast('Erro ao salvar: ' + e.message, 'bad'); }
  },
  applySave(s) {
    const p = G.player;
    Object.assign(p, {
      level: s.level, xp: s.xp, xpNext: s.xpNext, skillPoints: s.skillPoints, skills: s.skills || {},
      maxhp: s.maxhp, hp: s.hp, maxstam: s.maxstam, maxmana: s.maxmana, mana: s.mana, gold: s.gold,
      hunger: s.hunger, thirst: s.thirst, temp: s.temp, diseases: s.diseases || {}, barter: s.barter || 0,
      inv: s.inv || p.inv, equip: s.equip || p.equip, spell: s.spell || 'gelo',
    });
    if (s.pos) { p.pos.set(s.pos.x, terrainHeight(s.pos.x, s.pos.z), s.pos.z); }
    if (s.time) G.time = s.time;
    G.flags = s.flags || {}; G.rep = s.rep || {}; G.discovered = s.discovered || {};
    G.achievements = s.achievements || {}; G.stats = s.stats || G.stats;
    WORLD.pois.forEach(poi => { if (G.discovered[poi.id]) poi.discovered = true; });
    QUESTS.load(s.quests);
    /* restaura pets */
    (s.pets || []).forEach(pd => {
      const pet = new Pet(pd.kind, p.pos.x, p.pos.z, pd);
      pet.owner = p; pet.adoptable = false; pet.persistent = true;
      p.petsOwned.push(pet);
    });
    if (p.petsOwned.length) { const first = p.petsOwned[0]; ENT.add(first); p.setActivePet(first); }
    p.applyEquipVisual();
    UI.toast('📂 Jogo carregado.', 'gold');
  },
  load() { this.startWorld(null, true); },
};

/* auto-save periódico */
setInterval(() => { if (G.state === 'play' && G.player) { try { GAME.save(); } catch (e) {} } }, 120000);

/* escort de viajante perdido: entrega ao chegar numa vila */
setInterval(() => {
  if (G.state !== 'play') return;
  ENT.all.forEach(npc => {
    if (npc.escortNpc && npc.follow && !npc._delivered) {
      npc.work = { x: G.player.pos.x, z: G.player.pos.z };
      for (const v of WORLD.villages) {
        if (dist2(G.player.pos.x, G.player.pos.z, v.x, v.z) < v.r + 6) {
          npc._delivered = true; npc.follow = false;
          const q = QUESTS.active.find(x => x.key === 'perdido');
          if (q) { q.delivered = true; QUESTS.complete(q); }
          UI.toast('🧭 O viajante chegou em segurança!', 'gold');
          npc.despawnT = 8;
        }
      }
    }
  });
  /* tesouro: cava ao chegar no X com pá */
  const tq = QUESTS.active.find(q => q.key === 'tesouro');
  if (tq && !tq.dug && dist2(G.player.pos.x, G.player.pos.z, tq.tx, tq.tz) < 6) {
    tq.dug = true;
    UI.toast('⛏️ Você desenterra o tesouro!', 'gold');
    AUDIO.play('dig');
    spawnPickup(tq.tx, tq.tz, 'gema', 2);
    G.player.gold += 60;
    QUESTS.complete(tq);
  }
}, 1500);

/* inicialização */
addEventListener('DOMContentLoaded', () => GAME.boot());
