/* =====================================================================
   entities.js — NPCs, animais, inimigos, chefes, cavalos, pets
   ===================================================================== */
'use strict';

/* ---------------- construção de modelos ---------------- */
function lam(color) { return new THREE.MeshLambertMaterial({ color }); }
function makeLabelSprite(text, scale, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = 'bold 34px Georgia, serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 6;
  ctx.fillStyle = color || '#f3e7c8';
  ctx.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set((scale || 2.4), (scale || 2.4) / 4, 1);
  return sp;
}
function makeHeldMesh(id) {
  const m = WORLD.mat, def = ITEMS[id];
  const gp = new THREE.Group();
  if (!def) return gp;
  const t = def.t;
  if (t === 'arma') {
    if (id === 'machado') {
      gp.add(box(0.05, 0.9, 0.05, m.woodDark, 0, 0.35, 0));
      gp.add(box(0.3, 0.22, 0.06, m.metal, 0.13, 0.7, 0));
    } else if (id === 'lanca') {
      gp.add(box(0.04, 1.8, 0.04, m.woodDark, 0, 0.7, 0));
      gp.add(box(0.07, 0.3, 0.03, m.metal, 0, 1.7, 0));
    } else if (id === 'faca') {
      gp.add(box(0.04, 0.16, 0.04, m.woodDark, 0, 0.05, 0));
      gp.add(box(0.05, 0.28, 0.02, m.metal, 0, 0.28, 0));
    } else {
      const bladeMat = def.glow ? new THREE.MeshLambertMaterial({ color: 0xd8d8e0, emissive: def.glow, emissiveIntensity: 0.6 }) : m.metal;
      gp.add(box(0.06, 0.2, 0.06, m.woodDark, 0, 0.05, 0));
      gp.add(box(0.2, 0.05, 0.05, m.gold, 0, 0.16, 0));
      gp.add(box(0.07, def.dmg > 15 ? 1 : 0.8, 0.025, bladeMat, 0, 0.6, 0));
    }
  } else if (t === 'arco') {
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.03, 5, 10, Math.PI), m.woodDark);
    arc.rotation.z = -Math.PI / 2; gp.add(arc);
    gp.add(box(0.01, 0.9, 0.01, m.bed, 0.0, 0, 0));
  } else if (t === 'magiafoco') {
    gp.add(box(0.05, 1.4, 0.05, m.woodDark, 0, 0.55, 0));
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), new THREE.MeshLambertMaterial({ color: 0x66aaff, emissive: 0x3366cc }));
    orb.position.y = 1.3; gp.add(orb);
  } else if (t === 'escudo') {
    gp.add(box(0.5, 0.7, 0.06, id === 'escudo_ferro' ? m.metal : m.woodDark, 0, 0.3, 0));
  } else if (t === 'luz') {
    gp.add(box(0.05, 0.5, 0.05, m.woodDark, 0, 0.2, 0));
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.25, 5), m.fire);
    fl.position.y = 0.55; gp.add(fl);
  } else if (t === 'ferramenta') {
    gp.add(box(0.05, 0.8, 0.05, m.woodDark, 0, 0.3, 0));
    gp.add(box(0.35, 0.08, 0.05, m.metal, 0, 0.68, 0));
  }
  gp.traverse(o => { if (o.isMesh) o.castShadow = false; });
  return gp;
}

function makeHumanoid(o) {
  o = o || {};
  const skin = lam(o.skin || 0xd8a37a), shirt = lam(o.shirt || 0x6a5a8a), pants = lam(o.pants || 0x4a3d30);
  const hair = lam(o.hair || 0x3a281a);
  const gp = new THREE.Group();
  const f = o.gender === 'f';
  const bw = (f ? 0.4 : 0.48) * (o.build || 1);
  const parts = {};
  parts.legL = new THREE.Group(); parts.legL.position.set(-bw / 4, 0.86, 0);
  parts.legR = new THREE.Group(); parts.legR.position.set(bw / 4, 0.86, 0);
  [parts.legL, parts.legR].forEach(l => {
    const mesh = box(0.15, 0.86, 0.17, pants, 0, -0.43, 0); l.add(mesh); gp.add(l);
  });
  parts.torso = box(bw, 0.62, 0.26, shirt, 0, 1.17, 0);
  gp.add(parts.torso);
  if (f) gp.add(box(bw * 1.15, 0.22, 0.27, shirt, 0, 0.94, 0));
  parts.armL = new THREE.Group(); parts.armL.position.set(-bw / 2 - 0.08, 1.42, 0);
  parts.armR = new THREE.Group(); parts.armR.position.set(bw / 2 + 0.08, 1.42, 0);
  [parts.armL, parts.armR].forEach((a, i) => {
    a.add(box(0.13, 0.58, 0.14, shirt, 0, -0.24, 0));
    a.add(box(0.11, 0.16, 0.12, skin, 0, -0.58, 0));
    gp.add(a);
  });
  parts.head = new THREE.Group(); parts.head.position.set(0, 1.66, 0);
  parts.head.add(box(0.3, 0.32, 0.28, skin, 0, 0.16, 0));
  const eyeM = lam(o.eyes || 0x2a2a4a);
  parts.head.add(box(0.05, 0.05, 0.02, eyeM, -0.07, 0.2, 0.15));
  parts.head.add(box(0.05, 0.05, 0.02, eyeM, 0.07, 0.2, 0.15));
  const hs = o.hairStyle === undefined ? 1 : o.hairStyle;
  if (hs === 1) parts.head.add(box(0.34, 0.12, 0.32, hair, 0, 0.34, -0.01));
  else if (hs === 2) { parts.head.add(box(0.34, 0.12, 0.32, hair, 0, 0.34, -0.01)); parts.head.add(box(0.3, 0.42, 0.12, hair, 0, 0.1, -0.19)); }
  else if (hs === 3) { parts.head.add(box(0.34, 0.12, 0.32, hair, 0, 0.34, -0.01)); const bun = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), hair); bun.position.set(0, 0.36, -0.16); parts.head.add(bun); }
  else if (hs === 4) parts.head.add(box(0.1, 0.16, 0.3, hair, 0, 0.38, 0));
  if (o.beard) parts.head.add(box(0.24, 0.16, 0.06, hair, 0, 0.02, 0.13));
  gp.add(parts.head);
  parts.hand = new THREE.Group(); parts.hand.position.set(0, -0.62, 0.06);
  parts.armR.add(parts.hand);
  parts.offhand = new THREE.Group(); parts.offhand.position.set(0, -0.5, 0.08);
  parts.armL.add(parts.offhand);
  const hScale = o.height || 1;
  gp.scale.set(hScale, hScale, hScale);
  gp.traverse(ch => { if (ch.isMesh) { ch.castShadow = G.quality.shadows; } });
  return { group: gp, parts };
}
function animateHumanoid(parts, phase, amt, dt) {
  const s = Math.sin(phase) * 0.75 * amt;
  parts.legL.rotation.x = s; parts.legR.rotation.x = -s;
  if (!parts.attackLock) { parts.armL.rotation.x = -s * 0.8; parts.armR.rotation.x = s * 0.8; }
}

