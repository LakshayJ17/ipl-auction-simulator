'use strict';
/* =====================================================================
   TRADING WINDOW — player swaps and all-cash deals, IPL style
   - A trade is a player-for-player swap (any number each way) or a one-way all-cash deal.
   - The player moves on his existing salary (his auction price). Purses adjust by the difference:
     the side that takes on more salary pays it out of its purse.
   - Players bought at an auction can't be traded in the window right after that auction, so in this
     game the window opens in the off-season, after the IPL season.
   - Each player can be traded once per window. Squads must stay 18–25 with at most 8 overseas.
   Money is in lakhs, like the rest of the game.
   ===================================================================== */
const Trade = (() => {
  const _isNode = typeof module !== 'undefined' && typeof window === 'undefined';
  const Au = _isNode ? require('./auction.js') : Auction;
  const E = _isNode ? require('./engine.js') : Engine;
  const D = _isNode ? require('./data.js') : { TEAMS };
  const TINFO = Object.fromEntries(D.TEAMS.map(t => [t.id, t]));
  const MAX_SQUAD = 25, MIN_SQUAD = 18, MAX_OVS = 8;
  const rand = Math.random;

  /* ---------------- valuation ---------------- */
  const mv = p => Au.baseValue(p); // market value, the same curve the auction AI starts from
  const salary = (team, p) => { const b = team.buys.find(x => x.p.id === p.id); return b ? b.price : p.base; };
  // how good a squad is: its best XI (+ impact) plus the cover behind it (injuries happen)
  function strength(squad) {
    const x = Au.bestXI(squad);
    const best = {};
    for (const p of squad) if (!x.used.has(p.id)) best[p.cat] = Math.max(best[p.cat] || 0, p.ovr);
    let depth = 0;
    for (const c of ['WK', 'BAT', 'AR', 'PACE', 'SPIN']) depth += Math.max(0, (best[c] || 0) - 60);
    return { score: x.score + 0.15 * depth, used: x.used };
  }
  // a team's view of a deal: what happens to its XI, its squad value and its purse
  function utility(team, give, get) {
    const before = team.squad, after = before.filter(p => !give.includes(p)).concat(get);
    const sb = strength(before), sa = strength(after);
    const w = (p, s) => mv(p) * (s.used.has(p.id) ? 1 : 0.4);
    const asset = get.reduce((t, p) => t + w(p, sa), 0) - give.reduce((t, p) => t + w(p, sb), 0);
    const cash = give.reduce((t, p) => t + salary(team, p), 0) - get.reduce((t, p) => t + p._sal, 0);
    return { u: 40 * (sa.score - sb.score) + 0.25 * asset + 0.35 * cash, dxi: sa.score - sb.score, cash };
  }
  // what a franchise needs to gain before it says yes; stars and loyal clubs are harder to prise loose
  function threshold(team, give) {
    const top = team.squad.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 3);
    let t = 5 + 0.06 * give.reduce((s, p) => s + mv(p), 0);
    for (const p of give) if (top.includes(p) || p.ovr >= 88) t += 0.2 * mv(p);
    return t * (TINFO[team.id] ? TINFO[team.id].persona.rtm : 1);
  }

  /* ---------------- the window ---------------- */
  function open(teams, userId, year) {
    const win = { year, userId, teams, byId: Object.fromEntries(teams.map(t => [t.id, t])), moved: new Set(), log: [], news: [], offers: [] };
    aiTrades(win, 2 + Math.floor(rand() * 3));
    win.offers = aiOffers(win, 3);
    return win;
  }
  const ovs = squad => squad.filter(p => p.ovs).length;
  // is the deal allowed? A gives `give` to B and gets `get` back
  function check(win, aId, bId, give, get) {
    const A = win.byId[aId], B = win.byId[bId];
    if (!A || !B || aId === bId) return 'Pick a trade partner.';
    if (!give.length && !get.length) return 'Add at least one player.';
    for (const p of give) if (!A.squad.includes(p)) return `${p.name} isn't in ${A.short}'s squad.`;
    for (const p of get) if (!B.squad.includes(p)) return `${p.name} isn't in ${B.short}'s squad.`;
    for (const p of give.concat(get)) if (win.moved.has(p.id)) return `${p.name} has already been traded in this window.`;
    const aN = A.squad.length - give.length + get.length, bN = B.squad.length - get.length + give.length;
    if (aN > MAX_SQUAD || bN > MAX_SQUAD) return `That takes ${aN > MAX_SQUAD ? A.short : B.short} past 25 players.`;
    if (aN < MIN_SQUAD || bN < MIN_SQUAD) return `That leaves ${aN < MIN_SQUAD ? A.short : B.short} below 18 players.`;
    const aO = ovs(A.squad) - ovs(give) + ovs(get), bO = ovs(B.squad) - ovs(get) + ovs(give);
    if (aO > MAX_OVS || bO > MAX_OVS) return `That gives ${aO > MAX_OVS ? A.short : B.short} more than 8 overseas players.`;
    const out = give.reduce((s, p) => s + salary(A, p), 0), inn = get.reduce((s, p) => s + salary(B, p), 0);
    if (A.purse + out - inn < 0) return `${A.short} can't afford it: ${Au.fmt(inn - out)} more salary than the purse allows.`;
    if (B.purse + inn - out < 0) return `${B.short} can't afford it: ${Au.fmt(out - inn)} more salary than their purse allows.`;
    return null;
  }
  // AI side of a deal where `aId` gives `give` and gets `get` from AI team `bId`
  function judge(win, aId, bId, give, get) {
    const A = win.byId[aId], B = win.byId[bId];
    give.forEach(p => { p._sal = salary(A, p); });
    const v = utility(B, get, give), need = threshold(B, get);
    give.forEach(p => { delete p._sal; });
    return { u: v.u, need, ok: v.u >= need, dxi: v.dxi };
  }
  function propose(win, aId, bId, give, get) {
    const why = check(win, aId, bId, give, get);
    if (why) return { legal: false, accepted: false, why };
    const B = win.byId[bId], j = judge(win, aId, bId, give, get);
    const top = B.squad.slice().sort((a, b) => b.ovr - a.ovr).slice(0, 3);
    let why2;
    if (j.ok) why2 = `${B.short} accept!`;
    else if (get.some(p => top.includes(p)) && j.u < j.need * 0.6) why2 = `${get.find(p => top.includes(p)).name} is a core player for ${B.short}. They'd need a lot more.`;
    else if (j.dxi < -2) why2 = `${B.short} say it weakens their XI too much.`;
    else if (j.u > j.need * 0.6) why2 = `Close. ${B.short} want a little more.`;
    else why2 = `${B.short} aren't interested at that price.`;
    return { legal: true, accepted: j.ok, why: why2, interest: Math.max(0, Math.min(1, j.u / j.need)) };
  }
  function execute(win, aId, bId, give, get, quiet) {
    const A = win.byId[aId], B = win.byId[bId];
    const move = (from, to, p) => {
      const b = from.buys.find(x => x.p.id === p.id), price = b ? b.price : p.base;
      from.squad = from.squad.filter(x => x !== p); from.buys = from.buys.filter(x => x.p.id !== p.id);
      to.squad = to.squad.concat([p]); to.buys = to.buys.concat([{ p, price, how: 'trade', from: from.id }]);
      from.purse += price; to.purse -= price;
      win.moved.add(p.id);
    };
    give.forEach(p => move(A, B, p)); get.forEach(p => move(B, A, p));
    for (const T of [A, B]) fixSel(T, T.id !== win.userId);
    const entry = { a: aId, b: bId, give: give.slice(), get: get.slice(), cash: get.reduce((s, p) => s + salary(A, p), 0) - give.reduce((s, p) => s + salary(B, p), 0) };
    win.log.push(entry);
    if (!quiet) win.offers = win.offers.filter(o => o.give.concat(o.get).every(p => !win.moved.has(p.id)));
    return entry;
  }
  // keep a selection valid after players leave (AI teams simply re-pick)
  function fixSel(T, ai) {
    const has = p => T.squad.includes(p);
    const s = T.sel;
    if (ai || !s || !s.xi.every(has) || (s.impact && !has(s.impact))) { T.sel = E.autoSelect(T.squad); return; }
    if (s.batOrder) s.batOrder = s.batOrder.filter(id => T.squad.some(p => p.id === id));
    if (s.bowlPlan) s.bowlPlan = s.bowlPlan.map(id => T.squad.some(p => p.id === id) ? id : null);
  }

  // mid-season loans: will an AI club lend this player out for the rest of the season?
  // Only if he isn't in their plans and they keep enough cover without him.
  function lendJudge(teamId, squad, p, form) {
    // the XI their coach would pick today (form counts, as in the season)
    const bonus = {}; if (form) for (const x of squad) bonus[x.id] = (form[x.id] || 0) * 0.9;
    const sel = E.autoSelect(squad, bonus);
    if (sel.xi.includes(p) || sel.impact === p) return { ok: false, why: `${p.name} is in their XI plans, so they want him for the run-in.` };
    const loss = strength(squad).score - strength(squad.filter(x => x !== p)).score;
    const mood = TINFO[teamId] ? TINFO[teamId].persona.rtm : 1;
    if (loss > 1.2 / mood) return { ok: false, why: `They need ${p.name} as cover for their ${p.cat === 'PACE' ? 'pace attack' : p.cat === 'SPIN' ? 'spinners' : p.cat === 'WK' ? 'keeper' : p.cat === 'AR' ? 'all-rounders' : 'batting'}.` };
    return { ok: true, why: `${TINFO[teamId] ? TINFO[teamId].short : teamId} agree to the loan.` };
  }

  /* ---------------- deal finding ---------------- */
  const free = (win, T) => T.squad.filter(p => !win.moved.has(p.id));
  // the user wants `want` from team bId: what would they take for it?
  function suggest(win, bId, want) {
    const U = win.byId[win.userId], B = win.byId[bId];
    const tries = [[]];
    const mine = free(win, U).filter(p => !want.includes(p));
    mine.forEach(p => tries.push([p]));
    // pairs from the 14 players they'd most like
    const liked = mine.map(p => ({ p, v: judge(win, win.userId, bId, [p], []).u })).sort((a, b) => b.v - a.v).slice(0, 14).map(x => x.p);
    for (let i = 0; i < liked.length; i++) for (let j = i + 1; j < liked.length; j++) tries.push([liked[i], liked[j]]);
    let best = null;
    for (const give of tries) {
      if (check(win, win.userId, bId, give, want)) continue;
      if (!judge(win, win.userId, bId, give, want).ok) continue;
      want.forEach(p => { p._sal = salary(B, p); });
      const v = utility(U, give, want).u;
      want.forEach(p => { delete p._sal; });
      if (!best || v > best.v) best = { give, get: want, v };
    }
    return best;
  }
  // offers the AI teams bring to the user: swaps that help them and look fair to you, or cash bids for your spare players
  function aiOffers(win, n) {
    const U = win.byId[win.userId], out = [];
    const teams = shuffle(win.teams.filter(t => t.id !== win.userId));
    for (const T of teams) {
      if (out.length >= n) break;
      let best = null;
      const theirs = free(win, T), mine = free(win, U);
      for (const tp of theirs) for (const up of mine) {
        if (check(win, win.userId, T.id, [up], [tp])) continue;
        const j = judge(win, win.userId, T.id, [up], [tp]);
        if (!j.ok) continue;
        tp._sal = salary(T, tp); const me = utility(U, [up], [tp]); delete tp._sal;
        if (me.dxi < 0.3 || me.u < 5) continue; // it has to look tempting to you too
        const sc = Math.min(j.u - j.need, me.u) + rand() * 10;
        if (!best || sc > best.sc) best = { sc, give: [up], get: [tp] };
      }
      // or a cash bid for one of your bench players
      if (!best && T.purse > 100) for (const up of mine) {
        if (check(win, win.userId, T.id, [up], [])) continue;
        const j = judge(win, win.userId, T.id, [up], []);
        if (!j.ok) continue;
        const me = utility(U, [up], []);
        if (me.dxi < -0.5 || me.u < 0) continue;
        const sc = j.u - j.need + rand() * 10;
        if (!best || sc > best.sc) best = { sc, give: [up], get: [] };
      }
      if (best) out.push({ from: T.id, give: best.give, get: best.get });
    }
    return out;
  }
  // trades between the AI franchises, for the news ticker
  function aiTrades(win, n) {
    const ai = win.teams.filter(t => t.id !== win.userId);
    for (let k = 0; k < 14 && win.log.length < n; k++) {
      const [A, B] = shuffle(ai.slice()).slice(0, 2);
      let best = null;
      for (const ap of shuffle(free(win, A)).slice(0, 14)) for (const bp of shuffle(free(win, B)).slice(0, 14)) {
        if (Math.abs(ap.ovr - bp.ovr) > 5 || Math.min(ap.ovr, bp.ovr) < 68 || check(win, A.id, B.id, [ap], [bp])) continue;
        const jb = judge(win, A.id, B.id, [ap], [bp]); if (!jb.ok) continue;
        const ja = judge(win, B.id, A.id, [bp], [ap]); if (!ja.ok) continue;
        const sc = Math.min(ja.u - ja.need, jb.u - jb.need) + (ap.ovr + bp.ovr) * 0.5;
        if (!best || sc > best.sc) best = { sc, ap, bp };
      }
      if (best) {
        const e = execute(win, A.id, B.id, [best.ap], [best.bp], true);
        win.news.push(e);
      }
    }
  }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  return { open, check, propose, execute, suggest, aiOffers, lendJudge, salary, strength, mv, fixSel, consts: { MAX_SQUAD, MIN_SQUAD, MAX_OVS } };
})();

if (typeof module !== 'undefined' && typeof window === 'undefined') module.exports = Trade;
