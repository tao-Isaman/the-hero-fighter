// Music: two playlists from the manifest, each played in random order and looped.
//   menu  (MANIFEST.music)      home, character / skill select, online screens before a match
//   fight (MANIFEST.fightMusic) during fights (made by tools/compose_music.py)
// Silent on the screens between online rounds. The ♪ button (shown on menus) turns all music
// off and the choice is remembered; the game's sound switch mutes it too.
(() => {
  "use strict";
  const M = window.MANIFEST || {};
  const btn = document.getElementById("music-btn"), credit = document.getElementById("music-credit");
  const lists = { menu: M.music || [], fight: M.fightMusic || [] };
  if (!btn || (!lists.menu.length && !lists.fight.length)) return;
  const VOL = { menu: 0.45, fight: 0.3 }, FADE = 0.8;
  let on = true;
  try { on = localStorage.getItem("mfighter.music") !== "off"; } catch (_) { /* storage off */ }
  let unlocked = false;

  function player(kind) {
    const tracks = lists[kind];
    const audio = new Audio();
    audio.preload = "none";
    audio.setAttribute("playsinline", "");
    const p = { kind, audio, playing: false, order: [], last: null, fadeTimer: null };
    p.next = () => {
      if (!p.order.length) {
        p.order = tracks.map((t) => [Math.random(), t]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
        if (p.order.length > 1 && p.order[0] === p.last) p.order.push(p.order.shift());   // never the same song twice in a row
      }
      p.last = p.order.shift();
      audio.src = p.last;
    };
    p.fadeTo = (target, then) => {
      clearInterval(p.fadeTimer);
      const step = (VOL[kind] / FADE) * 0.05;
      p.fadeTimer = setInterval(() => {
        if (Math.abs(target - audio.volume) <= step) { audio.volume = target; clearInterval(p.fadeTimer); then?.(); }
        else audio.volume = Math.min(1, Math.max(0, audio.volume + Math.sign(target - audio.volume) * step));
      }, 50);
    };
    p.set = (want) => {
      if (want && !p.playing) {
        p.playing = true;
        if (!audio.src) p.next();
        audio.volume = 0;
        audio.play().then(() => p.fadeTo(VOL[kind])).catch(() => { p.playing = false; });
      } else if (!want && p.playing) {
        p.playing = false;
        p.fadeTo(0, () => { if (!p.playing) audio.pause(); });
      }
    };
    const advance = () => { p.next(); if (p.playing) audio.play().catch(() => {}); };
    audio.addEventListener("ended", advance);
    audio.addEventListener("error", () => { if (tracks.length > 1) advance(); });
    return p;
  }
  const players = { menu: player("menu"), fight: player("fight") };

  // which music this moment calls for: "menu", "fight" or null
  function context() {
    const shown = (id) => { const e = document.getElementById(id); return e && !e.hidden; };
    const menu = shown("home") || shown("online") || shown("charsel") || shown("picker");
    const net = window.MFighterNet && window.MFighterNet.NET;
    const inMatch = net && net.mode !== "offline";
    if (menu) return inMatch ? null : "menu";                    // between online rounds: quiet
    return shown("status") ? null : "fight";                     // still loading: quiet
  }
  function sync() {
    const ctx = context();
    btn.hidden = !(ctx === "menu" && unlocked);
    if (credit) credit.hidden = !(ctx === "menu" && lists.menu.length && document.getElementById("home") && !document.getElementById("home").hidden);
    btn.classList.toggle("off", !on);
    const allowed = on && unlocked && !document.hidden && !(window.SFX && window.SFX.muted);
    for (const p of Object.values(players)) p.set(allowed && ctx === p.kind && lists[p.kind].length > 0);
  }
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
  window.__mfighterMusic = players;   // tests / console
})();
