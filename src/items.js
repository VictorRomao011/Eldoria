/* =====================================================================
   items.js — Itens, inventário, craft, saque e economia
   ===================================================================== */
'use strict';

/* id: [nome, ícone, tipo, peso, valor, extra]
   tipos: arma, arco, magiafoco, escudo, armadura, comida, bebida, pocao,
          material, ferramenta, especial, luz */
const ITEMS = {
  faca:        { n: 'Faca de Caça', i: '🔪', t: 'arma', w: 0.5, v: 12, dmg: 5, spd: 1.5, rng: 1.7 },
  espada:      { n: 'Espada Curta', i: '🗡️', t: 'arma', w: 2, v: 40, dmg: 9, spd: 1.1, rng: 2.2 },
  espada_ferro:{ n: 'Espada de Ferro', i: '⚔️', t: 'arma', w: 2.6, v: 110, dmg: 13, spd: 1.05, rng: 2.2 },
  machado:     { n: 'Machado de Batalha', i: '🪓', t: 'arma', w: 3.5, v: 85, dmg: 15, spd: 0.75, rng: 2.1, chop: true },
  lanca:       { n: 'Lança', i: '🔱', t: 'arma', w: 2.8, v: 70, dmg: 11, spd: 0.95, rng: 3 },
  aurora:      { n: '✦ Aurora, Lâmina do Amanhecer', i: '🌅', t: 'arma', w: 2, v: 900, dmg: 22, spd: 1.2, rng: 2.4, lend: true, glow: 0xffcc66 },
  presa_noite: { n: '✦ Presa da Noite', i: '🌘', t: 'arma', w: 1.4, v: 700, dmg: 17, spd: 1.5, rng: 1.9, lend: true, glow: 0x8866ff },
  arco:        { n: 'Arco de Caça', i: '🏹', t: 'arco', w: 1.2, v: 60, dmg: 10, spd: 0.9 },
  arco_longo:  { n: 'Arco Longo Élfico', i: '🏹', t: 'arco', w: 1.4, v: 220, dmg: 16, spd: 0.85, lend: false },
  besta:       { n: 'Besta Pesada', i: '🎯', t: 'arco', w: 3.2, v: 190, dmg: 20, spd: 0.55 },
  cajado:      { n: 'Cajado do Errante', i: '🪄', t: 'magiafoco', w: 1.6, v: 150, dmg: 4, spd: 1, rng: 2, mag: 1.25 },
  escudo:      { n: 'Escudo de Madeira', i: '🛡️', t: 'escudo', w: 3, v: 35, def: 4 },
  escudo_ferro:{ n: 'Escudo de Ferro', i: '🛡️', t: 'escudo', w: 5, v: 120, def: 8 },
  tocha:       { n: 'Tocha', i: '🕯️', t: 'luz', w: 0.8, v: 8 },
  roupa:       { n: 'Roupas de Viajante', i: '👕', t: 'armadura', w: 1.5, v: 15, def: 1, warm: 4 },
  couro:       { n: 'Armadura de Couro', i: '🦺', t: 'armadura', w: 5, v: 80, def: 4, warm: 8 },
  malha:       { n: 'Cota de Malha', i: '⛓️', t: 'armadura', w: 10, v: 220, def: 7, warm: 5 },
  placas:      { n: 'Armadura de Placas', i: '🛡️', t: 'armadura', w: 16, v: 520, def: 11, warm: 6 },
  casaco:      { n: 'Casaco de Pele de Urso', i: '🧥', t: 'armadura', w: 6, v: 160, def: 3, warm: 20 },
  flecha:      { n: 'Flecha', i: '➶', t: 'material', w: 0.05, v: 1 },
  pao:         { n: 'Pão', i: '🍞', t: 'comida', w: 0.3, v: 4, food: 22 },
  maca:        { n: 'Maçã', i: '🍎', t: 'comida', w: 0.2, v: 3, food: 12, water: 6 },
  queijo:      { n: 'Queijo', i: '🧀', t: 'comida', w: 0.4, v: 8, food: 28 },
  carne_crua:  { n: 'Carne Crua', i: '🥩', t: 'comida', w: 0.6, v: 5, food: 15, raw: true },
  carne:       { n: 'Carne Assada', i: '🍖', t: 'comida', w: 0.6, v: 12, food: 45, hp: 8 },
  peixe_cru:   { n: 'Peixe Fresco', i: '🐟', t: 'comida', w: 0.4, v: 5, food: 10, raw: true },
  peixe:       { n: 'Peixe Grelhado', i: '🐠', t: 'comida', w: 0.4, v: 11, food: 35, hp: 5 },
  ensopado:    { n: 'Ensopado do Caçador', i: '🍲', t: 'comida', w: 0.8, v: 25, food: 70, hp: 20 },
  frutas:      { n: 'Frutas Silvestres', i: '🫐', t: 'comida', w: 0.15, v: 3, food: 8, water: 8 },
  cogumelo:    { n: 'Cogumelo', i: '🍄', t: 'comida', w: 0.1, v: 4, food: 8, raw: true },
  cantil:      { n: 'Cantil de Água', i: '🥤', t: 'bebida', w: 1, v: 6, water: 45 },
  cerveja:     { n: 'Cerveja de Eldervale', i: '🍺', t: 'bebida', w: 0.8, v: 9, water: 20, food: 8 },
  pocao_hp:    { n: 'Poção de Cura', i: '❤️‍🩹', t: 'pocao', w: 0.4, v: 30, hp: 45 },
  pocao_stam:  { n: 'Poção de Vigor', i: '💚', t: 'pocao', w: 0.4, v: 22, stam: 60 },
  pocao_mana:  { n: 'Poção de Mana', i: '💙', t: 'pocao', w: 0.4, v: 28, mana: 50 },
  antidoto:    { n: 'Antídoto', i: '🧪', t: 'pocao', w: 0.3, v: 26, cure: 'veneno' },
  remedio:     { n: 'Remédio de Ervas', i: '🌡️', t: 'pocao', w: 0.3, v: 24, cure: 'resfriado' },
  bandagem:    { n: 'Bandagem', i: '🩹', t: 'pocao', w: 0.1, v: 10, hp: 18, cure: 'sangrando' },
  erva:        { n: 'Erva-do-Sol', i: '🌿', t: 'material', w: 0.05, v: 4 },
  flor_lua:    { n: 'Flor da Lua', i: '🌸', t: 'material', w: 0.05, v: 8 },
  raiz:        { n: 'Raiz Amarga', i: '🥕', t: 'material', w: 0.1, v: 5 },
  madeira:     { n: 'Madeira', i: '🪵', t: 'material', w: 1.5, v: 2 },
  pedra:       { n: 'Pedra', i: '🪨', t: 'material', w: 2, v: 1 },
  ferro:       { n: 'Minério de Ferro', i: '⛏️', t: 'material', w: 2.5, v: 14 },
  pele:        { n: 'Pele de Animal', i: '🟫', t: 'material', w: 1, v: 8 },
  pele_urso:   { n: 'Pele de Urso', i: '🐻', t: 'material', w: 3, v: 40 },
  presa:       { n: 'Presa de Lobo', i: '🦷', t: 'material', w: 0.1, v: 6 },
  pena:        { n: 'Pena', i: '🪶', t: 'material', w: 0.02, v: 2 },
  corda:       { n: 'Corda', i: '🪢', t: 'material', w: 0.5, v: 7 },
  vara:        { n: 'Vara de Pescar', i: '🎣', t: 'ferramenta', w: 1, v: 25 },
  picareta:    { n: 'Picareta', i: '⛏️', t: 'ferramenta', w: 3, v: 45, mine: true },
  pa:          { n: 'Pá', i: '🥄', t: 'ferramenta', w: 2.5, v: 30, dig: true },
  sela:        { n: 'Sela de Montaria', i: '🐎', t: 'especial', w: 6, v: 120 },
  feno:        { n: 'Feno', i: '🌾', t: 'especial', w: 1, v: 3 },
  osso:        { n: 'Osso', i: '🦴', t: 'material', w: 0.4, v: 3, petfood: true },
  mapa_tesouro:{ n: 'Mapa do Tesouro', i: '🗺️', t: 'especial', w: 0.1, v: 50 },
  pacote:      { n: 'Pacote Selado', i: '📦', t: 'especial', w: 2, v: 0 },
  gema:        { n: 'Gema Bruta', i: '💎', t: 'material', w: 0.3, v: 65 },
  coroa_velha: { n: 'Coroa Enferrujada', i: '👑', t: 'especial', w: 1, v: 120 },
  fragmento:   { n: '✦ Fragmento do Eclipse', i: '🔮', t: 'especial', w: 0.5, v: 0, lend: true },
  amuleto_sol: { n: '✦ Amuleto do Sol', i: '🌞', t: 'amuleto', w: 0.2, v: 400, lend: true, warm: 10, def: 2 },
  anel_lobo:   { n: 'Anel do Lobo', i: '💍', t: 'amuleto', w: 0.1, v: 180, dmgb: 0.1 },
  colar_rio:   { n: 'Colar do Rio', i: '📿', t: 'amuleto', w: 0.1, v: 150, stamb: 20 },
};
function itemDef(id) { return ITEMS[id]; }

