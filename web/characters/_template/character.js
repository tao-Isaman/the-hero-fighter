// TEMPLATE — copy with: python3 tools/new_character.py <id> "<ชื่อไทย>" "<HUD NAME>"
// Then replace the sprites in characters/<id>/sprites/ and tune the numbers below.
// Field reference: characters/README.md. A complete working example: characters/kan/character.js
window.CHARACTERS = window.CHARACTERS || {};
window.CHARACTERS.__ID__ = {
  name: "__NAME__",
  hudName: "__HUD__",               // shown in the HP bar (pixel font: A–Z, 0–9)
  hp: 100,
  walkSpeed: 165,
  jumpVelocity: -640,

  // All sprite sheets: horizontal strips of 224x224 frames, character facing RIGHT.
  // anchorX/anchorY = the point between the feet. scale = on-screen size.
  sprite: { frameW: 224, frameH: 224, anchorX: 95, anchorY: 220, scale: 0.62 },
  portrait: { image: "sprites/portrait.png", crop: { x: 92, y: 50, w: 120, h: 120 } },

  anims: {
    // required
    idle: { image: "sprites/idle.png", fps: 8, loop: true },
    walk: { image: "sprites/walk.png", fps: 12, loop: true },
    jump: { image: "sprites/jump.png", fps: 12, bottoms: "auto", airFrames: [2, 6] },
    attack1: { image: "sprites/attack1.png", duration: 0.30, playFor: 0.7, hitAt: 0.525 },
    attack2: { image: "sprites/attack2.png", duration: 0.30, playFor: 0.7, hitAt: 0.35 },
    attack3: { image: "sprites/attack3.png", duration: 0.36, playFor: 0.7, hitAt: 0.525 },
    attack4: { image: "sprites/attack4.png", duration: 0.36, playFor: 0.7, hitAt: 0.35 },
    attack5: { image: "sprites/attack5.png", duration: 0.50, playFor: 0.7, hitAt: 0.525 },
    air1: { image: "sprites/air1.png", duration: 0.30, playFor: 0.7, hitAt: 0.525, anchorY: 166 },
    air2: { image: "sprites/air2.png", duration: 0.30, playFor: 0.7, hitAt: 0.35, anchorY: 166 },
    air3: { image: "sprites/air3.png", duration: 0.42, playFor: 0.6, hitAt: 0.45, bottoms: "auto" },
    // one clip per skill, named sk_<skill id>
    sk_strike: { image: "sprites/sk_strike.png" },
    sk_burst: { image: "sprites/sk_burst.png" },
    sk_spin: { image: "sprites/sk_spin.png" },
  },

  // Ground combo (any length; the HUD pips follow it). dir +1 = left→right, -1 = right→left.
  combo: [
    { anim: "attack1", dmg: [9, 13], crit: 0.15, kb: 30, reach: 96, dir: 1, power: 0, drift: 25 },
    { anim: "attack2", dmg: [10, 14], crit: 0.15, kb: 34, reach: 90, dir: -1, power: 0, drift: 25 },
    { anim: "attack3", dmg: [12, 16], crit: 0.18, kb: 44, reach: 104, dir: 1, power: 1, drift: 25 },
    { anim: "attack4", dmg: [14, 19], crit: 0.2, kb: 52, reach: 98, dir: -1, power: 1, drift: 70 },
    { anim: "attack5", dmg: [24, 32], crit: 0.35, kb: 140, reach: 118, dir: 1, power: 2, drift: 40, spin: true },
  ],
  airCombo: [
    { anim: "air1", dmg: [10, 14], crit: 0.18, kb: 20, reach: 98, dir: 1, power: 0 },
    { anim: "air2", dmg: [11, 15], crit: 0.2, kb: 24, reach: 94, dir: -1, power: 1 },
    { anim: "air3", dmg: [22, 30], crit: 0.3, kb: 130, reach: 112, dir: 1, power: 2, plunge: true },
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
