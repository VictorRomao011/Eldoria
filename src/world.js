/* =====================================================================
   world.js — Geração do mundo: terreno, biomas, locais, vegetação
   ===================================================================== */
'use strict';

const WORLD = {
  waterLevel: 0, extent: 2200,
  chunkSize: 100, chunkSegs: 22,
  chunks: new Map(), buildQueue: [],
  sites: [], siteGrid: new Map(),
  villages: [], pois: [], roads: [],
  interactGrid: new Map(), colliderGrid: new Map(),
  heatSources: [], campfires: [], pickups: [],
  water: null, structGroups: [],
  geo: {}, mat: {}, windowMats: [], fireLights: [],
};

/* ---------------- grades espaciais ---------------- */
function gridKey(x, z, cell) { return Math.floor(x / cell) + ',' + Math.floor(z / cell); }
function gridAdd(map, cell, obj) {
  const k = gridKey(obj.x, obj.z, cell);
  if (!map.has(k)) map.set(k, []);
  map.get(k).push(obj);
}
function gridQuery(map, cell, x, z, r, out) {
  out.length = 0;
  const x0 = Math.floor((x - r) / cell), x1 = Math.floor((x + r) / cell);
  const z0 = Math.floor((z - r) / cell), z1 = Math.floor((z + r) / cell);
  for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
    const a = map.get(i + ',' + j);
    if (a) for (let n = 0; n < a.length; n++) out.push(a[n]);
  }
  return out;
}
function gridRemove(map, cell, obj) {
  const a = map.get(gridKey(obj.x, obj.z, cell));
  if (a) { const i = a.indexOf(obj); if (i >= 0) a.splice(i, 1); }
}
function addInteract(it) { gridAdd(WORLD.interactGrid, 24, it); return it; }
function removeInteract(it) { gridRemove(WORLD.interactGrid, 24, it); }
const _iq = [];
function queryInteract(x, z, r) { return gridQuery(WORLD.interactGrid, 24, x, z, r, _iq); }
function addCollider(c) { gridAdd(WORLD.colliderGrid, 18, c); return c; }
function removeCollider(c) { gridRemove(WORLD.colliderGrid, 18, c); }
const _cq = [];
function queryColliders(x, z, r) { return gridQuery(WORLD.colliderGrid, 18, x, z, r, _cq); }

/* ---------------- terreno ---------------- */
function rawHeight(x, z) {
  if (z > 5000) { /* região das cavernas */
    return 1.5 + fbm(x * 0.05, z * 0.05, 2, 77) * 1.2;
  }
  const c = fbm(x * 0.0011, z * 0.0011, 4, 10);
  const d = fbm(x * 0.006 + 53.7, z * 0.006 + 91.2, 4, 20);
  const ridge = 1 - Math.abs(fbm(x * 0.0021 + 7, z * 0.0021 + 3, 4, 30) * 2 - 1);
  let h = (c - 0.44) * 70 + (d - 0.5) * 9;
  h += smoothstep(0.55, 0.8, c) * Math.pow(ridge, 2.4) * 95;
  /* rios serpenteando */
  const rv = fbm(x * 0.0016 + 400, z * 0.0016 + 400, 3, 40);
  const river = 1 - smoothstep(0, 0.05, Math.abs(rv - 0.5));
  if (h > -4) h -= river * (7 + Math.max(0, h) * 0.35);
  /* pântanos: achata regiões úmidas e baixas */
  const moist = moistureAt(x, z);
  if (h > 0 && h < 5 && moist > 0.62) h = lerp(h, 0.7, smoothstep(0.62, 0.75, moist) * 0.85);
  return h;
}
function moistureAt(x, z) { return fbm(x * 0.0013 + 900, z * 0.0013 + 900, 3, 50); }
function tempBase(x, z, h) { return 22 + z * 0.009 - Math.max(0, (h === undefined ? rawHeight(x, z) : h) - 25) * 0.35; }

const _sq = [];
function terrainHeight(x, z) {
  let h = rawHeight(x, z);
  const sites = gridQuery(WORLD.siteGrid, 200, x, z, 90, _sq);
  for (let i = 0; i < sites.length; i++) {
    const s = sites[i], d = dist2(x, z, s.x, s.z);
    if (d < s.r) h = lerp(s.h, h, smoothstep(s.r * 0.45, s.r, d));
  }
  return h;
}
function isWater(x, z) { return terrainHeight(x, z) < WORLD.waterLevel - 0.15; }
function slopeAt(x, z) {
  const e = 1.4;
  const hx = terrainHeight(x + e, z) - terrainHeight(x - e, z);
  const hz = terrainHeight(x, z + e) - terrainHeight(x, z - e);
  return Math.sqrt(hx * hx + hz * hz) / (2 * e);
}
function surfaceAt(x, z) {
  const h = terrainHeight(x, z);
  if (h < 0.25) return 'water';
  if (tempBase(x, z, h) < 3 || h > 52) return 'snow';
  if (h > 36 || slopeAt(x, z) > 0.9) return 'stone';
  return 'grass';
}

/* distância até a estrada mais próxima */
function pointSegDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1), 0, 1);
  return dist2(px, pz, ax + dx * t, az + dz * t);
}
function roadDist(x, z) {
  let m = 1e9;
  for (let i = 0; i < WORLD.roads.length; i++) {
    const r = WORLD.roads[i];
    const d = pointSegDist(x, z, r.ax, r.az, r.bx, r.bz);
    if (d < m) m = d;
  }
  return m;
}

/* cor do terreno em (x,z) — usada nos chunks e nos mapas */
const _col = [0, 0, 0];
function colorAt(x, z, h) {
  if (h === undefined) h = terrainHeight(x, z);
  const moist = moistureAt(x, z), temp = tempBase(x, z, h), slope = slopeAt(x, z);
  let r, g, b;
  const v = noise2(x * 0.09, z * 0.09, 60) * 0.12 - 0.06;
  if (z > 5000) { r = 0.16; g = 0.14; b = 0.13; } /* caverna */
  else if (h < -2) { r = 0.1; g = 0.2; b = 0.22; }
  else if (h < 1.6) { r = 0.72; g = 0.64; b = 0.44; } /* areia */
  else if (temp < 3 || h > 52) { r = 0.88; g = 0.9; b = 0.95; } /* neve */
  else if (h > 36 || slope > 0.95) { r = 0.42; g = 0.4; b = 0.38; } /* rocha */
  else if (moist > 0.62 && h < 5) { r = 0.24; g = 0.3; b = 0.18; } /* pântano */
  else {
    const lush = smoothstep(0.3, 0.7, moist);
    r = lerp(0.42, 0.2, lush); g = lerp(0.5, 0.44, lush); b = lerp(0.22, 0.16, lush);
  }
  if (h >= 1.6 && z < 5000) {
    const rd = roadDist(x, z);
    if (rd < 3.2) { const w = 1 - smoothstep(1.8, 3.2, rd); r = lerp(r, 0.5, w * 0.9); g = lerp(g, 0.42, w * 0.9); b = lerp(b, 0.3, w * 0.9); }
  }
  _col[0] = clamp(r + v, 0, 1); _col[1] = clamp(g + v, 0, 1); _col[2] = clamp(b + v, 0, 1);
  return _col;
}

