// Kom Faek — 2D side-scrolling brawler prototype.
// Assets and frame data come from assets/manifest.js (window.MANIFEST).
(() => {
  "use strict";

  const M = window.MANIFEST;
  const H = 360;                    // internal height; width follows the screen shape
  let W = 640;
  const GROUND_Y = M.groundY;       // feet line in screen space
  const GRAVITY = 1900;
  const WALK_SPEED = 165;
  const JUMP_V = -640;
  const COMBO_WINDOW = 0.38;        // seconds after an attack ends to chain the next
  // Attack tables. dir: swing direction on screen when facing right (+1 = left to right,
  // -1 = right to left). power: 0 normal, 1 heavy, 2 finisher (bigger trail, shake, shockwave).
  const GROUND_ATTACKS = [
    { anim: "attack1", dmg: [9, 13], crit: 0.15, kb: 30, reach: 96, dir: 1, power: 0, drift: 25 },
    { anim: "attack2", dmg: [10, 14], crit: 0.15, kb: 34, reach: 90, dir: -1, power: 0, drift: 25 },
    { anim: "attack3", dmg: [12, 16], crit: 0.18, kb: 44, reach: 104, dir: 1, power: 1, drift: 25 },
    { anim: "attack4", dmg: [14, 19], crit: 0.2, kb: 52, reach: 98, dir: -1, power: 1, drift: 70 },
    { anim: "attack5", dmg: [24, 32], crit: 0.35, kb: 140, reach: 118, dir: 1, power: 2, drift: 40, spin: true },
  ];
  // Air combo: two slashes that keep Kan hanging in the air, then a plunging slam.
  const AIR_ATTACKS = [
    { anim: "air1", dmg: [10, 14], crit: 0.18, kb: 20, reach: 98, dir: 1, power: 0 },
    { anim: "air2", dmg: [11, 15], crit: 0.2, kb: 24, reach: 94, dir: -1, power: 1 },
    { anim: "air3", dmg: [22, 30], crit: 0.3, kb: 130, reach: 112, dir: 1, power: 2, plunge: true },
  ];
  const attacksOf = (p) => (p.air ? AIR_ATTACKS : GROUND_ATTACKS);
  const curAttack = (p) => attacksOf(p)[p.combo];

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  // ---------- layout: desktop cabinet vs. full-screen landscape on phones ----------
  const root = document.documentElement;
  const isTouch = matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;
  root.classList.toggle("touch", isTouch);

  function fitCanvas() {
    const portrait = innerHeight > innerWidth;
    root.classList.toggle("portrait", portrait);
    // on phones, widen the view to the screen's aspect so there are no letterbox bars
    const want = isTouch && !portrait ? Math.round(H * (innerWidth / innerHeight) / 2) * 2 : 640;
    W = clamp(want, 560, 820);
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;
    ctx.imageSmoothingEnabled = false;
  }
  addEventListener("resize", fitCanvas);
  addEventListener("orientationchange", () => setTimeout(fitCanvas, 120));

  // ---------- assets ----------
  const images = {};
  function loadImages() {
    const names = new Set([M.background, M.portrait, M.monster.image]);
    for (const a of Object.values(M.player.anims)) names.add(a.image);
    for (const v of Object.values(M.vfx)) names.add(v);
    for (const v of Object.values(M.vfxAnim)) names.add(v.image);
    return Promise.all([...names].map((src) => new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => { images[src] = img; res(); };
      img.onerror = () => rej(new Error("Could not load " + src));
      img.src = src;
    })));
  }

  // ---------- input ----------
  const keys = new Set();
  const pressed = new Set();
  const KEYMAP = {
    ArrowLeft: "left", KeyA: "left",
    ArrowRight: "right", KeyD: "right",
    ArrowUp: "jump", KeyW: "jump", Space: "jump", KeyK: "jump",
    KeyJ: "attack", KeyX: "attack", Enter: "attack",
    KeyR: "restart",
    KeyU: "skill1", KeyI: "skill2", KeyO: "skill3",
    Digit1: "skill1", Digit2: "skill2", Digit3: "skill3",
  };
  addEventListener("keydown", (e) => {
    const a = KEYMAP[e.code];
    if (!a) return;
    e.preventDefault();
    if (!keys.has(a)) pressed.add(a);
    keys.add(a);
  });
  addEventListener("keyup", (e) => {
    const a = KEYMAP[e.code];
    if (a) keys.delete(a);
  });
  addEventListener("blur", () => keys.clear());
  for (const btn of document.querySelectorAll("[data-act]")) {
    const a = btn.dataset.act;
    const down = (e) => { e.preventDefault(); if (!keys.has(a)) pressed.add(a); keys.add(a); btn.classList.add("on"); };
    const up = (e) => { e.preventDefault(); keys.delete(a); btn.classList.remove("on"); };
    btn.addEventListener("pointerdown", down);
    btn.addEventListener("pointerup", up);
    btn.addEventListener("pointerleave", up);
    btn.addEventListener("pointercancel", up);
  }

  // Floating joystick: touch anywhere on the left side, the stick appears under the thumb.
  const zone = document.getElementById("stick-zone");
  const stickBase = document.getElementById("stick-base");
  const stickKnob = document.getElementById("stick-knob");
  if (zone) {
    let stickId = null, ox = 0, oy = 0;
    const RADIUS = 46, DEAD = 10;
    const release = () => {
      stickId = null;
      keys.delete("left");
      keys.delete("right");
      stickBase.classList.remove("live");
      stickKnob.style.transform = "translate(-50%, -50%)";
    };
    zone.addEventListener("pointerdown", (e) => {
      if (stickId !== null) return;
      e.preventDefault();
      stickId = e.pointerId;
      zone.setPointerCapture(e.pointerId);
      const r = zone.getBoundingClientRect();
      ox = e.clientX - r.left;
      oy = e.clientY - r.top;
      stickBase.style.left = ox + "px";
      stickBase.style.top = oy + "px";
      stickBase.classList.add("live");
    });
    zone.addEventListener("pointermove", (e) => {
      if (e.pointerId !== stickId) return;
      const r = zone.getBoundingClientRect();
      let dx = e.clientX - r.left - ox, dy = e.clientY - r.top - oy;
      const len = Math.hypot(dx, dy);
      if (len > RADIUS) { dx *= RADIUS / len; dy *= RADIUS / len; }
      stickKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      keys.delete("left");
      keys.delete("right");
      if (dx < -DEAD) keys.add("left");
      if (dx > DEAD) keys.add("right");
    });
    for (const ev of ["pointerup", "pointercancel"]) {
      zone.addEventListener(ev, (e) => { if (e.pointerId === stickId) release(); });
    }
  }

  // Full screen + landscape lock where the browser allows it (it often doesn't; that's fine).
  const fsBtn = document.getElementById("fullscreen");
  if (fsBtn) {
    fsBtn.addEventListener("click", async () => {
      try {
        if (!document.fullscreenElement) await document.documentElement.requestFullscreen({ navigationUI: "hide" });
        else await document.exitFullscreen();
      } catch (_) { /* not allowed here */ }
      try { await screen.orientation?.lock?.("landscape"); } catch (_) { /* not supported */ }
      setTimeout(fitCanvas, 150);
    });
  }
  const atkBtn = document.querySelector(".skill.attack");

  // ---------- helpers ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  let tintCv = null;
  function tintCanvas(w, h) {
    if (!tintCv) tintCv = document.createElement("canvas");
    if (tintCv.width !== w || tintCv.height !== h) { tintCv.width = w; tintCv.height = h; }
    return tintCv;
  }

  function attackFrame(a, t) {
    const k = clamp(t / a.duration, 0, 0.999);
    return Math.min(a.frames - 1, Math.floor((k / a.playFor) * a.frames));
  }

  function drawFrame(anim, frame, x, y, facing, scale, alpha = 1, flash = 0) {
    const img = images[anim.image];
    const fw = anim.frameW, fh = anim.frameH;
    const f = clamp(frame, 0, anim.frames - 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.round(x), Math.round(y));
    ctx.scale(facing * scale, scale);
    const ay = anim.bottoms ? anim.bottoms[f] : anim.anchorY;
    if (flash > 0) {
      // tint on an offscreen copy so the flash only covers the sprite's pixels
      const t = tintCanvas(fw, fh);
      const tc = t.getContext("2d");
      tc.clearRect(0, 0, fw, fh);
      tc.globalCompositeOperation = "source-over";
      tc.drawImage(img, f * fw, 0, fw, fh, 0, 0, fw, fh);
      tc.globalCompositeOperation = "source-atop";
      tc.globalAlpha = flash;
      tc.fillStyle = "#fff";
      tc.fillRect(0, 0, fw, fh);
      tc.globalAlpha = 1;
      ctx.drawImage(t, -anim.anchorX, -ay);
    } else {
      ctx.drawImage(img, f * fw, 0, fw, fh, -anim.anchorX, -ay, fw, fh);
    }
    ctx.restore();
  }

  // ---------- world state ----------
  let state;

  function newPlayer() {
    return {
      x: 160, y: GROUND_Y, vx: 0, vy: 0, facing: 1,
      hp: 100, maxHp: 100,
      anim: "idle", t: 0, onGround: true,
      combo: -1,            // index of attack being played, -1 = none
      air: false,           // true while the air combo is playing
      airUsed: false,       // one air combo per jump
      queued: false, hitDone: false, sinceAttack: 99,
      hurtT: 0, invulnT: 0,
      skill: null,          // skill being cast: { def, t, hitIdx, ... }
      ghosts: [], ghostT: 0, // afterimages left behind while casting
    };
  }

  function newMonster(x) {
    return {
      x, y: GROUND_Y, vx: 0, facing: -1,
      hp: M.monster.hp, maxHp: M.monster.hp,
      state: "walk", t: 0, cd: 1.2, flash: 0, hitStun: 0, alpha: 1,
      downT: 0, downMax: 0, stunT: 0,  // knocked down / dazed timers
      bob: Math.random() * 6,
    };
  }

  function reset() {
    state = {
      player: newPlayer(),
      monster: newMonster(470),
      camX: 0,
      popups: [], sparks: [], waves: [], vfx: [], shots: [],
      banner: null, flashRed: 0, dim: 0, time: 0,
      cooldowns: [0, 0, 0],
      shake: 0, hitStop: 0,
      comboCount: 0, comboTimer: 0,
      kills: 0, respawnT: 0, over: false, lastCombo: -1,
    };
  }

  // ---------- popups (damage numbers) ----------
  function addPopup(x, y, amount, crit, opts = {}) {
    // stack numbers that land close together (multi-hit skills) so each one stays readable
    const near = state.popups.filter((q) => q.t < 0.45 && !q.enemy && !opts.enemy && Math.abs(q.x - x) < 70).length;
    state.popups.push({
      x, y: y - near * (crit ? 30 : 22), amount, crit, t: 0, life: crit ? 1.1 : opts.skill ? 1.0 : 0.8,
      dx: rand(-14, 14), skill: !!opts.skill, enemy: !!opts.enemy,
    });
  }

  function addShockwave(x, y) {
    state.waves.push({ x, y, t: 0, life: 0.45 });
  }

  function addSparks(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), s = rand(80, 260);
      state.sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, t: 0, life: rand(0.18, 0.4), color });
    }
  }

  // ---------- player ----------
  function startAttack(p, idx) {
    p.combo = idx;
    p.anim = attacksOf(p)[idx].anim;
    p.t = 0;
    p.queued = false;
    p.hitDone = false;
    // each air slash stops the fall with a tiny lift so the combo stays airborne
    if (p.air && !attacksOf(p)[idx].plunge) p.vy = -70;
  }

  function endAttack(p) {
    if (!p.air) state.lastCombo = p.combo;
    p.sinceAttack = 0;
    p.combo = -1;
    p.air = false;
    p.t = 0;
    if (p.onGround) {
      p.anim = "idle";
    } else {
      // fall out of an air combo using the falling poses of the jump clip
      p.anim = "jump";
      p.t = ((2 * -JUMP_V) / GRAVITY) * 0.7;
    }
  }

  function updatePlayer(dt) {
    const p = state.player;
    const animDef = M.player.anims[p.anim];
    p.t += dt;
    p.sinceAttack += dt;
    p.invulnT = Math.max(0, p.invulnT - dt);

    if (p.hp <= 0) {
      p.vx = 0;
      return;
    }

    if (p.hurtT > 0) {
      p.hurtT -= dt;
    }

    // skill input, then let a running skill drive the player
    for (let i = 0; i < 3; i++) if (pressed.has("skill" + (i + 1))) startSkill(i);
    if (updateSkill(p, dt)) {
      p.x = clamp(p.x, 40, M.worldWidth - 40);
      return;
    }

    const attacking = p.combo >= 0;

    // attack input
    if (pressed.has("attack")) {
      if (!attacking && p.onGround) {
        p.air = false;
        const next = p.sinceAttack < COMBO_WINDOW && state.lastCombo < GROUND_ATTACKS.length - 1 ? state.lastCombo + 1 : 0;
        startAttack(p, next);
      } else if (!attacking && !p.airUsed) {
        p.air = true;
        p.airUsed = true;
        startAttack(p, 0);
      } else if (attacking && p.combo < attacksOf(p).length - 1) {
        p.queued = true;
      }
    }

    if (p.combo >= 0) {
      const atk = curAttack(p);
      const strikeT = animDef.duration * animDef.playFor * 0.75;   // start of the strike frame
      if (atk.plunge) {
        // wind up in the air, then dive; the strike frame lands with the body
        if (!p.onGround) {
          if (p.t > animDef.duration * animDef.playFor * 0.25) {
            p.vy = Math.max(p.vy, 980);
            p.vx = p.facing * 110;
          } else {
            p.vy = Math.min(p.vy, 0);
            p.vx = 0;
          }
          p.t = Math.min(p.t, strikeT - 0.001);
        } else {
          p.vx = 0;
          if (!p.hitDone) {
            p.hitDone = true;
            p.t = strikeT;
            state.shake = Math.max(state.shake, 5);
            addShockwave(p.x + p.facing * 30, GROUND_Y);
            resolvePlayerHit(p);
          }
        }
      } else if (p.air) {
        p.vx = p.facing * 35;
      } else {
        // during ground attacks the player commits; a little forward drift sells the swing
        p.vx = p.t < animDef.duration * 0.5 ? p.facing * atk.drift : 0;
      }
      const progress = p.t / animDef.duration;
      if (!atk.plunge && !p.hitDone && progress >= animDef.hitAt) {
        p.hitDone = true;
        resolvePlayerHit(p);
      }
      if (progress >= 1) {
        if (p.queued && p.combo < attacksOf(p).length - 1) startAttack(p, p.combo + 1);
        else endAttack(p);
      }
    } else {
      let dir = 0;
      if (keys.has("left")) dir -= 1;
      if (keys.has("right")) dir += 1;
      if (dir !== 0) p.facing = dir;
      p.vx = dir * WALK_SPEED;

      if (pressed.has("jump") && p.onGround) {
        p.vy = JUMP_V;
        p.onGround = false;
        p.anim = "jump";
        p.t = 0;
      }

      if (p.onGround) {
        const want = dir !== 0 ? "walk" : "idle";
        if (p.anim !== want) { p.anim = want; p.t = 0; }
      }
    }

    // physics: air slashes hang in the air with much lighter gravity
    const hovering = p.combo >= 0 && p.air && !curAttack(p).plunge;
    p.x += p.vx * dt;
    if (!p.onGround) {
      p.vy += (hovering ? GRAVITY * 0.18 : GRAVITY) * dt;
      if (hovering) p.vy = Math.min(p.vy, 110);
      p.y += p.vy * dt;
      if (p.y >= GROUND_Y) {
        p.y = GROUND_Y;
        p.vy = 0;
        p.onGround = true;
        p.airUsed = false;
        if (p.combo < 0) { p.anim = "idle"; p.t = 0; }
        else if (p.air && !curAttack(p).plunge) endAttack(p);   // landed mid air-slash
      }
    }
    // bodies block each other on the ground; jumping clears the monster
    const m = state.monster;
    if (m && m.state !== "dead" && p.y > GROUND_Y - 50) {
      const gap = p.x - m.x, minGap = 52;
      if (Math.abs(gap) < minGap) p.x = m.x + (gap >= 0 ? 1 : -1) * minGap;
    }
    p.x = clamp(p.x, 40, M.worldWidth - 40);
  }

  function resolvePlayerHit(p) {
    const m = state.monster;
    if (!m || m.state === "dead") return;
    const atk = curAttack(p);
    const dx = (m.x - p.x) * p.facing;
    if (atk.plunge) {
      if (Math.abs(m.x - p.x) > atk.reach) return;       // the slam hits all around the landing spot
    } else if (dx < -20 || dx > atk.reach) {
      return;
    }
    if (GROUND_Y - p.y > 165) return;                     // too high above the monster's head

    const [lo, hi] = atk.dmg;
    const crit = Math.random() < atk.crit;
    const dmg = Math.round(randInt(lo, hi) * (crit ? 2.2 : 1));
    m.hp = Math.max(0, m.hp - dmg);
    m.flash = 0.75;
    m.hitStun = atk.power === 2 ? 0.55 : 0.28;
    // light pushback keeps the monster in reach until a finisher launches it
    const away = atk.plunge ? Math.sign(m.x - p.x) || p.facing : p.facing;
    m.vx = away * atk.kb * (crit ? 1.4 : 1) * (atk.power === 2 ? 4 : 1.5);
    if (m.state === "windup") { m.state = "walk"; m.cd = 1.1; }

    state.comboCount += 1;
    state.comboTimer = 1.6;
    const power = atk.power;
    state.hitStop = (crit ? 0.12 : 0.05) + power * 0.03;
    state.shake = (crit ? 8 : 2.5) + power * 3;
    if (power === 2) addShockwave(atk.plunge ? p.x + p.facing * 30 : m.x, GROUND_Y);

    const hy = m.y - M.monster.hitHeight;
    addPopup(m.x + rand(-10, 10), hy, dmg, crit);
    addSparks(m.x - p.facing * 18, hy + 30, (crit ? 18 : 9) + power * 8, crit || power ? "#ffd23f" : "#fff2c4");
    if (power) addSparks(m.x - p.facing * 18, hy + 30, power * 8, "#ff6a2b");

    if (m.hp <= 0) {
      m.state = "dead";
      m.t = 0;
      state.kills += 1;
      state.respawnT = 2.2;
    }
  }

  // ---------- monster ----------
  function updateMonster(dt) {
    const m = state.monster;
    const p = state.player;
    if (!m) {
      state.respawnT -= dt;
      if (state.respawnT <= 0) {
        const side = p.x < M.worldWidth - 400 ? 1 : -1;
        state.monster = newMonster(clamp(p.x + side * 330, 80, M.worldWidth - 80));
      }
      return;
    }
    m.t += dt;
    m.flash = Math.max(0, m.flash - dt * 8);

    if (m.state === "dead") {
      m.alpha = Math.max(0, 1 - m.t / 0.9);
      m.vx *= 0.9;
      m.x += m.vx * dt;
      if (m.t > 0.9) state.monster = null;
      return;
    }

    // knockback decays
    m.x += m.vx * dt;
    m.vx *= Math.pow(0.0008, dt);
    m.x = clamp(m.x, 40, M.worldWidth - 40);

    if (m.downT > 0) {
      m.downT -= dt;
      if (m.downT <= 0) { m.state = "walk"; m.cd = 0.9; }
      return;
    }
    if (m.stunT > 0) { m.stunT -= dt; m.state = "walk"; return; }
    if (m.hitStun > 0) { m.hitStun -= dt; return; }

    const dist = p.x - m.x;
    m.facing = dist < 0 ? -1 : 1;
    m.cd -= dt;

    if (m.state === "walk") {
      if (Math.abs(dist) > 78) {
        m.x += Math.sign(dist) * M.monster.speed * dt;
      } else if (m.cd <= 0 && p.hp > 0) {
        m.state = "windup";
        m.t = 0;
      }
    } else if (m.state === "windup") {
      if (m.t > 0.55) {
        m.state = "strike";
        m.t = 0;
        const reach = Math.abs(p.x - m.x);
        if (reach < 95 && p.invulnT <= 0 && p.hp > 0 && p.y > GROUND_Y - 60) {
          const dmg = randInt(6, 10);
          p.hp = Math.max(0, p.hp - dmg);
          p.invulnT = 0.7;
          p.hurtT = 0.25;
          p.x += m.facing * 26;
          state.shake = 5;
          addPopup(p.x, p.y - 110, dmg, false, { enemy: true });
          if (p.hp <= 0) state.over = true;
        }
      }
    } else if (m.state === "strike") {
      if (m.t > 0.35) { m.state = "walk"; m.cd = rand(1.3, 2.2); }
    }
  }

  // ---------- skills ----------
  // Each skill plays a 3-frame clip. `frames` are the clip times (fraction of `dur`) where
  // frames 1, 2 and 3 start; `hits` land at fractions of `dur`. Ultimates (ult) get a
  // screen dim + longer cooldown. Effects (vfx) are PixelLab sprites tweened in code.
  const SKILLS = {
    wing: {
      name: "หักปีกปักษา", desc: "ฟันซ้าย-ขวา 2 ครั้ง วิญญาณนกโฉบใส่", cd: 5, dur: 0.5,
      frames: [0, 0.16, 0.5], icon: "bird", assist: 110,
      hits: [
        { at: 0.2, dmg: [16, 22], reach: 155, power: 1, vfx: "bird" },
        { at: 0.55, dmg: [18, 25], reach: 165, power: 1, vfx: "bird2" },
      ],
    },
    naga: {
      name: "นาคาพ่นไฟ", desc: "แทงระยะไกล พญานาคพ่นไฟ", cd: 7, dur: 0.62,
      frames: [0, 0.14, 0.28], icon: "naga",
      hits: [{ at: 0.3, dmg: [30, 40], reach: 280, power: 1, vfx: "naga", burn: true }],
    },
    chakra: {
      name: "คมจักรนารายณ์", desc: "ขว้างคมแฝกหมุนเป็นจักร ไปแล้ววนกลับ", cd: 6, dur: 0.3,
      frames: [0, 0.35, 0.7], icon: "chakra", throwAt: 0.7, holdUntilCatch: true,
      shot: { dmg: [26, 34], range: 300, speed: 520 },
    },
    tiger: {
      name: "พยัคฆ์ล้มสิงขร", desc: "แทงแล้วฟาดเสยขึ้น ศัตรูล้ม", cd: 8, dur: 0.62,
      frames: [0, 0.3, 0.52], icon: "tiger", assist: 100,
      hits: [
        { at: 0.12, dmg: [14, 18], reach: 145, power: 1, vfx: "tiger" },
        { at: 0.56, dmg: [22, 30], reach: 135, power: 2, knockdown: 1.4, vfx: "tigerUp" },
      ],
    },
    quake: {
      name: "สะท้านบรรพต", desc: "กระแทกระยะประชิด ศัตรูมึนงง", cd: 7, dur: 0.48,
      frames: [0, 0.2, 0.38], icon: "rocks", assist: 70,
      hits: [{ at: 0.4, dmg: [18, 24], reach: 105, power: 1, stun: 2.2, vfx: "rocks" }],
    },
    yama: {
      name: "พญายมข่มธรณี", desc: "ไม้ตาย กระโดดฟาดพื้น ระเบิดแดง ศัตรูล้ม", cd: 16, ult: true,
      icon: "yama", leap: true,
      hit: { dmg: [60, 80], reach: 160, power: 2, knockdown: 1.8, vfx: "yama" },
    },
    storm: {
      name: "อัคคีสาดแสง", desc: "ไม้ตาย หมุนตัวฟัน 3 ครั้ง พายุลมขาวฟ้า", cd: 15, ult: true, dur: 0.95,
      frames: [0, 0.33, 0.66], loopFrames: true, icon: "storm", drift: 120, assist: 90,
      hits: [
        { at: 0.25, dmg: [16, 22], reach: 140, both: true, power: 1, vfx: "sparks" },
        { at: 0.52, dmg: [16, 22], reach: 140, both: true, power: 1, vfx: "sparks" },
        { at: 0.8, dmg: [22, 30], reach: 145, both: true, power: 2, vfx: "sparks" },
      ],
    },
  };
  const SKILL_ORDER = ["wing", "naga", "chakra", "tiger", "quake", "yama", "storm"];
  const LOADOUT_KEY = "komfaek.skills";
  let loadout = ["wing", "naga", "yama"];
  try {
    const saved = JSON.parse(localStorage.getItem(LOADOUT_KEY) || "null");
    if (Array.isArray(saved) && saved.length === 3 && saved.every((id) => SKILLS[id])) loadout = saved;
  } catch (_) { /* storage unavailable */ }

  // shared damage path for combo hits and skills
  function hitMonster(o) {
    const m = state.monster;
    if (!m || m.state === "dead") return false;
    const [lo, hi] = o.dmg;
    const crit = Math.random() < (o.crit ?? 0.2);
    const dmg = Math.round(randInt(lo, hi) * (crit ? 2.2 : 1));
    m.hp = Math.max(0, m.hp - dmg);
    m.flash = 0.75;
    m.hitStun = Math.max(m.hitStun, o.power === 2 ? 0.5 : 0.3);
    m.vx = o.dir * (o.kb ?? 60) * (crit ? 1.4 : 1) * (o.power === 2 ? 3 : 1.5);
    if (m.state === "windup") { m.state = "walk"; m.cd = 1.1; }
    if (o.knockdown && m.downT <= 0) { m.downT = o.knockdown; m.downMax = o.knockdown; m.stunT = 0; }
    if (o.stun) m.stunT = o.stun;

    state.comboCount += 1;
    state.comboTimer = 1.6;
    state.hitStop = (crit ? 0.12 : 0.06) + (o.power || 0) * 0.03;
    state.shake = Math.max(state.shake, (crit ? 8 : 3) + (o.power || 0) * 3);
    const hy = m.y - M.monster.hitHeight;
    addPopup(m.x + rand(-10, 10), hy, dmg, crit, { skill: true });
    addSparks(m.x - o.dir * 18, hy + 30, 12 + (o.power || 0) * 8, o.sparkColor || "#ffd23f");
    if (o.power) addSparks(m.x - o.dir * 18, hy + 30, 8, o.sparkColor2 || "#ff6a2b");
    if (m.hp <= 0) {
      m.state = "dead";
      m.t = 0;
      m.downT = 0;
      m.stunT = 0;
      state.kills += 1;
      state.respawnT = 2.2;
    }
    return true;
  }

  function inReach(p, reach, both) {
    const m = state.monster;
    if (!m || m.state === "dead") return false;
    const dx = (m.x - p.x) * p.facing;
    if (both) return Math.abs(m.x - p.x) <= reach;
    return dx >= -20 && dx <= reach;
  }

  function addVfx(key, x, y, opts = {}) {
    state.vfx.push(Object.assign({
      key, x, y, t: 0, life: 0.5, vx: 0, vy: 0, s0: 1, s1: 1, rot: 0, spin: 0,
      flip: 1, alpha: 1, glow: true, flicker: false, anchor: "center",
    }, opts));
  }

  function showBanner(def) {
    state.banner = { text: def.name, ult: !!def.ult, t: 0, life: def.ult ? 1.5 : 1.1 };
    if (def.ult) state.dim = 0.55;
  }

  function startSkill(slot) {
    const p = state.player;
    const id = loadout[slot];
    const def = SKILLS[id];
    if (!def || state.cooldowns[slot] > 0 || p.skill || p.hp <= 0 || state.over) return;
    if (!def.leap && !p.onGround) return;
    p.combo = -1;
    p.air = false;
    p.queued = false;
    p.skill = { id, def, t: 0, hitIdx: 0, phase: 0, thrown: false, landed: false, dashTo: null };
    // auto-target: turn toward a nearby monster, and melee skills dash in to reach it
    const m = state.monster;
    if (m && m.state !== "dead") {
      const d = m.x - p.x;
      if (Math.abs(d) < 380) p.facing = Math.sign(d) || p.facing;
      if (def.assist && Math.abs(d) > def.assist && Math.abs(d) < def.assist + 200) p.skill.dashTo = m.x - p.facing * def.assist;
    }
    p.anim = "sk_" + id;
    p.t = 0;
    p.vx = 0;
    state.cooldowns[slot] = def.cd;
    showBanner(def);
    if (def.ult) p.invulnT = Math.max(p.invulnT, 1.2);
    if (def.leap) {
      p.vy = -720;
      p.onGround = false;
      p.vx = p.facing * 90;
    }
  }

  function skillFrame(sk) {
    const def = sk.def;
    if (def.leap) return sk.phase;              // 0 rising, 1 falling strike, 2 landed
    const k = sk.t / def.dur;
    if (def.loopFrames) return Math.floor(k * 9) % 3;   // spin: cycle the 3 frames fast
    let f = 0;
    for (let i = 0; i < 3; i++) if (k >= def.frames[i]) f = i;
    return f;
  }

  // returns true while the skill owns the player
  function updateSkill(p, dt) {
    const sk = p.skill;
    if (!sk) return false;
    const def = sk.def;
    sk.t += dt;

    if (def.leap) {
      // rise, hang briefly, then dive into the ground
      if (!sk.landed) {
        if (p.vy > -80 && sk.phase === 0) sk.phase = 1;
        if (sk.phase === 1) p.vy = Math.max(p.vy, 1100);
        p.vy += GRAVITY * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.y >= GROUND_Y) {
          p.y = GROUND_Y;
          p.vy = 0;
          p.onGround = true;
          sk.landed = true;
          sk.phase = 2;
          sk.t = 0;
          const h = def.hit;
          const fx = p.x + p.facing * 34;
          addVfx("yama", fx, GROUND_Y, { life: 0.9, s0: 0.5, s1: 1.7, anchor: "bottom", flicker: true });
          addShockwave(fx, GROUND_Y);
          addShockwave(fx, GROUND_Y);
          state.flashRed = 0.6;
          state.shake = 14;
          for (let i = 0; i < 3; i++) addSparks(fx + rand(-40, 40), GROUND_Y - rand(10, 60), 14, i % 2 ? "#ff3b2f" : "#ffb02e");
          if (inReach(p, h.reach, true)) {
            const m = state.monster;
            hitMonster({ ...h, dir: Math.sign(m.x - p.x) || p.facing, crit: 0.4, kb: 90, sparkColor: "#ff3b2f", sparkColor2: "#ffd23f" });
          }
        }
      } else if (sk.t > 0.38) {
        p.skill = null;
        p.anim = "idle";
        p.t = 0;
      }
      return true;
    }

    // ground skills are rooted, except the storm which carries Kan forward
    p.vx = def.drift ? p.facing * def.drift : 0;
    p.x += p.vx * dt;
    if (sk.dashTo !== null && sk.t < 0.16) {
      p.x += (sk.dashTo - p.x) * Math.min(1, dt * 22);
      if (Math.floor(sk.t * 60) % 2 === 0) addSparks(p.x - p.facing * 20, GROUND_Y - 6, 1, "#e9dcc0");
    }
    const k = sk.t / def.dur;

    if (def.hits) {
      while (sk.hitIdx < def.hits.length && k >= def.hits[sk.hitIdx].at) {
        const h = def.hits[sk.hitIdx++];
        spawnHitVfx(p, h);
        if (inReach(p, h.reach, h.both)) {
          const m = state.monster;
          hitMonster({
            ...h, dir: h.both ? Math.sign(m.x - p.x) || p.facing : p.facing, crit: 0.22, kb: 50,
            sparkColor: h.vfx === "sparks" ? "#e8fbff" : h.burn ? "#ff7a1a" : "#ffd23f",
            sparkColor2: h.vfx === "sparks" ? "#ff9a3c" : "#ff6a2b",
          });
        }
      }
    }

    if (def.shot && !sk.thrown && k >= def.throwAt) {
      sk.thrown = true;
      state.shots.push({
        x: p.x + p.facing * 30, y: p.y - 62, dir: p.facing, dist: 0, out: true,
        hit: false, rot: 0, def: def.shot,
      });
    }

    if (def.storm || def.loopFrames) {
      // the storm surrounds Kan for the whole spin
      if (!sk.stormed) {
        sk.stormed = true;
        addVfx("storm", p.x, GROUND_Y, { life: def.dur + 0.15, s0: 0.8, s1: 1.25, anchor: "bottom", flicker: true, follow: true });
      }
    }

    const holding = def.holdUntilCatch && state.shots.length > 0;
    if (k >= 1 && !holding) {
      p.skill = null;
      p.anim = "idle";
      p.t = 0;
    }
    return true;
  }

  function spawnHitVfx(p, h) {
    const f = p.facing;
    const cy = p.y - 60;
    switch (h.vfx) {
      case "bird":
        addVfx("bird", p.x + f * 20, cy - 6, { vx: f * 520, life: 0.5, s0: 0.7, s1: 1.1, flip: f });
        break;
      case "bird2":
        addVfx("bird", p.x + f * 10, cy - 26, { vx: f * 600, vy: 40, life: 0.5, s0: 0.8, s1: 1.25, flip: f, rot: 0.15 });
        break;
      case "naga":
        addVfx("naga", p.x + f * 28, cy + 2, { life: 0.55, s0: 0.35, s1: 1.75, flip: f, anchor: "left", stretch: true, flicker: true });
        break;
      case "tiger":
        addVfx("tiger", p.x + f * 30, cy, { vx: f * 380, life: 0.45, s0: 0.7, s1: 1.1, flip: f });
        break;
      case "tigerUp":
        addVfx("tiger", p.x + f * 30, cy + 10, { vx: f * 160, vy: -360, life: 0.5, s0: 0.8, s1: 1.2, flip: f, rot: -0.7 * f });
        break;
      case "rocks":
        addVfx("rocks", p.x + f * 46, GROUND_Y + 4, { life: 0.55, s0: 0.5, s1: 1.15, flip: f, anchor: "bottom" });
        addShockwave(p.x + f * 46, GROUND_Y);
        break;
      case "sparks":
        addSparks(p.x + rand(-50, 50), cy + rand(-10, 20), 14, "#e8fbff");
        addSparks(p.x + rand(-50, 50), cy + rand(-10, 20), 8, "#ff9a3c");
        break;
    }
  }

  function updateSkillWorld(dt) {
    state.time += dt;
    for (let i = 0; i < 3; i++) state.cooldowns[i] = Math.max(0, state.cooldowns[i] - dt);
    state.flashRed = Math.max(0, state.flashRed - dt * 1.4);
    state.dim = Math.max(0, state.dim - dt * 0.9);
    if (state.banner) { state.banner.t += dt; if (state.banner.t > state.banner.life) state.banner = null; }

    const p = state.player;
    for (const v of state.vfx) {
      v.t += dt;
      v.x += v.vx * dt;
      v.y += v.vy * dt;
      if (v.follow) v.x = p.x;
    }
    state.vfx = state.vfx.filter((v) => v.t < v.life);

    // thrown kom faek: flies out inside a spinning chakra, then curves back to Kan's hand
    for (const s of state.shots) {
      s.rot += dt * 26;
      const step = s.def.speed * dt;
      if (s.out) {
        s.x += s.dir * step;
        s.dist += step;
        if (s.dist >= s.def.range) s.out = false;
      } else {
        const tx = p.x + p.facing * 20, ty = p.y - 62;
        const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy);
        const sp = s.def.speed * 1.15 * dt;
        if (d <= sp + 6) { s.done = true; continue; }
        s.x += (dx / d) * sp;
        s.y += (dy / d) * sp;
      }
      const m = state.monster;
      if (!s.hit && m && m.state !== "dead" && Math.abs(m.x - s.x) < 42) {
        s.hit = true;
        hitMonster({ dmg: s.def.dmg, dir: s.dir, power: 1, crit: 0.25, kb: 40, sparkColor: "#7ff6ff", sparkColor2: "#ffd23f" });
      }
    }
    state.shots = state.shots.filter((s) => !s.done);
  }

  // Effects are PixelLab sprite sheets (M.vfxAnim) played frame by frame, with a little
  // scale/fade tweening on top; keys without a sheet fall back to the still image.
  function drawVfx(camX, layer) {
    for (const v of state.vfx) {
      if ((v.key === "storm") !== (layer === "back")) continue;
      const anim = M.vfxAnim[v.key];
      const img = images[anim ? anim.image : M.vfx[v.key]];
      if (!img) continue;
      const fw = anim ? anim.frameW : img.width, fh = anim ? anim.frameH : img.height;
      const k = v.t / v.life;
      let frame = 0;
      if (anim) frame = anim.loop ? Math.floor(v.t * anim.fps) % anim.frames : Math.min(anim.frames - 1, Math.floor(k * anim.frames));
      const ease = 1 - Math.pow(1 - Math.min(1, k * 1.6), 3);
      const sc = v.s0 + (v.s1 - v.s0) * ease;
      // effects appear at once (they spawn on the impact freeze), then fade out
      let alpha = k < 0.1 ? 0.6 + (k / 0.1) * 0.4 : k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      if (v.flicker && !anim) alpha *= 0.82 + 0.18 * Math.sin(v.t * 60);
      ctx.save();
      ctx.translate(Math.round(v.x - camX), Math.round(v.y));
      if (v.rot) ctx.rotate(v.rot);
      const sx = (v.stretch ? sc : Math.max(0.4, sc)) * v.flip;
      const sy = v.stretch ? Math.min(1.2, 0.7 + sc * 0.3) : sc;
      ctx.scale(sx, sy);
      const ox = v.anchor === "left" ? 0 : -fw / 2;
      const oy = v.anchor === "bottom" ? -fh : -fh / 2;
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, frame * fw, 0, fw, fh, ox, oy, fw, fh);
      if (v.glow) {
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = alpha * 0.3;
        ctx.drawImage(img, frame * fw, 0, fw, fh, ox, oy, fw, fh);
      }
      ctx.restore();
    }
  }

  function drawShots(camX) {
    const img = images[M.vfx.chakra];
    for (const s of state.shots) {
      ctx.save();
      ctx.translate(Math.round(s.x - camX), Math.round(s.y));
      ctx.rotate(s.rot * s.dir);
      ctx.drawImage(img, -img.width * 0.35, -img.height * 0.35, img.width * 0.7, img.height * 0.7);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.35;
      ctx.drawImage(img, -img.width * 0.35, -img.height * 0.35, img.width * 0.7, img.height * 0.7);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      // the kom faek itself spinning in the middle of the chakra
      ctx.fillStyle = "#7a3a1c";
      ctx.fillRect(-18, -3, 36, 6);
      ctx.fillStyle = "#b8653a";
      ctx.fillRect(-18, -3, 36, 2);
      ctx.restore();
    }
  }

  function drawBanner(camX) {
    const b = state.banner;
    if (!b) return;
    const p = state.player;
    const k = b.t / b.life;
    const pop = k < 0.12 ? 0.7 + (k / 0.12) * 0.4 : k < 0.2 ? 1.1 - ((k - 0.12) / 0.08) * 0.1 : 1;
    const alpha = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.round(p.x - camX), Math.round(p.y - 128 - k * 8));
    ctx.scale(pop, pop);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = (b.ult ? "800 22px" : "600 17px") + " 'Kanit', 'Noto Sans Thai', sans-serif";
    if (b.ult) {
      const w = ctx.measureText(b.text).width + 34;
      ctx.fillStyle = "rgba(120, 10, 10, 0.75)";
      ctx.beginPath();
      ctx.moveTo(-w / 2 - 10, 0); ctx.lineTo(-w / 2, -16); ctx.lineTo(w / 2, -16);
      ctx.lineTo(w / 2 + 10, 0); ctx.lineTo(w / 2, 16); ctx.lineTo(-w / 2, 16); ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#ffd23f";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.lineWidth = 5;
    ctx.strokeStyle = "#120d1c";
    ctx.strokeText(b.text, 0, 1);
    ctx.fillStyle = b.ult ? "#fff1b0" : "#ffd23f";
    ctx.fillText(b.text, 0, 1);
    ctx.restore();
  }

  // ultimate cut-in: darken the stage behind the fighters
  function drawScreenDim() {
    if (state.dim > 0) {
      ctx.fillStyle = `rgba(10, 4, 16, ${state.dim * 0.6})`;
      ctx.fillRect(-20, -20, W + 40, H + 40);
    }
  }

  function drawScreenFlash() {
    if (state.flashRed > 0) {
      ctx.fillStyle = `rgba(220, 30, 20, ${state.flashRed * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // desktop skill bar (phones use the on-screen buttons instead)
  function drawSkillBar() {
    if (isTouch) return;
    const size = 34, gap = 8;
    const x0 = W - 3 * (size + gap) - 6, y0 = H - size - 12;
    const keysLbl = ["U", "I", "O"];
    for (let i = 0; i < 3; i++) {
      const def = SKILLS[loadout[i]];
      const x = x0 + i * (size + gap);
      ctx.fillStyle = "rgba(18,13,28,0.75)";
      ctx.fillRect(x - 2, y0 - 2, size + 4, size + 4);
      const img = images[M.vfx[def.icon]];
      if (img) {
        const s = Math.min(size / img.width, size / img.height);
        ctx.drawImage(img, x + (size - img.width * s) / 2, y0 + (size - img.height * s) / 2, img.width * s, img.height * s);
      }
      const cd = state.cooldowns[i];
      if (cd > 0) {
        const frac = cd / def.cd;
        ctx.fillStyle = "rgba(10,6,18,0.7)";
        ctx.beginPath();
        ctx.moveTo(x + size / 2, y0 + size / 2);
        ctx.arc(x + size / 2, y0 + size / 2, size * 0.75, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
        ctx.closePath();
        ctx.save();
        ctx.beginPath(); ctx.rect(x, y0, size, size); ctx.clip();
        ctx.beginPath();
        ctx.moveTo(x + size / 2, y0 + size / 2);
        ctx.arc(x + size / 2, y0 + size / 2, size * 0.75, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.font = "10px 'Silkscreen', monospace";
        ctx.textAlign = "center";
        ctx.fillStyle = "#f3e9d2";
        ctx.fillText(Math.ceil(cd), x + size / 2, y0 + size / 2 + 4);
      }
      ctx.strokeStyle = def.ult ? "#e4483f" : "#ffd23f";
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 1, y0 - 1, size + 2, size + 2);
      ctx.font = "8px 'Silkscreen', monospace";
      ctx.textAlign = "left";
      ctx.fillStyle = "#f3e9d2";
      ctx.fillText(keysLbl[i], x + 2, y0 + 9);
    }
  }

  // phone skill buttons: icons and cooldown sweep
  const skillBtns = [...document.querySelectorAll(".skill[data-act^='skill']")];
  function syncSkillButtons() {
    skillBtns.forEach((btn, i) => {
      const def = SKILLS[loadout[i]];
      btn.style.setProperty("--icon", `url("${M.vfx[def.icon]}")`);
      btn.classList.toggle("ult", !!def.ult);
      btn.setAttribute("aria-label", def.name);
      const lbl = btn.querySelector("span");
      if (lbl) lbl.textContent = def.name;
    });
  }
  function updateSkillButtons() {
    skillBtns.forEach((btn, i) => {
      const def = SKILLS[loadout[i]];
      const cd = state.cooldowns[i];
      btn.style.setProperty("--cd", String(cd > 0 ? cd / def.cd : 0));
      const n = btn.querySelector("b");
      if (n) n.textContent = cd > 0 ? Math.ceil(cd) : "";
    });
  }

  // skill picker: choose 3 of 7
  const picker = document.getElementById("picker");
  let pickerOpen = false;
  function renderPicker() {
    const list = picker.querySelector(".pick-list");
    list.textContent = "";
    for (const id of SKILL_ORDER) {
      const def = SKILLS[id];
      const slot = loadout.indexOf(id);
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pick" + (slot >= 0 ? " on" : "") + (def.ult ? " ult" : "");
      b.setAttribute("aria-pressed", slot >= 0 ? "true" : "false");
      b.innerHTML = `<img alt="" src="${M.vfx[def.icon]}"><span class="pn">${def.name}</span>` +
        `<span class="pd">${def.desc}</span><span class="pc">${def.ult ? "ULT · " : ""}CD ${def.cd}s</span>` +
        (slot >= 0 ? `<em>${slot + 1}</em>` : "");
      b.addEventListener("click", () => togglePick(id));
      li.appendChild(b);
      list.appendChild(li);
    }
    picker.querySelector(".pick-note").textContent =
      loadout.length < 3 ? `เลือกอีก ${3 - loadout.length} ท่า` : "ติดตั้งครบ 3 ท่าแล้ว แตะท่าที่เลือกไว้เพื่อถอดออก";
    picker.querySelector(".pick-done").disabled = loadout.length !== 3;
  }
  function togglePick(id) {
    const i = loadout.indexOf(id);
    if (i >= 0) loadout.splice(i, 1);
    else if (loadout.length < 3) loadout.push(id);
    else {
      const note = picker.querySelector(".pick-note");
      note.textContent = "เลือกได้ 3 ท่า แตะท่าที่เลือกไว้เพื่อถอดออกก่อน";
      note.classList.remove("shake"); void note.offsetWidth; note.classList.add("shake");
      return;
    }
    renderPicker();
  }
  function openPicker() {
    pickerOpen = true;
    picker.hidden = false;
    keys.clear();
    renderPicker();
  }
  function closePicker() {
    if (loadout.length !== 3) return;
    pickerOpen = false;
    picker.hidden = true;
    try { localStorage.setItem(LOADOUT_KEY, JSON.stringify(loadout)); } catch (_) { /* ignore */ }
    state.cooldowns = [0, 0, 0];
    syncSkillButtons();
    canvas.focus();
  }
  if (picker) {
    picker.querySelector(".pick-done").addEventListener("click", closePicker);
    for (const b of document.querySelectorAll("[data-open-picker]")) b.addEventListener("click", openPicker);
    addEventListener("keydown", (e) => {
      if (e.code === "KeyK" && e.shiftKey) return;
      if (e.code === "Tab" && !pickerOpen) { e.preventDefault(); openPicker(); }
      else if ((e.code === "Escape" || e.code === "Tab") && pickerOpen) { e.preventDefault(); closePicker(); }
    });
  }

  // ---------- update ----------
  function update(dt) {
    if (pickerOpen) { pressed.clear(); return; }
    if (state.over && pressed.has("restart")) reset();
    if (pressed.has("restart") && !state.over) reset();

    if (state.hitStop > 0) {
      state.hitStop -= dt;
      // keep combo input alive through the impact freeze
      const hp = state.player;
      if (pressed.has("attack") && hp.combo >= 0 && hp.combo < attacksOf(hp).length - 1) hp.queued = true;
      pressed.clear();
      return;
    }

    updateSkillWorld(dt);
    updatePlayer(dt);
    updateMonster(dt);

    state.comboTimer -= dt;
    if (state.comboTimer <= 0) state.comboCount = 0;

    for (const pp of state.popups) pp.t += dt;
    state.popups = state.popups.filter((pp) => pp.t < pp.life);
    for (const s of state.sparks) {
      s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 900 * dt;
    }
    state.sparks = state.sparks.filter((s) => s.t < s.life);
    for (const w of state.waves) w.t += dt;
    state.waves = state.waves.filter((w) => w.t < w.life);
    state.shake = Math.max(0, state.shake - dt * 30);

    const target = state.player.x - W * 0.4;
    state.camX += (target - state.camX) * Math.min(1, dt * 6);
    state.camX = clamp(state.camX, 0, M.worldWidth - W);
    pressed.clear();
  }

  // ---------- render ----------
  function drawBackground(camX) {
    const img = images[M.background];
    const s = H / img.height;
    const tw = img.width * s;
    const first = Math.floor(camX / tw);
    for (let i = first; i <= first + Math.ceil(W / tw) + 1; i++) {
      const x = Math.round(i * tw - camX);
      ctx.save();
      if (i % 2 !== 0) {
        // mirror every other tile so the seams match
        ctx.translate(x + tw, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, 0, 0, tw, H);
      } else {
        ctx.drawImage(img, x, 0, tw, H);
      }
      ctx.restore();
    }
  }

  function drawShadow(x, y, w) {
    ctx.fillStyle = "rgba(10, 6, 18, 0.35)";
    ctx.beginPath();
    ctx.ellipse(Math.round(x), Math.round(y) + 2, w, w * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlayer(camX) {
    const p = state.player;
    const a = M.player.anims[p.anim];
    let frame;
    if (p.skill) {
      frame = skillFrame(p.skill);
    } else if (p.anim === "jump") {
      // map air time onto the jump frames: rise, peak, fall
      // frames 2..6 of the clip are the airborne poses: rise, tuck, fall
      const airT = (2 * -JUMP_V) / GRAVITY;
      frame = 2 + Math.floor(clamp(p.t / airT, 0, 0.999) * 5);
    } else if (a.loop) {
      frame = Math.floor(p.t * a.fps) % a.frames;
    } else if (a.playFor) {
      frame = attackFrame(a, p.t);
    } else {
      frame = Math.floor(clamp(p.t / a.duration, 0, 0.999) * a.frames);
    }
    // afterimages: recent skill poses fading out behind Kan
    if (p.skill) {
      p.ghostT -= 1 / 60;
      if (p.ghostT <= 0) {
        p.ghostT = 0.035;
        p.ghosts.push({ anim: p.anim, frame, x: p.x, y: p.y, facing: p.facing, born: state.time });
      }
    }
    p.ghosts = p.ghosts.filter((g) => state.time - g.born < 0.16);
    for (const g of p.ghosts) {
      const age = (state.time - g.born) / 0.16;
      drawFrame(M.player.anims[g.anim], g.frame, g.x - camX, g.y, g.facing, M.player.scale, 0.35 * (1 - age));
    }
    drawShadow(p.x - camX, GROUND_Y, 26 - Math.min(14, (GROUND_Y - p.y) / 8));
    const blink = p.invulnT > 0 && Math.floor(p.invulnT * 20) % 2 === 0 ? 0.45 : 1;
    const alpha = p.hp <= 0 ? 0.6 : blink;
    drawFrame(a, frame, p.x - camX, p.y, p.facing, M.player.scale, alpha, p.hurtT > 0 ? 0.6 : 0);
  }

  function drawMonster(camX) {
    const m = state.monster;
    if (!m) return;
    const a = M.monster.image;
    const img = images[a];
    const s = M.monster.scale;
    let ox = 0, oy = 0, sx = 1, sy = 1;
    if (m.state === "walk") {
      oy = Math.sin((m.t + m.bob) * 7) * 2;
    } else if (m.state === "windup") {
      ox = -m.facing * Math.min(1, m.t / 0.55) * 10;
      sy = 1 + Math.sin(m.t * 40) * 0.01;
    } else if (m.state === "strike") {
      ox = m.facing * (1 - m.t / 0.35) * 22;
      sx = 1.04;
    } else if (m.state === "dead") {
      oy = m.t * 20;
    }
    if (m.hitStun > 0) ox += Math.sin(m.hitStun * 60) * 3;
    // knocked down: tip over backwards, lie still, then get up again
    let rot = 0;
    if (m.downT > 0) {
      const gone = m.downMax - m.downT;
      const k = gone < 0.22 ? gone / 0.22 : m.downT < 0.3 ? m.downT / 0.3 : 1;
      rot = -m.facing * (Math.PI / 2) * k;
      oy = 0;
    }

    drawShadow(m.x - camX, GROUND_Y, 38);
    ctx.save();
    ctx.globalAlpha = m.alpha;
    ctx.translate(Math.round(m.x - camX + ox), Math.round(m.y + oy));
    if (rot) ctx.rotate(rot);
    // the art faces left; flip when the monster faces right
    ctx.scale(-m.facing * s * sx * M.monster.artFacing, s * sy);
    if (m.flash > 0 || m.state === "windup") {
      const t = tintCanvas(img.width, img.height);
      const tc = t.getContext("2d");
      tc.clearRect(0, 0, img.width, img.height);
      tc.globalCompositeOperation = "source-over";
      tc.drawImage(img, 0, 0);
      tc.globalCompositeOperation = "source-atop";
      tc.globalAlpha = m.flash > 0 ? m.flash * 0.9 : 0.25 + 0.2 * Math.sin(m.t * 30);
      tc.fillStyle = m.flash > 0 ? "#fff" : "#ff3b2f";
      tc.fillRect(0, 0, img.width, img.height);
      tc.globalAlpha = 1;
      ctx.drawImage(t, -M.monster.anchorX, -M.monster.anchorY);
    } else {
      ctx.drawImage(img, -M.monster.anchorX, -M.monster.anchorY);
    }
    ctx.restore();

    if (m.state !== "dead") {
      // HP bar above the monster
      const bw = 70, bh = 6;
      const bx = Math.round(m.x - camX - bw / 2), by = Math.round(m.y - M.monster.barHeight);
      ctx.fillStyle = "#120d1c";
      ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
      ctx.fillStyle = "#3a2240";
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = "#e4483f";
      ctx.fillRect(bx, by, Math.round(bw * (m.hp / m.maxHp)), bh);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(bx, by, Math.round(bw * (m.hp / m.maxHp)), 2);
    }
  }

  function drawStunStars(camX) {
    const m = state.monster;
    if (!m || m.stunT <= 0) return;
    const cx = m.x - camX, cy = m.y - M.monster.barHeight + 18;
    for (let i = 0; i < 3; i++) {
      const a = state.time * 5 + (i * Math.PI * 2) / 3;
      const x = cx + Math.cos(a) * 24, y = cy + Math.sin(a) * 6;
      ctx.save();
      ctx.translate(Math.round(x), Math.round(y));
      ctx.rotate(a);
      burstPath(0, 0, 2.5, 6, 5, 0);
      ctx.fillStyle = "#ffe14a";
      ctx.fill();
      ctx.strokeStyle = "#5a3a00";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }

  function burstPath(cx, cy, r1, r2, points, rot) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 === 0 ? r2 : r1;
      const a = rot + (i / (points * 2)) * Math.PI * 2;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.78;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  function drawPopups(camX) {
    for (const pp of state.popups) {
      const k = pp.t / pp.life;
      const x = Math.round(pp.x - camX + pp.dx * k);
      if (pp.crit) {
        const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.6 : 1.2 - Math.min(0.2, (k - 0.15) * 0.6);
        const y = Math.round(pp.y - 18 - k * 26);
        const alpha = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(x, y);
        ctx.scale(pop, pop);
        const rot = pp.t * 1.5;
        // red explosion behind the number
        burstPath(0, 0, 20, 40, 11, rot);
        ctx.fillStyle = "#8e1414";
        ctx.fill();
        burstPath(0, 0, 16, 32, 11, rot + 0.15);
        ctx.fillStyle = "#e3262a";
        ctx.fill();
        burstPath(0, 0, 10, 20, 9, -rot);
        ctx.fillStyle = "#ff7a1a";
        ctx.fill();
        ctx.font = "26px 'Silkscreen', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = 5;
        ctx.strokeStyle = "#3a0606";
        ctx.strokeText(pp.amount, 0, 1);
        ctx.fillStyle = "#ffe14a";
        ctx.fillText(pp.amount, 0, 1);
        ctx.font = "9px 'Silkscreen', monospace";
        ctx.lineWidth = 3;
        ctx.strokeText("CRITICAL", 0, -24);
        ctx.fillStyle = "#fff4c2";
        ctx.fillText("CRITICAL", 0, -24);
        ctx.restore();
      } else {
        const y = Math.round(pp.y - k * 34);
        // skill hits pop in a little larger and in orange so they read apart from combo hits
        const pop = pp.skill ? (k < 0.1 ? 0.6 + (k / 0.1) * 0.6 : 1.2 - Math.min(0.2, (k - 0.1) * 0.8)) : 1;
        ctx.save();
        ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
        ctx.translate(x, y);
        ctx.scale(pop, pop);
        ctx.font = (pp.skill ? "20px" : "16px") + " 'Silkscreen', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineWidth = pp.skill ? 5 : 4;
        ctx.strokeStyle = pp.skill ? "#3a1204" : "#120d1c";
        ctx.strokeText(pp.amount, 0, 0);
        ctx.fillStyle = pp.enemy ? "#ff8a80" : pp.skill ? "#ffb347" : "#ffffff";
        ctx.fillText(pp.amount, 0, 0);
        ctx.restore();
      }
    }
  }

  // Swing trail: a flattened crescent in front of Kan that sweeps with the stick.
  // Frames: 0 wind-up (no trail), 1-2 swing, 3 strike, then the trail fades.
  const SLASH_STYLE = [
    { r: 46, w: 7, core: "rgba(255,248,225,0.95)", glow: "rgba(255,240,200,0.35)" },
    { r: 56, w: 11, core: "rgba(255,226,120,0.95)", glow: "rgba(255,120,40,0.45)" },
    { r: 66, w: 15, core: "rgba(255,236,140,1)", glow: "rgba(255,60,30,0.55)" },
  ];

  function drawSlash(camX) {
    const p = state.player;
    if (p.combo < 0) return;
    const a = M.player.anims[p.anim];
    const k = clamp(p.t / a.duration, 0, 1);
    const start = a.playFor * 0.25;            // swing begins after the wind-up frame
    const strike = a.playFor;                  // trail completes on the strike frame
    if (k < start) return;
    const sweep = clamp((k - start) / (strike - start), 0, 1);
    const fade = k > strike ? 1 - (k - strike) / (1 - strike) : 1;
    if (fade <= 0) return;

    const sw = curAttack(p);
    const st = SLASH_STYLE[sw.plunge ? 1 : sw.power];
    const cx = p.x - camX + p.facing * 22;
    const cy = p.y - (p.air ? 40 : 58);
    // left-to-right swings arc over the top, right-to-left ones under the bottom
    let a0, a1;
    if (sw.plunge) { a0 = -Math.PI * 0.6; a1 = a0 + Math.PI * 1.05 * sweep; }
    else if (sw.spin) { a0 = Math.PI; a1 = Math.PI + Math.PI * 2 * sweep; }
    else if (sw.dir === 1) { a0 = Math.PI * 1.05; a1 = a0 + Math.PI * 1.0 * sweep; }
    else { a0 = -0.05; a1 = a0 + Math.PI * 1.0 * sweep; }
    const tail = sw.spin ? Math.PI * 1.3 : Math.PI * 0.75;
    const from = Math.max(a0, a1 - tail);

    ctx.save();
    ctx.translate(Math.round(cx), Math.round(cy));
    ctx.scale(p.facing, sw.plunge ? 0.9 : sw.spin ? 0.55 : 0.42);
    ctx.lineCap = "round";
    ctx.globalAlpha = fade;
    const steps = 10;
    for (let i = 0; i < steps; i++) {
      // thicker and brighter toward the leading edge
      const u0 = from + ((a1 - from) * i) / steps;
      const u1 = from + ((a1 - from) * (i + 1)) / steps;
      const f = (i + 1) / steps;
      ctx.beginPath();
      ctx.arc(0, 0, st.r, u0, u1);
      ctx.strokeStyle = st.glow;
      ctx.lineWidth = st.w * f * 2.2;
      ctx.stroke();
      ctx.strokeStyle = st.core;
      ctx.lineWidth = st.w * f;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawWaves(camX) {
    for (const w of state.waves) {
      const k = w.t / w.life;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = "#ffd23f";
      ctx.lineWidth = 4 * (1 - k) + 1;
      ctx.beginPath();
      ctx.ellipse(Math.round(w.x - camX), Math.round(w.y), 20 + k * 110, 6 + k * 18, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = "#ff6a2b";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(Math.round(w.x - camX), Math.round(w.y), 10 + k * 70, 3 + k * 11, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawSparks(camX) {
    for (const s of state.sparks) {
      ctx.globalAlpha = 1 - s.t / s.life;
      ctx.fillStyle = s.color;
      ctx.fillRect(Math.round(s.x - camX), Math.round(s.y), 3, 3);
    }
    ctx.globalAlpha = 1;
  }

  function drawHud() {
    const p = state.player;
    // portrait frame
    const pimg = images[M.portrait];
    ctx.fillStyle = "#120d1c";
    ctx.fillRect(8, 8, 44, 44);
    ctx.drawImage(pimg, M.portraitCrop.x, M.portraitCrop.y, M.portraitCrop.w, M.portraitCrop.h, 10, 10, 40, 40);
    ctx.strokeStyle = "#ffd23f";
    ctx.lineWidth = 2;
    ctx.strokeRect(9, 9, 42, 42);

    ctx.font = "10px 'Silkscreen', monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#f3e9d2";
    ctx.fillText("KAN KRIANGKRAI", 58, 20);

    const bx = 58, by = 25, bw = 150, bh = 10;
    ctx.fillStyle = "#120d1c";
    ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
    ctx.fillStyle = "#3a2240";
    ctx.fillRect(bx, by, bw, bh);
    const frac = p.hp / p.maxHp;
    ctx.fillStyle = frac > 0.3 ? "#4cc96f" : "#e4483f";
    ctx.fillRect(bx, by, Math.round(bw * frac), bh);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(bx, by, Math.round(bw * frac), 3);
    ctx.font = "8px 'Silkscreen', monospace";
    ctx.fillStyle = "#f3e9d2";
    ctx.fillText(`HP ${p.hp}/${p.maxHp}`, bx, by + 22);

    ctx.textAlign = "right";
    ctx.fillText(`KO ${state.kills}`, W - 10, 20);

    if (state.comboCount > 1) {
      const pulse = 1 + Math.max(0, state.comboTimer - 1.4) * 1.5;
      ctx.save();
      ctx.translate(W - 14, 56);
      ctx.scale(pulse, pulse);
      ctx.textAlign = "right";
      ctx.font = "22px 'Silkscreen', monospace";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#120d1c";
      ctx.strokeText(state.comboCount, 0, 0);
      ctx.fillStyle = "#ffd23f";
      ctx.fillText(state.comboCount, 0, 0);
      ctx.font = "9px 'Silkscreen', monospace";
      ctx.lineWidth = 3;
      ctx.strokeText("HITS", 0, 12);
      ctx.fillStyle = "#f3e9d2";
      ctx.fillText("HITS", 0, 12);
      ctx.restore();
    }

    // combo step pips: which attack of the ground (5) or air (3) combo is playing or ready to chain
    const step = p.combo >= 0 ? p.combo : (p.sinceAttack < COMBO_WINDOW ? state.lastCombo : -1);
    const pipCount = p.combo >= 0 ? attacksOf(p).length : GROUND_ATTACKS.length;
    if (atkBtn) atkBtn.style.setProperty("--combo", String((step + 1) / pipCount));
    for (let i = 0; i < pipCount; i++) {
      ctx.fillStyle = i <= step ? "#ffd23f" : "rgba(243,233,210,0.25)";
      ctx.fillRect(58 + i * 12, 54, 9, 4);
    }

    if (state.over) {
      ctx.fillStyle = "rgba(18, 13, 28, 0.6)";
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center";
      ctx.font = "28px 'Silkscreen', monospace";
      ctx.fillStyle = "#e4483f";
      ctx.fillText("K.O.", W / 2, H / 2 - 6);
      ctx.font = "10px 'Silkscreen', monospace";
      ctx.fillStyle = "#f3e9d2";
      ctx.fillText("PRESS R OR TAP RESTART", W / 2, H / 2 + 18);
    }
  }

  function render() {
    const sx = state.shake > 0 ? rand(-state.shake, state.shake) : 0;
    const sy = state.shake > 0 ? rand(-state.shake, state.shake) * 0.6 : 0;
    const camX = Math.round(state.camX + sx);
    ctx.save();
    ctx.translate(0, Math.round(sy));
    drawBackground(camX);
    drawScreenDim();
    drawVfx(camX, "back");
    // draw whoever is further back first
    const m = state.monster;
    if (m && m.y < state.player.y) { drawMonster(camX); drawPlayer(camX); }
    else { drawPlayer(camX); drawMonster(camX); }
    drawStunStars(camX);
    drawWaves(camX);
    drawSlash(camX);
    drawVfx(camX, "front");
    drawShots(camX);
    drawSparks(camX);
    drawBanner(camX);
    drawPopups(camX);
    ctx.restore();
    drawScreenFlash();
    drawHud();
    drawSkillBar();
    updateSkillButtons();
  }

  // ---------- loop ----------
  let last = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  fitCanvas();
  reset();
  syncSkillButtons();
  const status = document.getElementById("status");
  loadImages()
    .then(() => document.fonts?.load("16px 'Silkscreen'").catch(() => {}))
    .then(() => {
      status.hidden = true;
      requestAnimationFrame((t) => { last = t; frame(t); });
    })
    .catch((err) => { status.textContent = err.message; });

  // focus the canvas so keys work after a click into the frame
  canvas.addEventListener("pointerdown", () => canvas.focus());
})();
