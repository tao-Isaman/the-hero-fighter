// ลูกผู้ชายพันธุ์ดี — the golden-lightning hero. Made from characters/_template.
window.CHARACTERS = window.CHARACTERS || {};
window.CHARACTERS.lukphuchai = {
  name: "ลูกผู้ชายพันธุ์ดี",
  hudName: "LUK PHU CHAI",
  hp: 100,
  walkSpeed: 180,
  jumpVelocity: -670,
  sfx: "fist",

  sprite: { frameW: 224, frameH: 224, anchorX: 95, anchorY: 220, scale: 0.62 },
  portrait: { image: "sprites/portrait.png", crop: { x: 80, y: 60, w: 48, h: 48 } },

  anims: {
    idle: { image: "sprites/idle.png", fps: 9, loop: true },
    walk: { image: "sprites/walk.png", fps: 12, loop: true },
    jump: { image: "sprites/jump.png", fps: 12, bottoms: "auto", airFrames: [0, 6] },

    // 3-hit combo: right punch, left kick, golden-lightning right punch
    attack1: { image: "sprites/attack1.png", duration: 0.26, playFor: 0.7, hitAt: 0.42 },
    attack2: { image: "sprites/attack2.png", duration: 0.32, playFor: 0.7, hitAt: 0.42 },
    attack3: { image: "sprites/attack3.png", duration: 0.46, playFor: 0.7, hitAt: 0.5 },

    // air: left kick, right kick, left knee, 45-degree diving ground punch
    air1: { image: "sprites/air1.png", duration: 0.26, playFor: 0.7, hitAt: 0.45, bottoms: "auto" },
    air2: { image: "sprites/air2.png", duration: 0.26, playFor: 0.7, hitAt: 0.5, bottoms: "auto" },
    air3: { image: "sprites/air3.png", duration: 0.26, playFor: 0.7, hitAt: 0.38, bottoms: "auto" },
    air4: { image: "sprites/air4.png", duration: 0.42, playFor: 0.6, hitAt: 0.45, bottoms: "auto" },

    sk_thunderfist: { image: "sprites/sk_thunderfist.png" },
    sk_bolkick: { image: "sprites/sk_bolkick.png" },
    sk_storm: { image: "sprites/sk_storm.png" },
  },

  combo: [
    { anim: "attack1", dmg: [10, 13], crit: 0.15, kb: 30, reach: 106, dir: 1, power: 0, drift: 35, punch: true },
    { anim: "attack2", dmg: [12, 15], crit: 0.18, kb: 40, reach: 118, dir: 1, power: 1, drift: 30 },
    { anim: "attack3", dmg: [26, 34], crit: 0.3, kb: 150, reach: 116, dir: 1, power: 2, drift: 80, punch: true, sfx: "zap",
      fx: [{ key: "goldbolt", dx: 70, dy: -10, life: 0.35, s0: 0.7, s1: 1.15 }, { sparks: [[14, "#ffd23f"], [8, "#fff6c4"]] }] },
  ],
  airCombo: [
    { anim: "air1", dmg: [9, 12], crit: 0.18, kb: 18, reach: 110, dir: 1, power: 0 },
    { anim: "air2", dmg: [9, 12], crit: 0.18, kb: 18, reach: 110, dir: -1, power: 0 },
    { anim: "air3", dmg: [11, 14], crit: 0.2, kb: 24, reach: 100, dir: 1, power: 1, punch: true },
    { anim: "air4", dmg: [24, 32], crit: 0.3, kb: 140, reach: 120, dir: 1, power: 2, punch: true, sfx: "zap",
      plunge: true, plungeVx: 760, plungeVy: 760,
      fx: [{ key: "goldburst", at: "ground", anchor: "bottom", dx: 30, dy: 8, life: 0.45, s0: 0.8, s1: 1.4 },
        { shockwave: true }, { sparks: [[16, "#ffd23f"], [10, "#fff6c4"]] }] },
  ],

  // Placeholder skills built from his combo frames until the real ones are made.
  skills: {
    thunderfist: {
      name: "หมัดสายฟ้าทอง", desc: "พุ่งต่อยแรง สายฟ้าทองระเบิด (ท่าชั่วคราว)", cd: 6, dur: 0.5,
      frames: [0, 0.3, 0.55], icon: "goldbolt", assist: 140, drift: 200,
      hits: [{ at: 0.55, dmg: [26, 34], reach: 120, power: 2, kb: 150, sfx: "zap", sparkColor: "#ffd23f",
        fx: [{ key: "goldbolt", dx: 70, life: 0.35, s0: 0.8, s1: 1.2 }] }],
    },
    bolkick: {
      name: "เตะฟ้าผ่า", desc: "เตะแรง ศัตรูมึน (ท่าชั่วคราว)", cd: 7, dur: 0.5,
      frames: [0, 0.3, 0.55], icon: "goldburst", assist: 100,
      hits: [{ at: 0.55, dmg: [20, 26], reach: 120, power: 1, stun: 1.6, sfx: "zap", sparkColor: "#ffd23f",
        fx: [{ key: "goldburst", dx: 70, life: 0.3, s0: 0.6, s1: 1 }] }],
    },
    storm: {
      name: "พายุสายฟ้าทอง", desc: "ไม้ตาย ต่อยรัว 4 ครั้ง สายฟ้าทองแตกกระจาย (ท่าชั่วคราว)", cd: 15, ult: true, dur: 0.9,
      frames: [0, 0.33, 0.66], loopFrames: true, icon: "goldbolt", drift: 120, assist: 90,
      hits: [0.2, 0.42, 0.64, 0.86].map((at, i) => ({
        at, dmg: i === 3 ? [26, 34] : [14, 18], reach: 125, power: i === 3 ? 2 : 1, sfx: "zap", sparkColor: "#ffd23f",
        fx: [{ key: i % 2 ? "goldburst" : "goldbolt", dx: 70, life: 0.25, s0: 0.7, s1: 1.1 }],
      })),
    },
  },
  skillOrder: ["thunderfist", "bolkick", "storm"],
  defaultLoadout: ["thunderfist", "bolkick", "storm"],
};
