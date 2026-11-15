'use strict';
/* =====================================================================
   AUCTION ENGINE — AI franchises, bidding wars, new RTM rule
   All money is in LAKHS (100 L = ₹1 Cr)
   ===================================================================== */
const Auction = (() => {
  const _isNode = typeof module !== 'undefined' && typeof window === 'undefined';
  const D = _isNode ? require('./data.js') : { TEAMS, PLAYERS, SETS };
  const G = _isNode ? require('./engine.js').gauss : Engine.gauss;

  const PURSE = 12000, MAX_SQUAD = 25, MIN_SQUAD = 18, MAX_OVS = 8, RTM_CARDS = 6, RTM_CAPPED = 5, RTM_UNCAPPED = 2;
  const K = 0.75; // valuation scale (tuned by headless sims)
  const rand = Math.random;

  const inc = cur => cur < 100 ? 5 : cur < 200 ? 10 : cur < 300 ? 20 : 25;
  function fmt(l) {
    if (l >= 100) return '₹' + (l / 100).toFixed(2).replace(/\.?0+$/, '') + ' Cr';
    return '₹' + l + ' L';
  }
  // round a lakh amount UP onto the legal bid ladder starting from `from`
  function ladder(from, target) {
    let a = from;
    while (a < target) a += inc(a);
    return a;
  }

  const S = {
    teams: {}, order: [], lots: [], idx: 0, unsold: [], sales: [], record: null,
    userId: null, speed: 1, hammer: 2200, tm: null, autopilot: false, paused: false, simSet: null, simAll: false, phase: 'main',
    lot: null, hooks: {}, done: false, started: false,
  };
  let wakeFn = null, resumeFn = null;

  /* ---------------- Setup ---------------- */
  function init(userId, hooks, opts) {
    S.userId = userId; S.hooks = hooks || {};
    S.teams = {}; S.order = [];
    for (const t of D.TEAMS) {
      S.teams[t.id] = { id: t.id, t, purse: PURSE, squad: [], rtm: RTM_CARDS, rtmC: 0, rtmU: 0, user: t.id === userId };
      S.order.push(t.id);
    }
    S.autopilot = false; S.simAll = false; S.simSet = null; S.skipSet = null; S.skipAll = false; S.lot = null; S.paused = false; S.lots = buildLots(); S.idx = 0; S.unsold = []; S.sales = []; S.record = null; S.done = false; S.phase = 'main';
  }

  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function chunk(a, n) { const r = []; for (let i = 0; i < a.length; i += n) r.push(a.slice(i, i + n)); return r; }

  // IPL-style: sets in auction order, players drawn at random inside each set
  function buildLots() {
    const lots = [];
    for (const st of D.SETS) shuffle(D.PLAYERS.filter(p => p.set === st.code)).forEach(p => lots.push({ p, set: st.name }));
    return lots;
  }

  /* ---------------- Team helpers ---------------- */
  const ovsCount = T => T.squad.filter(s => s.p.ovs).length;
  const canHold = (T, p) => T.squad.length < MAX_SQUAD && (!p.ovs || ovsCount(T) < MAX_OVS);
  // real rule: 6 RTMs (no retentions), at most 5 on capped and 2 on uncapped players
  const canRTM = (T, p) => T.rtm > 0 && (p.unc ? T.rtmU < RTM_UNCAPPED : T.rtmC < RTM_CAPPED);
  const hardCap = T => T.purse - 30 * Math.max(0, MIN_SQUAD - T.squad.length - 1);

  function baseValue(p) {
    const x = Math.max(0, (p.ovr - 58) / 37);
    let v = 25 + K * 1500 * Math.pow(x, 2.0);
    if (!p.ovs) v *= 1.2;
    if (p.brand) v = Math.max(v, p.brand);
    return v;
  }

  const XI_NEED = { WK: 1, BAT: 4, AR: 2, PACE: 3, SPIN: 2 };
  const DEPTH = { WK: 2, BAT: 6, AR: 5, PACE: 7, SPIN: 4 };
  function needMult(T, p) {
    const c = p.cat;
    const same = T.squad.filter(s => s.p.cat === c).map(s => s.p.ovr).sort((a, b) => b - a);
    let m;
    if (same.length < XI_NEED[c]) m = 1.2;
    else if (p.ovr > same[XI_NEED[c] - 1] + 2) m = 1.0;
    else if (same.length < DEPTH[c]) m = 0.6;
    else m = 0.3;
    if (p.ovs) {
      const os = T.squad.filter(s => s.p.ovs).map(s => s.p.ovr).sort((a, b) => b - a);
      if (os.length >= 4 && p.ovr <= os[3]) m *= 0.6;
      if (os.length >= 6) m *= 0.75;
    }
    return m;
  }

  function valuation(T, p) {
    if (!canHold(T, p)) return 0;
    let v = baseValue(p);
    const pr = T.t.persona.pref;
    if (pr.SPIN && p.spin && (p.role === 'BOWL' || p.role === 'AR')) v *= pr.SPIN;
    if (pr.PACE && p.cat === 'PACE') v *= pr.PACE;
    if (pr.AR && p.role === 'AR') v *= pr.AR;
    if (pr.UNC && p.unc) v *= pr.UNC;
    if (pr.STAR && p.ovr >= 86) v *= pr.STAR;
    if (pr.POW && p.pow >= 90) v *= pr.POW;
    if (pr.IND && !p.ovs) v *= pr.IND;
    if (pr.OVS && p.ovs) v *= pr.OVS;
    if (pr.ANC && p.tags.includes('ANC')) v *= pr.ANC;
    v *= T.t.persona.agg;
    v *= needMult(T, p);
    const size = T.squad.length;
    // money per open slot: teams sitting on cash bid harder, stretched teams ease off
    const perSlot = T.purse / Math.max(1, 22 - size);
    // later in the auction the pool is thinner, so a rupee per slot is worth more
    const progress = S.lots.length ? Math.min(1, S.idx / S.lots.length) : 0;
    const ref = 545 * (1 - 0.55 * progress);
    v *= Math.max(0.75, Math.min(2.2, Math.pow(perSlot / ref, 0.65)));
    if (S.phase === 'accel' && size < MIN_SQUAD) v = Math.max(v, p.base * 1.3);
    // keep enough for the rest of the squad: ~₹1 Cr per empty slot below 18 (₹45 L once 15 are in)
    const left = Math.max(0, MIN_SQUAD - size - 1);
    const reserve = left * (size >= 15 ? 45 : 100);
    v = Math.min(v, softCap(T, p), hardCap(T), Math.max(p.base, T.purse - reserve));
    return Math.floor(v);
  }
  function softCap(T, p) {
    const per = T.purse / Math.max(1, 23 - T.squad.length);
    const softMul = p.ovr >= 88 || p.brand ? 3.9 : p.ovr >= 84 ? 2.8 : p.ovr >= 78 ? 2.0 : 1.5;
    return per * softMul;
  }

  /* ---------------- Timing helpers ---------------- */
  const skipping = () => !S.simAll && !!S.lot && !!S.skipSet && S.skipSet === S.lot.set;
  const isInstant = () => S.simAll || (S.lot && (S.lot.instant || S.simSet === S.lot.set || S.skipSet === S.lot.set));
  // while anything is being simulated the user's franchise is run by its AI manager, within its own purse
  // (except "skip set", where the user simply sits the set out)
  const auto = () => S.autopilot || (!!isInstant() && !skipping());
  // Pause-aware timer. raw = not affected by the auction speed. The current timer is
  // exposed as S.tm so the UI can draw the hammer countdown.
  function wait(ms, keep, raw, kind) {
    if (isInstant()) return Promise.resolve();
    const fast = !keep && S.lot && S.lot.passed && !S.lot.done;
    const dur = ms / (raw ? 1 : S.speed) / (fast ? 7 : 1);
    return new Promise(res => {
      const tm = S.tm = { total: dur, left: dur, t0: 0, running: false, kind: kind || '' };
      let t = null;
      tm.arm = () => { if (tm.running) return; tm.running = true; tm.t0 = Date.now(); t = setTimeout(done, tm.left); };
      tm.hold = () => { if (!tm.running) return; tm.running = false; clearTimeout(t); tm.left = Math.max(0, tm.left - (Date.now() - tm.t0)); };
      function done() { clearTimeout(t); tm.running = false; tm.left = 0; wakeFn = null; if (S.tm === tm) S.tm = null; res(); }
      wakeFn = done;
      if (!S.paused) tm.arm();
    }).then(waitPause);
  }
  function timeLeft() {
    const tm = S.tm; if (!tm) return null;
    return { left: tm.running ? Math.max(0, tm.left - (Date.now() - tm.t0)) : tm.left, total: tm.total, kind: tm.kind };
  }
  // is the human actually able to act on this lot? Then give them proper time.
  function userIn(lot) {
    if (auto() || !lot || lot.passed) return false;
    const U = S.teams[S.userId]; if (!U) return false;
    return lot.bidder === S.userId || userCanBid().ok;
  }
  function waitPause() { if (!S.paused) return; return new Promise(res => { resumeFn = res; }); }
  function wake() { if (wakeFn) wakeFn(); }
  function setPaused(v) { S.paused = v; if (S.tm) { if (v) S.tm.hold(); else S.tm.arm(); } if (!v && resumeFn) { const r = resumeFn; resumeFn = null; r(); } }
  const emit = (name, ...a) => { const h = S.hooks[name]; return h ? h(...a) : undefined; };
  const log = (txt, cls) => emit('onLog', txt, cls || '');

  /* ---------------- Lot ---------------- */
  function nextAmount(lot) { return lot.bidder ? lot.bid + inc(lot.bid) : lot.p.base; }

  function aiCandidates(lot, amt) {
    const out = [];
    for (const id of S.order) {
      const T = S.teams[id];
      if ((T.user && !auto()) || id === lot.bidder) continue;
      if (!canHold(T, lot.p) || amt > hardCap(T)) continue;
      if (lot.late && lot.late.id === id && amt < lot.late.after) continue;
      if (S.phase === 'accel' && T.squad.length >= MIN_SQUAD && poolLeft() <= shortfall() + 4) continue;
      if ((lot.vals[id] || 0) >= amt) out.push(T);
    }
    return out;
  }

  function placeBid(lot, teamId, amount, jump) {
    const prev = lot.bidder;
    lot.bid = amount; lot.bidder = teamId; lot.going = 0; lot.nbids++;
    if (!lot.inFight.has(teamId)) { lot.inFight.add(teamId); lot.newEntrant = true; } else lot.newEntrant = false;
    lot.history.push({ team: teamId, amount });
    // bidding war detection
    const h = lot.history;
    let war = false;
    if (h.length >= 6) {
      const last = h.slice(-6).map(x => x.team);
      const uniq = new Set(last);
      war = uniq.size === 2;
    }
    const name = S.teams[teamId].t.short;
    if (!isInstant()) {
      let txt;
      if (jump) txt = `💥 JUMP BID! ${name} slams the paddle — ${fmt(amount)}!`;
      else if (lot.nbids === 1) txt = `${name} opens the bidding at ${fmt(amount)}.`;
      else if (lot.newEntrant && lot.nbids > 2) txt = `🆕 A fresh paddle! ${name} enters at ${fmt(amount)}!`;
      else txt = `${fmt(amount)} — ${name}${prev ? '' : ''}`;
      log(txt, jump ? 'jump' : 'bid', teamId);
      if (war && !lot.warAnnounced) {
        lot.warAnnounced = true;
        const [a, b] = Array.from(new Set(h.slice(-6).map(x => x.team)));
        log(`🔥 BIDDING WAR! ${S.teams[a].t.short} vs ${S.teams[b].t.short}!`, 'war');
      }
      if (S.record && amount > S.record.price && !lot.recordAnnounced && amount >= 1500) {
        lot.recordAnnounced = true; log(`📈 That's above the auction record of ${fmt(S.record.price)}!`, 'war');
      }
      if (amount >= 2700 && !lot.allTimeAnnounced) { lot.allTimeAnnounced = true; log('🚨 IPL HISTORY! Beyond Rishabh Pant\'s ₹27 Cr all-time record!', 'war'); }
    }
    emit('onBid', lot, teamId, amount);
  }

  function checkDropouts(lot) {
    if (isInstant()) return;
    const amt = nextAmount(lot);
    for (const id of Array.from(lot.inFight)) {
      if (id === lot.bidder || S.teams[id].user) continue;
      if ((lot.vals[id] || 0) < amt && !lot.dropped.has(id)) {
        lot.dropped.add(id);
        log(`${S.teams[id].t.short} drop out.`, 'drop');
      }
    }
  }

  // Every franchise decides for itself whether to chase this player:
  // player quality, how badly they need the role, purse per open slot, overseas room and style.
  function pickInterest(lot) {
    const p = lot.p;
    lot.trueVals = { ...lot.vals };
    const q = Math.max(0, Math.min(1, (p.ovr - 62) / 32));
    const chosen = new Set(), passive = [];
    for (const id of Object.keys(lot.vals)) {
      const T = S.teams[id], v = lot.vals[id];
      if (v < p.base) continue;
      if (S.phase === 'accel' && T.squad.length < MIN_SQUAD) { chosen.add(id); continue; }
      if (T.user) { chosen.add(id); continue; } // the user's manager already decided in managerValue()
      const need = needMult(T, p);
      const slots = Math.max(1, 22 - T.squad.length);
      const purseF = Math.max(0.1, Math.min(1.15, (T.purse / slots) / Math.max(p.base, 60) / 1.6));
      const keen = Math.min(1.6, v / p.base) / 1.6;
      let pr = (0.05 + 0.42 * Math.pow(q, 1.5) + 0.18 * keen) * Math.min(1.15, need) * purseF * T.t.persona.agg;
      pr = Math.max(0, Math.min(0.62, pr + (rand() - 0.5) * 0.12));
      if (rand() < pr) chosen.add(id); else passive.push(id);
    }
    lot.late = null;
    if (passive.length && rand() < 0.18) {
      const id = passive[Math.floor(rand() * passive.length)];
      lot.late = { id, after: Math.max(p.base, Math.floor(lot.vals[id] * (0.45 + 0.35 * rand()))) };
    }
    for (const id of Object.keys(lot.vals)) if (!chosen.has(id) && !(lot.late && lot.late.id === id)) lot.vals[id] = 0;
  }

  // players still obtainable after this lot, and how many signings teams below 18 still need
  const poolLeft = () => (S.lots.length - S.idx) + S.unsold.length;
  const shortfall = () => S.order.reduce((n, id) => n + Math.max(0, MIN_SQUAD - S.teams[id].squad.length), 0);
  function aiValue(T, p) {
    if (T.user) return Math.floor(managerValue(T, p) * Math.exp(G() * 0.06));
    let v = valuation(T, p) * Math.exp(G() * 0.2);
    if (p.ovr >= 86 && rand() < 0.18) v *= 1.35; // someone falls in love
    if (p.prev === T.id) v *= 1.05; // familiarity
    return Math.floor(Math.min(v, softCap(T, p) * 1.15, hardCap(T)));
  }

  /* ---------- the user's AI manager: builds a squad the way a person would ----------
     It keeps a target XI (+ impact) in mind: 1 WK, 4 batters, 2 all-rounders, 3 pacers, 2 spinners,
     max 4 overseas - the same shape the team selector uses. Every player is judged by how much he
     improves that XI; the purse is spread over the XI places still open, a small reserve buys a cheap
     bench, and nothing is spent on players who would just sit out. */
  const XI_SLOTS = { WK: 1, BAT: 4, AR: 2, PACE: 3, SPIN: 2 };
  const EMPTY_SLOT = 55; // price reference: an unfilled XI place ~ a replacement-level player
  // what a player is worth in each XI slot (same rules as the team selector)
  function slotVals(p) {
    if (p.role === 'WK') return [['WK', p.batR + 4], ['BAT', p.batR]];
    if (p.role === 'BAT') return [['BAT', p.batR]];
    if (p.role === 'AR') {
      const r = [['AR', p.ovr]];
      if (p.batR >= 70) r.push(['BAT', p.batR - 2]);
      if (p.bowl >= 60) r.push([p.spin ? 'SPIN' : 'PACE', p.bowlR - 2]);
      return r;
    }
    return [[p.spin ? 'SPIN' : 'PACE', p.bowlR]];
  }
  // Look ahead (the auction order is public): for each XI slot, what could we still realistically land later?
  // With nine rivals bidding, assume about the 5th-best remaining option for the first open place, worse for the next ones.
  let lookCache = null;
  function lookahead(T) {
    const key = S.idx + ':' + T.squad.length;
    if (lookCache && lookCache.key === key) return lookCache.v;
    const rest = S.lots.slice(S.idx).map(e => e.p).concat(S.unsold).filter(p => canHold(T, p));
    const by = { WK: [], BAT: [], AR: [], PACE: [], SPIN: [] };
    for (const p of rest) for (const [s, v] of slotVals(p)) by[s].push(v);
    const v = {};
    for (const s of Object.keys(by)) {
      const arr = by[s].sort((x, y) => y - x);
      v[s] = j => Math.max(EMPTY_SLOT, (arr[Math.min(arr.length - 1, 4 + 3 * j)] || EMPTY_SLOT) - 1);
    }
    lookCache = { key, v };
    return v;
  }
  function bestXI(players, fallback) {
    const c = [];
    for (const p of players) for (const [s, v] of slotVals(p)) c.push([p, s, v]);
    c.sort((x, y) => y[2] - x[2]);
    const left = { ...XI_SLOTS }, used = new Set(); let ovs = 0, sum = 0, n = 0;
    for (const [p, s, v] of c) {
      if (n >= 12) break;
      if (used.has(p.id) || left[s] <= 0 || (p.ovs && ovs >= 4)) continue;
      used.add(p.id); left[s]--; sum += v; n++; if (p.ovs) ovs++;
    }
    let empty = 0;
    for (const s of Object.keys(left)) for (let j = 0; j < left[s]; j++) empty += fallback ? fallback[s](j) : EMPTY_SLOT;
    return { score: sum + empty, filled: n, left };
  }
  const BENCH = { WK: 2, BAT: 5, AR: 4, PACE: 5, SPIN: 3 }; // sensible cover for injuries
  function managerValue(T, p) {
    if (!canHold(T, p)) return 0;
    const sq = T.squad.map(s => s.p), now = bestXI(sq), withP = bestXI(sq.concat([p]));
    const gain = withP.score - now.score; // how much better the XI gets (prices the player)
    const look = lookahead(T);
    const worthIt = bestXI(sq.concat([p]), look).score - bestXI(sq, look).score; // better than what's still to come?
    const size = T.squad.length, openXI = 12 - now.filled;
    const benchToBuy = Math.max(0, MIN_SQUAD - size - openXI); // cheap players still needed to reach 18
    const xiPurse = T.purse - benchToBuy * 90; // ~₹1 Cr a bench place, so the cover is worth having
    const progress = S.lots.length ? Math.min(1, S.idx / S.lots.length) : 1;
    if (worthIt >= 1 && gain >= (openXI > 0 ? 2 : 5) && (openXI > 0 || size < 23)) { // a clear upgrade, and no better option coming
      // a real upgrade: pay for quality, more if he fills an empty place, more as the pool thins out
      let quality = p.ovr >= 90 ? 2.1 : p.ovr >= 87 ? 1.7 : p.ovr >= 84 ? 1.35 : p.ovr >= 80 ? 1.1 : 0.9;
      // two or three marquee-sized buys, then spread the money: a squad needs bowlers as well as stars
      const big = T.squad.filter(s => s.price >= 1000).length;
      if (big >= 3) quality = Math.min(quality, 1.0); else if (big >= 2) quality = Math.min(quality, 1.25);
      const perSlot = xiPurse / Math.max(1, openXI);
      const late = progress > 0.35 ? 1 + (progress - 0.35) * 1.6 : 1;
      // pay for the edge over what the rest of the auction will still offer in this role
      const gm = Math.max(0.7, Math.min(1.35, 0.8 + 0.03 * worthIt));
      // richer than the rivals per open place? then outbid them - money left at the end is wasted
      const rivals = S.order.map(id => S.teams[id]).filter(X => !X.user);
      const rivalPer = rivals.reduce((s, X) => s + X.purse / Math.max(1, 22 - X.squad.length), 0) / Math.max(1, rivals.length);
      const cash = Math.max(1, Math.min(1.9, Math.pow(perSlot / Math.max(50, rivalPer), 0.6)));
      let v = baseValue(p) * gm * 1.15 * late * cash;
      v = openXI > 0 ? Math.min(v, perSlot * quality) : Math.min(v * 0.8, xiPurse * 0.45); // upgrades over a full XI cost less
      return Math.max(0, Math.min(v, hardCap(T), xiPurse));
    }
    // not an XI player: cover for thin roles only, up to a sensible squad size
    const same = sq.filter(x => x.cat === p.cat).length;
    const mustFill = size < MIN_SQUAD && progress > 0.85; // late on, reach 18 with real buys rather than top-ups
    if (size >= 22 || same >= BENCH[p.cat]) return mustFill ? p.base : 0;
    if (openXI > 0 && (progress < 0.7 || size + openXI >= MIN_SQUAD + 1)) return 0; // the XI comes first
    const spare = T.purse - openXI * 300; // never eat into the XI money
    const perBench = spare / Math.max(1, 21 - size - openXI); // spread what's left over a ~21-man squad
    const useful = p.ovr >= 72 ? Math.min(baseValue(p) * 1.25, perBench * 2.2) : p.base * 1.2;
    return Math.max(0, Math.min(hardCap(T), spare, Math.max(p.base, useful)));
  }
  // a sim started in the middle of a lot: the user's AI manager gets a say on this player too
  function joinUser() {
    const lot = S.lot, U = S.teams[S.userId];
    if (!lot || lot.closed || lot.passed || !U || lot.vals[U.id] !== undefined) return;
    lot.vals[U.id] = aiValue(U, lot.p);
    if (lot.trueVals) lot.trueVals[U.id] = lot.vals[U.id];
  }
  async function runLot(entry) {
    const p = entry.p;
    const lot = {
      p, set: entry.set, bid: 0, bidder: null, going: 0, history: [], inFight: new Set(), dropped: new Set(),
      vals: {}, nbids: 0, instant: false, done: false,
    };
    S.lot = lot;
    for (const id of S.order) {
      const T = S.teams[id];
      if (T.user && !auto()) continue;
      lot.vals[id] = aiValue(T, p);
    }
    pickInterest(lot);
    emit('onLot', lot);
    if (!isInstant()) log(`🎙️ Next up: ${p.name} (${p.role}) — base ${fmt(p.base)}`, 'announce');
    if (userIn(lot)) await wait(Math.max(1500 / S.speed, S.hammer * 0.8), false, true, 'intro');
    else await wait(1500);

    while (true) {
      const amt = nextAmount(lot);
      const cands = aiCandidates(lot, amt);
      let acted = false;
      if (cands.length) {
        const best = Math.max(...cands.map(T => lot.vals[T.id]));
        const margin = (best - amt) / best;
        let hes = 0;
        if (!isInstant()) hes = lot.going === 0 ? (margin < 0.12 ? 0.45 : 0.07) : lot.going === 1 ? (margin < 0.12 ? 0.3 : 0.04) : 0.12;
        if (rand() >= hes) {
          const w = cands.map(T => ((lot.vals[T.id] - amt) / lot.vals[T.id] + 0.15) * T.t.persona.agg);
          let r = rand() * w.reduce((a, b) => a + b, 0), chosen = cands[0];
          for (let i = 0; i < cands.length; i++) { if ((r -= w[i]) < 0) { chosen = cands[i]; break; } }
          let bidAmt = amt, jump = false;
          const myV = lot.vals[chosen.id];
          if (lot.bidder && amt >= 200 && myV > amt * 1.7 && rand() < 0.09) {
            const tgt = Math.min(myV * 0.8, hardCap(chosen));
            const j = ladder(amt, amt + (tgt - amt) * 0.5);
            if (j > amt + inc(amt) * 2 && j <= tgt) { bidAmt = j; jump = true; }
          }
          placeBid(lot, chosen.id, bidAmt, jump);
          acted = true;
          checkDropouts(lot);
        }
      }
      if (!acted) {
        if (lot.going >= 3) break;
        lot.going++;
        if (!isInstant()) {
          const call = ['Going once…', 'Going twice…', 'Going thrice…'][lot.going - 1];
          if (lot.bidder) log(`🔨 ${call} ${fmt(lot.bid)} to ${S.teams[lot.bidder].t.short}`, 'going');
          else log(lot.going === 1 ? `🔨 ${fmt(p.base)}… any takers?` : `🔨 ${call}`, 'going');
        }
        emit('onGoing', lot);
      }
      const r = rand();
      if (acted) await wait(650 + r * 700, false, false, 'ai');
      else if (userIn(lot)) await wait(lot.bidder ? S.hammer : S.hammer * 0.6, false, true, 'hammer');
      else await wait(900, false, false, 'hammer');
    }
    lot.closed = true;
    emit('onGoing', lot);

    if (!lot.bidder) {
      lot.done = true;
      S.unsold.push(p);
      if (!isInstant()) log(`❌ UNSOLD — ${p.name} finds no buyer.`, 'unsold');
      emit('onUnsold', lot);
      await wait(Math.max(1200 / S.speed, lot.passed ? 600 : 1100), true, true, 'result');
      return;
    }
    let winner = S.teams[lot.bidder], price = lot.bid, viaRTM = false;
    // ---------- RTM phase ----------
    const H = p.prev && S.teams[p.prev];
    if (H && H.id !== winner.id && canRTM(H, p) && canHold(H, p) && price <= hardCap(H)) {
      let use;
      const hUser = H.user && !auto(), wUser = winner.user && !auto();
      const hv = hUser ? 0 : (lot.trueVals[H.id] || 0) * H.t.persona.rtm;
      if (hUser) {
        use = S.skipAll ? false : await emit('askRTM', { p, price, winner: winner.id, cards: H.rtm });
      } else {
        use = hv * 0.85 >= price && p.ovr >= (p.unc ? 70 : 77); // RTMs are for core players only
        // price-push bluff: force the user to pay more
        if (!use && wUser && price <= hv * 1.3 && rand() < 0.15) use = true;
      }
      if (use) {
        log(`🃏 RTM! ${H.t.short} raise the Right-To-Match card for ${p.name}!`, 'rtm');
        emit('onRTM', lot, H.id);
        await wait(1400);
        // final raise by the highest bidder
        let newPrice = price;
        if (wUser && S.skipAll) newPrice = price;
        else if (wUser) {
          newPrice = await emit('askFinalRaise', { p, price, holder: H.id, max: hardCap(winner) });
          newPrice = Math.max(price, Math.min(newPrice || price, hardCap(winner)));
        } else {
          const wv = lot.vals[winner.id] || 0;
          if (wv > price + inc(price)) {
            const tgt = price + (wv - price) * (0.45 + 0.55 * rand());
            newPrice = Math.min(ladder(price, tgt), hardCap(winner));
          }
        }
        if (newPrice > price) {
          log(`⬆️ ${winner.t.short} make one FINAL raise: ${fmt(newPrice)}!`, 'rtm');
          await wait(1300);
          let match;
          if (hUser) match = newPrice <= hardCap(H) && await emit('askRTMMatch', { p, price: newPrice, winner: winner.id });
          else match = hv >= newPrice && newPrice <= hardCap(H);
          if (match) { winner = H; viaRTM = true; price = newPrice; log(`✅ ${H.t.short} MATCH at ${fmt(newPrice)}!`, 'rtm'); }
          else { price = newPrice; log(`🙅 ${H.t.short} decline to match. ${winner.t.short} pay ${fmt(newPrice)}.`, 'rtm'); }
        } else {
          log(`${winner.t.short} don't raise — ${H.t.short} get ${p.name} at ${fmt(price)}.`, 'rtm');
          winner = H; viaRTM = true;
        }
        if (viaRTM) { H.rtm--; if (p.unc) H.rtmU++; else H.rtmC++; }
        await wait(700);
      }
    }
    finalize(winner, p, price, viaRTM ? 'rtm' : 'bid', lot.set);
    lot.done = true;
    const rec = !S.record || price > S.record.price;
    if (rec) S.record = { price, name: p.name, team: winner.id };
    if (!isInstant() || winner.user) log(`🔨 SOLD! ${p.name} to ${winner.t.short} for ${fmt(price)}${viaRTM ? ' (RTM)' : ''}`, 'sold');
    emit('onSold', { lot, p, team: winner.id, price, rtm: viaRTM, record: rec && price >= 1000 });
    await wait(Math.max(1700 / S.speed, lot.passed ? 800 : 1500), true, true, 'result');
  }

  function finalize(T, p, price, how, set) {
    T.purse -= price;
    T.squad.push({ p, price, how });
    S.sales.push({ p, team: T.id, price, how, set });
  }

  /* ---------------- Main loop ---------------- */
  async function run() {
    S.started = true;
    let curSet = null;
    while (S.idx < S.lots.length) {
      const e = S.lots[S.idx];
      if (e.set !== curSet) {
        curSet = e.set;
        const remainingInSet = S.lots.slice(S.idx).filter(x => x.set === curSet).length;
        emit('onSet', curSet, remainingInSet);
        if (!isInstant() && !S.simAll) await wait(1200);
      }
      S.idx++;
      // skip players that cannot be bought by anyone (should not happen)
      await runLot(e);
      emit('onUpdate');
      if (isInstant()) await new Promise(r => setTimeout(r, 0));
    }
    // Accelerated round for unsold
    if (S.unsold.length) {
      S.phase = 'accel';
      const again = S.unsold.splice(0).sort((a, b) => b.ovr - a.ovr);
      const needAny = () => S.order.some(id => S.teams[id].squad.length < MAX_SQUAD);
      emit('onSet', 'Accelerated Round', again.length);
      if (!S.simAll) await wait(1500);
      S.lots.push(...again.map(p => ({ p, set: 'Accelerated Round' })));
      while (S.idx < S.lots.length && needAny()) {
        const e = S.lots[S.idx++];
        await runLot(e);
        emit('onUpdate');
        if (isInstant()) await new Promise(r => setTimeout(r, 0));
      }
    }
    // Auto-fill teams below minimum
    S.phase = 'fill';
    const pool = () => S.unsold.slice().sort((a, b) => b.ovr - a.ovr);
    for (const id of S.order) {
      const T = S.teams[id];
      while (T.squad.length < MIN_SQUAD) {
        const left = MIN_SQUAD - T.squad.length;
        const budget = T.purse - 30 * (left - 1);
        const cands = pool().filter(p => canHold(T, p));
        if (!cands.length) break;
        // best affordable player; otherwise the cheapest available at whatever the purse allows
        // best player at base price that still leaves ₹30 L for every other empty slot;
        // if the purse can't cover any base price, the cheapest player joins for whatever is left
        const fitScore = p => p.ovr + (needMult(T, p) >= 1 ? 5 : 0);
        cands.sort((x, y) => fitScore(y) - fitScore(x));
        let p = cands.find(p => p.base <= budget), price;
        if (p) price = p.base;
        else { p = cands.slice().sort((a, b) => a.base - b.base || b.ovr - a.ovr)[0]; price = Math.max(0, Math.min(p.base, Math.floor(T.purse / left))); }
        S.unsold.splice(S.unsold.indexOf(p), 1);
        finalize(T, p, price, 'fill', 'Squad top-up');
        log(`📋 ${T.t.short} complete their squad: ${p.name} for ${fmt(price)}${price < p.base ? ' (purse exhausted)' : ''}`, 'fill');
      }
    }
    S.done = true;
    emit('onDone');
  }

  /* ---------------- User actions ---------------- */
  function userCanBid() {
    const lot = S.lot; if (!lot || lot.done || lot.closed) return { ok: false, why: 'Hammer is down' };
    const U = S.teams[S.userId];
    if (lot.bidder === S.userId) return { ok: false, why: 'You are the highest bidder' };
    if (lot.passed) return { ok: false, why: 'You passed on this player' };
    if (U.squad.length >= MAX_SQUAD) return { ok: false, why: 'Squad full (25)' };
    if (lot.p.ovs && ovsCount(U) >= MAX_OVS) return { ok: false, why: 'Overseas quota full (8)' };
    const amt = nextAmount(lot);
    if (amt > hardCap(U)) return { ok: false, why: 'Not enough purse' };
    return { ok: true, amt };
  }
  function userBid(extraSteps = 0) {
    const c = userCanBid(); if (!c.ok) return false;
    let amt = c.amt;
    for (let i = 0; i < extraSteps; i++) amt += inc(amt);
    amt = Math.min(amt, hardCap(S.teams[S.userId]));
    if (amt < c.amt) return false;
    placeBid(S.lot, S.userId, amt, extraSteps > 0);
    checkDropouts(S.lot);
    wake();
    return true;
  }
  // bid straight to a chosen amount (snapped onto the legal ladder)
  function userBidTo(target) {
    const c = userCanBid(); if (!c.ok) return false;
    const amt = Math.max(c.amt, ladder(c.amt, target));
    if (amt > hardCap(S.teams[S.userId])) return false;
    placeBid(S.lot, S.userId, amt, amt > c.amt);
    checkDropouts(S.lot);
    wake();
    return true;
  }
  function passLot() {
    const lot = S.lot; if (!lot || lot.done) return;
    if (!lot.passed) { lot.passed = true; log(lot.bidder === S.userId ? '⏩ You skip ahead…' : `✋ ${S.teams[S.userId].t.short} pass on ${lot.p.name}.`, 'drop'); }
    wake();
  }
  function simLot() { if (S.lot) { S.lot.instant = true; joinUser(); wake(); } }
  function simSetNow() { if (S.lot) { S.simSet = S.lot.set; joinUser(); wake(); } }
  function simAllNow() { S.simAll = true; joinUser(); wake(); }
  function skipSetNow() { if (S.lot) { S.skipSet = S.lot.set; if (S.lot.bidder !== S.userId) S.lot.passed = true; wake(); } }
  // "Skip to matches": the rest of the auction runs instantly and the user's AI manager keeps buying
  // with whatever purse is left, so the XI is built from real buys, not end-of-auction leftovers
  function finishNow() {
    S.skipAll = true; S.simAll = true; S.autopilot = true;
    if (S.paused) setPaused(false);
    joinUser();
    wake();
  }
  function stopSim() { if (S.skipAll) return; S.simSet = null; S.skipSet = null; S.simAll = false; S.autopilot = false; }

  return {
    S, init, run, userBid, userBidTo, userCanBid, passLot, simLot, simSetNow, simAllNow, skipSetNow, finishNow, stopSim, setPaused,
    fmt, inc, ladder, hardCap, canRTM, ovsCount, valuation, canHold, wake,
    setSpeed: v => { S.speed = v; }, setHammer: v => { S.hammer = v; }, timeLeft, consts: { PURSE, MAX_SQUAD, MIN_SQUAD, MAX_OVS, RTM_CARDS },
  };
})();

if (typeof module !== 'undefined' && typeof window === 'undefined') module.exports = Auction;
