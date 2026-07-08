/* =====================================================================
   audio.js — Áudio procedural: SFX, ambiente e música generativa
   Nenhum arquivo externo: tudo é sintetizado em tempo real.
   ===================================================================== */
'use strict';

const AUDIO = {
  ctx: null, master: null, sfxGain: null, ambGain: null, musGain: null,
  started: false,
  vol: { master: 0.8, sfx: 0.9, music: 0.55, amb: 0.8 },
  amb: {}, musicTimer: 0, musicMode: 'day', nextNote: 0, chordI: 0,
  birdTimer: 2, cricketTimer: 1, noiseBuf: null,

  init() {
    if (this.started) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = this.vol.master;
    this.master.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = this.vol.sfx; this.sfxGain.connect(this.master);
    this.ambGain = this.ctx.createGain(); this.ambGain.gain.value = this.vol.amb; this.ambGain.connect(this.master);
    this.musGain = this.ctx.createGain(); this.musGain.gain.value = this.vol.music; this.musGain.connect(this.master);
    this.noiseBuf = this.makeNoise();
    this.setupAmbient();
    this.started = true;
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  setVol(k, v) { this.vol[k] = v; if (!this.ctx) return;
    if (k === 'master') this.master.gain.value = v;
    if (k === 'sfx') this.sfxGain.gain.value = v;
    if (k === 'music') this.musGain.gain.value = v;
    if (k === 'amb') this.ambGain.gain.value = v;
  },

  makeNoise() {
    const len = this.ctx.sampleRate * 2, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  },
  noiseSrc() {
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; return s;
  },

  /* ---------- camadas de ambiente contínuas ---------- */
  setupAmbient() {
    const mk = (freq, q, type) => {
      const src = this.noiseSrc();
      const f = this.ctx.createBiquadFilter(); f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q;
      const g = this.ctx.createGain(); g.gain.value = 0;
      src.connect(f); f.connect(g); g.connect(this.ambGain); src.start();
      return { g, f };
    };
    this.amb.wind = mk(400, 0.6, 'bandpass');
    this.amb.rain = mk(2600, 0.4, 'highpass');
    this.amb.water = mk(900, 1.2, 'bandpass');
    this.amb.fire = mk(300, 0.8, 'lowpass');
  },
  setAmb(name, level, time) {
    if (!this.ctx || !this.amb[name]) return;
    const g = this.amb[name].g.gain;
    g.cancelScheduledValues(this.ctx.currentTime);
    g.linearRampToValueAtTime(level, this.ctx.currentTime + (time || 1.5));
  },

  /* ---------- SFX genérico ---------- */
  tone(freq, dur, type, vol, slide, delay) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + (delay || 0);
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol || 0.2, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t0); o.stop(t0 + dur + 0.05);
  },
  burst(dur, vol, filterFreq, type, delay) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + (delay || 0);
    const s = this.noiseSrc();
    const f = this.ctx.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = filterFreq || 800;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.3, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxGain);
    s.start(t0); s.stop(t0 + dur + 0.05);
  },

  play(name, o) {
    if (!this.ctx) return; o = o || {};
    switch (name) {
      case 'step': {
        const surf = o.surf || 'grass';
        if (surf === 'water') { this.burst(0.12, 0.12, 2200, 'bandpass'); this.tone(300, 0.08, 'sine', 0.03, 0.6); }
        else if (surf === 'stone') this.burst(0.07, 0.14, 1400, 'highpass');
        else if (surf === 'snow') this.burst(0.12, 0.1, 700, 'lowpass');
        else this.burst(0.08, 0.1, 500, 'lowpass');
        break; }
      case 'swing': this.burst(0.15, 0.16, 1800, 'bandpass'); break;
      case 'hit': this.burst(0.12, 0.3, 500, 'lowpass'); this.tone(160, 0.1, 'square', 0.12, 0.5); break;
      case 'hitBlock': this.tone(520, 0.12, 'square', 0.18, 0.7); this.burst(0.08, 0.2, 3000, 'highpass'); break;
      case 'bow': this.tone(700, 0.12, 'sawtooth', 0.1, 0.4); this.burst(0.1, 0.1, 3000, 'highpass'); break;
      case 'magic': this.tone(880, 0.35, 'sine', 0.15, 1.8); this.tone(440, 0.3, 'triangle', 0.1, 2.2); break;
      case 'heal': this.tone(520, 0.4, 'sine', 0.12, 1.5); this.tone(780, 0.5, 'sine', 0.1, 1.3, 0.1); break;
      case 'fire': this.tone(200, 0.5, 'sawtooth', 0.12, 0.4); this.burst(0.5, 0.2, 900, 'lowpass'); break;
      case 'hurt': this.tone(240, 0.2, 'sawtooth', 0.16, 0.5); break;
      case 'die': this.tone(180, 0.8, 'sawtooth', 0.2, 0.3); break;
      case 'eat': this.burst(0.1, 0.14, 900, 'lowpass'); this.burst(0.1, 0.12, 900, 'lowpass', 0.15); break;
      case 'drink': this.tone(400, 0.12, 'sine', 0.08, 1.4); this.tone(500, 0.12, 'sine', 0.08, 1.4, 0.15); break;
      case 'coin': this.tone(1900, 0.1, 'square', 0.07); this.tone(2450, 0.16, 'square', 0.07, 1, 0.06); break;
      case 'ui': this.tone(700, 0.05, 'square', 0.05); break;
      case 'open': this.burst(0.2, 0.14, 600, 'lowpass'); this.tone(220, 0.15, 'triangle', 0.08, 1.3); break;
      case 'pickup': this.tone(880, 0.09, 'triangle', 0.09, 1.3); break;
      case 'craft': this.tone(400, 0.1, 'square', 0.09); this.tone(600, 0.1, 'square', 0.09, 1, 0.12); break;
      case 'anvil': this.tone(1200, 0.25, 'square', 0.1, 0.6); this.burst(0.1, 0.2, 4000, 'highpass'); break;
      case 'levelup': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.12, 1, i * 0.12)); break;
      case 'quest': [392, 523, 659].forEach((f, i) => this.tone(f, 0.3, 'sine', 0.11, 1, i * 0.14)); break;
      case 'questDone': [659, 784, 988, 1318].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.12, 1, i * 0.13)); break;
      case 'achievement': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.45, 'sine', 0.1, 1, i * 0.1)); break;
      case 'discover': [440, 554, 659, 880].forEach((f, i) => this.tone(f, 0.5, 'sine', 0.09, 1, i * 0.16)); break;
      case 'thunder': this.burst(1.6, 0.5, 120, 'lowpass', o.delay || 0); this.burst(0.5, 0.3, 400, 'lowpass', (o.delay || 0) + 0.1); break;
      case 'wolf': this.tone(420, 0.9, 'sawtooth', 0.07, 1.5); break;
      case 'horse': this.tone(500, 0.4, 'sawtooth', 0.08, 1.8); this.tone(650, 0.3, 'sawtooth', 0.06, 0.7, 0.3); break;
      case 'dog': this.tone(500, 0.09, 'square', 0.1, 1.4); this.tone(500, 0.09, 'square', 0.1, 1.4, 0.16); break;
      case 'cat': this.tone(600, 0.4, 'sine', 0.07, 1.6); break;
      case 'bird': { const f0 = rand(1800, 3200); this.tone(f0, 0.07, 'sine', 0.04, 1.3); this.tone(f0 * 1.2, 0.07, 'sine', 0.04, 0.8, 0.1); break; }
      case 'owl': this.tone(340, 0.3, 'sine', 0.07, 0.85); this.tone(300, 0.4, 'sine', 0.07, 0.85, 0.4); break;
      case 'parrot': this.tone(1400, 0.1, 'square', 0.06, 1.5); this.tone(1100, 0.12, 'square', 0.06, 0.7, 0.13); break;
      case 'cricket': this.tone(4200, 0.04, 'sine', 0.02); this.tone(4200, 0.04, 'sine', 0.02, 1, 0.07); break;
      case 'splash': this.burst(0.4, 0.25, 1800, 'bandpass'); break;
      case 'dig': this.burst(0.2, 0.2, 400, 'lowpass'); break;
      case 'chop': this.burst(0.1, 0.25, 900, 'bandpass'); this.tone(140, 0.1, 'square', 0.1, 0.6); break;
      case 'mine': this.tone(1500, 0.15, 'square', 0.12, 0.5); this.burst(0.08, 0.15, 4000, 'highpass'); break;
      case 'whistle': this.tone(1600, 0.25, 'sine', 0.1, 1.4); this.tone(2100, 0.3, 'sine', 0.1, 0.8, 0.25); break;
      case 'sleep': [400, 300, 250].forEach((f, i) => this.tone(f, 0.6, 'sine', 0.07, 0.9, i * 0.4)); break;
      case 'boss': this.tone(80, 1.4, 'sawtooth', 0.2, 1.6); this.tone(60, 1.6, 'square', 0.14, 1.2, 0.2); break;
      case 'fail': this.tone(300, 0.25, 'sawtooth', 0.12, 0.6); this.tone(200, 0.35, 'sawtooth', 0.12, 0.6, 0.2); break;
    }
  },

  /* ---------- música generativa ---------- */
  musNote(freq, dur, vol, delay, type) {
    const t0 = this.ctx.currentTime + (delay || 0);
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'triangle'; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.musGain); o.start(t0); o.stop(t0 + dur + 0.1);
  },
  update(dt) {
    if (!this.ctx || G.state !== 'play') return;
    /* pássaros de dia, grilos e coruja à noite */
    const night = G.time.t < 5.5 || G.time.t > 19.5;
    this.birdTimer -= dt;
    if (this.birdTimer <= 0) {
      if (!night && ENV.weather !== 'tempestade' && Math.random() < 0.8) this.play('bird');
      if (night && Math.random() < 0.12) this.play('owl');
      this.birdTimer = rand(1.5, night ? 6 : 4);
    }
    if (night) { this.cricketTimer -= dt; if (this.cricketTimer <= 0) { this.play('cricket'); this.cricketTimer = rand(0.4, 1.6); } }

    /* música */
    const mode = G.inCombat > 0 ? 'combat' : (night ? 'night' : 'day');
    this.musicMode = mode;
    this.nextNote -= dt;
    if (this.nextNote <= 0) {
      const chords = { day: [[220, 277, 330], [196, 247, 294], [175, 220, 262], [196, 247, 294]],
                       night: [[165, 196, 247], [147, 175, 220], [131, 165, 196], [147, 175, 220]],
                       combat: [[110, 131, 165], [104, 124, 156], [110, 131, 165], [117, 147, 175]] };
      const scale = { day: [440, 494, 554, 659, 740, 880], night: [330, 392, 440, 494, 587], combat: [220, 262, 294, 330, 392] };
      const ch = chords[mode][this.chordI % 4];
      const beat = mode === 'combat' ? 0.42 : 0.9;
      /* pad de acorde */
      ch.forEach(f => this.musNote(f, beat * 4, mode === 'combat' ? 0.028 : 0.022, 0, 'sine'));
      /* melodia */
      for (let i = 0; i < 4; i++) {
        if (Math.random() < (mode === 'night' ? 0.45 : 0.7))
          this.musNote(pick(scale[mode]), beat * rand(0.8, 1.6), mode === 'combat' ? 0.05 : 0.035, i * beat, 'triangle');
      }
      /* percussão em combate */
      if (mode === 'combat') for (let i = 0; i < 4; i++) {
        this.burstMus(0.08, 0.09, i * beat);
        if (i % 2 === 1) this.burstMus(0.05, 0.05, i * beat + beat / 2);
      }
      this.chordI++;
      this.nextNote = beat * 4;
    }
  },
  burstMus(dur, vol, delay) {
    const t0 = this.ctx.currentTime + delay;
    const s = this.noiseSrc();
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 240;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(this.musGain); s.start(t0); s.stop(t0 + dur + 0.05);
  },
};
