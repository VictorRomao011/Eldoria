/* =====================================================================
   ELDORIA — O Último Amanhecer
   utils.js — matemática, ruído procedural, RNG e estado global
   ===================================================================== */
'use strict';

const TAU = Math.PI * 2;

function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(a, b, t) { t = clamp((t - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
function rand(a, b) { return a + Math.random() * (b - a); }
function randi(a, b) { return Math.floor(rand(a, b + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }
function angLerp(a, b, t) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU;
  return a + d * t;
}
function uid() { return Math.random().toString(36).slice(2, 10); }

/* RNG determinístico (mulberry32) */
function mulberry32(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* hash 2D determinístico → [0,1) */
function hash2(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + (s || 0) * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/* Ruído de valor 2D suavizado */
function noise2(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s);
  const c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

/* Fractal Brownian Motion */
function fbm(x, y, oct, s) {
  let v = 0, amp = 0.5, f = 1, tot = 0;
  for (let i = 0; i < oct; i++) {
    v += noise2(x * f, y * f, (s || 0) + i * 101) * amp;
    tot += amp; amp *= 0.5; f *= 2.03;
  }
  return v / tot;
}

function fmtTime(t) {
  const h = Math.floor(t), m = Math.floor((t - h) * 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}
function fmtWeight(w) { return w.toFixed(1).replace('.', ','); }

/* projeta posição do mundo para a tela; retorna null se atrás da câmera */
const _wts = new THREE.Vector3();
function worldToScreen(x, y, z) {
  _wts.set(x, y, z).project(G.camera);
  if (_wts.z > 1) return null;
  return { x: (_wts.x * 0.5 + 0.5) * innerWidth, y: (-_wts.y * 0.5 + 0.5) * innerHeight };
}

/* ------------------------------------------------------------------ */
/* Estado global do jogo                                              */
/* ------------------------------------------------------------------ */
const G = {
  state: 'boot',            // boot | title | create | play | dead | ending
  seed: 1337,
  scene: null, camera: null, renderer: null,
  player: null,
  time: { t: 8.5, day: 1, speed: 1 / 30 },  // 1 dia = 12 min reais
  wind: { dir: 0.6, speed: 3 },
  entities: [], projectiles: [], particles: [],
  pets: [], horses: [],
  flags: {}, rep: {}, discovered: {},
  achievements: {}, stats: { kills: 0, quests: 0, fish: 0, cooked: 0, tamed: 0, gathered: 0, dist: 0, trades: 0 },
  inCombat: 0, inCave: false,
  paused: false,
  quality: { shadows: true, viewDist: 2, particles: 1, waves: true },
  isMobile: ('ontouchstart' in window) && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent || ''),
};
if (G.isMobile) G.quality = { shadows: false, viewDist: 2, particles: 0.6, waves: false };

/* Entrada unificada (teclado/mouse/toque) */
const INPUT = {
  mv: { x: 0, y: 0 },        // vetor de movimento -1..1
  look: { dx: 0, dy: 0 },
  keys: {},
  run: false, crouch: false,
  jumpP: false, attackP: false, rollP: false, interactP: false, whistleP: false, castP: false,
  block: false,
  consume() { this.jumpP = this.attackP = this.rollP = this.interactP = this.whistleP = this.castP = false; this.look.dx = 0; this.look.dy = 0; }
};

/* Conquistas */
const ACHV = [
  ['primeiro_sangue', 'Primeiro Sangue', 'Derrote seu primeiro inimigo'],
  ['domador', 'Domador', 'Dome um cavalo selvagem'],
  ['melhor_amigo', 'Melhor Amigo', 'Adote um animal de estimação'],
  ['pescador', 'Pescador', 'Pesque 10 peixes'],
  ['cozinheiro', 'Chef de Fogueira', 'Cozinhe 20 alimentos'],
  ['explorador', 'Explorador', 'Descubra 12 locais'],
  ['nivel10', 'Veterano', 'Alcance o nível 10'],
  ['rico', 'Bolsos Fundos', 'Acumule 1000 moedas de ouro'],
  ['heroi', 'Herói do Povo', 'Complete 10 missões'],
  ['rei_ossos', 'Quebra-Ossos', 'Derrote o Rei Esqueleto'],
  ['ursa', 'Coração da Caverna', 'Derrote a Ursa Anciã'],
  ['garrick', 'Justiça nas Estradas', 'Resolva o destino de Garrick'],
  ['eclipse', 'O Último Amanhecer', 'Termine a história principal'],
  ['sobrevivente', 'Sobrevivente', 'Sobreviva a uma tempestade durante a noite'],
  ['botanico', 'Botânico', 'Colete 30 plantas'],
  ['lenda', 'Lenda Viva', 'Alcance o nível 20'],
];
function unlock(id) {
  if (G.achievements[id]) return;
  const a = ACHV.find(a => a[0] === id); if (!a) return;
  G.achievements[id] = true;
  UI.toast('🏆 Conquista: ' + a[1], 'gold');
  AUDIO.play('achievement');
}
