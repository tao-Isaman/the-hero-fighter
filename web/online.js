// คมแฝก online: guest login, quick match, private rooms, spectating, best-of-3 sets.
//
// Supabase (promptGov project) holds the rooms (komfaek schema, reached only through kf_* functions)
// and carries the realtime room channel: presence, picks, round control and WebRTC signalling.
// The fight itself runs on the host's screen; the guest sends inputs and draws the host's snapshots
// over a direct WebRTC data channel. If the direct link can't be made, both fall back to relaying
// through the Supabase channel. Spectators get snapshots through the channel at a lower rate.
(() => {
  "use strict";
  const SUPABASE_URL = (window.KF_TEST && window.KF_TEST.url) || "https://gmvykzuppjqwoypzmpvy.supabase.co";   // KF_TEST: automated tests only
  const SUPABASE_KEY = "sb_publishable_-AyofFFv1mnhhHF27E40rA_EtW8iT_P";   // publishable (client) key
  const ICE = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun.cloudflare.com:3478" }];
  const SNAP_P2P = 1 / 30, SNAP_RELAY = 1 / 15, SNAP_SPEC = 1 / 10;   // seconds between snapshots
  const WINS = 2;                                                       // best of 3

  const G = window.KomfaekNet;
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

  // ---------- guest identity (kept on this device) ----------
  function me() {
    let p = null;
    try { p = JSON.parse(localStorage.getItem("komfaek.player") || "null"); } catch (_) { /* storage off */ }
    if (!p || !p.id) {
      const a = new Uint8Array(12); crypto.getRandomValues(a);
      p = { id: "g" + [...a].map((b) => b.toString(16).padStart(2, "0")).join(""), name: "" };
    }
    return p;
  }
  function saveMe(p) { try { localStorage.setItem("komfaek.player", JSON.stringify(p)); } catch (_) { /* ignore */ } }
  let player = me();

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
  function errorLine(msg) { const p = el("p", "on-err", msg); panel.append(p); return p; }

  // home: the first thing every visit shows
  $("#home-cpu").addEventListener("click", () => { show("offline"); charsel.hidden = false; charsel.querySelector(".sel-start")?.focus(); });
  $("#home-online").addEventListener("click", () => { show("online"); player.name ? lobby() : login(); });
  for (const b of document.querySelectorAll("[data-home]")) b.addEventListener("click", () => { leaveRoom(); show("home"); });

  function login() {
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
      player.name = name; saveMe(player); lobby();
    });
    p.append(form, footer());
    setTimeout(() => input.focus(), 50);
  }
  function footer(extra = []) {
    const f = el("div", "sel-foot");
    f.append(...extra, button("หน้าแรก", "sel-back", () => { leaveRoom(); show("home"); }));
    return f;
  }

  // ---------- lobby ----------
  let lobbyTimer = null;
  function lobby() {
    clearInterval(lobbyTimer);
    show("online");
    const p = screen("ล็อบบี้ออนไลน์", `สวัสดี ${player.name} · แข่ง 2 ใน 3 ยก`);
    const acts = el("div", "on-acts");
    const quick = button("จับคู่ด่วน", "pick-done", () => run(quick, async () => enterRoom(await rpc("kf_quick_match", { p_player: player.id, p_name: player.name }))));
    const create = button("สร้างห้องส่วนตัว", "pick-done alt", () => run(create, async () => enterRoom(await rpc("kf_create_room", { p_player: player.id, p_name: player.name, p_public: false }))));
    acts.append(quick, create);
    const join = el("form", "on-form");
    const code = el("input", "on-input code");
    code.maxLength = 5; code.placeholder = "รหัสห้อง"; code.autocapitalize = "characters";
    const go = button("เข้าห้อง", "sel-back");
    go.type = "submit";
    join.append(code, go);
    join.addEventListener("submit", (e) => {
      e.preventDefault();
      if (code.value.trim().length < 5) { code.focus(); return; }
      run(go, async () => enterRoom(await rpc("kf_join_room", { p_code: code.value, p_player: player.id, p_name: player.name })));
    });
    const live = el("div", "on-live");
    live.append(el("h3", "pick-group", "ห้องที่เปิดอยู่"), el("ul", "on-rooms"));
    p.append(acts, join, live, footer([button("เปลี่ยนชื่อ", "sel-back", login)]));
    refreshRooms();
    lobbyTimer = setInterval(refreshRooms, 5000);
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
  async function refreshRooms() {
    const list = panel.querySelector(".on-rooms");
    if (!list || online.hidden) { clearInterval(lobbyTimer); return; }
    let rooms = [];
    try { rooms = await rpc("kf_list_rooms", {}); } catch (_) { return; }
    list.textContent = "";
    if (!rooms.length) { list.append(el("li", "on-empty", "ยังไม่มีห้อง กดจับคู่ด่วนหรือสร้างห้องได้เลย")); return; }
    for (const r of rooms) {
      const li = el("li", "on-room");
      const who = r.guest_name ? `${r.host_name}  vs  ${r.guest_name}` : `${r.host_name}  ·  รอคู่ต่อสู้`;
      li.append(el("b", null, r.code), el("span", null, who), el("i", r.status, r.status === "playing" ? "กำลังสู้" : "รอ"));
      if (!r.guest_name) li.append(button("เข้าร่วม", "sel-back", () => run(li.querySelector("button"), async () =>
        enterRoom(await rpc("kf_join_room", { p_code: r.code, p_player: player.id, p_name: player.name })))));
      li.append(button("ดู", "sel-back", () => spectate(r)));
      list.append(li);
    }
  }

  // ---------- the room ----------
  // room: { id, code, token, role: host|guest|spec }, plus live state
  let room = null;
  function blankRoom(info) {
    return {
      ...info, channel: null, phase: "lobby", score: { p1: 0, p2: 0 }, round: 0,
      picks: { host: null, guest: null }, names: { host: "", guest: "" }, present: { host: false, guest: false }, specs: 0,
      pc: null, dc: null, link: "none", relayTimer: null, pendingIce: [], snapT: 0, specT: 0, lastIn: "", lastInT: 0, heartbeat: null,
    };
  }
  const mySeat = () => (room.role === "host" ? "host" : "guest");
  const otherSeat = () => (room.role === "host" ? "guest" : "host");

  async function enterRoom(info) {
    clearInterval(lobbyTimer);
    leaveRoom(true);
    room = blankRoom(info);
    room.names[mySeat()] = player.name;
    const sk = G.skills(G.roster()[0].id);
    room.picks[mySeat()] = { kit: G.roster()[0].id, loadout: sk.loadout, ready: false };
    await joinChannel();
    room.heartbeat = setInterval(() => rpc("kf_set_status", { p_id: room.id, p_token: room.token, p_status: room.phase === "lobby" ? "waiting" : "playing" }).catch(() => {}), 60000);
    renderRoom();
  }

  function joinChannel() {
    return new Promise((resolve) => {
      const ch = client().channel("kf-room-" + room.id, { config: { broadcast: { self: false, ack: false }, presence: { key: player.id } } });
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

  // ---------- room screen: pick a fighter (first round only) and skills ----------
  function renderRoom() {
    if (!room || room.role === "spec") return;
    if (room.phase === "fight") return;
    show("online");
    const between = room.phase === "between";
    const result = room.phase === "result";
    const title = result ? resultTitle() : between ? `ยกที่ ${room.round + 1}` : `ห้อง ${room.code}`;
    const note = result ? "" : between ? "เลือกสกิลใหม่ได้ก่อนยกถัดไป" : room.present[otherSeat()] ? "ทั้งสองฝ่ายกดพร้อมแล้วเกมจะเริ่ม" : "ส่งรหัสห้องให้เพื่อน หรือรอคนจับคู่เข้ามา";
    const p = screen(title, note);
    // the two seats
    const seats = el("div", "on-seats");
    for (const seat of ["host", "guest"]) {
      const s = el("div", "on-seat" + (seat === mySeat() ? " me" : ""));
      const pick = room.picks[seat];
      const here = seat === mySeat() || room.present[seat];
      if (here && pick) s.append(G.portrait(pick.kit, 48));
      const info = el("div");
      info.append(el("b", null, here ? room.names[seat] || "…" : "ว่าง"));
      info.append(el("span", null, here && pick ? window.CHARACTERS[pick.kit].name : seat === "guest" ? "รอผู้เล่น" : ""));
      s.append(info);
      const sc = el("em", null, String(room.score[seat === "host" ? "p1" : "p2"]));
      s.append(sc);
      if (here && pick && pick.ready && !result) s.append(el("i", "ready", "พร้อม"));
      seats.append(s);
    }
    p.append(seats);
    p.append(el("p", "on-link", linkText()));
    if (result) {
      p.append(footer([button("แข่งอีกครั้ง", "pick-done", rematch), button("ออกจากห้อง", "sel-back", () => { leaveRoom(); lobby(); })]));
      return;
    }
    const mine = room.picks[mySeat()];
    // fighter: chosen in the room, locked once the set has started
    if (!between) {
      p.append(el("h3", "pick-group", "เลือกตัวละคร"));
      const list = el("ul", "char-list on-chars");
      for (const c of G.roster()) {
        const li = el("li");
        const b = el("button", "char" + (mine.kit === c.id ? " on" : ""));
        b.type = "button";
        b.append(G.portrait(c.id, 48), el("span", null, c.name));
        b.addEventListener("click", () => {
          if (mine.ready) return;
          room.picks[mySeat()] = { kit: c.id, loadout: G.skills(c.id).loadout, ready: false };
          sendPick(); renderRoom();
        });
        li.append(b); list.append(li);
      }
      p.append(list);
    }
    // skills: 2 normal + 1 ultimate
    const sk = G.skills(mine.kit);
    const normals = mine.loadout.filter((id) => sk.normals.some((s) => s.id === id));
    const ult = mine.loadout.find((id) => sk.ults.some((s) => s.id === id));
    const card = (s, on, onClick) => {
      const li = el("li");
      const b = el("button", "pick" + (s.ult ? " ult" : "") + (on ? " on" : ""));
      b.type = "button";
      const img = el("img"); img.src = s.icon; img.alt = "";
      b.append(img, el("span", "pn", s.name), el("span", "pd", s.desc), el("span", "pc", (s.ult ? "ULT · " : "") + "CD " + s.cd + "s"));
      b.addEventListener("click", onClick);
      li.append(b); return li;
    };
    const setLoadout = (n, u) => { room.picks[mySeat()] = { ...mine, loadout: [...n, u], ready: false }; sendPick(); renderRoom(); };
    p.append(el("h3", "pick-group", "สกิลธรรมดา (เลือก 2)"));
    const nl = el("ul", "pick-list normal");
    for (const s of sk.normals) nl.append(card(s, normals.includes(s.id), () => {
      if (mine.ready) return;
      let n = normals.includes(s.id) ? normals.filter((x) => x !== s.id) : [...normals, s.id];
      if (n.length > 2) n = n.slice(1);
      setLoadout(n, ult);
    }));
    p.append(nl, el("h3", "pick-group ult", "ไม้ตาย (เลือก 1)"));
    const ul = el("ul", "pick-list ult");
    for (const s of sk.ults) ul.append(card(s, ult === s.id, () => { if (!mine.ready) setLoadout(normals, s.id); }));
    p.append(ul);
    const ok = normals.length === 2 && !!ult;
    const ready = button(mine.ready ? "ยกเลิกพร้อม" : "พร้อม", "pick-done", () => {
      if (!ok) return;
      room.picks[mySeat()] = { ...mine, ready: !mine.ready };
      try { localStorage.setItem(`komfaek.skills.${mine.kit}`, JSON.stringify(mine.loadout)); } catch (_) { /* ignore */ }
      sendPick(); renderRoom(); maybeStart();
    });
    ready.disabled = !ok;
    p.append(footer([button("ออกจากห้อง", "sel-back", () => { leaveRoom(); lobby(); }), ready]));
  }
  function resultTitle() {
    const won = room.score[room.role === "host" ? "p1" : "p2"] >= WINS;
    return won ? `ชนะ ${room.score.p1} - ${room.score.p2}` : `แพ้ ${room.score.p1} - ${room.score.p2}`;
  }
  function rematch() {
    room.phase = "lobby"; room.score = { p1: 0, p2: 0 }; room.round = 0;
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
      round: room.round, score: room.score, stage: stages[Math.floor(Math.random() * stages.length)],
      p1: { kit: h.kit, loadout: h.loadout, name: room.names.host }, p2: { kit: g.kit, loadout: g.loadout, name: room.names.guest },
    };
    send("round", cfg);
    onRound(cfg);
  }
  function onRound(cfg) {
    if (!room) return;
    room.phase = "fight";
    room.round = cfg.round;
    room.score = { ...cfg.score };
    if (room.role === "spec") { G.start({ ...cfg, mode: "spectate", me: "p1" }); show("none"); updateNetbar(); return; }
    room.picks.host.ready = false;
    if (room.picks.guest) room.picks.guest.ready = false;
    show("none");
    if (room.role === "host") {
      G.start({ ...cfg, mode: "host", me: "p1" });
      NET.onRoundOver = (side) => hostRoundOver(side);
      NET.tick = hostTick;
      rpc("kf_set_status", { p_id: room.id, p_token: room.token, p_status: "playing" }).catch(() => {});
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
    if (room.role === "host" && p.setOver) rpc("kf_set_status", { p_id: room.id, p_token: room.token, p_status: "waiting" }).catch(() => {});
    renderRoom();
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
    dc.onopen = () => { clearTimeout(room.relayTimer); room.link = "p2p"; updateNetbar(); if (room.phase !== "fight") renderRoom(); maybeStart(); };
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
    if (!room.present[otherSeat()]) return "สถานะ: รอคู่ต่อสู้";
    return room.link === "p2p" ? "สถานะ: เชื่อมต่อตรง (P2P)" : room.link === "relay" ? "สถานะ: เชื่อมต่อผ่านเซิร์ฟเวอร์ (หน่วงกว่าเล็กน้อย)" : "สถานะ: กำลังเชื่อมต่อ…";
  }

  // ---------- leaving ----------
  function opponentLeft() {
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
    clearTimeout(r.relayTimer);
    try { r.dc?.close(); r.pc?.close(); } catch (_) { /* ignore */ }
    if (r.channel) client().removeChannel(r.channel);
    if (r.token) rpc("kf_leave_room", { p_id: r.id, p_token: r.token }).catch(() => {});
    netbar.hidden = true;
    if (NET.mode !== "offline") G.leave();
    if (!silent) show("home");
  }
  addEventListener("pagehide", () => {
    if (!room || !room.token) return;
    fetch(SUPABASE_URL + "/rest/v1/rpc/kf_leave_room", {
      method: "POST", keepalive: true,
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ p_id: room.id, p_token: room.token }),
    }).catch(() => {});
  });

  // ---------- the bar over the fight: score, round, connection, leave ----------
  function updateNetbar() {
    if (!room || NET.mode === "offline" && room.role !== "spec") { netbar.hidden = true; return; }
    netbar.hidden = false;
    const n = room.names;
    const tail = room.role === "spec" ? `ผู้ชม ${room.specs}` : room.link === "p2p" ? "P2P" : room.link === "relay" ? "RELAY" : "…";
    netbarText(`${n.host || "?"}  ${room.score.p1} - ${room.score.p2}  ${n.guest || "?"}  ·  ยก ${room.round + 1}  ·  ${tail}`);
  }
  function netbarText(t) { netbar.hidden = false; $("#netbar span").textContent = t; }
  $("#netbar button").addEventListener("click", () => { leaveRoom(true); lobby(); });

  // start on the home screen
  show("home");
})();
