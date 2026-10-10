// เสือหาญ — the brass-knuckle boxer from เสือสั่งฟ้า. Made from characters/_template.
window.CHARACTERS = window.CHARACTERS || {};
window.CHARACTERS.suahan = {
  name: "เสือหาญ",
  hudName: "SUEA HAN",               // shown in the HP bar (pixel font: A–Z, 0–9)
  hp: 100,
  walkSpeed: 165,
  jumpVelocity: -640,
  sfx: "fist",          // hit sound: "stick" (wood/weapon crack) or "fist" (punch)

  // All sprite sheets: horizontal strips of 224x224 frames, character facing RIGHT.
  // anchorX/anchorY = the point between the feet. scale = on-screen size.
  sprite: { frameW: 224, frameH: 224, anchorX: 95, anchorY: 220, scale: 0.62 },
  portrait: { image: "sprites/portrait.png", crop: { x: 84, y: 62, w: 44, h: 44 } },

  anims: {
    idle: { image: "sprites/idle.png", fps: 9, loop: true },
    walk: { image: "sprites/walk.png", fps: 11, loop: true },
    jump: { image: "sprites/jump.png", fps: 12, bottoms: "auto", airFrames: [1, 6] },

    // 3-hit boxing combo: right, left, then a heavy right with the yant tiger
    attack1: { image: "sprites/attack1.png", duration: 0.24, playFor: 0.7, hitAt: 0.7 },
    attack2: { image: "sprites/attack2.png", duration: 0.22, playFor: 0.7, hitAt: 0.35 },
    attack3: { image: "sprites/attack3.png", duration: 0.42, playFor: 0.7, hitAt: 0.75 },

    // air: left, right, flying knee, then dive and punch the ground
    air1: { image: "sprites/air1.png", duration: 0.24, playFor: 0.7, hitAt: 0.5, bottoms: "auto" },
    air2: { image: "sprites/air2.png", duration: 0.24, playFor: 0.7, hitAt: 0.4, bottoms: "auto" },
    air3: { image: "sprites/air3.png", duration: 0.26, playFor: 0.7, hitAt: 0.5, bottoms: "auto" },
    air4: { image: "sprites/air4.png", duration: 0.42, playFor: 0.6, hitAt: 0.45, bottoms: "auto" },

    sk_strike: { image: "sprites/sk_strike.png" },
    sk_burst: { image: "sprites/sk_burst.png" },
    sk_spin: { image: "sprites/sk_spin.png" },
  },

  // brass knuckles: every row is a punch (fist sounds and speed lines)
  combo: [
    { anim: "attack1", dmg: [9, 12], crit: 0.15, kb: 24, reach: 104, dir: 1, power: 0, drift: 30, punch: true },
    { anim: "attack2", dmg: [9, 12], crit: 0.15, kb: 26, reach: 104, dir: 1, power: 0, drift: 30, punch: true },
    { anim: "attack3", dmg: [24, 32], crit: 0.32, kb: 150, reach: 116, dir: 1, power: 2, drift: 70, punch: true,
      fx: [{ key: "yanttiger", dx: 40, dy: -10, vx: 260, life: 0.55, s0: 1.3, s1: 1.8, opacity: 0.55 },
        { sparks: [[12, "#ff9a3c"], [8, "#ffe0b0"]] }] },
  ],
  airCombo: [
    { anim: "air1", dmg: [8, 11], crit: 0.18, kb: 18, reach: 104, dir: 1, power: 0, punch: true },
    { anim: "air2", dmg: [9, 12], crit: 0.2, kb: 20, reach: 104, dir: 1, power: 0, punch: true },
    { anim: "air3", dmg: [11, 14], crit: 0.2, kb: 28, reach: 100, dir: 1, power: 1, punch: true },
    { anim: "air4", dmg: [20, 28], crit: 0.3, kb: 130, reach: 116, dir: 1, power: 2, plunge: true, punch: true },
  ],

  // Skills: one example of each common shape. Effect keys must exist in assets/vfx_<key>.png
  // (shared effects: bird, naga, chakra, tiger, rocks, yama, storm).
  skills: {
    strike: {
      name: "ท่าตัวอย่าง 1", desc: "ตีไกล 1 ครั้ง", cd: 6, dur: 0.5,
      frames: [0, 0.2, 0.45], icon: "tiger", assist: 100,
      hits: [{ at: 0.45, dmg: [20, 28], reach: 150, power: 1,
        fx: [{ key: "tiger", dx: 30, vx: 380, life: 0.45, s0: 0.7, s1: 1.1 }] }],
    },
    burst: {
      name: "ท่าตัวอย่าง 2", desc: "กระแทกพื้น ศัตรูมึนงง", cd: 7, dur: 0.48,
      frames: [0, 0.2, 0.38], icon: "rocks", assist: 70,
      hits: [{ at: 0.4, dmg: [18, 24], reach: 105, power: 1, stun: 2,
        fx: [{ key: "rocks", dx: 46, at: "ground", life: 0.55, s0: 0.5, s1: 1.15, anchor: "bottom", shockwave: true }] }],
    },
    spin: {
      name: "ไม้ตายตัวอย่าง", desc: "หมุนตัวฟัน 3 ครั้ง", cd: 15, ult: true, dur: 0.95,
      frames: [0, 0.33, 0.66], loopFrames: true, icon: "storm", drift: 120, assist: 90,
      aura: { key: "storm", at: "ground", s0: 0.8, s1: 1.25, anchor: "bottom" },
      hits: [
        { at: 0.25, dmg: [16, 22], reach: 140, both: true, power: 1, fx: [{ sparks: [[14, "#e8fbff"]] }] },
        { at: 0.52, dmg: [16, 22], reach: 140, both: true, power: 1, fx: [{ sparks: [[14, "#e8fbff"]] }] },
        { at: 0.8, dmg: [22, 30], reach: 145, both: true, power: 2, fx: [{ sparks: [[14, "#e8fbff"]] }] },
      ],
    },
  },
  skillOrder: ["strike", "burst", "spin"],
  defaultLoadout: ["strike", "burst", "spin"],     // exactly 3
};