/* ---------------- geometrias e materiais compartilhados ---------------- */
function mergeGeo(list) {
  let pos = [], norm = [], uv = [];
  list.forEach(g => {
    const ng = g.index ? g.toNonIndexed() : g;
    pos = pos.concat(Array.from(ng.attributes.position.array));
    norm = norm.concat(Array.from(ng.attributes.normal.array));
    if (ng.attributes.uv) uv = uv.concat(Array.from(ng.attributes.uv.array));
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3));
  if (uv.length) out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return out;
}
function initSharedAssets() {
  const g = WORLD.geo, m = WORLD.mat;
  g.oakTrunk = new THREE.CylinderGeometry(0.22, 0.34, 3.2, 6); g.oakTrunk.translate(0, 1.6, 0);
  const s1 = new THREE.IcosahedronGeometry(1.7, 0); s1.translate(0, 3.9, 0);
  const s2 = new THREE.IcosahedronGeometry(1.2, 0); s2.translate(0.9, 3.1, 0.4);
  g.oakLeaf = mergeGeo([s1, s2]);
  g.pineTrunk = new THREE.CylinderGeometry(0.16, 0.26, 2.4, 6); g.pineTrunk.translate(0, 1.2, 0);
  const c1 = new THREE.ConeGeometry(1.5, 2.6, 7); c1.translate(0, 2.9, 0);
  const c2 = new THREE.ConeGeometry(1.1, 2.2, 7); c2.translate(0, 4.4, 0);
  g.pineLeaf = mergeGeo([c1, c2]);
  g.deadTrunk = mergeGeo([
    (() => { const t = new THREE.CylinderGeometry(0.14, 0.3, 3.4, 5); t.translate(0, 1.7, 0); return t; })(),
    (() => { const b = new THREE.CylinderGeometry(0.06, 0.1, 1.4, 4); b.rotateZ(0.9); b.translate(0.5, 2.6, 0); return b; })(),
    (() => { const b = new THREE.CylinderGeometry(0.05, 0.09, 1.2, 4); b.rotateZ(-1); b.translate(-0.4, 2.1, 0.2); return b; })(),
  ]);
  const pt = new THREE.CylinderGeometry(0.14, 0.22, 4.2, 5); pt.translate(0.3, 2.1, 0); pt.rotateZ(-0.14);
  g.palmTrunk = pt;
  const leafs = [];
  for (let i = 0; i < 5; i++) {
    const p = new THREE.PlaneGeometry(0.7, 2.4); p.translate(0, 1.1, 0);
    p.rotateX(-0.9); p.rotateY(i / 5 * TAU); p.translate(0.55, 4.1, 0);
    leafs.push(p);
  }
  g.palmLeaf = mergeGeo(leafs);
  g.rock = new THREE.DodecahedronGeometry(0.9, 0); g.rock.translate(0, 0.3, 0);
  const gr1 = new THREE.PlaneGeometry(0.9, 0.7); gr1.translate(0, 0.32, 0);
  const gr2 = gr1.clone(); gr2.rotateY(Math.PI / 2);
  g.grass = mergeGeo([gr1, gr2]);
  g.flower = mergeGeo([
    (() => { const s = new THREE.CylinderGeometry(0.02, 0.02, 0.4, 3); s.translate(0, 0.2, 0); return s; })(),
    (() => { const f = new THREE.IcosahedronGeometry(0.11, 0); f.translate(0, 0.45, 0); return f; })(),
  ]);
  g.shroom = mergeGeo([
    (() => { const s = new THREE.CylinderGeometry(0.06, 0.08, 0.25, 5); s.translate(0, 0.12, 0); return s; })(),
    (() => { const c = new THREE.ConeGeometry(0.2, 0.16, 6); c.translate(0, 0.3, 0); return c; })(),
  ]);
  g.stalag = new THREE.ConeGeometry(0.7, 2.6, 5); g.stalag.translate(0, 1.3, 0);
  g.crystal = new THREE.OctahedronGeometry(0.5, 0); g.crystal.translate(0, 0.7, 0);

  m.trunk = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
  m.trunkDark = new THREE.MeshLambertMaterial({ color: 0x4a3a2e });
  m.leaf = new THREE.MeshLambertMaterial({ color: 0x3d6b2a });
  m.pineLeaf = new THREE.MeshLambertMaterial({ color: 0x2c5232 });
  m.palmLeaf = new THREE.MeshLambertMaterial({ color: 0x4c8a37, side: THREE.DoubleSide });
  m.rock = new THREE.MeshLambertMaterial({ color: 0x77726b });
  m.grass = new THREE.MeshLambertMaterial({ color: 0x4a7a30, side: THREE.DoubleSide });
  m.flower = new THREE.MeshLambertMaterial({ color: 0xd8c05a });
  m.flowerB = new THREE.MeshLambertMaterial({ color: 0xb08ae0 });
  m.shroom = new THREE.MeshLambertMaterial({ color: 0xb05540 });
  m.stalag = new THREE.MeshLambertMaterial({ color: 0x5a5248 });
  m.crystal = new THREE.MeshLambertMaterial({ color: 0x7ad0ff, emissive: 0x2a70a0 });
  m.wood = new THREE.MeshLambertMaterial({ color: 0x8a6a45 });
  m.woodDark = new THREE.MeshLambertMaterial({ color: 0x5e452e });
  m.wall = new THREE.MeshLambertMaterial({ color: 0xcfc3a8 });
  m.stone = new THREE.MeshLambertMaterial({ color: 0x8d8a82 });
  m.stoneDark = new THREE.MeshLambertMaterial({ color: 0x5f5c56 });
  m.roof = new THREE.MeshLambertMaterial({ color: 0x9c4a35 });
  m.roofSlate = new THREE.MeshLambertMaterial({ color: 0x4f5a66 });
  m.thatch = new THREE.MeshLambertMaterial({ color: 0xb59a55 });
  m.dark = new THREE.MeshBasicMaterial({ color: 0x0a0806 });
  m.cloth = new THREE.MeshLambertMaterial({ color: 0xa03838, side: THREE.DoubleSide });
  m.clothB = new THREE.MeshLambertMaterial({ color: 0x3858a0, side: THREE.DoubleSide });
  m.hay = new THREE.MeshLambertMaterial({ color: 0xc9a94f });
  m.metal = new THREE.MeshLambertMaterial({ color: 0x3a3d42 });
  m.gold = new THREE.MeshLambertMaterial({ color: 0xd8a838, emissive: 0x503808, emissiveIntensity: 0.3 });
  m.bed = new THREE.MeshLambertMaterial({ color: 0xd8d2c2 });
  m.crop = new THREE.MeshLambertMaterial({ color: 0x6a9a3a });
  m.dirt = new THREE.MeshLambertMaterial({ color: 0x6a5236 });
  m.fire = new THREE.MeshBasicMaterial({ color: 0xff8830 });
  m.waterM = new THREE.MeshPhongMaterial({ color: 0x1f5d78, transparent: true, opacity: 0.8, shininess: 160, specular: 0xbbddff });
}
function box(w, h, d, mat, x, y, z, ry) {
  const ms = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  ms.position.set(x || 0, y || 0, z || 0);
  if (ry) ms.rotation.y = ry;
  ms.castShadow = true; ms.receiveShadow = true;
  return ms;
}
function cyl(rt, rb, h, mat, x, y, z, seg) {
  const ms = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 8), mat);
  ms.position.set(x || 0, y || 0, z || 0);
  ms.castShadow = true; ms.receiveShadow = true;
  return ms;
}

