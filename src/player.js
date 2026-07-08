/* =====================================================================
   player.js — Jogador: movimento, câmera, combate, sobrevivência, skills
   ===================================================================== */
'use strict';

const SKILL_TREE = {
  guerreiro: { name: 'Guerreiro', icon: '⚔️', skills: [
    ['forca', 'Força Bruta', '+15% dano corpo a corpo', 1],
    ['vigor_g', 'Constituição', '+25 vida máxima', 1],
    ['furia', 'Fúria', 'Contra-ataques causam dano dobrado', 2],
    ['imparavel', 'Imparável', 'Investidas não podem ser interrompidas', 3],
  ]},
  cacador: { name: 'Caçador', icon: '🏹', skills: [
    ['pontaria', 'Pontaria', '+20% dano à distância', 1],
    ['agilidade', 'Agilidade', '+20 vigor máximo, esquivas mais baratas', 1],
    ['rastreador', 'Rastreador', 'Animais e ervas aparecem no mapa', 2],
    ['tiro_duplo', 'Tiro Duplo', 'Arcos disparam 2 flechas', 3],
  ]},
  mago: { name: 'Arcano', icon: '🔮', skills: [
    ['foco', 'Foco Arcano', '+30 mana máxima', 1],
    ['chamas', 'Chamas', 'Desbloqueia Bola de Fogo (área)', 1],
    ['cura', 'Toque Curativo', 'Desbloqueia magia de Cura', 2],
    ['maestria', 'Maestria', 'Magias custam 30% menos mana', 3],
  ]},
  sobrevivente: { name: 'Andarilho', icon: '🏕️', skills: [
    ['resistencia', 'Resistência', 'Fome, sede e frio caem 40% mais devagar', 1],
    ['barganha', 'Barganha', 'Melhores preços com mercadores', 1],
    ['cozinheiro', 'Cozinheiro', 'Comidas restauram +50%', 2],
    ['alquimia', 'Alquimia', 'Poções são 50% mais potentes', 3],
  ]},
};

class Player {
  constructor(appearance) {
    this.isPlayer = true;
    this.app = appearance;
    this.pos = new THREE.Vector3(0, 0, 0);
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0.2; this.bodyYaw = 0;
    this.onGround = true; this.grounded = true;
    this.height = 1.75 * (appearance.height || 1);
    this.radius = 0.4;

    /* atributos */
    this.level = 1; this.xp = 0; this.xpNext = 100;
    this.skillPoints = 0; this.skills = {};
    this.maxhp = 100; this.hp = 100;
    this.maxstam = 100; this.stam = 100;
    this.maxmana = 50; this.mana = 50;
    this.gold = 40;

    /* sobrevivência */
    this.hunger = 100; this.thirst = 100; this.energy = 100;
    this.temp = 50; /* 0 congelando, 100 fervendo, 50 confortável */
    this.diseases = {}; /* veneno, resfriado, sangrando */

    /* combate */
    this.attackCd = 0; this.rollCd = 0; this.blocking = false;
    this.attackAnim = 0; this.invuln = 0; this.hurtFlash = 0;
    this.comboT = 0; this.combo = 0;
    this.barter = 0;

    /* inventário e equipamento */
    this.inv = [];
    ['faca', 'roupa', 'pao', 'pao', 'maca', 'cantil', 'tocha', 'madeira', 'pedra', 'flecha'].forEach(id => invAdd(this.inv, id, id === 'flecha' ? 12 : (id === 'pao' ? 1 : (id === 'madeira' ? 3 : (id === 'pedra' ? 2 : 1)))));
    invAdd(this.inv, 'pocao_hp', 2);
    this.equip = { weapon: 'faca', offhand: null, armor: 'roupa', amulet: null };
    this.spell = 'gelo';

    /* montaria/pets */
    this.mount = null; this.activePet = null;
    this.horsesOwned = []; this.petsOwned = [];

    this.build();
    this.swimming = false; this.crouching = false;
    this.stepT = 0; this.footSurf = 'grass';
    this.lastX = 0; this.lastZ = 0;
    this.interactTarget = null;
  }

