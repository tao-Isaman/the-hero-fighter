// นักสู้พันธุ์ข้าวเหนียว — the masked Muay Thai boxer. Made from characters/_template.
window.CHARACTERS = window.CHARACTERS || {};
window.CHARACTERS.khaoniao = {
  name: "นักสู้พันธุ์ข้าวเหนียว",
  hudName: "KHAO NIAO FIGHTER",
  hp: 110,
  walkSpeed: 175,
  jumpVelocity: -660,
  sfx: "fist",

  sprite: { frameW: 224, frameH: 224, anchorX: 95, anchorY: 220, scale: 0.62 },
  portrait: { image: "sprites/portrait.png", crop: { x: 46, y: 6, w: 100, h: 100 } },

  anims: {
    idle: { image: "sprites/idle.png", fps: 8, loop: true },
    walk: { image: "sprites/walk.png", fps: 12, loop: true },
    jump: { image: "sprites/jump.png", fps: 12, bottoms: "auto", airFrames: [3, 7] },

    // 4-punch combo, 4 frames each: chamber, extend, extend, impact
    attack1: { image: "sprites/attack1.png", duration: 0.24, playFor: 0.7, hitAt: 0.5 },
    attack2: { image: "sprites/attack2.png", duration: 0.24, playFor: 0.7, hitAt: 0.5 },
    attack3: { image: "sprites/attack3.png", duration: 0.26, playFor: 0.7, hitAt: 0.5 },
    attack4: { image: "sprites/attack4.png", duration: 0.42, playFor: 0.7, hitAt: 0.55 },

    air1: { image: "sprites/air1.png", duration: 0.28, playFor: 0.7, hitAt: 0.5, bottoms: "auto" },
    air2: { image: "sprites/air2.png", duration: 0.28, playFor: 0.7, hitAt: 0.5, bottoms: "auto" },
    air3: { image: "sprites/air3.png", duration: 0.42, playFor: 0.6, hitAt: 0.45, bottoms: "auto" },

    sk_korat: { image: "sprites/sk_korat.png" },
    sk_thasao: { image: "sprites/sk_thasao.png" },
    sk_lopburi: { image: "sprites/sk_lopburi.png", bottoms: "auto" },
    sk_chaiya: { image: "sprites/sk_chaiya.png" },
    sk_buffalo: { image: "sprites/sk_buffalo.png" },
    sk_knee: { image: "sprites/sk_knee.png", bottoms: "auto" },
  },

  // left, right, left, then a heavy right. `punch` draws speed lines instead of a swing arc.
  combo: [
    { anim: "attack1", dmg: [7, 10], crit: 0.15, kb: 24, reach: 104, dir: 1, power: 0, drift: 30, punch: true },
    { anim: "attack2", dmg: [8, 11], crit: 0.15, kb: 26, reach: 106, dir: 1, power: 0, drift: 30, punch: true },
    { anim: "attack3", dmg: [9, 12], crit: 0.18, kb: 30, reach: 104, dir: 1, power: 1, drift: 30, punch: true },
    { anim: "attack4", dmg: [22, 30], crit: 0.3, kb: 130, reach: 112, dir: 1, power: 2, drift: 60, punch: true },
  ],
  airCombo: [
    { anim: "air1", dmg: [9, 12], crit: 0.18, kb: 20, reach: 104, dir: 1, power: 0, punch: true },
    { anim: "air2", dmg: [10, 13], crit: 0.2, kb: 24, reach: 106, dir: 1, power: 1, punch: true },
    { anim: "air3", dmg: [20, 28], crit: 0.3, kb: 120, reach: 108, dir: 1, power: 2, plunge: true, punch: true },
  ],

  skills: {
    korat: {
      name: "มวยโคราช", desc: "หมัดหนัก 1 ครั้ง ศัตรูกระเด็น พื้นแตก", cd: 6, dur: 0.55,
      frames: [0, 0.3, 0.5], icon: "crack", assist: 80,
      hits: [{ at: 0.5, dmg: [34, 44], reach: 110, power: 2, kb: 170, sparkColor: "#ffb02e",
        fx: [{ key: "crack", dx: 60, at: "ground", life: 0.7, s0: 0.6, s1: 1.2, anchor: "bottom", shockwave: true }] }],
    },
    thasao: {
      name: "มวยท่าเสา", desc: "หมัดรัวเร็ว 4 ครั้ง", cd: 6, dur: 0.72,
      frames: [0, 0.33, 0.66], loopFrames: true, icon: "fists", assist: 80,
      hits: [0.18, 0.36, 0.54, 0.72].map((at, i) => ({
        at, dmg: [8, 11], reach: 112, power: i === 3 ? 1 : 0, kb: 18, sparkColor: "#fff2c4",
        fx: [{ key: "fists", dx: 48, dy: -4, life: 0.22, s0: 0.85, s1: 1 }],
      })),
    },
    lopburi: {
      name: "มวยลพบุรี", desc: "อัปเปอร์คัตส่งศัตรูลอย แล้วต่อยกลางอากาศอีก 2 ครั้ง", cd: 8, dur: 0.85,
      frames: [0, 0.32, 0.62], icon: "blades", assist: 80, gravity: 0.5,
      hits: [
        { at: 0.12, dmg: [16, 20], reach: 100, power: 1, launch: 640, landDown: 1.4, rise: 560, sparkColor: "#7ff6ff",
          fx: [{ key: "blades", dx: 40, dy: -20, vy: -260, life: 0.4, s0: 0.7, s1: 1.1, rot: -0.6 }] },
        { at: 0.45, dmg: [12, 16], reach: 120, power: 1, sparkColor: "#7ff6ff",
          fx: [{ key: "blades", dx: 46, life: 0.35, s0: 0.8, s1: 1.1 }] },
        { at: 0.75, dmg: [16, 22], reach: 120, power: 2, sparkColor: "#7ff6ff",
          fx: [{ key: "blades", dx: 46, life: 0.4, s0: 0.9, s1: 1.3, rot: 0.8 }] },
      ],
    },
    chaiya: {
      name: "มวยไชยา", desc: "ตั้งการ์ด ถ้าโดนตีจะสวนกลับแรง คริติคอลแน่นอน", cd: 9, icon: "guard",
      counter: {
        window: 1.6, hitAt: 0.1, dur: 0.45,
        aura: { key: "guard", dx: 8, at: "ground", anchor: "bottom", s0: 0.9, s1: 1, opacity: 0.55 },
        hit: { dmg: [36, 48], reach: 125, power: 2, kb: 140, sparkColor: "#ffd23f",
          fx: [{ key: "fists", dx: 50, life: 0.3, s0: 1, s1: 1.3 }, { sparks: [[16, "#ffd23f"]] }] },
      },
    },
    buffalo: {
      name: "หมัดเขวี้ยงควาย", desc: "ไม้ตาย ชาร์จ 1 วิ แล้วต่อยแรงมาก วิญญาณควายพุ่งชน", cd: 16, ult: true,
      charge: 1.0, chargeColor: "#ff5a1f", dur: 0.5, frames: [0, 0.2, 0.42], icon: "buffalo",
      hits: [{ at: 0.42, dmg: [80, 100], reach: 250, power: 2, kb: 210, knockdown: 1.6, crit: 0.3,
        sparkColor: "#ff5a1f", sparkColor2: "#ffd23f",
        fx: [{ key: "buffalo", dx: 10, dy: -6, vx: 640, life: 0.6, s0: 0.9, s1: 1.35 }, { shockwave: true }] }],
    },
    knee: {
      // 3 frames: take off, flying knee (held while airborne), landing
      name: "เข่าพญาไฟ", desc: "ไม้ตาย กระโดดแทงเข่า 4 ครั้ง ไฟลุกตามพื้น", cd: 14, ult: true, dur: 0.55,
      icon: "groundfire", travel: { vx: 280, vy: -520, landHold: 0.2 }, assist: 60,
      trail: { every: 0.05, fx: [{ key: "groundfire", at: "ground", anchor: "bottom", life: 0.8, s0: 0.8, s1: 1 }] },
      hits: [0.14, 0.3, 0.46, 0.62].map((at, i) => ({
        at, dmg: [10, 14], reach: 115, both: true, power: i === 3 ? 2 : 1, kb: 30, sparkColor: "#ff7a1a",
        fx: [{ sparks: [[8, "#ff7a1a"], [6, "#ffd23f"]] }],
      })),
    },
  },
  skillOrder: ["korat", "thasao", "lopburi", "chaiya", "buffalo", "knee"],
  defaultLoadout: ["korat", "lopburi", "buffalo"],
};
