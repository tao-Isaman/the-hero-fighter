// Synthesized fight sounds (Web Audio, no audio files).
// Every impact is layered: a low body thump, a mid "thwack" or wood crack, and a short
// high transient, pushed through a little distortion and a compressor so hits land hard.
(function () {
  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null, master = null, verb = null, noiseBuf = null, driveCurve = null;
  let muted = false;
  try { muted = localStorage.getItem("komfaek.sound") === "off"; } catch (e) {}

  function init() {
    if (ctx || !AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 6;
    comp.ratio.value = 6;
    comp.attack.value = 0.002;
    comp.release.value = 0.16;
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(comp).connect(ctx.destination);

    // white noise shared by every noise layer
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

    // short dark room so heavy hits have a tail
    const len = Math.floor(ctx.sampleRate * 0.7);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const c = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) c[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    verb = ctx.createConvolver();
    verb.buffer = ir;
    const verbLp = ctx.createBiquadFilter();
    verbLp.type = "lowpass";
    verbLp.frequency.value = 2200;
    const verbGain = ctx.createGain();
    verbGain.gain.value = 0.35;
    verb.connect(verbLp).connect(verbGain).connect(master);

    driveCurve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      const x = (i / 1023) * 2 - 1;
      driveCurve[i] = Math.tanh(x * 3.2);
    }
  }

  function unlock() {
    init();
    if (ctx && ctx.state === "suspended") ctx.resume();
  }
  addEventListener("pointerdown", unlock, { capture: true });
  addEventListener("keydown", unlock, { capture: true });
  addEventListener("touchend", unlock, { capture: true });

  function ready() { return ctx && ctx.state === "running" && !muted; }

  // envelope: fast attack, exponential decay
  function env(g, t, peak, attack, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  function out(node, { drive = false, wet = 0 } = {}) {
    let last = node;
    if (drive) {
      const ws = ctx.createWaveShaper();
      ws.curve = driveCurve;
      ws.oversample = "2x";
      last.connect(ws);
      last = ws;
    }
    last.connect(master);
    if (wet > 0) {
      const s = ctx.createGain();
      s.gain.value = wet;
      last.connect(s).connect(verb);
    }
  }

  // pitched layer with a pitch drop (thumps, booms, knocks)
  function tone(t, { type = "sine", f0, f1 = f0, dur, gain, attack = 0.002, drive, wet }) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    env(g, t, gain, attack, dur);
    o.connect(g);
    out(g, { drive, wet });
    o.start(t);
    o.stop(t + attack + dur + 0.05);
  }

  // filtered noise layer (slaps, cracks, whooshes, rumbles)
  function noise(t, { type = "bandpass", f0, f1 = f0, q = 1, dur, gain, attack = 0.001, drive, wet }) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const flt = ctx.createBiquadFilter();
    flt.type = type;
    flt.Q.value = q;
    flt.frequency.setValueAtTime(f0, t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + attack + dur);
    const g = ctx.createGain();
    env(g, t, gain, attack, dur);
    src.connect(flt).connect(g);
    out(g, { drive, wet });
    src.start(t, Math.random() * 1.5);
    src.stop(t + attack + dur + 0.05);
  }

  const vary = (v, amt = 0.08) => v * (1 + (Math.random() * 2 - 1) * amt);

  const SFX = {
    get muted() { return muted; },
    setMuted(m) {
      muted = !!m;
      try { localStorage.setItem("komfaek.sound", muted ? "off" : "on"); } catch (e) {}
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.02);
    },
    unlock,

    // the swing before contact: fists cut short and dry, the stick whistles
    swing(kind = "fist", power = 0) {
      if (!ready()) return;
      const t = ctx.currentTime;
      const dur = 0.09 + power * 0.05;
      if (kind === "stick") {
        noise(t, { f0: vary(900), f1: vary(3200), q: 3.5, dur, gain: 0.32 + power * 0.1, attack: 0.03 });
        noise(t + 0.02, { type: "highpass", f0: 3000, f1: 6000, dur: dur * 0.8, gain: 0.08, attack: 0.02 });
      } else {
        noise(t, { f0: vary(600), f1: vary(1900), q: 1.4, dur, gain: 0.28 + power * 0.1, attack: 0.025 });
      }
      if (power >= 2) noise(t, { type: "lowpass", f0: 500, f1: 220, dur: 0.18, gain: 0.25, attack: 0.04 });
    },

    // contact. kind: "fist" (glove on body) or "stick" (hard wood on body)
    hit(kind = "fist", power = 0, crit = false) {
      if (!ready()) return;
      const t = ctx.currentTime;
      const heavy = power >= 2 || crit;
      // body thump: the weight of the blow
      tone(t, { f0: vary(150), f1: 42, dur: 0.11 + power * 0.05 + (crit ? 0.06 : 0), gain: 0.95, drive: true });
      // click transient: the first millisecond of contact
      noise(t, { type: "highpass", f0: 3500, dur: 0.014, gain: 0.45 });
      if (kind === "stick") {
        // hard wood crack
        noise(t, { f0: vary(1800, 0.1), f1: 1200, q: 5, dur: 0.07, gain: 0.85, drive: true });
        tone(t, { type: "triangle", f0: vary(620), f1: 380, dur: 0.06, gain: 0.35 });
        tone(t, { type: "square", f0: vary(1250), f1: 900, dur: 0.025, gain: 0.08 });
        noise(t, { type: "lowpass", f0: 1400, f1: 400, dur: 0.09, gain: 0.45 });
      } else {
        // leather on flesh: a wide mid slap and a dull body smack
        noise(t, { type: "lowpass", f0: vary(2600), f1: 700, dur: 0.06 + power * 0.02, gain: 0.85, drive: true });
        noise(t, { f0: vary(850), q: 1.2, dur: 0.09 + power * 0.03, gain: 0.6 });
      }
      if (heavy) {
        // sub boom and a crunchy tail for finishers and crits
        tone(t, { f0: 85, f1: 32, dur: 0.32 + (crit ? 0.12 : 0), gain: 0.9, drive: true, wet: 0.5 });
        noise(t + 0.005, { f0: 380, f1: 160, q: 0.9, dur: 0.24, gain: 0.55, drive: true, wet: 0.4 });
      }
      if (crit) noise(t, { type: "highpass", f0: 2400, f1: 5000, dur: 0.12, gain: 0.22, wet: 0.6 });
    },

    // a blow caught by a guard: dull block plus a metallic ring
    clang() {
      if (!ready()) return;
      const t = ctx.currentTime;
      tone(t, { f0: 180, f1: 60, dur: 0.1, gain: 0.7, drive: true });
      for (const [f, d, g] of [[920, 0.5, 0.22], [1390, 0.4, 0.16], [2330, 0.3, 0.12], [3170, 0.22, 0.08]]) {
        tone(t, { type: "sine", f0: f, f1: f * 0.995, dur: d, gain: g, wet: 0.5 });
      }
      noise(t, { type: "highpass", f0: 3000, dur: 0.04, gain: 0.4 });
    },

    // ground slam / shockwave
    boom(size = 1) {
      if (!ready()) return;
      const t = ctx.currentTime;
      tone(t, { f0: 70, f1: 26, dur: 0.5 * size, gain: 1, drive: true, wet: 0.6 });
      noise(t, { type: "lowpass", f0: 900, f1: 120, dur: 0.55 * size, gain: 0.8, drive: true, wet: 0.6 });
      noise(t, { f0: 1500, f1: 400, q: 0.8, dur: 0.12, gain: 0.4 });
    },

    // a body crashing to the floor
    thud() {
      if (!ready()) return;
      const t = ctx.currentTime;
      tone(t, { f0: 110, f1: 38, dur: 0.18, gain: 0.8, drive: true });
      noise(t, { type: "lowpass", f0: 500, f1: 150, dur: 0.2, gain: 0.6, wet: 0.2 });
    },

    jump() {
      if (!ready()) return;
      noise(ctx.currentTime, { f0: 400, f1: 1100, q: 1.2, dur: 0.1, gain: 0.12, attack: 0.02 });
    },

    // ultimate: low surge into a hit of air
    ult() {
      if (!ready()) return;
      const t = ctx.currentTime;
      tone(t, { type: "sawtooth", f0: 55, f1: 110, dur: 0.45, gain: 0.25, attack: 0.05, drive: true, wet: 0.5 });
      noise(t, { type: "lowpass", f0: 300, f1: 2400, dur: 0.45, gain: 0.35, attack: 0.08, wet: 0.5 });
      tone(t + 0.02, { f0: 60, f1: 30, dur: 0.6, gain: 0.7, wet: 0.6 });
    },

    // power building up (charged skills)
    charge(sec = 1) {
      if (!ready()) return;
      const t = ctx.currentTime;
      tone(t, { type: "sawtooth", f0: 70, f1: 240, dur: sec, gain: 0.16, attack: sec * 0.8, drive: true });
      noise(t, { type: "bandpass", f0: 300, f1: 2000, q: 2, dur: sec, gain: 0.18, attack: sec * 0.8 });
    },

    // boxing ring bell
    bell(times = 1) {
      if (!ready()) return;
      for (let i = 0; i < times; i++) {
        const t = ctx.currentTime + i * 0.28;
        for (const [f, d, g] of [[1180, 1.2, 0.2], [2870, 0.8, 0.09], [3990, 0.5, 0.05], [590, 1.0, 0.08]]) {
          tone(t, { type: "sine", f0: f, dur: d, gain: g, wet: 0.4 });
        }
        noise(t, { type: "highpass", f0: 4000, dur: 0.02, gain: 0.2 });
      }
    },

    // knockout: the biggest hit, then the bell
    ko() {
      if (!ready()) return;
      const t = ctx.currentTime;
      tone(t, { f0: 90, f1: 24, dur: 1.1, gain: 1, drive: true, wet: 0.8 });
      noise(t, { type: "lowpass", f0: 1600, f1: 90, dur: 1.0, gain: 0.8, drive: true, wet: 0.8 });
      setTimeout(() => SFX.bell(3), 900);
    },
  };

  window.SFX = SFX;
})();
