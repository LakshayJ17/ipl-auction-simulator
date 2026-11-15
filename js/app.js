'use strict';
/* =====================================================================
   UI CONTROLLER
   ===================================================================== */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const TBY = Object.fromEntries(TEAMS.map(t => [t.id, t]));
const fmt = Auction.fmt;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const HAMMER_PACES = [[3500, 'Slow'], [2200, 'Normal'], [1200, 'Quick']];
const G = { hammer: 2200, userId: null, speed: 1, teams: null, season: null, forecast: null, screen: 'home', auctionDone: false };

/* ---------------- small helpers ---------------- */
function chip(id, cls = '') { const t = TBY[id]; if (!t) return ''; return `<span class="chip ${cls}" style="background:${t.color};color:${t.fg}">${t.short}</span>`; }
const flag = p => (COUNTRY[p.c] || {}).flag || '';
const ovrClass = o => o >= 88 ? 't1' : o >= 80 ? 't2' : o >= 72 ? 't3' : 't4';
const roleLabel = p => ({ BAT: 'Batter', WK: 'Wicketkeeper', AR: 'All-rounder', BOWL: 'Bowler' }[p.role]);
const roleShort = p => p.role === 'BOWL' ? (p.spin ? 'SPIN' : 'PACE') : p.role;
const CAT_LABEL = { WK: 'Keepers', BAT: 'Batters', AR: 'All-rnd', PACE: 'Pace', SPIN: 'Spin' };
function shade(hex, f = -0.45) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  r = Math.round(r * (1 + f)); g = Math.round(g * (1 + f)); b = Math.round(b * (1 + f));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function toast(msg, ms = 2600) {
  const d = document.createElement('div'); d.innerHTML = msg; $('#toast').appendChild(d);
  setTimeout(() => d.remove(), ms);
}
let modalLocked = false;
function modal(html, opts = {}) {
  const m = $('#modal');
  m.innerHTML = `<div class="box ${opts.wide ? 'wide' : ''}">${html}</div>`;
  m.classList.remove('hidden');
  modalLocked = !!opts.locked;
  return m;
}
function closeModal() { const m = $('#modal'); m.classList.add('hidden'); m.innerHTML = ''; modalLocked = false; if (G.onModalClose) { const f = G.onModalClose; G.onModalClose = null; f(); } }
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && !modalLocked) closeModal(); });
const modalOpen = () => !$('#modal').classList.contains('hidden');
const oversStr = Engine.oversStr;

function bar(label, v, color) {
  return `<div class="bar"><span>${label}</span><div class="tr"><div class="fl" style="width:${v}%;background:${color}"></div></div><b>${v}</b></div>`;
}
function tagsHTML(p) {
  return p.tags.map(t => TAG_INFO[t] ? `<span class="tag ${t === 'UNC' ? 'unc' : ''}" title="${esc(TAG_INFO[t][1])}">${TAG_INFO[t][0]}</span>` : '').join('');
}
function pl(p) { return `<span class="plink" data-pl="${p.id}">${esc(p.name)}</span>`; }
document.addEventListener('click', e => {
  if (e.target.closest('[data-close]')) { closeModal(); return; }
  const el = e.target.closest('[data-pl]');
  if (el && !modalLocked) { e.preventDefault(); showPlayer(+el.dataset.pl); }
});
function setTop(html) { $('#topinfo').innerHTML = html; }

const RULES_HTML = `
  <div class="rules">
    <div class="panel"><h3>💰 Purse & squad</h3>
      <p><b>₹120 Cr</b> purse per franchise. <b>No retentions</b>. Every player is in the pool.</p>
      <p>Squad of <b>18–25</b> players, max <b>8 overseas</b>. At most <b>4 overseas</b> can be on the field.</p>
      <p>Bid increments: +₹5 L below ₹1 Cr, +₹10 L to ₹2 Cr, +₹20 L to ₹3 Cr, then +₹25 L.</p></div>
    <div class="panel"><h3>🃏 Right To Match (new rule)</h3>
      <p>Each team has <b>6 RTM cards</b> (as in the real 2025 mega auction with no retentions): at most <b>5 on capped</b> and <b>2 on uncapped</b> players from its <b>2026 squad</b>.</p>
      <p>When the hammer falls, the old team can raise the RTM card. The highest bidder then gets <b>ONE final raise</b>. The RTM team must match that price or lose the player.</p>
      <p>A card is only used up when the RTM succeeds, so rivals can RTM just to <b>push your price up</b>.</p></div>
    <div class="panel"><h3>🔁 Impact Player</h3>
      <p>Pick a Playing XI, then <b>one Impact Player</b> and the XI player they replace.</p>
      <p><b>Bowling sub</b>: comes in to bowl after the replaced batter has batted. <b>Batting sub</b>: bats in place of a bowler who still bowls.</p></div>
    <div class="panel"><h3>📈 Ratings & sim</h3>
      <p>OVR is built from <b>IPL 2026 numbers</b> and recent form: Batting, Power, Bowling and Control.</p>
      <p>Tags such as <b>Death Specialist</b>, <b>Powerplay Specialist</b>, <b>Finisher</b> and <b>Anchor</b> change how players perform in the ball-by-ball engine. Venues matter too: Chepauk turns, Chinnaswamy flies.</p>
      <p class="muted">Keys: Space = Bid · J = +₹1 Cr · S = Pass · P = Pause</p></div>
  </div>`;

/* =====================================================================
   HOME
   ===================================================================== */
const LAST = { RCB: '🏆 2026 Champions', GT: '🥈 2026 Runners-up' };
function renderHome() {
  G.screen = 'home'; setTop('');
  $('#screen').innerHTML = `
  <div class="wrap home">
    <div class="hero"><h1>IPL 2027 <span>Mega Auction</span></h1>
      <p>No retentions · ₹120 Cr purse · 6 RTM cards</p></div>
    <div class="team-grid">${TEAMS.map(t => `
      <button class="team-card ${G.userId === t.id ? 'sel' : ''}" data-id="${t.id}" style="background:linear-gradient(135deg, ${t.color}, ${shade(t.color)});color:${t.fg}">
        <span class="nm">${t.name}</span>${LAST[t.id] ? `<span class="ps">${LAST[t.id]}</span>` : ''}<span class="ab">${t.short}</span></button>`).join('')}
    </div>
    <div class="home-actions">
      <button id="rulesBtn">📖 Rules</button>
      <button id="randBtn">🎲 Random</button>
      <button class="primary" id="startBtn" ${G.userId ? '' : 'disabled'}>${G.userId ? `Play as ${TBY[G.userId].short} →` : 'Pick a team'}</button>
    </div>
  </div>`;
  $$('.team-card').forEach(el => el.onclick = () => { G.userId = el.dataset.id; renderHome(); });
  $('#startBtn').onclick = startAuction;
  $('#rulesBtn').onclick = showRules;
  $('#randBtn').onclick = () => { G.userId = TEAMS[Math.floor(Math.random() * TEAMS.length)].id; renderHome(); toast(`🎲 You are <b>${esc(TBY[G.userId].name)}</b>`); };
}
function showRules() {
  modal(`<h2>Rules</h2>${RULES_HTML}<div class="row" style="justify-content:flex-end;margin-top:10px"><button data-close>Close</button></div>`, { wide: true });
}

/* =====================================================================
   AUCTION
   ===================================================================== */
const AS = () => Auction.S;
const inst = () => { const S = AS(); return S.simAll || (S.lot && (S.lot.instant || S.simSet === S.lot.set || S.skipSet === S.lot.set)); };

function startAuction() { renderPool(); }

function beginAuction() {
  G.screen = 'auction'; G.auctionDone = false;
  Auction.init(G.userId, {
    onSet, onLot, onBid: (lot) => { if (!inst()) { updateBid(lot, true); updateTeams(); } },
    onGoing: (lot) => { if (!inst()) updateBid(lot); },
    onSold, onUnsold, onRTM: () => { }, onLog: appendLog, onUpdate: () => { updateTeams(); updateMyTeam(); updateProgress(); updateSimButtons(); },
    onDone, askRTM, askFinalRaise, askRTMMatch,
  });
  Auction.setSpeed(G.speed); Auction.setHammer(G.hammer);
  renderAuction();
  Auction.run();
}

/* ---------------- Player pool (shown before the auction, and from the More menu) ---------------- */
G.shortlist = new Set(); G.poolCat = 'ALL'; G.poolSet = 'ALL'; G.poolSort = 'set'; G.poolQ = ''; G.sqOpen = false;
const SBY = Object.fromEntries(SETS.map(s => [s.code, s]));
const SBYNAME = Object.fromEntries(SETS.map(s => [s.name, s]));
const SORDER = Object.fromEntries(SETS.map((s, i) => [s.code, i]));
const CAT_FILTERS = [['ALL', 'All'], ['M', 'Marquee'], ['BAT', 'Batters'], ['AR', 'All-Rounders'], ['WK', 'Wicketkeepers'], ['PACE', 'Fast Bowlers'], ['SPIN', 'Spinners'], ['UNC', 'Uncapped'], ['OVS', 'Overseas'], ['STAR', '⭐ Shortlist']];
const setCls = s => s.cat === 'M' ? 'cM' : s.unc ? 'cU' : 'c' + s.cat;
const setTag = code => { const s = SBY[code]; return `<span class="gtag ${setCls(s)}" title="${esc(s.name)} · base ${fmt(s.base)}">${code}</span>`; };
const catMatch = (p, f) => {
  const s = SBY[p.set];
  if (f === 'ALL') return true;
  if (f === 'M') return s.cat === 'M';
  if (f === 'UNC') return s.unc;
  if (f === 'OVS') return p.ovs;
  if (f === 'STAR') return G.shortlist.has(p.id);
  return s.cat === f && !s.unc;
};

