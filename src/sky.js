/* =====================================================================
   sky.js — Ambiente: iluminação, céu, clima dinâmico e partículas
   ===================================================================== */
'use strict';

class Environment {
  constructor(scene) {
    this.scene = scene;
    this.weather = 'limpo';
    this.weatherTimer = rand(90, 180);
    this.weatherBlend = 1;
    this.lightningT = 0; this.flash = 0;

    this.sun = new THREE.DirectionalLight(0xffeecc, 1);
    this.sun.castShadow = G.quality.shadows;
    if (G.quality.shadows) {
      this.sun.shadow.mapSize.set(1024, 1024);
      const c = this.sun.shadow.camera;
      c.left = -55; c.right = 55; c.top = 55; c.bottom = -55; c.near = 1; c.far = 400;
      this.sun.shadow.bias = -0.0015;
    }
    scene.add(this.sun); scene.add(this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbdd5ff, 0x5a4a38, 0.55);
    scene.add(this.hemi);
    this.moonLight = new THREE.DirectionalLight(0x8899cc, 0);
    scene.add(this.moonLight); scene.add(this.moonLight.target);

    /* sol e lua visuais */
    this.sunMesh = new THREE.Mesh(new THREE.SphereGeometry(18, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffdd88, fog: false }));
    scene.add(this.sunMesh);
    this.moonMesh = new THREE.Mesh(new THREE.SphereGeometry(12, 12, 12), new THREE.MeshBasicMaterial({ color: 0xdfe6f5, fog: false }));
    scene.add(this.moonMesh);

