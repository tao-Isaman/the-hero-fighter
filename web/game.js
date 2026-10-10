// Kom Faek — 2D side-scrolling versus fighter.
// Two fighters from web/characters/<id>/character.js face off: one played by you, one by the AI.
// Stage and shared effects come from assets/manifest.js (window.MANIFEST).
(() => {
  "use strict";

  const M = window.MANIFEST;
  const H = 360;                    // internal height; width follows the screen shape
  let W = 640;
  const GROUND_Y = M.groundY;       // feet line in screen space
  const GRAVITY = 1900;
  const COMBO_WINDOW = 0.38;        // seconds after an attack ends to chain the next
  const FIGHTER_HP = 800;           // every fighter starts a round with this much HP
  const MAX_SEPARATION = 520;       // fighters can't walk further apart than this

  // ---------- fighters: you pick P1 and the AI's fighter on the select screen ----------
  const ROSTER = Object.keys(window.CHARACTERS);
  const MATCH_KEY = "komfaek.match";
  let P1_ID = ROSTER.includes(window.ACTIVE_CHARACTER) ? window.ACTIVE_CHARACTER : ROSTER[0];
  let P2_ID = ROSTER.find((id) => id !== P1_ID) || P1_ID;
  try {
    // the last match you set up, unless the URL names a fighter (#kan, #leklai, ...)
    const m = JSON.parse(localStorage.getItem(MATCH_KEY) || "null");
    if (m && !location.hash && ROSTER.includes(m.p1)) P1_ID = m.p1;
    if (m && ROSTER.includes(m.p2)) P2_ID = m.p2;
  } catch (_) { /* storage unavailable */ }

  // A kit is everything static about a character: data, clip table, portrait.
  function makeKit(id) {
    const c = window.CHARACTERS[id];
    const base = `characters/${id}/`;
    const anims = {};
    for (const [name, cfg] of Object.entries(c.anims)) {
      anims[name] = {
        frameW: c.sprite.frameW, frameH: c.sprite.frameH,
        anchorX: c.sprite.anchorX, anchorY: c.sprite.anchorY,
        loop: false, ...cfg, image: base + cfg.image,
      };
    }
    // every skill shows its own icon (assets/icons/<id>_<skill>.png, see tools/make_icons.py) when one exists
    for (const [sid, def] of Object.entries(c.skills)) if (M.vfx[`ic_${id}_${sid}`]) def.icon = `ic_${id}_${sid}`;
    return { id, c, anims, scale: c.sprite.scale, portrait: base + c.portrait.image };
  }
  const KITS = Object.fromEntries(ROSTER.map((id) => [id, makeKit(id)]));

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
    const names = new Set([M.background]);
    for (const kit of Object.values(KITS)) {
      names.add(kit.portrait);
      for (const a of Object.values(kit.anims)) names.add(a.image);
    }
    for (const v of Object.values(M.vfx)) names.add(v);
    for (const v of Object.values(M.vfxAnim)) names.add(v.image);
    return Promise.all([...names].map((src) => new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => { images[src] = img; res(); };
      img.onerror = () => rej(new Error("Could not load " + src));
      img.src = src;
    })));
  }

  // Fill in what the images tell us: frame counts, default durations, and per-frame
  // feet lines for clips marked bottoms: "auto".
  function finalizeAnims() {
    const cv = document.createElement("canvas");
    const cx = cv.getContext("2d", { willReadFrequently: true });
    for (const kit of Object.values(KITS)) {
      for (const a of Object.values(kit.anims)) {
        if (a.frames) continue;
        const img = images[a.image];
        a.frames = Math.max(1, Math.round(img.width / a.frameW));
        if (!a.duration) a.duration = a.frames / (a.fps || 12);
        if (a.bottoms === "auto") {
          cv.width = img.width;
          cv.height = img.height;
          cx.clearRect(0, 0, cv.width, cv.height);
          cx.drawImage(img, 0, 0);
          const data = cx.getImageData(0, 0, img.width, img.height).data;
          a.bottoms = [];
          for (let f = 0; f < a.frames; f++) {
            let bottom = a.anchorY;
            scan: for (let y = a.frameH - 1; y >= 0; y--) {
              for (let x = f * a.frameW; x < (f + 1) * a.frameW; x++) {
                if (data[(y * img.width + x) * 4 + 3] > 0) { bottom = y + 1; break scan; }
              }
            }
            a.bottoms.push(bottom);
          }
        }
      }
    }
  }

  // ---------- input (the human fighter reads these) ----------
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

  // Sound on/off: the speaker button or M. The choice is remembered.
  const soundBtns = document.querySelectorAll("[data-sound]");
  function syncSound() {
    const on = !(window.SFX && window.SFX.muted);
    for (const b of soundBtns) { b.classList.toggle("off", !on); b.setAttribute("aria-pressed", String(on)); }
  }
  function toggleSound() {
    if (!window.SFX) return;
    window.SFX.setMuted(!window.SFX.muted);
    syncSound();
  }
  for (const b of soundBtns) b.addEventListener("click", toggleSound);
  addEventListener("keydown", (e) => { if (e.code === "KeyM" && !e.repeat) toggleSound(); });
  syncSound();

  // ---------- helpers ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const chance = (p) => Math.random() < p;

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

  // rot rotates the sprite around the feet (knockdowns); flash tints it white (hits)
  function drawFrame(anim, frame, x, y, facing, scale, alpha = 1, flash = 0, rot = 0) {
    const img = images[anim.image];
    const fw = anim.frameW, fh = anim.frameH;
    const f = clamp(frame, 0, anim.frames - 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(Math.round(x), Math.round(y));
    if (rot) ctx.rotate(rot);
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

  // ---------- loadouts ----------
  let p1Kit = KITS[P1_ID];
  let LOADOUT_KEY = `komfaek.skills.${P1_ID}`;
  // A loadout is always [normal, normal, ultimate]: slots U, I and O.
  const normalsOf = (kit) => kit.c.skillOrder.filter((id) => !kit.c.skills[id].ult);
  const ultsOf = (kit) => kit.c.skillOrder.filter((id) => kit.c.skills[id].ult);
  function normalizeLoadout(kit, ids) {
    const sk = kit.c.skills;
    const normals = (ids || []).filter((id) => sk[id] && !sk[id].ult).slice(0, 2);
    for (const id of [...kit.c.defaultLoadout, ...normalsOf(kit)]) {
      if (normals.length >= 2) break;
      if (sk[id] && !sk[id].ult && !normals.includes(id)) normals.push(id);
    }
    const ult = (ids || []).find((id) => sk[id] && sk[id].ult) || kit.c.defaultLoadout.find((id) => sk[id] && sk[id].ult) || ultsOf(kit)[0];
    return [...normals, ult].filter(Boolean);
  }
  function savedLoadout(kit) {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(`komfaek.skills.${kit.id}`) || "null"); } catch (_) { /* storage unavailable */ }
    return normalizeLoadout(kit, Array.isArray(saved) ? saved : kit.c.defaultLoadout);
  }
  let p1Loadout = savedLoadout(p1Kit);
  // the AI brings two random normal skills and a random ultimate
  function aiLoadout(kit) {
    const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
    return normalizeLoadout(kit, [...shuffle(normalsOf(kit)).slice(0, 2), shuffle(ultsOf(kit))[0]]);
  }

  // ---------- world state ----------
  let state;

  function newFighter(kit, x, facing, ctrl, loadout) {
    const hp = FIGHTER_HP;
    return {
      kit, ctrl, x, y: GROUND_Y, vx: 0, vy: 0, kvx: 0, facing,
      hp, maxHp: hp, shownHp: hp,
      anim: "idle", t: 0, onGround: true,
      combo: -1, air: false, airUsed: false, queued: false, hitDone: false,
      sinceAttack: 99, lastCombo: -1,
      invulnT: 0, flash: 0, hitStun: 0, downT: 0, downMax: 0, stunT: 0,
      launched: false, landDown: 0,
      skill: null, ghosts: [], ghostT: 0, buffT: 0, buff: null,
      loadout, cooldowns: [0, 0, 0],
      comboCount: 0, comboTimer: 0,
      input: ctrl === "human" ? { keys, pressed } : { keys: new Set(), pressed: new Set() },
      ai: { think: 0.6, plan: null, planT: 0, aggression: 0.7 },
    };
  }

  function reset() {
    const p1 = newFighter(p1Kit, 220, 1, "human", p1Loadout);
    const p2 = newFighter(KITS[P2_ID], 470, -1, "ai", aiLoadout(KITS[P2_ID]));
    p1.opp = p2;
    p2.opp = p1;
    state = {
      p1, p2, fighters: [p1, p2],
      camX: (220 + 470) / 2 - W / 2,
      popups: [], sparks: [], waves: [], vfx: [], shots: [], banners: [],
      flashRed: 0, dim: 0, time: 0,
      shake: 0, hitStop: 0, slowmo: 0,
      over: false, winner: null, introT: 1.6,
      timers: [],                  // delayed actions, e.g. rockets falling after a cast
    };
  }

  const attacksOf = (f) => (f.air ? f.kit.c.airCombo : f.kit.c.combo);
  const curAttack = (f) => attacksOf(f)[f.combo];
  const jumpAirTime = (f) => (2 * -f.kit.c.jumpVelocity) / GRAVITY;

  // ---------- popups (damage numbers) ----------
  function addPopup(x, y, amount, crit, opts = {}) {
    // stack numbers that land close together (multi-hit skills) so each one stays readable
    const near = state.popups.filter((q) => q.t < 0.45 && Math.abs(q.x - x) < 70).length;
    state.popups.push({
      x, y: y - near * (crit ? 30 : 22), amount, crit, t: 0, life: crit ? 1.1 : opts.skill ? 1.0 : 0.8,
      dx: rand(-14, 14), skill: !!opts.skill, enemy: !!opts.enemy, color: opts.color,
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

  // ---------- combat: one damage path for combos, skills and projectiles ----------
  // o: { dmg, crit, kb, power, dir, launch, landDown, knockdown, stun, sparkColor, sparkColor2, skill }
  function hitFighter(target, o, attacker) {
    if (!target || target.hp <= 0 || state.over) return false;

    // a guarding counter stance eats the blow and strikes back
    const sk = target.skill;
    if (sk && sk.def.counter && !sk.countering && !o.unblockable) {
      triggerCounter(target, attacker);
      return false;
    }
    if (target.invulnT > 0) return false;

    const [lo, hi] = o.dmg;
    const critBonus = attacker.buffT > 0 && attacker.buff ? attacker.buff.crit || 0 : 0;
    const crit = Math.random() < (o.crit ?? 0.2) + critBonus;
    const buffed = attacker.buffT > 0 && attacker.buff;
    const guard = target.buffT > 0 && target.buff && target.buff.guard;   // a guarding buff shrinks the blow
    const dmg = Math.round(randInt(lo, hi) * (crit ? 2.2 : 1) * (buffed ? buffed.dmg || 1 : 1) * (guard || 1));
    target.hp = Math.max(0, target.hp - dmg);
    target.flash = 0.75;

    // getting hit interrupts combos and normal skills; ultimates have armor
    if (!(target.skill && target.skill.def.ult)) {
      target.skill = null;
      target.combo = -1;
      target.air = false;
      target.queued = false;
      target.hitStun = Math.max(target.hitStun, o.power === 2 ? 0.5 : 0.3);
      target.kvx = o.dir * (o.kb ?? 60) * (crit ? 1.4 : 1) * (o.power === 2 ? 3 : 1.5);
      if (o.launch) {
        target.vy = -o.launch * 0.85;
        target.onGround = false;
        target.launched = true;
        target.landDown = o.landDown || 1.2;
      } else if (!target.onGround) {
        // hit in the air: knocked out of the jump, juggled a little
        target.vy = Math.min(target.vy, -160);
        target.launched = true;
        target.landDown = target.landDown || 0.6;
      }
      if (o.knockdown && target.onGround && target.downT <= 0) { target.downT = o.knockdown; target.downMax = o.knockdown; }
      if (o.stun) target.stunT = o.stun;
    }

    attacker.comboCount += 1;
    attacker.comboTimer = 1.6;
    state.hitStop = (crit ? 0.12 : 0.06) + (o.power || 0) * 0.03;
    state.shake = Math.max(state.shake, (crit ? 8 : 3) + (o.power || 0) * 3);
    sfx.hit(o.sfx || (buffed ? buffed.hitSfx || "fire" : weaponOf(attacker, o)), o.power || 0, crit);
    if (guard) addSparks(target.x, target.y - 70, 10, target.buff.color || "#ffffff");
    // a buff that feeds on hits: every blow that lands keeps it going a little longer
    if (buffed && buffed.extendOnHit) {
      attacker.buffT += buffed.extendOnHit;
      for (const v of state.vfx) if (v.follow === attacker && v.buffAura) v.life += buffed.extendOnHit;
    }
    const hy = target.y - 112;
    addPopup(target.x + rand(-10, 10), hy, dmg, crit, { skill: !!o.skill, enemy: target.ctrl === "human" });
    addSparks(target.x - o.dir * 14, hy + 34, 12 + (o.power || 0) * 8, o.sparkColor || "#ffd23f");
    if (o.power) addSparks(target.x - o.dir * 14, hy + 34, 8, o.sparkColor2 || "#ff6a2b");
    if (o.power === 2) addShockwave(target.x, GROUND_Y);
    if (buffed) {
      for (const [n, color] of buffed.hitSparks || []) addSparks(target.x - o.dir * 10, hy + 30, n, color);
      if (buffed.hitFx) addVfx(buffed.hitFx, target.x - o.dir * 6, hy + 40, { life: 0.4, s0: 0.5, s1: 0.9, flip: o.dir });
    }

    for (const e of o.targetFx || []) {
      const dy = e.dy ?? -60;
      addVfx(e.key, target.x, target.y + dy, {
        life: e.life || 0.8, s0: e.s0 ?? 1, s1: e.s1 ?? 1, anchor: e.anchor || "center",
        follow: target, fdy: dy, opacity: e.opacity ?? 1, flip: -o.dir,
      });
    }
    if (target.hp <= 0) knockOut(target, attacker);
    return true;
  }

  function knockOut(loser, winner) {
    loser.skill = null;
    loser.combo = -1;
    loser.downT = 999;
    loser.downMax = 999;
    loser.kvx = -loser.facing * 260;
    if (!loser.onGround) { loser.launched = true; loser.landDown = 999; }
    state.over = true;
    state.winner = winner;
    state.slowmo = 1.2;
    state.overT = 0;
    state.shake = 12;
    sfx.ko();
  }

  // is the opponent within reach in front of f (or on either side with both)?
  function inReach(f, reach, both) {
    const o = f.opp;
    if (o.hp <= 0) return false;
    if (Math.abs(o.y - f.y) > 150) return false;
    const dx = (o.x - f.x) * f.facing;
    if (both) return Math.abs(o.x - f.x) <= reach;
    return dx >= -20 && dx <= reach;
  }

  // ---------- combos ----------
  // ---------- sound ----------
  const noop = () => {};
  const sfx = window.SFX || { swing: noop, hit: noop, clang: noop, boom: noop, thud: noop, jump: noop, ult: noop, charge: noop, bell: noop, ko: noop, gun: noop };
  // punches always sound like fists; everything else uses the character's weapon (see characters/README.md)
  function weaponOf(f, o) { return o && o.punch ? "fist" : f.kit.c.sfx || "fist"; }

  function startAttack(f, idx) {
    const atkDef = attacksOf(f)[idx];
    if (atkDef.blink) blinkBehind(f, atkDef.blink);
    sfx.swing(weaponOf(f, atkDef), atkDef.power || 0);
    if (f.buffT > 0 && f.buff) addSparks(f.x + f.facing * 40, f.y - 70, 6, f.buff.color || "#ffb02e");
    f.combo = idx;
    f.anim = attacksOf(f)[idx].anim;
    f.t = 0;
    f.queued = false;
    f.hitDone = false;
    // each air strike stops the fall with a tiny lift so the combo stays airborne
    if (f.air && !attacksOf(f)[idx].plunge) f.vy = -70;
  }

  function endAttack(f) {
    if (!f.air) f.lastCombo = f.combo;
    f.sinceAttack = 0;
    f.combo = -1;
    f.air = false;
    f.t = 0;
    if (f.onGround) {
      f.anim = "idle";
    } else {
      // fall out of an air combo using the falling poses of the jump clip
      f.anim = "jump";
      f.t = jumpAirTime(f) * 0.7;
    }
  }

  function resolveAttackHit(f) {
    const o = f.opp;
    const atk = curAttack(f);
    if (atk.fx) spawnFx(f, atk.fx);      // slash marks show even on a miss
    if (atk.shot) { fireShot(f, atk.shot); return; }   // thrown attacks hit when the projectile does
    const B = f.buffT > 0 && f.buff;
    const reach = atk.reach * (B && B.reach ? B.reach : 1);
    if (B && B.atkFx) addVfx(B.atkFx.key, f.x + f.facing * reach * 0.55, f.y - (atk.plunge ? 30 : 70), {
      life: 0.3, s0: B.atkFx.s0 ?? 1, s1: B.atkFx.s1 ?? 1.3, flip: f.facing, opacity: 0.9 });
    const dx = (o.x - f.x) * f.facing;
    if (o.hp <= 0) return;
    if (atk.plunge) {
      if (Math.abs(o.x - f.x) > reach) return;       // the slam hits all around the landing spot
    } else if (dx < -20 || dx > reach) {
      return;
    }
    if (Math.abs(o.y - f.y) > 130) return;               // one is far above the other
    const away = atk.plunge ? Math.sign(o.x - f.x) || f.facing : f.facing;
    hitFighter(o, { ...atk, dir: away, sparkColor: atk.power ? "#ffd23f" : "#fff2c4" }, f);
  }

  // A projectile leaves the hand: straight shots may fly at an angle (degrees, + = downward)
  function fireShot(f, d) {
    const muzzle = d.muzzle || [30, -62];
    const a = ((d.angle || 0) * Math.PI) / 180;
    state.shots.push({
      owner: f, x: f.x + f.facing * muzzle[0], y: f.y + muzzle[1], dir: f.facing, dist: 0, out: true,
      hit: false, rot: 0, def: d, cos: Math.cos(a), sin: Math.sin(a), angle: a,
    });
    if (d.flash) addSparks(f.x + f.facing * muzzle[0], f.y + muzzle[1], 6, d.flash);
    if (d.sound) sfx[d.sound]?.();
  }

  // ---------- skills ----------
  function addVfx(key, x, y, opts = {}) {
    state.vfx.push(Object.assign({
      key, x, y, t: 0, life: 0.5, vx: 0, vy: 0, s0: 1, s1: 1, rot: 0, spin: 0,
      flip: 1, alpha: 1, glow: true, flicker: false, anchor: "center",
    }, opts));
  }

  function showBanner(f, def) {
    state.banners = state.banners.filter((b) => b.owner !== f);
    state.banners.push({ owner: f, text: def.name, ult: !!def.ult, t: 0, life: def.ult ? 1.5 : 1.1 });
    if (def.ult) state.dim = 0.55;
  }

  function startSkill(f, slot) {
    const id = f.loadout[slot];
    const def = f.kit.c.skills[id];
    if (!def || f.cooldowns[slot] > 0 || f.skill || f.hp <= 0 || state.over) return false;
    if (!def.leap && !f.onGround) return false;
    f.combo = -1;
    f.air = false;
    f.queued = false;
    f.skill = { id, def, t: 0, hitIdx: 0, phase: 0, thrown: false, landed: false, dashTo: null, ct: 0, trailT: 0 };
    // auto-target: turn toward the opponent, and melee skills dash in to reach them
    const d = f.opp.x - f.x;
    if (f.ctrl !== "human") f.facing = Math.sign(d) || f.facing;
    if (def.assist && Math.sign(d) === f.facing && Math.abs(d) > def.assist && Math.abs(d) < def.assist + 200) f.skill.dashTo = f.opp.x - f.facing * def.assist;
    f.anim = "sk_" + id;
    f.t = 0;
    f.vx = 0;
    f.cooldowns[slot] = def.cd;
    showBanner(f, def);
    if (def.ult) sfx.ult();
    if (def.sound) sfx[def.sound]?.();
    if (f.buffT > 0 && f.buff && f.buff.hitFx) addVfx(f.buff.hitFx, f.x, f.y - 60, { life: 0.4, s0: 0.6, s1: 1.1 });   // buffed casts burst too
    if (def.charge) sfx.charge(def.charge);
    else if (!def.counter) sfx.swing(weaponOf(f, def), 1);
    if (def.ult) f.invulnT = Math.max(f.invulnT, 0.5);
    if (def.leap) {
      const L = typeof def.leap === "object" ? def.leap : {};
      f.vy = L.vy ?? -720;
      f.onGround = false;
      f.vx = f.facing * (L.vx ?? 90);
    }
    if (def.buff) f.buffT = 0;            // a fresh cast restarts the buff once it lands
    if (def.travel) {
      f.vy = def.travel.vy;
      f.onGround = false;
    }
    return true;
  }

  function skillFrame(sk) {
    const def = sk.def;
    if (def.leap) return sk.phase;              // 0 rising, 1 falling strike, 2 landed
    if (def.counter) return sk.countering ? (sk.ct < def.counter.hitAt ? 1 : 2) : 0;   // guard, then strike back
    if (def.travel) return sk.landedT !== undefined ? 2 : sk.t < 0.1 ? 0 : 1;   // take off, strike, land
    if (sk.t < (def.charge || 0)) {             // charging holds a pose (one per stage when staged)
      const st = def.chargeStages && def.chargeStages.find((c) => sk.t < c.until);
      return st ? st.frame : def.chargeFrame || 0;
    }
    const off = def.frameOffset || 0;          // clips with extra charge poses put the strike frames after them
    const k = (sk.t - (def.charge || 0)) / def.dur;
    if (def.loopFrames) return off + Math.floor(k * 9) % 3;   // spin: cycle the 3 frames fast
    let fr = 0;
    for (let i = 0; i < 3; i++) if (k >= def.frames[i]) fr = i;
    return off + fr;
  }

  function skillHit(f, h) {
    if (!inReach(f, h.reach, h.both)) return;
    const o = f.opp;
    const landed = hitFighter(o, { crit: 0.22, kb: 50, ...h, skill: true, dir: h.both ? Math.sign(o.x - f.x) || f.facing : f.facing }, f);
    if (landed && h.yank && o.hp > 0) { o.yankTo = f.x + f.facing * h.yank; o.yankT = h.yankTime || 0.22; o.kvx = 0; }
  }

  // returns true while the skill owns the fighter
  function updateSkill(f, dt) {
    const sk = f.skill;
    if (!sk) return false;
    const def = sk.def;
    sk.t += dt;

    if (def.leap) {
      // rise, hang briefly, then dive into the ground
      if (!sk.landed) {
        const L = typeof def.leap === "object" ? def.leap : {};
        if (f.vy > -80 && sk.phase === 0) {
          sk.phase = 1;
          if (L.dive) {
            // aim a straight diagonal strike at the opponent, kept close to 45 degrees
            const o = f.opp;
            const tFall = Math.max(0.05, (GROUND_Y - f.y) / L.dive);
            f.facing = Math.sign(o.x - f.x) || f.facing;
            sk.diveVx = f.facing * clamp(Math.abs(o.x - f.x) / tFall, L.dive * 0.6, L.dive * 1.3);
          }
        }
        if (sk.phase === 1 && L.dive) {
          f.vx = sk.diveVx;
          f.vy = L.dive;
          if (def.trail) {
            sk.trailT -= dt;
            if (sk.trailT <= 0) { sk.trailT = def.trail.every; spawnFx(f, def.trail.fx); }
          }
        } else {
          if (sk.phase === 1) f.vy = Math.max(f.vy, 1100);
          f.vy += GRAVITY * dt;
        }
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        if (f.y >= GROUND_Y) {
          f.y = GROUND_Y;
          f.vy = 0;
          f.onGround = true;
          sk.landed = true;
          sk.phase = 2;
          sk.t = 0;
          const h = def.hit;
          spawnFx(f, h.fx);
          if (h.redFlash) state.flashRed = 0.6;
          state.shake = 14;
          sfx.boom(1.2);
          if (inReach(f, h.reach, true)) {
            const o = f.opp;
            hitFighter(o, { kb: 90, ...h, skill: true, dir: Math.sign(o.x - f.x) || f.facing }, f);
          }
        }
      } else if (sk.t > 0.38) {
        endSkill(f);
      }
      return true;
    }

    // counter stance: hold the guard; a blocked blow triggers the counter strike
    if (def.counter) {
      const c = def.counter;
      f.vx = 0;
      if (!sk.countering) {
        if (!sk.aura && c.aura) { sk.aura = true; spawnFx(f, [{ ...c.aura, life: c.window, follow: true }]); }
        if (sk.t >= c.window) endSkill(f);
        return true;
      }
      sk.ct += dt;
      if (!sk.counterHit && sk.ct >= c.hitAt) {
        sk.counterHit = true;
        spawnFx(f, c.hit.fx);
        if (inReach(f, c.hit.reach, true)) {
          const o = f.opp;
          hitFighter(o, { ...c.hit, crit: 1, skill: true, unblockable: true, dir: Math.sign(o.x - f.x) || f.facing }, f);   // counters always crit
        }
      }
      if (sk.ct >= c.dur) endSkill(f);
      return true;
    }

    // charge-up: hold the first frame, gather sparks, then run the rest of the skill
    const t0 = def.charge || 0;
    if (sk.t < t0) {
      f.vx = 0;
      if (!sk.charged) { sk.charged = true; spawnFx(f, def.chargeFx); }
      // staged charges: each stage has its own pose, effects, colour and sound
      const si = def.chargeStages ? def.chargeStages.findIndex((c) => sk.t < c.until) : -1;
      const stage = si >= 0 ? def.chargeStages[si] : null;
      if (stage && sk.stage !== si) {
        sk.stage = si;
        spawnFx(f, stage.fx);
        if (stage.sound) sfx[stage.sound]?.();
      }
      if (chance(0.7)) {
        const a = rand(0, Math.PI * 2);
        addSparks(f.x + f.facing * 16 + Math.cos(a) * 30, f.y - 64 + Math.sin(a) * 30, 1, (stage && stage.color) || def.chargeColor || "#ffb02e");
      }
      state.shake = Math.max(state.shake, 1 + (sk.t / t0) * 2);
      return true;
    }

    const kk = (sk.t - t0) / (def.dur || 1);
    // blink: vanish and reappear on the far side of the opponent
    if (def.blink && !sk.blinked && kk >= (def.blink.at || 0)) {
      sk.blinked = true;
      if (blinkBehind(f, def.blink)) sk.dashTo = null;
    }
    // dash: run in the held direction (forward if none); hit once when passing the opponent
    if (def.dash) {
      const D = def.dash, o = f.opp;
      if (sk.dashDir === undefined) {
        const held = (f.input.keys.has("right") ? 1 : 0) - (f.input.keys.has("left") ? 1 : 0);
        sk.dashDir = D.forward ? f.facing : held || f.facing;
        sk.dashSide = Math.sign(o.x - f.x);
      }
      const was = sk.dashing;
      sk.dashing = sk.t - t0 < D.time;
      if (was && !sk.dashing && D.hopOff) { f.vy = -D.hopOff; f.onGround = false; }   // jump off the ride
      if (sk.dashing) {
        f.x = clamp(f.x + sk.dashDir * (D.dist / D.time) * dt, 40, M.worldWidth - 40);
        sk.passThrough = true;
        const side = Math.sign(o.x - f.x);
        const crossed = side !== sk.dashSide || Math.abs(o.x - f.x) < 28;
        if (!sk.dashHit && crossed && Math.abs(o.y - f.y) < 120 && o.hp > 0) {
          sk.dashHit = true;
          spawnFx(f, D.hit.fx);
          hitFighter(o, { crit: 0.25, kb: 60, ...D.hit, skill: true, dir: sk.dashDir }, f);
        }
      }
    }
    // hop: leap over the opponent in an arc and land behind them
    if (def.hop) {
      const H = def.hop, o = f.opp;
      if (sk.hopFrom === undefined) {
        const side = Math.sign(o.x - f.x) || f.facing;
        sk.hopFrom = f.x;
        sk.hopTo = Math.abs(o.x - f.x) <= (H.range ?? 420) ? clamp(o.x + side * H.behind, 40, M.worldWidth - 40) : f.x + side * 120;
      }
      const p = clamp((sk.t - t0) / H.time, 0, 1);
      sk.moving = p < 1;
      f.x = sk.hopFrom + (sk.hopTo - sk.hopFrom) * p;
      f.y = GROUND_Y - Math.sin(Math.PI * p) * H.height;
      f.onGround = p >= 1;
      if (p >= 1) f.facing = Math.sign(o.x - f.x) || f.facing;
    }
    // shadow for flying skills (travel) while airborne
    if (def.travel && def.shadow) sk.moving = !f.onGround;
    // rain: after casting, rockets fall from the sky on the opponent for a while
    if (def.rain && !sk.rained && kk >= (def.rain.at || 0)) {
      sk.rained = true;
      const R = def.rain, dir = f.facing;
      for (let i = 0; i < R.count; i++) {
        state.timers.push({
          t: (R.delay || 0) + (i * R.duration) / R.count,
          fn: () => {
            const o = f.opp, h = R.height || 330;
            const tx = o.x + rand(-R.spread || -80, R.spread || 80);
            state.shots.push({
              owner: f, x: tx - dir * h, y: GROUND_Y - h, dir, dist: 0, out: true, hit: false, rot: 0,
              def: R.shot, cos: Math.SQRT1_2, sin: Math.SQRT1_2, angle: Math.PI / 4,
            });
            sfx.rocket?.();
          },
        });
      }
    }
    // pull: drag the opponent in while the field is up (no damage)
    if (def.pull) {
      const o = f.opp, d = o.x - f.x;
      if (Math.abs(d) <= def.pull.range && Math.abs(d) > def.pull.stopAt && o.hp > 0 && !(o.skill && o.skill.def.ult)) {
        o.x -= Math.sign(d) * def.pull.speed * dt;
        if (chance(0.5)) addSparks(o.x - Math.sign(d) * 10, o.y - rand(30, 100), 1, def.pull.color || "#8fd0ff");
      }
    }
    // buff: power up for a while; the aura follows the fighter
    if (def.buff && !sk.buffed && kk >= (def.buff.at || 0)) {
      sk.buffed = true;
      f.buffT = def.buff.dur;
      f.buff = def.buff;
      if (def.buff.aura) spawnFx(f, [{ ...def.buff.aura, life: def.buff.dur, follow: true, buffAura: true }]);
      if (def.buff.heal) {
        const gain = Math.min(def.buff.heal, f.maxHp - f.hp);
        f.hp += gain;
        addPopup(f.x, f.y - 130, "+" + gain, false, { skill: true, color: "#9dffb0" });
        addSparks(f.x, f.y - 70, 24, def.buff.color || "#ffffff");
      }
      sfx.boom(0.8);
    }

    // ground skills are rooted unless they drift or travel forward
    if (def.dash || def.hop) f.vx = 0;
    else f.vx = def.travel && !f.onGround ? f.facing * def.travel.vx : def.drift ? f.facing * def.drift : 0;
    f.x += f.vx * dt;
    if (sk.dashTo !== null && sk.t < 0.16) {
      f.x += (sk.dashTo - f.x) * Math.min(1, dt * 22);
      if (Math.floor(sk.t * 60) % 2 === 0) addSparks(f.x - f.facing * 20, GROUND_Y - 6, 1, "#e9dcc0");
    }
    // airborne during a skill (flying knee, rising uppercut): fall back down (hops move on their own arc)
    if (!f.onGround && !def.hop) {
      f.vy += GRAVITY * (def.gravity ?? 1) * dt;
      f.y += f.vy * dt;
      if (f.y >= GROUND_Y) {
        f.y = GROUND_Y; f.vy = 0; f.onGround = true; f.airUsed = false;
        if (def.travel) { sk.landedT = 0; state.shake = Math.max(state.shake, 3); addShockwave(f.x, GROUND_Y); sfx.thud(); }
      }
      if (def.trail) {
        sk.trailT -= dt;
        if (sk.trailT <= 0) { sk.trailT = def.trail.every; spawnFx(f, def.trail.fx); }
      }
    }
    const k = (sk.t - t0) / def.dur;

    if (def.hits) {
      while (sk.hitIdx < def.hits.length && k >= def.hits[sk.hitIdx].at) {
        const h = def.hits[sk.hitIdx++];
        spawnFx(f, h.fx);
        skillHit(f, h);
        if (h.rise) { f.vy = -h.rise; f.onGround = false; }   // follow a launched enemy up
      }
    }

    if (def.shot && !sk.thrown && k >= def.shot.at) {
      // a burst fires `burst` shots `gap` seconds apart; a plain shot fires once
      const fired = sk.fired || 0;
      const burst = def.shot.burst || 1;
      if (sk.t - t0 >= def.shot.at * def.dur + fired * (def.shot.gap || 0)) {
        sk.fired = fired + 1;
        if (sk.fired >= burst) sk.thrown = true;
        fireShot(f, def.shot);
      }
    }

    if (def.aura && !sk.aura) {
      // effect that surrounds the fighter for the whole cast
      sk.aura = true;
      spawnFx(f, [{ ...def.aura, life: def.dur + 0.15, follow: true, back: true }]);
    }

    const holding = def.shot && !def.shot.straight && state.shots.some((s) => s.owner === f);   // wait to catch the thrown weapon
    if (def.travel) {
      // a flying strike ends a moment after it lands, whatever its clip length
      if (sk.landedT !== undefined) {
        sk.landedT += dt;
        if (sk.landedT > (def.travel.landHold ?? 0.18)) endSkill(f);
      }
      return true;
    }
    if (k >= 1 && !holding) endSkill(f);
    return true;
  }

  function endSkill(f) {
    f.skill = null;
    f.t = 0;
    if (f.onGround) {
      f.anim = "idle";
    } else {
      f.anim = "jump";
      f.t = jumpAirTime(f) * 0.7;
    }
  }

  function triggerCounter(f, attacker) {
    const sk = f.skill;
    sk.countering = true;
    sk.ct = 0;
    f.facing = Math.sign(attacker.x - f.x) || f.facing;
    // the attacker is stopped in their tracks
    attacker.skill = attacker.skill && attacker.skill.def.ult ? attacker.skill : null;
    attacker.combo = -1;
    attacker.hitStun = Math.max(attacker.hitStun, 0.45);
    state.hitStop = 0.14;
    state.shake = 6;
    sfx.clang();
    addPopup(f.x, f.y - 120, "COUNTER", false, { skill: true });
    addSparks(f.x + f.facing * 24, f.y - 70, 18, "#ffd23f");
  }

  // Vanish and reappear on the far side of the opponent, facing them. b: { behind, range, fx, fxOut, fxIn }
  function blinkBehind(f, b) {
    const o = f.opp;
    if (Math.abs(o.x - f.x) > (b.range ?? 430)) return false;
    const side = Math.sign(o.x - f.x) || f.facing;
    const from = f.x;
    const to = clamp(o.x + side * (b.behind ?? 60), 40, M.worldWidth - 40);
    for (let i = 1; i <= 5; i++) {
      f.ghosts.push({ anim: f.anim, frame: 0, x: from + (to - from) * (i / 6), y: f.y, facing: f.facing, born: state.time - 0.02 * (6 - i) });
    }
    spawnFx(f, b.fxOut || b.fx);        // where they vanish
    f.x = to;
    f.facing = Math.sign(o.x - f.x) || -side;
    spawnFx(f, b.fxIn || b.fx);         // where they reappear
    sfx.swing("fist", 2);
    return true;
  }

  // Spawn effects described in character data (see characters/README.md).
  function spawnFx(f, list) {
    if (!list) return;
    const dir = f.facing;
    for (const e of list) {
      const x = f.x + dir * (e.dx || 0);
      const y = (e.at === "ground" ? GROUND_Y + 4 : f.y - 60) + (e.dy || 0);
      if (e.key) {
        addVfx(e.key, x, y, {
          vx: dir * (e.vx || 0), vy: e.vy || 0, life: e.life || 0.5,
          s0: e.s0 ?? 1, s1: e.s1 ?? 1, rot: (e.rot || 0) * dir, flip: dir,
          anchor: e.anchor || "center", stretch: !!e.stretch, back: !!e.back,
          follow: e.follow ? f : null, opacity: e.opacity ?? 1,
          fdy: e.follow ? y - f.y : undefined, fdx: e.follow ? e.behind || 0 : 0, buffAura: !!e.buffAura, glow: e.glow ?? true,
        });
      }
      if (e.shockwave) addShockwave(x, GROUND_Y);
      for (const [n, color] of e.sparks || []) addSparks(x + rand(-40, 40), y - rand(0, 50), n, color);
    }
  }

  // thrown weapons fly out inside their effect, then curve back to the thrower's hand
  function updateShots(dt) {
    for (const s of state.shots) {
      const f = s.owner;
      s.rot += dt * 26;
      const step = s.def.speed * dt;
      if (s.def.straight) {
        // flies straight (or at its angle) to the edge of the stage and never comes back
        s.x += s.dir * step * (s.cos ?? 1);
        s.y += step * (s.sin ?? 0);
        s.dist += step;
        if (s.dist >= s.def.range || s.x < -200 || s.x > M.worldWidth + 200) s.done = true;
        if (s.y >= GROUND_Y - 6) {
          // hit the ground: blast, and catch the opponent if they are close to the impact
          s.done = true;
          if (s.def.groundFx) addVfx(s.def.groundFx, s.x, GROUND_Y + 4, { life: 0.45, s0: 0.6, s1: (s.def.scale || 1) * 1.1, anchor: "bottom" });
          addShockwave(s.x, GROUND_Y);
          const o = f.opp;
          if (!s.hit && o.hp > 0 && Math.abs(o.x - s.x) < (s.def.splash || 50) && o.y > GROUND_Y - 120) {
            s.hit = true;
            hitFighter(o, { power: 1, crit: 0.2, kb: 40, ...s.def, skill: true, dir: s.dir }, f);
          }
          continue;
        }
        if (s.def.trail && chance(0.6)) addSparks(s.x - s.dir * 50, s.y + rand(-6, 6), 1, s.def.trail);
      } else if (s.out) {
        s.x += s.dir * step;
        s.dist += step;
        if (s.dist >= s.def.range) s.out = false;
      } else {
        const tx = f.x + f.facing * 20, ty = f.y - 62;
        const dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy);
        const sp = s.def.speed * 1.15 * dt;
        if (d <= sp + 6 || f.hp <= 0) { s.done = true; continue; }
        s.x += (dx / d) * sp;
        s.y += (dy / d) * sp;
      }
      const o = f.opp;
      if (!s.hit && o.hp > 0 && Math.abs(o.x - s.x) < 42 && Math.abs(o.y - 62 - s.y) < 90) {
        s.hit = true;
        hitFighter(o, { power: 1, crit: 0.25, kb: 40, ...s.def, skill: true, dir: s.dir }, f);
      }
    }
    state.shots = state.shots.filter((s) => !s.done);
  }

  // ---------- fighter update ----------
  function updateFighter(f, dt) {
    const input = f.input;
    const animDef = f.kit.anims[f.anim];
    const o = f.opp;
    f.t += dt;
    f.sinceAttack += dt;
    f.invulnT = Math.max(0, f.invulnT - dt);
    if (f.buffT > 0) {
      f.buffT -= dt;
      if (f.buffT <= 0 || f.hp <= 0) { f.buffT = 0; f.buff = null; state.vfx = state.vfx.filter((v) => !(v.follow === f && v.buffAura)); }
    }
    f.flash = Math.max(0, f.flash - dt * 6);
    for (let i = 0; i < 3; i++) f.cooldowns[i] = Math.max(0, f.cooldowns[i] - dt);
    f.comboTimer -= dt;
    if (f.comboTimer <= 0) f.comboCount = 0;
    f.shownHp += (f.hp - f.shownHp) * Math.min(1, dt * 3);

    // dragged in by a hooked weapon
    if (f.yankT > 0) {
      f.yankT -= dt;
      f.x += (f.yankTo - f.x) * Math.min(1, dt * 14);
      if (chance(0.6)) addSparks(f.x, f.y - rand(40, 100), 1, "#b0121e");
    }
    // knockback slides the body regardless of what it is doing
    f.x += f.kvx * dt;
    f.kvx *= Math.pow(0.002, dt);

    // knocked into the air: fly, fall, and crash down
    if (f.launched) {
      f.vy += GRAVITY * 0.8 * dt;
      f.y += f.vy * dt;
      if (f.y >= GROUND_Y) {
        f.y = GROUND_Y;
        f.vy = 0;
        f.onGround = true;
        f.launched = false;
        f.airUsed = false;
        state.shake = Math.max(state.shake, 4);
        addShockwave(f.x, GROUND_Y);
        sfx.thud();
        if (f.landDown) { f.downT = f.landDown; f.downMax = f.landDown; f.landDown = 0; }
      }
      f.anim = "idle";
      return;
    }
    if (f.downT > 0) {
      f.downT -= dt;
      f.anim = "idle";
      if (f.downT <= 0) f.invulnT = 0.6;        // a moment of safety while getting up
      return;
    }
    if (f.stunT > 0) { f.stunT -= dt; f.anim = "idle"; return; }
    if (f.hitStun > 0) { f.hitStun -= dt; f.anim = f.onGround ? "idle" : f.anim; if (f.onGround) return; }
    if (f.hp <= 0 || state.over) { f.vx = 0; return; }

    // skills first, then combos, then moving
    for (let i = 0; i < 3; i++) if (input.pressed.has("skill" + (i + 1))) startSkill(f, i);
    if (updateSkill(f, dt)) return;

    const attacking = f.combo >= 0;
    if (input.pressed.has("attack")) {
      if (!attacking && f.onGround) {
        f.air = false;
        const ground = f.kit.c.combo;
        const next = f.sinceAttack < COMBO_WINDOW && f.lastCombo < ground.length - 1 ? f.lastCombo + 1 : 0;
        if (f.ctrl !== "human") f.facing = Math.sign(o.x - f.x) || f.facing;   // the player turns by walking
        startAttack(f, next);
      } else if (!attacking && !f.airUsed) {
        f.air = true;
        f.airUsed = true;
        startAttack(f, 0);
      } else if (attacking && f.combo < attacksOf(f).length - 1) {
        f.queued = true;
      }
    }

    if (f.combo >= 0) {
      const atk = curAttack(f);
      const strikeT = animDef.duration * animDef.playFor * 0.75;   // start of the strike frame
      if (atk.plunge) {
        // wind up in the air, then dive; the strike frame lands with the body
        if (!f.onGround) {
          if (f.t > animDef.duration * animDef.playFor * 0.25) {
            // plungeVx/plungeVy set the dive angle (equal values = 45 degrees)
            f.vy = Math.max(f.vy, atk.plungeVy ?? 980);
            f.vx = f.facing * (atk.plungeVx ?? 110);
          } else {
            f.vy = Math.min(f.vy, 0);
            f.vx = 0;
          }
          f.t = Math.min(f.t, strikeT - 0.001);
        } else {
          f.vx = 0;
          if (!f.hitDone) {
            f.hitDone = true;
            f.t = strikeT;
            state.shake = Math.max(state.shake, 5);
            addShockwave(f.x + f.facing * 30, GROUND_Y);
            sfx.boom(0.6);
            resolveAttackHit(f);
          }
        }
      } else if (f.air) {
        f.vx = f.facing * 35;
      } else {
        // during ground attacks the fighter commits; a little forward drift sells the swing
        f.vx = f.t < animDef.duration * 0.5 ? f.facing * atk.drift : 0;
      }
      const progress = f.t / animDef.duration;
      if (!atk.plunge && !f.hitDone && progress >= animDef.hitAt) {
        f.hitDone = true;
        resolveAttackHit(f);
      }
      if (f.combo >= 0 && progress >= 1) {
        if (f.queued && f.combo < attacksOf(f).length - 1) startAttack(f, f.combo + 1);
        else endAttack(f);
      }
    } else {
      let dir = 0;
      if (input.keys.has("left")) dir -= 1;
      if (input.keys.has("right")) dir += 1;
      // the player faces the way they walk; the AI always faces its opponent (walking away is a back-step)
      if (f.ctrl === "human") { if (dir) f.facing = dir; }
      else f.facing = Math.sign(o.x - f.x) || f.facing;
      const haste = f.buffT > 0 && f.buff ? f.buff.speed || 1 : 1;
      f.vx = dir * f.kit.c.walkSpeed * haste * (dir === f.facing ? 1 : 0.75);

      if (input.pressed.has("jump") && f.onGround) {
        sfx.jump();
        f.vy = f.kit.c.jumpVelocity * (f.buffT > 0 && f.buff ? f.buff.jump || 1 : 1);
        f.onGround = false;
        f.anim = "jump";
        f.t = 0;
      }
      if (f.onGround) {
        const want = dir !== 0 ? "walk" : "idle";
        if (f.anim !== want) { f.anim = want; f.t = 0; }
      }
    }

    // physics: air strikes hang in the air with much lighter gravity
    const hovering = f.combo >= 0 && f.air && !curAttack(f).plunge;
    f.x += f.vx * dt;
    if (!f.onGround) {
      f.vy += (hovering ? GRAVITY * 0.18 : GRAVITY) * dt;
      if (hovering) f.vy = Math.min(f.vy, 110);
      f.y += f.vy * dt;
      if (f.y >= GROUND_Y) {
        f.y = GROUND_Y;
        f.vy = 0;
        f.onGround = true;
        f.airUsed = false;
        if (f.combo < 0) { f.anim = "idle"; f.t = 0; }
        else if (f.air && !curAttack(f).plunge) endAttack(f);   // landed mid air-strike
      }
    }
  }

  // keep the two bodies apart on the ground and inside the arena
  function separateFighters() {
    const [a, b] = state.fighters;
    const dashing = (a.skill && a.skill.dashing) || (b.skill && b.skill.dashing);   // dashes pass through
    if (!dashing && a.y > GROUND_Y - 50 && b.y > GROUND_Y - 50 && a.hp > 0 && b.hp > 0 && a.downT <= 0 && b.downT <= 0) {
      const gap = b.x - a.x, minGap = 50;
      if (Math.abs(gap) < minGap) {
        const push = (minGap - Math.abs(gap)) / 2 * (gap >= 0 ? 1 : -1);
        a.x -= push;
        b.x += push;
      }
    }
    for (const f of state.fighters) {
      f.x = clamp(f.x, 40, M.worldWidth - 40);
      f.x = clamp(f.x, f.opp.x - MAX_SEPARATION, f.opp.x + MAX_SEPARATION);
    }
  }

  // ---------- AI ----------
  // The AI presses the same buttons a player would, a few times a second.
  function skillRange(def) {
    if (def.shot) return def.shot.range * 0.8;
    if (def.blink) return def.blink.range;
    if (def.dash) return def.dash.dist * 0.8;
    if (def.hop) return def.hop.range ?? 420;
    if (def.rain) return 9999;
    if (def.pull) return def.pull.range;
    if (def.buff) return 9999;
    if (def.leap && typeof def.leap === "object" && def.leap.dive) return 420;
    if (def.leap) return def.hit.reach + 80;
    if (def.counter) return 110;
    if (def.travel) return 220;
    const reach = Math.max(...(def.hits || [{ reach: 100 }]).map((h) => h.reach));
    return reach + (def.assist ? 150 : 0);
  }

  function aiThink(f) {
    const o = f.opp;
    const ai = f.ai;
    const dist = Math.abs(o.x - f.x);
    const toward = o.x > f.x ? "right" : "left";
    const away = toward === "right" ? "left" : "right";
    const reach = f.kit.c.combo[0].reach * 0.9;
    const oppAttacking = o.combo >= 0 || (o.skill && !o.skill.def.counter);
    ai.plan = null;

    // the opponent is helpless: rush in and punish
    if (o.downT > 0 || o.stunT > 0 || o.launched) {
      ai.plan = dist > reach ? { move: toward, t: 0.25 } : { attack: 4 };
      return;
    }

    // ready skills that would reach right now, ultimates preferred when the AI is losing
    const ready = f.loadout
      .map((id, i) => ({ i, def: f.kit.c.skills[id] }))
      .filter((s) => f.cooldowns[s.i] <= 0 && dist <= skillRange(s.def));
    const counter = ready.find((s) => s.def.counter);
    if (counter && oppAttacking && dist < 130 && chance(0.6)) { ai.plan = { skill: counter.i }; return; }
    const usable = ready.filter((s) => !s.def.counter);
    const ult = usable.find((s) => s.def.ult);
    if (ult && (f.hp < f.maxHp * 0.6 || chance(0.25))) { ai.plan = { skill: ult.i }; return; }
    if (usable.length && chance(0.32)) { ai.plan = { skill: usable[randInt(0, usable.length - 1)].i }; return; }

    // being pressured up close: sometimes step out or hop away
    if (oppAttacking && dist < 110 && chance(0.3)) {
      ai.plan = chance(0.5) ? { move: away, t: 0.35 } : { jump: true, move: away, t: 0.4 };
      return;
    }

    if (dist > reach + 10) {
      // close in; now and then jump in with an air combo
      ai.plan = dist < 200 && chance(0.15) ? { jump: true, move: toward, t: 0.3, airAttack: true } : { move: toward, t: rand(0.2, 0.45) };
    } else if (chance(ai.aggression)) {
      ai.plan = { attack: randInt(2, f.kit.c.combo.length) };
    } else {
      ai.plan = { move: chance(0.5) ? away : null, t: rand(0.2, 0.5) };
    }
  }

  function updateAI(f, dt) {
    const ai = f.ai;
    const inp = f.input;
    inp.pressed.clear();
    inp.keys.clear();
    if (state.over || state.introT > 0 || f.hp <= 0) return;
    ai.think -= dt;
    if (ai.think <= 0) {
      ai.think = rand(0.16, 0.32);              // reaction time
      if (!f.skill && (f.combo < 0 || ai.plan?.attack)) aiThink(f);
    }
    const plan = ai.plan;
    if (!plan) return;
    if (plan.skill !== undefined) {
      inp.pressed.add("skill" + (plan.skill + 1));
      ai.plan = null;
      ai.think = rand(0.4, 0.8);
      return;
    }
    if (plan.jump) { inp.pressed.add("jump"); plan.jump = false; }
    if (plan.airAttack && !f.onGround && f.vy > -200) { inp.pressed.add("attack"); plan.airLeft = (plan.airLeft ?? 2) - 1; if (plan.airLeft <= 0) plan.airAttack = false; }
    if (plan.move) inp.keys.add(plan.move);
    if (plan.attack) {
      // press attack again while the combo plays to chain up to the planned number of hits
      if (f.combo < 0 || (f.queued === false && f.combo < plan.attack - 1)) {
        if (f.combo < 0 && plan.started) { ai.plan = null; ai.think = rand(0.3, 0.7); return; }
        inp.pressed.add("attack");
        plan.started = true;
      }
    }
    if (plan.t !== undefined) {
      plan.t -= dt;
      if (plan.t <= 0) ai.plan = null;
    }
  }

  // ---------- skill picker (your fighter's 3 equipped skills) ----------
  const skillBtns = [...document.querySelectorAll(".skill[data-act^='skill']")];
  function syncSkillButtons() {
    skillBtns.forEach((btn, i) => {
      const def = p1Kit.c.skills[p1Loadout[i]];
      btn.style.setProperty("--icon", `url("${M.vfx[def.icon]}")`);
      btn.classList.toggle("ult", !!def.ult);
      btn.setAttribute("aria-label", def.name);
      const lbl = btn.querySelector("span");
      if (lbl) lbl.textContent = def.name;
    });
  }
  function updateSkillButtons() {
    const p = state.p1;
    skillBtns.forEach((btn, i) => {
      const def = p1Kit.c.skills[p.loadout[i]];
      if (!def) return;
      const cd = p.cooldowns[i];
      btn.style.setProperty("--cd", String(cd > 0 ? cd / def.cd : 0));
      const n = btn.querySelector("b");
      if (n) n.textContent = cd > 0 ? Math.ceil(cd) : "";
    });
  }

  // ---------- skill step: after picking fighters, choose 2 normal skills and 1 ultimate ----------
  const picker = document.getElementById("picker");
  let pickerOpen = false;           // kept for the update() pause check
  const draft = { normals: [], ult: null };
  function skillCard(kit, id, slotLabel, onClick) {
    const def = kit.c.skills[id];
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pick" + (slotLabel ? " on" : "") + (def.ult ? " ult" : "");
    b.setAttribute("aria-pressed", slotLabel ? "true" : "false");
    b.innerHTML = `<img alt="" src="${M.vfx[def.icon]}"><span class="pn">${def.name}</span>` +
      `<span class="pd">${def.desc}</span><span class="pc">${def.ult ? "ULT · " : ""}CD ${def.cd}s</span>` +
      (slotLabel ? `<em>${slotLabel}</em>` : "");
    b.addEventListener("click", onClick);
    li.appendChild(b);
    return li;
  }
  function renderPicker() {
    const kit = KITS[pick.p1];
    picker.querySelector("#pick-title").textContent = `เลือกสกิล · ${kit.c.name}`;
    const normalList = picker.querySelector(".pick-list.normal");
    const ultList = picker.querySelector(".pick-list.ult");
    normalList.textContent = "";
    ultList.textContent = "";
    for (const id of normalsOf(kit)) {
      const i = draft.normals.indexOf(id);
      normalList.appendChild(skillCard(kit, id, i >= 0 ? ["U", "I"][i] : null, () => toggleNormal(id)));
    }
    for (const id of ultsOf(kit)) {
      ultList.appendChild(skillCard(kit, id, draft.ult === id ? "O" : null, () => { draft.ult = id; renderPicker(); }));
    }
    const need = 2 - draft.normals.length;
    picker.querySelector(".pick-note").textContent =
      need > 0 ? `เลือกสกิลธรรมดาอีก ${need} ท่า` : !draft.ult ? "เลือกไม้ตาย 1 ท่า" : "พร้อมแล้ว กดเริ่มต่อสู้";
    picker.querySelector(".pick-done").disabled = need > 0 || !draft.ult;
  }
  function toggleNormal(id) {
    const i = draft.normals.indexOf(id);
    if (i >= 0) draft.normals.splice(i, 1);
    else if (draft.normals.length < 2) draft.normals.push(id);
    else {
      const note = picker.querySelector(".pick-note");
      note.textContent = "สกิลธรรมดาเลือกได้ 2 ท่า แตะท่าที่เลือกไว้เพื่อถอดออกก่อน";
      note.classList.remove("shake"); void note.offsetWidth; note.classList.add("shake");
      return;
    }
    renderPicker();
  }
  function openSkillStep() {
    const set = savedLoadout(KITS[pick.p1]);
    draft.normals = set.slice(0, 2);
    draft.ult = set[2] || null;
    charsel.hidden = true;
    picker.hidden = false;
    renderPicker();
    picker.querySelector(".pick-done").focus();
  }
  function backToFighters() {
    picker.hidden = true;
    charsel.hidden = false;
    charsel.querySelector(".sel-start").focus();
  }

  // ---------- select screen: your fighter and the AI's, shown before every match ----------
  const charsel = document.getElementById("charsel");
  let menuOpen = false;
  let matchLive = false;            // a fight is in progress (the menu can be closed back into it)
  const pick = { p1: P1_ID };

  function portraitCanvas(id, size) {
    const c = window.CHARACTERS[id];
    const cv = document.createElement("canvas");
    cv.width = size;
    cv.height = size;
    const draw = (img) => {
      const cc = cv.getContext("2d");
      cc.imageSmoothingEnabled = false;
      const pc = c.portrait.crop;
      cc.drawImage(img, pc.x, pc.y, pc.w, pc.h, 0, 0, size, size);
    };
    const loaded = images[KITS[id].portrait];
    if (loaded) draw(loaded);
    else { const img = new Image(); img.onload = () => draw(img); img.src = KITS[id].portrait; }
    return cv;
  }
  function renderMenu() {
    for (const side of ["p1"]) {
      const list = charsel.querySelector(`[data-side="${side}"] .char-list`);
      list.textContent = "";
      for (const id of ROSTER) {
        const li = document.createElement("li");
        const b = document.createElement("button");
        b.type = "button";
        b.className = "char" + (pick[side] === id ? " on" : "");
        b.setAttribute("aria-pressed", String(pick[side] === id));
        const name = document.createElement("span");
        name.textContent = window.CHARACTERS[id].name;
        b.append(portraitCanvas(id, 48), name);
        b.addEventListener("click", () => { pick[side] = id; renderMenu(); });
        li.appendChild(b);
        list.appendChild(li);
      }
    }
    charsel.querySelector(".sel-back").hidden = !matchLive;
  }
  function openMenu() {
    if (!charsel || menuOpen) return;
    menuOpen = true;
    picker.hidden = true;
    keys.clear();
    pressed.clear();
    pick.p1 = P1_ID;
    renderMenu();
    charsel.hidden = false;
    charsel.querySelector(".sel-start").focus();
  }
  function closeMenu() {
    charsel.hidden = true;
    picker.hidden = true;
    menuOpen = false;
    keys.clear();
    pressed.clear();
    canvas.focus();
  }
  function startMatch() {
    P1_ID = pick.p1;
    // the CPU's fighter is random every match (someone other than you, when there is someone)
    const others = ROSTER.filter((id) => id !== P1_ID);
    P2_ID = others.length ? others[Math.floor(Math.random() * others.length)] : P1_ID;
    p1Kit = KITS[P1_ID];
    LOADOUT_KEY = `komfaek.skills.${P1_ID}`;
    p1Loadout = [...draft.normals, draft.ult];
    try { localStorage.setItem(LOADOUT_KEY, JSON.stringify(p1Loadout)); } catch (_) { /* ignore */ }
    try { localStorage.setItem(MATCH_KEY, JSON.stringify({ p1: P1_ID })); } catch (_) { /* ignore */ }
    reset();
    syncSkillButtons();
    matchLive = true;
    closeMenu();
  }
  if (charsel) {
    for (const b of document.querySelectorAll("[data-open-chars]")) b.addEventListener("click", openMenu);
    charsel.querySelector(".sel-start").addEventListener("click", openSkillStep);
    picker.querySelector(".pick-done").addEventListener("click", () => { if (draft.normals.length === 2 && draft.ult) startMatch(); });
    picker.querySelector(".pick-back").addEventListener("click", backToFighters);
    charsel.querySelector(".sel-back").addEventListener("click", () => { if (matchLive) closeMenu(); });
    addEventListener("keydown", (e) => {
      if (!menuOpen) return;
      const onSkills = !picker.hidden;
      if (e.code === "Escape") {
        e.preventDefault();
        if (onSkills) backToFighters();
        else if (matchLive) closeMenu();
      } else if (e.code === "Enter" && document.activeElement?.closest?.(".char, .pick") == null) {
        e.preventDefault();
        if (!onSkills) openSkillStep();
        else if (draft.normals.length === 2 && draft.ult) startMatch();
      }
    });
  }
  // ---------- update ----------
  function update(rawDt) {
    if (pickerOpen || menuOpen) { pressed.clear(); return; }
    if (pressed.has("restart")) { reset(); pressed.clear(); return; }
    // after a K.O. the game goes back to the select screen
    if (state.over && state.overT > 3.2) { matchLive = false; openMenu(); return; }

    // KO slow motion
    let dt = rawDt;
    if (state.slowmo > 0) { state.slowmo -= rawDt; dt = rawDt * 0.3; }
    if (state.over) state.overT = (state.overT || 0) + rawDt;

    if (state.hitStop > 0) {
      state.hitStop -= dt;
      // keep the player's combo input alive through the impact freeze
      const p = state.p1;
      if (pressed.has("attack") && p.combo >= 0 && p.combo < attacksOf(p).length - 1) p.queued = true;
      pressed.clear();
      return;
    }

    state.time += dt;
    const wasReady = state.introT > 0.6;
    state.introT = Math.max(0, state.introT - dt);
    if (wasReady && state.introT <= 0.6) sfx.bell(1);      // "FIGHT!"
    state.flashRed = Math.max(0, state.flashRed - dt * 1.4);
    state.dim = Math.max(0, state.dim - dt * 0.9);
    for (const b of state.banners) b.t += dt;
    state.banners = state.banners.filter((b) => b.t < b.life);

    if (state.introT > 0) pressed.clear();      // "FIGHT!" countdown: nobody moves yet
    updateAI(state.p2, dt);
    for (const f of state.fighters) updateFighter(f, dt);
    separateFighters();
    updateShots(dt);
    for (const tm of state.timers) { tm.t -= dt; if (tm.t <= 0 && !state.over) tm.fn(); }
    state.timers = state.timers.filter((tm) => tm.t > 0);

    for (const v of state.vfx) {
      v.t += dt;
      v.x += v.vx * dt;
      v.y += v.vy * dt;
      if (v.follow) { v.x = v.follow.x - v.follow.facing * (v.fdx || 0); if (v.fdy !== undefined) v.y = v.follow.y + v.fdy; }
    }
    state.vfx = state.vfx.filter((v) => v.t < v.life);
    for (const pp of state.popups) pp.t += dt;
    state.popups = state.popups.filter((pp) => pp.t < pp.life);
    for (const s of state.sparks) {
      s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 900 * dt;
    }
    state.sparks = state.sparks.filter((s) => s.t < s.life);
    for (const w of state.waves) w.t += dt;
    state.waves = state.waves.filter((w) => w.t < w.life);
    state.shake = Math.max(0, state.shake - dt * 30);

    // the camera keeps both fighters in view
    const mid = (state.p1.x + state.p2.x) / 2;
    const target = mid - W / 2;
    state.camX += (target - state.camX) * Math.min(1, dt * 5);
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

  function fighterFrame(f) {
    const a = f.kit.anims[f.anim];
    if (f.skill) return skillFrame(f.skill);
    if (f.anim === "jump") {
      // airFrames [first, last] are the airborne poses of the clip: rise, tuck, fall
      const [f0, f1] = a.airFrames || [0, a.frames - 1];
      return f0 + Math.floor(clamp(f.t / jumpAirTime(f), 0, 0.999) * (f1 - f0 + 1));
    }
    if (a.loop) return Math.floor(f.t * a.fps) % a.frames;
    if (a.playFor) return attackFrame(a, f.t);
    return Math.floor(clamp(f.t / a.duration, 0, 0.999) * a.frames);
  }

  function drawFighter(f, camX) {
    const a = f.kit.anims[f.anim];
    const frame = fighterFrame(f);
    // afterimages: recent skill poses fading out behind the fighter
    if (f.skill) {
      f.ghostT -= 1 / 60;
      if (f.ghostT <= 0) {
        const sk = f.skill, def = sk.def;
        const shadow = !!((def.dash && def.dash.shadow && sk.dashing) || (def.shadow && sk.moving));
        f.ghostT = shadow ? 0.025 : 0.035;
        f.ghosts.push({ anim: f.anim, frame, x: f.x, y: f.y, facing: f.facing, born: state.time, shadow });
      }
    }
    f.ghosts = f.ghosts.filter((g) => state.time - g.born < (g.shadow ? 0.32 : 0.16));
    for (const g of f.ghosts) {
      if (g.shadow) {
        // dark shadow copies trailing a dash
        const age = (state.time - g.born) / 0.32;
        ctx.save();
        ctx.filter = "brightness(0.12) saturate(0)";
        drawFrame(f.kit.anims[g.anim], g.frame, g.x - camX, g.y, g.facing, f.kit.scale, 0.6 * (1 - age));
        ctx.restore();
        continue;
      }
      const age = (state.time - g.born) / 0.16;
      drawFrame(f.kit.anims[g.anim], g.frame, g.x - camX, g.y, g.facing, f.kit.scale, 0.35 * (1 - age));
    }
    drawShadow(f.x - camX, GROUND_Y, 26 - Math.min(14, (GROUND_Y - f.y) / 8));
    let lift = 0;
    const ride = f.skill && f.skill.def.dash && f.skill.def.dash.ride;
    if (ride && f.skill.dashing) {
      // standing on a flying rocket: draw it under the feet, fire out the back
      lift = ride.lift || 22;
      const img = images[M.vfx[ride.key]];
      if (img) {
        const sc = ride.scale || 2;
        ctx.save();
        ctx.translate(Math.round(f.x - camX + f.facing * (ride.dx || 0)), Math.round(f.y - lift + (ride.dy == null ? 6 : ride.dy)));
        ctx.scale(f.facing * sc, ride.sy || sc);   // sy < scale: a long, thin rocket
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        ctx.restore();
      }
      if (img) addSparks(f.x + f.facing * ((ride.dx || 0) - img.width / 2 * (ride.scale || 2)), f.y - lift + (ride.dy == null ? 8 : ride.dy), 2, "#ffb02e");
    }

    // reactions: shake while stunned by a hit, tip over when knocked down, tumble in the air
    let ox = 0, rot = 0;
    if (f.hitStun > 0) ox = Math.sin(f.hitStun * 70) * 2.5;
    if (f.downT > 0) {
      const gone = f.downMax - f.downT;
      const k = gone < 0.22 ? gone / 0.22 : f.downT < 0.3 ? f.downT / 0.3 : 1;
      rot = -f.facing * (Math.PI / 2) * k;
    } else if (f.launched) {
      rot = -f.facing * clamp(-f.vy / 900, -0.6, 0.6);
    }
    const blink = f.invulnT > 0 && f.downT <= 0 && Math.floor(f.invulnT * 20) % 2 === 0 ? 0.55 : 1;
    drawFrame(a, frame, f.x - camX + ox, f.y - lift, f.facing, f.kit.scale, blink, f.flash, rot);
    if (ride && f.skill.dashing && ride.rope) {
      // the reins: a taut rope from the fists to the rocket's nose
      const [hx, hy] = ride.rope.hand, [nx, ny] = ride.rope.nose;
      const x0 = f.x - camX + f.facing * hx, y0 = f.y - lift + hy, x1 = f.x - camX + f.facing * nx, y1 = f.y - lift + ny;
      ctx.save();
      ctx.lineCap = "round";
      ctx.strokeStyle = "#3a2414"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + 6, x1, y1); ctx.stroke();
      ctx.strokeStyle = "#a8743f"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + 6, x1, y1); ctx.stroke();
      ctx.restore();
    }
  }

  function drawStunStars(camX) {
    for (const f of state.fighters) {
      if (f.stunT <= 0) continue;
      const cx = f.x - camX, cy = f.y - 120;
      for (let i = 0; i < 3; i++) {
        const a = state.time * 5 + (i * Math.PI * 2) / 3;
        const x = cx + Math.cos(a) * 22, y = cy + Math.sin(a) * 5;
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
        ctx.fillStyle = pp.color || (pp.enemy ? "#ff8a80" : pp.skill ? "#ffb347" : "#ffffff");
        ctx.fillText(pp.amount, 0, 0);
        ctx.restore();
      }
    }
  }

  // Swing trail: a flattened crescent in front of the fighter that sweeps with the weapon.
  const SLASH_STYLE = [
    { r: 46, w: 7, core: "rgba(255,248,225,0.95)", glow: "rgba(255,240,200,0.35)" },
    { r: 56, w: 11, core: "rgba(255,226,120,0.95)", glow: "rgba(255,120,40,0.45)" },
    { r: 66, w: 15, core: "rgba(255,236,140,1)", glow: "rgba(255,60,30,0.55)" },
  ];

  function drawSlash(f, camX) {
    if (f.combo < 0 || curAttack(f).shot) return;    // throws show their projectile, not a swing trail
    const a = f.kit.anims[f.anim];
    const k = clamp(f.t / a.duration, 0, 1);
    const start = a.playFor * 0.25;            // swing begins after the wind-up frame
    const strike = a.playFor;                  // trail completes on the strike frame
    if (k < start) return;
    const sweep = clamp((k - start) / (strike - start), 0, 1);
    const fade = k > strike ? 1 - (k - strike) / (1 - strike) : 1;
    if (fade <= 0) return;

    const sw = curAttack(f);
    if (sw.punch) {
      // punches: short speed lines shooting out from the fist instead of a swing arc
      const cols = ["rgba(255,248,225,0.9)", "rgba(255,214,120,0.95)", "rgba(255,150,60,1)"];
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.strokeStyle = cols[sw.power];
      ctx.lineCap = "round";
      const reachPx = 34 + sw.power * 16;
      const x0 = f.x - camX + f.facing * 18, len = reachPx * sweep;
      const lift = f.air ? 40 : 62;
      [[-8, 2], [0, 3 + sw.power], [8, 2]].forEach(([dy, w], i) => {
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(Math.round(x0 + f.facing * i * 4), Math.round(f.y - lift + dy));
        ctx.lineTo(Math.round(x0 + f.facing * (len - i * 6)), Math.round(f.y - lift + dy));
        ctx.stroke();
      });
      if (sweep >= 1) {
        ctx.fillStyle = cols[sw.power];
        ctx.beginPath();
        ctx.arc(Math.round(x0 + f.facing * len), Math.round(f.y - lift), 5 + sw.power * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      return;
    }
    const st = SLASH_STYLE[sw.plunge ? 1 : sw.power];
    const cx = f.x - camX + f.facing * 22;
    const cy = f.y - (f.air ? 40 : 58);
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
    ctx.scale(f.facing, sw.plunge ? 0.9 : sw.spin ? 0.55 : 0.42);
    ctx.lineCap = "round";
    ctx.globalAlpha = fade;
    const steps = 10;
    for (let i = 0; i < steps; i++) {
      // thicker and brighter toward the leading edge
      const u0 = from + ((a1 - from) * i) / steps;
      const u1 = from + ((a1 - from) * (i + 1)) / steps;
      const w = (i + 1) / steps;
      ctx.beginPath();
      ctx.arc(0, 0, st.r, u0, u1);
      ctx.strokeStyle = st.glow;
      ctx.lineWidth = st.w * w * 2.2;
      ctx.stroke();
      ctx.strokeStyle = st.core;
      ctx.lineWidth = st.w * w;
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

  // Effects are PixelLab sprite sheets (M.vfxAnim) played frame by frame, with a little
  // scale/fade tweening on top; keys without a sheet fall back to the still image.
  function drawVfx(camX, layer) {
    for (const v of state.vfx) {
      if (!!v.back !== (layer === "back")) continue;
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
      alpha *= v.opacity ?? 1;
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
    for (const s of state.shots) {
      const img = images[M.vfx[s.def.fx]];
      if (s.def.straight) {
        // a spear: no spin, pointing the way it flies, with a bright additive pass
        ctx.save();
        ctx.translate(Math.round(s.x - camX), Math.round(s.y));
        ctx.scale(s.dir * (s.def.scale || 1), s.def.scale || 1);
        if (s.def.spin) ctx.rotate(s.rot);
        else if (s.angle) ctx.rotate(s.angle);
        if (s.def.hoop) ctx.rotate(Math.sin(s.rot * 0.45) * 0.12);   // a flat ring of rockets: rocks and shudders as it whirls
        if (s.def.wobble) ctx.scale(1, 0.55 + 0.45 * Math.abs(Math.cos(s.rot * 0.9)));   // spinning on its long axis
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.45;
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        ctx.restore();
        continue;
      }
      ctx.save();
      ctx.translate(Math.round(s.x - camX), Math.round(s.y));
      ctx.rotate(s.rot * s.dir);
      ctx.drawImage(img, -img.width * 0.35, -img.height * 0.35, img.width * 0.7, img.height * 0.7);
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.35;
      ctx.drawImage(img, -img.width * 0.35, -img.height * 0.35, img.width * 0.7, img.height * 0.7);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      // the thrown weapon itself spinning in the middle of the effect
      ctx.fillStyle = "#7a3a1c";
      ctx.fillRect(-18, -3, 36, 6);
      ctx.fillStyle = "#b8653a";
      ctx.fillRect(-18, -3, 36, 2);
      ctx.restore();
    }
  }

  function drawBanners(camX) {
    for (const b of state.banners) {
      const f = b.owner;
      const k = b.t / b.life;
      const pop = k < 0.12 ? 0.7 + (k / 0.12) * 0.4 : k < 0.2 ? 1.1 - ((k - 0.12) / 0.08) * 0.1 : 1;
      const alpha = k > 0.8 ? 1 - (k - 0.8) / 0.2 : 1;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(Math.round(f.x - camX), Math.round(f.y - 128 - k * 8));
      ctx.scale(pop, pop);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = (b.ult ? "800 22px" : "600 17px") + " 'Kanit', 'Noto Sans Thai', sans-serif";
      if (b.ult) {
        const w = ctx.measureText(b.text).width + 34;
        ctx.fillStyle = f.ctrl === "human" ? "rgba(120, 10, 10, 0.75)" : "rgba(40, 10, 90, 0.78)";
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
      ctx.fillStyle = b.ult ? "#fff1b0" : f.ctrl === "human" ? "#ffd23f" : "#c9b6ff";
      ctx.fillText(b.text, 0, 1);
      ctx.restore();
    }
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
    const p = state.p1;
    const size = 30, gap = 6;
    const x0 = 10, y0 = H - size - 10;
    const keysLbl = ["U", "I", "O"];
    for (let i = 0; i < 3; i++) {
      const def = p1Kit.c.skills[p.loadout[i]];
      if (!def) continue;
      const x = x0 + i * (size + gap);
      ctx.fillStyle = "rgba(18,13,28,0.75)";
      ctx.fillRect(x - 2, y0 - 2, size + 4, size + 4);
      const img = images[M.vfx[def.icon]];
      if (img) {
        const s = Math.min(size / img.width, size / img.height);
        ctx.drawImage(img, x + (size - img.width * s) / 2, y0 + (size - img.height * s) / 2, img.width * s, img.height * s);
      }
      const cd = p.cooldowns[i];
      if (cd > 0) {
        const frac = cd / def.cd;
        ctx.save();
        ctx.beginPath(); ctx.rect(x, y0, size, size); ctx.clip();
        ctx.fillStyle = "rgba(10,6,18,0.7)";
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

  // one side of the HUD: portrait, name, HP bar (with a trailing damage bar), combo counter
  function drawFighterHud(f, side) {
    const right = side === "right";
    const pimg = images[f.kit.portrait];
    const pc = f.kit.c.portrait.crop;
    const px = right ? W - 52 : 8;
    ctx.fillStyle = "#120d1c";
    ctx.fillRect(px, 8, 44, 44);
    ctx.save();
    if (right) {
      // mirror the right portrait so both fighters look toward the middle
      ctx.translate(px + 2 + 40, 10);
      ctx.scale(-1, 1);
      ctx.drawImage(pimg, pc.x, pc.y, pc.w, pc.h, 0, 0, 40, 40);
    } else {
      ctx.drawImage(pimg, pc.x, pc.y, pc.w, pc.h, px + 2, 10, 40, 40);
    }
    ctx.restore();
    ctx.strokeStyle = right ? "#9b8cff" : "#ffd23f";
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, 9, 42, 42);

    const bw = Math.min(200, W / 2 - 90), bh = 10;
    const bx = right ? W - 58 - bw : 58, by = 25;
    ctx.font = "10px 'Silkscreen', monospace";
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = right ? "right" : "left";
    ctx.fillStyle = "#f3e9d2";
    ctx.fillText(f.kit.c.hudName, right ? bx + bw : bx, 20);
    ctx.font = "8px 'Silkscreen', monospace";
    ctx.fillStyle = right ? "#c9b6ff" : "#ffd23f";
    ctx.fillText(f.ctrl === "human" ? "YOU" : "CPU", right ? bx + bw : bx, 47);

    ctx.fillStyle = "#120d1c";
    ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
    ctx.fillStyle = "#3a2240";
    ctx.fillRect(bx, by, bw, bh);
    const frac = f.hp / f.maxHp, shown = f.shownHp / f.maxHp;
    // bars drain toward the middle of the screen
    const fill = (fr, color) => {
      const w = Math.round(bw * fr);
      ctx.fillStyle = color;
      ctx.fillRect(right ? bx : bx + bw - w, by, w, bh);
    };
    fill(shown, "#f2f2f2");
    fill(frac, frac > 0.3 ? "#4cc96f" : "#e4483f");
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(bx, by, bw, 2);

    if (f.comboCount > 1) {
      const pulse = 1 + Math.max(0, f.comboTimer - 1.4) * 1.5;
      ctx.save();
      ctx.translate(right ? W - 14 : 14, 82);
      ctx.scale(pulse, pulse);
      ctx.textAlign = right ? "right" : "left";
      ctx.font = "22px 'Silkscreen', monospace";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#120d1c";
      ctx.strokeText(f.comboCount, 0, 0);
      ctx.fillStyle = right ? "#c9b6ff" : "#ffd23f";
      ctx.fillText(f.comboCount, 0, 0);
      ctx.font = "9px 'Silkscreen', monospace";
      ctx.lineWidth = 3;
      ctx.strokeText("HITS", 0, 12);
      ctx.fillStyle = "#f3e9d2";
      ctx.fillText("HITS", 0, 12);
      ctx.restore();
    }
  }

  function drawCenterText(big, small, color) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "32px 'Silkscreen', monospace";
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#120d1c";
    ctx.strokeText(big, W / 2, H / 2 - 20);
    ctx.fillStyle = color;
    ctx.fillText(big, W / 2, H / 2 - 20);
    if (small) {
      ctx.font = "10px 'Silkscreen', monospace";
      ctx.lineWidth = 3;
      ctx.strokeText(small, W / 2, H / 2 + 12);
      ctx.fillStyle = "#f3e9d2";
      ctx.fillText(small, W / 2, H / 2 + 12);
    }
    ctx.restore();
  }

  function drawHud() {
    drawFighterHud(state.p1, "left");
    drawFighterHud(state.p2, "right");

    // combo pips for your fighter and the combo ring on the phone attack button
    const p = state.p1;
    const step = p.combo >= 0 ? p.combo : (p.sinceAttack < COMBO_WINDOW ? p.lastCombo : -1);
    const pipCount = p.combo >= 0 ? attacksOf(p).length : p.kit.c.combo.length;
    if (atkBtn) atkBtn.style.setProperty("--combo", String((step + 1) / pipCount));
    for (let i = 0; i < pipCount; i++) {
      ctx.fillStyle = i <= step ? "#ffd23f" : "rgba(243,233,210,0.25)";
      ctx.fillRect(98 + i * 12, 42, 9, 4);
    }

    if (state.introT > 0) {
      drawCenterText(state.introT > 0.6 ? "READY" : "FIGHT!", null, "#ffd23f");
    }
    if (state.over && state.overT > 0.8) {
      ctx.fillStyle = "rgba(18, 13, 28, 0.45)";
      ctx.fillRect(0, 0, W, H);
      const won = state.winner === state.p1;
      drawCenterText(won ? "YOU WIN" : "YOU LOSE", "K.O.  ·  R = REMATCH", won ? "#ffd23f" : "#e4483f");
    } else if (state.over) {
      drawCenterText("K.O.", null, "#e4483f");
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
    // whoever is attacking draws on top
    const order = [...state.fighters].sort((a, b) => (a.skill || a.combo >= 0 ? 1 : 0) - (b.skill || b.combo >= 0 ? 1 : 0));
    for (const f of order) drawFighter(f, camX);
    drawStunStars(camX);
    drawWaves(camX);
    for (const f of state.fighters) drawSlash(f, camX);
    drawVfx(camX, "front");
    drawShots(camX);
    drawSparks(camX);
    drawBanners(camX);
    drawPopups(camX);
    ctx.restore();
    drawScreenFlash();
    drawHud();
    drawSkillBar();
    updateSkillButtons();
  }

  // ---------- loop ----------
  let last = 0;
  let loopErrors = 0;
  function frame(now) {
    // schedule the next frame first so one bad frame can never freeze the game
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    try {
      update(dt);
      render();
    } catch (err) {
      if (loopErrors++ < 3) console.error(err);
    }
  }

  fitCanvas();
  reset();
  // read-only handle for automated tests and debugging in the console
  window.__komfaek = { get state() { return state; } };
  syncSkillButtons();
  const status = document.getElementById("status");
  loadImages()
    .then(() => finalizeAnims())
    .then(() => document.fonts?.load("16px 'Silkscreen'").catch(() => {}))
    .then(() => {
      status.hidden = true;
      requestAnimationFrame((t) => { last = t; frame(t); });
      openMenu();                   // every visit starts on the select screen
    })
    .catch((err) => { status.textContent = err.message; });
})();