function poolStatus(p) {
  const S = AS(); if (!S.started) return '';
  const s = S.sales.find(x => x.p.id === p.id);
  if (s) return `${chip(s.team)} ${fmt(s.price)}`;
  if (S.lot && S.lot.p.id === p.id && !S.lot.done) return '<b class="gold">On the block</b>';
  if (S.unsold.includes(p) || (S.done && !s)) return '<span class="red-t">Unsold</span>';
  return '<span class="muted">To come</span>';
}
function poolPanel() {
  return `<div class="filters">${CAT_FILTERS.map(([k, l]) => `<button class="small pf ${G.poolCat === k ? 'on' : ''}" data-f="${k}">${l}</button>`).join('')}</div>
    <div class="row" style="margin:10px 0"><input type="search" id="poolSearch" placeholder="🔍 Search players" value="${esc(G.poolQ)}" style="flex:1;min-width:0">
      <select id="poolSet"><option value="ALL">All sets</option>${SETS.map(s => `<option value="${s.code}">${s.code} · ${fmt(s.base)}</option>`).join('')}</select>
      <select id="poolSort"><option value="set">Order</option><option value="ovr">OVR</option><option value="name">Name</option></select></div>
    <div class="scroll pool-scroll" id="poolList"></div>`;
}
function renderPoolList(withStatus) {
  const q = G.poolQ.trim().toLowerCase();
  let list = PLAYERS.filter(p => catMatch(p, G.poolCat) && (G.poolSet === 'ALL' || p.set === G.poolSet));
  if (q) list = list.filter(p => p.name.toLowerCase().includes(q));
  list.sort(G.poolSort === 'name' ? (a, b) => a.name.localeCompare(b.name) : G.poolSort === 'ovr' ? (a, b) => b.ovr - a.ovr : (a, b) => SORDER[a.set] - SORDER[b.set] || b.ovr - a.ovr);
  $('#poolList').innerHTML = `<table class="pool"><tr><th></th><th>Player</th><th class="hide-m">Role</th><th class="num">OVR</th><th>Set</th><th class="num hide-m">Base</th><th class="hide-m">2026</th>${withStatus ? '<th>Status</th>' : ''}</tr>
    ${list.map(p => `<tr><td><button class="star ${G.shortlist.has(p.id) ? 'on' : ''}" data-star="${p.id}" aria-label="Shortlist ${esc(p.name)}">${G.shortlist.has(p.id) ? '★' : '☆'}</button></td>
      <td>${flag(p)} ${pl(p)}${p.ovs ? ' <span class="muted">✈</span>' : ''}</td><td class="hide-m">${roleShort(p)}</td><td class="num"><b>${p.ovr}</b></td><td>${setTag(p.set)}</td><td class="num hide-m">${fmt(p.base)}</td>
      <td class="hide-m">${p.prev ? chip(p.prev) : '<span class="muted">—</span>'}</td>${withStatus ? `<td>${poolStatus(p)}</td>` : ''}</tr>`).join('')}</table>
    <div class="muted" style="margin-top:6px;font-size:12px">${list.length} player${list.length === 1 ? '' : 's'}${G.poolCat === 'STAR' && !list.length ? '. Tap ☆ next to a player to shortlist them.' : ''}</div>`;
  $$('[data-star]').forEach(b => b.onclick = e => {
    e.stopPropagation(); const id = +b.dataset.star;
    if (G.shortlist.has(id)) G.shortlist.delete(id); else G.shortlist.add(id);
    renderPoolList(withStatus);
  });
}
function wirePool(withStatus) {
  $$('.pf').forEach(b => b.onclick = () => { G.poolCat = b.dataset.f; $$('.pf').forEach(x => x.classList.toggle('on', x === b)); renderPoolList(withStatus); });
  $('#poolSearch').oninput = e => { G.poolQ = e.target.value; renderPoolList(withStatus); };
  $('#poolSet').value = G.poolSet;
  $('#poolSet').onchange = e => { G.poolSet = e.target.value; renderPoolList(withStatus); };
  $('#poolSort').value = G.poolSort;
  $('#poolSort').onchange = e => { G.poolSort = e.target.value; renderPoolList(withStatus); };
  renderPoolList(withStatus);
}
function auctionOrderHTML() {
  return `<div class="setflow">${SETS.map(s => `<span class="gtag ${setCls(s)}" title="${esc(s.name)} · ${s.n} players · base ${fmt(s.base)}">${s.code} <small>${fmt(s.base).replace('₹', '')}</small></span>`).join('')}</div>`;
}
function renderPool() {
  G.screen = 'pool';
  setTop(chip(G.userId));
  $('#screen').innerHTML = `<div class="wrap">
    <div class="pool-head">
      <div><h2>Auction pool</h2><div class="muted">${PLAYERS.length} players · ${SETS.length} sets · tap ☆ to shortlist</div></div>
      <button class="primary" id="beginBtn">Start auction →</button>
    </div>
    <details class="panel order"><summary>Auction order <span class="muted">M1 → M2 → BA1 → AL1 → WK1 → FA1 → SP1 → uncapped → …</span></summary>${auctionOrderHTML()}</details>
    <div class="panel">${poolPanel()}</div>
  </div>`;
  $('#beginBtn').onclick = beginAuction;
  wirePool(false);
}
function showPoolModal() {
  modal(`<h2>Player pool</h2>${poolPanel()}<div class="row" style="justify-content:flex-end;margin-top:12px"><button data-close>Close</button></div>`, { wide: true });
  wirePool(true);
}