/* ---------------- planejamento do mundo (determinístico) ---------------- */
const VILLAGE_NAMES = ['Pedravau', 'Corvo Branco', 'Salgueiro', 'Brumafria', 'Vale Âmbar', 'Porto Cinza', 'Toca do Teixugo', 'Alto Faial', 'Roseiral', 'Monte Sino', 'Lago Verde'];
function addSite(x, z, r, h) {
  const s = { x, z, r, h };
  WORLD.sites.push(s); gridAdd(WORLD.siteGrid, 200, s);
  return s;
}
function siteOK(x, z, minH, maxH, clearance) {
  const h = rawHeight(x, z);
  if (h < minH || h > maxH) return false;
  for (const p of WORLD.sites) if (dist2(x, z, p.x, p.z) < (clearance || 180) + p.r) return false;
  const s = Math.abs(rawHeight(x + 24, z) - h) + Math.abs(rawHeight(x, z + 24) - h);
  return s < 14;
}
function planWorld() {
  const R = mulberry32(G.seed);
  /* vilarejos */
  let nameI = 0;
  for (let gz = -3; gz <= 3; gz++) for (let gx = -3; gx <= 3; gx++) {
    if (WORLD.villages.length >= 9) break;
    if (hash2(gx, gz, G.seed + 5) < 0.4) continue;
    for (let attempt = 0; attempt < 8; attempt++) {
      const x = gx * 600 + (hash2(gx * 7 + attempt, gz, G.seed) - 0.5) * 420;
      const z = gz * 600 + (hash2(gx, gz * 7 + attempt, G.seed) - 0.5) * 420;
      if (Math.abs(x) > WORLD.extent - 120 || Math.abs(z) > WORLD.extent - 120) continue;
      if (!siteOK(x, z, 2.5, 24, 200)) continue;
      const h = Math.max(2.2, rawHeight(x, z));
      addSite(x, z, 52, h);
      WORLD.villages.push({ x, z, r: 46, h, name: VILLAGE_NAMES[nameI++ % VILLAGE_NAMES.length], homes: [], beds: [], stalls: [], guards: 1, kind: 'village' });
      break;
    }
  }
  /* vila inicial = a mais próxima da origem */
  WORLD.villages.sort((a, b) => dist2(a.x, a.z, 0, 0) - dist2(b.x, b.z, 0, 0));
  const sv = WORLD.villages[0];
  sv.name = 'Eldervale'; sv.start = true; sv.guards = 2;
  /* pontos de interesse buscados proceduralmente */
  const findSpot = (minD, maxD, minH, maxH, tries) => {
    for (let i = 0; i < (tries || 260); i++) {
      const a = R() * TAU, d = minD + R() * (maxD - minD);
      const x = sv.x + Math.cos(a) * d, z = sv.z + Math.sin(a) * d;
      if (Math.abs(x) > WORLD.extent || Math.abs(z) > WORLD.extent) continue;
      if (siteOK(x, z, minH, maxH, 150)) return { x, z };
    }
    return null;
  };
  const poi = (kind, name, icon, x, z, r, extra) => {
    const h = Math.max(1.8, rawHeight(x, z));
    addSite(x, z, r, h);
    const p = Object.assign({ id: kind + '_' + WORLD.pois.length, kind, name, icon, x, z, r, h, discovered: false }, extra || {});
    WORLD.pois.push(p);
    return p;
  };
  let s;
  s = findSpot(700, 1500, 5, 28) || { x: sv.x + 900, z: sv.z - 700 };
  const castle = poi('castelo', 'Castelo de Aldric', '🏰', s.x, s.z, 72);
  s = findSpot(350, 800, 8, 40) || { x: sv.x - 500, z: sv.z + 420 };
  poi('ruina', 'Ruínas de Kareth', '🏛️', s.x, s.z, 44, { boss: 'rei_esqueleto' });
  s = findSpot(500, 1400, 8, 40) || { x: sv.x + 300, z: sv.z + 900 };
  poi('ruina', 'Torre Partida', '🗼', s.x, s.z, 30);
  s = findSpot(600, 1600, 8, 40) || { x: sv.x - 900, z: sv.z - 500 };
  poi('ruina', 'Santuário Afundado', '⛩️', s.x, s.z, 34);
  /* cavernas: entrada no mundo + sala na região z>5000 */
  const caveNames = ['Caverna do Uivo', 'Gruta Cristalina', 'Toca Sombria'];
  for (let i = 0; i < 3; i++) {
    s = findSpot(300, 1500, 18, 60, 400) || { x: sv.x + 200 + i * 300, z: sv.z - 300 - i * 200 };
    const room = { x: i * 500, z: 8000 };
    addSite(room.x, room.z, 34, 2);
    poi('caverna', caveNames[i], '🕳️', s.x, s.z, 20, { room, caveBoss: i === 0 });
  }
  /* acampamento de bandidos entre a vila e o castelo */
  const bx = lerp(sv.x, castle.x, 0.55) + (R() - 0.5) * 200, bz = lerp(sv.z, castle.z, 0.55) + (R() - 0.5) * 200;
  poi('acampamento', 'Acampamento de Garrick', '⛺', bx, bz, Math.max(2, rawHeight(bx, bz)) ? 34 : 34);
  /* naufrágio numa praia */
  let ship = null;
  for (let i = 0; i < 400 && !ship; i++) {
    const x = (R() - 0.5) * 2 * WORLD.extent, z = (R() - 0.5) * 2 * WORLD.extent;
    const h = rawHeight(x, z);
    if (h > 0.3 && h < 1.4 && rawHeight(x + 30, z) < -3) ship = { x, z };
  }
  if (ship) poi('naufragio', 'Naufrágio da Gaivota', '⛵', ship.x, ship.z, 20);
  /* círculo de pedras místico */
  s = findSpot(400, 1200, 6, 35) || { x: sv.x - 300, z: sv.z - 800 };
  poi('circulo', 'Círculo das Luas', '🌀', s.x, s.z, 24);
  /* fazendas ao lado das duas primeiras vilas */
  for (let i = 0; i < Math.min(3, WORLD.villages.length); i++) {
    const v = WORLD.villages[i];
    const fx = v.x + Math.cos(i * 2.1) * 95, fz = v.z + Math.sin(i * 2.1) * 95;
    if (rawHeight(fx, fz) > 1.5) poi('fazenda', 'Fazenda de ' + v.name, '🌾', fx, fz, 34);
  }
  /* vilarejos também são POIs no mapa */
  WORLD.villages.forEach(v => {
    WORLD.pois.push({ id: 'vila_' + v.name, kind: 'vila', name: v.name, icon: '🏘️', x: v.x, z: v.z, r: v.r, h: v.h, discovered: v.start, village: v });
  });
  /* estradas: cada vila liga-se à vizinha mais próxima; vila inicial ↔ castelo */
  const linked = new Set();
  WORLD.villages.forEach(v => {
    let best = null, bd = 1e9;
    WORLD.villages.forEach(o => {
      if (o === v) return;
      const d = dist2(v.x, v.z, o.x, o.z), key = [v.name, o.name].sort().join('|');
      if (d < bd && !linked.has(key)) { bd = d; best = o; }
    });
    if (best) {
      linked.add([v.name, best.name].sort().join('|'));
      WORLD.roads.push({ ax: v.x, az: v.z, bx: best.x, bz: best.z });
    }
  });
  WORLD.roads.push({ ax: sv.x, az: sv.z, bx: castle.x, bz: castle.z });
  const camp = WORLD.pois.find(p => p.kind === 'acampamento');
  if (camp) WORLD.roads.push({ ax: sv.x, az: sv.z, bx: camp.x, bz: camp.z });
}

