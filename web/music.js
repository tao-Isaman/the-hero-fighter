// Menu music: plays the files listed in MANIFEST.music in random order, looping the playlist,
// on the home / select / online-waiting screens. Silent during fights (and between online rounds).
// The ♪ button turns it off and the choice is remembered; the game's sound switch mutes it too.
(() => {
  "use strict";
  const tracks = (window.MANIFEST && window.MANIFEST.music) || [];
  const btn = document.getElementById("music-btn");
  if (!tracks.length || !btn) return;
  const VOL = 0.45, FADE = 0.8;
  let on = true;
  try { on = localStorage.getItem("mfighter.music") !== "off"; } catch (_) { /* storage off */ }
  const audio = new Audio();
  audio.preload = "none";
  audio.setAttribute("playsinline", "");
  let order = [], last = null, unlocked = false, playing = false, fadeTimer = null;

  function next() {
    if (!order.length) {
      order = tracks.map((t) => [Math.random(), t]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
      if (order.length > 1 && order[0] === last) order.push(order.shift());   // never the same song twice in a row
    }
    last = order.shift();
    audio.src = last;
  }
  function fadeTo(target, then) {
    clearInterval(fadeTimer);
    const step = (VOL / FADE) * 0.05;
    fadeTimer = setInterval(() => {
      const v = audio.volume + Math.sign(target - audio.volume) * step;
      if (Math.abs(target - audio.volume) <= step) { audio.volume = target; clearInterval(fadeTimer); then?.(); }
      else audio.volume = Math.min(1, Math.max(0, v));
    }, 50);
  }
  // music belongs to the menus: home, character / skill select, online screens before a match
  function menuScreen() {
    const net = window.MFighterNet && window.MFighterNet.NET;
    if (net && net.mode !== "offline") return false;                      // in an online / bot match
    const shown = (id) => { const e = document.getElementById(id); return e && !e.hidden; };
    return shown("home") || shown("online") || shown("charsel") || shown("picker");
  }
  function sync() {
    const menu = menuScreen();
    const want = menu && on && unlocked && !document.hidden && !(window.SFX && window.SFX.muted);
    btn.hidden = !(menu && unlocked);
    btn.classList.toggle("off", !on);
    if (want && !playing) {
      playing = true;
      if (!audio.src) next();
      audio.volume = 0;
      audio.play().then(() => fadeTo(VOL)).catch(() => { playing = false; });
    } else if (!want && playing) {
      playing = false;
      fadeTo(0, () => { if (!playing) audio.pause(); });
    }
  }
  audio.addEventListener("ended", () => { next(); if (playing) audio.play().catch(() => {}); });
  audio.addEventListener("error", () => { if (tracks.length > 1) { next(); if (playing) audio.play().catch(() => {}); } });
  btn.addEventListener("click", () => {
    on = !on;
    try { localStorage.setItem("mfighter.music", on ? "on" : "off"); } catch (_) { /* ignore */ }
    sync();
  });
  // browsers only allow sound after the first tap / key
  const unlock = () => { if (unlocked) return; unlocked = true; sync(); };
  for (const ev of ["pointerup", "touchend", "click", "keydown"]) addEventListener(ev, unlock, { capture: true, passive: true });
  document.addEventListener("visibilitychange", sync);
  setInterval(sync, 300);
  window.__mfighterMusic = { audio, get playing() { return playing; } };   // tests / console
})();