const QUAD_CFG = {
  lobo:    { bl: 1.1, bw: 0.4, bh: 0.45, leg: 0.5, head: 0.3, color: 0x777a80, snout: 0.22, tail: 0.5, ears: true, speed: 7 },
  cachorro:{ bl: 0.9, bw: 0.34, bh: 0.4, leg: 0.42, head: 0.27, color: 0xa07a4a, snout: 0.18, tail: 0.42, ears: true, speed: 7 },
  raposa:  { bl: 0.8, bw: 0.28, bh: 0.34, leg: 0.36, head: 0.24, color: 0xc06a2a, snout: 0.2, tail: 0.55, ears: true, speed: 7.5 },
  gato:    { bl: 0.6, bw: 0.22, bh: 0.28, leg: 0.28, head: 0.2, color: 0x555058, snout: 0.08, tail: 0.45, ears: true, speed: 6.5 },
  veado:   { bl: 1.2, bw: 0.4, bh: 0.6, leg: 0.85, head: 0.28, color: 0xa5804f, snout: 0.22, tail: 0.15, antlers: true, speed: 8.5 },
  coelho:  { bl: 0.42, bw: 0.24, bh: 0.26, leg: 0.16, head: 0.18, color: 0xb8a890, snout: 0.06, tail: 0.08, ears: 'long', speed: 7.5 },
  javali:  { bl: 1.1, bw: 0.5, bh: 0.55, leg: 0.4, head: 0.34, color: 0x5a4636, snout: 0.24, tail: 0.2, tusks: true, speed: 7 },
  urso:    { bl: 1.7, bw: 0.85, bh: 0.95, leg: 0.6, head: 0.44, color: 0x4a382a, snout: 0.26, tail: 0.1, ears: true, speed: 7.5 },
  cavalo:  { bl: 1.9, bw: 0.55, bh: 0.85, leg: 1.05, head: 0.4, color: 0x7a5a3a, snout: 0.42, tail: 0.7, mane: true, speed: 13 },
};
function makeQuadruped(kind, colorOverride) {
  const c = QUAD_CFG[kind];
  const bodyM = lam(colorOverride || c.color), darkM = lam(0x2a2018);
  const gp = new THREE.Group(), parts = { legs: [] };
  const legY = c.leg;
  parts.body = box(c.bw, c.bh, c.bl, bodyM, 0, legY + c.bh / 2, 0);
  gp.add(parts.body);
  for (let i = 0; i < 4; i++) {
    const lg = new THREE.Group();
    lg.position.set((i % 2 ? 1 : -1) * (c.bw / 2 - 0.05), legY + 0.05, (i < 2 ? 1 : -1) * (c.bl / 2 - 0.12));
    lg.add(box(0.11 * (c.bw * 2), legY + 0.1, 0.11 * (c.bw * 2), bodyM, 0, -(legY + 0.1) / 2, 0));
    gp.add(lg); parts.legs.push(lg);
  }
  parts.head = new THREE.Group();
  parts.head.position.set(0, legY + c.bh + (c.mane ? 0.35 : 0), c.bl / 2 + 0.02);
  parts.head.add(box(c.head, c.head, c.head, bodyM, 0, 0, 0.05));
  if (c.snout > 0.1) parts.head.add(box(c.head * 0.55, c.head * 0.5, c.snout, bodyM, 0, -c.head * 0.15, c.head * 0.6));
  if (c.ears === 'long') { parts.head.add(box(0.06, 0.3, 0.03, bodyM, -0.06, c.head * 0.8, 0)); parts.head.add(box(0.06, 0.3, 0.03, bodyM, 0.06, c.head * 0.8, 0)); }
  else if (c.ears || c.mane) { parts.head.add(box(0.07, 0.12, 0.04, darkM, -c.head * 0.35, c.head * 0.62, 0)); parts.head.add(box(0.07, 0.12, 0.04, darkM, c.head * 0.35, c.head * 0.62, 0)); }
  if (c.tusks) { parts.head.add(box(0.04, 0.14, 0.04, lam(0xf0e8d0), -0.1, -0.12, c.snout + 0.1)); parts.head.add(box(0.04, 0.14, 0.04, lam(0xf0e8d0), 0.1, -0.12, c.snout + 0.1)); }
  if (c.antlers) { [-1, 1].forEach(s => { const a = box(0.04, 0.4, 0.04, lam(0xcdb891), s * 0.1, c.head * 0.9, -0.05); a.rotation.z = s * -0.4; parts.head.add(a); const b = box(0.03, 0.2, 0.03, lam(0xcdb891), s * 0.2, c.head * 1.1, -0.05); b.rotation.z = s * 0.5; parts.head.add(b); }); }
  const eyeM = lam(0x111111);
  parts.head.add(box(0.04, 0.04, 0.02, eyeM, -c.head * 0.3, c.head * 0.15, c.head * 0.52));
  parts.head.add(box(0.04, 0.04, 0.02, eyeM, c.head * 0.3, c.head * 0.15, c.head * 0.52));
  if (c.mane) {
    parts.head.add(box(0.12, 0.55, 0.3, darkM, 0, -0.28, -0.3));
    parts.neck = box(0.24, 0.6, 0.3, bodyM, 0, legY + c.bh + 0.1, c.bl / 2 - 0.1);
    parts.neck.rotation.x = -0.4; gp.add(parts.neck);
  }
  gp.add(parts.head);
  parts.tail = box(0.08 * (c.bw * 2), c.tail, 0.08, kind === 'raposa' ? lam(0xd08a4a) : bodyM, 0, legY + c.bh * 0.8, -c.bl / 2 - 0.04);
  parts.tail.rotation.x = 0.7; gp.add(parts.tail);
  gp.traverse(ch => { if (ch.isMesh) ch.castShadow = G.quality.shadows; });
  return { group: gp, parts, cfg: c };
}
function makeBird(kind) {
  const colors = { passaro: 0x8a6a4a, papagaio: 0x2aa04a, coruja: 0x8a8078, gaivota: 0xe8e8e8 };
  const bodyM = lam(colors[kind] || 0x8a6a4a);
  const gp = new THREE.Group(), parts = {};
  parts.body = box(0.16, 0.16, 0.3, bodyM, 0, 0, 0); gp.add(parts.body);
  parts.head = box(0.14, 0.14, 0.14, kind === 'coruja' ? bodyM : bodyM, 0, 0.1, 0.18); gp.add(parts.head);
  gp.add(box(0.04, 0.04, 0.1, lam(0xd0a030), 0, 0.08, 0.28));
  parts.wingL = new THREE.Group(); parts.wingL.position.set(-0.08, 0.05, 0);
  parts.wingL.add(box(0.34, 0.03, 0.2, kind === 'papagaio' ? lam(0xd03030) : bodyM, -0.17, 0, 0));
  parts.wingR = new THREE.Group(); parts.wingR.position.set(0.08, 0.05, 0);
  parts.wingR.add(box(0.34, 0.03, 0.2, kind === 'papagaio' ? lam(0x3050c0) : bodyM, 0.17, 0, 0));
  gp.add(parts.wingL, parts.wingR);
  return { group: gp, parts };
}

/* ---------------- colisão compartilhada ---------------- */
function resolveCollide(x, z, r) {
  const cs = queryColliders(x, z, r + 3);
  for (let i = 0; i < cs.length; i++) {
    const c = cs[i];
    if (c.tree && c.hp <= 0) continue;
    const d = dist2(x, z, c.x, c.z), min = r + c.r;
    if (d < min && d > 0.001) {
      const push = (min - d) / d;
      x += (x - c.x) * push; z += (z - c.z) * push;
    }
  }
  return { x, z };
}