/* ---------------- chunks de terreno ---------------- */
class Chunk {
  constructor(cx, cz) {
    this.cx = cx; this.cz = cz;
    this.group = new THREE.Group();
    this.interacts = []; this.colliders = [];
    const S = WORLD.chunkSize, seg = WORLD.chunkSegs;
    const ox = cx * S + S / 2, oz = cz * S + S / 2;
    const geo = new THREE.PlaneGeometry(S, S, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const wx = ox + pos.getX(i), wz = oz + pos.getZ(i);
      const h = terrainHeight(wx, wz);
      pos.setY(i, h);
      const c = colorAt(wx, wz, h);
      colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2];
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.position.set(ox, 0, oz);
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.terrain = mesh;
    this.buildVegetation(ox, oz, S);
    G.scene.add(this.group);
  }
  buildVegetation(ox, oz, S) {
    const g = WORLD.geo, m = WORLD.mat;
    const cave = oz > 5000;
    const rng = mulberry32((this.cx * 7919 + this.cz * 104729 + G.seed) >>> 0);
    const mats = { oakT: [], oakL: [], pineT: [], pineL: [], deadT: [], palmT: [], palmL: [], rock: [], grass: [], flower: [], flowerB: [], shroomI: [], stalag: [] };
    const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), e4 = new THREE.Euler(), v4 = new THREE.Vector3(), sc4 = new THREE.Vector3();
    const put = (arr, x, y, z, ry, s) => {
      e4.set(0, ry, 0); q4.setFromEuler(e4); v4.set(x, y, z); sc4.set(s, s, s);
      m4.compose(v4, q4, sc4); arr.push(m4.clone());
    };
    if (cave) {
      for (let i = 0; i < 26; i++) {
        const x = ox - S / 2 + rng() * S, z = oz - S / 2 + rng() * S;
        put(mats.stalag, x, terrainHeight(x, z), z, rng() * TAU, 0.5 + rng() * 1.4);
      }
    } else {
      const tries = 46;
      for (let i = 0; i < tries; i++) {
        const x = ox - S / 2 + rng() * S, z = oz - S / 2 + rng() * S;
        const h = terrainHeight(x, z);
        if (h < 1.4) {
          if (h > 0.4 && rng() < 0.1) { /* palmeira na praia */
            const sc = 0.8 + rng() * 0.5;
            put(mats.palmT, x, h - 0.1, z, rng() * TAU, sc); put(mats.palmL, x, h - 0.1, z, 0, sc);
            this.addTreeCollider(x, z, h, 'palm', mats.palmT.length - 1, mats.palmL.length - 1, sc);
          }
          continue;
        }
        const moist = moistureAt(x, z), temp = tempBase(x, z, h), slope = slopeAt(x, z);
        if (slope > 0.85 || h > 46) {
          if (rng() < 0.35) put(mats.rock, x, h - 0.15, z, rng() * TAU, 0.7 + rng() * 1.8);
          continue;
        }
        if (roadDist(x, z) < 4) continue;
        let nearSite = false;
        const ss = gridQuery(WORLD.siteGrid, 200, x, z, 10, _sq);
        for (const st of ss) if (dist2(x, z, st.x, st.z) < st.r * 0.9) { nearSite = true; break; }
        if (nearSite) { if (rng() < 0.12) put(mats.grass, x, h, z, rng() * TAU, 0.8); continue; }
        const forest = smoothstep(0.42, 0.6, moist) * 0.85 + 0.06;
        const roll = rng();
        if (roll < forest * 0.5) {
          const sc = 0.75 + rng() * 0.7;
          if (temp < 6 || h > 30) { put(mats.pineT, x, h - 0.1, z, rng() * TAU, sc); put(mats.pineL, x, h - 0.1, z, 0, sc); this.addTreeCollider(x, z, h, 'pine', mats.pineT.length - 1, mats.pineL.length - 1, sc); }
          else if (moist > 0.63 && h < 4) { put(mats.deadT, x, h - 0.1, z, rng() * TAU, sc); this.addTreeCollider(x, z, h, 'dead', mats.deadT.length - 1, -1, sc); }
          else { put(mats.oakT, x, h - 0.1, z, rng() * TAU, sc); put(mats.oakL, x, h - 0.1, z, rng() * TAU, sc); this.addTreeCollider(x, z, h, 'oak', mats.oakT.length - 1, mats.oakL.length - 1, sc); }
        } else if (roll < forest * 0.5 + 0.03 && slope < 0.5) {
          put(mats.rock, x, h - 0.1, z, rng() * TAU, 0.5 + rng() * 1.1);
          if (rng() < 0.4) { /* nó de mineração */
            const node = addInteract({ x, z, y: h, r: 2.4, type: 'mina', label: 'Minerar', hp: 3 });
            this.interacts.push(node);
          }
          const c = addCollider({ x, z, r: 1 }); this.colliders.push(c);
        }
      }
      /* capim, flores, cogumelos, ervas e frutas */
      const nGrass = Math.floor(60 * G.quality.particles);
      for (let i = 0; i < nGrass; i++) {
        const x = ox - S / 2 + rng() * S, z = oz - S / 2 + rng() * S;
        const h = terrainHeight(x, z);
        if (h < 1.6 || h > 34 || tempBase(x, z, h) < 4 || roadDist(x, z) < 3) continue;
        put(mats.grass, x, h - 0.03, z, rng() * TAU, 0.7 + rng() * 0.8);
      }
      for (let i = 0; i < 7; i++) {
        const x = ox - S / 2 + rng() * S, z = oz - S / 2 + rng() * S;
        const h = terrainHeight(x, z);
        if (h < 1.6 || h > 30) continue;
        const moist = moistureAt(x, z);
        const r2 = rng();
        if (r2 < 0.3) { put(mats.flower, x, h, z, rng() * TAU, 1); this.gatherNode(x, z, h, 'erva', 'Colher Erva-do-Sol'); }
        else if (r2 < 0.42) { put(mats.flowerB, x, h, z, rng() * TAU, 1); this.gatherNode(x, z, h, 'flor_lua', 'Colher Flor da Lua'); }
        else if (r2 < 0.62 && moist > 0.5) { put(mats.shroomI, x, h, z, rng() * TAU, 1 + rng()); this.gatherNode(x, z, h, 'cogumelo', 'Colher Cogumelo'); }
        else if (r2 < 0.8) { this.gatherNode(x, z, h, 'frutas', 'Colher Frutas'); put(mats.flowerB, x, h, z, rng() * TAU, 0.7); }
        else this.gatherNode(x, z, h, 'raiz', 'Arrancar Raiz');
      }
    }
    const inst = (arr, geo2, mat2, shadow) => {
      if (!arr.length) return null;
      const im = new THREE.InstancedMesh(geo2, mat2, arr.length);
      arr.forEach((mx, i) => im.setMatrixAt(i, mx));
      im.instanceMatrix.needsUpdate = true;
      if (shadow && G.quality.shadows) im.castShadow = true;
      im.receiveShadow = true;
      this.group.add(im);
      return im;
    };
    this.oakT = inst(mats.oakT, g.oakTrunk, m.trunk, true);
    this.oakL = inst(mats.oakL, g.oakLeaf, m.leaf, true);
    this.pineT = inst(mats.pineT, g.pineTrunk, m.trunkDark, true);
    this.pineL = inst(mats.pineL, g.pineLeaf, m.pineLeaf, true);
    this.deadT = inst(mats.deadT, g.deadTrunk, m.trunkDark, true);
    this.palmT = inst(mats.palmT, g.palmTrunk, m.trunk, true);
    this.palmL = inst(mats.palmL, g.palmLeaf, m.palmLeaf, false);
    inst(mats.rock, g.rock, m.rock, true);
    inst(mats.grass, g.grass, m.grass, false);
    inst(mats.flower, g.flower, m.flower, false);
    inst(mats.flowerB, g.flower, m.flowerB, false);
    inst(mats.shroomI, g.shroom, m.shroom, false);
    inst(mats.stalag, g.stalag, m.stalag, false);
  }
  gatherNode(x, z, h, item, label) {
    const it = addInteract({ x, z, y: h, r: 2, type: 'colher', label, item });
    this.interacts.push(it);
  }
  addTreeCollider(x, z, h, kind, trunkI, leafI, sc) {
    const c = addCollider({ x, z, r: 0.45, tree: true, hp: 3, kind, trunkI, leafI, chunk: this, sc, h });
    this.colliders.push(c);
  }
  hideTree(c) {
    const zero = new THREE.Matrix4().makeScale(0.0001, 0.0001, 0.0001);
    const map = { oak: [this.oakT, this.oakL], pine: [this.pineT, this.pineL], dead: [this.deadT, null], palm: [this.palmT, this.palmL] };
    const [t, l] = map[c.kind] || [];
    if (t) { t.setMatrixAt(c.trunkI, zero); t.instanceMatrix.needsUpdate = true; }
    if (l && c.leafI >= 0) { l.setMatrixAt(c.leafI, zero); l.instanceMatrix.needsUpdate = true; }
  }
  dispose() {
    this.interacts.forEach(removeInteract);
    this.colliders.forEach(removeCollider);
    G.scene.remove(this.group);
    this.group.traverse(o => { if (o.geometry && o.geometry !== WORLD.geo[o.name]) { if (!Object.values(WORLD.geo).includes(o.geometry)) o.geometry.dispose(); } });
  }
}

