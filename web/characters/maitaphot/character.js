// ลูกผู้ชายไม้ตะพด — the masked cane fighter. Made from characters/_template.
window.CHARACTERS = window.CHARACTERS || {};
window.CHARACTERS.maitaphot = {
  name: "ลูกผู้ชายไม้ตะพด",
  hudName: "MAI TAPHOT FIGHTER",               // shown in the HP bar (pixel font: A–Z, 0–9)
  hp: 100,
  walkSpeed: 165,
  jumpVelocity: -640,
  sfx: "stick",          // hit sound: "stick" (wood/weapon crack) or "fist" (punch)

  // All sprite sheets: horizontal strips of 224x224 frames, character facing RIGHT.
  // anchorX/anchorY = the point between the feet. scale = on-screen size.
  sprite: { frameW: 224, frameH: 224, anchorX: 95, anchorY: 220, scale: 0.62 },
  portrait: { image: "sprites/portrait.png", crop: { x: 80, y: 68, w: 44, h: 44 } },

  anims: {
    idle: { image: "sprites/idle.png", fps: 8, loop: true },
    walk: { image: "sprites/walk.png", fps: 11, loop: true },
    jump: { image: "sprites/jump.png", fps: 12, bottoms: "auto", airFrames: [1, 6] },

    // 4-hit cane combo: swing left→right, backhand right→left, straight thrust, energy wave
    attack1: { image: "sprites/attack1.png", duration: 0.26, playFor: 0.7, hitAt: 0.55 },
    attack2: { image: "sprites/attack2.png", duration: 0.26, playFor: 0.7, hitAt: 0.6 },
    attack3: { image: "sprites/attack3.png", duration: 0.3, playFor: 0.7, hitAt: 0.65 },
    attack4: { image: "sprites/attack4.png", duration: 0.42, playFor: 0.7, hitAt: 0.7 },

    // air: swing left, swing right, overhead smash into the ground
    air1: { image: "sprites/air1.png", duration: 0.28, playFor: 0.7, hitAt: 0.55, bottoms: "auto" },
    air2: { image: "sprites/air2.png", duration: 0.28, playFor: 0.7, hitAt: 0.5, bottoms: "auto" },
    air3: { image: "sprites/air3.png", duration: 0.42, playFor: 0.6, hitAt: 0.45, bottoms: "auto" },

    sk_strike: { image: "sprites/sk_strike.png" },
    sk_burst: { image: "sprites/sk_burst.png" },
    sk_spin: { image: "sprites/sk_spin.png" },
  },

  // the 4th hit releases a crescent of energy from the cane; the wave does the damage
  combo: [
    { anim: "attack1", dmg: [9, 12], crit: 0.15, kb: 26, reach: 112, dir: 1, power: 0, drift: 30 },
    { anim: "attack2", dmg: [10, 13], crit: 0.15, kb: 30, reach: 112, dir: -1, power: 0, drift: 30 },
    { anim: "attack3", dmg: [12, 16], crit: 0.18, kb: 44, reach: 124, dir: 1, power: 1, drift: 50 },
    { anim: "attack4", dmg: [0, 0], reach: 0, dir: 1, power: 2, drift: 10,
      shot: { fx: "taphotwave", straight: true, range: 340, speed: 900, scale: 1.1, muzzle: [70, -68], sound: "swing",
        trail: "#ff3d6e", flash: "#ff9ab8", dmg: [22, 30], power: 2, kb: 150, crit: 0.3, sparkColor: "#ff3d6e", sparkColor2: "#ffd0dc" } },
  ],
  airCombo: [
    { anim: "air1", dmg: [10, 13], crit: 0.18, kb: 20, reach: 108, dir: 1, power: 0 },
    { anim: "air2", dmg: [11, 14], crit: 0.2, kb: 24, reach: 108, dir: -1, power: 1 },
    { anim: "air3", dmg: [22, 30], crit: 0.3, kb: 130, reach: 116, dir: 1, power: 2, plunge: true },
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
