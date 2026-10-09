// กัลป์ เกรียงไกร (Kan Kriangkrai) — the first playable fighter.
// Everything about a fighter lives in this one file: sprites, stats, combos, skills and their effects.
// To make a new fighter, copy characters/_template/ (see characters/README.md).
window.CHARACTERS = window.CHARACTERS || {};
window.CHARACTERS.kan = {
  name: "กัลป์ เกรียงไกร",
  hudName: "KAN KRIANGKRAI",          // shown in the HP bar (pixel font: A–Z, 0–9)
  hp: 100,
  walkSpeed: 165,
  jumpVelocity: -640,

  // Every sprite sheet is a horizontal strip of frameW x frameH frames, facing RIGHT.
  // anchorX/anchorY = the point between the feet in each frame. scale = size on screen.
  sprite: { frameW: 224, frameH: 224, anchorX: 95, anchorY: 220, scale: 0.62 },
  portrait: { image: "sprites/portrait.png", crop: { x: 92, y: 50, w: 120, h: 120 } },

  // Animations. Frame counts come from the image width. Options:
  //   fps + loop      looping clips (idle, walk)
  //   duration        seconds for one-shot clips
  //   playFor         attacks: frames play over this fraction of duration, then the last frame holds
  //   hitAt           attacks: fraction of duration where the hit lands
  //   anchorY         override the feet line for this clip
  //   bottoms         "auto" pins every frame by its lowest pixel (clips that move up and down
  //                   inside the frame, e.g. jumps); or a list with one value per frame
  anims: {
    idle: { image: "sprites/idle.png", fps: 8, loop: true },
    walk: { image: "sprites/walk.png", fps: 12, loop: true },
    jump: { image: "sprites/jump.png", fps: 12, bottoms: "auto", airFrames: [2, 6] },

    // 5-hit ground combo, 4 frames each: wind-up, swing, swing, strike
    attack1: { image: "sprites/attack1.png", duration: 0.30, playFor: 0.7, hitAt: 0.525 },
    attack2: { image: "sprites/attack2.png", duration: 0.30, playFor: 0.7, hitAt: 0.35 },
    attack3: { image: "sprites/attack3.png", duration: 0.36, playFor: 0.7, hitAt: 0.525 },
    attack4: { image: "sprites/attack4.png", duration: 0.36, playFor: 0.7, hitAt: 0.35 },
    attack5: { image: "sprites/attack5.png", duration: 0.50, playFor: 0.7, hitAt: 0.525 },

    // 3-hit air combo drawn from the jump's peak pose
    air1: { image: "sprites/air1.png", duration: 0.30, playFor: 0.7, hitAt: 0.525, anchorY: 166 },
    air2: { image: "sprites/air2.png", duration: 0.30, playFor: 0.7, hitAt: 0.35, anchorY: 166 },
    air3: { image: "sprites/air3.png", duration: 0.42, playFor: 0.6, hitAt: 0.45, bottoms: [166, 166, 200, 200] },

    // skills: 3 frames each, timing lives in `skills` below
    sk_wing: { image: "sprites/sk_wing.png" },
    sk_naga: { image: "sprites/sk_naga.png" },
    sk_chakra: { image: "sprites/sk_chakra.png" },
    sk_tiger: { image: "sprites/sk_tiger.png" },
    sk_quake: { image: "sprites/sk_quake.png" },
    sk_storm: { image: "sprites/sk_storm.png" },
    sk_yama: { image: "sprites/sk_yama.png", bottoms: "auto" },
  },

  // Ground combo. dir: swing direction on screen when facing right (+1 left→right, -1 right→left).
  // power: 0 normal, 1 heavy, 2 finisher (bigger trail, shake, shockwave). drift: forward slide.
  combo: [
    { anim: "attack1", dmg: [9, 13], crit: 0.15, kb: 30, reach: 96, dir: 1, power: 0, drift: 25 },
    { anim: "attack2", dmg: [10, 14], crit: 0.15, kb: 34, reach: 90, dir: -1, power: 0, drift: 25 },
    { anim: "attack3", dmg: [12, 16], crit: 0.18, kb: 44, reach: 104, dir: 1, power: 1, drift: 25 },
    { anim: "attack4", dmg: [14, 19], crit: 0.2, kb: 52, reach: 98, dir: -1, power: 1, drift: 70 },
    { anim: "attack5", dmg: [24, 32], crit: 0.35, kb: 140, reach: 118, dir: 1, power: 2, drift: 40, spin: true },
  ],
  // Air combo: slashes hang in the air; `plunge` dives and hits around the landing spot.
  airCombo: [
    { anim: "air1", dmg: [10, 14], crit: 0.18, kb: 20, reach: 98, dir: 1, power: 0 },
    { anim: "air2", dmg: [11, 15], crit: 0.2, kb: 24, reach: 94, dir: -1, power: 1 },
    { anim: "air3", dmg: [22, 30], crit: 0.3, kb: 130, reach: 112, dir: 1, power: 2, plunge: true },
  ],

  // Skills. The player equips 3. Each plays the 3-frame clip "sk_<id>".
  //   name, desc, cd (seconds), ult (ultimate: dims the stage, red button)
  //   icon        effect key used for the button picture
  //   dur         clip length in seconds; frames = start times (fraction of dur) of frames 1–3
  //   loopFrames  cycle the 3 frames fast (spins)
  //   assist      melee: dash in to this distance if the monster is a little too far
  //   drift       slide forward while casting (px/s)
  //   hits        [{ at, dmg, reach, power, both (hits behind too), knockdown (s), stun (s), fx }]
  //   aura        effect that follows the fighter for the whole cast
  //   shot        thrown projectile { fx, dmg, range, speed } that flies out and returns
  //   leap        jump-and-slam ultimate; `hit` lands when the fighter touches the ground
  // fx: list of effects to spawn. key = effect sprite (assets/vfx_<key>.png). Offsets are in
  // pixels toward the facing direction; at: "body" (chest height) or "ground".
  // Extra fields: vx, vy, life, s0/s1 (start/end scale), rot, anchor ("center" | "left" | "bottom"),
  // stretch, shockwave, sparks: [[count, color], ...]
  skills: {
    wing: {
      name: "หักปีกปักษา", desc: "ฟันซ้าย-ขวา 2 ครั้ง วิญญาณนกโฉบใส่", cd: 5, dur: 0.5,
      frames: [0, 0.16, 0.5], icon: "bird", assist: 110,
      hits: [
        { at: 0.2, dmg: [16, 22], reach: 155, power: 1,
          fx: [{ key: "bird", dx: 20, dy: -6, vx: 520, life: 0.5, s0: 0.7, s1: 1.1 }] },
        { at: 0.55, dmg: [18, 25], reach: 165, power: 1,
          fx: [{ key: "bird", dx: 10, dy: -26, vx: 600, vy: 40, life: 0.5, s0: 0.8, s1: 1.25, rot: 0.15 }] },
      ],
    },
    naga: {
      name: "นาคาพ่นไฟ", desc: "แทงระยะไกล พญานาคพ่นไฟ", cd: 7, dur: 0.62,
      frames: [0, 0.14, 0.28], icon: "naga",
      hits: [{ at: 0.3, dmg: [30, 40], reach: 280, power: 1, sparkColor: "#ff7a1a",
        fx: [{ key: "naga", dx: 28, dy: 2, life: 0.55, s0: 0.35, s1: 1.75, anchor: "left", stretch: true }] }],
    },
    chakra: {
      name: "คมจักรนารายณ์", desc: "ขว้างคมแฝกหมุนเป็นจักร ไปแล้ววนกลับ", cd: 6, dur: 0.3,
      frames: [0, 0.35, 0.7], icon: "chakra",
      shot: { at: 0.7, fx: "chakra", dmg: [26, 34], range: 300, speed: 520, sparkColor: "#7ff6ff" },
    },
    tiger: {
      name: "พยัคฆ์ล้มสิงขร", desc: "แทงแล้วฟาดเสยขึ้น ศัตรูล้ม", cd: 8, dur: 0.62,
      frames: [0, 0.3, 0.52], icon: "tiger", assist: 100,
      hits: [
        { at: 0.12, dmg: [14, 18], reach: 145, power: 1,
          fx: [{ key: "tiger", dx: 30, vx: 380, life: 0.45, s0: 0.7, s1: 1.1 }] },
        { at: 0.56, dmg: [22, 30], reach: 135, power: 2, knockdown: 1.4,
          fx: [{ key: "tiger", dx: 30, dy: 10, vx: 160, vy: -360, life: 0.5, s0: 0.8, s1: 1.2, rot: -0.7 }] },
      ],
    },
    quake: {
      name: "สะท้านบรรพต", desc: "กระแทกระยะประชิด ศัตรูมึนงง", cd: 7, dur: 0.48,
      frames: [0, 0.2, 0.38], icon: "rocks", assist: 70,
      hits: [{ at: 0.4, dmg: [18, 24], reach: 105, power: 1, stun: 2.2,
        fx: [{ key: "rocks", dx: 46, at: "ground", life: 0.55, s0: 0.5, s1: 1.15, anchor: "bottom", shockwave: true }] }],
    },
    yama: {
      name: "พญายมข่มธรณี", desc: "ไม้ตาย กระโดดฟาดพื้น ระเบิดแดง ศัตรูล้ม", cd: 16, ult: true,
      icon: "yama", leap: true,
      hit: { dmg: [60, 80], reach: 160, power: 2, knockdown: 1.8, crit: 0.4, redFlash: true,
        sparkColor: "#ff3b2f", sparkColor2: "#ffd23f",
        fx: [{ key: "yama", dx: 34, at: "ground", life: 0.9, s0: 0.5, s1: 1.7, anchor: "bottom", shockwave: true,
          sparks: [[14, "#ff3b2f"], [14, "#ffb02e"], [14, "#ff3b2f"]] }] },
    },
    storm: {
      name: "อัคคีสาดแสง", desc: "ไม้ตาย หมุนตัวฟัน 3 ครั้ง พายุลมขาวฟ้า", cd: 15, ult: true, dur: 0.95,
      frames: [0, 0.33, 0.66], loopFrames: true, icon: "storm", drift: 120, assist: 90,
      aura: { key: "storm", at: "ground", s0: 0.8, s1: 1.25, anchor: "bottom" },
      hits: [
        { at: 0.25, dmg: [16, 22], reach: 140, both: true, power: 1, sparkColor: "#e8fbff", sparkColor2: "#ff9a3c",
          fx: [{ sparks: [[14, "#e8fbff"], [8, "#ff9a3c"]] }] },
        { at: 0.52, dmg: [16, 22], reach: 140, both: true, power: 1, sparkColor: "#e8fbff", sparkColor2: "#ff9a3c",
          fx: [{ sparks: [[14, "#e8fbff"], [8, "#ff9a3c"]] }] },
        { at: 0.8, dmg: [22, 30], reach: 145, both: true, power: 2, sparkColor: "#e8fbff", sparkColor2: "#ff9a3c",
          fx: [{ sparks: [[14, "#e8fbff"], [8, "#ff9a3c"]] }] },
      ],
    },
  },
  skillOrder: ["wing", "naga", "chakra", "tiger", "quake", "yama", "storm"],
  defaultLoadout: ["wing", "naga", "yama"],
};