function ensureChunks(px, pz) {
  const S = WORLD.chunkSize, R = G.quality.viewDist;
  const cx = Math.floor(px / S), cz = Math.floor(pz / S);
  let built = 0;
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
    const k = (cx + dx) + ',' + (cz + dz);
    if (!WORLD.chunks.has(k)) {
      if (built >= 1) continue;
      WORLD.chunks.set(k, new Chunk(cx + dx, cz + dz));
      built++;
    }
  }
  for (const [k, ch] of WORLD.chunks) {
    if (Math.abs(ch.cx - cx) > R + 1 || Math.abs(ch.cz - cz) > R + 1) {
      ch.dispose(); WORLD.chunks.delete(k);
    }
  }
}

/* ---------------- água global ---------------- */
function initWater() {
  const segs = G.quality.waves ? 48 : 1;
  const geo = new THREE.PlaneGeometry(900, 900, segs, segs);
  geo.rotateX(-Math.PI / 2);
  WORLD.water = new THREE.Mesh(geo, WORLD.mat.waterM);
  WORLD.water.position.y = WORLD.waterLevel - 0.05;
  WORLD.water.renderOrder = 1;
  G.scene.add(WORLD.water);
}
let _waveT = 0;
function updateWater(dt, px, pz) {
  const w = WORLD.water; if (!w) return;
  w.position.x = Math.round(px / 4) * 4; w.position.z = Math.round(pz / 4) * 4;
  if (!G.quality.waves) return;
  _waveT += dt;
  if ((G.frame & 1) === 0) return;
  const pos = w.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + w.position.x, z = pos.getZ(i) + w.position.z;
    pos.setY(i, Math.sin(x * 0.12 + _waveT * 1.4) * 0.09 + Math.cos(z * 0.1 + _waveT * 1.1) * 0.08);
  }
  pos.needsUpdate = true;
}