  build() {
    const a = this.app;
    const mk = makeHumanoid({
      gender: a.gender, skin: a.skin, hair: a.hair, eyes: a.eyes,
      hairStyle: a.hairStyle, beard: a.beard, build: a.build, height: a.height,
      shirt: 0x4a5a6a, pants: 0x3a3028,
    });
    this.model = mk.group; this.parts = mk.parts;
    G.scene.add(this.model);
    this.applyEquipVisual();
  }
  applyEquipVisual() {
    if (this.heldMesh) this.parts.hand.remove(this.heldMesh);
    if (this.offMesh) this.parts.offhand.remove(this.offMesh);
    this.heldMesh = makeHeldMesh(this.equip.weapon);
    this.parts.hand.add(this.heldMesh);
    if (this.equip.offhand) { this.offMesh = makeHeldMesh(this.equip.offhand); this.parts.offhand.add(this.offMesh); }
    else this.offMesh = null;
    /* cor da armadura */
    const armorColors = { roupa: 0x4a5a6a, couro: 0x6a4a2e, malha: 0x777c85, placas: 0x9a9ca0, casaco: 0x5a4030 };
    const c = armorColors[this.equip.armor] || 0x4a5a6a;
    this.parts.torso.material = lam(c);
    this.parts.armL.children[0].material = lam(c);
    this.parts.armR.children[0].material = lam(c);
  }

  weaponDef() { return ITEMS[this.equip.weapon] || ITEMS.faca; }
  armorDef() { return ITEMS[this.equip.armor]; }
  totalDef() {
    let d = (this.armorDef() ? this.armorDef().def || 0 : 0);
    if (this.equip.offhand && ITEMS[this.equip.offhand] && ITEMS[this.equip.offhand].def) d += ITEMS[this.equip.offhand].def;
    if (this.equip.amulet && ITEMS[this.equip.amulet] && ITEMS[this.equip.amulet].def) d += ITEMS[this.equip.amulet].def;
    return d;
  }
  has(sk) { return !!this.skills[sk]; }

