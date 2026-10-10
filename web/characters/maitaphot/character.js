// ลูกผู้ชายไม้ตะพด — the masked cane fighter. Made from characters/_template.
window.CHARACTERS = window.CHARACTERS || {};
window.CHARACTERS.maitaphot = {
  name: "ลูกผู้ชายไม้ตะพด",
  hudName: "MAI TAPHOT FIGHTER",               // shown in the HP bar (pixel font: A–Z, 0–9)
  hp: 100,
  walkSpeed: 165,
  jumpVelocity: -640,
  sfx: "stick",          // hit sound: "stick" (wood/weapon crack) or "fist" (punch)

  // All sprite sheets: horizontal strips of 224x224 frames, character facing RIGHT.
  // anchorX/anchorY = the point between the feet. scale = on-screen size.
  sprite: { frameW: 224, frameH: 224, anchorX: 95, anchorY: 220, scale: 0.62 },
  portrait: { image: "sprites/portrait.png", crop: { x: 80, y: 68, w: 44, h: 44 } },

  anims: {
    idle: { image: "sprites/idle.png", fps: 8, loop: true },
    walk: { image: "sprites/walk.png", fps: 11, loop: true },
    jump: { image: "sprites/jump.png", fps: 12, bottoms: "auto", airFrames: [1, 6] },

    // 4-hit cane combo: swing left→right, backhand right→left, straight thrust, energy wave
    attack1: { image: "sprites/attack1.png", duration: 0.26, playFor: 0.7, hitAt: 0.55 },
    attack2: { image: "sprites/attack2.png", duration: 0.26, playFor: 0.7, hitAt: 0.6 },
    attack3: { image: "sprites/attack3.png", duration: 0.3, playFor: 0.7, hitAt: 0.65 },
    attack4: { image: "sprites/attack4.png", duration: 0.42, playFor: 0.7, hitAt: 0.7 },

    // air: swing left, swing right, overhead smash into the ground
    air1: { image: "sprites/air1.png", duration: 0.28, playFor: 0.7, hitAt: 0.55, bottoms: "auto" },
    air2: { image: "sprites/air2.png", duration: 0.28, playFor: 0.7, hitAt: 0.5, bottoms: "auto" },
    air3: { image: "sprites/air3.png", duration: 0.42, playFor: 0.6, hitAt: 0.45, bottoms: "auto" },

    sk_spirit: { image: "sprites/sk_spirit.png" },
    sk_twin: { image: "sprites/sk_twin.png" },
    sk_sever: { image: "sprites/sk_sever.png", bottoms: "auto" },
    sk_drag: { image: "sprites/sk_drag.png" },
    sk_soul: { image: "sprites/sk_soul.png" },
    sk_blood: { image: "sprites/sk_blood.png" },
  },

  // the 4th hit releases a crescent of energy from the cane; the wave does the damage
  combo: [
    { anim: "attack1", dmg: [9, 12], crit: 0.15, kb: 26, reach: 112, dir: 1, power: 0, drift: 30 },
    { anim: "attack2", dmg: [10, 13], crit: 0.15, kb: 30, reach: 112, dir: -1, power: 0, drift: 30 },
    { anim: "attack3", dmg: [12, 16], crit: 0.18, kb: 44, reach: 124, dir: 1, power: 1, drift: 50 },
    { anim: "attack4", dmg: [0, 0], reach: 0, dir: 1, power: 2, drift: 10,
      shot: { fx: "taphotwave", straight: true, range: 340, speed: 900, scale: 1.1, muzzle: [70, -68], sound: "swing",
        trail: "#ff3d6e", flash: "#ff9ab8", dmg: [22, 30], power: 2, kb: 150, crit: 0.3, sparkColor: "#ff3d6e", sparkColor2: "#ffd0dc" } },
  ],
  airCombo: [
    { anim: "air1", dmg: [10, 13], crit: 0.18, kb: 20, reach: 108, dir: 1, power: 0 },
    { anim: "air2", dmg: [11, 14], crit: 0.2, kb: 24, reach: 108, dir: -1, power: 1 },
    { anim: "air3", dmg: [22, 30], crit: 0.3, kb: 130, reach: 116, dir: 1, power: 2, plunge: true },
  ],

  skills: {
    spirit: {
      name: "คลื่นวิญญาณ", desc: "ปล่อยคลื่นพลังวิญญาณโจมตีไกล 1 ครั้ง วิญญาณผู้พิทักษ์สถิตอยู่ข้างหลัง", cd: 6, dur: 0.6,
      frames: [0, 0.3, 0.55], icon: "spiritwave",
      aura: { key: "spiritguard", behind: 22, dy: -34, s0: 1.5, s1: 1.8, opacity: 0.7 },
      shot: { at: 0.55, fx: "spiritwave", straight: true, range: 600, speed: 820, scale: 1.3, muzzle: [70, -68], sound: "swing",
        trail: "#e8f4ff", flash: "#ffffff", dmg: [24, 32], power: 1, kb: 90, crit: 0.2, sparkColor: "#ffffff", sparkColor2: "#bfe0ff" },
    },
    twin: {
      name: "ตะพดคู่", desc: "ฟาดไม้ตะพดรวดเร็ว 2 ครั้ง แรงกระแทกสีขาว", cd: 5, dur: 0.45,
      frames: [0, 0.25, 0.55], icon: "whiteimpact", assist: 80,
      hits: [0.3, 0.62].map((at, i) => ({ at, dmg: [12, 16], reach: 120, power: i, kb: i ? 70 : 20, sparkColor: "#ffffff", sparkColor2: "#cfe6ff",
        fx: [{ key: "whiteimpact", dx: 84, dy: i ? -14 : 4, life: 0.25, s0: 0.6, s1: 1.15 }] })),
    },
    sever: {
      // 3 frames: spinning low sweep, the upswing that lifts them, the leaping overhead smash
      name: "ไม้ตะพดสะบั้น", desc: "หมุนตัวงัดศัตรูลอยขึ้น แล้วกระโดดตามไปฟาดอีกครั้ง รัศมีเลือด", cd: 8, dur: 0.95,
      frames: [0, 0.18, 0.45], icon: "bloodring", assist: 80, gravity: 0.55,
      hits: [
        { at: 0.18, dmg: [16, 20], reach: 115, power: 1, kb: 10, launch: 620, landDown: 1.3, rise: 600, sparkColor: "#c4121f", sparkColor2: "#ff5a5a",
          fx: [{ key: "bloodring", dx: 40, life: 0.45, s0: 0.6, s1: 1.4 }] },
        { at: 0.62, dmg: [22, 28], reach: 140, both: true, power: 2, kb: 120, sparkColor: "#c4121f", sparkColor2: "#ff5a5a",
          fx: [{ key: "bloodring", dx: 50, life: 0.5, s0: 0.8, s1: 1.6 }, { key: "bloodslash", dx: 60, life: 0.3, s0: 1.1, s1: 1.5, rot: 0.8 }] },
      ],
    },
    drag: {
      // 3 frames: long thrust, hooking them in, the close-range strike
      name: "ลากวิญญาณ", desc: "แทงไม้ตะพดไกล 1 ครั้ง เกี่ยวศัตรูดึงเข้ามาประชิด แล้วฟาดซ้ำ", cd: 8, dur: 0.85,
      frames: [0, 0.32, 0.62], icon: "bloodslash",
      hits: [
        { at: 0.15, dmg: [12, 16], reach: 300, power: 1, kb: 0, stun: 0.6, yank: 70, yankTime: 0.28, sparkColor: "#c4121f", sparkColor2: "#ff5a5a",
          fx: [{ key: "bloodslash", dx: 150, life: 0.3, s0: 1.4, s1: 2, stretch: true }],
          targetFx: [{ key: "bloodring", life: 0.5, s0: 0.6, s1: 1.2 }] },
        { at: 0.68, dmg: [20, 26], reach: 140, power: 2, kb: 140, sparkColor: "#c4121f", sparkColor2: "#ff5a5a",
          fx: [{ key: "bloodslash", dx: 70, life: 0.35, s0: 1.1, s1: 1.6 }] },
      ],
    },
    soul: {
      name: "ไม้ตะพดวิญญาณ", desc: "ไม้ตาย ฟื้นพลังชีวิต 120 และลดความเสียหายที่ได้รับครึ่งหนึ่ง 5 วินาที", cd: 20, ult: true, dur: 0.8,
      frames: [0, 0.3, 0.6], icon: "soulicon",
      aura: { key: "spiritguard", behind: 22, dy: -34, s0: 1.5, s1: 1.9, opacity: 0.75 },
      buff: { at: 0.45, dur: 5, heal: 120, guard: 0.5, hitSfx: "stick", color: "#e8f4ff",
        aura: { key: "spiritshield", dy: -8, s0: 1.5, s1: 1.6, opacity: 0.35 } },
    },
    blood: {
      name: "ไม้ตะพดเลือด", desc: "ไม้ตาย เคลือบไม้ด้วยเลือดปีศาจ ระยะโจมตีธรรมดา 2 เท่า 6 วินาที", cd: 20, ult: true, dur: 0.7,
      frames: [0, 0.3, 0.6], icon: "bloodicon",
      buff: { at: 0.5, dur: 6, reach: 2, hitSfx: "stick", color: "#d01a2a", hitFx: "bloodring",
        hitSparks: [[8, "#c4121f"]],
        atkFx: { key: "bloodslash", s0: 1.5, s1: 2.2 },
        aura: { key: "bloodring", dy: -6, s0: 1.7, s1: 1.9, opacity: 0.45, back: true } },
    },
  },
  skillOrder: ["spirit", "twin", "sever", "drag", "soul", "blood"],
  defaultLoadout: ["spirit", "twin", "blood"],
};