/* ---------------- classe base ---------------- */
class Entity {
  constructor(kind, x, z) {
    this.kind = kind; this.id = uid();
    this.pos = new THREE.Vector3(x, terrainHeight(x, z), z);
    this.yaw = rand(0, TAU); this.targetYaw = this.yaw;
    this.hp = 20; this.maxhp = 20; this.dmg = 4; this.speed = 4;
    this.radius = 0.45; this.alive = true; this.persistent = false;
    this.walkPhase = 0; this.moveAmt = 0;
    this.state = 'idle'; this.stateT = rand(0, 3);
    this.attackCd = 0; this.hitFlash = 0; this.hostile = false;
    this.group = null; this.parts = null;
    this.name = ''; this.label = null; this.hpBar = null;
  }
  initMesh(mk) {
    this.group = mk.group; this.parts = mk.parts; this.cfg = mk.cfg;
    this.group.position.copy(this.pos);
    G.scene.add(this.group);
  }
  addHPBar() {
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.1), new THREE.MeshBasicMaterial({ color: 0x330808, depthTest: false, transparent: true }));
    const fg = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.07), new THREE.MeshBasicMaterial({ color: 0xd03030, depthTest: false, transparent: true }));
    fg.position.z = 0.01;
    const gp = new THREE.Group(); gp.add(bg); gp.add(fg);
    gp.position.y = this.headY() + 0.5; gp.renderOrder = 5;
    this.group.add(gp);
    this.hpBar = { gp, fg };
  }
  headY() { return this.cfg ? this.cfg.leg + this.cfg.bh + 0.6 : 1.9; }
  moveToward(tx, tz, dt, mul) {
    const d = dist2(this.pos.x, this.pos.z, tx, tz);
    if (d < 0.3) { this.moveAmt = lerp(this.moveAmt, 0, dt * 6); return true; }
    this.targetYaw = Math.atan2(tx - this.pos.x, tz - this.pos.z);
    this.yaw = angLerp(this.yaw, this.targetYaw, dt * 6);
    const sp = this.speed * (mul || 1);
    let nx = this.pos.x + Math.sin(this.yaw) * sp * dt;
    let nz = this.pos.z + Math.cos(this.yaw) * sp * dt;
    const rc = resolveCollide(nx, nz, this.radius);
    this.pos.x = rc.x; this.pos.z = rc.z;
    this.pos.y = terrainHeight(this.pos.x, this.pos.z);
    if (this.pos.y < -0.4) this.pos.y = -0.4;
    this.moveAmt = lerp(this.moveAmt, 1, dt * 6);
    this.walkPhase += sp * dt * 2.4;
    return false;
  }
  idle(dt) { this.moveAmt = lerp(this.moveAmt, 0, dt * 6); }
  updateMesh(dt) {
    if (!this.group) return;
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    if (this.parts && this.parts.legs) {
      const s = Math.sin(this.walkPhase) * 0.6 * this.moveAmt;
      this.parts.legs[0].rotation.x = s; this.parts.legs[3].rotation.x = s;
      this.parts.legs[1].rotation.x = -s; this.parts.legs[2].rotation.x = -s;
      if (this.parts.tail) this.parts.tail.rotation.x = 0.7 + Math.sin(this.walkPhase * 0.7) * 0.2;
    } else if (this.parts && this.parts.legL) {
      animateHumanoid(this.parts, this.walkPhase, this.moveAmt, dt);
    }
    if (this.hitFlash > 0) {
      this.hitFlash -= dt;
      this.group.position.x += rand(-0.03, 0.03);
    }
    if (this.hpBar) {
      const show = this.hp < this.maxhp && this.alive;
      this.hpBar.gp.visible = show;
      if (show) {
        this.hpBar.fg.scale.x = Math.max(0.01, this.hp / this.maxhp);
        this.hpBar.gp.quaternion.copy(G.camera.quaternion);
        this.hpBar.gp.rotation.y -= this.yaw;
        this.hpBar.gp.lookAt ? null : null;
      }
    }
  }
  takeDamage(dmg, from) {
    if (!this.alive) return;
    this.hp -= dmg; this.hitFlash = 0.2;
    spawnHitFX(this.pos.x, this.pos.y + 1, this.pos.z);
    UI.damageNum(this.pos.x, this.pos.y + this.headY(), this.pos.z, Math.round(dmg), '#ff9a5a');
    AUDIO.play('hit');
    if (this.hp <= 0) this.die(from);
    else if (from === 'player') this.onHurtByPlayer();
  }
  onHurtByPlayer() {}
  die(from) {
    this.alive = false;
    AUDIO.play('die');
    if (this.group) {
      const g = this.group;
      const fall = { t: 0 };
      ENT.corpses.push({ g, t: 0 });
    }
    ENT.remove(this);
    if (from === 'player') {
      G.stats.kills++;
      unlock('primeiro_sangue');
      G.player.gainXP(this.xpReward || 12);
      rollLoot(this.lootTable || this.kind).forEach(l => {
        if (l.id === 'ouro') { G.player.gold += l.q; UI.toast('+' + l.q + ' 🪙 ouro'); AUDIO.play('coin'); }
        else spawnPickup(this.pos.x + rand(-1, 1), this.pos.z + rand(-1, 1), l.id, l.q);
      });
      if (G.player.activePet && dist2(G.player.pos.x, G.player.pos.z, this.pos.x, this.pos.z) < 30) G.player.activePet.gainXP(6);
      QUESTS.event('kill', { kind: this.kind, id: this.specialId });
    }
  }
  distToPlayer() { return dist2(this.pos.x, this.pos.z, G.player.pos.x, G.player.pos.z); }
  update(dt) {}
}
function spawnHitFX(x, y, z) {
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), new THREE.MeshBasicMaterial({ color: 0xffcc66, transparent: true }));
  m.position.set(x, y, z);
  G.scene.add(m);
  G.particles.push({ mesh: m, vy: 2.5, t: 0.35 });
}

/* ---------------- animais ---------------- */
class Animal extends Entity {
  constructor(kind, x, z) {
    super(kind, x, z);
    const stats = {
      veado: [26, 0, 8.5, 22], coelho: [8, 0, 7.5, 6], lobo: [34, 7, 7, 26],
      javali: [44, 9, 6.5, 30], urso: [110, 16, 7.5, 60], cavalo: [70, 6, 13, 20],
      raposa: [16, 4, 7.5, 14], passaro: [4, 0, 6, 4], gaivota: [4, 0, 6, 4],
    };
    const s = stats[kind] || [20, 4, 6, 12];
    this.maxhp = this.hp = s[0]; this.dmg = s[1]; this.speed = s[2]; this.xpReward = s[3];
    this.predator = kind === 'lobo' || kind === 'urso';
    this.neutral = kind === 'javali';
    this.homeX = x; this.homeZ = z;
    this.initMesh(makeQuadruped(kind, kind === 'cavalo' ? pick([0x7a5a3a, 0x4a3a2c, 0x9a8a76, 0x2e2620]) : undefined));
    if (this.predator || this.neutral) this.addHPBar();
    this.fleeing = 0;
  }
  update(dt) {
    if (!this.alive) return;
    this.stateT -= dt; this.attackCd -= dt;
    const dp = this.distToPlayer();
    const aggroR = this.kind === 'urso' ? 16 : (this.kind === 'lobo' ? 20 : 0);
    /* predadores caçam o jogador; feridos neutros também */
    if ((this.predator && dp < aggroR) || (this.hostile && dp < 46)) {
      this.hostile = true;
      G.inCombat = 2;
      if (dp > 2 + this.radius) this.moveToward(G.player.pos.x, G.player.pos.z, dt, 1.15);
      else {
        this.idle(dt);
        this.yaw = angLerp(this.yaw, Math.atan2(G.player.pos.x - this.pos.x, G.player.pos.z - this.pos.z), dt * 8);
        if (this.attackCd <= 0) {
          this.attackCd = this.kind === 'urso' ? 1.6 : 1.1;
          G.player.takeDamage(this.dmg, this);
          if (this.kind === 'lobo' && Math.random() < 0.3) AUDIO.play('wolf');
        }
      }
      /* pet defende */
      if (G.player.activePet && G.player.activePet.combat) G.player.activePet.target = this;
      return this.updateMesh(dt);
    }
    /* fugir do jogador (presas) ou de predadores */
    if (!this.predator && !this.neutral && dp < 12) this.fleeing = 1.6;
    if (this.fleeing > 0) {
      this.fleeing -= dt;
      const a = Math.atan2(this.pos.x - G.player.pos.x, this.pos.z - G.player.pos.z);
      this.moveToward(this.pos.x + Math.sin(a) * 20, this.pos.z + Math.cos(a) * 20, dt, 1.25);
      return this.updateMesh(dt);
    }
    /* pastar / vagar */
    if (this.stateT <= 0) {
      this.state = Math.random() < 0.55 ? 'idle' : 'wander';
      this.stateT = rand(2, 6);
      if (this.state === 'wander') {
        const a = rand(0, TAU), d = rand(4, 14);
        this.tx = this.homeX + Math.cos(a) * d; this.tz = this.homeZ + Math.sin(a) * d;
        if (isWater(this.tx, this.tz)) this.state = 'idle';
      }
      if (this.kind === 'passaro' && Math.random() < 0.2) AUDIO.play('bird');
    }
    if (this.state === 'wander') this.moveToward(this.tx, this.tz, dt, 0.4);
    else {
      this.idle(dt);
      if (this.parts.head) this.parts.head.rotation.x = Math.sin(performance.now() * 0.0012 + this.walkPhase) * 0.25;
    }
    this.updateMesh(dt);
  }
  onHurtByPlayer() {
    if (this.predator || this.neutral) this.hostile = true;
    else this.fleeing = 4;
    if (this.kind === 'cavalo') this.fleeing = 5;
  }
}

/* pássaros voando */
class Bird extends Entity {
  constructor(kind, x, z) {
    super(kind, x, z);
    this.maxhp = this.hp = 4; this.xpReward = 4; this.lootTable = 'passaro';
    const mk = makeBird(kind);
    this.initMesh(mk);
    this.alt = rand(6, 16); this.circleR = rand(8, 20); this.cx = x; this.cz = z; this.a = rand(0, TAU);
    this.flap = 0; this.landed = false; this.landT = rand(6, 18);
  }
  update(dt) {
    if (!this.alive) return;
    this.landT -= dt;
    if (this.landT <= 0) { this.landed = !this.landed; this.landT = this.landed ? rand(3, 8) : rand(8, 20); }
    if (this.landed && this.distToPlayer() < 7) { this.landed = false; this.landT = rand(8, 15); }
    if (this.landed) {
      const gy = terrainHeight(this.pos.x, this.pos.z);
      this.pos.y = lerp(this.pos.y, Math.max(gy, 0.2), dt * 2);
      this.parts.wingL.rotation.z = 0; this.parts.wingR.rotation.z = 0;
    } else {
      this.a += dt * 0.5;
      const tx = this.cx + Math.cos(this.a) * this.circleR, tz = this.cz + Math.sin(this.a) * this.circleR;
      this.yaw = Math.atan2(tx - this.pos.x, tz - this.pos.z);
      this.pos.x = lerp(this.pos.x, tx, dt * 2); this.pos.z = lerp(this.pos.z, tz, dt * 2);
      const gy = terrainHeight(this.pos.x, this.pos.z);
      this.pos.y = lerp(this.pos.y, Math.max(gy, 0) + this.alt, dt);
      this.flap += dt * 14;
      const w = Math.sin(this.flap) * 0.7;
      this.parts.wingL.rotation.z = w; this.parts.wingR.rotation.z = -w;
    }
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
  }
}