/* ---------------- estruturas dos locais ---------------- */
function buildHouse(gp, x, z, h, ry, opts) {
  opts = opts || {};
  const m = WORLD.mat;
  const w = opts.w || 5.4, d = opts.d || 4.6, hh = opts.h || 3;
  const hg = new THREE.Group(); hg.position.set(x, h, z); hg.rotation.y = ry || 0;
  hg.add(box(w, hh, d, opts.stone ? m.stone : m.wall, 0, hh / 2, 0));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.78, 2, 4), opts.slate ? m.roofSlate : m.roof);
  roof.position.y = hh + 1; roof.rotation.y = Math.PI / 4; roof.castShadow = true;
  hg.add(roof);
  hg.add(box(1.1, 2, 0.12, m.woodDark, 0, 1, d / 2 + 0.02));
  const winMat = new THREE.MeshLambertMaterial({ color: 0x333322, emissive: 0xffbb44, emissiveIntensity: 0 });
  WORLD.windowMats.push(winMat);
  hg.add(box(0.8, 0.8, 0.1, winMat, -w / 3, 1.7, d / 2 + 0.02));
  hg.add(box(0.8, 0.8, 0.1, winMat, w / 3, 1.7, d / 2 + 0.02));
  gp.add(hg);
  addCollider({ x, z, r: Math.max(w, d) * 0.62 });
  return hg;
}
function buildCampfireMesh(x, z, h) {
  const m = WORLD.mat, gp = new THREE.Group();
  gp.position.set(x, h, z);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU;
    gp.add(box(0.35, 0.28, 0.35, m.stoneDark, Math.cos(a) * 0.7, 0.12, Math.sin(a) * 0.7, a));
  }
  const log1 = cyl(0.09, 0.09, 1, m.woodDark, 0, 0.2, 0); log1.rotation.z = Math.PI / 2; gp.add(log1);
  const log2 = log1.clone(); log2.rotation.y = Math.PI / 2; gp.add(log2);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.9, 6), m.fire);
  flame.position.y = 0.6; flame.name = 'flame'; gp.add(flame);
  G.scene.add(gp);
  return gp;
}
function placeCampfire(x, z, silent) {
  const h = terrainHeight(x, z);
  const gp = buildCampfireMesh(x, z, h);
  const it = addInteract({ x, z, y: h, r: 2.4, type: 'fogueira', label: 'Usar Fogueira' });
  const cf = { x, z, h, mesh: gp, it };
  WORLD.campfires.push(cf);
  WORLD.heatSources.push({ x, z, r: 7 });
  if (WORLD.campfires.length > 8) {
    const old = WORLD.campfires.shift();
    G.scene.remove(old.mesh); removeInteract(old.it);
    const hi = WORLD.heatSources.findIndex(hs => hs.x === old.x && hs.z === old.z);
    if (hi >= 0) WORLD.heatSources.splice(hi, 1);
  }
  if (!silent) AUDIO.play('fire');
  return cf;
}
function addChest(gp, x, z, h, table, cid) {
  const m = WORLD.mat;
  const ch = new THREE.Group(); ch.position.set(x, h, z);
  ch.add(box(1, 0.6, 0.7, m.woodDark, 0, 0.3, 0));
  ch.add(box(1.04, 0.24, 0.74, table === 'bau_rico' ? m.gold : m.metal, 0, 0.68, 0));
  gp.add(ch);
  addInteract({ x, z, y: h, r: 2.2, type: 'chest', label: 'Abrir Baú', loot: table, cid, mesh: ch });
}
function buildVillage(v) {
  const m = WORLD.mat;
  const gp = new THREE.Group();
  const rng = mulberry32((Math.round(v.x) * 31 + Math.round(v.z) * 17 + G.seed) >>> 0);
  /* poço central */
  gp.add(cyl(1.1, 1.2, 1, m.stone, v.x, v.h + 0.5, v.z));
  gp.add(cyl(0.08, 0.08, 2.2, m.woodDark, v.x - 0.9, v.h + 1.6, v.z));
  gp.add(cyl(0.08, 0.08, 2.2, m.woodDark, v.x + 0.9, v.h + 1.6, v.z));
  const wroof = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.9, 4), m.thatch);
  wroof.position.set(v.x, v.h + 3, v.z); wroof.rotation.y = Math.PI / 4; gp.add(wroof);
  addCollider({ x: v.x, z: v.z, r: 1.4 });
  addInteract({ x: v.x, z: v.z, y: v.h, r: 2.6, type: 'poco', label: 'Beber Água' });
  v.well = { x: v.x, z: v.z };
  /* casas em círculo */
  const nH = v.start ? 7 : 4 + Math.floor(rng() * 3);
  for (let i = 0; i < nH; i++) {
    const a = (i / nH) * TAU + rng() * 0.3, d = 17 + rng() * 12;
    const hx = v.x + Math.cos(a) * d, hz = v.z + Math.sin(a) * d;
    buildHouse(gp, hx, hz, terrainHeight(hx, hz), a + Math.PI / 2 + Math.PI, { stone: rng() < 0.25 });
    v.homes.push({ x: hx + Math.cos(a) * -3.5, z: hz + Math.sin(a) * -3.5 });
  }
  /* estalagem com camas */
  const ia = rng() * TAU, ix = v.x + Math.cos(ia) * 24, iz = v.z + Math.sin(ia) * 24;
  const ih = terrainHeight(ix, iz);
  const inn = new THREE.Group(); inn.position.set(ix, ih, iz); inn.rotation.y = ia;
  inn.add(box(8, 0.3, 6, m.woodDark, 0, 0.15, 0));
  inn.add(box(8, 3.4, 0.3, m.wall, 0, 1.7, -2.85));
  inn.add(box(0.3, 3.4, 6, m.wall, -3.85, 1.7, 0));
  inn.add(box(0.3, 3.4, 6, m.wall, 3.85, 1.7, 0));
  const iroof = new THREE.Mesh(new THREE.ConeGeometry(6.4, 2.2, 4), m.roofSlate);
  iroof.position.y = 4.5; iroof.rotation.y = Math.PI / 4; iroof.castShadow = true; inn.add(iroof);
  for (let b = 0; b < 2; b++) {
    const bed = new THREE.Group(); bed.position.set(-2 + b * 4, 0.3, -1.4);
    bed.add(box(1.2, 0.4, 2.4, m.bed, 0, 0.2, 0));
    bed.add(box(1, 0.2, 0.5, m.cloth, 0, 0.45, -0.8));
    inn.add(bed);
    const bw = new THREE.Vector3(-2 + b * 4, 0, -1.4).applyAxisAngle(new THREE.Vector3(0, 1, 0), ia);
    addInteract({ x: ix + bw.x, z: iz + bw.z, y: ih, r: 2, type: 'bed', label: 'Dormir' });
    v.beds.push({ x: ix + bw.x, z: iz + bw.z });
  }
  gp.add(inn);
  addCollider({ x: ix, z: iz, r: 4.4 });
  /* mercado: bancas */
  const stallTypes = v.start ? ['geral', 'ferreiro', 'alquimista', 'cacador'] : pickStalls(rng);
  stallTypes.forEach((st, i) => {
    const a = ia + Math.PI + (i - stallTypes.length / 2) * 0.55;
    const sx = v.x + Math.cos(a) * 13, sz = v.z + Math.sin(a) * 13;
    const sh = terrainHeight(sx, sz);
    const stall = new THREE.Group(); stall.position.set(sx, sh, sz); stall.rotation.y = a;
    stall.add(box(2.6, 0.9, 1.2, m.wood, 0, 0.45, 0));
    stall.add(cyl(0.06, 0.06, 2.4, m.woodDark, -1.2, 1.2, -0.5));
    stall.add(cyl(0.06, 0.06, 2.4, m.woodDark, 1.2, 1.2, -0.5));
    const tarp = box(3, 0.08, 2, i % 2 ? m.clothB : m.cloth, 0, 2.4, -0.2);
    tarp.rotation.x = 0.2; stall.add(tarp);
    gp.add(stall);
    addCollider({ x: sx, z: sz, r: 1.5 });
    v.stalls.push({ x: sx, z: sz, type: st, a });
    if (st === 'ferreiro') {
      const ax2 = sx + Math.cos(a + 1.2) * 3, az2 = sz + Math.sin(a + 1.2) * 3;
      gp.add(box(0.9, 0.7, 0.5, m.metal, ax2, terrainHeight(ax2, az2) + 0.35, az2));
      addInteract({ x: ax2, z: az2, y: terrainHeight(ax2, az2), r: 2.2, type: 'bigorna', label: 'Usar Bigorna' });
    }
  });
  /* quadro de missões */
  const ba = ia - 1.2, bx2 = v.x + Math.cos(ba) * 9, bz2 = v.z + Math.sin(ba) * 9;
  const bh = terrainHeight(bx2, bz2);
  gp.add(cyl(0.09, 0.09, 2.6, m.woodDark, bx2, bh + 1.3, bz2));
  gp.add(box(2, 1.3, 0.12, m.wood, bx2, bh + 2.1, bz2, ba));
  addInteract({ x: bx2, z: bz2, y: bh, r: 2.4, type: 'board', label: 'Quadro de Missões', village: v });
  v.board = { x: bx2, z: bz2 };
  /* lampiões */
  for (let i = 0; i < 3; i++) {
    const a = rng() * TAU, lx = v.x + Math.cos(a) * 8, lz = v.z + Math.sin(a) * 8;
    const lh = terrainHeight(lx, lz);
    gp.add(cyl(0.06, 0.08, 3, m.metal, lx, lh + 1.5, lz));
    const lamp = box(0.3, 0.4, 0.3, new THREE.MeshLambertMaterial({ color: 0x443311, emissive: 0xffaa33, emissiveIntensity: 0 }), lx, lh + 3, lz);
    WORLD.windowMats.push(lamp.material);
    gp.add(lamp);
  }
  /* fogueira comunitária */
  placeCampfire(v.x + 6, v.z + 6, true);
  registerGroup(gp, v.x, v.z, 190);
}
function pickStalls(rng) {
  const all = ['geral', 'ferreiro', 'alquimista', 'cacador', 'estabulo'];
  const n = 2 + Math.floor(rng() * 2), out = ['geral'];
  while (out.length < n) { const s = all[Math.floor(rng() * all.length)]; if (!out.includes(s)) out.push(s); }
  return out;
}
function buildCastle(p) {
  const m = WORLD.mat, gp = new THREE.Group();
  const { x, z, h } = p;
  /* muralhas */
  const wallLen = 46;
  [[0, -wallLen / 2, 0], [0, wallLen / 2, 0], [-wallLen / 2, 0, Math.PI / 2], [wallLen / 2, 0, Math.PI / 2]].forEach(([dx, dz, ry], i) => {
    if (i === 1) { /* portão: duas metades */
      gp.add(box(17, 7, 2, m.stone, x - 14.5, h + 3.5, z + dz, ry));
      gp.add(box(17, 7, 2, m.stone, x + 14.5, h + 3.5, z + dz, ry));
      gp.add(box(12, 2, 2.4, m.stone, x, h + 8, z + dz, ry));
      for (let c = -12; c <= 12; c += 4.8) addCollider({ x: x + c + (Math.abs(c) < 5 ? 999 : 0), z: z + dz, r: 2.2 });
      addCollider({ x: x - 9, z: z + dz, r: 3 }); addCollider({ x: x + 9, z: z + dz, r: 3 });
    } else {
      gp.add(box(wallLen, 7, 2, m.stone, x + dx, h + 3.5, z + dz, ry));
      for (let c = -20; c <= 20; c += 4) {
        addCollider({ x: x + (ry ? dx : c), z: z + (ry ? c : dz), r: 2.2 });
      }
    }
  });
  /* torres */
  [[-wallLen / 2, -wallLen / 2], [wallLen / 2, -wallLen / 2], [-wallLen / 2, wallLen / 2], [wallLen / 2, wallLen / 2]].forEach(([dx, dz]) => {
    gp.add(cyl(3.4, 3.8, 12, m.stone, x + dx, h + 6, z + dz, 8));
    const top = new THREE.Mesh(new THREE.ConeGeometry(4, 3.4, 8), m.roofSlate);
    top.position.set(x + dx, h + 13.6, z + dz); top.castShadow = true; gp.add(top);
    addCollider({ x: x + dx, z: z + dz, r: 3.8 });
  });
  /* torreão central */
  gp.add(box(14, 12, 12, m.stone, x, h + 6, z - 8));
  const kt = new THREE.Mesh(new THREE.ConeGeometry(10.4, 5, 4), m.roofSlate);
  kt.position.set(x, h + 14.4, z - 8); kt.rotation.y = Math.PI / 4; kt.castShadow = true; gp.add(kt);
  addCollider({ x: x - 5, z: z - 8, r: 4.4 }); addCollider({ x: x + 5, z: z - 8, r: 4.4 }); addCollider({ x, z: z - 11, r: 4.5 });
  /* trono na frente do torreão */
  gp.add(box(1.6, 2.4, 0.8, m.gold, x, h + 1.2, z - 1.5));
  /* estandartes */
  [[-6, 6], [6, 6]].forEach(([dx, dz]) => {
    gp.add(cyl(0.08, 0.08, 7, m.metal, x + dx, h + 3.5, z + dz));
    gp.add(box(1.4, 2.6, 0.06, m.clothB, x + dx, h + 5.4, z + dz));
  });
  addChest(gp, x + 9, z - 12, h, 'bau_rico', 'castle1');
  p.throne = { x, z: z - 0.2 };
  registerGroup(gp, x, z, 260);
}
function buildRuin(p) {
  const m = WORLD.mat, gp = new THREE.Group();
  const rng = mulberry32((Math.round(p.x) * 13 + G.seed) >>> 0);
  const n = p.r > 36 ? 10 : 6;
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU, d = 6 + rng() * (p.r * 0.5);
    const cx = p.x + Math.cos(a) * d, cz = p.z + Math.sin(a) * d;
    const ch = terrainHeight(cx, cz), colH = 1.5 + rng() * 5;
    gp.add(cyl(0.7, 0.85, colH, m.stoneDark, cx, ch + colH / 2, cz, 7));
    addCollider({ x: cx, z: cz, r: 0.95 });
  }
  /* arco central */
  gp.add(cyl(0.8, 0.9, 6.5, m.stoneDark, p.x - 3, p.h + 3.2, p.z, 7));
  gp.add(cyl(0.8, 0.9, 6.5, m.stoneDark, p.x + 3, p.h + 3.2, p.z, 7));
  gp.add(box(7.6, 1, 1.4, m.stoneDark, p.x, p.h + 6.8, p.z));
  addCollider({ x: p.x - 3, z: p.z, r: 1 }); addCollider({ x: p.x + 3, z: p.z, r: 1 });
  /* muros quebrados */
  for (let i = 0; i < 4; i++) {
    const a = rng() * TAU, d = p.r * 0.55;
    const wx = p.x + Math.cos(a) * d, wz = p.z + Math.sin(a) * d;
    gp.add(box(4 + rng() * 3, 1 + rng() * 1.6, 0.8, m.stoneDark, wx, terrainHeight(wx, wz) + 0.8, wz, a));
    addCollider({ x: wx, z: wz, r: 2 });
  }
  addChest(gp, p.x + 1.6, p.z + 2, terrainHeight(p.x + 1.6, p.z + 2), p.boss ? 'bau_rico' : 'bau_comum', p.id + '_c');
  registerGroup(gp, p.x, p.z, 200);
}
function buildCaveEntrance(p) {
  const m = WORLD.mat, gp = new THREE.Group();
  const h = terrainHeight(p.x, p.z);
  const l = box(2.6, 5, 2.6, m.stoneDark, p.x - 2, h + 2, p.z); l.rotation.z = 0.3; gp.add(l);
  const r = box(2.6, 5, 2.6, m.stoneDark, p.x + 2, h + 2, p.z); r.rotation.z = -0.3; gp.add(r);
  gp.add(box(4.6, 2, 2.4, m.stoneDark, p.x, h + 4.4, p.z));
  const portal = box(2.4, 3.2, 0.2, m.dark, p.x, h + 1.6, p.z);
  gp.add(portal);
  addCollider({ x: p.x - 2.2, z: p.z, r: 1.4 }); addCollider({ x: p.x + 2.2, z: p.z, r: 1.4 });
  addInteract({ x: p.x, z: p.z, y: h, r: 2.6, type: 'portal', label: 'Entrar em ' + p.name, to: { x: p.room.x, z: p.room.z + 8 }, cave: true });
  registerGroup(gp, p.x, p.z, 160);
  buildCaveRoom(p);
}
function buildCaveRoom(p) {
  const m = WORLD.mat, gp = new THREE.Group();
  const { x, z } = p.room, h = 2;
  const rng = mulberry32((Math.round(x) + 999) >>> 0);
  /* paredes de rocha em anel + teto */
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * TAU;
    const wx = x + Math.cos(a) * 26, wz = z + Math.sin(a) * 26;
    gp.add(box(8, 16, 6, m.stoneDark, wx, h + 6, wz, a));
    addCollider({ x: wx, z: wz, r: 4.6 });
  }
  gp.add(box(64, 2, 64, m.stoneDark, x, h + 15, z));
  /* cristais luminosos */
  for (let i = 0; i < 10; i++) {
    const a = rng() * TAU, d = 4 + rng() * 18;
    const cx = x + Math.cos(a) * d, cz = z + Math.sin(a) * d;
    const c = new THREE.Mesh(WORLD.geo.crystal, m.crystal);
    c.position.set(cx, terrainHeight(cx, cz), cz); c.scale.setScalar(0.6 + rng() * 1.6);
    gp.add(c);
  }
  addChest(gp, x, z - 14, terrainHeight(x, z - 14), 'bau_rico', p.id + '_c');
  /* saída */
  const portal = box(2.4, 3.2, 0.2, m.dark, x, h + 1.6, z + 24);
  gp.add(portal);
  addInteract({ x, z: z + 22, y: h, r: 3, type: 'portal', label: 'Sair da caverna', to: { x: p.x, z: p.z - 5 }, cave: false });
  registerGroup(gp, x, z, 120);
}
function buildCamp(p) {
  const m = WORLD.mat, gp = new THREE.Group();
  const rng = mulberry32(4242);
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * TAU + 0.4, d = 9 + rng() * 5;
    const tx = p.x + Math.cos(a) * d, tz = p.z + Math.sin(a) * d;
    const th = terrainHeight(tx, tz);
    const tent = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.6, 5), i === 0 ? m.cloth : m.thatch);
    tent.position.set(tx, th + 1.3, tz); tent.castShadow = true; gp.add(tent);
    addCollider({ x: tx, z: tz, r: 2 });
  }
  placeCampfire(p.x, p.z, true);
  /* jaula com prisioneiro (missão) */
  const cx = p.x + 8, cz = p.z - 6, ch = terrainHeight(cx, cz);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU;
    gp.add(cyl(0.07, 0.07, 2.4, m.metal, cx + Math.cos(a) * 1.2, ch + 1.2, cz + Math.sin(a) * 1.2));
  }
  gp.add(box(2.8, 0.15, 2.8, m.metal, cx, ch + 2.4, cz));
  p.cage = { x: cx, z: cz };
  addChest(gp, p.x - 6, p.z + 7, terrainHeight(p.x - 6, p.z + 7), 'bau_rico', 'camp_c');
  registerGroup(gp, p.x, p.z, 180);
}
function buildShipwreck(p) {
  const m = WORLD.mat, gp = new THREE.Group();
  const h = terrainHeight(p.x, p.z);
  const hull = box(4.5, 3, 12, m.woodDark, p.x, h + 0.8, p.z);
  hull.rotation.z = 0.35; hull.rotation.y = 0.6; gp.add(hull);
  const mast = cyl(0.14, 0.18, 8, m.woodDark, p.x + 1, h + 4, p.z);
  mast.rotation.z = 0.5; gp.add(mast);
  const sail = box(0.06, 3.4, 2.6, m.bed, p.x + 2.4, h + 5, p.z);
  sail.rotation.z = 0.5; gp.add(sail);
  addCollider({ x: p.x, z: p.z, r: 4 });
  addChest(gp, p.x + 4, p.z + 4, terrainHeight(p.x + 4, p.z + 4), 'bau_comum', 'ship_c');
  registerGroup(gp, p.x, p.z, 160);
}
function buildStoneCircle(p) {
  const m = WORLD.mat, gp = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * TAU;
    const sx = p.x + Math.cos(a) * 9, sz = p.z + Math.sin(a) * 9;
    const sh = terrainHeight(sx, sz);
    const mono = box(1.4, 4 + (i % 2), 0.9, m.stoneDark, sx, sh + 2, sz, a);
    mono.rotation.z = (hash2(i, 0, 3) - 0.5) * 0.14;
    gp.add(mono);
    addCollider({ x: sx, z: sz, r: 1.1 });
  }
  gp.add(cyl(1.6, 1.8, 0.5, m.stoneDark, p.x, p.h + 0.25, p.z));
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * TAU + 0.3;
    const fx = p.x + Math.cos(a) * 5, fz = p.z + Math.sin(a) * 5;
    const f = new THREE.Mesh(WORLD.geo.flower, m.flowerB);
    f.position.set(fx, terrainHeight(fx, fz), fz);
    gp.add(f);
    addInteract({ x: fx, z: fz, y: p.h, r: 2, type: 'colher', label: 'Colher Flor da Lua', item: 'flor_lua' });
  }
  registerGroup(gp, p.x, p.z, 140);
}
function buildFarm(p) {
  const m = WORLD.mat, gp = new THREE.Group();
  const h = p.h;
  /* campos de cultivo */
  for (let r = 0; r < 3; r++) {
    gp.add(box(12, 0.15, 1.6, m.dirt, p.x, h + 0.08, p.z - 6 + r * 3));
    for (let c = 0; c < 7; c++) gp.add(box(0.5, 0.7, 0.5, m.crop, p.x - 5 + c * 1.7, h + 0.5, p.z - 6 + r * 3));
  }
  buildHouse(gp, p.x - 10, p.z + 8, terrainHeight(p.x - 10, p.z + 8), 0.6, {});
  /* celeiro */
  const barn = box(5, 3.4, 4, m.roof, p.x + 10, h + 1.7, p.z + 8);
  gp.add(barn);
  addCollider({ x: p.x + 10, z: p.z + 8, r: 3.2 });
  gp.add(box(2, 1.2, 2, m.hay, p.x + 10, h + 0.6, p.z + 4));
  /* cerca */
  for (let i = 0; i < 10; i++) {
    gp.add(cyl(0.06, 0.06, 1, m.woodDark, p.x - 9 + i * 2, h + 0.5, p.z - 9));
    gp.add(box(2, 0.1, 0.08, m.woodDark, p.x - 8 + i * 2, h + 0.8, p.z - 9));
  }
  p.field = { x: p.x, z: p.z - 4 };
  registerGroup(gp, p.x, p.z, 150);
}
function registerGroup(gp, x, z, dist) {
  gp.traverse(o => { if (o.isMesh && G.quality.shadows) { o.castShadow = o.castShadow !== false; o.receiveShadow = true; } });
  G.scene.add(gp);
  WORLD.structGroups.push({ group: gp, x, z, dist });
}
function updateStructVisibility(px, pz) {
  for (const s of WORLD.structGroups) s.group.visible = dist2(px, pz, s.x, s.z) < s.dist + 120;
  /* janelas acendem à noite */
  const night = G.time.t < 6 || G.time.t > 18.5;
  const glow = night ? 0.9 : 0;
  for (const wm of WORLD.windowMats) wm.emissiveIntensity = glow;
}