    /* estrelas */
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(500 * 3);
    for (let i = 0; i < 500; i++) {
      const a = Math.random() * TAU, b = Math.random() * Math.PI * 0.5;
      starPos[i * 3] = Math.cos(a) * Math.cos(b) * 750;
      starPos[i * 3 + 1] = Math.sin(b) * 750 + 30;
      starPos[i * 3 + 2] = Math.sin(a) * Math.cos(b) * 750;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, transparent: true, opacity: 0, fog: false, sizeAttenuation: false });
    this.stars = new THREE.Points(starGeo, this.starMat);
    scene.add(this.stars);

    /* nuvens */
    this.clouds = [];
    const cloudTex = this.makeCloudTexture();
    for (let i = 0; i < 12; i++) {
      const mat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.55, fog: false, depthWrite: false });
      const sp = new THREE.Sprite(mat);
      sp.scale.set(rand(90, 190), rand(30, 60), 1);
      sp.position.set(rand(-500, 500), rand(110, 170), rand(-500, 500));
      scene.add(sp);
      this.clouds.push(sp);
    }

    /* chuva / neve */
    const n = Math.floor(1100 * G.quality.particles);
    this.precipGeo = new THREE.BufferGeometry();
    this.precipPos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      this.precipPos[i * 3] = rand(-32, 32);
      this.precipPos[i * 3 + 1] = rand(0, 42);
      this.precipPos[i * 3 + 2] = rand(-32, 32);
    }
    this.precipGeo.setAttribute('position', new THREE.BufferAttribute(this.precipPos, 3));
    this.precipMat = new THREE.PointsMaterial({ color: 0xaaccee, size: 0.14, transparent: true, opacity: 0 });
    this.precip = new THREE.Points(this.precipGeo, this.precipMat);
    this.precip.frustumCulled = false;
    scene.add(this.precip);

    scene.fog = new THREE.FogExp2(0x99bbdd, 0.0018);
    this.torch = new THREE.PointLight(0xff9944, 0, 14, 2);
    scene.add(this.torch);
    this.fireLight = new THREE.PointLight(0xff8830, 0, 12, 2);
    scene.add(this.fireLight);
  }

  makeCloudTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const grd = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,0.85)');
    grd.addColorStop(0.6, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    return t;
  }

  pickWeather() {
    const px = G.player ? G.player.pos.x : 0, pz = G.player ? G.player.pos.z : 0;
    const cold = tempBase(px, pz) < 5;
    const r = Math.random();
    if (cold) return r < 0.35 ? 'neve' : (r < 0.55 ? 'nublado' : (r < 0.7 ? 'neblina' : 'limpo'));
    if (r < 0.42) return 'limpo';
    if (r < 0.62) return 'nublado';
    if (r < 0.78) return 'chuva';
    if (r < 0.88) return 'neblina';
    return 'tempestade';
  }

  update(dt) {
    const t = G.time.t;
    const cam = G.camera;
    const px = G.player ? G.player.pos.x : 0, py = G.player ? G.player.pos.y : 0, pz = G.player ? G.player.pos.z : 0;
    const inCave = G.inCave;

    /* transição de clima */
    this.weatherTimer -= dt;
    if (this.weatherTimer <= 0) {
      const old = this.weather;
      this.weather = this.pickWeather();
      this.weatherTimer = rand(100, 220);
      if (this.weather !== old && G.state === 'play') {
        const msg = { limpo: '☀️ O céu abre.', nublado: '☁️ Nuvens cobrem o céu.', chuva: '🌧️ Começa a chover.', tempestade: '⛈️ Uma tempestade se aproxima!', neblina: '🌫️ Uma névoa densa desce.', neve: '🌨️ Começa a nevar.' };
        UI.toast(msg[this.weather]);
      }
    }
    const storm = this.weather === 'tempestade', rainy = storm || this.weather === 'chuva';
    const snowy = this.weather === 'neve', foggy = this.weather === 'neblina';
    const cloudy = this.weather === 'nublado' || rainy || snowy;

    /* posição do sol/lua */
    const a = (t / 24) * TAU - Math.PI / 2; /* meio-dia: sol a pino */
    const sunY = Math.sin(a) * -1;          /* t=12 → topo */
    const sx = Math.cos(a), sy = -Math.sin(a);
    this.sun.position.set(px + sx * 120, sy * 140 + 10, pz + 40);
    this.sun.target.position.set(px, py, pz);
    this.sunMesh.position.set(cam.position.x + sx * 700, sy * 700, cam.position.z + 240);
    this.moonMesh.position.set(cam.position.x - sx * 700, -sy * 700, cam.position.z - 240);
    this.stars.position.copy(cam.position);

    const dayAmt = smoothstep(-0.12, 0.25, sy);           /* 0=noite 1=dia */
    const duskAmt = smoothstep(0.02, 0.28, Math.abs(sy)) < 1 ? 1 - smoothstep(0.02, 0.3, Math.abs(sy)) : 0;
    const weatherDim = cloudy ? (storm ? 0.35 : 0.65) : 1;

    this.sun.intensity = inCave ? 0.03 : Math.max(0, sy) * 1.15 * weatherDim;
    this.sun.color.setHSL(0.09 + dayAmt * 0.045, 0.85, lerp(0.55, 0.72, dayAmt));
    this.moonLight.intensity = inCave ? 0 : (1 - dayAmt) * 0.18 * (cloudy ? 0.4 : 1);
    this.moonLight.position.set(px - sx * 100, Math.max(20, -sy * 120), pz - 30);
    this.moonLight.target.position.set(px, py, pz);
    this.hemi.intensity = inCave ? 0.12 : lerp(0.14, 0.6, dayAmt) * (cloudy ? 0.75 : 1);

    /* cores do céu */
    const skyDay = new THREE.Color(0x87b5e0), skyNight = new THREE.Color(0x0a1024);
    const skyDusk = new THREE.Color(0xe08a55), skyStorm = new THREE.Color(0x4a5560);
    let sky = skyNight.clone().lerp(skyDay, dayAmt);
    sky.lerp(skyDusk, duskAmt * 0.55 * (cloudy ? 0.3 : 1));
    if (cloudy) sky.lerp(skyStorm, storm ? 0.75 : 0.45);
    if (inCave) sky.set(0x050403);
    if (this.flash > 0) { sky.lerp(new THREE.Color(0xffffff), this.flash); this.flash = Math.max(0, this.flash - dt * 6); }
    this.scene.background = sky;

    /* névoa */
    let fogD = lerp(0.0035, 0.0016, dayAmt);
    if (rainy) fogD = 0.0048; if (foggy) fogD = 0.011; if (snowy) fogD = 0.006;
    if (inCave) fogD = 0.03;
    this.scene.fog.density = lerp(this.scene.fog.density, fogD / (G.quality.viewDist / 2), dt * 0.8);
    this.scene.fog.color.copy(sky);

    this.starMat.opacity = inCave ? 0 : (1 - dayAmt) * (cloudy ? 0.15 : 1);
    this.sunMesh.visible = !inCave && sy > -0.15 && !storm;
    this.moonMesh.visible = !inCave && sy < 0.1;
    this.sunMesh.material.color.setHSL(0.1, 0.9, lerp(0.6, 0.85, dayAmt));

    /* nuvens à deriva */
    const wspd = G.wind.speed * (storm ? 3 : 1);
    for (const c of this.clouds) {
      c.position.x += Math.cos(G.wind.dir) * wspd * dt;
      c.position.z += Math.sin(G.wind.dir) * wspd * dt;
      if (dist2(c.position.x, c.position.z, px, pz) > 620) {
        c.position.x = px - Math.cos(G.wind.dir) * 550 + rand(-160, 160);
        c.position.z = pz - Math.sin(G.wind.dir) * 550 + rand(-160, 160);
      }
      c.material.opacity = inCave ? 0 : (cloudy ? 0.85 : 0.4) * lerp(0.35, 1, dayAmt) * (foggy ? 0.3 : 1);
    }
    G.wind.dir += dt * 0.01;
    G.wind.speed = lerp(G.wind.speed, storm ? 11 : (rainy ? 6 : 3), dt * 0.2);

    /* precipitação */
    const wantP = inCave ? 0 : (rainy ? 0.75 : (snowy ? 0.85 : 0));
    this.precipMat.opacity = lerp(this.precipMat.opacity, wantP, dt * 2);
    if (this.precipMat.opacity > 0.02) {
      this.precipMat.color.set(snowy ? 0xffffff : 0xaaccee);
      this.precipMat.size = snowy ? 0.22 : 0.13;
      const fall = snowy ? 3.2 : 34, drift = Math.cos(G.wind.dir) * G.wind.speed * 0.4;
      const p = this.precipPos;
      for (let i = 0; i < p.length; i += 3) {
        p[i + 1] -= fall * dt * (snowy ? rand(0.7, 1.3) : 1);
        p[i] += drift * dt + (snowy ? Math.sin(p[i + 1] * 0.5) * dt * 2 : 0);
        if (p[i + 1] < -2) { p[i + 1] = 40; p[i] = rand(-32, 32); p[i + 2] = rand(-32, 32); }
      }
      this.precip.position.set(px, py, pz);
      this.precipGeo.attributes.position.needsUpdate = true;
    }

    /* relâmpagos */
    if (storm && !inCave) {
      this.lightningT -= dt;
      if (this.lightningT <= 0) {
        this.flash = 0.9;
        AUDIO.play('thunder', { delay: rand(0.3, 1.6) });
        this.lightningT = rand(4, 14);
        if (G.state === 'play' && (t < 6 || t > 19)) {
          G.flags.stormNight = (G.flags.stormNight || 0) + 1;
          if (G.flags.stormNight > 3) unlock('sobrevivente');
        }
      }
    }

    /* luz da fogueira mais próxima */
    let bestCf = null, bd = 1e9;
    for (const cf of WORLD.campfires) {
      const d = dist2(px, pz, cf.x, cf.z);
      if (d < bd) { bd = d; bestCf = cf; }
    }
    if (bestCf && bd < 40) {
      this.fireLight.position.set(bestCf.x, bestCf.h + 1.2, bestCf.z);
      this.fireLight.intensity = 1.4 + Math.sin(performance.now() * 0.01) * 0.3;
      const fl = bestCf.mesh.getObjectByName('flame');
      if (fl) fl.scale.y = 1 + Math.sin(performance.now() * 0.013) * 0.25;
    } else this.fireLight.intensity = 0;

    /* tocha do jogador */
    const p2 = G.player;
    if (p2 && p2.equip.offhand === 'tocha') {
      this.torch.position.set(px, py + 1.6, pz);
      this.torch.intensity = 1.5 + Math.sin(performance.now() * 0.02) * 0.3;
    } else this.torch.intensity = 0;

    /* coruja de estimação clareia a noite */
    if (p2 && p2.activePet && p2.activePet.kind === 'coruja' && dayAmt < 0.4) this.hemi.intensity += 0.14;

    /* áudio ambiente */
    AUDIO.setAmb('wind', 0.04 + G.wind.speed * 0.012, 2);
    AUDIO.setAmb('rain', rainy ? (storm ? 0.3 : 0.2) : 0, 2);
    const nearWater = G.player ? terrainHeight(px, pz) < 2 : false;
    AUDIO.setAmb('water', nearWater ? 0.08 : 0, 2);
    AUDIO.setAmb('fire', bestCf && bd < 9 ? 0.16 : 0, 1);
  }

  /* contribuição do clima para a temperatura */
  tempMod() {
    const t = G.time.t;
    let m = (t < 6 || t > 20) ? -7 : (t > 11 && t < 15 ? 3 : 0);
    if (this.weather === 'chuva') m -= 4;
    if (this.weather === 'tempestade') m -= 6;
    if (this.weather === 'neve') m -= 9;
    if (this.weather === 'neblina') m -= 2;
    return m;
  }
}
let ENV = null;
