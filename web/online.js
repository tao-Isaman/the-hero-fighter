// mFighter online: guest login, quick match, private rooms, spectating, best-of-3 sets.
//
// Supabase (promptGov project) holds the rooms (mfighter schema, reached only through mf_* functions)
// and carries the realtime room channel: presence, picks, round control and WebRTC signalling.
// The fight itself runs on the host's screen; the guest sends inputs and draws the host's snapshots
// over a direct WebRTC data channel. If the direct link can't be made, both fall back to relaying
// through the Supabase channel. Spectators get snapshots through the channel at a lower rate.
(() => {
  "use strict";
  const SUPABASE_URL = window.MF.config.url;   // see track.js
  const SUPABASE_KEY = window.MF.config.key;
  const ICE = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun.cloudflare.com:3478" }];
  const SNAP_P2P = 1 / 30, SNAP_RELAY = 1 / 15, SNAP_SPEC = 1 / 10;   // seconds between snapshots
  const WINS = 2;                                                       // best of 3
  const BOT_WAIT = 20;                                                  // seconds of searching before a bot steps in

  // ---------- bots: always "online", they run in this browser (no server) ----------
  // Each persona plays differently. Sets against bots are labeled BOT and never rated.
  // ai: see newFighter in game.js (react = reaction time range, the rest are chances 0..1)
  const BOTS = [
    { id: "rush", name: "BOT ไอ้หนุ่มสายบุก", style: "บุกไม่ยั้ง กระโดดเข้าหาบ่อย",
      ai: { react: [0.14, 0.24], aggression: 0.88, jumpIn: 0.3, skillUse: 0.35, flee: 0.12, counterUse: 0.4, ultHp: 0.7, idle: 0.03, whiff: 0.15, lowHpRun: 0, walkBack: 0.2 } },
    { id: "guard", name: "BOT น้าเฒ่าสายรับ", style: "รอสวนกลับ ถอยเก่ง",
      ai: { react: [0.16, 0.28], aggression: 0.5, jumpIn: 0.08, skillUse: 0.25, flee: 0.45, counterUse: 0.9, ultHp: 0.5, idle: 0.08, whiff: 0.05, lowHpRun: 0.6, walkBack: 0.75 } },
    { id: "rookie", name: "BOT น้องใหม่หัดเล่น", style: "กดสกิลรัว ตอบสนองช้า",
      ai: { react: [0.3, 0.5], aggression: 0.55, jumpIn: 0.2, skillUse: 0.55, flee: 0.15, counterUse: 0.2, ultHp: 1, idle: 0.15, whiff: 0.4, lowHpRun: 0, walkBack: 0.5 } },
    { id: "zoner", name: "BOT ยิงไกลไม่ให้เข้า", style: "ใช้สกิลคุมระยะ ไม่ค่อยเข้าใกล้",
      ai: { react: [0.18, 0.3], aggression: 0.6, jumpIn: 0.05, skillUse: 0.6, flee: 0.4, counterUse: 0.6, ultHp: 0.6, idle: 0.05, whiff: 0.1, lowHpRun: 0.4, walkBack: 0.7 } },
    { id: "pro", name: "BOT จอมเก๋า", style: "เล่นครบเครื่อง อ่านเกมไว",
      ai: { react: [0.12, 0.22], aggression: 0.78, jumpIn: 0.2, skillUse: 0.32, flee: 0.3, counterUse: 0.75, ultHp: 0.55, idle: 0.02, whiff: 0.04, lowHpRun: 0.4, walkBack: 0.5 } },
  ];
  const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffled = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
  function botLoadout(kit) {
    const sk = G.skills(kit);
    return [...shuffled(sk.normals).slice(0, 2).map((x) => x.id), pickOne(sk.ults).id];
  }

  const G = window.MFighterNet;
  const NET = G.NET;
  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  const home = $("#home"), online = $("#online"), panel = $("#online .on-panel"), netbar = $("#netbar"), charsel = $("#charsel");
  let sb = null;
  function client() {
    if (!sb) sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: 40 } },
    });
    return sb;
  }
  const rpc = async (fn, args) => {
    const { data, error } = await client().rpc(fn, args);
    if (error) throw new Error(error.message);
    return data;
  };

  // ---------- guest identity (kept on this device, see track.js) ----------
  const saveMe = (p) => window.MF.savePlayer(p);
  const track = (type, data) => window.MF.track(type, data);
  let player = window.MF.player();
  let myRating = null;                 // { rating, rank, matches, wins, losses } from mf_hello

  // ---------- screens ----------
  function show(which) {
    home.hidden = which !== "home";
    online.hidden = which !== "online";
    if (which !== "offline" && charsel) charsel.hidden = true;
  }
  function screen(title, note) {
    panel.textContent = "";
    const head = el("div", "pick-head");
    head.append(el("h2", null, title));
    if (note) head.append(el("p", "pick-note", note));
    panel.append(head);
    return panel;
  }
  function button(text, cls, onClick) {
    const b = el("button", cls || "pick-done", text);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  }
  function errorLine(msg) { window.SFX?.ui?.("error"); const p = el("p", "on-err", msg); panel.append(p); return p; }

  // home: the first thing every visit shows
  $("#home-cpu").addEventListener("click", () => { track("screen", { name: "cpu" }); show("offline"); charsel.hidden = false; charsel.querySelector(".sel-start")?.focus(); });
  $("#home-online").addEventListener("click", () => { show("online"); player.name ? lobby() : login(); });
  $("#home-rank").addEventListener("click", () => { show("online"); leaderboard(); });
  addEventListener("mfighter:home", () => { if (!room) { show("home"); track("screen", { name: "home" }); } });
  for (const b of document.querySelectorAll("[data-home]")) b.addEventListener("click", () => { leaveRoom(); show("home"); });

  function login() {
    track("screen", { name: "login" });
    const p = screen("เล่นออนไลน์", "เข้าเล่นแบบ Guest ไม่ต้องสมัคร ชื่อนี้จะแสดงให้คู่ต่อสู้เห็น");
    const form = el("form", "on-form");
    const input = el("input", "on-input");
    input.maxLength = 20; input.placeholder = "ชื่อของคุณ"; input.value = player.name || ""; input.autocomplete = "nickname";
    form.append(input, button("เข้าเล่นแบบ Guest", "pick-done"));
    form.addEventListener("submit", (e) => e.preventDefault());
    form.querySelector("button").type = "submit";
    form.addEventListener("submit", () => {
      const name = input.value.trim().slice(0, 20);
      if (!name) { input.focus(); return; }
      player.name = name; saveMe(player); myRating = null; lobby();
    });
    p.append(form, footer());
    setTimeout(() => input.focus(), 50);
  }
  function footer(extra = []) {
    const f = el("div", "sel-foot");
    f.append(...extra, button("หน้าแรก", "sel-back", () => { leaveRoom(); show("home"); }));
    return f;
  }

  // ---------- small building blocks: tabs and pages instead of long scrolling screens ----------
  const perPage = () => (innerHeight < 520 ? 4 : 8);
  function tabs(p, names, current, onPick, cls = "") {
    const bar = el("div", "on-tabs " + cls);
    names.forEach((n, i) => bar.append(button(n, "sel-back" + (i === current ? " on" : ""), () => onPick(i))));
    p.append(bar);
    const pane = el("div", "on-pane");
    p.append(pane);
    return pane;
  }
  function pager(pane, items, renderItem, emptyText) {
    let page = 0;
    const list = el("ol", "on-board"), nav = el("div", "on-pager");
    const draw = () => {
      const per = perPage(), pages = Math.max(1, Math.ceil(items.length / per));
      page = Math.min(page, pages - 1);
      list.textContent = "";
      if (!items.length) list.append(el("li", "on-empty", emptyText));
      for (const it of items.slice(page * per, (page + 1) * per)) list.append(renderItem(it));
      nav.textContent = "";
      if (pages > 1) nav.append(button("‹", "sel-back", () => { page = Math.max(0, page - 1); draw(); }), el("span", null, `${page + 1} / ${pages}`),
        button("›", "sel-back", () => { page = Math.min(pages - 1, page + 1); draw(); }));
    };
    draw();
    pane.append(list, nav);
    return { set(next) { items = next; draw(); } };
  }

  // ---------- lobby: play (matchmaking, friends) | watch ----------
  let lobbyTimer = null, lobbyTab = 0;   // 0 play, 1 watch
  function lobby() {
    clearInterval(lobbyTimer);
    show("online");
    track("screen", { name: "lobby" });
    const p = screen("ล็อบบี้ออนไลน์", `สวัสดี ${player.name} · แข่ง 2 ใน 3 ยก`);
    const mine = el("p", "on-me", "");
    p.append(mine);
    const showMine = () => { if (myRating) mine.textContent = myRating.matches ? `คะแนน ${myRating.rating} · อันดับ ${myRating.rank} · ชนะ ${myRating.wins} แพ้ ${myRating.losses}` : `คะแนนเริ่มต้น ${myRating.rating} · ชนะเกมออนไลน์เพื่อขึ้นอันดับ`; };
    if (myRating) showMine();
    else rpc("mf_hello", { p_player: player.id, p_name: player.name }).then((r) => { myRating = r; showMine(); }).catch(() => {});
    const pane = tabs(p, ["เล่น", "ดูการแข่ง"], lobbyTab, (i) => { lobbyTab = i; lobby(); });
    if (lobbyTab === 0) {
      const quick = button("จับคู่ด่วน", "pick-done big", () => run(quick, quickMatch));
      quick.append(el("small", null, "หาคู่ต่อสู้ที่คะแนนใกล้เคียงให้อัตโนมัติ"));
      const friends = el("div", "on-friends");
      const create = button("สร้างห้องเล่นกับเพื่อน", "sel-back", () => run(create, async () => {
        track("online", { action: "create" });
        enterRoom(await rpc("mf_create_room", { p_player: player.id, p_name: player.name, p_public: false }));
      }));
      const join = el("form", "on-form");
      const code = el("input", "on-input code");
      code.maxLength = 5; code.placeholder = "รหัสห้อง"; code.autocapitalize = "characters";
      const go = button("เข้าห้อง", "sel-back");
      go.type = "submit";
      join.append(code, go);
      join.addEventListener("submit", (e) => {
        e.preventDefault();
        if (code.value.trim().length < 5) { code.focus(); return; }
        run(go, async () => { track("online", { action: "join" }); enterRoom(await rpc("mf_join_room", { p_code: code.value, p_player: player.id, p_name: player.name })); });
      });
      friends.append(create, join);
      pane.append(quick, friends);
    } else {
      const list = pager(pane, [], roomRow, "ยังไม่มีการแข่งตอนนี้");
      const refresh = async () => {
        if (online.hidden || !panel.contains(pane)) { clearInterval(lobbyTimer); return; }
        try { list.set(await rpc("mf_list_rooms", {})); } catch (_) { /* keep the last list */ }
      };
      refresh();
      lobbyTimer = setInterval(refresh, 5000);
    }
    p.append(footer([button("อันดับ", "sel-back", leaderboard), button("เปลี่ยนชื่อ", "sel-back", login)]));
  }
  function roomRow(r) {
    const li = el("li", "on-row wide");
    li.append(el("span", null, `${r.host_name}  vs  ${r.guest_name}`), el("i", r.status, r.status === "playing" ? "กำลังสู้" : "เตรียมตัว"),
      button("ดู", "sel-back", () => spectate(r)));
    return li;
  }
  async function run(btn, fn) {
    btn.disabled = true;
    panel.querySelector(".on-err")?.remove();
    try { await fn(); } catch (err) {
      const m = /full/.test(err.message) ? "ห้องเต็มแล้ว" : /not found/.test(err.message) ? "ไม่พบห้องนี้" : "เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง";
      errorLine(m);
    }
    btn.disabled = false;
  }

  // matchmaking: join the closest open search, or start one and wait to be found
  async function quickMatch() {
    track("online", { action: "quick" });
    const info = await rpc("mf_quick_match", { p_player: player.id, p_name: player.name });
    await enterRoom(info, true);
  }
  function startSearching() {
    const r = room;
    r.searchStart = performance.now();
    r.searchTimer = setInterval(async () => {
      if (room !== r || r.present.guest) return;
      const secs = Math.floor((performance.now() - r.searchStart) / 1000);
      const t = panel.querySelector(".on-search b");
      if (t) t.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
      if (secs % 5 === 4) {
        // someone who started searching earlier is waiting too: go to them
        try {
          const older = await rpc("mf_quick_match", { p_player: player.id, p_name: player.name, p_from: r.id });
          if (older && room === r && !r.present.guest) { await enterRoom(older, true); return; }
        } catch (_) { /* try again next time */ }
      }
      if (secs % 30 === 29) rpc("mf_touch", { p_id: r.id, p_token: r.token }).catch(() => {});
      // nobody around: a bot takes the seat (closest rating first, like a real match)
      if (secs >= BOT_WAIT && room === r && !r.present.guest) { track("online", { action: "bot", room: "auto" }); startBot(pickOne(BOTS)); }
    }, 1000);
  }

  // ---------- the room ----------
  // room: { id, code, token, role: host|guest|spec }, plus live state
  let room = null;
  function blankRoom(info) {
    return {
      ...info, channel: null, phase: "lobby", score: { p1: 0, p2: 0 }, round: 0, setNo: 1, rated: null,
      picks: { host: null, guest: null }, names: { host: "", guest: "" }, present: { host: false, guest: false }, specs: 0,
      pc: null, dc: null, link: "none", relayTimer: null, pendingIce: [], snapT: 0, specT: 0, lastIn: "", lastInT: 0, heartbeat: null,
    };
  }
  const mySeat = () => (room.role === "host" ? "host" : "guest");
  const otherSeat = () => (room.role === "host" ? "guest" : "host");

  async function enterRoom(info, matchmaking = false) {
    clearInterval(lobbyTimer);
    leaveRoom(true);
    room = blankRoom(info);
    room.mm = matchmaking;
    room.names[mySeat()] = player.name;
    track("screen", { name: "room" });
    track("online", { action: info.role === "host" ? "host" : "join", room: info.code });
    const sk = G.skills(G.roster()[0].id);
    room.picks[mySeat()] = { kit: G.roster()[0].id, loadout: sk.loadout, ready: false };
    await joinChannel();
    room.heartbeat = setInterval(() => rpc("mf_set_status", { p_id: room.id, p_token: room.token, p_status: room.phase === "lobby" ? "waiting" : "playing" }).catch(() => {}), 60000);
    if (room.mm && room.role === "host") startSearching();
    renderRoom();
  }

  // a room with a bot in the guest seat: no channel, no server, the fight runs here
  function startBot(bot) {
    clearInterval(lobbyTimer);
    leaveRoom(true);
    room = blankRoom({ id: null, token: null, code: "BOT", role: "host" });
    room.mm = true;
    room.bot = bot;
    room.link = "bot";
    room.names.host = player.name;
    room.names.guest = bot.name;
    room.present = { host: true, guest: true };
    const roster = G.roster();
    const last = (() => { try { return JSON.parse(localStorage.getItem("mfighter.onlinePick") || "null"); } catch (_) { return null; } })();
    const kit = last && roster.some((c) => c.id === last) ? last : roster[0].id;
    room.picks.host = { kit, loadout: G.skills(kit).loadout, ready: false };
    track("screen", { name: "room" });
    botPick(false);
    renderRoom();
  }
  // the bot takes a moment to choose, like a person would
  function botPick(between) {
    const r = room;
    const later = (ms, fn) => setTimeout(() => { if (room === r && (r.phase === "lobby" || r.phase === "between")) fn(); }, ms);
    if (!between || Math.random() < 0.35) {
      later(between ? 800 : 1200 + Math.random() * 1500, () => {
        const kit = between ? r.picks.guest.kit : pickOne(G.roster()).id;
        r.picks.guest = { kit, loadout: botLoadout(kit), ready: false };
        renderRoom();
      });
    }
    later((between ? 2000 : 3500) + Math.random() * 3000, () => {
      if (!r.picks.guest) { botPick(between); return; }
      r.picks.guest.ready = true;
      renderRoom(); maybeStart();
    });
  }

  function joinChannel() {
    return new Promise((resolve) => {
      const ch = client().channel("mf-room-" + room.id, { config: { broadcast: { self: false, ack: false }, presence: { key: player.id } } });
      room.channel = ch;
      ch.on("presence", { event: "sync" }, onPresence);
      ch.on("broadcast", { event: "pick" }, ({ payload }) => onPick(payload));
      ch.on("broadcast", { event: "sig" }, ({ payload }) => onSignal(payload));
      ch.on("broadcast", { event: "round" }, ({ payload }) => onRound(payload));
      ch.on("broadcast", { event: "roundEnd" }, ({ payload }) => onRoundEnd(payload));
      ch.on("broadcast", { event: "snap" }, ({ payload }) => onSpecSnap(payload));
      ch.on("broadcast", { event: "gsnap" }, ({ payload }) => { if (room.role === "guest" && room.link === "relay") G.apply(payload); });
      ch.on("broadcast", { event: "in" }, ({ payload }) => { if (room.role === "host") onInput(payload); });
      ch.on("broadcast", { event: "relay" }, () => useRelay());
      ch.on("broadcast", { event: "hello" }, () => sendPick());
      ch.subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        ch.track({ role: room.role, name: player.name });
        if (room.role !== "spec") sendPick();
        ch.send({ type: "broadcast", event: "hello", payload: {} });
        resolve();
      });
    });
  }
  function send(event, payload) { room?.channel?.send({ type: "broadcast", event, payload }); }

  function onPresence() {
    if (!room) return;
    const st = room.channel.presenceState();
    const metas = Object.values(st).flat();
    const had = { ...room.present };
    room.present.host = metas.some((m) => m.role === "host");
    room.present.guest = metas.some((m) => m.role === "guest");
    room.specs = metas.filter((m) => m.role === "spec").length;
    for (const m of metas) if (m.role !== "spec") room.names[m.role] = m.name;
    if (room.role === "host" && room.present.guest && !had.guest) startLink();
    // the other player left in the middle of a set
    if (room.role !== "spec" && had[otherSeat()] && !room.present[otherSeat()]) opponentLeft();
    if (room.role === "spec" && had.host && !room.present.host) { netbarText("ห้องปิดแล้ว"); }
    updateNetbar();
    if (room.phase === "lobby" || room.phase === "between" || room.phase === "result") renderRoom();
  }

  function sendPick() {
    if (!room || room.role === "spec") return;
    send("pick", { seat: mySeat(), name: player.name, ...room.picks[mySeat()] });
  }
  function onPick(p) {
    if (!room || p.seat === mySeat()) return;
    room.picks[p.seat] = { kit: p.kit, loadout: p.loadout, ready: !!p.ready };
    room.names[p.seat] = p.name;
    if (room.phase !== "fight") renderRoom();
    maybeStart();
  }

  // ---------- room screen: seats on top, then tabs: fighter | skills | ultimate ----------
  function renderRoom() {
    if (!room || room.role === "spec") return;
    if (room.phase === "fight") return;
    show("online");
    const between = room.phase === "between";
    const result = room.phase === "result";
    const waiting = !room.present[otherSeat()];
    if (room.mm && waiting && room.phase === "lobby") { room.wasSearching = true; return renderSearching(); }
    if (room.wasSearching || (room.bot && !room.foundSfx)) { room.wasSearching = false; room.foundSfx = true; window.SFX?.ui?.("found"); }
    const title = result ? resultTitle() : between ? `ยกที่ ${room.round + 1}` : room.bot ? "ดวลกับบอท" : room.mm ? "พบคู่ต่อสู้!" : `ห้อง ${room.code}`;
    const note = result ? "" : between ? "เลือกสกิลใหม่ได้ก่อนยกถัดไป" : waiting ? "ส่งรหัสห้องให้เพื่อนเพื่อเข้ามาเล่น"
      : room.bot ? `${room.bot.style} · ไม่นับคะแนน` : "เลือกตัวละครและสกิล แล้วกดพร้อม";
    const p = screen(title, note);
    const seats = el("div", "on-seats");
    for (const seat of ["host", "guest"]) {
      const s = el("div", "on-seat" + (seat === mySeat() ? " me" : ""));
      const pick = room.picks[seat];
      const here = seat === mySeat() || room.present[seat];
      if (here && pick) s.append(G.portrait(pick.kit, 48));
      const info = el("div");
      info.append(el("b", null, here ? room.names[seat] || "…" : "ว่าง"));
      info.append(el("span", null, here && pick ? window.CHARACTERS[pick.kit].name : room.bot ? "กำลังเลือก…" : seat === "guest" ? "รอผู้เล่น" : ""));
      s.append(info, el("em", null, String(room.score[seat === "host" ? "p1" : "p2"])));
      if (here && pick && pick.ready && !result) s.append(el("i", "ready", "พร้อม"));
      seats.append(s);
    }
    p.append(seats);
    if (result) {
      const rt = room.rated;
      const won = room.score[room.role === "host" ? "p1" : "p2"] >= WINS;
      p.append(el("p", "on-me", room.bot ? "เกมกับบอท ไม่นับคะแนน" : !rt || rt.status === "sending" || rt.status === "pending" ? "กำลังบันทึกผล…"
        : rt.status === "confirmed" ? `คะแนน ${won ? "+" : "−"}${rt.delta}` : rt.status === "disputed" ? "ผลไม่ตรงกัน เกมนี้ไม่นับคะแนน" : "บันทึกผลไม่สำเร็จ"));
      const again = room.mm ? button("หาคู่ใหม่", "pick-done", () => { leaveRoom(true); run(again, quickMatch); }) : button("แข่งอีกครั้ง", "pick-done", rematch);
      p.append(footer([again, button("ออกจากห้อง", "sel-back", () => { leaveRoom(); lobby(); })]));
      return;
    }
    const mine = room.picks[mySeat()];
    const sk = G.skills(mine.kit);
    const normals = mine.loadout.filter((id) => sk.normals.some((x) => x.id === id));
    const ult = mine.loadout.find((id) => sk.ults.some((x) => x.id === id));
    const names = between ? ["สกิล (2)", "ไม้ตาย (1)"] : ["ตัวละคร", "สกิล (2)", "ไม้ตาย (1)"];
    const keys = between ? ["skills", "ult"] : ["fighter", "skills", "ult"];
    if (!keys.includes(room.tab)) room.tab = keys[0];
    const pane = tabs(p, names, keys.indexOf(room.tab), (i) => { room.tab = keys[i]; renderRoom(); });
    const goTab = (t) => { room.tab = t; };
    if (room.tab === "fighter") {
      const list = el("ul", "char-list on-chars");
      for (const c of G.roster()) {
        const li = el("li");
        const b = el("button", "char" + (mine.kit === c.id ? " on" : ""));
        b.type = "button";
        b.append(G.portrait(c.id, 48), el("span", null, c.name));
        b.addEventListener("click", () => {
          if (mine.ready) return;
          room.picks[mySeat()] = { kit: c.id, loadout: G.skills(c.id).loadout, ready: false };
          try { localStorage.setItem("mfighter.onlinePick", JSON.stringify(c.id)); } catch (_) { /* ignore */ }
          goTab("skills");
          sendPick(); renderRoom();
        });
        li.append(b); list.append(li);
      }
      pane.append(list);
    } else {
      const card = (x, on, onClick) => {
        const li = el("li");
        const b = el("button", "pick" + (x.ult ? " ult" : "") + (on ? " on" : ""));
        b.type = "button";
        const img = el("img"); img.src = x.icon; img.alt = "";
        b.append(img, el("span", "pn", x.name), el("span", "pd", x.desc), el("span", "pc", (x.ult ? "ULT · " : "") + "CD " + x.cd + "s"));
        b.addEventListener("click", onClick);
        li.append(b); return li;
      };
      const setLoadout = (n, u) => { room.picks[mySeat()] = { ...mine, loadout: [...n, u].filter(Boolean), ready: false }; sendPick(); renderRoom(); };
      const ul = el("ul", "pick-list");
      if (room.tab === "skills") {
        for (const x of sk.normals) ul.append(card(x, normals.includes(x.id), () => {
          if (mine.ready) return;
          let n = normals.includes(x.id) ? normals.filter((y) => y !== x.id) : [...normals, x.id];
          if (n.length > 2) n = n.slice(1);
          if (n.length === 2 && !normals.includes(x.id)) goTab("ult");
          setLoadout(n, ult);
        }));
      } else {
        for (const x of sk.ults) ul.append(card(x, ult === x.id, () => { if (!mine.ready) setLoadout(normals, x.id); }));
      }
      pane.append(ul);
    }
    const ok = normals.length === 2 && !!ult;
    const ready = button(mine.ready ? "ยกเลิกพร้อม" : "พร้อม", "pick-done", () => {
      if (!ok) return;
      room.picks[mySeat()] = { ...mine, ready: !mine.ready };
      try { localStorage.setItem(`mfighter.skills.${mine.kit}`, JSON.stringify(mine.loadout)); } catch (_) { /* ignore */ }
      sendPick(); renderRoom(); maybeStart();
    });
    ready.disabled = !ok;
    const foot = footer([el("span", "on-link", linkText()), button("ออกจากห้อง", "sel-back", () => { leaveRoom(); lobby(); }), ready]);
    p.append(foot);
  }
  function renderSearching() {
    const p = screen("กำลังหาคู่ต่อสู้…", "จะจับคู่กับผู้เล่นที่คะแนนใกล้เคียงที่สุด");
    const box = el("div", "on-search");
    box.append(el("b", null, "0:00"), el("span", null, (myRating ? `คะแนนของคุณ ${myRating.rating} · ` : "") + `ถ้าไม่เจอผู้เล่นใน ${BOT_WAIT} วิ จะจับคู่กับบอท`));
    p.append(box, footer([button("ยกเลิก", "sel-back", () => { leaveRoom(true); lobby(); })]));
  }
  function resultTitle() {
    const won = room.score[room.role === "host" ? "p1" : "p2"] >= WINS;
    return won ? `ชนะ ${room.score.p1} - ${room.score.p2}` : `แพ้ ${room.score.p1} - ${room.score.p2}`;
  }
  function rematch() {
    room.phase = "lobby"; room.score = { p1: 0, p2: 0 }; room.round = 0; room.setNo += 1; room.rated = null;
    room.picks[mySeat()].ready = false;
    sendPick(); renderRoom();
  }

  // ---------- starting rounds (the host decides) ----------
  function maybeStart() {
    if (!room || room.role !== "host") return;
    if (!(room.phase === "lobby" || room.phase === "between")) return;
    const h = room.picks.host, g = room.picks.guest;
    if (!h || !g || !h.ready || !g.ready || !room.present.guest) return;
    if (room.link === "none") { setTimeout(maybeStart, 500); return; }   // still connecting
    const stages = G.stages();
    const cfg = {
      round: room.round, setNo: room.setNo, score: room.score, stage: stages[Math.floor(Math.random() * stages.length)],
      p1: { kit: h.kit, loadout: h.loadout, name: room.names.host }, p2: { kit: g.kit, loadout: g.loadout, name: room.names.guest },
    };
    send("round", cfg);
    onRound(cfg);
  }
  function onRound(cfg) {
    if (!room) return;
    room.phase = "fight";
    room.round = cfg.round;
    if (cfg.setNo) room.setNo = cfg.setNo;   // the host numbers the sets
    room.score = { ...cfg.score };
    if (room.role === "spec") { G.start({ ...cfg, mode: "spectate", me: "p1" }); show("none"); updateNetbar(); return; }
    room.picks.host.ready = false;
    if (room.picks.guest) room.picks.guest.ready = false;
    show("none");
    if (room.bot) {
      G.start({ ...cfg, mode: "bot", me: "p1", p2: { ...cfg.p2, ai: room.bot.ai } });
      if (cfg.round === 0) track("match_start", { mode: "bot", bot: room.bot.id, p1_kit: cfg.p1.kit, p2_kit: cfg.p2.kit, p1_loadout: cfg.p1.loadout, p2_loadout: cfg.p2.loadout });
      NET.onRoundOver = (side) => hostRoundOver(side);
    } else if (room.role === "host") {
      G.start({ ...cfg, mode: "host", me: "p1" });
      if (cfg.round === 0) track("match_start", { mode: "online", p1_kit: cfg.p1.kit, p2_kit: cfg.p2.kit, p1_loadout: cfg.p1.loadout, p2_loadout: cfg.p2.loadout });
      NET.onRoundOver = (side) => hostRoundOver(side);
      NET.tick = hostTick;
      rpc("mf_set_status", { p_id: room.id, p_token: room.token, p_status: "playing" }).catch(() => {});
    } else {
      G.start({ ...cfg, mode: "guest", me: "p2" });
      NET.sendInput = guestInput;
    }
    updateNetbar();
  }
  function hostRoundOver(side) {
    room.score[side] += 1;
    const setOver = room.score[side] >= WINS;
    const payload = { winner: side, score: room.score, setOver };
    send("roundEnd", payload);
    onRoundEnd(payload);
  }
  function onRoundEnd(p) {
    if (!room) return;
    room.score = { ...p.score };
    room.round += p.setOver ? 0 : 1;
    room.phase = p.setOver ? "result" : "between";
    updateNetbar();
    if (room.role === "spec") return;
    NET.tick = null;
    if (room.bot) {
      if (p.setOver) track("match_end", { mode: "bot", bot: room.bot.id, winner: p.winner, score: room.score, p1_kit: room.picks.host?.kit, p2_kit: room.picks.guest?.kit, rated: false });
      else botPick(true);
      renderRoom();
      return;
    }
    if (p.setOver) reportSet(p.winner);
    if (room.role === "host" && p.setOver) rpc("mf_set_status", { p_id: room.id, p_token: room.token, p_status: "waiting" }).catch(() => {});
    renderRoom();
  }

  // both players report the finished set; the server rates it when the two reports agree
  async function reportSet(winnerSide) {
    const r = room;
    const report = {
      set_no: r.setNo, winner: winnerSide === "p1" ? "host" : "guest", score: { host: r.score.p1, guest: r.score.p2 },
      host_kit: r.picks.host?.kit, guest_kit: r.picks.guest?.kit,
    };
    r.rated = { status: "sending" };
    if (r.role === "host") track("match_end", { mode: "online", winner: winnerSide, score: r.score, p1_kit: report.host_kit, p2_kit: report.guest_kit });
    try {
      for (let i = 0; i < 6; i++) {           // the other report may land a moment later
        const res = await rpc("mf_report_match", { p_room: r.id, p_token: r.token, p_report: report });
        r.rated = res;
        if (res.status !== "pending") break;
        await new Promise((ok) => setTimeout(ok, 1500));
      }
    } catch (err) { r.rated = { status: "error" }; track("error", { where: "report", msg: String(err.message).slice(0, 120) }); }
    myRating = null;
    if (room === r && r.phase === "result") renderRoom();
  }

  // ---------- during a round ----------
  function hostTick(dt) {
    room.snapT += dt;
    room.specT += dt;
    const every = room.link === "p2p" ? SNAP_P2P : SNAP_RELAY;
    if (room.snapT >= every) {
      room.snapT = 0;
      const s = G.snapshot(false);
      if (room.link === "p2p" && room.dc && room.dc.readyState === "open") room.dc.send(JSON.stringify({ t: "s", s }));
      else if (room.link === "relay") send("gsnap", s);
    }
    if (room.specs > 0 && room.specT >= SNAP_SPEC) {
      room.specT = 0;
      send("snap", { s: G.snapshot(true), score: room.score, round: room.round, names: room.names });
    } else if (room.specs === 0) NET.specEvents.length = 0;
  }
  function onInput(p) {
    const k = NET.remote.keys;
    k.clear();
    for (const a of p.k || []) k.add(a);
    for (const a of p.p || []) NET.remote.pressed.add(a);
  }
  function guestInput(keys, pressed) {
    const sig = keys.sort().join(",");
    const now = performance.now();
    if (!pressed.length && sig === room.lastIn && now - room.lastInT < 250) return;   // nothing new
    room.lastIn = sig; room.lastInT = now;
    const msg = { k: keys, p: pressed.filter((a) => a !== "restart") };
    if (room.link === "p2p" && room.dc && room.dc.readyState === "open") room.dc.send(JSON.stringify({ t: "i", ...msg }));
    else send("in", msg);
  }

  // ---------- spectators ----------
  async function spectate(r) {
    clearInterval(lobbyTimer);
    track("online", { action: "spectate", room: r.code });
    leaveRoom(true);
    room = blankRoom({ id: r.id, code: r.code, role: "spec" });
    room.names = { host: r.host_name, guest: r.guest_name || "" };
    await joinChannel();
    show("none");
    netbar.hidden = false;
    netbarText(r.status === "playing" ? "กำลังโหลดภาพการแข่ง…" : "รอการแข่งเริ่ม…");
  }
  function onSpecSnap(p) {
    if (!room || room.role !== "spec") return;
    room.score = p.score; room.round = p.round; room.names = p.names;
    if (NET.mode !== "spectate") {
      const s = p.s;
      G.start({ mode: "spectate", me: "p1", stage: s.bg, p1: { kit: s.p1.kit, loadout: s.p1.loadout, name: p.names.host }, p2: { kit: s.p2.kit, loadout: s.p2.loadout, name: p.names.guest } });
      show("none");
    }
    G.apply(p.s);
    updateNetbar();
  }

  // ---------- the direct link (WebRTC) ----------
  function startLink() {
    if (room.pc) closeLink();
    const pc = new RTCPeerConnection({ iceServers: ICE });
    room.pc = pc;
    room.link = "none";
    pc.onicecandidate = (e) => { if (e.candidate) send("sig", { to: "guest", ice: e.candidate }); };
    const dc = pc.createDataChannel("game", { ordered: true });
    wireDC(dc);
    pc.createOffer().then((o) => pc.setLocalDescription(o)).then(() => send("sig", { to: "guest", sdp: pc.localDescription }));
    armRelayTimer();
  }
  async function onSignal(m) {
    if (!room || room.role === "spec") return;
    if (m.to !== mySeat()) return;
    if (m.sdp && m.sdp.type === "offer") {
      if (room.pc) closeLink();
      const pc = new RTCPeerConnection({ iceServers: ICE });
      room.pc = pc;
      room.link = "none";
      pc.onicecandidate = (e) => { if (e.candidate) send("sig", { to: "host", ice: e.candidate }); };
      pc.ondatachannel = (e) => wireDC(e.channel);
      await pc.setRemoteDescription(m.sdp);
      for (const c of room.pendingIce.splice(0)) await pc.addIceCandidate(c).catch(() => {});
      const a = await pc.createAnswer();
      await pc.setLocalDescription(a);
      send("sig", { to: "host", sdp: pc.localDescription });
      armRelayTimer();
    } else if (m.sdp && m.sdp.type === "answer" && room.pc) {
      await room.pc.setRemoteDescription(m.sdp);
      for (const c of room.pendingIce.splice(0)) await room.pc.addIceCandidate(c).catch(() => {});
    } else if (m.ice) {
      if (room.pc && room.pc.remoteDescription) await room.pc.addIceCandidate(m.ice).catch(() => {});
      else room.pendingIce.push(m.ice);
    }
  }
  function wireDC(dc) {
    room.dc = dc;
    dc.onopen = () => { clearTimeout(room.relayTimer); room.link = "p2p"; track("link", { kind: "p2p" }); updateNetbar(); if (room.phase !== "fight") renderRoom(); maybeStart(); };
    dc.onclose = () => { if (room && room.link === "p2p") useRelay(); };
    dc.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.t === "s" && room.role === "guest") G.apply(m.s);
      else if (m.t === "i" && room.role === "host") onInput(m);
    };
  }
  function armRelayTimer() {
    clearTimeout(room.relayTimer);
    room.relayTimer = setTimeout(() => { if (room && room.link !== "p2p") { send("relay", {}); useRelay(); } }, 8000);
  }
  function useRelay() {
    if (!room || room.link === "relay") return;
    room.link = "relay";
    track("link", { kind: "relay" });
    updateNetbar();
    if (room.phase !== "fight") renderRoom();
    maybeStart();
  }
  function closeLink() {
    clearTimeout(room.relayTimer);
    try { room.dc?.close(); } catch (_) { /* ignore */ }
    try { room.pc?.close(); } catch (_) { /* ignore */ }
    room.pc = room.dc = null;
    room.link = "none";
  }
  function linkText() {
    if (room.bot) return "สถานะ: เล่นกับบอท (ไม่นับคะแนน)";
    if (!room.present[otherSeat()]) return "สถานะ: รอคู่ต่อสู้";
    return room.link === "p2p" ? "สถานะ: เชื่อมต่อตรง (P2P)" : room.link === "relay" ? "สถานะ: เชื่อมต่อผ่านเซิร์ฟเวอร์ (หน่วงกว่าเล็กน้อย)" : "สถานะ: กำลังเชื่อมต่อ…";
  }

  // ---------- leaving ----------
  function opponentLeft() {
    if (room.mm && room.phase === "lobby") {
      if (room.role === "guest") { leaveRoom(true); run(panel.querySelector("button") || el("button"), quickMatch); return; }
      closeLink();
      room.picks.guest = null;
      renderRoom();
      return;
    }
    if (room.phase === "fight" || room.phase === "between") {
      room.score[room.role === "host" ? "p1" : "p2"] = WINS;   // a walk-over win
      room.phase = "result";
      NET.tick = null;
      G.pause();
    }
    closeLink();
    room.picks[otherSeat()] = null;
    renderRoom();
    errorLine("คู่ต่อสู้ออกจากห้อง");
  }
  function leaveRoom(silent) {
    if (!room) return;
    const r = room;
    room = null;
    clearInterval(r.heartbeat);
    clearInterval(r.searchTimer);
    clearTimeout(r.relayTimer);
    try { r.dc?.close(); r.pc?.close(); } catch (_) { /* ignore */ }
    if (r.channel) client().removeChannel(r.channel);
    if (r.token) rpc("mf_leave_room", { p_id: r.id, p_token: r.token }).catch(() => {});
    netbar.hidden = true;
    if (NET.mode !== "offline") G.leave();
    if (!silent) show("home");
  }
  addEventListener("pagehide", () => {
    if (!room || !room.token) return;
    fetch(SUPABASE_URL + "/rest/v1/rpc/mf_leave_room", {
      method: "POST", keepalive: true,
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ p_id: room.id, p_token: room.token }),
    }).catch(() => {});
  });

  // ---------- leaderboard ----------
  async function leaderboard() {
    clearInterval(lobbyTimer);
    track("screen", { name: "leaderboard" });
    const p = screen("อันดับผู้เล่น", "คะแนน Elo เริ่ม 1000 · นับเฉพาะเกมออนไลน์ที่ทั้งสองฝั่งรายงานผลตรงกัน");
    const mine = el("p", "on-me", "");
    const pane = el("div", "on-pane");
    p.append(mine, pane, footer(player.name ? [button("ล็อบบี้", "sel-back", lobby)] : []));
    const row = (r) => {
      const li = el("li", "on-row" + (r.id === player.id ? " me" : ""));
      li.append(el("b", null, String(r.rank)), el("span", null, r.name), el("em", null, String(r.rating)),
        el("i", null, `${r.wins}-${r.losses}`), el("i", null, Math.round((100 * r.wins) / Math.max(1, r.matches)) + "%"));
      return li;
    };
    const list = pager(pane, [], row, "กำลังโหลด…");
    try {
      const rows = await rpc("mf_leaderboard", { p_limit: 100 });
      list.set(rows);
      if (!rows.length) pane.querySelector(".on-empty").textContent = "ยังไม่มีใครติดอันดับ ชนะเกมออนไลน์เกมแรกเพื่อขึ้นอันดับ";
      const me = rows.find((r) => r.id === player.id);
      mine.textContent = me ? `คุณอยู่อันดับ ${me.rank} · ${me.rating} คะแนน` : player.name ? "คุณยังไม่ติดอันดับ" : "";
    } catch (_) { pane.querySelector(".on-empty").textContent = "โหลดไม่สำเร็จ"; }
  }

  // ---------- game statistics (from the activity log) ----------
  const skillName = (key) => {
    const [kit, id] = key.split(":");
    return window.CHARACTERS[kit]?.skills[id] ? `${window.CHARACTERS[kit].skills[id].name} (${window.CHARACTERS[kit].name})` : key;
  };
  const statsView = { days: 7, tab: 0, data: null };
  async function stats(days = statsView.days, reload = true) {
    clearInterval(lobbyTimer);
    if (reload) track("screen", { name: "stats" });
    statsView.days = days;
    const p = screen("สถิติเกม", "จากการเล่นจริงทุกเครื่อง ทั้งกับ CPU และออนไลน์");
    const periods = el("div", "on-tabs small");
    for (const [d, label] of [[1, "วันนี้"], [7, "7 วัน"], [30, "30 วัน"], [null, "ทั้งหมด"]]) {
      periods.append(button(label, "sel-back" + (d === days ? " on" : ""), () => stats(d)));
    }
    p.append(periods);
    const pane = tabs(p, ["ภาพรวม", "ตัวละคร", "สกิล", "ผลล่าสุด"], statsView.tab, (i) => { statsView.tab = i; stats(days, false); });
    p.append(footer(player.name ? [button("ล็อบบี้", "sel-back", lobby)] : []));
    if (reload || !statsView.data) {
      pane.append(el("p", "on-empty", "กำลังโหลด…"));
      try { statsView.data = await rpc("mf_stats", { p_days: days }); } catch (_) { pane.textContent = "โหลดไม่สำเร็จ"; return; }
      pane.textContent = "";
    }
    const st = statsView.data;
    if (statsView.tab === 0) {
      const tiles = el("div", "on-tiles");
      const tile = (n, label) => { const t = el("div", "on-tile"); t.append(el("b", null, String(n ?? 0)), el("span", null, label)); tiles.append(t); };
      tile(st.players, "ผู้เล่น (เครื่อง)");
      tile(st.matches, "แมตช์ทั้งหมด");
      tile(st.matches_online, "แมตช์ออนไลน์");
      tile(st.matches_cpu, "แมตช์กับ CPU");
      tile(st.rounds, "ยกที่สู้");
      tile(st.avg_round_sec ? st.avg_round_sec + " วิ" : "-", "เฉลี่ยต่อยก");
      pane.append(tiles);
    } else if (statsView.tab === 1) {
      pager(pane, st.characters || [], (c) => {
        const li = el("li", "on-row char-row");
        li.append(G.portrait(c.kit, 32), el("span", null, window.CHARACTERS[c.kit]?.name || c.kit), el("em", null, c.picks + " ครั้ง"), el("i", null, "ชนะ " + c.win_rate + "%"));
        return li;
      }, "ยังไม่มีข้อมูล");
    } else if (statsView.tab === 2) {
      pager(pane, st.skills || [], (x) => { const li = el("li", "on-row wide"); li.append(el("span", null, skillName(x.skill)), el("em", null, x.uses + " ครั้ง")); return li; }, "ยังไม่มีข้อมูล");
    } else {
      pager(pane, st.recent || [], (m) => {
        const li = el("li", "on-row wide");
        li.append(el("span", null, `${m.host} (${window.CHARACTERS[m.host_kit]?.name || "?"})  ${m.score_host} - ${m.score_guest}  ${m.guest} (${window.CHARACTERS[m.guest_kit]?.name || "?"})`),
          el("em", null, "ชนะ: " + m.winner), el("i", null, "±" + m.rating_delta));
        return li;
      }, "ยังไม่มีแมตช์ออนไลน์");
    }
  }

  // ---------- the bar over the fight: score, round, connection, leave ----------
  function updateNetbar() {
    if (!room || NET.mode === "offline" && room.role !== "spec") { netbar.hidden = true; return; }
    netbar.hidden = false;
    const n = room.names;
    const tail = room.role === "spec" ? `ผู้ชม ${room.specs}` : room.bot ? "BOT" : room.link === "p2p" ? "P2P" : room.link === "relay" ? "RELAY" : "…";
    netbarText(`${n.host || "?"}  ${room.score.p1} - ${room.score.p2}  ${n.guest || "?"}  ·  ยก ${room.round + 1}  ·  ${tail}`);
  }
  function netbarText(t) { netbar.hidden = false; $("#netbar span").textContent = t; placeNetbar(); }
  // just under the health bars (they end at y = 37 of the game's 360-px-tall view), never over them
  function placeNetbar() {
    const c = document.querySelector("canvas");
    if (!c) return;
    const r = c.getBoundingClientRect();
    netbar.style.top = Math.round(r.top + (r.height * 40) / 360) + "px";
  }
  addEventListener("resize", () => { if (!netbar.hidden) placeNetbar(); });
  $("#netbar button").addEventListener("click", () => { leaveRoom(true); lobby(); });

  // menu sounds for every button on the menu screens (home, online, select, skills)
  document.addEventListener("click", (e) => {
    const b = e.target.closest?.("button");
    if (!b || b.disabled || !b.closest("#home, #online, #charsel, #picker")) return;
    const kind = b.closest(".on-tabs, .pick-tabs") ? "tab" : b.classList.contains("char") ? "select" : b.classList.contains("pick") ? "pick"
      : b.classList.contains("pick-done") ? "confirm" : /ยกเลิก|ออก|หน้าแรก|กลับ/.test(b.textContent) ? "back" : "click";
    window.SFX?.ui?.(kind);
  }, true);

  // start on the home screen; game stats are for admins only, opened by URL: /#stats
  const openStats = () => { if (location.hash === "#stats") { show("online"); stats(7); } };
  show("home");
  track("screen", { name: "home" });
  openStats();
  addEventListener("hashchange", openStats);
})();