/* Inventário: lista [{id, q}] */
function invAdd(inv, id, q) {
  q = q || 1;
  const s = inv.find(s => s.id === id);
  if (s) s.q += q; else inv.push({ id, q });
}
function invRemove(inv, id, q) {
  q = q || 1;
  const s = inv.find(s => s.id === id); if (!s || s.q < q) return false;
  s.q -= q; if (s.q <= 0) inv.splice(inv.indexOf(s), 1);
  return true;
}
function invCount(inv, id) { const s = inv.find(s => s.id === id); return s ? s.q : 0; }
function invWeight(inv) { return inv.reduce((w, s) => w + ITEMS[s.id].w * s.q, 0); }

/* Receitas de criação — where: null=qualquer lugar, fogueira, bigorna */
const RECIPES = [
  { id: 'fogueira', n: 'Fogueira', i: '🔥', out: null, need: { madeira: 3, pedra: 2 }, where: null, place: 'campfire' },
  { id: 'carne', out: 'carne', need: { carne_crua: 1 }, where: 'fogueira' },
  { id: 'peixe', out: 'peixe', need: { peixe_cru: 1 }, where: 'fogueira' },
  { id: 'ensopado', out: 'ensopado', need: { carne_crua: 1, cogumelo: 1, raiz: 1 }, where: 'fogueira' },
  { id: 'pocao_hp', out: 'pocao_hp', need: { erva: 2, flor_lua: 1 }, where: 'fogueira' },
  { id: 'pocao_stam', out: 'pocao_stam', need: { erva: 1, frutas: 2 }, where: 'fogueira' },
  { id: 'antidoto', out: 'antidoto', need: { raiz: 2, erva: 1 }, where: 'fogueira' },
  { id: 'remedio', out: 'remedio', need: { erva: 2, raiz: 1 }, where: 'fogueira' },
  { id: 'bandagem', out: 'bandagem', need: { pele: 1 }, where: null },
  { id: 'flecha', out: 'flecha', outQ: 6, need: { madeira: 1, pena: 2 }, where: null },
  { id: 'tocha', out: 'tocha', need: { madeira: 1, pele: 1 }, where: null },
  { id: 'corda', out: 'corda', need: { pele: 2 }, where: null },
  { id: 'vara', out: 'vara', need: { madeira: 2, corda: 1 }, where: null },
  { id: 'arco', out: 'arco', need: { madeira: 3, corda: 2 }, where: null },
  { id: 'lanca', out: 'lanca', need: { madeira: 2, ferro: 1, corda: 1 }, where: 'bigorna' },
  { id: 'espada_ferro', out: 'espada_ferro', need: { ferro: 3, madeira: 1 }, where: 'bigorna' },
  { id: 'escudo_ferro', out: 'escudo_ferro', need: { ferro: 4, madeira: 2 }, where: 'bigorna' },
  { id: 'malha', out: 'malha', need: { ferro: 6, couro: 1 }, where: 'bigorna' },
  { id: 'couro', out: 'couro', need: { pele: 5, corda: 1 }, where: null },
  { id: 'casaco', out: 'casaco', need: { pele_urso: 2, corda: 2 }, where: null },
];

