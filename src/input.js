/* =====================================================================
   input.js — Teclado, mouse (pointer lock) e controles de toque
   ===================================================================== */
'use strict';

const CONTROLS = {
  init() {
    this.bindKeyboard();
    this.bindMouse();
    if (G.isMobile) this.bindTouch();
    else document.getElementById('controlsMobile').style.display = 'none';
  },

  bindKeyboard() {
    const map = { KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right', ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    addEventListener('keydown', e => {
      if (e.repeat) return;
      const k = e.code;
      if (map[k]) INPUT.keys[map[k]] = true;
      if (k === 'ShiftLeft' || k === 'ShiftRight') INPUT.run = true;
      if (k === 'ControlLeft' || k === 'KeyC' && false) INPUT.crouch = true;
      if (k === 'ControlLeft') INPUT.crouch = true;
      if (G.state !== 'play') return;
      if (k === 'Space') { e.preventDefault(); INPUT.jumpP = true; }
      if (k === 'KeyQ') INPUT.rollP = true;
      if (k === 'KeyE') INPUT.interactP = true;
      if (k === 'KeyR') INPUT.castP = true;
      if (k === 'KeyF') GAME.toggleTorch();
      if (k === 'KeyH') GAME.whistlePet();
      /* painéis */
      if (k === 'Tab') { e.preventDefault(); UI.togglePanel('inv'); }
      if (k === 'KeyM') UI.togglePanel('map');
      if (k === 'KeyJ') UI.togglePanel('quests');
      if (k === 'KeyK') UI.togglePanel('skills');
      if (k === 'KeyP') UI.togglePanel('pets');
      if (k === 'KeyC') UI.togglePanel('stats');
      if (k === 'KeyB') UI.togglePanel('craft');
      if (k === 'Escape') { if (UI.activePanel || document.getElementById('dialog').style.display === 'flex') { UI.closePanel(); UI.closeDialog(); } else UI.togglePanel('menu'); }
      /* hotbar 1-5 */
      if (k === 'Digit1') GAME.quickPotion();
      if (k === 'Digit2') GAME.quickFood();
      if (k === 'Digit3') UI.cycleSpell();
      if (k === 'Digit4') GAME.toggleTorch();
      if (k === 'Digit5') GAME.whistlePet();
    });
    addEventListener('keyup', e => {
      const k = e.code;
      if (map[k]) INPUT.keys[map[k]] = false;
      if (k === 'ShiftLeft' || k === 'ShiftRight') INPUT.run = false;
      if (k === 'ControlLeft') INPUT.crouch = false;
    });
  },

  bindMouse() {
    const cv = G.renderer.domElement;
    cv.addEventListener('click', () => {
      if (G.state === 'play' && !UI.activePanel && !G.isMobile && document.pointerLockElement !== cv) cv.requestPointerLock();
    });
    addEventListener('mousemove', e => {
      if (document.pointerLockElement === cv) { INPUT.look.dx += e.movementX; INPUT.look.dy += e.movementY; }
    });
    cv.addEventListener('mousedown', e => {
      if (G.state !== 'play' || UI.activePanel) return;
      if (e.button === 0) { INPUT.attackHeld = true; INPUT.attackP = true; }
      if (e.button === 2) INPUT.block = true;
    });
    addEventListener('mouseup', e => {
      if (e.button === 0) INPUT.attackHeld = false;
      if (e.button === 2) INPUT.block = false;
    });
    addEventListener('contextmenu', e => e.preventDefault());
    /* roda do mouse muda arma rápida entre equipadas comuns? — pula */
  },

  /* --------------- toque --------------- */
  bindTouch() {
    const mob = document.getElementById('controlsMobile');
    mob.style.display = 'block';
    /* joystick esquerdo */
    const stick = document.getElementById('joystick'), knob = document.getElementById('joyknob');
    let sid = null, cx = 0, cy = 0;
    const startJoy = (id, x, y) => { sid = id; const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; };
    const moveJoy = (x, y) => {
      let dx = x - cx, dy = y - cy;
      const max = 52, len = Math.hypot(dx, dy);
      if (len > max) { dx = dx / len * max; dy = dy / len * max; }
      knob.style.transform = `translate(${dx}px,${dy}px)`;
      INPUT.mv.x = dx / max; INPUT.mv.y = -dy / max;
      INPUT.run = len > max * 0.82;
    };
    const endJoy = () => { sid = null; knob.style.transform = 'translate(0,0)'; INPUT.mv.x = 0; INPUT.mv.y = 0; INPUT.run = false; };

    /* área de olhar (direita) */
    let lid = null, lx = 0, ly = 0;
    const lookZone = document.getElementById('lookzone');

    const onStart = e => {
      for (const t of e.changedTouches) {
        const x = t.clientX, y = t.clientY;
        if (x < innerWidth * 0.45 && y > innerHeight * 0.45 && sid === null) { startJoy(t.identifier, x, y); moveJoy(x, y); }
        else if (x > innerWidth * 0.5 && lid === null) { lid = t.identifier; lx = x; ly = y; }
      }
    };
    const onMove = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === sid) moveJoy(t.clientX, t.clientY);
        else if (t.identifier === lid) { INPUT.look.dx += (t.clientX - lx) * 1.6; INPUT.look.dy += (t.clientY - ly) * 1.6; lx = t.clientX; ly = t.clientY; }
      }
      e.preventDefault();
    };
    const onEnd = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === sid) endJoy();
        if (t.identifier === lid) lid = null;
      }
    };
    addEventListener('touchstart', onStart, { passive: false });
    addEventListener('touchmove', onMove, { passive: false });
    addEventListener('touchend', onEnd);
    addEventListener('touchcancel', onEnd);

    /* botões de ação */
    const btn = (id, on, off) => {
      const b = document.getElementById(id);
      if (!b) return;
      b.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); on(); b.classList.add('pressed'); }, { passive: false });
      b.addEventListener('touchend', e => { e.preventDefault(); e.stopPropagation(); if (off) off(); b.classList.remove('pressed'); });
    };
    btn('btn-attack', () => { INPUT.attackP = true; INPUT.attackHeld = true; }, () => INPUT.attackHeld = false);
    btn('btn-block', () => INPUT.block = true, () => INPUT.block = false);
    btn('btn-jump', () => INPUT.jumpP = true);
    btn('btn-roll', () => INPUT.rollP = true);
    btn('btn-interact', () => INPUT.interactP = true);
    btn('btn-cast', () => INPUT.castP = true);
    btn('btn-crouch', () => INPUT.crouch = !INPUT.crouch);
    /* botões de HUD (painéis) já usam onclick via bindHUDButtons */
  },
};
