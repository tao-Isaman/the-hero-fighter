// นางเสือ (Nang Suea, the Tiger Lady) from ป่านางเสือ — tiger-claw fighter. Made from characters/_template.
window.CHARACTERS = window.CHARACTERS || {};
window.CHARACTERS.nangsuea = {
  name: "นางเสือ",
  hudName: "NANG SUEA",
  hp: 100,
  walkSpeed: 190,
  jumpVelocity: -680,
  sfx: "claw",

  sprite: { frameW: 224, frameH: 224, anchorX: 95, anchorY: 220, scale: 0.62 },
  portrait: { image: "sprites/portrait.png", crop: { x: 86, y: 58, w: 48, h: 48 } },

  anims: {
    idle: { image: "sprites/idle.png", fps: 9, loop: true },
    walk: { image: "sprites/walk.png", fps: 13, loop: true },
    jump: { image: "sprites/jump.png", fps: 12, bottoms: "auto", airFrames: [1, 6] },

    // 4-hit claw combo: left, right, heavy left, two-handed X
    attack1: { image: "sprites/attack1.png", duration: 0.24, playFor: 0.7, hitAt: 0.45 },
    attack2: { image: "sprites/attack2.png", duration: 0.24, playFor: 0.7, hitAt: 0.5 },
    attack3: { image: "sprites/attack3.png", duration: 0.32, playFor: 0.7, hitAt: 0.55 },
    attack4: { image: "sprites/attack4.png", duration: 0.42, playFor: 0.7, hitAt: 0.5 },

    // air: left claw, right claw, then warp behind and kick
    air1: { image: "sprites/air1.png", duration: 0.26, playFor: 0.7, hitAt: 0.35, bottoms: "auto" },
    air2: { image: "sprites/air2.png", duration: 0.26, playFor: 0.7, hitAt: 0.45, bottoms: "auto" },
    air3: { image: "sprites/air3.png", duration: 0.36, playFor: 0.7, hitAt: 0.5, bottoms: "auto" },

    sk_pounce: { image: "sprites/sk_pounce.png" },
    sk_shadow: { image: "sprites/sk_shadow.png" },
    sk_frenzy: { image: "sprites/sk_frenzy.png" },
  },

  // fx on a combo row spawns when the strike lands (or whiffs): claw marks
  combo: [
    { anim: "attack1", dmg: [8, 11], crit: 0.18, kb: 22, reach: 104, dir: 1, power: 0, drift: 35,
      fx: [{ key: "claw", dx: 54, dy: -8, life: 0.24, s0: 0.65, s1: 0.9 }] },
    { anim: "attack2", dmg: [9, 12], crit: 0.18, kb: 24, reach: 106, dir: -1, power: 0, drift: 35,
      fx: [{ key: "claw", dx: 54, dy: -4, life: 0.24, s0: 0.65, s1: 0.9, rot: 0.5 }] },
    { anim: "attack3", dmg: [13, 17], crit: 0.22, kb: 50, reach: 112, dir: 1, power: 1, drift: 70,
      fx: [{ key: "clawheavy", dx: 58, dy: -10, life: 0.3, s0: 0.8, s1: 1.1, rot: -0.3 }] },
    { anim: "attack4", dmg: [24, 32], crit: 0.32, kb: 140, reach: 116, dir: 1, power: 2, drift: 50,
      fx: [{ key: "clawx", dx: 56, dy: -8, life: 0.36, s0: 0.8, s1: 1.25 }, { sparks: [[12, "#ffb02e"], [8, "#fff2c4"]] }] },
  ],
  airCombo: [
    { anim: "air1", dmg: [9, 12], crit: 0.2, kb: 18, reach: 108, dir: 1, power: 0,
      fx: [{ key: "claw", dx: 50, dy: 4, life: 0.24, s0: 0.6, s1: 0.85 }] },
    { anim: "air2", dmg: [9, 12], crit: 0.2, kb: 20, reach: 108, dir: -1, power: 1,
      fx: [{ key: "claw", dx: 50, dy: 0, life: 0.24, s0: 0.6, s1: 0.85, rot: 0.5 }] },
    { anim: "air3", dmg: [18, 24], crit: 0.3, kb: 130, reach: 116, dir: 1, power: 2,
      blink: { behind: 58, range: 320,
        fxOut: [{ sparks: [[10, "#ffb02e"], [6, "#2a1a10"]] }],
        fxIn: [{ key: "clawheavy", dx: -10, life: 0.2, s0: 0.4, s1: 0.7, opacity: 0.8 }, { sparks: [[10, "#ffb02e"]] }] } },
  ],

  // Placeholder skills built from her combo frames until the real ones are made.
  skills: {
    pounce: {
      name: "พยัคฆ์ตะครุบ", desc: "พุ่งตะปบแรง ศัตรูกระเด็น (ท่าชั่วคราว)", cd: 6, dur: 0.5,
      frames: [0, 0.3, 0.55], icon: "clawheavy", assist: 150, drift: 220,
      hits: [{ at: 0.55, dmg: [26, 34], reach: 120, power: 2, kb: 150, sparkColor: "#ffb02e",
        fx: [{ key: "clawheavy", dx: 56, life: 0.3, s0: 0.8, s1: 1.2 }] }],
    },
    shadow: {
      name: "เงาพยัคฆ์", desc: "วาร์ปไปหลังศัตรูแล้วข่วน (ท่าชั่วคราว)", cd: 7, dur: 0.45,
      frames: [0, 0.3, 0.55], icon: "claw",
      blink: { at: 0.12, behind: 60, range: 420, fx: [{ sparks: [[10, "#ffb02e"]] }] },
      hits: [{ at: 0.55, dmg: [22, 28], reach: 108, power: 1, kb: 70, crit: 0.35, sparkColor: "#ffb02e",
        fx: [{ key: "claw", dx: 50, life: 0.25, s0: 0.7, s1: 1 }] }],
    },
    frenzy: {
      name: "กรงเล็บคลั่ง", desc: "ไม้ตาย ข่วนรัว 4 ครั้ง (ท่าชั่วคราว)", cd: 15, ult: true, dur: 0.9,
      frames: [0, 0.33, 0.66], loopFrames: true, icon: "clawx", drift: 120, assist: 90,
      hits: [0.2, 0.42, 0.64, 0.86].map((at, i) => ({
        at, dmg: i === 3 ? [24, 32] : [14, 18], reach: 125, both: true, power: i === 3 ? 2 : 1, sparkColor: "#ffb02e",
        fx: [{ key: i % 2 ? "clawx" : "clawheavy", dx: 50, life: 0.25, s0: 0.8, s1: 1.1 }],
      })),
    },
  },
  skillOrder: ["pounce", "shadow", "frenzy"],
  defaultLoadout: ["pounce", "shadow", "frenzy"],
};
