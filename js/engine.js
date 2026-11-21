'use strict';
/* =====================================================================
   BALL-BY-BALL T20 MATCH ENGINE
   ===================================================================== */
const Engine = (() => {
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const rand = Math.random;
  const pick = a => a[Math.floor(rand() * a.length)];
  function gauss() { let u = 0, v = 0; while (!u) u = rand(); while (!v) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  const has = (p, t) => p.tags.includes(t);
  const POS = { O: 0, T: 1, M: 2, F: 3, L: 4 };
  // phase multipliers: wickets / fours / sixes (tuned against IPL 2024-25 phase run rates)
  const PH = {
    pp: { w: 0.85, f: 1.32, s: 0.95 },
    mid: { w: 0.85, f: 0.86, s: 0.97 },
    death: { w: 1.2, f: 1.32, s: 1.9 },
  };

  /* ---------------- Team selection ---------------- */
  const slotOf = p => {
    if (p.role === 'WK') return 'WK';
    if (p.role === 'BAT') return 'BAT';
    if (p.role === 'AR') return 'AR';
    return p.spin ? 'SPIN' : 'PACE';
  };
  const isBowlOption = p => p.bt && p.bowl >= 60;

  // Picks best XI + impact player for a squad (array of players)
  function autoSelect(squad0, bonus) {
    const slots = { WK: 1, BAT: 4, AR: 2, PACE: 3, SPIN: 2 }; // 12 = XI + impact
    const cands = [];
    const squad = squad0;
    for (const p of squad) {
      if (p.role === 'WK') { cands.push({ p, s: 'WK', v: p.batR + 4 }); cands.push({ p, s: 'BAT', v: p.batR }); }
      if (p.role === 'BAT') cands.push({ p, s: 'BAT', v: p.batR });
      if (p.role === 'AR') { cands.push({ p, s: 'AR', v: p.ovr }); if (p.batR >= 70) cands.push({ p, s: 'BAT', v: p.batR - 2 }); if (p.bowl >= 60) cands.push({ p, s: p.spin ? 'SPIN' : 'PACE', v: p.bowlR - 2 }); }
      if (p.role === 'BOWL') cands.push({ p, s: p.spin ? 'SPIN' : 'PACE', v: p.bowlR });
    }
    if (bonus) for (const c of cands) c.v += bonus[c.p.id] || 0;
    cands.sort((a, b) => b.v - a.v);
    const used = new Set(); let ovs = 0; const chosen = [];
    for (const c of cands) {
      if (chosen.length >= 12) break;
      if (used.has(c.p.id) || slots[c.s] <= 0) continue;
      if (c.p.ovs && ovs >= 4) continue;
      used.add(c.p.id); slots[c.s]--; chosen.push(c.p); if (c.p.ovs) ovs++;
    }
    // fill if short
    const rest = squad.filter(p => !used.has(p.id)).sort((a, b) => b.ovr - a.ovr);
    for (const p of rest) { if (chosen.length >= 12) break; if (p.ovs && ovs >= 4) continue; chosen.push(p); used.add(p.id); if (p.ovs) ovs++; }
    // ensure 5+ bowling options
    let bowlOpts = chosen.filter(isBowlOption).length;
    while (bowlOpts < 6) {
      const bench = squad.filter(p => !used.has(p.id) && isBowlOption(p) && (!p.ovs || ovs < 4)).sort((a, b) => b.bowlR - a.bowlR)[0];
      if (!bench) break;
      const drop = chosen.filter(p => !isBowlOption(p) && p.role !== 'WK').sort((a, b) => a.batR - b.batR)[0]
        || chosen.filter(p => !isBowlOption(p)).sort((a, b) => a.batR - b.batR).filter((p, i, arr) => arr.filter(x => x.role === 'WK').length > 1 || p.role !== 'WK')[0];
      if (!drop) break;
      chosen.splice(chosen.indexOf(drop), 1); used.delete(drop.id); if (drop.ovs) ovs--;
      chosen.push(bench); used.add(bench.id); if (bench.ovs) ovs++;
      bowlOpts++;
    }
    // Impact: the weakest-batting specialist bowler is the impact sub; his partner is the batter who bowls least.
    // (Which of them starts depends on the toss: see impactPlan.)
    let impact = null, replaced = null, xi = chosen.slice();
    if (chosen.length === 12) {
      const bowlers = chosen.filter(p => p.role === 'BOWL').sort((a, b) => a.bat - b.bat);
      impact = bowlers[0] || chosen.slice().sort((a, b) => a.batR - b.batR)[0];
      xi = chosen.filter(p => p !== impact);
      replaced = autoPartner(xi, impact);
    }
    const captain = pickCaptain(xi);
    return { xi, impact, replaced, captain };
  }

  /* ---------------- Impact Player (toss-aware) ----------------
     The 12 = XI + impact sub. One of the pair (sub, partner) is the "flex batter", the other the "flex bowler".
     Bat first:  the flex batter starts and bats; at the innings break the flex bowler comes on for the
                 player who matters least with the ball.
     Bowl first: the flex bowler starts and bowls; for the chase the flex batter comes in for the weakest
                 batter, who has already bowled his overs. */
  const bowlUse = p => isBowlOption(p) ? p.bowlR : p.bt ? p.bowl * 0.5 : 0;
  const isBowlSub = p => !!p && p.bowlR > p.batR;
  const soleWK = (set, p) => p.role === 'WK' && set.filter(x => x.role === 'WK').length === 1;
  function autoPartner(xi, impact) {
    if (!impact) return null;
    const ok = p => !(soleWK(xi, p) && impact.role !== 'WK');
    if (isBowlSub(impact)) return xi.filter(p => !isBowlOption(p) && ok(p)).sort((a, b) => a.batR - b.batR)[0]
      || xi.filter(ok).sort((a, b) => bowlUse(a) - bowlUse(b))[0] || null;
    return xi.filter(p => p.role === 'BOWL' && ok(p)).sort((a, b) => a.bat - b.bat)[0]
      || xi.filter(ok).sort((a, b) => a.bat - b.bat)[0] || null;
  }
  // an overseas sub may only come on if the starting XI has fewer than 4 overseas (IPL rule)
  const ovsOK = (start, sub) => !sub.ovs || start.filter(p => p.ovs).length < 4;
  function impactPlan(sel) {
    const xi = sel.xi, none = { start: xi, bat: xi, bowl: xi, sub: null };
    const partner = sel.impact ? (sel.replaced && xi.includes(sel.replaced) ? sel.replaced : autoPartner(xi, sel.impact)) : null;
    if (!sel.impact || !partner) return { bf: none, bs: none, flexBat: null, flexBowl: null, partner: null };
    const bowlSub = isBowlSub(sel.impact);
    const flexBowl = bowlSub ? sel.impact : partner, flexBat = bowlSub ? partner : sel.impact;
    const twelve = xi.concat([sel.impact]), cap = sel.captain;
    // batting first
    const sBF = twelve.filter(p => p !== flexBowl);
    const outBF = sBF.filter(p => p !== cap && !soleWK(sBF, p)).sort((a, b) => bowlUse(a) - bowlUse(b) || a.ovr - b.ovr)[0];
    const bf = outBF && bowlUse(flexBowl) > bowlUse(outBF) && ovsOK(sBF, flexBowl)
      ? { start: sBF, bat: sBF, bowl: sBF.filter(p => p !== outBF).concat([flexBowl]), sub: { in: flexBowl, out: outBF } }
      : { start: sBF, bat: sBF, bowl: sBF, sub: null };
    // bowling first
    const sBS = twelve.filter(p => p !== flexBat);
    const outBS = sBS.filter(p => p !== cap).sort((a, b) => a.bat - b.bat || a.batR - b.batR)[0];
    const bs = outBS && flexBat.bat > outBS.bat && ovsOK(sBS, flexBat)
      ? { start: sBS, bowl: sBS, bat: sBS.filter(p => p !== outBS).concat([flexBat]), sub: { in: flexBat, out: outBS } }
      : { start: sBS, bat: sBS, bowl: sBS, sub: null };
    return { bf, bs, flexBat, flexBowl, partner };
  }

  function pickCaptain(xi) {
    const caps = xi.filter(p => has(p, 'CAP')).sort((a, b) => b.ovr - a.ovr);
    return caps[0] || xi.slice().sort((a, b) => b.ovr - a.ovr)[0];
  }

  // problems with a user's over-by-over bowling plan (null = auto for that over)
  function planIssues(plan, players) {
    const out = [];
    if (!plan) return out;
    const name = id => (players.find(p => p.id === id) || { name: '?' }).name;
    const n = new Map();
    plan.forEach((id, i) => {
      if (id == null) return;
      n.set(id, (n.get(id) || 0) + 1);
      if (i > 0 && plan[i - 1] === id) out.push(`${name(id)} can't bowl overs ${i} and ${i + 1} back-to-back.`);
    });
    for (const [id, c] of n) if (c > 4) out.push(`${name(id)} is planned for ${c} overs (max 4).`);
    return out;
  }

  function validateSelection(sel) {
    const errs = [];
    const { xi, impact } = sel;
    if (xi.length !== 11) errs.push(`Playing XI must have 11 players (currently ${xi.length}).`);
    const ovsXI = xi.filter(p => p.ovs).length;
    if (ovsXI > 4) errs.push(`Max 4 overseas in the XI (currently ${ovsXI}).`);
    if (!xi.some(p => p.role === 'WK')) errs.push('You need a wicketkeeper in the XI.');
    const warn = [];
    if (impact && xi.length === 11) {
      if (xi.includes(impact)) errs.push('The Impact Player must come from the bench.');
      if (impact.ovs && ovsXI >= 4) errs.push('With 4 overseas in the XI, the Impact Player must be Indian.');
      const plan = impactPlan(sel);
      if (plan.partner) {
        if (!plan.bs.start.some(p => p.role === 'WK')) errs.push(`${plan.flexBat.name} is your only keeper, so he can't sit out when you bowl first.`);
        if (!plan.bf.start.some(p => p.role === 'WK')) errs.push(`${plan.flexBowl.name} is your only keeper, so he can't sit out when you bat first.`);
        if (plan.bf.start.filter(p => p.ovs).length > 4 || plan.bs.start.filter(p => p.ovs).length > 4) errs.push('That impact pair would put 5 overseas in a starting XI.');
      }
    }
    errs.push(...planIssues(sel.bowlPlan, xi.concat(impact ? [impact] : [])));
    if (xi.length === 11) {
      const plan = impactPlan(sel);
      const bs = Math.min(plan.bf.bowl.filter(isBowlOption).length, plan.bs.bowl.filter(isBowlOption).length);
      if (bs < 5) warn.push(`Only ${bs} genuine bowling options. Part-timers will get smashed!`);
    }
    return { errs, warn };
  }

  function impactType(sel) {
    if (!sel.impact) return null;
    return isBowlSub(sel.impact) ? 'bowl' : 'bat';
  }

  // auto batting order, or the user's order (ids) with anyone not in it slotted in at his natural place
  function battingOrder(set, order) {
    const auto = autoOrder(set);
    if (!order || !order.length) return auto;
    const idx = new Map(order.map((id, i) => [id, i]));
    const out = set.filter(p => idx.has(p.id)).sort((a, b) => idx.get(a.id) - idx.get(b.id));
    auto.forEach((p, i) => { if (!idx.has(p.id)) out.splice(Math.min(i, out.length), 0, p); });
    return out;
  }
  function autoOrder(set) {
    const arr = set.slice();
    const openers = arr.filter(p => p.pos === 'O').sort((a, b) => b.bat - a.bat);
    const rank = new Map();
    arr.forEach(p => rank.set(p.id, POS[p.pos]));
    openers.slice(2).forEach(p => rank.set(p.id, 1));
    if (openers.length < 2) {
      const promote = arr.filter(p => p.pos !== 'O' && p.pos !== 'L').sort((a, b) => b.bat - a.bat).slice(0, 2 - openers.length);
      promote.forEach(p => rank.set(p.id, 0));
    }
    arr.sort((a, b) => (rank.get(a.id) - rank.get(b.id)) || (b.bat - a.bat));
    return arr;
  }

  function bowlingPool(set) {
    let pool = set.filter(p => p.bt && p.bowl >= 40).sort((a, b) => b.bowlR - a.bowlR).slice(0, 7);
    if (pool.length < 5) {
      const extra = set.filter(p => !pool.includes(p)).sort((a, b) => b.bowl - a.bowl).slice(0, 5 - pool.length);
      pool = pool.concat(extra);
    }
    return pool;
  }

  // team: {id, short, name, sel:{xi, impact, replaced, captain, batOrder?, bowlPlan?}}
  // Returns one prepared side for batting first (bf) and one for bowling first (bs).
  function prepare(team) {
    const sel = team.sel, plan = impactPlan(sel);
    const capBonus = sel.captain && has(sel.captain, 'CAP') ? 1.2 : 0.4;
    const one = sc => ({
      id: team.id, short: team.short, name: team.name,
      lineup: battingOrder(sc.bat, sel.batOrder), bowlers: bowlingPool(sc.bowl), field: sc.bowl,
      all: Array.from(new Set(sc.start.concat(sc.sub ? [sc.sub.in] : []))),
      start: sc.start, sub: sc.sub, plan: sel.bowlPlan || null, capBonus, sel,
    });
    const bf = one(plan.bf), bs = one(plan.bs);
    return { id: team.id, short: team.short, name: team.name, bf, bs, plan, sel, impactType: impactType(sel), lineup: bf.lineup, bowlers: bs.bowlers };
  }
  // a sensible default over-by-over plan: the best death bowlers keep overs for the death,
  // the new-ball men open, spinners own the middle; nobody bowls more than 2 death or 3 powerplay overs
  function autoBowlPlan(team) {
    const pool = prepare(team).bs.bowlers;
    const phase = o => o < 6 ? 'pp' : o < 15 ? 'mid' : 'death';
    const score = (b, o) => {
      let s = b.bowlR; const ph = phase(o);
      if (ph === 'pp') { if (has(b, 'PP')) s += 7; if (!b.spin) s += 3; else if (!has(b, 'PP')) s -= 4; }
      else if (ph === 'mid') { if (b.spin) s += 5; if (has(b, 'MID')) s += 4; if (has(b, 'DTH')) s -= 3; }
      else { if (has(b, 'DTH')) s += 8; if (b.spin) s -= 6; else s += 2; }
      return s;
    };
    const plan = Array(20).fill(null), used = new Map(), inPh = new Map();
    const cap = { pp: 3, mid: 4, death: 2 };
    const order = [19, 17, 18, 16, 15, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
    for (const o of order) {
      const ph = phase(o);
      const c = pool.filter(b => (used.get(b.id) || 0) < 4 && (inPh.get(b.id + ph) || 0) < cap[ph] && plan[o - 1] !== b.id && plan[o + 1] !== b.id)
        .sort((x, y) => score(y, o) - score(x, o))[0];
      if (!c) continue; // left to the captain on the day
      plan[o] = c.id; used.set(c.id, (used.get(c.id) || 0) + 1); inPh.set(c.id + ph, (inPh.get(c.id + ph) || 0) + 1);
    }
    return plan;
  }

  /* ---------------- Commentary ---------------- */
  const TXT = {
    0: ['defended solidly.', 'beaten! Lovely delivery.', 'good length, no run.', 'full and straight, dug out.', 'swing and a miss!', 'straight to the fielder. Dot.', 'shoulders arms.'],
    1: ['worked into the leg side for a single.', 'pushed to long-on, they take one.', 'dabbed to third man for one.', 'nudged off the pads, single.', 'tapped and run!'],
    2: ['driven into the gap, they come back for two.', 'placed wide of deep midwicket, two runs.', 'clipped off the hips — two.'],
    3: ['superb running between the wickets, three taken!'],
    4: ['FOUR! Cracking drive through the covers!', 'FOUR! Pulled away with disdain!', 'FOUR! Edged… and it races to third man.', 'FOUR! Lofted over mid-off, one bounce over the rope.', 'FOUR! Ramped over the keeper!', 'FOUR! Cut fiercely past point!', 'FOUR! Whipped through midwicket!'],
    6: ['SIX! Launched into the stands!', 'SIX! That is HUGE — onto the roof!', 'SIX! Slog-swept over deep midwicket!', 'SIX! Flat and hard over long-on!', 'SIX! Effortless. Pure timing.', 'SIX! Down the track and DEPOSITED!', 'SIX! Into the second tier!'],
  };

  /* ---------------- Innings ---------------- */
  // plan: the bowling side's over-by-over plan (ids), whose later overs are kept in reserve
  function chooseBowler(over, pool, st, quota, maxOvers, plan, fixed) {
    const deathStart = maxOvers - 5;
    let best = null, bestS = -1e9;
    const top2 = pool.slice(0, 2);
    const later = new Map();
    if (plan) for (let k = over + 1; k < maxOvers; k++) if (plan[k] != null) later.set(plan[k], (later.get(plan[k]) || 0) + 1);
    const room = b => quota - (st.overs.get(b.id) || 0) - (later.get(b.id) || 0);
    for (const b of pool) {
      const used = st.overs.get(b.id) || 0;
      if (used >= quota || (room(b) <= 0 && pool.some(x => x !== b && room(x) > 0 && x.id !== st.last))) continue;
      if (b.id === st.last && pool.some(x => x.id !== b.id && (st.overs.get(x.id) || 0) < quota)) continue;
      if (plan && plan[over + 1] === b.id && pool.some(x => x !== b && x.id !== st.last && room(x) > 0)) continue; // he's down for the next over
      const left = quota - used;
      let s = b.bowlR;
      if (over < 6) { if (has(b, 'PP')) s += 7; if (!b.spin) s += 2; else if (!has(b, 'PP')) s -= 3; }
      else if (over < deathStart) { if (b.spin) s += 5; if (has(b, 'MID')) s += 4; if (has(b, 'DTH') && left <= 2) s -= 12; if (top2.includes(b) && left <= 1) s -= 6; }
      else { if (has(b, 'DTH')) s += 8; if (b.spin) s -= 5; else s += 2; }
      if (!fixed) s += rand() * 3;
      if (s > bestS) { bestS = s; best = b; }
    }
    return best || pool[0];
  }

  function simInnings(bs, fs, o) {
    const so = !!o.superOver;
    const lineup = so ? bs.lineup.slice().sort((a, b) => (b.pow * 0.6 + b.bat * 0.4) - (a.pow * 0.6 + a.bat * 0.4)).slice(0, 3) : bs.lineup;
    const pool = so ? [fs.bowlers.slice().sort((a, b) => (b.bowlR + (has(b, 'DTH') ? 6 : 0)) - (a.bowlR + (has(a, 'DTH') ? 6 : 0)))[0]] : fs.bowlers;
    const maxOvers = so ? 1 : 20, quota = so ? 1 : 4;
    const maxWk = so ? 2 : lineup.length - 1;
    const maxBalls = maxOvers * 6;
    const form = o.form, det = o.detailed;
    const dew = o.dew || 0; // 0..1, second innings at night: ball skids on, grip goes
    const pitch = { run: o.pitch.run * (o.cond || 1) * (1 + 0.03 * dew), spin: o.pitch.spin - 2 * dew };
    const homeB = o.homeId === bs.id ? 1.5 : 0, homeF = o.homeId === fs.id ? 1.5 : 0;

    const cards = lineup.map(p => ({ p, r: 0, b: 0, f4: 0, f6: 0, out: null, batted: false }));
    const bcards = new Map();
    const st = { overs: new Map(), last: null };
    let striker = 0, non = 1, next = 2;
    cards[0].batted = true; if (cards[1]) cards[1].batted = true;
    let runs = 0, wk = 0, balls = 0, extras = 0;
    const log = [], fow = [], overRuns = [];
    let partnership = 0, pBalls = 0, freeHit = false;

    const target = o.target || 0;
    for (let over = 0; over < maxOvers && wk < maxWk; over++) {
      if (target && runs >= target) break;
      // the captain's plan (user teams) decides who bowls this over, if that bowler can
      const want = !so && fs.plan ? fs.plan[over] : null;
      const planned = want != null ? fs.field.find(p => p.id === want && p.bt) : null;
      const bw = planned && (st.overs.get(planned.id) || 0) < quota && planned.id !== st.last ? planned
        : chooseBowler(over, pool, st, quota, maxOvers, so ? null : fs.plan);
      if (!bcards.has(bw.id)) bcards.set(bw.id, { p: bw, balls: 0, r: 0, w: 0, dots: 0, wd: 0, nb: 0 });
      const bc = bcards.get(bw.id);
      let legal = 0, overStart = runs;
      const phase = so ? PH.death : over < 6 ? PH.pp : over < 15 ? PH.mid : PH.death;
      const phaseName = so ? 'death' : over < 6 ? 'pp' : over < 15 ? 'mid' : 'death';
      const spinAdj = bw.spin ? pitch.spin : -pitch.spin / 2;
      const wE = bw.bowl + (form[bw.id] || 0) + homeF + fs.capBonus + spinAdj;
      const eE = bw.eco + (form[bw.id] || 0) * 0.5 + spinAdj * 0.5 + homeF * 0.5;
      while (legal < 6 && wk < maxWk) {
        if (target && runs >= target) break;
        const c = cards[striker];
        const bp = c.p;
        const fi = striker, ni = non;
        const snap = () => ({ s: [cards[fi].p.name, cards[fi].r, cards[fi].b, !!cards[fi].out, cards[fi].f4, cards[fi].f6], n: cards[ni] ? [cards[ni].p.name, cards[ni].r, cards[ni].b, cards[ni].f4, cards[ni].f6] : null, bw: [bw.name, bc.balls, bc.r, bc.w, bc.dots], pt: [partnership, pBalls] });
        // extras
        const pWide = clamp(0.04 * (1 + (66 - eE) / 60) * (1 + 0.3 * dew), 0.015, 0.075);
        const r0 = rand();
        if (r0 < pWide) {
          const wr = rand() < 0.03 ? 5 : 1; // the odd one beats the keeper too
          runs += wr; extras += wr; bc.r += wr; bc.wd++;
          if (det) log.push({ ov: over, b: legal, bowler: bw.name, bat: bp.name, ev: 'wd', runs, wk, txt: wr === 5 ? `${bw.name} to ${bp.name}, WIDE and it beats the keeper. Five wides!` : `${bw.name} to ${bp.name}, ${pick(['wide down the leg side.', 'wide outside off.', 'slips down leg, wide.'])}`, ...snap() });
          continue;
        }
        let noBall = false;
        if (r0 < pWide + 0.006) { noBall = true; runs += 1; extras += 1; bc.r += 1; bc.nb++; }
        const isFree = freeHit && !noBall;
        // aggression
        let A = 0.22 + 0.55 * clamp((bp.pow - 55) / 45, 0, 1);
        if (phaseName === 'pp') A += 0.08; else if (phaseName === 'death') A += 0.28;
        if (c.b < 5) A -= 0.08;
        if (isFree) A += 0.4;
        if (has(bp, 'ANC') && phaseName !== 'death') A -= 0.06;
        // resources: wickets in hand against balls left. Lose early wickets -> rebuild; wickets in hand late -> launch
        const ballsLeft = maxBalls - balls, inHand = maxWk - wk;
        const res = so ? 1 : inHand / Math.max(1, ballsLeft / 12);
        if (target) {
          const need = target - runs;
          const rrr = need / Math.max(ballsLeft, 1) * 6;
          A += clamp((rrr - 9.5) * 0.05, -0.25, 0.45) + clamp((res - 1) * 0.06, -0.12, 0.12);
        } else A += res < 1 ? -clamp((1 - res) * 0.6, 0, 0.35) : clamp((res - 1) * 0.08, 0, 0.2);
        A = clamp(A, 0.08, 1.05);

        // a set batter sees it like a football; a new one is vulnerable
        const setB = clamp((c.b - 8) * 0.25, -3, 2.5);
        const bE = bp.bat + (form[bp.id] || 0) + homeB + bs.capBonus + setB;
        const pE = bp.pow + (form[bp.id] || 0) * 0.5;
        const s = (bE - wE) / 20;
        let ctrl = 1 + (70 - eE) / 110;
        let wMul = 1;
        if (phaseName === 'pp' && has(bw, 'PP')) { wMul *= 1.1; ctrl *= 0.95; }
        if (phaseName === 'death' && has(bw, 'DTH')) { wMul *= 1.1; ctrl *= 0.92; }
        if (phaseName === 'mid' && has(bw, 'MID')) { wMul *= 1.06; ctrl *= 0.95; }
        let pW = 0.053 * Math.exp(-0.2 * s) * (0.6 + 0.75 * A) * phase.w * wMul * (has(bp, 'ANC') ? 0.86 : 1) * (bp.bat < 40 ? 1.3 : 1)
          ;
        let p6 = 0.061 * Math.exp(0.18 * s) * Math.pow(pE / 80, 2.4) * (0.4 + 1.15 * A) * phase.s * ctrl * pitch.run;
        let p4 = 0.124 * Math.exp(0.15 * s) * (0.78 + 0.45 * A) * phase.f * ctrl * pitch.run;
        if (phaseName === 'death' && has(bp, 'FIN')) { p6 *= 1.12; p4 *= 1.08; }
        if (has(bp, 'HIT')) p6 *= 1.06;
        const p0 = 0.305 * Math.exp(-0.14 * s) * (1.25 - 0.5 * A) / ctrl;
        const p1 = 0.36 * (1.1 - 0.25 * A);
        const p2 = 0.062, p3 = 0.004;
        if (noBall || isFree) pW = isFree ? pW * 0.04 : 0; // free hit: only a run-out
        const tot = pW + p0 + p1 + p2 + p3 + p4 + p6;
        let x = rand() * tot;
        let ev;
        if ((x -= pW) < 0) ev = 'W'; else if ((x -= p0) < 0) ev = 0; else if ((x -= p1) < 0) ev = 1;
        else if ((x -= p2) < 0) ev = 2; else if ((x -= p3) < 0) ev = 3; else if ((x -= p4) < 0) ev = 4; else ev = 6;

        if (!noBall) { legal++; balls++; bc.balls++; freeHit = false; pBalls++; }
        if (noBall) freeHit = true;
        c.b++;
        let txt = '';
        // leg-byes / byes: the batter misses, but they scamper
        if (ev === 0 && rand() < 0.07) {
          const lb = rand() < 0.86, er = rand() < 0.1 ? 4 : 1;
          runs += er; extras += er; partnership += er;
          if (det) log.push({ ov: over, b: legal, bowler: bw.name, bat: bp.name, ev: 0, xr: er, lb: true, nb: noBall, runs, wk,
            txt: `${bw.name} to ${bp.name}, ${er === 4 ? (lb ? 'deflects off the pad and races away — four leg-byes.' : 'beats the batter AND the keeper — four byes!') : lb ? 'off the pads, they sneak a leg-bye.' : 'misses everything, a bye taken.'}`, ...snap() });
          if (er % 2 === 1) { const t = striker; striker = non; non = t; }
          continue;
        }
        // catches go down too
        if (ev === 'W' && rand() < 0.065) {
          const fielder = pick(fs.field.filter(p => p.id !== bw.id));
          ev = rand() < 0.6 ? 0 : 1;
          if (ev === 1) { runs += 1; c.r += 1; bc.r += 1; partnership += 1; } else if (!noBall) bc.dots++;
          if (det) log.push({ ov: over, b: legal, bowler: bw.name, bat: bp.name, ev, nb: noBall, runs, wk, drop: true, txt: `DROPPED! ${fielder.name} puts down ${bp.name} on ${c.r}${ev === 1 ? ', and they take a single' : ''}. That could be costly…`, ...snap() });
          if (ev === 1) { const t = striker; striker = non; non = t; }
          continue;
        }
        if (ev === 'W' && isFree) {
          // the only way out on a free hit
          c.out = `run out (${pick(fs.field.filter(p => p.id !== bw.id)).name})`; wk++; bc.dots++;
          fow.push({ wk, runs, p: bp.name, ov: `${over}.${legal}` });
          if (det) log.push({ ov: over, b: legal, bowler: bw.name, bat: bp.name, ev, runs, wk, how: c.out, txt: `OUT! Run out going for a second on the free hit! ${bp.name} ${c.r} (${c.b})`, ...snap() });
          partnership = 0; pBalls = 0;
          if (next < cards.length && wk < maxWk) { striker = next; cards[next].batted = true; next++; }
          continue;
        }
        if (ev === 'W') {
          // dismissal type
          const fielders = fs.field.filter(p => p.id !== bw.id);
          const keeper = fs.field.find(p => p.role === 'WK') || pick(fielders);
          const r = rand();
          let how, credit = true;
          // IPL dismissal mix: ~70% caught, ~13% bowled, ~6% lbw, ~6% run out, stumpings off spin
          if (bw.spin) {
            if (r < 0.6) how = `c ${pick(fielders).name} b ${bw.name}`;
            else if (r < 0.73) how = `b ${bw.name}`;
            else if (r < 0.81) how = `lbw b ${bw.name}`;
            else if (r < 0.92) how = `st ${keeper.name} b ${bw.name}`;
            else { how = `run out (${pick(fielders).name})`; credit = false; }
          } else {
            if (r < 0.62) how = rand() < 0.5 && phaseName === 'death' ? `c&b ${bw.name}`.replace('c&b', 'c & b') : `c ${pick(fielders).name} b ${bw.name}`;
            else if (r < 0.74) how = `c ${keeper.name} b ${bw.name}`;
            else if (r < 0.88) how = `b ${bw.name}`;
            else if (r < 0.95) how = `lbw b ${bw.name}`;
            else { how = `run out (${pick(fielders).name})`; credit = false; }
          }
          c.out = how; wk++;
          if (credit) bc.w++;
          bc.dots++;
          fow.push({ wk, runs, p: bp.name, ov: `${over}.${legal}` });
          if (det) {
            const lines = how.startsWith('b ') ? 'TIMBER! Clean bowled!' : how.startsWith('lbw') ? 'Plumb in front — given!' : how.startsWith('st') ? 'Stumped! Lightning-quick glovework!' : how.startsWith('run out') ? 'Direct hit — RUN OUT!' : pick(['Caught! Holes out in the deep.', 'Caught! Top edge… taken!', 'Caught! What a grab!', 'Caught! Straight down the throat.']);
            txt = `OUT! ${lines} ${bp.name} ${c.r} (${c.b}). ${how}`;
          }
          partnership = 0; pBalls = 0;
          if (next < cards.length && wk < maxWk) { striker = next; cards[next].batted = true; next++; }
        } else {
          const rr = ev;
          runs += rr; c.r += rr; bc.r += rr; partnership += rr;
          if (rr === 0 && !noBall) bc.dots++;
          if (rr === 4) c.f4++;
          if (rr === 6) c.f6++;
          if (det) txt = (rr >= 4 ? '' : `${bw.name} to ${bp.name}, `) + pick(TXT[rr]) + (noBall ? ' (No-ball, +1!)' : '');
          if (rr % 2 === 1) { const t = striker; striker = non; non = t; }
        }
        if (det) log.push({ ov: over, b: legal, bowler: bw.name, bat: bp.name, ev, nb: noBall, runs, wk, txt, ...(ev === 'W' ? { how: c.out } : {}), ...snap() });
      }
      st.overs.set(bw.id, (st.overs.get(bw.id) || 0) + 1); st.last = bw.id;
      overRuns.push(runs - overStart);
      const t = striker; striker = non; non = t;
      if (det && legal === 6) log.push({ ov: over, b: 6, ev: 'end', runs, wk, orun: runs - overStart, bw: [bw.name, bc.balls, bc.r, bc.w, bc.dots], txt: `End of over ${over + 1}: ${bs.short} ${runs}/${wk}` });
    }
    return {
      team: bs.id, short: bs.short, runs, wk, balls, extras, maxBalls,
      bat: cards, bowl: Array.from(bcards.values()), fow, log, overRuns,
      allOut: wk >= maxWk,
    };
  }

  const oversStr = b => `${Math.floor(b / 6)}${b % 6 ? '.' + (b % 6) : ''}`;

  function playMatch(home, away, opt = {}) {
    const HP = home.prepared || prepare(home), AP = away.prepared || prepare(away);
    const H = HP, A = AP;
    const pitch = opt.pitch || { run: 1, spin: 0 };
    // form today = season form (if any) + the day's luck
    const form = {}, fb = opt.formBase || {};
    for (const p of new Set([...HP.bf.all, ...HP.bs.all, ...AP.bf.all, ...AP.bs.all])) form[p.id] = (fb[p.id] || 0) + gauss() * 3.2;
    // conditions: the surface varies around the venue's average; most games are at night and some bring dew
    const cond = 1 + gauss() * 0.035;
    const dew = rand() < 0.5 ? 0.3 + rand() * 0.7 : 0;
    const tossW = rand() < 0.5 ? H : A;
    // captains mostly chase; dew makes that a no-brainer, a slow turner tempts them to bat
    const batFirstChance = clamp(0.32 - 0.25 * dew + (pitch.spin >= 3 ? 0.25 : 0), 0.08, 0.7);
    const tossBat = rand() < batFirstChance;
    // the XI is named after the toss: each side uses its bat-first or bowl-first plan (impact player included)
    const firstP = tossBat ? tossW : (tossW === H ? A : H);
    const first = firstP.bf, second = (firstP === H ? A : H).bs;
    const base = { pitch, cond, form, detailed: !!opt.detailed, homeId: opt.neutral ? null : H.id };
    const i1 = simInnings(first, second, base);
    const i2 = simInnings(second, first, { ...base, dew, target: i1.runs + 1 });
    let winner = null, margin = '', so = null;
    if (i2.runs > i1.runs) { winner = second.id; const w = (second.lineup.length - 1) - i2.wk; margin = `won by ${w} wicket${w === 1 ? '' : 's'} (${i2.maxBalls - i2.balls} balls left)`; }
    else if (i2.runs < i1.runs) { winner = first.id; const r = i1.runs - i2.runs; margin = `won by ${r} run${r === 1 ? '' : 's'}`; }
    else {
      so = [];
      for (let k = 0; k < 3 && !winner; k++) {
        const s1 = simInnings(second, first, { ...base, superOver: true });
        const s2 = simInnings(first, second, { ...base, superOver: true, target: s1.runs + 1 });
        so.push([s1, s2]);
        if (s2.runs > s1.runs) winner = first.id; else if (s2.runs < s1.runs) winner = second.id;
      }
      if (!winner) winner = rand() < 0.5 ? first.id : second.id;
      margin = 'won the Super Over';
    }
    const res = {
      home: H.id, away: A.id, toss: { winner: tossW.id, choice: tossBat ? 'bat' : 'bowl' }, dew: dew > 0.6 ? 'heavy' : dew > 0 ? 'some' : 'none',
      pitchNote: cond > 1.05 ? 'a road' : cond < 0.95 ? 'a sluggish surface' : 'a good pitch', squads: { [first.id]: first.all, [second.id]: second.all },
      impact: { [first.id]: first.sub, [second.id]: second.sub }, xi: { [first.id]: first.start, [second.id]: second.start },
      par: Math.round(186 * pitch.run * cond), batOrder: { [first.id]: first.lineup, [second.id]: second.lineup },
      inn: [i1, i2], winner, loser: winner === H.id ? A.id : H.id, margin, superOver: so,
      tie: !!so,
    };
    res.motm = manOfMatch(res);
    return res;
  }

  function impactScore(res, pid) {
    let sc = 0;
    for (const inn of res.inn) {
      for (const c of inn.bat) if (c.p.id === pid && c.batted) {
        sc += c.r + c.f4 + c.f6 * 2;
        if (c.b >= 8) sc += (c.r / c.b * 100 - 140) / 8;
      }
      for (const b of inn.bowl) if (b.p.id === pid) {
        sc += b.w * 22 + b.dots * 0.8;
        if (b.balls >= 6) sc -= (b.r / b.balls * 6 - 9) * (b.balls / 6) * 1.5;
      }
    }
    return sc;
  }
  function manOfMatch(res) {
    let best = null, bs = -1e9;
    for (const inn of res.inn) {
      const other = inn.team === res.home ? res.away : res.home;
      const seen = new Map();
      for (const c of inn.bat) seen.set(c.p, inn.team);
      for (const b of inn.bowl) seen.set(b.p, other);
      for (const [p, teamOf] of seen) {
        const sc = impactScore(res, p.id) + (teamOf === res.winner ? 15 : 0);
        if (sc > bs) { bs = sc; best = p; }
      }
    }
    return best;
  }

  return { autoSelect, validateSelection, battingOrder, bowlingPool, prepare, playMatch, pickCaptain, oversStr, impactType, impactPlan, autoBowlPlan, planIssues, isBowlOption, gauss, slotOf, impactScore };
})();

if (typeof module !== 'undefined') module.exports = Engine;
