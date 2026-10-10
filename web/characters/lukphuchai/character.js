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

    sk_bolt: { image: "sprites/sk_bolt.png" },
    sk_stormfist: { image: "sprites/sk_stormfist.png" },
    sk_upkick: { image: "sprites/sk_upkick.png" },
    sk_wave: { image: "sprites/sk_wave.png" },
    sk_thundergod: { image: "sprites/sk_thundergod.png" },
    sk_tempest: { image: "sprites/sk_tempest.png" },
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

  // Charged skills hold a pose while charging (chargeFrame / chargeStages), then play the
  // strike frames that follow it in the clip (frameOffset).
  skills: {
    bolt: {
      name: "หมัดสายฟ้า", desc: "ชาร์จ 0.5 วิ ชูมือรับฟ้าผ่า แล้วต่อยเป็นสายฟ้าทอง คนโดนไฟลุก", cd: 7,
      charge: 0.5, chargeColor: "#7fd8ff", sound: "thunder", chargeFrame: 0, frameOffset: 1,
      chargeFx: [{ key: "bluebolt", dx: 12, dy: -36, anchor: "bottom", life: 0.5, s0: 0.9, s1: 1 }],
      dur: 0.45, frames: [0, 0.25, 0.45], icon: "goldbeam",
      hits: [{ at: 0.45, dmg: [28, 36], reach: 170, power: 2, kb: 130, sfx: "zap", sparkColor: "#ffd23f",
        fx: [{ key: "goldbeam", dx: 34, dy: -4, anchor: "left", stretch: true, life: 0.4, s0: 0.5, s1: 1.2 }],
        targetFx: [{ key: "sunfire", dy: 4, anchor: "bottom", life: 1.6, s0: 0.62, s1: 0.68, opacity: 0.9 }] }],
    },
    stormfist: {
      name: "หมัดจ้าวพายุ", desc: "ชาร์จ 0.5 วิ ลมหมุนที่มือ แล้วต่อยเป็นพายุสายฟ้าทอง ศัตรูกระเด็นไกล", cd: 7,
      charge: 0.5, chargeColor: "#dff8ff", chargeFrame: 0, frameOffset: 1,
      chargeFx: [{ key: "whirl", dx: 46, dy: -16, anchor: "left", life: 0.5, s0: 0.8, s1: 1.15 }],
      dur: 0.45, frames: [0, 0.25, 0.45], icon: "whirl",
      hits: [{ at: 0.45, dmg: [26, 34], reach: 180, power: 2, kb: 230, sfx: "zap", sparkColor: "#ffd23f",
        fx: [{ key: "goldbeam", dx: 34, dy: -4, anchor: "left", stretch: true, life: 0.4, s0: 0.5, s1: 1.25 },
          { key: "whirl", dx: 60, dy: -16, vx: 520, life: 0.45, s0: 1, s1: 1.5 }] }],
    },
    upkick: {
      name: "ลูกเตะสายฟ้า", desc: "เตะเสยขวา งัดศัตรูลอยสูงกว่ากระโดด", cd: 7, dur: 0.5,
      frames: [0, 0.25, 0.5], icon: "goldbolt", assist: 80,
      hits: [{ at: 0.45, dmg: [22, 28], reach: 108, power: 1, launch: 1000, landDown: 1.3, sfx: "zap", sparkColor: "#ffd23f",
        fx: [{ key: "goldbolt", dx: 40, dy: -40, vy: -260, life: 0.4, s0: 0.7, s1: 1.1 }] }],
    },
    wave: {
      name: "คลื่นสายฟ้า", desc: "ปล่อยลูกบอลสายฟ้าพุ่งไปไกล", cd: 6, dur: 0.55,
      frames: [0, 0.3, 0.5], icon: "thunderball",
      shot: { at: 0.5, fx: "thunderball", straight: true, spin: true, range: 900, speed: 720, scale: 0.85,
        muzzle: [52, -72], trail: "#ffd23f", dmg: [22, 28], power: 1, kb: 90, sfx: "zap", sparkColor: "#ffd23f" },
    },
    thundergod: {
      name: "พลังเทพสายฟ้า", desc: "ไม้ตาย เรียกฟ้าผ่าลงตัว แล้วระเบิดพลังผลักศัตรูรอบตัวกระเด็น", cd: 16, ult: true,
      charge: 0.5, chargeColor: "#7fd8ff", sound: "thunder", chargeFrame: 0, frameOffset: 1,
      chargeFx: [{ key: "bluebolt", at: "ground", anchor: "bottom", dy: 6, life: 0.55, s0: 1.3, s1: 1.4 }],
      dur: 0.6, frames: [0, 0.2, 0.5], icon: "bluebolt",
      hits: [{ at: 0.35, dmg: [50, 64], reach: 175, both: true, power: 2, kb: 260, knockdown: 1.2, sfx: "zap",
        sparkColor: "#ffd23f", sparkColor2: "#7fd8ff",
        fx: [{ key: "goldburst", dy: -6, life: 0.5, s0: 1.2, s1: 2.4 }, { shockwave: true },
          { sparks: [[18, "#ffd23f"], [12, "#7fd8ff"]] }] }],
    },
    tempest: {
      name: "หมัดสายฟ้าเจ้าพายุ", desc: "ไม้ตาย ลมหมุนที่มือ 0.5 วิ ชูมือรับฟ้าผ่า 0.75 วิ แล้วต่อยระเบิดไฟ ไกลและรุนแรง", cd: 20, ult: true,
      charge: 1.25, frameOffset: 2,
      chargeStages: [
        { until: 0.5, frame: 0, color: "#dff8ff", fx: [{ key: "whirl", dx: 46, dy: -16, anchor: "left", life: 0.5, s0: 0.8, s1: 1.2 }] },
        { until: 1.25, frame: 1, color: "#7fd8ff", sound: "thunder",
          fx: [{ key: "bluebolt", dx: 12, dy: -36, anchor: "bottom", life: 0.75, s0: 0.95, s1: 1.05 }] },
      ],
      dur: 0.55, frames: [0, 0.2, 0.4], icon: "fireblast",
      hits: [{ at: 0.4, dmg: [80, 100], reach: 240, power: 2, kb: 300, knockdown: 1.6, crit: 0.3, sfx: "zap",
        sparkColor: "#ff7a1a", sparkColor2: "#ffd23f",
        fx: [{ key: "fireblast", dx: 30, dy: -6, anchor: "left", life: 0.6, s0: 0.7, s1: 1.6 },
          { key: "goldbeam", dx: 30, dy: -4, anchor: "left", stretch: true, life: 0.4, s0: 0.6, s1: 1.4 }, { shockwave: true }],
        targetFx: [{ key: "sunfire", dy: 4, anchor: "bottom", life: 2, s0: 0.65, s1: 0.7, opacity: 0.9 }] }],
    },
  },
  skillOrder: ["bolt", "stormfist", "upkick", "wave", "thundergod", "tempest"],
  defaultLoadout: ["bolt", "wave", "tempest"],
};