/* ---------------- inimigos humanoides ---------------- */
const BANDIT_LINES = ['A bolsa ou a vida!', 'Mais um tolo na estrada...', 'Peguem esse aí!'];
class Enemy extends Entity {
  constructor(kind, x, z, opts) {
    super(kind, x, z);
    opts = opts || {};
    const stats = { bandido: [40, 8, 5.2, 30], esqueleto: [34, 9, 4.6, 28], rei_esqueleto: [220, 16, 5, 220], garrick: [180, 14, 5.6, 200], ursa_anciã: [260, 20, 6.5, 260], cavaleiro_eclipse: [420, 22, 6, 500] };
    const s = stats[kind] || stats.bandido;
    this.maxhp = this.hp = s[0] * (opts.hpMul || 1); this.dmg = s[1]; this.speed = s[2]; this.xpReward = s[3];
    this.boss = !!opts.boss; this.specialId = opts.specialId;
    this.lootTable = kind.includes('esqueleto') ? 'esqueleto' : 'bandido';
    this.aggroR = opts.aggroR || 18; this.homeX = x; this.homeZ = z;
    this.persistent = this.boss;
    if (kind === 'ursa_anciã') {
      this.initMesh(makeQuadruped('urso'));
      this.group.scale.setScalar(1.5);
      this.lootTable = 'urso';
    } else {
      const skel = kind.includes('esqueleto');
      const mk = makeHumanoid(skel ?
        { skin: 0xd8d2c0, shirt: 0x9a948a, pants: 0x8a847a, hairStyle: 0, eyes: 0xcc2222 } :
        { skin: pick([0xd8a37a, 0xb8825a, 0x8a5f3f]), shirt: kind === 'garrick' ? 0x8a2020 : pick([0x4a3a2a, 0x5a2a2a, 0x3a3a4a]), pants: 0x3a3028, beard: Math.random() < 0.5, hairStyle: randi(0, 4) });
      this.initMesh(mk);
      this.parts.hand.add(makeHeldMesh(kind === 'garrick' ? 'machado' : (skel ? 'espada' : pick(['espada', 'machado', 'faca']))));
      if (kind === 'rei_esqueleto' || kind === 'cavaleiro_eclipse') {
        this.group.scale.setScalar(1.35);
        const crown = box(0.34, 0.14, 0.32, WORLD.mat.gold, 0, 0.42, 0);
        this.parts.head.add(crown);
        if (kind === 'cavaleiro_eclipse') {
          this.parts.torso.material = new THREE.MeshLambertMaterial({ color: 0x1a1a2a, emissive: 0x330066, emissiveIntensity: 0.5 });
        }
      }
    }
    this.addHPBar();
    this.name = { bandido: 'Bandido', esqueleto: 'Esqueleto', rei_esqueleto: 'Rei Esqueleto', garrick: 'Garrick, o Lorde Bandido', ursa_anciã: 'Ursa Anciã', cavaleiro_eclipse: 'Cavaleiro do Eclipse' }[kind];
    if (this.boss) { const l = makeLabelSprite(this.name, 4, '#ff8866'); l.position.y = this.headY() + 1; this.group.add(l); }
    this.taunted = false; this.chargeT = 0; this.strafe = Math.random() < 0.5 ? 1 : -1;
    this.passive = !!opts.passive;
  }
  update(dt) {
    if (!this.alive || this.passive) { this.idle(dt); this.updateMesh(dt); return; }
    this.attackCd -= dt; this.chargeT -= dt;
    const dp = this.distToPlayer();
    if (dp < this.aggroR || this.hostile) {
      this.hostile = true; G.inCombat = 2;
      if (!this.taunted) { this.taunted = true; if (this.kind === 'bandido') ENT.bubble(this, '⚔️'); if (this.boss) AUDIO.play('boss'); }
      /* chefes: investida telegrafada */
      if (this.boss && this.chargeT <= 0 && dp > 5 && dp < 22 && Math.random() < 0.006) {
        this.charging = 1.4; this.chargeT = 8;
        ENT.bubble(this, '💢');
      }
      if (this.charging > 0) {
        this.charging -= dt;
        this.moveToward(G.player.pos.x, G.player.pos.z, dt, 2.4);
        if (dp < 2.2) { G.player.takeDamage(this.dmg * 1.5, this); this.charging = 0; }
        return this.updateMesh(dt);
      }
      const reach = this.kind === 'ursa_anciã' ? 3 : 2.1;
      if (dp > reach) {
        /* aproxima com leve zigue-zague */
        const a = Math.atan2(G.player.pos.x - this.pos.x, G.player.pos.z - this.pos.z) + (dp < 6 ? this.strafe * 0.35 : 0);
        this.moveToward(this.pos.x + Math.sin(a) * 4, this.pos.z + Math.cos(a) * 4, dt, dp > 30 ? 1.3 : 1);
        if (Math.random() < 0.004) this.strafe *= -1;
      } else {
        this.idle(dt);
        this.yaw = angLerp(this.yaw, Math.atan2(G.player.pos.x - this.pos.x, G.player.pos.z - this.pos.z), dt * 8);
        if (this.attackCd <= 0) {
          this.attackCd = this.boss ? 1.3 : 1.5;
          if (this.parts.armR) { this.parts.attackLock = true; this.parts.armR.rotation.x = -2.2; setTimeout(() => { if (this.parts) { this.parts.armR.rotation.x = 0; this.parts.attackLock = false; } }, 240); }
          AUDIO.play('swing');
          setTimeout(() => { if (this.alive && this.distToPlayer() < (this.kind === 'ursa_anciã' ? 3.4 : 2.6)) G.player.takeDamage(this.dmg, this); }, 200);
        }
      }
      /* desiste se estiver muito longe de casa */
      if (dist2(this.pos.x, this.pos.z, this.homeX, this.homeZ) > 90 && !this.boss) this.hostile = false;
      /* bandidos fogem quase mortos */
      if (this.kind === 'bandido' && this.hp < this.maxhp * 0.18 && Math.random() < 0.01) { this.hostile = false; this.fleeing = 6; ENT.bubble(this, '😱'); }
    } else if (this.fleeing > 0) {
      this.fleeing -= dt;
      const a = Math.atan2(this.pos.x - G.player.pos.x, this.pos.z - G.player.pos.z);
      this.moveToward(this.pos.x + Math.sin(a) * 20, this.pos.z + Math.cos(a) * 20, dt, 1.3);
    } else {
      /* patrulha em volta de casa */
      this.stateT -= dt;
      if (this.stateT <= 0) {
        this.stateT = rand(3, 7);
        const a = rand(0, TAU);
        this.tx = this.homeX + Math.cos(a) * rand(2, 9); this.tz = this.homeZ + Math.sin(a) * rand(2, 9);
      }
      if (this.tx !== undefined) this.moveToward(this.tx, this.tz, dt, 0.35);
    }
    this.updateMesh(dt);
  }
  die(from) {
    super.die(from);
    if (this.kind === 'rei_esqueleto') { unlock('rei_ossos'); spawnPickup(this.pos.x, this.pos.z, 'coroa_velha', 1); spawnPickup(this.pos.x + 1, this.pos.z, 'fragmento', 1); }
    if (this.kind === 'ursa_anciã') { unlock('ursa'); spawnPickup(this.pos.x, this.pos.z, 'presa_noite', 1); }
    if (this.kind === 'garrick') { unlock('garrick'); }
    if (this.kind === 'cavaleiro_eclipse') { spawnPickup(this.pos.x, this.pos.z, 'aurora', 1); }
    if (this.specialId) G.flags['dead_' + this.specialId] = true;
  }
}

