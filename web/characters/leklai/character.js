// มนุษย์เหล็กไหล (Lek Lai Man) — the fast one: quick hands, knees and kicks. Made from characters/_template.
window.CHARACTERS = window.CHARACTERS || {};
window.CHARACTERS.leklai = {
  name: "มนุษย์เหล็กไหล",
  hudName: "LEK LAI MAN",
  hp: 95,
  walkSpeed: 205,
  jumpVelocity: -690,
  sfx: "fist",

  sprite: { frameW: 224, frameH: 224, anchorX: 95, anchorY: 220, scale: 0.62 },
  portrait: { image: "sprites/portrait.png", crop: { x: 80, y: 58, w: 56, h: 56 } },

  anims: {
    idle: { image: "sprites/idle.png", fps: 10, loop: true },
    walk: { image: "sprites/walk.png", fps: 14, loop: true },
    jump: { image: "sprites/jump.png", fps: 12, bottoms: "auto", airFrames: [1, 6] },

    // 6-hit combo: left jab, right straight, right knee, left knee, left kick, jumping spin kick
    attack1: { image: "sprites/attack1.png", duration: 0.2, playFor: 0.7, hitAt: 0.25 },
    attack2: { image: "sprites/attack2.png", duration: 0.22, playFor: 0.7, hitAt: 0.35 },
    attack3: { image: "sprites/attack3.png", duration: 0.26, playFor: 0.7, hitAt: 0.4 },
    attack4: { image: "sprites/attack4.png", duration: 0.26, playFor: 0.7, hitAt: 0.5 },
    attack5: { image: "sprites/attack5.png", duration: 0.3, playFor: 0.7, hitAt: 0.42 },
    attack6: { image: "sprites/attack6.png", duration: 0.62, playFor: 0.9, hitAt: 0.5 },

    // air: left, right, left, spinning right — no ground slam
    air1: { image: "sprites/air1.png", duration: 0.24, playFor: 0.7, hitAt: 0.3, bottoms: "auto" },
    air2: { image: "sprites/air2.png", duration: 0.24, playFor: 0.7, hitAt: 0.4, bottoms: "auto" },
    air4: { image: "sprites/air4.png", duration: 0.34, playFor: 0.7, hitAt: 0.55, bottoms: "auto" },

    sk_ironfist: { image: "sprites/sk_ironfist.png" },
    sk_thunderkick: { image: "sprites/sk_thunderkick.png" },
    sk_tornado: { image: "sprites/sk_tornado.png" },
  },

  combo: [
    { anim: "attack1", dmg: [6, 8], crit: 0.15, kb: 18, reach: 102, dir: 1, power: 0, drift: 40, punch: true },
    { anim: "attack2", dmg: [7, 9], crit: 0.15, kb: 20, reach: 104, dir: 1, power: 0, drift: 40, punch: true },
    { anim: "attack3", dmg: [8, 11], crit: 0.18, kb: 24, reach: 96, dir: 1, power: 0, drift: 50, punch: true },
    { anim: "attack4", dmg: [8, 11], crit: 0.18, kb: 26, reach: 96, dir: 1, power: 1, drift: 50, punch: true },
    { anim: "attack5", dmg: [10, 13], crit: 0.2, kb: 40, reach: 118, dir: 1, power: 1, drift: 30 },
    { anim: "attack6", dmg: [20, 27], crit: 0.3, kb: 150, reach: 124, dir: 1, power: 2, drift: 90, spin: true },
  ],
  airCombo: [
    { anim: "air1", dmg: [7, 10], crit: 0.18, kb: 16, reach: 110, dir: 1, power: 0 },
    { anim: "air2", dmg: [7, 10], crit: 0.18, kb: 16, reach: 110, dir: -1, power: 0 },
    { anim: "air1", dmg: [8, 11], crit: 0.2, kb: 20, reach: 110, dir: 1, power: 1 },
    { anim: "air4", dmg: [16, 22], crit: 0.3, kb: 120, reach: 118, dir: -1, power: 2 },
  ],

  // Placeholder skills built from his own combo frames until the real ones are made.
  skills: {
    ironfist: {
      name: "หมัดเหล็กไหล", desc: "หมัดรัวเร็ว 3 ครั้ง (ท่าชั่วคราว)", cd: 5, dur: 0.5,
      frames: [0, 0.33, 0.66], loopFrames: true, icon: "fists", assist: 90,
      hits: [0.2, 0.45, 0.7].map((at, i) => ({
        at, dmg: [9, 12], reach: 112, power: i === 2 ? 1 : 0, kb: 20, sparkColor: "#bfe9ff",
        fx: [{ key: "fists", dx: 48, life: 0.22, s0: 0.8, s1: 1 }],
      })),
    },
    thunderkick: {
      name: "ลูกเตะสายฟ้า", desc: "พุ่งเตะไกล ศัตรูกระเด็น (ท่าชั่วคราว)", cd: 7, dur: 0.5,
      frames: [0, 0.25, 0.45], icon: "blades", assist: 130, drift: 260,
      hits: [{ at: 0.45, dmg: [26, 34], reach: 140, power: 2, kb: 160, sparkColor: "#7ff6ff",
        fx: [{ key: "blades", dx: 50, life: 0.35, s0: 0.8, s1: 1.2 }, { shockwave: true }] }],
    },
    tornado: {
      name: "พายุเหล็กไหล", desc: "ไม้ตาย หมุนตัวเตะกลางอากาศ 3 ครั้ง (ท่าชั่วคราว)", cd: 15, ult: true, dur: 0.9,
      frames: [0, 0.33, 0.66], loopFrames: true, icon: "storm", drift: 140, assist: 90,
      aura: { key: "storm", at: "ground", s0: 0.8, s1: 1.2, anchor: "bottom" },
      hits: [0.25, 0.52, 0.8].map((at, i) => ({
        at, dmg: i === 2 ? [24, 32] : [16, 22], reach: 140, both: true, power: i === 2 ? 2 : 1,
        sparkColor: "#bfe9ff", fx: [{ sparks: [[14, "#bfe9ff"], [8, "#7ff6ff"]] }],
      })),
    },
  },
  skillOrder: ["ironfist", "thunderkick", "tornado"],
  defaultLoadout: ["ironfist", "thunderkick", "tornado"],
};
