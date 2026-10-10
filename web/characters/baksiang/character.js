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

    sk_monkey: { image: "sprites/sk_monkey.png", bottoms: "auto" },
    sk_talai: { image: "sprites/sk_talai.png" },
    sk_doubleknee: { image: "sprites/sk_doubleknee.png", bottoms: "auto" },
    sk_tenk: { image: "sprites/sk_tenk.png" },
    sk_bigride: { image: "sprites/sk_bigride.png" },
    sk_rain: { image: "sprites/sk_rain.png" },
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

  skills: {
    monkey: {
      name: "ท่าลิงลม", desc: "กระโดดตีลังกาข้ามไปหลังศัตรูแล้วเตะ เงาตามตัว", cd: 6, dur: 0.62,
      frames: [0, 0.25, 0.58], icon: "wind", shadow: true,
      hop: { behind: 64, time: 0.34, height: 150, range: 430 },
      hits: [{ at: 0.66, dmg: [22, 28], reach: 110, power: 1, kb: 90, crit: 0.3, sparkColor: "#ffd23f",
        fx: [{ key: "wind", dx: 30, dy: -10, life: 0.3, s0: 0.6, s1: 0.9 }] }],
    },
    talai: {
      name: "ตะไลบิน", desc: "ขว้างตะไลวงกลม 2 อัน หมุนพุ่งไปโจมตีไกล", cd: 6, dur: 0.6,
      frames: [0, 0.3, 0.5], icon: "talai",
      shot: { at: 0.45, burst: 2, gap: 0.14, fx: "talai", straight: true, hoop: true, range: 620, speed: 760, scale: 0.8,
        muzzle: [56, -76], sound: "rocket", trail: "#ffd23f", dmg: [13, 17], power: 1, kb: 50, sparkColor: "#ffb02e" },
    },
    doubleknee: {
      name: "ท่าเข่าคู่", desc: "กระโดดพุ่งเข้าหา แทงเข่า 2 ครั้ง เงาตามตัว", cd: 7, dur: 0.5,
      icon: "clawheavy", shadow: true, assist: 70, travel: { vx: 330, vy: -480, landHold: 0.18 },
      hits: [0.2, 0.42].map((at, i) => ({ at, dmg: [14, 18], reach: 112, both: true, power: i ? 2 : 1, kb: i ? 120 : 30,
        sparkColor: "#ffd23f" })),
    },
    tenk: {
      name: "บั้งไฟหมื่น", desc: "ยิงบั้งไฟ 3 ลูกติด ระยะไกล", cd: 7, dur: 0.75,
      frames: [0, 0.3, 0.5], icon: "rocket",
      shot: { at: 0.4, burst: 3, gap: 0.12, fx: "rocket", straight: true, range: 650, speed: 1000, scale: 0.7, muzzle: [60, -76],
        sound: "rocket", trail: "#d8d0c0", flash: "#ffb02e", dmg: [13, 17], power: 1, kb: 50, sparkColor: "#ffb02e",
        targetFx: [{ key: "groundfire", dy: 4, anchor: "bottom", life: 0.5, s0: 1.1, s1: 1.4 }] },
    },
    bigride: {
      name: "บั้งไฟล้าน", desc: "ไม้ตาย ชาร์จ 1 วิ กระโดดขี่บั้งไฟยักษ์พุ่งชนศัตรูอย่างแรง แล้วกระโดดลง", cd: 18, ult: true,
      charge: 1.0, chargeColor: "#ffb02e", chargeFrame: 0, frameOffset: 1, sound: "rocket",
      dur: 0.9, frames: [0, 0.4, 0.8], icon: "rocket",
      dash: { dist: 620, time: 0.62, forward: true, hopOff: 420, ride: { key: "rocket", scale: 2.1, lift: 24, rope: { hand: [51, -63], nose: [144, 10] } },
        hit: { dmg: [70, 90], power: 2, kb: 300, knockdown: 1.5, crit: 0.3, sparkColor: "#ffb02e", sparkColor2: "#ff5a1f",
          fx: [{ key: "fireblast", dx: 10, dy: -10, anchor: "left", life: 0.5, s0: 0.7, s1: 1.3 }, { shockwave: true }],
          targetFx: [{ key: "groundfire", dy: 4, anchor: "bottom", life: 1.2, s0: 1.8, s1: 2.4 }] } },
    },
    rain: {
      name: "ฝนบั้งไฟ", desc: "ไม้ตาย จุดบั้งไฟที่พื้น 5 วินาทีต่อจากนั้นบั้งไฟตกจากฟ้าใส่ศัตรู วินาทีละ 2 ลูก รวม 10 ลูก", cd: 22, ult: true,
      dur: 0.8, frames: [0, 0.3, 0.6], icon: "groundfire",
      rain: { at: 0.6, delay: 0.4, duration: 5, count: 10, height: 330, spread: 80,
        shot: { fx: "rocket", straight: true, range: 900, speed: 700, scale: 0.6, trail: "#d8d0c0", groundFx: "groundfire", splash: 60,
          dmg: [12, 16], power: 1, kb: 40, crit: 0.2, sparkColor: "#ffb02e" } },
    },
  },
  skillOrder: ["monkey", "talai", "doubleknee", "tenk", "bigride", "rain"],
  defaultLoadout: ["monkey", "talai", "bigride"],
};