/* ---------------- NPCs de vilarejo ---------------- */
const NPC_NAMES_M = ['Aldo', 'Bruno', 'Caio', 'Dorin', 'Edgar', 'Fausto', 'Guto', 'Heitor', 'Ivo', 'Jorel', 'Lauro', 'Milo', 'Nino', 'Otto', 'Rui', 'Sandro', 'Tulio'];
const NPC_NAMES_F = ['Alba', 'Bela', 'Clara', 'Dora', 'Elisa', 'Flora', 'Gilda', 'Helena', 'Iris', 'Jussara', 'Lena', 'Mara', 'Nara', 'Olga', 'Rosa', 'Sofia', 'Tania'];
class NPC extends Entity {
  constructor(x, z, opts) {
    super('npc', x, z);
    opts = opts || {};
    this.gender = opts.gender || (Math.random() < 0.5 ? 'm' : 'f');
    this.name = opts.name || pick(this.gender === 'm' ? NPC_NAMES_M : NPC_NAMES_F);
    this.role = opts.role || 'aldeao';
    this.village = opts.village || null;
    this.home = opts.home || { x, z };
    this.work = opts.work || { x, z };
    this.shopType = opts.shopType || null;
    this.personality = opts.personality || pick(['alegre', 'rabugento', 'timido', 'tagarela', 'sabio']);
    this.rel = 0; this.angryT = 0;
    this.maxhp = this.hp = this.role === 'guarda' ? 80 : 30;
    this.dmg = this.role === 'guarda' ? 12 : 4;
    this.speed = 3.6; this.persistent = true;
    this.special = opts.special || null;
    const skin = pick([0xd8a37a, 0xc89068, 0xb8825a, 0x8a5f3f, 0xe8b98a]);
    const outfit = { guarda: 0x3a3d46, ferreiro: 0x4a3028, anciao: 0x5a4a7a, mercador: 0x6a4a2a, fazendeiro: 0x5a6a3a, bardo: 0x8a3a6a }[this.role] || pick([0x6a5a8a, 0x4a6a5a, 0x8a5a4a, 0x5a5a7a, 0x7a6a4a]);
    const mk = makeHumanoid({ gender: this.gender, skin, shirt: outfit, pants: 0x4a3d30, hair: pick([0x2a1a10, 0x4a2a12, 0x7a5a30, 0x999088, 0x1a1a1a]), hairStyle: randi(0, 4), beard: this.gender === 'm' && Math.random() < 0.4, height: rand(0.94, 1.06) });
    this.initMesh(mk);
    if (this.role === 'guarda') { this.parts.hand.add(makeHeldMesh('lanca')); }
    if (this.role === 'ferreiro') this.parts.hand.add(makeHeldMesh('machado'));
    this.chatT = rand(4, 14); this.bubbleT = 0;
    this.target = null;
  }
  schedulePos() {
    const t = G.time.t;
    if (this.special === 'prisioneiro') return this.work;
    if (t < 6 || t >= 21.5) return this.home;
    if (t < 7.5) return this.village ? this.village.well : this.work;
    if (t < 17.5) return this.work;
    if (t < 19.5) return this.village ? { x: this.village.x + 6, z: this.village.z + 6 } : this.home; /* fogueira */
    return this.home;
  }
  update(dt) {
    if (!this.alive) return;
    this.chatT -= dt; this.attackCd -= dt;
    if (this.bubbleT > 0) { this.bubbleT -= dt; if (this.bubbleT <= 0 && this.bubble) { this.group.remove(this.bubble); this.bubble = null; } }
    /* guarda: ataca inimigos próximos ou jogador criminoso */
    if (this.role === 'guarda') {
      let tgt = this.target && this.target.alive ? this.target : null;
      if (!tgt) {
        for (const e of ENT.all) {
          if ((e instanceof Enemy || (e instanceof Animal && e.hostile)) && e.alive && dist2(e.pos.x, e.pos.z, this.pos.x, this.pos.z) < 24) { tgt = e; break; }
        }
      }
      const vrep = this.village ? (G.rep[this.village.name] || 0) : 0;
      const playerCriminal = this.angryT > 0 || vrep < -30;
      if (playerCriminal && this.distToPlayer() < 26) {
        this.angryT -= dt;
        if (this.distToPlayer() > 2) this.moveToward(G.player.pos.x, G.player.pos.z, dt, 1.4);
        else if (this.attackCd <= 0) { this.attackCd = 1.4; G.player.takeDamage(this.dmg, this); AUDIO.play('swing'); }
        return this.updateMesh(dt);
      }
      if (tgt) {
        this.target = tgt;
        const d = dist2(tgt.pos.x, tgt.pos.z, this.pos.x, this.pos.z);
        if (d > 2) this.moveToward(tgt.pos.x, tgt.pos.z, dt, 1.4);
        else if (this.attackCd <= 0) { this.attackCd = 1.2; tgt.takeDamage(this.dmg, 'npc'); AUDIO.play('swing'); }
        return this.updateMesh(dt);
      }
    } else {
      /* civis fogem de perigo e chamam ajuda */
      for (const e of ENT.all) {
        if ((e instanceof Enemy || (e instanceof Animal && e.hostile)) && e.alive && dist2(e.pos.x, e.pos.z, this.pos.x, this.pos.z) < 12) {
          const a = Math.atan2(this.pos.x - e.pos.x, this.pos.z - e.pos.z);
          this.moveToward(this.pos.x + Math.sin(a) * 15, this.pos.z + Math.cos(a) * 15, dt, 1.5);
          if (Math.random() < 0.01) ENT.bubble(this, '😨');
          return this.updateMesh(dt);
        }
      }
    }
    /* rotina diária */
    const dest = this.schedulePos();
    const d = dist2(this.pos.x, this.pos.z, dest.x, dest.z);
    if (d > 2.2) this.moveToward(dest.x, dest.z, dt, this.role === 'guarda' ? 0.7 : 0.5);
    else {
      this.idle(dt);
      const t = G.time.t;
      if (t < 6 || t >= 22) { /* dormindo */
        if (Math.random() < 0.005) ENT.bubble(this, '💤');
      } else if (this.chatT <= 0) {
        this.chatT = rand(6, 16);
        /* conversa com NPC vizinho */
        for (const o of ENT.all) {
          if (o !== this && o instanceof NPC && dist2(o.pos.x, o.pos.z, this.pos.x, this.pos.z) < 4) {
            ENT.bubble(this, pick(['💬', '😄', '🍞', '🌦️', '⚒️', '🐺']));
            ENT.bubble(o, pick(['💬', '🙂', '👍']), 0.6);
            this.yaw = Math.atan2(o.pos.x - this.pos.x, o.pos.z - this.pos.z);
            break;
          }
        }
      }
      /* trabalho animado */
      if (this.role === 'ferreiro' && G.time.t > 8 && G.time.t < 17 && Math.random() < 0.008) { AUDIO.play('anvil'); this.parts.armR.rotation.x = -1.8; setTimeout(() => { if (this.parts) this.parts.armR.rotation.x = 0; }, 200); }
    }
    /* olha para o jogador quando perto */
    if (this.distToPlayer() < 4 && this.moveAmt < 0.2) this.yaw = angLerp(this.yaw, Math.atan2(G.player.pos.x - this.pos.x, G.player.pos.z - this.pos.z), dt * 4);
    this.updateMesh(dt);
    /* nome flutuante */
    if (!this.label && this.distToPlayer() < 9) {
      this.label = makeLabelSprite(this.name, 2, this.special ? '#ffd97a' : '#e8dcc0');
      this.label.position.y = 2.15; this.group.add(this.label);
    }
    if (this.label) this.label.visible = this.distToPlayer() < 9;
  }
  takeDamage(dmg, from) {
    if (from === 'player' || (from && from.isPlayer)) {
      this.angryT = 30;
      if (this.village) { G.rep[this.village.name] = (G.rep[this.village.name] || 0) - 12; UI.toast('⚠️ Reputação em ' + this.village.name + ' caiu!', 'bad'); }
      this.rel -= 30;
      for (const o of ENT.all) if (o instanceof NPC && o.role === 'guarda' && o.village === this.village) o.angryT = 40;
      ENT.bubble(this, '💢');
    }
    super.takeDamage(dmg, from);
  }
  die(from) {
    if (from === 'player' && this.village) G.rep[this.village.name] = (G.rep[this.village.name] || 0) - 40;
    super.die(from);
  }
}