/* Tabelas de saque */
const LOOT = {
  lobo: [['carne_crua', 1, 2], ['pele', 1, 1], ['presa', 0, 2]],
  veado: [['carne_crua', 2, 3], ['pele', 1, 2]],
  coelho: [['carne_crua', 1, 1], ['pele', 0, 1]],
  javali: [['carne_crua', 2, 4], ['pele', 1, 2]],
  urso: [['carne_crua', 3, 5], ['pele_urso', 1, 2]],
  bandido: [['ouro', 5, 22], ['pao', 0, 1], ['flecha', 0, 5], ['pocao_hp', 0, 1]],
  esqueleto: [['osso', 1, 3], ['ouro', 3, 12], ['flecha', 0, 4]],
  passaro: [['pena', 1, 3], ['carne_crua', 0, 1]],
  bau_comum: [['ouro', 10, 45], ['pocao_hp', 0, 1], ['flecha', 0, 8], ['pele', 0, 2], ['gema', 0, 1]],
  bau_rico: [['ouro', 50, 140], ['gema', 1, 2], ['pocao_hp', 1, 2], ['ferro', 1, 3]],
};
function rollLoot(table) {
  const out = [];
  (LOOT[table] || []).forEach(([id, a, b]) => {
    const q = randi(a, b);
    if (q > 0) out.push({ id, q });
  });
  return out;
}

