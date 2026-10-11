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

    sk_twin: { image: "sprites/sk_twin.png" },
    sk_iron: { image: "sprites/sk_iron.png" },
    sk_rush: { image: "sprites/sk_rush.png" },
    sk_elbow: { image: "sprites/sk_elbow.png" },
    sk_roar: { image: "sprites/sk_roar.png" },
    sk_bow: { image: "sprites/sk_bow.png" },
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

  skills: {
    twin: {
      name: "หมัดพยัคฆ์คู่", desc: "หมัดซ้าย-ขวา 2 ครั้ง ยันต์หน้าเสือปรากฏทุกหมัด", cd: 5, dur: 0.5,
      frames: [0, 0.3, 0.6], icon: "yantface", assist: 80,
      hits: [0.3, 0.62].map((at, i) => ({ at, dmg: [13, 17], reach: 116, power: i, kb: i ? 80 : 20, punch: true,
        sparkColor: "#ffb02e", sparkColor2: "#ffe0b0",
        fx: [{ key: "yantface", dx: 84, dy: -8, life: 0.35, s0: 0.5, s1: 0.95, opacity: 0.9 }] })),
    },
    iron: {
      name: "วิชาสมิงเหล็ก", desc: "ยันต์ดำคลุมกาย 1.5 วินาที ไม่โดนความเสียหายทุกชนิด แต่ขยับไม่ได้", cd: 10, dur: 1.5,
      frames: [0, 0.1, 0.2], icon: "yantblack", invuln: 1.5,
      aura: { key: "yantblack", front: true, dy: -6, s0: 1.6, s1: 1.7, opacity: 0.75, glow: false },
    },
    rush: {
      name: "วิชาร่นระยะทาง", desc: "พุ่งเข้าหาศัตรูแล้วต่อย 1 ครั้ง เงาตามตัว", cd: 6, dur: 0.55,
      frames: [0, 0.12, 0.45], icon: "yanttiger",
      dash: { dist: 380, time: 0.32, forward: true, shadow: true, stopAt: 74,
        hit: { dmg: [20, 26], power: 1, kb: 100, punch: true, sparkColor: "#ffb02e",
          fx: [{ sparks: [[12, "#ffb02e"], [6, "#ffe0b0"]] }] } },
    },
    elbow: {
      name: "รุกรับจับเสือ", desc: "ฟันศอก 1 ครั้ง ปัดกระสุนของศัตรูกลับไป แรงขึ้น 2 เท่า ยันต์เกราะเพชร", cd: 7, dur: 0.6,
      frames: [0, 0.25, 0.45], icon: "krawpetch", assist: 70,
      reflect: { at: 0, until: 0.75, range: 150, mult: 2, color: "#ffb02e",
        fx: [{ key: "krawpetch", dx: 40, life: 0.45, s0: 0.7, s1: 1.25, opacity: 0.9 }] },
      hits: [{ at: 0.45, dmg: [17, 22], reach: 106, power: 1, kb: 70, sparkColor: "#ffb02e",
        fx: [{ key: "krawpetch", dx: 56, dy: -6, life: 0.4, s0: 0.6, s1: 1.05, opacity: 0.9 }] }],
    },
    roar: {
      name: "พยัคฆ์คำราม นะจังงัง", desc: "ไม้ตาย คำรามโจมตีศัตรูรอบตัว 1 ครั้ง ศัตรูมึนงง", cd: 18, ult: true, dur: 0.9,
      frames: [0, 0.25, 0.5], icon: "yantroar", sound: "roar",
      hits: [{ at: 0.5, dmg: [30, 40], reach: 230, both: true, power: 2, kb: 50, stun: 1.8, sparkColor: "#ffb02e", sparkColor2: "#ffe0b0",
        fx: [{ key: "yantroar", dx: 34, dy: -24, life: 0.85, s0: 1, s1: 2.7, opacity: 0.85 }, { shockwave: true }] }],
    },
    bow: {
      name: "หมัดธนูมือ", desc: "ไม้ตาย ชาร์จ 1 วิ แล้วต่อยรุนแรง 2 ครั้ง ระยะไกล ยันต์เสือกระโจน", cd: 18, ult: true,
      charge: 1.0, chargeColor: "#ff9a3c", dur: 0.6, frames: [0, 0.25, 0.6], icon: "yanttiger",
      hits: [
        { at: 0.28, dmg: [26, 32], reach: 240, power: 1, kb: 40, punch: true, sparkColor: "#ffb02e",
          fx: [{ key: "yanttiger", dx: 40, dy: -10, vx: 520, life: 0.5, s0: 1.4, s1: 1.9, opacity: 0.85 }] },
        { at: 0.62, dmg: [34, 44], reach: 250, power: 2, kb: 190, knockdown: 1.3, punch: true, sparkColor: "#ffb02e", sparkColor2: "#ff5a1f",
          fx: [{ key: "yanttiger", dx: 50, dy: -14, vx: 620, life: 0.55, s0: 1.7, s1: 2.3, opacity: 0.9 }, { shockwave: true }] },
      ],
    },
  },
  skillOrder: ["twin", "iron", "rush", "elbow", "roar", "bow"],
  defaultLoadout: ["twin", "rush", "bow"],
};