  gainXP(n) {
    this.xp += n;
    UI.floatXP(n);
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++; this.skillPoints++;
      this.xpNext = Math.floor(this.xpNext * 1.35);
      this.maxhp += 8; this.hp = this.maxhp;
      this.maxstam += 4; this.stam = this.maxstam;
      this.maxmana += 3; this.mana = this.maxmana;
      AUDIO.play('levelup');
      UI.toast('⭐ Nível ' + this.level + '! +1 ponto de habilidade', 'gold');
      if (this.level >= 10) unlock('nivel10');
      if (this.level >= 20) unlock('lenda');
      UI.refreshStats();
    }
    UI.refreshStats();
  }

  learnSkill(tree, id) {
    if (this.skillPoints <= 0 || this.skills[id]) return false;
    this.skills[id] = true; this.skillPoints--;
    /* aplica efeitos passivos */
    if (id === 'vigor_g') { this.maxhp += 25; this.hp += 25; }
    if (id === 'agilidade') { this.maxstam += 20; this.stam += 20; }
    if (id === 'foco') { this.maxmana += 30; this.mana += 30; }
    if (id === 'barganha') this.barter += 3;
    AUDIO.play('craft');
    UI.refreshStats();
    return true;
  }

  gold_ok(n) { return this.gold >= n; }

  /* ---------------- dano e morte ---------------- */
  takeDamage(dmg, from) {
    if (this.invuln > 0 || !this.hp) return;
    let d = dmg;
    if (this.blocking && this.stam > 10) {
      const shield = this.equip.offhand && ITEMS[this.equip.offhand] && ITEMS[this.equip.offhand].def ? ITEMS[this.equip.offhand].def : 2;
      d = Math.max(0, d - shield * 1.8);
      this.stam -= 12;
      AUDIO.play('hitBlock');
      this.parryFrom = from; this.parryT = 0.5;
      if (d <= 0) { UI.toast('🛡️ Bloqueado!'); return; }
    } else {
      d = Math.max(1, d - this.totalDef() * 0.6);
    }
    this.hp -= d;
    this.hurtFlash = 0.4; this.invuln = 0.35;
    AUDIO.play('hurt');
    UI.damageNum(this.pos.x, this.pos.y + 1.9, this.pos.z, Math.round(d), '#ff4444');
    UI.hurtVignette();
    if (Math.random() < 0.12 && from && d > 6 && !this.diseases.sangrando) { this.diseases.sangrando = 40; UI.toast('🩸 Você está sangrando!', 'bad'); }
    if (this.hp <= 0) this.die();
    UI.refreshBars();
  }
  die() {
    this.hp = 0;
    G.state = 'dead';
    AUDIO.play('die');
    UI.showDeath();
  }
  respawn() {
    this.hp = this.maxhp * 0.5; this.stam = this.maxstam; this.mana = this.maxmana;
    this.hunger = Math.max(30, this.hunger); this.thirst = Math.max(30, this.thirst);
    this.diseases = {};
    const v = WORLD.villages[0];
    this.pos.set(v.x, terrainHeight(v.x, v.z), v.z);
    if (this.mount) this.dismount();
    G.state = 'play'; G.inCave = false;
    UI.refreshBars();
  }

  /* ---------------- ações ---------------- */
  attack() {
    if (this.attackCd > 0 || this.stam < 6) return;
    const w = this.weaponDef();
    if (w.t === 'arco') return this.shoot();
    if (w.t === 'magiafoco') return this.cast();
    this.attackCd = 1 / (w.spd || 1);
    this.stam -= 6;
    this.attackAnim = 1;
    /* combo */
    if (this.comboT > 0) this.combo = (this.combo + 1) % 3; else this.combo = 0;
    this.comboT = 0.8;
    AUDIO.play('swing');
    const reach = w.rng || 2, arc = 1.4;
    let dmg = (w.dmg || 4) + this.level * 0.5;
    if (this.has('forca')) dmg *= 1.15;
    if (this.equip.amulet === 'anel_lobo') dmg *= 1.1;
    if (this.combo === 2) dmg *= 1.5; /* finalizador */
    const fx = this.pos.x + Math.sin(this.yaw) * reach * 0.6;
    const fz = this.pos.z + Math.cos(this.yaw) * reach * 0.6;
    setTimeout(() => {
      let hitAny = false;
      for (const e of ENT.all) {
        if (!e.alive || e === this.activePet || (e instanceof Pet) || (e instanceof Horse && e.owned) || (e instanceof NPC && e.role !== 'guarda' && !e.hostile && !INPUT.forceHit)) {
          if (e instanceof NPC && e.role !== 'guarda' && !e.hostile) { /* precisa mirar bem para acertar NPC */ }
          else continue;
        }
        const d = dist2(this.pos.x, this.pos.z, e.pos.x, e.pos.z);
        if (d > reach + e.radius) continue;
        const ang = Math.atan2(e.pos.x - this.pos.x, e.pos.z - this.pos.z);
        let da = Math.abs(((ang - this.yaw + Math.PI) % TAU) - Math.PI);
        if (da < arc) {
          e.takeDamage(dmg * rand(0.9, 1.1), 'player');
          hitAny = true;
          if (w.chop && e === null) {}
        }
      }
      /* cortar árvores / minerar com machado/picareta ou faca */
      const cs = queryColliders(fx, fz, 2.5);
      for (const c of cs) {
        if (c.tree && c.hp > 0 && dist2(this.pos.x, this.pos.z, c.x, c.z) < reach + 0.6) {
          const ang = Math.atan2(c.x - this.pos.x, c.z - this.pos.z);
          if (Math.abs(((ang - this.yaw + Math.PI) % TAU) - Math.PI) < arc) {
            c.hp -= w.chop ? 3 : 1;
            AUDIO.play('chop');
            spawnHitFX(c.x, c.h + 1.5, c.z);
            if (c.hp <= 0) {
              c.chunk.hideTree(c); removeCollider(c);
              const n = randi(2, 4);
              spawnPickup(c.x, c.z, 'madeira', n);
              if (Math.random() < 0.3) spawnPickup(c.x + 1, c.z, 'pena', 1);
              G.stats.gathered++;
            }
            hitAny = true;
          }
        }
      }
      if (!hitAny) AUDIO.play('swing');
    }, 120);
  }
  shoot() {
    if (invCount(this.inv, 'flecha') <= 0 && this.equip.weapon !== 'cajado') { UI.toast('Sem flechas!', 'bad'); AUDIO.play('fail'); return; }
    const w = this.weaponDef();
    this.attackCd = 1 / (w.spd || 0.9);
    this.stam -= 4;
    this.attackAnim = 1;
    invRemove(this.inv, 'flecha', 1);
    let dmg = (w.dmg || 10) + this.level * 0.5;
    if (this.has('pontaria')) dmg *= 1.2;
    const dir = new THREE.Vector3(Math.sin(this.yaw), Math.sin(this.pitch) * 0.5 + 0.02, Math.cos(this.yaw)).normalize();
    const ox = this.pos.x + Math.sin(this.yaw) * 0.6, oz = this.pos.z + Math.cos(this.yaw) * 0.6;
    fireProjectile(ox, this.pos.y + 1.4, oz, dir, dmg, 'player', 'flecha');
    if (this.has('tiro_duplo') && invCount(this.inv, 'flecha') > 0) {
      invRemove(this.inv, 'flecha', 1);
      const d2 = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.12);
      setTimeout(() => fireProjectile(ox, this.pos.y + 1.4, oz, d2, dmg, 'player', 'flecha'), 90);
    }
    UI.refreshHotbar();
  }
  cast() {
    const isFire = this.spell === 'fogo';
    let cost = isFire ? 25 : 15;
    if (this.spell === 'cura') cost = 30;
    if (this.has('maestria')) cost *= 0.7;
    if (this.mana < cost) { UI.toast('Sem mana!', 'bad'); AUDIO.play('fail'); return; }
    this.mana -= cost;
    this.attackCd = 0.8;
    this.attackAnim = 1;
    if (this.spell === 'cura') {
      const heal = 40 * (this.has('alquimia') ? 1.3 : 1);
      this.hp = Math.min(this.maxhp, this.hp + heal);
      AUDIO.play('heal');
      UI.damageNum(this.pos.x, this.pos.y + 2, this.pos.z, '+' + Math.round(heal), '#66ff88');
      for (let i = 0; i < 8; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.08), new THREE.MeshBasicMaterial({ color: 0x88ffaa })); m.position.set(this.pos.x + rand(-0.5, 0.5), this.pos.y + rand(0, 2), this.pos.z + rand(-0.5, 0.5)); G.scene.add(m); G.particles.push({ mesh: m, vy: 1.5, t: 0.8 }); }
      UI.refreshBars();
      return;
    }
    let dmg = (isFire ? 26 : 16) + this.level * 0.8;
    dmg *= (this.weaponDef().mag || 1);
    const dir = new THREE.Vector3(Math.sin(this.yaw), Math.sin(this.pitch) * 0.4, Math.cos(this.yaw)).normalize();
    fireProjectile(this.pos.x + Math.sin(this.yaw) * 0.8, this.pos.y + 1.5, this.pos.z + Math.cos(this.yaw) * 0.8, dir, dmg, 'player', isFire ? 'fogo' : 'magia');
    UI.refreshBars();
  }
  roll() {
    const cost = this.has('agilidade') ? 12 : 20;
    if (this.rollCd > 0 || this.stam < cost || this.swimming) return;
    this.rollCd = 0.7; this.stam -= cost;
    this.invuln = 0.5; this.rolling = 0.45;
    const dir = (INPUT.mv.x || INPUT.mv.y) ? Math.atan2(this.mvWorldX, this.mvWorldZ) : this.yaw;
    this.rollDir = dir;
    AUDIO.play('step', { surf: this.footSurf });
  }
  jump() {
    if (this.swimming) { this.vel.y = 4; return; }
    if (this.onGround && this.stam > 5) { this.vel.y = 6.2; this.onGround = false; this.stam -= 5; }
  }

  interact() {
    const t = this.interactTarget;
    if (!t) {
      /* montar cavalo próprio? */
      if (this.mount) return this.dismount();
      return;
    }
    GAME.handleInteract(t);
  }

  mountHorse(h) {
    this.mount = h; h.ridden = true; h.owned = true;
    h.group.add(this.model);
    this.model.position.set(0, h.cfg.leg + h.cfg.bh + 0.2, -0.1);
    AUDIO.play('horse');
    UI.toast('🐴 Montando ' + (h.hname || 'cavalo') + '. Espaço para desmontar.');
  }
  dismount() {
    const h = this.mount; if (!h) return;
    h.ridden = false;
    G.scene.add(this.model);
    this.pos.set(h.pos.x + 1.5, h.pos.y, h.pos.z);
    this.model.position.copy(this.pos);
    h.summoned = false;
    this.mount = null;
  }

  setActivePet(pet) {
    this.activePet = pet;
    UI.refreshPets();
  }

  /* ---------------- atualização por frame ---------------- */
  update(dt) {
    if (G.state !== 'play') return;
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.rollCd = Math.max(0, this.rollCd - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.comboT = Math.max(0, this.comboT - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);
    if (this.attackAnim > 0) this.attackAnim = Math.max(0, this.attackAnim - dt * 3.2);
    if (this.rolling > 0) this.rolling -= dt;
    if (this.parryT > 0) this.parryT -= dt;

    /* câmera segue entrada de olhar */
    this.yaw -= INPUT.look.dx * 0.0032;
    this.pitch = clamp(this.pitch - INPUT.look.dy * 0.0032, -0.9, 0.9);

    const riding = !!this.mount;
    this.blocking = INPUT.block && !riding && this.weaponDef().t !== 'arco';

    /* movimento no plano da câmera */
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const rx = Math.sin(this.yaw + Math.PI / 2), rz = Math.cos(this.yaw + Math.PI / 2);
    let mx = fx * INPUT.mv.y + rx * INPUT.mv.x;
    let mz = fz * INPUT.mv.y + rz * INPUT.mv.x;
    const mlen = Math.hypot(mx, mz);
    if (mlen > 0.01) { mx /= mlen; mz /= mlen; }
    this.mvWorldX = mx; this.mvWorldZ = mz;

    this.crouching = INPUT.crouch && this.onGround && !this.swimming;
    let running = INPUT.run && this.stam > 1 && mlen > 0.1 && !this.crouching && !this.blocking;
    if (this.diseases.sangrando) running = running && Math.random() > 0.5;

    if (riding) return this.updateMounted(dt, mx, mz, mlen);

    /* velocidade base */
    let speed = 4.2;
    if (running) speed = 8; else if (this.crouching) speed = 2; else if (this.blocking) speed = 2.6;
    if (this.swimming) speed = 3.2;
    if (this.temp < 15) speed *= 0.8; /* congelando */
    if (this.hunger < 10 || this.thirst < 10) speed *= 0.7;
    if (this.rolling > 0) { mx = Math.sin(this.rollDir); mz = Math.cos(this.rollDir); speed = 11; mlen = 1; }

    /* aplica movimento com colisão */
    const moveX = mx * speed, moveZ = mz * speed;
    let nx = this.pos.x + moveX * dt, nz = this.pos.z + moveZ * dt;
    const rc = resolveCollide(nx, nz, this.radius);
    nx = clamp(rc.x, -WORLD.extent + 2, G.inCave ? 1e9 : WORLD.extent - 2);
    nz = clamp(rc.z, -WORLD.extent + 2, G.inCave ? 1e9 : WORLD.extent - 2);

    /* distância percorrida (conquistas/stats) */
    G.stats.dist += dist2(nx, nz, this.pos.x, this.pos.z);

    this.pos.x = nx; this.pos.z = nz;

    /* altura do terreno / gravidade / natação */
    const ground = terrainHeight(this.pos.x, this.pos.z);
    const waterTop = WORLD.waterLevel;
    this.swimming = ground < waterTop - 1 && !G.inCave;
    if (this.swimming) {
      this.vel.y += (waterTop - 0.6 - this.pos.y) * dt * 3 - 1 * dt;
      this.vel.y *= 0.9;
      this.pos.y += this.vel.y * dt;
      this.pos.y = Math.max(ground + 0.2, this.pos.y);
      this.onGround = false;
      if (INPUT.crouch) this.pos.y = Math.max(ground + 0.4, this.pos.y - 2 * dt); /* mergulhar */
    } else {
      this.vel.y -= 18 * dt;
      this.pos.y += this.vel.y * dt;
      if (this.pos.y <= ground) { this.pos.y = ground; this.vel.y = 0; this.onGround = true; }
      else this.onGround = false;
    }

    /* passos */
    if (mlen > 0.1 && this.onGround) {
      this.stepT -= dt * speed;
      if (this.stepT <= 0) {
        this.stepT = running ? 2.2 : 1.6;
        this.footSurf = this.swimming ? 'water' : surfaceAt(this.pos.x, this.pos.z);
        AUDIO.play('step', { surf: this.footSurf });
      }
    }

    /* stamina */
    if (running && mlen > 0.1) this.stam -= dt * 12;
    else if (this.stam < this.maxstam) this.stam += dt * (this.onGround ? 14 : 6) * (this.equip.amulet === 'colar_rio' ? 1.3 : 1);
    this.stam = clamp(this.stam, 0, this.maxstam);

    /* mana e vida regen */
    if (this.mana < this.maxmana) this.mana += dt * 2;
    if (this.hp < this.maxhp && this.hunger > 30 && this.thirst > 30 && G.inCombat <= 0) this.hp += dt * 1.5;
    this.mana = Math.min(this.maxmana, this.mana);
    this.hp = Math.min(this.maxhp, this.hp);

    this.updateSurvival(dt);
    this.updateModel(dt, mlen, running);
    this.findInteract();
  }

  updateMounted(dt, mx, mz, mlen) {
    const h = this.mount;
    let speed = INPUT.run ? h.speed * 1.4 : h.speed;
    if (mlen > 0.1) {
      h.targetYaw = Math.atan2(mx, mz);
      h.yaw = angLerp(h.yaw, h.targetYaw, dt * 5);
      let nx = h.pos.x + Math.sin(h.yaw) * speed * dt;
      let nz = h.pos.z + Math.cos(h.yaw) * speed * dt;
      const rc = resolveCollide(nx, nz, 0.6);
      h.pos.x = clamp(rc.x, -WORLD.extent + 2, WORLD.extent - 2);
      h.pos.z = clamp(rc.z, -WORLD.extent + 2, WORLD.extent - 2);
      h.pos.y = terrainHeight(h.pos.x, h.pos.z);
      h.walkPhase += speed * dt * 1.2;
      h.moveAmt = 1;
      this.stepT -= dt * speed;
      if (this.stepT <= 0) { this.stepT = 3; AUDIO.play('step', { surf: 'stone' }); }
    } else h.moveAmt = lerp(h.moveAmt, 0, dt * 6);
    h.updateMesh(dt);
    this.pos.copy(h.pos);
    this.stam = Math.min(this.maxstam, this.stam + dt * 10);
    if (this.mana < this.maxmana) this.mana += dt * 2;
    this.updateSurvival(dt * 0.6);
    this.yaw -= 0; /* câmera livre já ajustada */
    this.findInteract();
  }

  updateSurvival(dt) {
    const slow = this.has('resistencia') ? 0.6 : 1;
    this.hunger -= dt * 0.28 * slow;
    this.thirst -= dt * 0.38 * slow;
    /* temperatura */
    let target = 50 + tempBase(this.pos.x, this.pos.z) - 22 + (ENV ? ENV.tempMod() : 0);
    if (this.armorDef() && this.armorDef().warm) target += this.armorDef().warm * 0.6;
    if (this.equip.amulet && ITEMS[this.equip.amulet] && ITEMS[this.equip.amulet].warm) target += ITEMS[this.equip.amulet].warm;
    for (const hs of WORLD.heatSources) if (dist2(this.pos.x, this.pos.z, hs.x, hs.z) < hs.r) target += 25;
    if (G.inCave) target = 42;
    this.temp = lerp(this.temp, clamp(target, 0, 100), dt * 0.1);

    /* efeitos de necessidades extremas */
    if (this.hunger <= 0) { this.hunger = 0; this.hp -= dt * 1.5; }
    if (this.thirst <= 0) { this.thirst = 0; this.hp -= dt * 2; }
    if (this.temp < 8) { this.hp -= dt * 1.2; if (Math.random() < dt * 0.02 && !this.diseases.resfriado) { this.diseases.resfriado = 60; UI.toast('🤧 Você pegou um resfriado!', 'bad'); } }
    if (this.temp > 95) this.hp -= dt * 0.8;

    /* doenças */
    if (this.diseases.veneno > 0) { this.diseases.veneno -= dt; this.hp -= dt * 1.8; if (this.diseases.veneno <= 0) UI.toast('O veneno passou.'); }
    if (this.diseases.sangrando > 0) { this.diseases.sangrando -= dt; this.hp -= dt * 1.2; if (this.diseases.sangrando <= 0) UI.toast('O sangramento parou.'); }
    if (this.diseases.resfriado > 0) { this.diseases.resfriado -= dt; this.stam = Math.min(this.stam, this.maxstam * 0.8); if (this.diseases.resfriado <= 0) UI.toast('Você se recuperou do resfriado.'); }

    this.hunger = clamp(this.hunger, 0, 100);
    this.thirst = clamp(this.thirst, 0, 100);
    if (this.hp <= 0 && G.state === 'play') this.die();

    /* avisos */
    if (this.hunger < 15 && !this._warnH) { this._warnH = 1; UI.toast('🍖 Você está faminto!', 'bad'); }
    if (this.hunger > 25) this._warnH = 0;
    if (this.thirst < 15 && !this._warnT) { this._warnT = 1; UI.toast('💧 Você está com muita sede!', 'bad'); }
    if (this.thirst > 25) this._warnT = 0;
  }

  updateModel(dt, mlen, running) {
    this.model.position.copy(this.pos);
    if (this.swimming) this.model.position.y -= 0.5;
    /* corpo vira para direção de movimento; se parado, mantém */
    if (mlen > 0.1) this.bodyYaw = angLerp(this.bodyYaw, Math.atan2(this.mvWorldX, this.mvWorldZ), dt * 10);
    else if (G.inCombat > 0 || this.blocking || this.attackAnim > 0) this.bodyYaw = angLerp(this.bodyYaw, this.yaw, dt * 10);
    this.model.rotation.y = this.bodyYaw;

    const phase = performance.now() * 0.001 * (running ? 11 : 7);
    const amt = mlen > 0.1 ? (running ? 1.2 : 0.8) : 0;
    if (this.rolling > 0) {
      this.model.rotation.x = -this.rolling * 7;
    } else {
      this.model.rotation.x = 0;
      animateHumanoid(this.parts, phase, amt, dt);
    }
    /* crouch */
    this.parts.torso.position.y = this.crouching ? 0.95 : 1.17;
    this.parts.head.position.y = this.crouching ? 1.44 : 1.66;
    /* ataque: balança braço direito */
    this.parts.attackLock = this.attackAnim > 0;
    if (this.attackAnim > 0) {
      const w = this.weaponDef();
      if (w.t === 'arco') { this.parts.armL.rotation.x = -1.4; this.parts.armR.rotation.x = -0.8; }
      else if (w.t === 'magiafoco') { this.parts.armR.rotation.x = -1.6 + Math.sin(this.attackAnim * 10) * 0.2; }
      else {
        const swing = this.attackAnim;
        this.parts.armR.rotation.x = -2.4 * swing + 0.3;
        this.parts.armR.rotation.z = swing * 0.5;
      }
    } else { this.parts.armR.rotation.z = 0; }
    /* bloqueio: ergue escudo */
    if (this.blocking) { this.parts.armL.rotation.x = -1.3; this.parts.attackLock = true; }
    else if (this.attackAnim <= 0) this.parts.attackLock = false;

    /* tocha acesa emite luz (tratada em sky) */
  }

  findInteract() {
    const near = queryInteract(this.pos.x, this.pos.z, 4);
    let best = null, bd = 9;
    for (const it of near) {
      if (Math.abs(it.y - this.pos.y) > 4) continue;
      const d = dist2(this.pos.x, this.pos.z, it.x, it.z);
      if (d < it.r && d < bd) { bd = d; best = it; }
    }
    /* entidades interativas (NPC, cavalo, pet, água para pescar) */
    let bestE = null, bde = 3.2;
    for (const e of ENT.all) {
      if (!e.alive) continue;
      const talk = (e instanceof NPC) || (e instanceof Horse && !e.owned) || (e instanceof Horse && e.owned) || (e instanceof Pet);
      if (!talk) continue;
      const d = dist2(this.pos.x, this.pos.z, e.pos.x, e.pos.z);
      if (d < bde) { bde = d; bestE = e; }
    }
    /* pesca: se olhando para água com vara */
    if (!best && !bestE && invCount(this.inv, 'vara') > 0) {
      const wx = this.pos.x + Math.sin(this.yaw) * 3, wz = this.pos.z + Math.cos(this.yaw) * 3;
      if (isWater(wx, wz)) best = { type: 'fish', label: 'Pescar', x: wx, z: wz };
    }
    /* beber/nadar na água */
    if (!best && !bestE) {
      const wx = this.pos.x + Math.sin(this.yaw) * 2, wz = this.pos.z + Math.cos(this.yaw) * 2;
      if (isWater(wx, wz) || this.swimming) best = { type: 'water_drink', label: 'Beber Água', x: wx, z: wz };
    }
    this.interactTarget = bestE || best;
    UI.setInteract(this.interactTarget, bestE);
  }

  serialize() {
    return {
      app: this.app, level: this.level, xp: this.xp, xpNext: this.xpNext, skillPoints: this.skillPoints, skills: this.skills,
      maxhp: this.maxhp, hp: this.hp, maxstam: this.maxstam, maxmana: this.maxmana, mana: this.mana, gold: this.gold,
      hunger: this.hunger, thirst: this.thirst, temp: this.temp, diseases: this.diseases,
      inv: this.inv, equip: this.equip, spell: this.spell, barter: this.barter,
      pos: { x: this.pos.x, z: this.pos.z }, time: G.time, flags: G.flags, rep: G.rep, discovered: G.discovered,
      achievements: G.achievements, stats: G.stats,
      pets: this.petsOwned, horses: this.horsesOwned.map(h => ({ x: h.pos.x, z: h.pos.z, hname: h.hname, saddle: h.saddle })),
      quests: QUESTS.serialize(),
    };
  }
}
