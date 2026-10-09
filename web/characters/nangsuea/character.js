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

    sk_skyrise: { image: "sprites/sk_skyrise.png" },
    sk_twinclaw: { image: "sprites/sk_twinclaw.png" },
    sk_gun: { image: "sprites/sk_gun.png" },
    sk_dash: { image: "sprites/sk_dash.png" },
    sk_jungle: { image: "sprites/sk_jungle.png" },
    sk_roar: { image: "sprites/sk_roar.png" },
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

  skills: {
    skyrise: {
      name: "พยัคฆ์เหินหาว", desc: "ข่วนเสยจากล่างขึ้นบน งัดศัตรูลอยสูงกว่ากระโดด", cd: 7, dur: 0.5,
      frames: [0, 0.3, 0.5], icon: "clawheavy", assist: 80,
      hits: [{ at: 0.45, dmg: [22, 28], reach: 108, power: 1, launch: 1000, landDown: 1.3, sparkColor: "#ffb02e",
        fx: [{ key: "clawheavy", dx: 40, dy: -30, vy: -220, life: 0.35, s0: 0.8, s1: 1.2, rot: -1.3 }] }],
    },
    twinclaw: {
      name: "กรงเล็บพิฆาต", desc: "ข่วนซ้าย-ขวา 2 ครั้ง วิญญาณเสือออกมาช่วยข่วน", cd: 7, dur: 0.62,
      frames: [0, 0.3, 0.6], icon: "tigerclaw", assist: 90,
      hits: [
        { at: 0.3, dmg: [16, 21], reach: 120, power: 1, kb: 40, sparkColor: "#ffb02e",
          fx: [{ key: "tigerclaw", dx: 34, dy: -14, life: 0.42, s0: 0.85, s1: 1.1, opacity: 0.9 },
            { key: "claw", dx: 70, dy: -6, life: 0.24, s0: 0.7, s1: 1 }] },
        { at: 0.65, dmg: [20, 26], reach: 124, power: 2, kb: 130, sparkColor: "#ffb02e",
          fx: [{ key: "tigerclaw", dx: 40, dy: -6, life: 0.45, s0: 0.95, s1: 1.25, opacity: 0.9, rot: 0.25 },
            { key: "clawx", dx: 72, dy: -6, life: 0.3, s0: 0.8, s1: 1.15 }] },
      ],
    },
    gun: {
      name: "กระสุนสังหาร", desc: "ชักปืนยิง 3 นัดติด ระยะไกล", cd: 8, dur: 0.75,
      frames: [0, 0.2, 0.4], icon: "pistol",
      shot: { at: 0.42, burst: 3, gap: 0.12, fx: "bullet", straight: true, range: 900, speed: 1500,
        muzzle: [56, -80], flash: "#ffd23f", sound: "gun",
        dmg: [11, 14], power: 0, kb: 25, crit: 0.2, sparkColor: "#ffd23f" },
    },
    dash: {
      name: "พยัคฆ์จู่โจม", desc: "แดชไปทางที่กดค้าง (ถอยหลังได้) ผ่านตัวศัตรูจะโดน 1 ครั้ง ทิ้งเงาตามตัว", cd: 5, dur: 0.45,
      frames: [0, 0.15, 0.6], icon: "claw",
      dash: { dist: 300, time: 0.3, shadow: true,
        hit: { dmg: [20, 26], power: 1, kb: 70, sparkColor: "#ffb02e",
          fx: [{ key: "claw", dx: 0, dy: -4, life: 0.25, s0: 0.7, s1: 1 }] } },
    },
    jungle: {
      name: "ป่านางเสือ", desc: "ไม้ตาย ออร่าสีเขียว 9 วินาที วิ่งเร็ว กระโดดสูงขึ้น คริติคอลง่ายขึ้น ทุกการโจมตีมีใบไม้",
      cd: 22, ult: true, dur: 0.7, frames: [0, 0.3, 0.55], icon: "jungleaura",
      buff: { at: 0.5, dur: 9, dmg: 1, speed: 1.4, jump: 1.2, crit: 0.25, color: "#7dff8a",
        hitSparks: [[10, "#5fe35a"], [6, "#d8ffb0"]], hitFx: "leaves",
        aura: { key: "jungleaura", at: "ground", anchor: "bottom", dy: 6, s0: 1.05, s1: 1.1, back: true, opacity: 0.85 } },
    },
    roar: {
      name: "พยัคฆ์คำราม", desc: "ไม้ตาย คำรามเรียกเสือออกมาจู่โจม 4 ครั้ง ระยะไกลกว่าตีปกติ", cd: 18, ult: true,
      charge: 0.3, chargeColor: "#ffb02e", dur: 1.0, frames: [0, 0.2, 0.4], icon: "tigerbeast", sound: "roar",
      chargeFx: [{ key: "tigerbeast", dx: 10, dy: -4, vx: 230, life: 1.3, s0: 1.05, s1: 1.15 }],
      hits: [0.15, 0.35, 0.55, 0.78].map((at, i) => ({
        at, dmg: i === 3 ? [26, 34] : [14, 18], reach: 270, power: i === 3 ? 2 : 1, kb: i === 3 ? 160 : 20,
        knockdown: i === 3 ? 1.2 : 0, sparkColor: "#ffb02e",
        fx: [{ key: i % 2 ? "claw" : "clawheavy", dx: 200, dy: -6, life: 0.24, s0: 0.7, s1: 1, rot: i % 2 ? 0.5 : 0 }],
      })),
    },
  },
  skillOrder: ["skyrise", "twinclaw", "gun", "dash", "jungle", "roar"],
  defaultLoadout: ["twinclaw", "dash", "roar"],
};
