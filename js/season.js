'use strict';
/* =====================================================================
   SEASON — 70-match league (2 groups format) + playoffs + stats
   ===================================================================== */
const Season = (() => {
  const _isNode = typeof module !== 'undefined' && typeof window === 'undefined';
  const E = _isNode ? require('./engine.js') : Engine;
  const D = _isNode ? require('./data.js') : { TEAMS };
  const TINFO = Object.fromEntries(D.TEAMS.map(t => [t.id, t]));
  const rand = Math.random;
  const FINAL_VENUE = { venue: 'Narendra Modi Stadium, Ahmedabad', pitch: { run: 1.02, spin: 0 } };

  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function schedule(ids) {
    const t = shuffle(ids.slice());
    const A = t.slice(0, 5), B = t.slice(5, 10);
    const m = [];
    for (const G of [A, B]) for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) { m.push([G[i], G[j]]); m.push([G[j], G[i]]); }
    for (let i = 0; i < 5; i++) {
      m.push([A[i], B[i]]); m.push([B[i], A[i]]);
      for (let j = 0; j < 5; j++) if (j !== i) {
        // each cross pair (A[i],B[j]) once; alternate home
        m.push((i + j) % 2 ? [A[i], B[j]] : [B[j], A[i]]);
      }
    }
    // balance so teams play at a similar rate
    const pool = shuffle(m), out = [], played = Object.fromEntries(ids.map(x => [x, 0])), last = {};
    while (pool.length) {
      let bi = 0, bs = 1e9;
      for (let k = 0; k < pool.length; k++) {
        const [h, a] = pool[k];
        let s = played[h] + played[a];
        if (last[h] === out.length - 1 || last[a] === out.length - 1) s += 3;
        s += rand() * 0.5;
        if (s < bs) { bs = s; bi = k; }
      }
      const [h, a] = pool.splice(bi, 1)[0];
      played[h]++; played[a]++; last[h] = last[a] = out.length;
      out.push({ home: h, away: a });
    }
    return { fixtures: out, groups: [A, B] };
  }

  function create(teams, userId) { // teams: [{id, short, name, squad:[p], sel}]
    const S = { teams: {}, ids: [], fixtures: [], idx: 0, table: {}, stats: new Map(), playoffs: [], phase: 'league', champion: null, runnerUp: null, results: [], highlights: { hi: null, lo: null, bestBowl: null, bigWin: null },
      userId, form: {}, inj: {}, news: [] };
    for (const t of teams) {
      const side = { id: t.id, short: t.short, name: t.name, sel: t.sel, squad: t.squad, user: t.id === userId };
      side.prepared = E.prepare(side);
      S.teams[t.id] = side; S.ids.push(t.id);
      S.table[t.id] = { id: t.id, p: 0, w: 0, l: 0, nr: 0, pts: 0, rf: 0, bf: 0, ra: 0, ba: 0, form: [] };
      for (const p of t.squad) S.stats.set(p.id, { p, team: t.id, m: 0, inns: 0, r: 0, b: 0, f4: 0, f6: 0, no: 0, hs: 0, hsNo: false, f50: 0, f100: 0, wk: 0, bb: 0, rc: 0, best: null, motm: 0, dots: 0 });
    }
    const sch = schedule(S.ids);
    S.groups = sch.groups;
    S.fixtures = sch.fixtures.map((f, i) => ({ no: i + 1, ...f, stage: 'League', result: null }));
    return S;
  }

  /* -------- team news: form, injuries, today's XI -------- */
  const injured = (S, p) => (S.inj[p.id] || 0) > 0;
  // the user's XI stays as picked; an injured player is swapped for the best fit from the bench, for this match only
  function patchSel(sel, avail) {
    const ok = new Set(avail.map(p => p.id));
    const used = new Set([...sel.xi, sel.impact].filter(Boolean).filter(p => ok.has(p.id)).map(p => p.id));
    const bench = () => avail.filter(p => !used.has(p.id));
    const fit = (gone, ovsRoom) => bench().filter(p => (!p.ovs || ovsRoom)).sort((a, b) =>
      ((E.slotOf(b) === E.slotOf(gone) ? 8 : 0) + b.ovr) - ((E.slotOf(a) === E.slotOf(gone) ? 8 : 0) + a.ovr))[0];
    const xi = sel.xi.slice(); let replaced = sel.replaced, impact = sel.impact;
    for (let i = 0; i < xi.length; i++) {
      if (ok.has(xi[i].id)) continue;
      const room = xi.filter(p => p.ovs && p !== xi[i]).length < 4;
      const sub = fit(xi[i], room); if (!sub) return null;
      if (replaced === xi[i]) replaced = sub;
      used.add(sub.id); xi[i] = sub;
    }
    if (impact && !ok.has(impact.id)) {
      const ovsAfter = xi.filter(p => p.ovs).length - (replaced && replaced.ovs ? 1 : 0);
      impact = fit(impact, ovsAfter < 4) || null; if (impact) used.add(impact.id); else replaced = null;
    }
    const captain = xi.includes(sel.captain) ? sel.captain : E.pickCaptain(xi);
    const out = { xi, impact, replaced, captain };
    return E.validateSelection(out).errs.length ? null : out;
  }
  function todaysSide(S, id) {
    const side = S.teams[id];
    const avail = side.squad.filter(p => !injured(S, p));
    let sel = side.sel;
    if (!side.user) {
      // AI coaches back their in-form players and leave out the struggling ones
      const bonus = {}; for (const p of avail) bonus[p.id] = (S.form[p.id] || 0) * 0.9;
      sel = E.autoSelect(avail, bonus);
    } else if ([...sel.xi, sel.impact].filter(Boolean).some(p => injured(S, p))) {
      sel = patchSel(sel, avail) || E.autoSelect(avail);
    }
    if (sel === side.sel) return side;
    return { ...side, sel, prepared: E.prepare({ ...side, sel }) };
  }
  // after a match: form moves with performance; knocks happen (pacers most often)
  function afterMatch(S, res, quiet) {
    for (const id of [res.home, res.away]) {
      const played = new Set(res.squads[id].map(p => p.id));
      for (const p of S.teams[id].squad) {
        if (S.inj[p.id] > 0) { S.inj[p.id]--; continue; }
        if (!played.has(p.id)) { S.form[p.id] = (S.form[p.id] || 0) * 0.9; continue; }
        const z = clamp((E.impactScore(res, p.id) - 22) / 28, -1.6, 2);
        S.form[p.id] = clamp((S.form[p.id] || 0) * 0.72 + z * 1.1, -4, 4.5);
      }
      if (rand() < 0.065) {
        const pool = res.squads[id], w = pool.map(p => (p.role === 'BOWL' && !p.spin ? 1.7 : 1));
        let r = rand() * w.reduce((a, b) => a + b, 0), p = pool[0];
        for (let k = 0; k < pool.length; k++) if ((r -= w[k]) < 0) { p = pool[k]; break; }
        const n = 1 + Math.floor(rand() * rand() * 5); // mostly a game or two, sometimes longer
        S.inj[p.id] = n;
        if (!quiet && S.teams[id].user) S.news.push({ after: res.no, txt: `🚑 ${p.name} picked up a ${pick(['hamstring strain', 'side strain', 'finger injury', 'ankle niggle', 'back spasm', 'groin strain'])}: out for ${n} match${n > 1 ? 'es' : ''}` });
      }
    }
  }
  function teamNews(S, id) {
    const side = S.teams[id];
    const inj = side.squad.filter(p => injured(S, p)).map(p => ({ p, n: S.inj[p.id] }));
    const hot = side.squad.filter(p => !injured(S, p) && (S.form[p.id] || 0) >= 2).sort((a, b) => S.form[b.id] - S.form[a.id]).slice(0, 3);
    const cold = [...side.sel.xi, side.sel.impact].filter(Boolean).filter(p => (S.form[p.id] || 0) <= -2);
    return { inj, hot, cold };
  }
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const pick = a => a[Math.floor(rand() * a.length)];

  function nrr(r) { return (r.bf ? r.rf / (r.bf / 6) : 0) - (r.ba ? r.ra / (r.ba / 6) : 0); }
  function standings(S) {
    return Object.values(S.table).sort((a, b) => b.pts - a.pts || nrr(b) - nrr(a) || b.w - a.w);
  }

  function updateStats(S, res) {
    const seen = new Set();
    for (const inn of res.inn) {
      for (const c of inn.bat) {
        const st = S.stats.get(c.p.id); if (!st) continue;
        seen.add(c.p.id);
        if (!c.batted) continue;
        st.inns++; st.r += c.r; st.b += c.b; st.f4 += c.f4; st.f6 += c.f6;
        if (!c.out) st.no++;
        if (c.r > st.hs || (c.r === st.hs && !c.out)) { st.hs = c.r; st.hsNo = !c.out; }
        if (c.r >= 100) st.f100++; else if (c.r >= 50) st.f50++;
      }
      for (const b of inn.bowl) {
        const st = S.stats.get(b.p.id); if (!st) continue;
        seen.add(b.p.id);
        st.wk += b.w; st.bb += b.balls; st.rc += b.r; st.dots += b.dots;
        if (!st.best || b.w > st.best.w || (b.w === st.best.w && b.r < st.best.r)) st.best = { w: b.w, r: b.r };
        const hb = S.highlights.bestBowl;
        if (!hb || b.w > hb.w || (b.w === hb.w && b.r < hb.r)) S.highlights.bestBowl = { w: b.w, r: b.r, p: b.p, team: S.stats.get(b.p.id).team, vs: inn.team };
      }
    }
    // everyone in the selection played
    for (const id of [res.home, res.away]) {
      for (const p of res.squads[id]) { const st = S.stats.get(p.id); if (st) st.m++; }
    }
    if (res.motm) { const st = S.stats.get(res.motm.id); if (st) st.motm++; }
    for (const inn of res.inn) {
      if (!S.highlights.hi || inn.runs > S.highlights.hi.runs) S.highlights.hi = { runs: inn.runs, wk: inn.wk, team: inn.team, vs: inn.team === res.home ? res.away : res.home };
      if (inn.allOut && (!S.highlights.lo || inn.runs < S.highlights.lo.runs)) S.highlights.lo = { runs: inn.runs, wk: inn.wk, team: inn.team, vs: inn.team === res.home ? res.away : res.home };
    }
  }

  function updateTable(S, res) {
    const [i1, i2] = res.inn;
    for (const [inn, opp] of [[i1, i2], [i2, i1]]) {
      const r = S.table[inn.team];
      r.p++;
      r.rf += inn.runs; r.bf += inn.allOut ? 120 : inn.balls;
      r.ra += opp.runs; r.ba += opp.allOut ? 120 : opp.balls;
    }
    const W = S.table[res.winner], L = S.table[res.loser];
    W.w++; W.pts += 2; L.l++;
    W.form.push('W'); L.form.push('L');
  }

  function play(S, fx, detailed, light) {
    const H = todaysSide(S, fx.home), A = todaysSide(S, fx.away);
    const v = fx.stage === 'League' || fx.stage === 'Qualifier 1' || fx.stage === 'Eliminator' ? TINFO[fx.home] : FINAL_VENUE;
    const res = E.playMatch(H, A, { pitch: v.pitch, detailed, neutral: fx.stage !== 'League', formBase: S.form });
    res.venue = v.venue; res.no = fx.no; res.stage = fx.stage;
    fx.result = res;
    if (fx.stage === 'League') updateTable(S, res);
    afterMatch(S, res, light);
    if (light) return res;
    updateStats(S, res);
    const margin = res.inn[0].runs - res.inn[1].runs;
    if (res.winner === res.inn[0].team && (!S.highlights.bigWin || margin > S.highlights.bigWin.m)) S.highlights.bigWin = { m: margin, team: res.winner, vs: res.loser };
    S.results.push(res);
    return res;
  }

  function nextFixture(S) {
    if (S.phase === 'league') return S.fixtures[S.idx] || null;
    if (S.phase === 'playoffs') return S.playoffs.find(f => !f.result) || null;
    return null;
  }

  function playNext(S, detailed) {
    const fx = nextFixture(S); if (!fx) return null;
    const res = play(S, fx, detailed);
    if (S.phase === 'league') { S.idx++; if (S.idx >= S.fixtures.length) startPlayoffs(S); }
    else advancePlayoffs(S);
    return { fx, res };
  }

  function startPlayoffs(S) {
    S.phase = 'playoffs';
    const st = standings(S).map(r => r.id);
    S.final4 = st.slice(0, 4);
    S.playoffs = [
      { no: 71, stage: 'Qualifier 1', home: st[0], away: st[1], result: null },
      { no: 72, stage: 'Eliminator', home: st[2], away: st[3], result: null },
    ];
  }
  function advancePlayoffs(S) {
    const [q1, el, q2, fin] = S.playoffs;
    if (q1.result && el.result && !q2) {
      S.playoffs.push({ no: 73, stage: 'Qualifier 2', home: q1.result.loser, away: el.result.winner, result: null });
    } else if (q2 && q2.result && !fin) {
      S.playoffs.push({ no: 74, stage: 'Final', home: q1.result.winner, away: q2.result.winner, result: null });
    } else if (fin && fin.result) {
      S.phase = 'done'; S.champion = fin.result.winner; S.runnerUp = fin.result.loser;
    }
  }

  function finishFor(S, id) {
    const pos = standings(S).findIndex(r => r.id === id) + 1;
    const [q1, el, q2, fin] = S.playoffs;
    let label = `Finished ${ordinal(pos)} in the league`, rank = pos, emoji = '😐';
    if (S.phase === 'done') {
      if (S.champion === id) { label = 'IPL 2027 CHAMPIONS!'; rank = 1; emoji = '🏆'; }
      else if (S.runnerUp === id) { label = 'Runners-up — lost the Final'; rank = 2; emoji = '🥈'; }
      else if (q2 && q2.result && q2.result.loser === id) { label = 'Knocked out in Qualifier 2'; rank = 3; emoji = '😢'; }
      else if (el && el.result && el.result.loser === id) { label = 'Knocked out in the Eliminator'; rank = 4; emoji = '💔'; }
      else { emoji = pos <= 6 ? '😐' : pos <= 8 ? '😬' : '🥄'; if (pos === 10) label += ' — Wooden spoon'; }
    }
    return { pos, rank, label, emoji };
  }
  const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th');

  function leaders(S, kind, n = 10) {
    const arr = Array.from(S.stats.values());
    if (kind === 'runs') return arr.filter(s => s.r > 0).sort((a, b) => b.r - a.r || (b.r / Math.max(1, b.b)) - (a.r / Math.max(1, a.b))).slice(0, n);
    if (kind === 'wkts') return arr.filter(s => s.wk > 0).sort((a, b) => b.wk - a.wk || (a.rc / Math.max(1, a.bb)) - (b.rc / Math.max(1, b.bb))).slice(0, n);
    if (kind === 'sixes') return arr.filter(s => s.f6 > 0).sort((a, b) => b.f6 - a.f6).slice(0, n);
    if (kind === 'sr') return arr.filter(s => s.b >= 120).sort((a, b) => b.r / b.b - a.r / a.b).slice(0, n);
    if (kind === 'econ') return arr.filter(s => s.bb >= 120).sort((a, b) => a.rc / a.bb - b.rc / b.bb).slice(0, n);
    if (kind === 'mvp') return arr.map(s => ({ ...s, mvp: mvpPts(s) })).sort((a, b) => b.mvp - a.mvp).slice(0, n);
    return [];
  }
  function mvpPts(s) { return Math.round(s.r * 1 + s.f4 * 1 + s.f6 * 2 + s.wk * 25 + s.dots * 1 + s.motm * 10); }

  /* -------- Monte-Carlo forecast (league + playoffs) -------- */
  function forecast(teams, n = 200, userId) {
    const out = Object.fromEntries(teams.map(t => [t.id, { id: t.id, pos: 0, top4: 0, title: 0, pts: 0 }]));
    for (let k = 0; k < n; k++) {
      const S = create(teams, userId);
      while (S.phase !== 'done') {
        const fx = nextFixture(S);
        play(S, fx, false, true);
        if (fx.stage === 'League') { S.idx++; if (S.idx >= S.fixtures.length) startPlayoffs(S); }
        else advancePlayoffs(S);
      }
      standings(S).forEach((r, i) => { out[r.id].pos += i + 1; out[r.id].pts += r.pts; if (i < 4) out[r.id].top4++; });
      out[S.champion].title++;
    }
    return Object.values(out).map(o => ({ id: o.id, avgPos: o.pos / n, avgPts: o.pts / n, top4: o.top4 / n, title: o.title / n })).sort((a, b) => a.avgPos - b.avgPos);
  }

  return { create, playNext, nextFixture, standings, nrr, leaders, mvpPts, finishFor, forecast, ordinal, teamNews, TINFO, FINAL_VENUE };
})();

if (typeof module !== 'undefined' && typeof window === 'undefined') module.exports = Season;