/* ---------------- cavalos domáveis ---------------- */
class Horse extends Animal {
  constructor(x, z) {
    super('cavalo', x, z);
    this.owned = false; this.hname = null; this.saddle = false;
    this.calm = 0; this.bags = [];
    this.persistent = false;
  }
  update(dt) {
    if (this.ridden) { this.updateMesh(dt); return; }
    if (this.owned) {
      this.persistent = true;
      if (this.summoned) {
        const dp = this.distToPlayer();
        if (dp > 3.5) { this.moveToward(G.player.pos.x, G.player.pos.z, dt, 1.6); this.walkPhase += dt * 4; }
        else this.summoned = false;
        return this.updateMesh(dt);
      }
      /* espera pastando por perto */
      this.stateT -= dt;
      if (this.stateT <= 0) { this.stateT = rand(3, 8); const a = rand(0, TAU); this.tx = this.pos.x + Math.cos(a) * 4; this.tz = this.pos.z + Math.sin(a) * 4; }
      if (this.tx) this.moveToward(this.tx, this.tz, dt, 0.2);
      if (!this.label && this.hname) { this.label = makeLabelSprite('🐴 ' + this.hname, 2.4, '#d8c090'); this.label.position.y = 2.6; this.group.add(this.label); }
      return this.updateMesh(dt);
    }
    super.update(dt);
  }
}

/* ---------------- pets ---------------- */
const PET_CFG = {
  cachorro: { combat: true, dmg: 6, desc: 'Luta ao seu lado e busca itens caídos.', sound: 'dog' },
  gato:     { combat: false, dmg: 0, desc: 'Traz sorte: mais saque raro.', sound: 'cat' },
  lobo:     { combat: true, dmg: 10, desc: 'Predador feroz em combate.', sound: 'wolf' },
  raposa:   { combat: true, dmg: 5, desc: 'Fareja ervas e raízes pelo caminho.', sound: 'cat' },
  papagaio: { combat: false, dmg: 0, desc: 'Grita quando inimigos se aproximam.', sound: 'parrot' },
  coruja:   { combat: false, dmg: 0, desc: 'Ilumina suas noites e enxerga longe.', sound: 'owl' },
};
class Pet extends Entity {
  constructor(kind, x, z, data) {
    super(kind, x, z);
    data = data || {};
    const cfg = PET_CFG[kind];
    this.pname = data.pname || null;
    this.level = data.level || 1; this.xp = data.xp || 0;
    this.maxhp = 20 + this.level * 6; this.hp = data.hp !== undefined ? data.hp : this.maxhp;
    this.happiness = data.happiness !== undefined ? data.happiness : 80;
    this.hunger = data.hunger !== undefined ? data.hunger : 80;
    this.sick = data.sick || false;
    this.evolved = data.evolved || false;
    this.combat = cfg.combat; this.dmg = cfg.dmg + this.level * 1.5;
    this.speed = 7.5; this.persistent = true;
    this.flying = kind === 'papagaio' || kind === 'coruja';
    if (this.flying) this.initMesh(makeBird(kind));
    else this.initMesh(makeQuadruped(kind));
    if (this.evolved) this.applyEvolution(true);
    this.target = null; this.attackCd = 0; this.sniffT = 30; this.alertT = 0;
    this.happyT = 0; this.sleepy = false;
    this.updateLabel();
  }
  updateLabel() {
    if (this.label) this.group.remove(this.label);
    this.label = makeLabelSprite((this.sick ? '🤒 ' : '') + (this.pname || 'Filhote') + ' ⭐' + this.level, 2.2, '#a8e0a0');
    this.label.position.y = this.flying ? 0.8 : (this.cfg ? this.cfg.leg + this.cfg.bh + 0.7 : 1.4);
    this.group.add(this.label);
  }
  gainXP(n) {
    this.xp += n;
    const need = this.level * 40;
    if (this.xp >= need) {
      this.xp -= need; this.level++;
      this.maxhp += 6; this.hp = this.maxhp; this.dmg += 1.5;
      UI.toast('🐾 ' + this.pname + ' subiu para o nível ' + this.level + '!', 'gold');
      AUDIO.play(PET_CFG[this.kind].sound);
      if (this.level >= 5 && !this.evolved) { this.evolved = true; this.applyEvolution(); }
      this.updateLabel();
    }
  }
  applyEvolution(silent) {
    this.group.scale.multiplyScalar(1.18);
    const bandana = box(0.2, 0.08, 0.2, lam(0xd03030), 0, this.flying ? 0 : (this.cfg.leg + this.cfg.bh * 0.9), this.flying ? 0.1 : this.cfg.bl / 2 - 0.1);
    this.group.add(bandana);
    if (!silent) UI.toast('✨ ' + this.pname + ' evoluiu e ficou mais forte!', 'gold');
  }
  update(dt) {
    if (!this.alive) return;
    this.attackCd -= dt; this.sniffT -= dt; this.alertT -= dt; this.happyT -= dt;
    /* necessidades */
    this.hunger = Math.max(0, this.hunger - dt * 0.06);
    if (this.hunger <= 0) this.happiness = Math.max(0, this.happiness - dt * 0.4);
    if (this.happiness < 20 && !this.sick && Math.random() < dt * 0.004) { this.sick = true; UI.toast('🤒 ' + this.pname + ' adoeceu! Use um Remédio de Ervas.', 'bad'); this.updateLabel(); }
    if (this.sick) this.speed = 4; else this.speed = 7.5;
    if (this.hp < this.maxhp && !this.sick) this.hp = Math.min(this.maxhp, this.hp + dt * 0.5);

    const p = G.player;
    const dp = this.distToPlayer();
    if (dp > 45) { this.pos.set(p.pos.x + rand(-2, 2), 0, p.pos.z + rand(-2, 2)); this.pos.y = terrainHeight(this.pos.x, this.pos.z); }

    /* papagaio/coruja alertam sobre inimigos */
    if (!this.combat && this.alertT <= 0) {
      for (const e of ENT.all) {
        if (e instanceof Enemy && e.alive && dist2(e.pos.x, e.pos.z, p.pos.x, p.pos.z) < 30 && (this.kind !== 'coruja' || G.time.t < 6 || G.time.t > 19)) {
          this.alertT = 15;
          UI.toast((this.kind === 'papagaio' ? '🦜' : '🦉') + ' ' + this.pname + ' alerta: perigo à ' + UI.bearing(e.pos.x - p.pos.x, e.pos.z - p.pos.z) + '!', 'bad');
          AUDIO.play(PET_CFG[this.kind].sound);
          break;
        }
      }
    }
    /* raposa fareja ervas */
    if (this.kind === 'raposa' && this.sniffT <= 0) {
      this.sniffT = rand(60, 120);
      const item = pick(['erva', 'raiz', 'cogumelo', 'flor_lua']);
      spawnPickup(this.pos.x + rand(-1, 1), this.pos.z + rand(-1, 1), item, 1);
      UI.toast('🦊 ' + this.pname + ' farejou algo!');
    }
    /* combate */
    if (this.combat && this.target && this.target.alive && !this.sick) {
      const d = dist2(this.pos.x, this.pos.z, this.target.pos.x, this.target.pos.z);
      if (d > 60) this.target = null;
      else if (d > 1.6) this.moveToward(this.target.pos.x, this.target.pos.z, dt, 1.2);
      else if (this.attackCd <= 0) {
        this.attackCd = 1.1;
        this.target.takeDamage(this.dmg, 'pet');
        this.gainXP(2);
        AUDIO.play(PET_CFG[this.kind].sound);
      }
      return this.updateMesh(dt);
    }
    this.target = null;
    /* segue o jogador */
    if (this.flying) {
      const tx = p.pos.x + Math.sin(performance.now() * 0.0006) * 2.5;
      const tz = p.pos.z + Math.cos(performance.now() * 0.0006) * 2.5;
      this.pos.x = lerp(this.pos.x, tx, dt * 2); this.pos.z = lerp(this.pos.z, tz, dt * 2);
      this.pos.y = lerp(this.pos.y, p.pos.y + 2.6, dt * 2);
      this.yaw = Math.atan2(tx - this.pos.x + 0.001, tz - this.pos.z + 0.001);
      this.flap = (this.flap || 0) + dt * 13;
      const w = Math.sin(this.flap) * 0.7;
      this.parts.wingL.rotation.z = w; this.parts.wingR.rotation.z = -w;
      this.group.position.copy(this.pos); this.group.rotation.y = this.yaw;
      return;
    }
    if (dp > 3.2) this.moveToward(p.pos.x + 1.2, p.pos.z + 1.2, dt, dp > 10 ? 1.5 : 0.8);
    else {
      this.idle(dt);
      /* demonstra felicidade */
      if (this.happiness > 60 && Math.random() < 0.004) { ENT.bubble(this, '❤️'); if (this.parts.tail) this.parts.tail.rotation.x = 1.2; }
      if (this.hunger < 25 && Math.random() < 0.005) ENT.bubble(this, '🍖');
      if (G.time.t > 23 || G.time.t < 5) { if (Math.random() < 0.003) ENT.bubble(this, '💤'); }
    }
    this.updateMesh(dt);
  }
  feed(itemId) {
    const def = ITEMS[itemId];
    if (!def || (!def.food && !def.petfood)) return false;
    this.hunger = Math.min(100, this.hunger + (def.food || 30));
    this.happiness = Math.min(100, this.happiness + 12);
    ENT.bubble(this, '😋');
    AUDIO.play('eat');
    return true;
  }
  petAction() {
    this.happiness = Math.min(100, this.happiness + 8);
    ENT.bubble(this, '❤️');
    AUDIO.play(PET_CFG[this.kind].sound);
  }
  serialize() {
    return { kind: this.kind, pname: this.pname, level: this.level, xp: this.xp, hp: this.hp, happiness: this.happiness, hunger: this.hunger, sick: this.sick, evolved: this.evolved };
  }
}