/* ---------------- itens no chão ---------------- */
function spawnPickup(x, z, id, q) {
  const def = ITEMS[id]; if (!def) return;
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), new THREE.MeshLambertMaterial({ color: def.lend ? 0xffcc44 : 0xcfa85a, emissive: def.lend ? 0x664400 : 0x221100 }));
  const h = terrainHeight(x, z);
  mesh.position.set(x, Math.max(h, 0) + 0.4, z);
  G.scene.add(mesh);
  WORLD.pickups.push({ mesh, id, q: q || 1, x, z, y: Math.max(h, 0) + 0.4, t: 0 });
}
function updatePickups(dt, px, pz) {
  for (let i = WORLD.pickups.length - 1; i >= 0; i--) {
    const p = WORLD.pickups[i];
    p.t += dt;
    p.mesh.rotation.y += dt * 2;
    p.mesh.position.y = p.y + Math.sin(p.t * 3) * 0.12;
    const d = dist2(px, pz, p.x, p.z);
    const dogRange = (G.player && G.player.activePet && G.player.activePet.kind === 'cachorro') ? 7 : 1.5;
    if (d < dogRange && Math.abs(G.player.pos.y - p.y) < 3.5) {
      invAdd(G.player.inv, p.id, p.q);
      UI.toast('+' + p.q + ' ' + ITEMS[p.id].i + ' ' + ITEMS[p.id].n);
      AUDIO.play('pickup');
      QUESTS.event('gather', { id: p.id, q: p.q });
      G.scene.remove(p.mesh);
      WORLD.pickups.splice(i, 1);
    } else if (p.t > 300) { G.scene.remove(p.mesh); WORLD.pickups.splice(i, 1); }
  }
}

/* ---------------- inicialização ---------------- */
function initWorld() {
  initSharedAssets();
  planWorld();
  initWater();
  WORLD.villages.forEach(buildVillage);
  WORLD.pois.forEach(p => {
    if (p.kind === 'castelo') buildCastle(p);
    else if (p.kind === 'ruina') buildRuin(p);
    else if (p.kind === 'caverna') buildCaveEntrance(p);
    else if (p.kind === 'acampamento') buildCamp(p);
    else if (p.kind === 'naufragio') buildShipwreck(p);
    else if (p.kind === 'circulo') buildStoneCircle(p);
    else if (p.kind === 'fazenda') buildFarm(p);
  });
}
function checkDiscoveries(px, pz) {
  for (const p of WORLD.pois) {
    if (!p.discovered && dist2(px, pz, p.x, p.z) < p.r + 40) {
      p.discovered = true;
      G.discovered[p.id] = true;
      UI.toast('📍 Local descoberto: ' + p.name, 'gold');
      AUDIO.play('discover');
      G.player.gainXP(25);
      QUESTS.event('discover', { id: p.id, kind: p.kind });
      const n = WORLD.pois.filter(q => q.discovered).length;
      if (n >= 12) unlock('explorador');
    }
  }
}
