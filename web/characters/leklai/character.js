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

    sk_blink: { image: "sprites/sk_blink.png" },
    sk_magnet: { image: "sprites/sk_magnet.png" },
    sk_ramasun: { image: "sprites/sk_ramasun.png" },
    sk_hanuman: { image: "sprites/sk_hanuman.png", bottoms: "auto" },
    sk_sun: { image: "sprites/sk_sun.png" },
    sk_moon: { image: "sprites/sk_moon.png" },
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

  skills: {
    blink: {
      name: "ก้าวพริบตา", desc: "วาร์ปไปข้างหลังศัตรูแล้วต่อย 1 ครั้ง", cd: 6, dur: 0.45,
      frames: [0, 0.3, 0.55], icon: "blinkrift",
      blink: {
        at: 0.12, behind: 62, range: 430,
        fxOut: [{ key: "blink", at: "ground", anchor: "bottom", dy: 4, life: 0.4, s0: 0.75, s1: 1.05 },
          { sparks: [[10, "#bfe9ff"], [6, "#ffffff"]] }],
        fxIn: [{ key: "blinkrift", dx: -8, dy: -6, life: 0.35, s0: 0.6, s1: 1.1 },
          { sparks: [[8, "#7fd8ff"], [6, "#ffffff"]] }],
      },
      hits: [{ at: 0.55, dmg: [22, 30], reach: 108, power: 1, kb: 70, crit: 0.35, sparkColor: "#bfe9ff",
        fx: [{ key: "blinkrift", dx: 44, dy: -4, life: 0.25, s0: 0.35, s1: 0.65 }, { sparks: [[10, "#bfe9ff"]] }] }],
    },
    magnet: {
      name: "พลังแม่เหล็ก", desc: "สนามแม่เหล็กดูดศัตรูเข้ามาหาตัว ไม่มีดาเมจ", cd: 9, dur: 1.7,
      frames: [0, 0.1, 0.22], icon: "magnet",
      pull: { speed: 320, range: 540, stopAt: 78, color: "#9fb8ff" },
      aura: { key: "magnet", dx: 0, dy: -4, s0: 1.3, s1: 1.7, opacity: 0.85 },
    },
    ramasun: {
      name: "รามสูรขว้างขวาน", desc: "ศอกสั้น วิญญาณรามสูรขว้างขวานสายฟ้า", cd: 8, dur: 0.45,
      charge: 0.22, chargeColor: "#bfe9ff", frames: [0, 0.3, 0.55], icon: "ramasun", assist: 90,
      chargeFx: [{ key: "ramasun", dx: -6, dy: -42, life: 0.68, s0: 1.15, s1: 1.25, back: true, opacity: 0.9 }],
      hits: [{ at: 0.55, dmg: [30, 40], reach: 118, power: 2, kb: 150, sfx: "zap", sparkColor: "#dff2ff", sparkColor2: "#8f7bff",
        fx: [{ sparks: [[14, "#dff2ff"], [10, "#8f7bff"]] }, { shockwave: true }] }],
    },
    hanuman: {
      name: "หนุมานข้ามลงกา", desc: "กระโดดขึ้นตรง แล้วแทงเข่าดิ่งลง 45 องศา", cd: 8,
      icon: "wind", leap: { vy: -840, vx: 0, dive: 640 },
      trail: { every: 0.04, fx: [{ key: "wind", dx: -26, dy: -26, life: 0.3, s0: 0.7, s1: 1, opacity: 0.85 }] },
      hit: { dmg: [34, 44], reach: 112, power: 2, knockdown: 1.2, crit: 0.3, sparkColor: "#d8ffe4", sparkColor2: "#8fe0a8",
        fx: [{ key: "wind", at: "ground", anchor: "bottom", life: 0.5, s0: 0.9, s1: 1.4 }, { shockwave: true }] },
    },
    sun: {
      name: "เหล็กไหลสุริยัน", desc: "ไม้ตาย ไฟลุกรอบตัว พลังโจมตีเพิ่มขึ้น 8 วินาที ทุกการโจมตีมีประกายไฟ",
      cd: 22, ult: true, dur: 0.7, frames: [0, 0.3, 0.55], icon: "sunfire",
      buff: { at: 0.55, dur: 8, dmg: 1.35, color: "#ffb02e",
        hitSparks: [[10, "#ff7a1a"], [8, "#ffd23f"]], hitFx: "groundfire",
        aura: { key: "sunfire", at: "ground", anchor: "bottom", dy: 6, s0: 1.05, s1: 1.1, back: true, opacity: 0.9 } },
    },
    moon: {
      name: "เหล็กไหลจันทรา", desc: "ไม้ตาย ชาร์จครึ่งวินาที ขว้างหอกน้ำแข็งพุ่งไปสุดฉาก", cd: 16, ult: true,
      charge: 0.5, chargeColor: "#bfefff", dur: 0.45, frames: [0, 0.4, 0.7], icon: "icespear",
      shot: { at: 0.6, fx: "icespear", dmg: [70, 90], range: 2600, speed: 1300, straight: true, scale: 1.25,
        power: 2, kb: 220, knockdown: 1.4, crit: 0.3, sfx: "ice", trail: "#dff8ff", sparkColor: "#dff8ff", sparkColor2: "#7fd8ff" },
    },
  },
  skillOrder: ["blink", "magnet", "ramasun", "hanuman", "sun", "moon"],
  defaultLoadout: ["blink", "ramasun", "moon"],
};
