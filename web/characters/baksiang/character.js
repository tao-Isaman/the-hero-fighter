// บักเซียง — the rocket warrior from คนไฟบิน. Throws bamboo rockets (bang fai). Made from characters/_template.
window.CHARACTERS = window.CHARACTERS || {};
window.CHARACTERS.baksiang = {
  name: "บักเซียง",
  hudName: "BAK SIANG",
  hp: 100,
  walkSpeed: 175,
  jumpVelocity: -660,
  sfx: "fist",

  sprite: { frameW: 224, frameH: 224, anchorX: 95, anchorY: 220, scale: 0.62 },
  portrait: { image: "sprites/portrait.png", crop: { x: 80, y: 56, w: 52, h: 52 } },

  anims: {
    idle: { image: "sprites/idle.png", fps: 8, loop: true },
    walk: { image: "sprites/walk.png", fps: 11, loop: true },
    jump: { image: "sprites/jump.png", fps: 12, bottoms: "auto", airFrames: [1, 6] },

    // 5-hit combo: left jab, right straight, right knee, spinning small rocket, spinning big rocket
    attack1: { image: "sprites/attack1.png", duration: 0.24, playFor: 0.7, hitAt: 0.55 },
    attack2: { image: "sprites/attack2.png", duration: 0.26, playFor: 0.7, hitAt: 0.35 },
    attack3: { image: "sprites/attack3.png", duration: 0.28, playFor: 0.7, hitAt: 0.45 },
    attack4: { image: "sprites/attack4.png", duration: 0.36, playFor: 0.7, hitAt: 0.55 },
    attack5: { image: "sprites/attack5.png", duration: 0.46, playFor: 0.7, hitAt: 0.55 },

    // air: wrist flicks, left and right, each firing a rocket 45 degrees down
    air1: { image: "sprites/air1.png", duration: 0.26, playFor: 0.7, hitAt: 0.5, bottoms: "auto" },
    air2: { image: "sprites/air2.png", duration: 0.26, playFor: 0.7, hitAt: 0.5, bottoms: "auto" },

    sk_rocketrain: { image: "sprites/sk_rocketrain.png" },
    sk_bigrocket: { image: "sprites/sk_bigrocket.png" },
    sk_barrage: { image: "sprites/sk_barrage.png" },
  },

  // rows with `shot` throw a rocket instead of striking; the rocket does the damage
  combo: [
    { anim: "attack1", dmg: [8, 11], crit: 0.15, kb: 22, reach: 104, dir: 1, power: 0, drift: 30, punch: true },
    { anim: "attack2", dmg: [9, 12], crit: 0.15, kb: 26, reach: 106, dir: 1, power: 0, drift: 30, punch: true },
    { anim: "attack3", dmg: [11, 14], crit: 0.18, kb: 34, reach: 98, dir: 1, power: 1, drift: 40, punch: true },
    { anim: "attack4", dmg: [0, 0], reach: 0, dir: 1, power: 1, drift: 10,
      shot: { fx: "rocket", straight: true, range: 380, speed: 950, scale: 0.55, muzzle: [56, -76], sound: "rocket",
        trail: "#d8d0c0", flash: "#ffb02e", dmg: [14, 18], power: 1, kb: 60, crit: 0.2, sparkColor: "#ffb02e",
        targetFx: [{ key: "groundfire", dy: 4, anchor: "bottom", life: 0.6, s0: 1.2, s1: 1.6 }] } },
    { anim: "attack5", dmg: [0, 0], reach: 0, dir: 1, power: 2, drift: 10,
      shot: { fx: "rocket", straight: true, range: 470, speed: 1000, scale: 0.95, muzzle: [60, -76], sound: "rocket",
        trail: "#d8d0c0", flash: "#ffd23f", dmg: [26, 34], power: 2, kb: 170, crit: 0.3, sparkColor: "#ffb02e", sparkColor2: "#ff5a1f",
        targetFx: [{ key: "groundfire", dy: 4, anchor: "bottom", life: 0.8, s0: 1.6, s1: 2.2 }] } },
  ],
  airCombo: [0, 1, 2, 3].map((i) => ({
    anim: i % 2 ? "air2" : "air1", dmg: [0, 0], reach: 0, dir: i % 2 ? -1 : 1, power: i === 3 ? 1 : 0,
    shot: { fx: "rocket", straight: true, angle: 45, range: 520, speed: 700, scale: 0.5, muzzle: [40, -70], sound: "rocket",
      trail: "#d8d0c0", flash: "#ffb02e", groundFx: "groundfire", splash: 55,
      dmg: i === 3 ? [14, 18] : [9, 12], power: i === 3 ? 1 : 0, kb: 30, crit: 0.2, sparkColor: "#ffb02e" },
  })),

  // Placeholder skills built from his combo frames until the real ones are made.
  skills: {
    rocketrain: {
      name: "บั้งไฟแสนลูก", desc: "ขว้างบั้งไฟ 3 ลูกติด (ท่าชั่วคราว)", cd: 7, dur: 0.75, frames: [0, 0.3, 0.5], icon: "rocket",
      shot: { at: 0.4, burst: 3, gap: 0.12, fx: "rocket", straight: true, range: 520, speed: 1000, scale: 0.55, muzzle: [56, -76],
        sound: "rocket", trail: "#d8d0c0", dmg: [12, 15], power: 1, kb: 40, sparkColor: "#ffb02e" },
    },
    bigrocket: {
      name: "บั้งไฟพญานาค", desc: "ยิงบั้งไฟใหญ่ไปไกล ศัตรูล้ม (ท่าชั่วคราว)", cd: 8, dur: 0.6, frames: [0, 0.3, 0.55], icon: "rocket",
      shot: { at: 0.55, fx: "rocket", straight: true, range: 800, speed: 1100, scale: 1.2, muzzle: [60, -76], sound: "rocket",
        trail: "#d8d0c0", dmg: [30, 38], power: 2, kb: 180, knockdown: 1.2, sparkColor: "#ffb02e",
        targetFx: [{ key: "groundfire", dy: 4, anchor: "bottom", life: 0.9, s0: 1.8, s1: 2.4 }] },
    },
    barrage: {
      name: "ฝนบั้งไฟ", desc: "ไม้ตาย ยิงบั้งไฟรัว 6 ลูก (ท่าชั่วคราว)", cd: 16, ult: true, dur: 1.1, frames: [0, 0.2, 0.4], icon: "rocket",
      shot: { at: 0.3, burst: 6, gap: 0.1, fx: "rocket", straight: true, range: 700, speed: 1100, scale: 0.7, muzzle: [60, -76],
        sound: "rocket", trail: "#d8d0c0", dmg: [12, 16], power: 1, kb: 50, sparkColor: "#ffb02e" },
    },
  },
  skillOrder: ["rocketrain", "bigrocket", "barrage"],
  defaultLoadout: ["rocketrain", "bigrocket", "barrage"],
};