/* ---------------- projéteis ---------------- */
function fireProjectile(x, y, z, dir, dmg, from, type) {
  let mesh;
  if (type === 'magia') {
    mesh = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), new THREE.MeshBasicMaterial({ color: 0x77bbff }));
  } else if (type === 'fogo') {
    mesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff7733 }));
  } else {
    mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 4), WORLD.mat.woodDark);
    mesh.rotation.x = Math.PI / 2;
  }
  const gp = new THREE.Group(); gp.add(mesh); gp.position.set(x, y, z);
  gp.lookAt(x + dir.x, y + dir.y, z + dir.z);
  G.scene.add(gp);
  const speed = type === 'flecha' ? 38 : 26;
  G.projectiles.push({ mesh: gp, vel: dir.clone().multiplyScalar(speed), dmg, from, type, t: 4, aoe: type === 'fogo' ? 3 : 0 });
  AUDIO.play(type === 'flecha' ? 'bow' : 'magic');
}
function updateProjectiles(dt) {
  for (let i = G.projectiles.length - 1; i >= 0; i--) {
    const p = G.projectiles[i];
    p.t -= dt;
    if (p.type === 'flecha') p.vel.y -= 9.8 * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    const pos = p.mesh.position;
    let hit = p.t <= 0 || pos.y < terrainHeight(pos.x, pos.z);
    if (!hit && p.from === 'player') {
      for (const e of ENT.all) {
        if (!e.alive || e instanceof Pet || (e instanceof Horse && e.owned)) continue;
        if (e instanceof NPC && e.role !== 'guarda' && p.type !== 'fogo') { /* pode acertar NPC — crime */ }
        const dy = Math.abs(pos.y - (e.pos.y + 1));
        if (dy < 1.6 && dist2(pos.x, pos.z, e.pos.x, e.pos.z) < 0.9) {
          if (p.aoe) { for (const o of ENT.all) if (o.alive && !(o instanceof Pet) && dist2(o.pos.x, o.pos.z, pos.x, pos.z) < p.aoe) o.takeDamage(p.dmg, 'player'); }
          else e.takeDamage(p.dmg, 'player');
          hit = true; break;
        }
      }
    } else if (!hit && p.from === 'enemy') {
      if (Math.abs(pos.y - (G.player.pos.y + 1)) < 1.6 && dist2(pos.x, pos.z, G.player.pos.x, G.player.pos.z) < 0.9) {
        G.player.takeDamage(p.dmg, null); hit = true;
      }
    }
    if (hit) {
      if (p.aoe) { spawnHitFX(pos.x, pos.y, pos.z); AUDIO.play('fire'); }
      G.scene.remove(p.mesh);
      G.projectiles.splice(i, 1);
    }
  }
}

