// mFighter: who is playing (a guest id kept on this device) and activity tracking.
//
// Every interesting moment is one event { type, data }. Events are batched and sent to the
// mf_track function, which stores them in mfighter.events (type + jsonb). New statistics need no
// schema change: add an event type (or a field) here and query it in SQL, e.g. like mf_stats does.
//
// Event types sent today:
//   session_start  { touch, w, h, standalone, lang, ref, v }
//   screen         { name }      home | cpu | online | login | lobby | room | leaderboard | stats | spectate
//   match_start    { mode, p1_kit, p2_kit, p1_loadout, p2_loadout }            mode: cpu | online
//   round_end      { mode, round, stage, secs, winner (p1|p2), p1_kit, p2_kit, p1_hp, p2_hp,
//                    p1_dmg, p2_dmg, p1_hits, p2_hits, p1_crits, p2_crits, p1_skills{kit:id: n}, p2_skills{...} }
//   match_end      { mode, winner (p1|p2), score {p1, p2}, p1_kit, p2_kit, rated, delta }
//   online         { action: quick | create | join | spectate | leave, room }
//   link           { kind: p2p | relay }
//   error          { where, msg }
// In online play only the host sends round_end / match_start (the fight runs on the host).
(() => {
  "use strict";
  const config = {
    url: (window.MF_TEST && window.MF_TEST.url) || "https://gmvykzuppjqwoypzmpvy.supabase.co",   // MF_TEST: tests only
    key: "sb_publishable_-AyofFFv1mnhhHF27E40rA_EtW8iT_P",                                         // publishable (client) key
  };
  const VERSION = 1;

  function player() {
    let p = null;
    try { p = JSON.parse(localStorage.getItem("mfighter.player") || "null"); } catch (_) { /* storage off */ }
    if (!p || !p.id) {
      const a = new Uint8Array(12);
      crypto.getRandomValues(a);
      p = { id: "g" + [...a].map((b) => b.toString(16).padStart(2, "0")).join(""), name: "" };
      savePlayer(p);
    }
    return p;
  }
  function savePlayer(p) { try { localStorage.setItem("mfighter.player", JSON.stringify(p)); } catch (_) { /* ignore */ } }

  const session = (() => { const a = new Uint8Array(8); crypto.getRandomValues(a); return [...a].map((b) => b.toString(16).padStart(2, "0")).join(""); })();
  let queue = [];
  let sending = false;

  function track(type, data = {}) {
    queue.push({ type, data, at: new Date().toISOString() });
    if (queue.length > 300) queue = queue.slice(-300);          // offline for a long time: keep the latest
    if (queue.length >= 20) flush();
  }
  async function flush(keepalive = false) {
    if (sending || !queue.length || !navigator.onLine) return;
    const batch = queue.splice(0, 50);
    sending = true;
    try {
      const res = await fetch(config.url + "/rest/v1/rpc/mf_track", {
        method: "POST", keepalive,
        headers: { apikey: config.key, "Content-Type": "application/json" },
        body: JSON.stringify({ p_player: player().id, p_session: session, p_events: batch }),
      });
      if (!res.ok) throw new Error(res.status);
    } catch (_) {
      queue = batch.concat(queue);                                // try again later
    }
    sending = false;
  }
  setInterval(flush, 10000);
  addEventListener("pagehide", () => flush(true));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(true); });

  window.MF = { config, player, savePlayer, track, flush, session };

  track("session_start", {
    touch: matchMedia("(pointer: coarse)").matches, w: innerWidth, h: innerHeight,
    standalone: matchMedia("(display-mode: standalone)").matches || navigator.standalone === true,
    lang: navigator.language, ref: document.referrer ? new URL(document.referrer).hostname : "", v: VERSION,
  });
})();