/* ---------------- Auction room ---------------- */
function renderAuction() {
  G.screen = 'auction';
  $('#screen').innerHTML = `
  <div class="wrap">
    <div class="abar">
      <div class="setinfo"><div class="setname" id="setname">—</div><div class="muted" id="lotno"></div></div>
      <div class="progress"><div id="prog" style="width:0"></div></div>
      <button class="small danger hidden" id="stopSimBtn">⏹ Stop sim</button>
      <button class="small green hidden" id="skipMatchesBtn">🏏 Skip to matches</button>
      <button class="icon" id="pauseBtn" title="Pause (P)">⏸</button>
      <div class="menu-wrap"><button class="icon" id="moreBtn" title="Settings & more">⚙︎</button>
        <div class="menu hidden" id="moreMenu">
          <div class="mrow"><span>Speed</span><div class="seg">${[1, 2, 4].map(s => `<button class="small spd ${G.speed === s ? 'on' : ''}" data-s="${s}">${s}x</button>`).join('')}</div></div>
          <div class="mrow"><span>Hammer</span><div class="seg">${HAMMER_PACES.map(([v, l]) => `<button class="small hpace ${G.hammer === v ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}</div></div>
          <button data-m="pool">📋 Player pool</button>
          <button data-m="custom">✍️ Custom bid</button>
          <button data-m="skipSet" id="skipSetBtn">⏭ Skip this set</button>
          <button data-m="simSet" id="simSetBtn">⏩ Sim this set (auto-bid)</button>
          <button data-m="simAll" id="simAllBtn">🤖 Sim whole auction</button>
          <button data-m="skipAll">🏏 Skip to matches</button>
          <button data-m="rules">📖 Rules</button>
        </div></div>
    </div>
    <div class="agrid">
      <section class="panel stage" id="stage">
        <div class="pcard" id="pcard"><div class="muted">The auctioneer is taking the stage…</div></div>
        <div class="bidzone" id="bidzone">
          <div class="bidline">
            <div><div class="curbid-label" id="cblabel">Base price</div><div class="curbid" id="curbid">—</div></div>
            <div class="bidder" id="bidder"></div>
          </div>
          <div class="hammer" id="hammer">
            <div class="hrow"><span class="hpips"><i id="h1">🔨</i><i id="h2">🔨</i><i id="h3">🔨</i></span><span class="hlabel" id="hlabel"></span><span class="paddles" id="paddles"></span></div>
            <div class="hbar"><i id="hfill"></i></div>
          </div>
          <div class="callout hidden" id="callout"></div>
        </div>
        <div class="dock" id="dock">
          <div class="quick">${[[50, '+₹50 L'], [100, '+₹1 Cr'], [200, '+₹2 Cr']].map(([d, l]) => `<button class="small" data-qb="${d}">${l}</button>`).join('')}</div>
          <div class="actions">
            <button class="passbtn" id="passBtn">Pass</button>
            <button class="primary bidbtn" id="bidBtn">BID</button>
          </div>
        </div>
        <div class="log" id="log"></div>
      </section>
      <aside class="side">
        <div class="panel" id="myteam"></div>
        <div class="panel"><h3>Franchises</h3><div class="tgrid" id="teamsGrid"></div></div>
      </aside>
    </div>
  </div>`;
  document.body.classList.add('in-auction');
  $$('.spd').forEach(b => b.onclick = () => { G.speed = +b.dataset.s; Auction.setSpeed(G.speed); $$('.spd').forEach(x => x.classList.toggle('on', x === b)); });
  $$('.hpace').forEach(b => b.onclick = () => { G.hammer = +b.dataset.v; Auction.setHammer(G.hammer); $$('.hpace').forEach(x => x.classList.toggle('on', x === b)); });
  $('#pauseBtn').onclick = togglePause;
  $('#stopSimBtn').onclick = () => { Auction.stopSim(); updateSimButtons(); };
  $('#skipMatchesBtn').onclick = skipToMatches;
  $('#moreBtn').onclick = e => { e.stopPropagation(); $('#moreMenu').classList.toggle('hidden'); };
  $$('#moreMenu [data-m]').forEach(b => b.onclick = () => { $('#moreMenu').classList.add('hidden'); moreAction(b.dataset.m); });
  $('#bidBtn').onclick = doBid;
  $('#passBtn').onclick = doPass;
  $$('[data-qb]').forEach(b => b.onclick = () => quickBid(+b.dataset.qb));
  $('#teamsGrid').onclick = e => { const c = e.target.closest('[data-id]'); if (c) showTeamModal(c.dataset.id); };
  startHammerTicker();
  updateTeams(); updateMyTeam();
}
document.addEventListener('click', e => { const m = $('#moreMenu'); if (m && !e.target.closest('.menu-wrap')) m.classList.add('hidden'); });

function doBid() { Auction.userBid(0); updateBid(AS().lot); }
function doPass() { Auction.passLot(); updateBid(AS().lot); }
function quickBid(delta) {
  const lot = AS().lot; if (!lot) return;
  const cur = lot.bidder ? lot.bid : lot.p.base;
  if (!Auction.userBidTo(cur + delta)) toast(Auction.userCanBid().why || 'Not enough purse for that bid');
  updateBid(lot);
}
function moreAction(m) {
  if (m === 'pool') showPoolModal();
  else if (m === 'rules') showRules();
  else if (m === 'custom') customBidModal();
  else if (m === 'skipAll') skipToMatches();
  else if (m === 'skipSet') {
    if (isSimming()) Auction.stopSim();
    else { Auction.skipSetNow(); toast(`⏭ Skipping ${esc(AS().lot ? AS().lot.set : 'this set')}`); }
    updateSimButtons();
  }
  else if (m === 'simSet') {
    if (isSimming()) Auction.stopSim();
    else { Auction.simSetNow(); toast(`🤖 Auto-bidding for ${esc(TBY[G.userId].short)} this set`); }
    updateSimButtons();
  }
  else if (m === 'simAll') {
    if (isSimming()) { Auction.stopSim(); updateSimButtons(); return; }
    const U = AS().teams[G.userId], need = Math.max(0, 18 - U.squad.length);
    modal(`<h2>Sim the rest of the auction?</h2>
      <p>🤖 Your squad is filled automatically with your <b>${fmt(U.purse)}</b> purse${need ? ` · ${need} more players needed` : ''}. RTM calls are made for you.</p>
      <div class="row" style="justify-content:flex-end"><button data-close>Cancel</button><button class="primary" id="confSim">Sim it</button></div>`);
    $('#confSim').onclick = () => { closeModal(); Auction.simAllNow(); updateSimButtons(); };
  }
}
function customBidModal() {
  const c = Auction.userCanBid();
  if (!c.ok) { toast(c.why || 'You cannot bid right now'); return; }
  modal(`<h2>Bid a custom amount</h2><p class="muted">Minimum ${fmt(c.amt)} · Your max ${fmt(Auction.hardCap(AS().teams[G.userId]))}</p>
    <div class="row"><input type="number" id="customBid" step="0.25" inputmode="decimal" placeholder="₹ Cr, e.g. 12.5" style="flex:1;min-width:0"><button class="primary" id="customBidBtn">Bid</button></div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button data-close>Cancel</button></div>`);
  $('#customBid').focus();
  const go = () => {
    const v = Math.round(parseFloat($('#customBid').value) * 100);
    const c2 = Auction.userCanBid();
    if (!c2.ok) { toast(c2.why || 'Bidding has closed'); closeModal(); return; }
    if (!v || v < c2.amt) { toast(`Minimum bid is ${fmt(c2.amt)}`); return; }
    if (!Auction.userBidTo(v)) { toast('Not enough purse for that bid'); return; }
    closeModal(); updateBid(AS().lot);
  };
  $('#customBidBtn').onclick = go;
  $('#customBid').onkeydown = e => { if (e.key === 'Enter') go(); };
}

// is there anything left for the user to do in this auction?
function userStuck() {
  const S = AS(), U = S.teams[G.userId];
  if (!U || G.auctionDone) return false;
  return S.phase === 'accel' || U.squad.length >= 25 || Auction.hardCap(U) < 50;
}
function skipToMatches() {
  if (G.auctionDone) { if (G.screen === 'auction') renderPost(); return; }
  const U = AS().teams[G.userId], need = Math.max(0, 18 - U.squad.length);
  modal(`<h2>Skip to matches?</h2>
    <p>The rest of the auction is simulated instantly.${need ? ` 🤖 Your AI manager keeps bidding for you with your <b>${fmt(U.purse)}</b> purse to complete the squad${Auction.hardCap(U) <= 30 ? '. Your purse is spent, so the remaining spots are filled at base price' : ''}.` : ''}</p>
    <p class="muted">Your XI is auto-picked. You can change it from the season screen.</p>
    <div class="row" style="justify-content:flex-end"><button data-close>Cancel</button><button class="primary" id="confSkip">🏏 Skip to matches</button></div>`);
  $('#confSkip').onclick = () => { closeModal(); G.skipToMatches = true; G.squadAtSkip = U.squad.length; $('#pcard').innerHTML = '<div class="muted">⏩ Finishing the auction…</div>'; Auction.finishNow(); };
}
const isSimming = () => { const S = AS(); return S.simAll || (S.lot && ((S.simSet && S.simSet === S.lot.set) || (S.skipSet && S.skipSet === S.lot.set))); };
function updateSimButtons() {
  if (G.screen !== 'auction' || !$('#simAllBtn')) return;
  const s = isSimming();
  $('#simAllBtn').textContent = s ? '⏹ Stop sim' : '🤖 Sim whole auction';
  $('#simSetBtn').textContent = s ? '⏹ Stop sim' : '⏩ Sim this set (auto-bid)';
  $('#skipSetBtn').textContent = s ? '⏹ Stop sim' : '⏭ Skip this set';
  $('#stopSimBtn').classList.toggle('hidden', !s || G.auctionDone || !!AS().skipAll);
  $('#skipMatchesBtn').classList.toggle('hidden', !userStuck() || !!AS().skipAll);
}
function togglePause() {
  const S = AS(); Auction.setPaused(!S.paused); if ($('#hammer')) drawHammer();
  $('#pauseBtn').textContent = S.paused ? '▶' : '⏸';
  $('#pauseBtn').classList.toggle('on', S.paused);
}

function onSet(name, n) {
  const st = SBYNAME[name];
  $('#setname').innerHTML = st ? `${setTag(st.code)} ${esc(name)}` : esc(name);
  appendLog(`━━ ${name}${st ? ' · base ' + fmt(st.base) : ''} ━━`, 'set');
  if (AS().skipAll) { /* finishing silently */ }
  else if (name === 'Accelerated Round') toast(userStuck() && Auction.hardCap(AS().teams[G.userId]) < 50 ? '⚡ <b>Accelerated Round</b> · out of money? Tap 🏏 Skip to matches' : '⚡ <b>Accelerated Round</b>', 3500);
  else if (!inst() && st) toast(`📣 <b>${esc(name)}</b> · base ${fmt(st.base)}`, 2500);
  updateSimButtons();
}

function onLot(lot) {
  updateProgress();
  G.callStep = 0;
  if (inst()) return;
  const p = lot.p, S = AS();
  const prevT = p.prev && S.teams[p.prev];
  const sl = G.shortlist.has(p.id);
  const sk = p.role === 'BOWL' ? [['BWL', p.bowl, 'var(--c-bowl)'], ['CTL', p.eco, 'var(--c-ctl)']]
    : p.role === 'AR' ? [['BAT', p.bat, 'var(--c-bat)'], ['BWL', p.bowl, 'var(--c-bowl)']]
    : [['BAT', p.bat, 'var(--c-bat)'], ['POW', p.pow, 'var(--c-pow)']];
  $('#pcard').innerHTML = `
    <div class="pc-main">
      <div class="ovr ${ovrClass(p.ovr)}">${p.ovr}<small>OVR</small></div>
      <div class="pc-info">
        <div class="pname">${flag(p)} ${pl(p)}${sl ? ' <span class="gold">★</span>' : ''}</div>
        <div class="pmeta">${roleLabel(p)}${p.ovs ? ' · ✈' : ''}${p.unc ? ' · Uncapped' : ''} · ${p.prev ? chip(p.prev) : 'New'}${prevT && Auction.canRTM(prevT, p) ? ' <span class="tag rtm" title="${esc(prevT.t.short)} can use an RTM card">RTM</span>' : ''}</div>
        <div class="skills">${sk.map(([l, v, c]) => `<span><em>${l}</em><i><b style="width:${v}%;background:${c}"></b></i><strong>${v}</strong></span>`).join('')}</div>
      </div>
    </div>
    ${p.stat ? `<div class="pstat">${esc(p.stat)}</div>` : ''}`;
  if (sl) toast(`⭐ Shortlisted: <b>${esc(p.name)}</b> is up!`, 3000);
  $('#stage .stamp')?.remove();
  hideCallout();
  updateBid(lot);
}

const hammerLabel = () => (HAMMER_PACES.find(([v]) => v === G.hammer) || [0, 'Normal'])[1];
let hammerTimer = null;
function startHammerTicker() {
  clearInterval(hammerTimer);
  hammerTimer = setInterval(() => {
    if (G.screen !== 'auction' || !$('#hammer')) { clearInterval(hammerTimer); return; }
    drawHammer();
  }, 100);
}
const CALLS = ['', 'Going once', 'Going twice', 'Going thrice'];
function drawHammer() {
  const S = AS(), lot = S.lot, box = $('#hammer');
  if (!box) return;
  if (!lot || G.auctionDone || inst()) { box.classList.add('hidden'); return; }
  box.classList.remove('hidden');
  const closed = lot.closed || lot.done;
  const g = closed ? 3 : lot.going;
  ['h1', 'h2', 'h3'].forEach((id, i) => $('#' + id).className = g > i ? 'on s' + (i + 1) : '');
  const tl = Auction.timeLeft();
  const counting = !closed && tl && (tl.kind === 'hammer' || tl.kind === 'intro');
  const frac = counting ? tl.left / Math.max(1, tl.total) : closed ? 0 : 1;
  const fill = $('#hfill');
  fill.style.width = (frac * 100).toFixed(1) + '%';
  fill.className = closed ? 'done' : g ? 's' + g : '';
  const sec = counting ? `<span class="cd">${Math.ceil(tl.left / 1000)}s</span>` : '';
  const lab = $('#hlabel');
  lab.className = 'hlabel' + (g && !closed ? ' s' + g : '');
  if (closed) lab.innerHTML = !lot.done ? '🃏 RTM…' : lot.bidder ? '<span class="green-t">SOLD</span>' : '<span class="red-t">UNSOLD</span>';
  else if (S.paused) lab.textContent = '⏸ Paused';
  else if (tl && tl.kind === 'intro') lab.innerHTML = `Bidding opens${sec}`;
  else if (g === 0) lab.textContent = lot.bidder ? (lot.bidder === G.userId ? 'You lead' : 'Bidding live') : 'Waiting for a bid';
  else lab.innerHTML = `${CALLS[g]}…${sec}`;
}
function showCallout(step) {
  const c = $('#callout'); if (!c) return;
  c.className = 'callout s' + step;
  c.innerHTML = `<span class="hm">🔨</span><span>${CALLS[step].toUpperCase()}${step === 3 ? '!' : '…'}</span>`;
  void c.offsetWidth; c.classList.add('show');
  clearTimeout(G.calloutT);
  G.calloutT = setTimeout(hideCallout, 1100);
  const st = $('#stage'); if (st) { st.dataset.step = step; }
  if (navigator.vibrate && AS().lot && !AS().lot.passed) try { navigator.vibrate(step === 3 ? [40, 60, 40] : 30); } catch (e) { }
}
function hideCallout() { const c = $('#callout'); if (c) c.className = 'callout hidden'; const st = $('#stage'); if (st) delete st.dataset.step; }
function updateBid(lot, bump) {
  if (!lot || G.screen !== 'auction' || !$('#curbid')) return;
  const cur = lot.bidder ? lot.bid : lot.p.base;
  $('#cblabel').textContent = lot.bidder ? 'Current bid' : 'Base price';
  const cb = $('#curbid');
  cb.textContent = fmt(cur);
  if (bump) { cb.classList.add('bump'); setTimeout(() => cb.classList.remove('bump'), 160); }
  $('#bidder').innerHTML = lot.bidder ? `${chip(lot.bidder, 'lg')}${lot.bidder === G.userId ? ' <b>YOU</b>' : ''}` : '';
  const closed = lot.done || lot.closed;
  // big call-out each time the hammer step changes
  const step = closed ? 0 : lot.going;
  if (step !== G.callStep) { G.callStep = step; if (step) showCallout(step); else hideCallout(); }
  const live = Array.from(lot.inFight).filter(id => !lot.dropped.has(id) && id !== lot.bidder);
  $('#paddles').innerHTML = live.slice(0, 4).map(id => chip(id)).join('');
  const c = Auction.userCanBid();
  const btn = $('#bidBtn');
  if (closed) { btn.disabled = true; btn.textContent = !lot.done ? '🃏 RTM…' : 'Next player…'; }
  else if (c.ok) { btn.disabled = false; btn.innerHTML = `BID ${fmt(c.amt)}<span class="kbd">SPACE</span>`; }
  else { btn.disabled = true; btn.textContent = lot.bidder === G.userId ? '✋ You lead' : c.why; }
  const pb = $('#passBtn');
  pb.disabled = closed || !!lot.passed;
  pb.textContent = lot.passed ? 'Passed' : lot.bidder === G.userId ? 'Skip' : 'Pass';
  const capU = Auction.hardCap(AS().teams[G.userId]);
  $$('[data-qb]').forEach(b => { b.disabled = !c.ok || closed || Auction.ladder(c.amt, cur + +b.dataset.qb) > capU; });
  drawHammer();
}

function stamp(html, color) {
  const bz = $('#stage'); if (!bz) return;
  bz.querySelector('.stamp')?.remove();
  const d = document.createElement('div'); d.className = 'stamp'; d.innerHTML = html; d.style.color = color || 'var(--green)';
  bz.appendChild(d);
}

function onSold(info) {
  updateTeams(); updateMyTeam(); updateProgress();
  const mine = info.team === G.userId;
  if (mine && !inst()) toast(`🎉 <b>${esc(info.p.name)}</b> is yours · ${fmt(info.price)}`, 3000);
  else if (G.shortlist.has(info.p.id) && !inst()) toast(`⭐ ${esc(info.p.name)} → ${chip(info.team)} ${fmt(info.price)}`, 2800);
  if (info.record && !inst()) toast(`📈 <b>Auction record!</b> ${esc(info.p.name)} ${fmt(info.price)}`, 3000);
  if (inst()) return;
  hideCallout();
  const t = TBY[info.team];
  stamp(`<div class="big" style="color:${t.color === '#1C2C4C' ? '#D9B867' : t.color}">SOLD</div>
    <div class="sub">${esc(info.p.name)} → ${chip(info.team, 'lg')} <b class="gold">${fmt(info.price)}</b>${info.rtm ? ' <span class="tag rtm">RTM</span>' : ''}</div>`);
  updateBid(info.lot);
}
function onUnsold(lot) {
  if (inst()) return;
  hideCallout();
  stamp(`<div class="big" style="color:var(--red)">UNSOLD</div><div class="sub">${esc(lot.p.name)}</div>`, 'var(--red)');
  updateBid(lot);
}

function appendLog(txt, cls) {
  const L = $('#log'); if (!L) return;
  const d = document.createElement('div'); d.className = cls || ''; d.textContent = txt;
  L.appendChild(d);
  while (L.children.length > 60) L.firstChild.remove();
  L.scrollTop = L.scrollHeight;
}

function updateProgress() {
  const S = AS(); if (!$('#prog')) return;
  $('#prog').style.width = (S.idx / Math.max(1, S.lots.length) * 100).toFixed(1) + '%';
  $('#lotno').textContent = `${S.idx} / ${S.lots.length}`;
  const U = S.teams[G.userId];
  setTop(`${chip(G.userId)} <b class="gold">${fmt(U.purse)}</b><span class="muted">${U.squad.length}/25</span>`);
}

function updateTeams() {
  const S = AS(); const g = $('#teamsGrid'); if (!g) return;
  g.innerHTML = S.order.map(id => {
    const T = S.teams[id];
    const lead = S.lot && S.lot.bidder === id && !S.lot.done;
    return `<button class="tcell ${T.user ? 'me' : ''} ${lead ? 'lead' : ''}" data-id="${id}">${chip(id)}<span class="tp">${fmt(T.purse)}</span><span class="tn">${T.squad.length} · 🃏${T.rtm}</span></button>`;
  }).join('');
}

function catCounts(players) {
  const c = { WK: 0, BAT: 0, AR: 0, PACE: 0, SPIN: 0 };
  for (const p of players) c[p.cat]++;
  return c;
}
function budgetLine(U) {
  const toMin = Math.max(0, 18 - U.squad.length);
  if (!toMin) return `<div class="budget ok">✅ 18 reached · max bid ${fmt(Auction.hardCap(U))}</div>`;
  if (Auction.hardCap(U) <= 30) return `<div class="budget bad">💸 Purse spent · <b>${toMin}</b> more needed for 18<br><span>Only ₹30 L players now. Any gaps are filled at base price at the end.</span></div>`;
  const per = U.purse / toMin;
  const cls = per < 60 ? 'bad' : per < 150 ? 'warn' : 'ok';
  return `<div class="budget ${cls}" title="You need at least 18 players. Max bid ${fmt(Auction.hardCap(U))}">Need <b>${toMin}</b> more · ~<b>${fmt(Math.floor(per))}</b> each</div>`;
}
function updateMyTeam() {
  const S = AS(); const el = $('#myteam'); if (!el) return;
  const U = S.teams[G.userId];
  const c = catCounts(U.squad.map(s => s.p));
  const need = { WK: 1, BAT: 4, AR: 2, PACE: 3, SPIN: 2 };
  el.innerHTML = `<div class="row" style="justify-content:space-between"><h3 style="margin:0">${chip(G.userId)} Your squad</h3><span class="muted" style="font-size:12px">🃏 ${U.rtm}</span></div>
    <div class="kpis" style="margin-top:10px"><div>Purse<b class="gold">${fmt(U.purse)}</b></div><div>Players<b>${U.squad.length}</b></div><div>Overseas<b>${Auction.ovsCount(U)}/8</b></div></div>
    ${budgetLine(U)}
    <div class="rolechips">${Object.keys(need).map(k => `<span class="rc ${c[k] < need[k] ? 'low' : 'ok'}">${CAT_LABEL[k]} <b>${c[k]}</b></span>`).join('')}</div>
    ${U.squad.length ? `<details class="sq" id="sqd" ${G.sqOpen ? 'open' : ''}><summary>Squad (${U.squad.length})</summary>
    <div class="squadlist">${U.squad.slice().sort((a, b) => b.price - a.price).map(s => `
      <div class="it"><span>${pl(s.p)} <span class="muted">${s.p.ovr}</span></span><b>${fmt(s.price)}</b></div>`).join('')}</div></details>` : ''}`;
  if ($('#sqd')) $('#sqd').ontoggle = e => { G.sqOpen = e.target.open; };
  if ($('#skipMatchesBtn')) $('#skipMatchesBtn').classList.toggle('hidden', !userStuck() || !!S.skipAll);
}

function showTeamModal(id) {
  const S = AS(); const T = S.teams[id];
  const rows = T.squad.slice().sort((a, b) => b.price - a.price).map(s => `<tr><td>${flag(s.p)} ${pl(s.p)}</td><td>${roleShort(s.p)}</td><td class="num">${s.p.ovr}</td><td class="num">${fmt(s.price)}</td><td>${s.how === 'rtm' ? '<span class="tag rtm">RTM</span>' : s.how === 'fill' ? '<span class="muted">top-up</span>' : ''}</td></tr>`).join('');
  const c = catCounts(T.squad.map(s => s.p));
  modal(`<h2>${chip(id, 'lg')} ${esc(T.t.name)}</h2>
    <p class="muted">${T.user ? 'Your franchise' : 'AI style: ' + esc(T.t.persona.label)} · Purse left <b class="gold">${fmt(T.purse)}</b> · ${T.squad.length} players · ${Auction.ovsCount(T)} overseas · RTM left ${T.rtm}</p>
    <p class="muted">${Object.keys(c).map(k => `${CAT_LABEL[k]}: <b>${c[k]}</b>`).join(' · ')}</p>
    <div class="scroll"><table><tr><th>Player</th><th>Role</th><th class="num">OVR</th><th class="num">Price</th><th></th></tr>${rows || '<tr><td colspan=5 class="muted">No players yet</td></tr>'}</table></div>
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button data-close>Close</button></div>`);
}

/* ---------- RTM prompts (return promises) ---------- */
function askRTM({ p, price, winner, cards }) {
  return new Promise(res => {
    const U = AS().teams[G.userId];
    modal(`<div class="rtm-box"><div class="card">🃏</div><h2>Right To Match?</h2>
      <p><b>${flag(p)} ${esc(p.name)}</b> (OVR ${p.ovr}), your 2026 player, is about to be sold to ${chip(winner, 'lg')} for <b class="gold">${fmt(price)}</b>.</p>
      <p class="muted">If you raise the card, ${TBY[winner].short} get ONE final raise. Then you decide whether to match. A card is only used up if you sign the player.<br>
      You have ${cards} card${cards > 1 ? 's' : ''} · Your max bid ${fmt(Auction.hardCap(U))}</p>
      <div class="btns"><button class="primary" id="rtmYes">🃏 Use RTM</button><button id="rtmNo">Pass</button></div></div>`, { locked: true });
    $('#rtmYes').onclick = () => { closeModal(); res(true); };
    $('#rtmNo').onclick = () => { closeModal(); res(false); };
  });
}
function askFinalRaise({ p, price, holder, max }) {
  return new Promise(res => {
    const opts = [['+1 step', Auction.ladder(price, price + 1)], ['+10%', Auction.ladder(price, price * 1.1)], ['+25%', Auction.ladder(price, price * 1.25)], ['+50%', Auction.ladder(price, price * 1.5)]]
      .filter(o => o[1] <= max);
    modal(`<div class="rtm-box"><div class="card">⚠️</div><h2>${chip(holder, 'lg')} used RTM!</h2>
      <p>You won <b>${esc(p.name)}</b> at <b class="gold">${fmt(price)}</b>, but ${TBY[holder].short} want to match.</p>
      <p class="muted">You get ONE final raise. If you don't raise, ${TBY[holder].short} sign the player at ${fmt(price)}. If you raise, they must match your new price or lose the player.<br>Your max: ${fmt(max)}</p>
      <div class="btns">${opts.map((o, i) => `<button class="${i === 1 ? 'primary' : ''}" data-v="${o[1]}">${o[0]} → ${fmt(o[1])}</button>`).join('')}</div>
      <div class="btns"><input type="number" id="customRaise" step="0.25" min="${(price / 100).toFixed(2)}" max="${(max / 100).toFixed(2)}" placeholder="₹ Cr" style="width:110px"><button id="customBtn">Raise to custom</button></div>
      <div class="btns"><button class="danger" id="noRaise">No raise. Let them have the player</button></div></div>`, { locked: true });
    $$('#modal button[data-v]').forEach(b => b.onclick = () => { closeModal(); res(+b.dataset.v); });
    $('#customBtn').onclick = () => {
      const v = Math.round(parseFloat($('#customRaise').value) * 100);
      if (!v || v <= price) { toast('Enter an amount above the current price'); return; }
      closeModal(); res(Math.min(v, max));
    };
    $('#noRaise').onclick = () => { closeModal(); res(price); };
  });
}
function askRTMMatch({ p, price, winner }) {
  return new Promise(res => {
    modal(`<div class="rtm-box"><div class="card">💸</div><h2>${chip(winner, 'lg')} raised to ${fmt(price)}!</h2>
      <p>Match <b class="gold">${fmt(price)}</b> to sign <b>${esc(p.name)}</b> with your RTM card?</p>
      <p class="muted">Your purse: ${fmt(AS().teams[G.userId].purse)}</p>
      <div class="btns"><button class="green" id="mYes">✅ Match</button><button id="mNo">Decline</button></div></div>`, { locked: true });
    $('#mYes').onclick = () => { closeModal(); res(true); };
    $('#mNo').onclick = () => { closeModal(); res(false); };
  });
}

function onDone() {
  G.auctionDone = true;
  document.body.classList.remove('in-auction');
  updateTeams(); updateMyTeam(); updateProgress(); updateSimButtons();
  const stage = $('#stage'); if (!stage) return;
  const S = AS(), U = S.teams[G.userId];
  $('#setname').textContent = 'Auction complete';
  $('#pauseBtn')?.classList.add('hidden');
  const top = S.sales.slice().sort((a, b) => b.price - a.price)[0];
  const myTop = U.squad.slice().sort((a, b) => b.price - a.price)[0];
  const fills = U.squad.filter(s => s.how === 'fill');
  const bought = U.squad.length - (G.squadAtSkip || 0) - fills.length;
  if (G.skipToMatches) {
    G.skipToMatches = false;
    document.body.classList.remove('in-auction');
    if (!G.teams) buildSeasonTeams();
    const v = Engine.validateSelection(myTeam().sel);
    if (v.errs.length) renderPost(); // can't auto-pick a legal XI: let the user fix it
    else { G.season = Season.create(G.teams, G.userId); renderSeason(); }
    toast(`🤖 Your manager signed ${bought} player${bought === 1 ? '' : 's'}${fills.length ? ` · ${fills.length} top-up${fills.length > 1 ? 's' : ''}` : ''} · XI auto-picked (✏️ XI to change)`, 4500);
    return;
  }
  stage.innerHTML = `<div class="done-view">
    <div class="done-emoji">🏁</div>
    <h2>Auction over</h2>
    <div class="kpis"><div>Players<b>${U.squad.length}/25</b></div><div>Spent<b class="gold">${fmt(12000 - U.purse)}</b></div><div>Purse left<b>${fmt(U.purse)}</b></div></div>
    <div class="done-lines">
      ${fills.length ? `<div>📋 Topped up to 18: <b>${fills.map(s => esc(s.p.name)).join(', ')}</b></div>` : ''}
      ${myTop ? `<div>💸 Your top buy: <b>${esc(myTop.p.name)}</b> <b class="gold">${fmt(myTop.price)}</b></div>` : ''}
      ${top ? `<div>📈 Record: <b>${esc(top.p.name)}</b> ${chip(top.team)} <b class="gold">${fmt(top.price)}</b></div>` : ''}
    </div>
    <button class="primary bidbtn" id="toReview">Pick your Playing XI →</button>
  </div>`;
  $('#toReview').onclick = renderPost;
  if (top) appendLog(`🏁 Most expensive: ${top.p.name} (${top.team}) ${fmt(top.price)}`, 'sold');
}

document.addEventListener('keydown', e => {
  if (G.screen !== 'auction' || modalOpen() || G.auctionDone) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  const k = e.key.toLowerCase();
  if (k === ' ' || k === 'b') { e.preventDefault(); doBid(); }
  else if (k === 's' || k === 'x') doPass();
  else if (k === 'j') quickBid(100);
  else if (k === 'p') togglePause();
});

/* =====================================================================
   POST-AUCTION: squad review, XI + impact selection, forecast
   ===================================================================== */
function buildSeasonTeams() {
  const S = AS();
  G.teams = S.order.map(id => {
    const T = S.teams[id];
    const squad = T.squad.map(s => s.p);
    return { id, short: id, name: T.t.name, squad, sel: Engine.autoSelect(squad), buys: T.squad, purse: T.purse };
  });
}
const myTeam = () => G.teams.find(t => t.id === G.userId);

function renderPost() {
  G.screen = 'post'; document.body.classList.remove('in-auction');
  if (!G.teams) buildSeasonTeams();
  const S = AS(); const U = S.teams[G.userId]; const t = TBY[G.userId];
  setTop(`${chip(G.userId)} <span class="muted">Squad review</span>`);
  $('#screen').innerHTML = `
  <div class="wrap">
    <div class="banner" style="background:linear-gradient(135deg, ${t.color}, ${shade(t.color)});color:${t.fg}">
      <h1>${esc(t.name)}</h1>
      <div>${fmt(12000 - U.purse)} spent · ${U.squad.length} players · ${Auction.ovsCount(U)} overseas</div></div>
    <div class="grid2">
      <div class="panel"><h3>Playing XI</h3><div id="selEditor"></div></div>
      <div>
        <div class="panel" id="forecastPanel"><h3>Power rankings</h3><div class="muted">🔮 Simulating…</div></div>
        <div class="panel" style="margin-top:14px" id="reviewPanel"></div>
      </div>
    </div>
    <div class="row" style="justify-content:center;margin:20px 0 40px"><button class="primary bidbtn" id="startSeason">Start season →</button></div>
  </div>`;
  renderSelEditor();
  renderReview();
  setTimeout(runForecast, 60);
  $('#startSeason').onclick = () => {
    const v = Engine.validateSelection(myTeam().sel);
    if (v.errs.length) { toast('⚠️ ' + v.errs[0]); return; }
    G.season = Season.create(G.teams, G.userId);
    renderSeason();
  };
}

function teamIndex(team) {
  const pr = Engine.prepare(team);
  const bats = pr.lineup.slice(0, 7).map(p => p.batR);
  const bowls = pr.bowlers.slice(0, 5).map(p => p.bowlR);
  const avg = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
  return { bat: avg(bats), bowl: avg(bowls), xi: avg(team.sel.xi.map(p => p.ovr)) };
}

function runForecast() {
  G.forecast = Season.forecast(G.teams, 200, G.userId);
  const el = $('#forecastPanel'); if (!el) return;
  const myRank = G.forecast.findIndex(f => f.id === G.userId) + 1;
  const grades = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'D', 'F'];
  const g = grades[myRank - 1];
  const gcol = myRank <= 3 ? 'var(--green)' : myRank <= 6 ? 'var(--gold)' : 'var(--red)';
  const quips = ['The other nine owners are furious. This is a title-winning squad.', 'Superb auction. Genuine title contenders.', 'Strong squad with playoff written all over it.',
    'Solid, but the top four will be a dogfight.', 'Mid-table on paper. Needs a hero or two.', 'Some holes in that XI. Hope the stars fire.',
    'Questionable spending, Boss.', 'The fans are worried…', 'That was rough. Pray for form.', 'Wooden-spoon favourites. Bold strategy!'];
  el.innerHTML = `<h3>Power rankings</h3>
    <div class="row" style="margin-bottom:10px"><div class="grade" style="color:${gcol}">${g}</div><div><b>Auction grade</b><div class="muted">${quips[myRank - 1]}</div></div></div>
    <div class="scroll"><table><tr><th>#</th><th>Team</th><th class="num">XI OVR</th><th class="num">Pts</th><th class="num">Top 4</th><th class="num">Title</th></tr>
    ${G.forecast.map((f, i) => { const tm = G.teams.find(t => t.id === f.id); const ix = teamIndex(tm); return `<tr class="${f.id === G.userId ? 'me' : ''}"><td>${i + 1}</td><td>${chip(f.id)}</td><td class="num">${ix.xi.toFixed(1)}</td><td class="num">${f.avgPts.toFixed(1)}</td><td class="num">${(f.top4 * 100).toFixed(0)}%</td><td class="num">${(f.title * 100).toFixed(0)}%</td></tr>`; }).join('')}
    </table></div>
    <div class="row" style="margin-top:8px"><button class="small" id="reFc">🔁 Re-run</button></div>`;
  $('#reFc').onclick = () => { el.innerHTML = '<h3>Power rankings</h3><div class="muted">🔮 Simulating…</div>'; setTimeout(runForecast, 40); };
}

function renderReview() {
  const S = AS();
  const sales = S.sales.filter(s => s.how !== 'fill');
  const top = sales.slice().sort((a, b) => b.price - a.price).slice(0, 8);
  const mine = S.teams[G.userId].squad;
  const valueScore = s => (s.p.ovr - 60) / Math.max(0.3, s.price / 100);
  const steal = sales.filter(s => s.p.ovr >= 78).sort((a, b) => valueScore(b) - valueScore(a))[0];
  const mySteal = mine.filter(s => s.p.ovr >= 72).sort((a, b) => valueScore(b) - valueScore(a))[0];
  const myBig = mine.slice().sort((a, b) => b.price - a.price)[0];
  const rtms = S.sales.filter(s => s.how === 'rtm');
  $('#reviewPanel').innerHTML = `<h3>Auction review</h3>
    ${myBig ? `<p>💸 Top buy: <b>${pl(myBig.p)}</b> <b class="gold">${fmt(myBig.price)}</b></p>` : ''}
    ${mySteal ? `<p>🕵️ Best value: <b>${pl(mySteal.p)}</b> <span class="muted">${mySteal.p.ovr}</span> <b class="green-t">${fmt(mySteal.price)}</b></p>` : ''}
    ${steal ? `<p>💎 Steal: <b>${pl(steal.p)}</b> <span class="muted">${steal.p.ovr}</span> ${chip(steal.team)} ${fmt(steal.price)}</p>` : ''}
    <table><tr><th>Top buys</th><th>Team</th><th class="num">Price</th></tr>${top.slice(0, 5).map(s => `<tr><td>${pl(s.p)} <span class="muted">${s.p.ovr}</span></td><td>${chip(s.team)}</td><td class="num gold">${fmt(s.price)}</td></tr>`).join('')}</table>
    <div class="row" style="margin-top:10px;gap:6px">${S.order.map(id => `<button class="small" data-tm="${id}">${chip(id)}</button>`).join('')}</div>`;
  $$('#reviewPanel [data-tm]').forEach(b => b.onclick = () => showTeamModal(b.dataset.tm));
}

function renderSelEditor() {
  const tm = myTeam(); const sel = tm.sel;
  const order = { WK: 0, BAT: 1, AR: 2, BOWL: 3 };
  const squad = tm.squad.slice().sort((a, b) => order[a.role] - order[b.role] || b.ovr - a.ovr);
  const inXI = new Set(sel.xi.map(p => p.id));
  const price = id => (tm.buys.find(b => b.p.id === id) || {}).price || 0;
  const v = Engine.validateSelection(sel);
  const pr = sel.xi.length === 11 ? Engine.prepare(tm) : null;
  const itype = Engine.impactType(sel);
  const bench = squad.filter(p => !inXI.has(p.id));
  $('#selEditor').innerHTML = `
    <div class="row" style="margin-bottom:8px"><span>XI <b>${sel.xi.length}/11</b> · ✈ <b>${sel.xi.filter(p => p.ovs).length}/4</b></span><div class="spacer"></div><button class="small" id="autoXI">✨ Auto-pick</button></div>
    <div class="scroll" style="max-height:420px"><table class="sel-table">
      <tr><th>XI</th><th>Player</th><th>Role</th><th class="num">OVR</th><th class="num hide-m">Bat</th><th class="num hide-m">Bowl</th><th class="num hide-m">Price</th></tr>
      ${squad.map(p => `<tr class="${inXI.has(p.id) ? 'inxi' : ''}"><td><input type="checkbox" data-pid="${p.id}" ${inXI.has(p.id) ? 'checked' : ''}></td>
        <td>${pl(p)} ${p.ovs ? '<span class="muted">✈</span>' : ''} ${sel.impact && sel.impact.id === p.id ? '<span class="tag rtm">IMPACT</span>' : ''}${sel.captain && sel.captain.id === p.id ? '<span class="tag">C</span>' : ''}</td>
        <td>${roleShort(p)}</td><td class="num"><b>${p.ovr}</b></td><td class="num hide-m">${p.batR}</td><td class="num hide-m">${p.bt ? p.bowlR : '–'}</td><td class="num muted hide-m">${fmt(price(p.id))}</td></tr>`).join('')}
    </table></div>
    <div class="row" style="margin-top:10px">
      <label>🔁 Impact <select id="impSel"><option value="">— none —</option>${bench.map(p => `<option value="${p.id}" ${sel.impact && sel.impact.id === p.id ? 'selected' : ''}>${esc(p.name)} (${roleShort(p)} ${p.ovr})</option>`).join('')}</select></label>
      <label>replaces <select id="repSel"><option value="">—</option>${sel.xi.map(p => `<option value="${p.id}" ${sel.replaced && sel.replaced.id === p.id ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
      <label>© Captain <select id="capSel">${sel.xi.map(p => `<option value="${p.id}" ${sel.captain && sel.captain.id === p.id ? 'selected' : ''}>${esc(p.name)}${p.tags.includes('CAP') ? ' ★' : ''}</option>`).join('')}</select></label>
    </div>

    ${v.errs.length ? `<div class="errs" style="margin-top:8px">${v.errs.map(esc).join('<br>')}</div>` : ''}
    ${v.warn.length ? `<div class="warns" style="margin-top:8px">${v.warn.map(esc).join('<br>')}</div>` : ''}
    ${pr ? `<details style="margin-top:12px"><summary class="muted">Batting order & bowling</summary><div class="grid2 even" style="margin-top:8px">
      <div><h3>Batting</h3>${pr.lineup.map((p, i) => `<div style="font-size:13px">${i + 1}. ${esc(p.name)} <span class="muted">${p.batR}</span></div>`).join('')}</div>
      <div><h3>Bowling</h3>${pr.bowlers.slice(0, 6).map(p => `<div style="font-size:13px">${esc(p.name)} <span class="muted">${p.bowlR}</span></div>`).join('')}</div></div></details>` : ''}`;
  $$('#selEditor input[type=checkbox]').forEach(cb => cb.onchange = () => {
    const p = tm.squad.find(x => x.id === +cb.dataset.pid);
    if (cb.checked) { if (sel.xi.length >= 11) { toast('XI is full. Untick someone first.'); cb.checked = false; return; } sel.xi.push(p); if (sel.impact && sel.impact.id === p.id) sel.impact = null; }
    else { sel.xi = sel.xi.filter(x => x.id !== p.id); if (sel.replaced && sel.replaced.id === p.id) sel.replaced = null; if (sel.captain && sel.captain.id === p.id) sel.captain = null; }
    if (!sel.captain && sel.xi.length) sel.captain = Engine.pickCaptain(sel.xi);
    renderSelEditor();
  });
  $('#impSel').onchange = e => { sel.impact = tm.squad.find(x => x.id === +e.target.value) || null; renderSelEditor(); };
  $('#repSel').onchange = e => { sel.replaced = sel.xi.find(x => x.id === +e.target.value) || null; renderSelEditor(); };
  $('#capSel').onchange = e => { sel.captain = sel.xi.find(x => x.id === +e.target.value) || null; renderSelEditor(); };
  $('#autoXI').onclick = () => { tm.sel = Engine.autoSelect(tm.squad); renderSelEditor(); };
}

/* =====================================================================
   SEASON HUB
   ===================================================================== */
G.tab = 'results';
function renderSeason() {
  G.screen = 'season';
  const S = G.season;
  if (S.phase === 'done') return renderEnd();
  if (S.news && S.news.length > (G.newsSeen || 0)) { const fresh = S.news.slice(G.newsSeen || 0); G.newsSeen = S.news.length; setTimeout(() => toast(fresh.map(x => esc(x.txt)).join('<br>'), 4500), 3200); }
  const fx = Season.nextFixture(S);
  const st = Season.standings(S);
  const myRow = S.table[G.userId];
  const pos = st.findIndex(r => r.id === G.userId) + 1;
  setTop(`${chip(G.userId)} <span><b>${myRow.w}-${myRow.l}</b> · ${Season.ordinal(pos)}</span>`);
  const mine = fx && (fx.home === G.userId || fx.away === G.userId);
  const venue = fx ? (fx.stage === 'League' || fx.stage === 'Qualifier 1' || fx.stage === 'Eliminator' ? TBY[fx.home].venue : Season.FINAL_VENUE.venue) : '';
  const userAlive = S.phase === 'league' || (S.final4.includes(G.userId) && !S.playoffs.some(f => f.result && f.result.loser === G.userId && f.stage !== 'Qualifier 1'));
  $('#screen').innerHTML = `
  <div class="wrap"><div class="grid2">
    <div>
      <div class="panel"><h3>${S.phase === 'league' ? `League stage · Match ${fx.no} of 70` : '🏆 Playoffs'}</h3>
        <div class="matchcard">
          <div class="row">${chip(fx.home, 'lg')} <b>${esc(TBY[fx.home].name)}</b></div><div class="vs">VS</div>
          <div class="row">${chip(fx.away, 'lg')} <b>${esc(TBY[fx.away].name)}</b></div></div>
        <div class="muted" style="text-align:center">${fx.stage !== 'League' ? `<b class="gold">${fx.stage}</b> · ` : ''}🏟️ ${esc(venue)}</div>
        ${newsHTML(S)}
        <div class="row" style="justify-content:center;margin-top:12px">
          ${mine ? `<button class="primary" id="watchBtn">▶ Watch</button><button id="quickBtn">⚡ Result</button>` : `<button class="primary" id="quickBtn">⚡ Play</button>`}
          <button id="toMineBtn">⏩ My next match</button>
          <button id="editXIBtn">✏️ XI</button>
          ${S.phase === 'league' ? '<button id="endLeagueBtn">⏭ Sim league</button>' : '<button id="endAllBtn">⏭ Sim to Final</button>'}
        </div>
        ${!userAlive && S.phase === 'playoffs' ? '<p class="muted" style="text-align:center">You are out.</p>' : ''}
      </div>
      <div class="panel" style="margin-top:14px">
        <div class="tabs">${[['results', 'Results'], ['stats', 'Caps & stats'], ['mine', 'My squad'], ['fixtures', 'Fixtures']].map(([k, l]) => `<button class="small ${G.tab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('')}</div>
        <div id="tabBody"></div>
      </div>
    </div>
    <div>
      <div class="panel"><h3>Points table</h3>${tableHTML(S)}</div>
      <div class="panel" style="margin-top:14px"><h3>Caps</h3>${capsMini(S)}</div>
    </div>
  </div></div>`;
  if (mine) $('#watchBtn').onclick = () => { const r = Season.playNext(S, true); watchMatch(r.res, () => renderSeason()); };
  $('#quickBtn').onclick = () => { const r = Season.playNext(S, true); if (mine) resultToast(r.res); renderSeason(); };
  $('#editXIBtn').onclick = openXIModal;
  $$('tr[data-team]').forEach(tr => tr.onclick = () => showSeasonTeam(tr.dataset.team));
  $('#toMineBtn').onclick = () => { simUntil(() => { const f = Season.nextFixture(S); return !f || f.home === G.userId || f.away === G.userId; }); };
  if ($('#endLeagueBtn')) $('#endLeagueBtn').onclick = () => simUntil(() => S.phase !== 'league');
  if ($('#endAllBtn')) $('#endAllBtn').onclick = () => simUntil(() => S.phase === 'done');
  $$('[data-tab]').forEach(b => b.onclick = () => { G.tab = b.dataset.tab; renderSeason(); });
  renderTab();
}
function simUntil(stop) {
  const S = G.season; let n = 0;
  // always play at least one match
  do { const r = Season.playNext(S, true); if (!r) break; n++; if (r.res && (r.res.home === G.userId || r.res.away === G.userId)) resultToast(r.res); } while (!stop() && S.phase !== 'done');
  renderSeason();
}
function newsHTML(S) {
  if (!Season.teamNews) return '';
  const n = Season.teamNews(S, G.userId);
  const bits = [];
  if (n.inj.length) bits.push(`🚑 ${n.inj.map(x => `${esc(x.p.name)} <span class="muted">(${x.n})</span>`).join(', ')}`);
  if (n.hot.length) bits.push(`🔥 ${n.hot.map(p => esc(p.name)).join(', ')}`);
  if (n.cold.length) bits.push(`🥶 ${n.cold.map(p => esc(p.name)).join(', ')}`);
  return bits.length ? `<div class="news">${bits.map(b => `<div>${b}</div>`).join('')}</div>` : '';
}
function resultToast(res) {
  const won = res.winner === G.userId;
  toast(`${won ? '✅ WIN' : '❌ LOSS'} · ${chip(res.home)} vs ${chip(res.away)} · ${esc(TBY[res.winner].short)} ${esc(res.margin)}`, 3000);
}

function tableHTML(S) {
  const st = Season.standings(S);
  return `<div class="scroll"><table><tr><th>#</th><th>Team</th><th class="num">P</th><th class="num">W</th><th class="num">L</th><th class="num">Pts</th><th class="num">NRR</th><th>Form</th></tr>
  ${st.map((r, i) => `<tr data-team="${r.id}" style="cursor:pointer" class="${r.id === G.userId ? 'me' : ''} ${i < 4 ? 'q' : ''}"><td>${i + 1}</td><td>${chip(r.id)}</td><td class="num">${r.p}</td><td class="num">${r.w}</td><td class="num">${r.l}</td><td class="num"><b>${r.pts}</b></td><td class="num">${(Season.nrr(r) >= 0 ? '+' : '') + Season.nrr(r).toFixed(3)}</td><td class="form">${r.form.slice(-5).map(f => `<span class="${f}">${f}</span>`).join('')}</td></tr>`).join('')}
  </table></div>`;
}
function capsMini(S) {
  const r = Season.leaders(S, 'runs', 3), w = Season.leaders(S, 'wkts', 3);
  if (!r.length) return '<div class="muted">No matches played yet.</div>';
  return `<div class="grid2 even">
    <div><b style="color:var(--orange)">🟠 Orange Cap</b>${r.map(s => `<div style="font-size:13px">${chip(s.team)} ${pl(s.p)} <b>${s.r}</b></div>`).join('')}</div>
    <div><b style="color:var(--purple)">🟣 Purple Cap</b>${w.map(s => `<div style="font-size:13px">${chip(s.team)} ${pl(s.p)} <b>${s.wk}</b></div>`).join('')}</div></div>`;
}

function scoreStr(inn) { return `${inn.runs}/${inn.wk} <span class="muted">(${oversStr(inn.balls)})</span>`; }
function renderTab() {
  const S = G.season; const el = $('#tabBody');
  if (G.tab === 'results') {
    const rs = S.results.slice().reverse();
    el.innerHTML = rs.length ? `<div class="scroll" style="max-height:480px">${rs.map((r, i) => `
      <div class="result ${r.home === G.userId || r.away === G.userId ? 'mine' : ''}" data-ri="${S.results.length - 1 - i}">
        <span class="no">${r.stage === 'League' ? '#' + r.no : r.stage.replace('Qualifier', 'Q').replace('Eliminator', 'ELIM')}</span>
        ${chip(r.inn[0].team)} ${scoreStr(r.inn[0])} <span class="muted">v</span> ${chip(r.inn[1].team)} ${scoreStr(r.inn[1])}
        <span class="spacer"></span><span><b>${r.winner}</b> ${esc(r.margin)}</span></div>`).join('')}</div>` : '<div class="muted">No results yet. Play the first match!</div>';
    $$('[data-ri]', el).forEach(d => d.onclick = () => showScorecard(S.results[+d.dataset.ri]));
  } else if (G.tab === 'stats') {
    el.innerHTML = statsHTML(S);
  } else if (G.tab === 'mine') {
    const tm = G.season.teams[G.userId];
    const rows = tm.squad.map(p => S.stats.get(p.id)).sort((a, b) => Season.mvpPts(b) - Season.mvpPts(a));
    el.innerHTML = `<div class="scroll"><table><tr><th>Player</th><th class="num">M</th><th class="num">Runs</th><th class="num">SR</th><th class="num">HS</th><th class="num">Wkts</th><th class="num">Econ</th><th class="num">POTM</th></tr>
      ${rows.map(s => `<tr><td>${flag(s.p)} ${pl(s.p)} ${tm.sel.xi.some(x => x.id === s.p.id) ? '' : tm.sel.impact && tm.sel.impact.id === s.p.id ? '<span class="tag rtm">IMP</span>' : '<span class="muted">bench</span>'}</td><td class="num">${s.m}</td><td class="num">${s.r}</td><td class="num">${s.b ? (s.r / s.b * 100).toFixed(1) : '–'}</td><td class="num">${s.inns ? s.hs + (s.hsNo ? '*' : '') : '–'}</td><td class="num">${s.wk}</td><td class="num">${s.bb ? (s.rc / s.bb * 6).toFixed(2) : '–'}</td><td class="num">${s.motm}</td></tr>`).join('')}</table></div>`;
  } else {
    const all = S.fixtures.concat(S.playoffs);
    el.innerHTML = `<div class="scroll" style="max-height:480px">${all.filter(f => !f.result).map(f => `<div class="result ${f.home === G.userId || f.away === G.userId ? 'mine' : ''}"><span class="no">${f.stage === 'League' ? '#' + f.no : f.stage}</span>${chip(f.home)} <span class="muted">v</span> ${chip(f.away)} <span class="muted">· ${esc(f.stage === 'League' ? TBY[f.home].venue : '')}</span></div>`).join('') || '<div class="muted">All fixtures played.</div>'}</div>`;
  }
}

function statsHTML(S, big) {
  const n = big ? 10 : 10;
  const runs = Season.leaders(S, 'runs', n), wk = Season.leaders(S, 'wkts', n), six = Season.leaders(S, 'sixes', 5), mvp = Season.leaders(S, 'mvp', 5);
  if (!runs.length) return '<div class="muted">No stats yet.</div>';
  return `
    <h3 style="color:var(--orange)">🟠 Orange Cap</h3><div class="scroll"><table><tr><th>Player</th><th class="num">Inns</th><th class="num">Runs</th><th class="num">Avg</th><th class="num">SR</th><th class="num">HS</th><th class="num">50/100</th><th class="num">6s</th></tr>
    ${runs.map(s => `<tr class="${s.team === G.userId ? 'me' : ''}"><td>${chip(s.team)} ${pl(s.p)}</td><td class="num">${s.inns}</td><td class="num"><b>${s.r}</b></td><td class="num">${(s.r / Math.max(1, s.inns - s.no)).toFixed(1)}</td><td class="num">${(s.r / Math.max(1, s.b) * 100).toFixed(1)}</td><td class="num">${s.hs}${s.hsNo ? '*' : ''}</td><td class="num">${s.f50}/${s.f100}</td><td class="num">${s.f6}</td></tr>`).join('')}</table></div>
    <h3 style="color:var(--purple);margin-top:14px">🟣 Purple Cap</h3><div class="scroll"><table><tr><th>Player</th><th class="num">Overs</th><th class="num">Wkts</th><th class="num">Avg</th><th class="num">Econ</th><th class="num">Best</th></tr>
    ${wk.map(s => `<tr class="${s.team === G.userId ? 'me' : ''}"><td>${chip(s.team)} ${pl(s.p)}</td><td class="num">${oversStr(s.bb)}</td><td class="num"><b>${s.wk}</b></td><td class="num">${(s.rc / s.wk).toFixed(1)}</td><td class="num">${(s.rc / s.bb * 6).toFixed(2)}</td><td class="num">${s.best ? s.best.w + '/' + s.best.r : ''}</td></tr>`).join('')}</table></div>
    <div class="grid2 even" style="margin-top:14px">
      <div><h3>💥 Most sixes</h3>${six.map(s => `<div style="font-size:13px">${chip(s.team)} ${pl(s.p)} <b>${s.f6}</b></div>`).join('')}</div>
      <div><h3>⭐ MVP points</h3>${mvp.map(s => `<div style="font-size:13px">${chip(s.team)} ${pl(s.p)} <b>${s.mvp}</b></div>`).join('')}</div></div>`;
}

/* ---------------- Scorecard ---------------- */
function scorecardHTML(res) {
  const inns = res.inn.map(inn => {
    const batted = inn.bat.filter(c => c.batted);
    const dnb = inn.bat.filter(c => !c.batted).map(c => esc(c.p.name));
    return `<h3 style="margin-top:14px">${chip(inn.team, 'lg')} ${inn.runs}/${inn.wk} <span class="muted">(${oversStr(inn.balls)} ov)</span></h3>
    <div class="scroll"><table class="scorecard"><tr><th>Batter</th><th></th><th class="num">R</th><th class="num">B</th><th class="num">4s</th><th class="num">6s</th><th class="num">SR</th></tr>
    ${batted.map(c => `<tr><td>${esc(c.p.name)}</td><td class="how">${c.out ? esc(c.out) : '<b class="green-t">not out</b>'}</td><td class="num"><b>${c.r}</b></td><td class="num">${c.b}</td><td class="num">${c.f4}</td><td class="num">${c.f6}</td><td class="num">${c.b ? (c.r / c.b * 100).toFixed(1) : '-'}</td></tr>`).join('')}
    <tr><td>Extras</td><td></td><td class="num">${inn.extras}</td><td colspan="4"></td></tr></table></div>
    ${dnb.length ? `<div class="muted" style="font-size:12px">Did not bat: ${dnb.join(', ')}</div>` : ''}
    ${inn.fow.length ? `<div class="muted" style="font-size:12px">FOW: ${inn.fow.map(f => `${f.runs}-${f.wk} (${esc(f.p)}, ${f.ov})`).join(', ')}</div>` : ''}
    <div class="scroll"><table class="scorecard" style="margin-top:6px"><tr><th>Bowler</th><th class="num">O</th><th class="num">R</th><th class="num">W</th><th class="num">Econ</th><th class="num">Dots</th></tr>
    ${inn.bowl.map(b => `<tr><td>${esc(b.p.name)}</td><td class="num">${oversStr(b.balls)}</td><td class="num">${b.r}</td><td class="num"><b>${b.w}</b></td><td class="num">${b.balls ? (b.r / b.balls * 6).toFixed(2) : '-'}</td><td class="num">${b.dots}</td></tr>`).join('')}</table></div>`;
  }).join('');
  const so = res.superOver ? `<p class="gold">⚡ Super Over: ${res.superOver.map(([a, b]) => `${a.short} ${a.runs}/${a.wk} v ${b.short} ${b.runs}/${b.wk}`).join(' · then ')}</p>` : '';
  return `<h2>${res.stage === 'League' ? 'Match ' + res.no : res.stage}: ${chip(res.home, 'lg')} vs ${chip(res.away, 'lg')}</h2>
    <div class="muted">🏟️ ${esc(res.venue)} · Toss: ${res.toss.winner} chose to ${res.toss.choice}${res.dew && res.dew !== 'none' ? ` · 💧 ${res.dew} dew` : ''}</div>
    <p><b>${esc(TBY[res.winner].name)}</b> ${esc(res.margin)} · Player of the Match: <b class="gold">${esc(res.motm ? res.motm.name : '-')}</b></p>${so}${inns}`;
}
function showScorecard(res) {
  modal(scorecardHTML(res) + `<div class="row" style="justify-content:flex-end;margin-top:12px"><button data-close>Close</button></div>`, { wide: true });
}

/* ---------------- Live match centre ---------------- */
function watchMatch(res, after) {
  const evs = [];
  res.inn.forEach((inn, k) => { inn.log.forEach(l => evs.push({ k, l })); evs.push({ k, innEnd: true }); });
  let i = 0, timer = null, speed = 320, finished = false, paused = false;
  const st = [{ runs: 0, wk: 0, balls: 0, started: false }, { runs: 0, wk: 0, balls: 0, started: false }];
  let cur = { k: 0, s: null, n: null, bw: null, over: [], ov: -1 };
  const target = res.inn[0].runs + 1;
  modal(`<div class="row"><h2 style="margin:0">${res.stage === 'League' ? 'Match ' + res.no : res.stage}</h2><span class="muted">🏟️ ${esc(res.venue)}</span><div class="spacer"></div>
      ${[['Slow', 900], ['Normal', 320], ['Fast', 90], ['Turbo', 12]].map(([l, v]) => `<button class="small mspd ${v === speed ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}
      <button class="small" id="mcPause">⏸ Pause</button>
      <button class="small danger" id="mcSkip">Skip to result</button></div>
    <div class="muted" style="margin:6px 0">Toss: ${res.toss.winner} won and chose to ${res.toss.choice}${res.pitchNote ? ` · ${res.pitchNote}` : ''}${res.dew && res.dew !== 'none' ? ` · 💧 ${res.dew} dew expected` : ''}</div>
    <div class="mc-score" id="mcScore"></div>
    <div class="equation" id="mcEq"></div>
    <div class="mc-mid"><div class="panel" id="mcBat"></div><div class="panel" id="mcBowl"></div></div>
    <div class="row"><span class="muted">This over:</span><div class="balls" id="mcBalls"></div></div>
    <div class="comm" id="mcComm" style="margin-top:8px"></div>
    <div id="mcEnd"></div>`, { wide: true, locked: true });
  $$('.mspd').forEach(b => b.onclick = () => { speed = +b.dataset.v; $$('.mspd').forEach(x => x.classList.toggle('on', x === b)); });
  $('#mcPause').onclick = () => { paused = !paused; $('#mcPause').textContent = paused ? '▶ Resume' : '⏸ Pause'; if (!paused && !finished) { clearTimeout(timer); step(); } };
  $('#mcSkip').onclick = () => { paused = false; clearTimeout(timer); while (i < evs.length) apply(evs[i++], true); draw(); finish(); };

  function teamBox(k) {
    const inn = res.inn[k], s = st[k];
    return `<div class="mc-team ${cur.k === k && !finished ? 'batting' : ''}">${chip(inn.team, 'lg')}<div><div class="sc">${s.started ? `${s.runs}/${s.wk}` : '—'}</div><div class="muted">${s.started ? `${oversStr(s.balls)} ov` : 'Yet to bat'}</div></div></div>`;
  }
  function draw() {
    $('#mcScore').innerHTML = teamBox(0) + teamBox(1);
    const s = st[cur.k];
    if (cur.k === 1 && s.started && !finished) {
      const need = target - s.runs, bl = 120 - s.balls;
      $('#mcEq').innerHTML = need > 0 ? `${res.inn[1].short} need <span class="gold">${need}</span> off <span class="gold">${bl}</span> balls · RRR ${(need / Math.max(1, bl) * 6).toFixed(2)}` : '';
    } else if (cur.k === 0 && s.started && !finished) $('#mcEq').innerHTML = `CRR ${(s.runs / Math.max(1, s.balls) * 6).toFixed(2)}`;
    if (cur.s) {
      $('#mcBat').innerHTML = `<h3>At the crease</h3><div>🏏 <b>${esc(cur.s[0])}</b> ${cur.s[1]} (${cur.s[2]})${cur.s[3] ? ' <span class="red-t">OUT</span>' : '*'}</div>${cur.n ? `<div>🏏 ${esc(cur.n[0])} ${cur.n[1]} (${cur.n[2]})</div>` : ''}`;
      $('#mcBowl').innerHTML = `<h3>Bowling</h3><div>🎯 <b>${esc(cur.bw[0])}</b> ${oversStr(cur.bw[1])}-${cur.bw[2]}-${cur.bw[3]}</div>`;
    }
    $('#mcBalls').innerHTML = cur.over.map(b => `<span class="ball ${b.c}">${b.t}</span>`).join('');
  }
  function addComm(txt, cls) {
    const c = $('#mcComm'); if (!c) return;
    const d = document.createElement('div'); d.className = cls || ''; d.innerHTML = txt; c.prepend(d);
    while (c.children.length > 200) c.lastChild.remove();
  }
  function apply(e, quiet) {
    if (e.innEnd) {
      const inn = res.inn[e.k];
      if (e.k === 0) { if (!quiet) addComm(`<b>Innings break:</b> ${inn.short} ${inn.runs}/${inn.wk} (${oversStr(inn.balls)}). ${res.inn[1].short} need ${target} to win.`, 'cE'); cur = { k: 1, s: null, n: null, bw: null, over: [], ov: -1 }; }
      return;
    }
    const l = e.l; const s = st[e.k];
    s.started = true; s.runs = l.runs; s.wk = l.wk;
    if (l.ev === 'end') { if (!quiet) addComm(l.txt, 'cE'); return; }
    if (l.ov !== cur.ov) { cur.ov = l.ov; cur.over = []; }
    s.balls = l.ov * 6 + l.b;
    cur.s = l.s; cur.n = l.n; cur.bw = l.bw;
    const t = l.ev === 'wd' ? 'wd' : l.ev === 'W' ? 'W' : l.lb ? (l.nb ? 'nb' : '') + l.xr + 'lb' : (l.nb ? 'nb' : '') + l.ev;
    const c = l.ev === 'W' ? 'bW' : l.lb ? 'bx' : l.ev === 6 ? 'b6' : l.ev === 4 ? 'b4' : (l.ev === 'wd' || l.nb) ? 'bx' : '';
    cur.over.push({ t, c });
    if (!quiet) addComm(`<span class="muted">${l.ov}.${l.b}</span> ${esc(l.txt)}`, l.ev === 'W' ? 'cW' : l.ev === 6 ? 'c6' : l.ev === 4 ? 'c4' : '');
  }
  function step() {
    if (paused) return;
    if (i >= evs.length) { finish(); return; }
    const e = evs[i++]; apply(e); draw();
    let d = speed;
    if (e.innEnd) d = Math.max(1200, speed * 3);
    else if (e.l.ev === 'W' || e.l.ev === 6) d = speed * 2;
    else if (e.l.ev === 4 || e.l.ev === 'end') d = speed * 1.5;
    timer = setTimeout(step, d);
  }
  function finish() {
    if (finished) return; finished = true; draw();
    const won = res.winner === G.userId;
    const so = res.superOver ? `<p class="gold">⚡ SUPER OVER! ${res.superOver.map(([a, b]) => `${a.short} ${a.runs}/${a.wk} v ${b.short} ${b.runs}/${b.wk}`).join(' · then ')}</p>` : '';
    $('#mcEq').innerHTML = '';
    $('#mcEnd').innerHTML = `<div class="banner" style="margin-top:12px;background:${won ? 'linear-gradient(135deg,#1f7a4a,#0f3d26)' : 'linear-gradient(135deg,#7a1f2b,#3d0f16)'}">
      <h1>${won ? '🎉 VICTORY!' : '😞 DEFEAT'}</h1><div style="font-size:18px">${esc(TBY[res.winner].name)} ${esc(res.margin)}</div>
      <div>Player of the Match: <b class="gold">${esc(res.motm ? res.motm.name : '-')}</b></div>${so}</div>
      <div class="row" style="justify-content:center"><button id="mcCard">📋 Full scorecard</button><button class="primary" id="mcCont">Continue →</button></div>`;
    $('#mcCard').onclick = () => { G.onModalClose = null; showScorecardThen(res, after); };
    $('#mcCont').onclick = () => { closeModal(); after && after(); };
  }
  draw(); step();
}
function showScorecardThen(res, after) {
  modal(scorecardHTML(res) + `<div class="row" style="justify-content:flex-end;margin-top:12px"><button class="primary" id="scCont">Continue →</button></div>`, { wide: true, locked: true });
  $('#scCont').onclick = () => { closeModal(); after && after(); };
}

/* =====================================================================
   END OF SEASON
   ===================================================================== */
function renderEnd() {
  G.screen = 'end';
  const S = G.season;
  const champ = TBY[S.champion];
  const fin = S.playoffs.find(f => f.stage === 'Final').result;
  const me = Season.finishFor(S, G.userId);
  const fc = G.forecast ? G.forecast.findIndex(f => f.id === G.userId) + 1 : null;
  const row = S.table[G.userId];
  const L = k => Season.leaders(S, k, 1)[0];
  const orange = L('runs'), purple = L('wkts'), mvp = L('mvp'), six = L('sixes'), sr = L('sr'), eco = L('econ');
  const emerging = Season.leaders(S, 'mvp', 300).filter(s => s.p.unc)[0];
  const hl = S.highlights;
  const verdict = fc ? (me.rank < fc ? `🚀 Overachieved! Forecast had you ${Season.ordinal(fc)}.` : me.rank > fc ? `📉 Underachieved. Forecast had you ${Season.ordinal(fc)}.` : `🎯 Exactly as the forecast predicted (${Season.ordinal(fc)}).`) : '';
  const myStars = G.season.teams[G.userId].squad.map(p => S.stats.get(p.id)).sort((a, b) => Season.mvpPts(b) - Season.mvpPts(a)).slice(0, 5);
  setTop(`${chip(G.userId)} <span>${me.emoji} ${esc(me.label)}</span>`);
  const award = (ic, title, s, val) => s ? `<div class="award"><div class="ic">${ic}</div><div><div class="muted" style="font-size:12px">${title}</div><div>${chip(s.team)} <b>${pl(s.p)}</b></div><div class="gold">${val}</div></div></div>` : '';
  $('#screen').innerHTML = `
  <div class="wrap">
    <div class="banner" style="background:linear-gradient(135deg, ${champ.color}, ${shade(champ.color)});color:${champ.fg}">
      <div style="font-size:54px">🏆</div><h1>${esc(champ.name)} are IPL 2027 Champions!</h1>
      <div style="font-size:16px">Final at Narendra Modi Stadium: ${fin.inn[0].short} ${fin.inn[0].runs}/${fin.inn[0].wk} v ${fin.inn[1].short} ${fin.inn[1].runs}/${fin.inn[1].wk}. ${esc(TBY[fin.winner].short)} ${esc(fin.margin)}. POTM: ${esc(fin.motm.name)}</div>
      <div style="margin-top:8px"><button class="small" id="finalCard" style="background:#0006;color:#fff">📋 Final scorecard</button></div></div>
    <div class="grid2">
      <div>
        <div class="panel" style="text-align:center"><h3>Your season</h3>
          <div style="font-size:60px">${me.emoji}</div>
          <div style="font-size:26px;font-weight:900">${esc(me.label)}</div>
          <div class="muted">League: ${Season.ordinal(me.pos)} · ${row.w} W / ${row.l} L · ${row.pts} pts · NRR ${(Season.nrr(row) >= 0 ? '+' : '') + Season.nrr(row).toFixed(3)}</div>
          <p>${verdict}</p>
          <div style="text-align:left"><h3>Your top performers</h3>${myStars.map(s => `<div style="font-size:13px">⭐ <b>${pl(s.p)}</b>: ${s.r} runs${s.b ? ` (SR ${(s.r / s.b * 100).toFixed(0)})` : ''}${s.wk ? `, ${s.wk} wkts` : ''}${s.motm ? `, ${s.motm}× POTM` : ''}</div>`).join('')}</div>
        </div>
        <div class="panel" style="margin-top:14px"><h3>Season awards</h3><div class="awards">
          ${award('🟠', 'Orange Cap', orange, orange && `${orange.r} runs · SR ${(orange.r / orange.b * 100).toFixed(1)}`)}
          ${award('🟣', 'Purple Cap', purple, purple && `${purple.wk} wkts · Econ ${(purple.rc / purple.bb * 6).toFixed(2)}`)}
          ${award('⭐', 'Most Valuable Player', mvp, mvp && `${mvp.mvp} pts`)}
          ${award('💥', 'Most Sixes', six, six && `${six.f6} sixes`)}
          ${award('⚡', 'Super Striker (min 120 balls)', sr, sr && `SR ${(sr.r / sr.b * 100).toFixed(1)}`)}
          ${award('🧊', 'Best Economy (min 20 ov)', eco, eco && `Econ ${(eco.rc / eco.bb * 6).toFixed(2)}`)}
          ${award('🌱', 'Emerging Player (uncapped)', emerging, emerging && `${emerging.r} runs · ${emerging.wk} wkts`)}
          </div>
          <div style="margin-top:10px;font-size:13px">
            ${hl.hi ? `<div>📈 Highest total: ${chip(hl.hi.team)} ${hl.hi.runs}/${hl.hi.wk} v ${hl.hi.vs}</div>` : ''}
            ${hl.lo ? `<div>📉 Lowest all-out total: ${chip(hl.lo.team)} ${hl.lo.runs} v ${hl.lo.vs}</div>` : ''}
            ${hl.bestBowl ? `<div>🎯 Best figures: ${esc(hl.bestBowl.p.name)} (${hl.bestBowl.team}) ${hl.bestBowl.w}/${hl.bestBowl.r} v ${hl.bestBowl.vs}</div>` : ''}
            ${hl.bigWin ? `<div>💪 Biggest win: ${chip(hl.bigWin.team)} by ${hl.bigWin.m} runs v ${hl.bigWin.vs}</div>` : ''}
          </div></div>
      </div>
      <div>
        <div class="panel"><h3>Final league table</h3>${tableHTML(S)}
          <div style="margin-top:10px;font-size:13px">${S.playoffs.map(f => `<div class="result" data-po="${f.stage}"><span class="no">${f.stage.replace('Qualifier', 'Q').replace('Eliminator', 'ELIM')}</span>${chip(f.result.inn[0].team)} ${scoreStr(f.result.inn[0])} v ${chip(f.result.inn[1].team)} ${scoreStr(f.result.inn[1])}<span class="spacer"></span><b>${f.result.winner}</b></div>`).join('')}</div></div>
        <div class="panel" style="margin-top:14px">${statsHTML(S)}</div>
      </div>
    </div>
    <div class="row" style="justify-content:center;margin:20px 0 40px">
      <button class="primary bidbtn" id="resim">🔁 Re-simulate season (same squads)</button>
      <button class="bidbtn" id="editXI">✏️ Change XI & re-sim</button>
      <button class="bidbtn" id="newAuc">🆕 New auction</button>
    </div>
  </div>`;
  $('#finalCard').onclick = () => showScorecard(fin);
  $$('[data-po]').forEach(d => d.onclick = () => showScorecard(S.playoffs.find(f => f.stage === d.dataset.po).result));
  $('#resim').onclick = () => { G.season = Season.create(G.teams, G.userId); G.tab = 'results'; renderSeason(); };
  $('#editXI').onclick = () => renderPost();
  $('#newAuc').onclick = () => {
    modal(`<h2>Start a brand-new auction?</h2><p class="muted">All current squads and season results will be lost.</p>
      <div class="row" style="justify-content:flex-end"><button data-close>Cancel</button><button class="danger" id="confNew">Start new auction</button></div>`);
    $('#confNew').onclick = () => { closeModal(); G.teams = null; G.season = null; G.forecast = null; G.userId = null; window.scrollTo(0, 0); renderHome(); };
  };
}

/* =====================================================================
   PLAYER PROFILE / TEAM VIEW / MID-SEASON XI
   ===================================================================== */
function showPlayer(id) {
  const p = PLAYERS[id]; if (!p) return;
  const S = AS();
  const sale = S.sales && S.sales.find(x => x.p.id === id);
  const st = G.season ? G.season.stats.get(id) : null;
  let auctionLine = '';
  if (sale) auctionLine = `🔨 Sold to ${chip(sale.team)} for <b class="gold">${fmt(sale.price)}</b>${sale.how === 'rtm' ? ' <span class="tag rtm">RTM</span>' : sale.how === 'fill' ? ' <span class="muted">(squad top-up)</span>' : ''}`;
  else if (S.started && S.lot && S.lot.p.id === id && !S.lot.done) auctionLine = '🎙️ On the block right now!';
  else if (S.started && S.lots.slice(S.idx).some(e => e.p.id === id)) auctionLine = `⏳ Still to come in the auction (${esc(S.lots.slice(S.idx).find(e => e.p.id === id).set)})`;
  else if (S.started) auctionLine = '❌ Unsold';
  const seasonLine = st && st.m ? `<div class="statline" style="border-left-color:var(--accent)">🏏 IPL 2027: ${st.m} matches · <b>${st.r}</b> runs${st.b ? ` @ SR ${(st.r / st.b * 100).toFixed(1)}` : ''}${st.inns ? ` · HS ${st.hs}${st.hsNo ? '*' : ''}` : ''} · ${st.f6} sixes${st.bb ? ` · <b>${st.wk}</b> wkts @ econ ${(st.rc / st.bb * 6).toFixed(2)}${st.best ? ` · best ${st.best.w}/${st.best.r}` : ''}` : ''}${st.motm ? ` · ${st.motm}× POTM` : ''}</div>` : '';
  modal(`<div style="display:flex;gap:12px;align-items:center">
      <div class="ovr ${ovrClass(p.ovr)}">${p.ovr}<small>OVR</small></div>
      <div><h2 style="margin:0">${flag(p)} ${esc(p.name)}</h2>
        <div class="pmeta">${roleLabel(p)} · ${COUNTRY[p.c].name}${p.ovs ? ' · <b class="gold">Overseas</b>' : ''}</div>
        <div class="pmeta">${p.bt ? BOWL_TYPE[p.bt] : 'Does not bowl'} · Bat rating ${p.batR}${p.bt ? ' · Bowl rating ' + p.bowlR : ''}</div></div></div>
    <div class="bars">${bar('Batting', p.bat, '#4fa3ff')}${bar('Power', p.pow, '#ff9f43')}${p.bt ? bar('Bowling', p.bowl, '#2fd27a') + bar('Control', p.eco, '#b57bff') : ''}</div>
    <div style="margin-top:8px">${tagsHTML(p)}</div>
    ${p.stat ? `<div class="statline">📊 ${esc(p.stat)}</div>` : ''}
    ${seasonLine}
    <p class="muted">2026 team: ${p.prev ? chip(p.prev) + ' ' + esc(TBY[p.prev].name) : 'Free agent'} · Base price ${fmt(p.base)}</p>
    ${auctionLine ? `<p>${auctionLine}</p>` : ''}
    <div class="row" style="justify-content:flex-end"><button data-close>Close</button></div>`);
}

function showSeasonTeam(id) {
  const S = G.season; const side = S.teams[id]; const t = TBY[id];
  const pr = side.prepared;
  const rows = side.squad.map(p => S.stats.get(p.id)).sort((a, b) => Season.mvpPts(b) - Season.mvpPts(a));
  const role = p => side.sel.impact && side.sel.impact.id === p.id ? '<span class="tag rtm">IMPACT</span>' : side.sel.xi.some(x => x.id === p.id) ? (side.sel.captain && side.sel.captain.id === p.id ? '<span class="tag">C</span>' : '') : '<span class="muted">bench</span>';
  const row = S.table[id];
  modal(`<h2>${chip(id, 'lg')} ${esc(t.name)}</h2>
    <p class="muted">${row.w}W ${row.l}L · ${row.pts} pts · NRR ${(Season.nrr(row) >= 0 ? '+' : '') + Season.nrr(row).toFixed(3)} · 🏟️ ${esc(t.venue)}</p>
    <div class="grid2 even">
      <div><h3>Batting</h3>${pr.lineup.map((p, i) => `<div style="font-size:13px">${i + 1}. ${pl(p)} <span class="muted">${p.batR}</span></div>`).join('')}</div>
      <div><h3>Bowling attack</h3>${pr.bowlers.slice(0, 6).map(p => `<div style="font-size:13px">${pl(p)} <span class="muted">${p.bt ? BOWL_TYPE[p.bt] : 'part-timer'}</span></div>`).join('')}
        ${side.sel.impact ? `<div class="muted" style="font-size:12px;margin-top:6px">Impact: ${esc(side.sel.impact.name)} for ${esc(side.sel.replaced ? side.sel.replaced.name : '—')}</div>` : ''}</div>
    </div>
    <h3 style="margin-top:12px">Season stats</h3>
    <div class="scroll"><table><tr><th>Player</th><th class="num">M</th><th class="num">Runs</th><th class="num">SR</th><th class="num">Wkts</th><th class="num">Econ</th></tr>
      ${rows.map(s => `<tr><td>${flag(s.p)} ${pl(s.p)} ${role(s.p)}</td><td class="num">${s.m}</td><td class="num">${s.r}</td><td class="num">${s.b ? (s.r / s.b * 100).toFixed(0) : '–'}</td><td class="num">${s.wk}</td><td class="num">${s.bb ? (s.rc / s.bb * 6).toFixed(2) : '–'}</td></tr>`).join('')}</table></div>
    <div class="row" style="justify-content:flex-end;margin-top:12px">${id === G.userId ? '<button id="stEdit">✏️ Change XI</button>' : ''}<button data-close>Close</button></div>`, { wide: true });
  if (id === G.userId) $('#stEdit').onclick = openXIModal;
}

function openXIModal() {
  const tm = myTeam();
  const backup = { ...tm.sel, xi: tm.sel.xi.slice() };
  modal(`<h2>✏️ Change your Playing XI</h2><p class="muted">Changes apply from your next match.</p><div id="selEditor"></div>
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button id="xiCancel">Cancel</button><button class="primary" id="xiSave">Save XI</button></div>`, { wide: true, locked: true });
  renderSelEditor();
  $('#xiCancel').onclick = () => { tm.sel = backup; closeModal(); };
  $('#xiSave').onclick = () => {
    const v = Engine.validateSelection(tm.sel);
    if (v.errs.length) { toast('⚠️ ' + esc(v.errs[0])); return; }
    const side = G.season.teams[G.userId];
    side.sel = tm.sel; side.prepared = Engine.prepare(side);
    closeModal(); toast('✅ XI updated for the next match'); renderSeason();
  };
}

renderHome();