/* Lojas — estoque por tipo de mercador */
const SHOPS = {
  geral: ['pao', 'maca', 'queijo', 'cantil', 'cerveja', 'tocha', 'corda', 'vara', 'pa', 'roupa', 'feno', 'osso'],
  ferreiro: ['espada', 'espada_ferro', 'machado', 'lanca', 'escudo', 'escudo_ferro', 'couro', 'malha', 'placas', 'picareta', 'ferro'],
  alquimista: ['pocao_hp', 'pocao_stam', 'pocao_mana', 'antidoto', 'remedio', 'erva', 'flor_lua', 'cajado'],
  cacador: ['arco', 'arco_longo', 'besta', 'flecha', 'faca', 'carne_crua', 'pele', 'casaco'],
  estabulo: ['sela', 'feno'],
  leiloeiro: [],
};
function shopStock(type, day) {
  const stock = SHOPS[type].map(id => ({ id, q: id === 'flecha' ? 40 : (ITEMS[id].t === 'comida' || ITEMS[id].t === 'material' ? 8 : 2) }));
  if (type === 'leiloeiro') {
    const rares = ['aurora', 'presa_noite', 'amuleto_sol', 'anel_lobo', 'colar_rio', 'arco_longo', 'placas', 'gema'];
    const r = mulberry32(day * 7 + 3);
    const a = rares[Math.floor(r() * rares.length)];
    let b = rares[Math.floor(r() * rares.length)]; if (b === a) b = rares[(rares.indexOf(a) + 1) % rares.length];
    stock.push({ id: a, q: 1, mult: 1.6 }, { id: b, q: 1, mult: 1.6 });
  }
  return stock;
}
function priceBuy(id, mult) {
  const barter = 1 - Math.min(0.2, (G.player ? G.player.barter : 0) * 0.02);
  return Math.max(1, Math.round(ITEMS[id].v * 1.4 * (mult || 1) * barter));
}
function priceSell(id) {
  const barter = 1 + Math.min(0.2, (G.player ? G.player.barter : 0) * 0.02);
  return Math.max(1, Math.round(ITEMS[id].v * 0.45 * barter));
}