/* ---------------- gerenciador ---------------- */
const ENT = {
  all: [], corpses: [], fish: [],
  spawnT: 0, eventT: 75, poiSpawned: {},
  add(e) { this.all.push(e); return e; },
  remove(e) {
    const i = this.all.indexOf(e);
    if (i >= 0) this.all.splice(i, 1);
    if (e.group) { /* cadáver cai e some */
      const g = e.group;
      let t = 0;
      const iv = setInterval(() => {
        t += 0.05;
        g.rotation.z = Math.min(Math.PI / 2, t * 3);
        g.position.y -= t > 1.4 ? 0.05 : 0;
        if (t > 3) { clearInterval(iv); G.scene.remove(g); }
      }, 50);
    }
  },
  bubble(e, emoji, delay) {
    setTimeout(() => {
      if (!e.group) return;
      if (e.bubble) e.group.remove(e.bubble);
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const ctx = c.getContext('2d');
      ctx.font = '44px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(emoji, 32, 36);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
      sp.scale.set(0.8, 0.8, 1);
      sp.position.y = (e.headY ? e.headY() : 2) + 0.9;
      e.group.add(sp);
      e.bubble = sp; e.bubbleT = 2.6;
      if (!(e instanceof NPC)) setTimeout(() => { if (e.group && e.bubble === sp) { e.group.remove(sp); e.bubble = null; } }, 2600);
    }, (delay || 0) * 1000);
  },
  populate() {
    /* NPCs dos vilarejos */
    WORLD.villages.forEach(v => {
      const roles = [];
      v.stalls.forEach(s => roles.push({ role: 'mercador', shopType: s.type, work: { x: s.x - Math.cos(s.a) * 1.6, z: s.z - Math.sin(s.a) * 1.6 } }));
      for (let i = 0; i < v.guards; i++) roles.push({ role: 'guarda', work: { x: v.x + rand(-10, 10), z: v.z + rand(-10, 10) } });
      const nCiv = Math.max(2, v.homes.length - 2);
      for (let i = 0; i < nCiv; i++) roles.push({ role: 'aldeao', work: { x: v.x + rand(-14, 14), z: v.z + rand(-14, 14) } });
      roles.forEach((r, i) => {
        const home = v.homes[i % v.homes.length] || { x: v.x, z: v.z };
        this.add(new NPC(home.x, home.z, Object.assign({ village: v, home }, r)));
      });
      if (v.start) {
        this.add(new NPC(v.x + 4, v.z - 5, { village: v, name: 'Anciã Mira', gender: 'f', role: 'anciao', special: 'mira', home: v.homes[0] || { x: v.x, z: v.z }, work: { x: v.x + 4, z: v.z - 5 }, personality: 'sabio' }));
        this.add(new NPC(v.x - 7, v.z + 3, { village: v, name: 'Ovídio, o Leiloeiro', gender: 'm', role: 'mercador', shopType: 'leiloeiro', special: 'leiloeiro', home: v.homes[1] || { x: v.x, z: v.z }, work: { x: v.x - 7, z: v.z + 3 } }));
        /* cães e gatos para adoção */
        const dog = new Pet('cachorro', v.x + 9, v.z - 3, {}); dog.adoptable = true; dog.persistent = true; this.add(dog);
        const cat = new Pet('gato', v.x - 4, v.z + 9, {}); cat.adoptable = true; cat.persistent = true; this.add(cat);
      }
    });
    /* Lorde no castelo */
    const castle = WORLD.pois.find(p => p.kind === 'castelo');
    if (castle) {
      this.add(new NPC(castle.throne.x, castle.throne.z + 2, { name: 'Lorde Aldric', gender: 'm', role: 'anciao', special: 'aldric', home: castle.throne, work: { x: castle.throne.x, z: castle.throne.z + 2 }, personality: 'sabio' }));
      for (let i = 0; i < 3; i++) this.add(new NPC(castle.x + rand(-14, 14), castle.z + rand(-8, 14), { name: 'Guarda Real', role: 'guarda', home: { x: castle.x, z: castle.z + 8 }, work: { x: castle.x + rand(-12, 12), z: castle.z + rand(-6, 12) } }));
    }
    /* fazendeiros */
    WORLD.pois.filter(p => p.kind === 'fazenda').forEach(f => {
      this.add(new NPC(f.field.x, f.field.z, { name: pick(NPC_NAMES_M), role: 'fazendeiro', home: { x: f.x - 10, z: f.z + 8 }, work: f.field }));
      this.add(new Animal('cavalo', f.x + 8, f.z + 2));
    });
    /* prisioneiro no acampamento */
    const camp = WORLD.pois.find(p => p.kind === 'acampamento');
    if (camp) this.add(new NPC(camp.cage.x, camp.cage.z, { name: 'Escoteiro Bren', gender: 'm', role: 'aldeao', special: 'bren', home: camp.cage, work: camp.cage }));
    /* pets selvagens especiais */
    const ship = WORLD.pois.find(p => p.kind === 'naufragio');
    if (ship) { const par = new Pet('papagaio', ship.x + 2, ship.z + 2, {}); par.adoptable = true; this.add(par); }
    const circle = WORLD.pois.find(p => p.kind === 'circulo');
    if (circle) { const owl = new Pet('coruja', circle.x, circle.z, {}); owl.adoptable = true; this.add(owl); }
  },
  ensurePOIGuards() {
    const p = G.player;
    for (const poi of WORLD.pois) {
      if (this.poiSpawned[poi.id]) continue;
      if (dist2(p.pos.x, p.pos.z, poi.x, poi.z) > 130) continue;
      this.poiSpawned[poi.id] = true;
      if (poi.kind === 'ruina') {
        const n = poi.boss ? 4 : 3;
        for (let i = 0; i < n; i++) this.add(new Enemy('esqueleto', poi.x + rand(-12, 12), poi.z + rand(-12, 12), {}));
        if (poi.boss && !G.flags['dead_rei']) this.add(new Enemy('rei_esqueleto', poi.x, poi.z - 4, { boss: true, specialId: 'rei' }));
      } else if (poi.kind === 'acampamento') {
        for (let i = 0; i < 4; i++) this.add(new Enemy('bandido', poi.x + rand(-12, 12), poi.z + rand(-12, 12), { passive: QUESTS.main < 5 && !G.flags.campHostile ? false : false }));
        if (!G.flags.dead_garrick && !G.flags.garrickSpared) {
          const g = this.add(new Enemy('garrick', poi.x, poi.z + 3, { boss: true, specialId: 'garrick', passive: true, aggroR: 10 }));
          g.talkable = true;
        }
      } else if (poi.kind === 'caverna' && poi.caveBoss) {
        if (!G.flags.dead_ursa) this.add(new Enemy('ursa_anciã', poi.room.x, poi.room.z - 8, { boss: true, specialId: 'ursa' }));
      } else if (poi.kind === 'caverna') {
        for (let i = 0; i < 2; i++) this.add(new Enemy('esqueleto', poi.room.x + rand(-10, 10), poi.room.z + rand(-10, 10), {}));
      }
    }
  },
  trySpawnWild() {
    const p = G.player;
    if (G.inCave) return;
    const count = this.all.filter(e => e instanceof Animal && !e.persistent).length;
    if (count > 14) return;
    const a = rand(0, TAU), d = rand(65, 110);
    const x = p.pos.x + Math.cos(a) * d, z = p.pos.z + Math.sin(a) * d;
    if (Math.abs(x) > WORLD.extent || Math.abs(z) > WORLD.extent) return;
    const h = terrainHeight(x, z);
    if (h < 1.5 || slopeAt(x, z) > 0.8) {
      if (h < 1.5 && h > 0.2 && Math.random() < 0.4) this.add(new Bird('gaivota', x, z));
      return;
    }
    for (const s of WORLD.sites) if (dist2(x, z, s.x, s.z) < s.r + 15) return;
    const temp = tempBase(x, z, h), moist = moistureAt(x, z);
    const night = G.time.t < 6 || G.time.t > 19;
    let opts;
    if (temp < 4) opts = ['lobo', 'lobo', 'urso', 'coelho', 'veado'];
    else if (moist > 0.6) opts = ['javali', 'javali', 'veado', 'passaro'];
    else if (moist > 0.45) opts = night ? ['lobo', 'veado', 'coelho', 'raposa_w'] : ['veado', 'veado', 'coelho', 'javali', 'passaro', 'raposa_w'];
    else opts = ['cavalo', 'veado', 'coelho', 'coelho', 'passaro'];
    const kind = pick(opts);
    if (kind === 'passaro') this.add(new Bird('passaro', x, z));
    else if (kind === 'cavalo') { const n = randi(2, 3); for (let i = 0; i < n; i++) this.add(new Horse(x + rand(-6, 6), z + rand(-6, 6))); }
    else if (kind === 'raposa_w') { const f = new Pet('raposa', x, z, {}); f.adoptable = true; f.wild = true; this.add(f); }
    else if (kind === 'lobo' && night && Math.random() < 0.4) { for (let i = 0; i < 3; i++) this.add(new Animal('lobo', x + rand(-4, 4), z + rand(-4, 4))); AUDIO.play('wolf'); }
    else this.add(new Animal(kind, x, z));
  },
  randomEvent() {
    const p = G.player;
    if (G.inCave || G.state !== 'play') return;
    const r = Math.random();
    const a = rand(0, TAU), d = rand(30, 50);
    const x = p.pos.x + Math.cos(a) * d, z = p.pos.z + Math.sin(a) * d;
    if (terrainHeight(x, z) < 1.5) return;
    if (r < 0.28) {
      /* mercador viajante */
      const n = this.add(new NPC(x, z, { name: 'Mercador Errante', role: 'mercador', shopType: 'geral', home: { x, z }, work: { x: p.pos.x, z: p.pos.z } }));
      n.despawnT = 90;
      UI.toast('🧳 Um mercador viajante se aproxima...');
    } else if (r < 0.5) {
      const n = randi(2, 3);
      for (let i = 0; i < n; i++) this.add(new Animal('lobo', x + rand(-4, 4), z + rand(-4, 4)));
      AUDIO.play('wolf');
      UI.toast('🐺 Uivos ecoam por perto...', 'bad');
    } else if (r < 0.66) {
      const b = this.add(new NPC(x, z, { name: 'Bardo Lira', gender: 'f', role: 'bardo', special: 'bardo', home: { x, z }, work: { x: p.pos.x + 3, z: p.pos.z } }));
      b.despawnT = 70;
      UI.toast('🎵 Você ouve uma canção ao longe...');
    } else if (r < 0.82) {
      const n = this.add(new NPC(x, z, { name: 'Viajante Perdido', role: 'aldeao', special: 'perdido', home: { x, z }, work: { x: p.pos.x, z: p.pos.z } }));
      n.despawnT = 80;
    } else if (G.time.t > 20 || G.time.t < 5) {
      UI.toast('🌠 Uma estrela cadente corta o céu!', 'gold');
      G.player.gainXP(15);
    } else {
      for (let i = 0; i < 2; i++) this.add(new Enemy('bandido', x + rand(-3, 3), z + rand(-3, 3), {}));
      UI.toast('⚠️ Bandidos à espreita na estrada!', 'bad');
    }
  },
  nearestHostile(r) {
    let best = null, bd = r * r;
    for (const e of this.all) {
      if (!e.alive || !(e instanceof Enemy || (e instanceof Animal && e.hostile))) continue;
      const dx = e.pos.x - G.player.pos.x, dz = e.pos.z - G.player.pos.z;
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  },
  update(dt) {
    this.spawnT -= dt; this.eventT -= dt;
    if (this.spawnT <= 0) { this.spawnT = 2.5; this.trySpawnWild(); this.ensurePOIGuards(); }
    if (this.eventT <= 0) { this.eventT = rand(90, 150); this.randomEvent(); }
    const p = G.player;
    for (let i = this.all.length - 1; i >= 0; i--) {
      const e = this.all[i];
      if (e.despawnT !== undefined) { e.despawnT -= dt; if (e.despawnT <= 0) { G.scene.remove(e.group); this.all.splice(i, 1); continue; } }
      const d = dist2(e.pos.x, e.pos.z, p.pos.x, p.pos.z);
      if (d > 170 && !e.persistent && !(e === p.activePet)) {
        G.scene.remove(e.group); this.all.splice(i, 1); continue;
      }
      if (d < 130 || e === p.activePet || e.ridden) e.update(dt);
      if (e.group) e.group.visible = d < 150;
    }
    updateProjectiles(dt);
    /* peixes decorativos */
    if (this.fish.length < 8 && terrainHeight(p.pos.x, p.pos.z) < 4) {
      const a = rand(0, TAU), d = rand(6, 20);
      const x = p.pos.x + Math.cos(a) * d, z = p.pos.z + Math.sin(a) * d;
      if (isWater(x, z)) {
        const f = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.4, 4), lam(0x6a8a9a));
        f.rotation.z = Math.PI / 2;
        f.position.set(x, -0.35, z);
        G.scene.add(f);
        this.fish.push({ mesh: f, a: rand(0, TAU), t: rand(4, 10) });
      }
    }
    for (let i = this.fish.length - 1; i >= 0; i--) {
      const f = this.fish[i];
      f.t -= dt; f.a += dt * rand(0.5, 1.5);
      f.mesh.position.x += Math.sin(f.a) * dt * 1.5;
      f.mesh.position.z += Math.cos(f.a) * dt * 1.5;
      f.mesh.rotation.y = -f.a;
      if (f.t <= 0 || !isWater(f.mesh.position.x, f.mesh.position.z) || dist2(f.mesh.position.x, f.mesh.position.z, p.pos.x, p.pos.z) > 30) {
        G.scene.remove(f.mesh); this.fish.splice(i, 1);
      }
    }
  },
};
