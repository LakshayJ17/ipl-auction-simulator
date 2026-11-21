# IPL 2027 Mega Auction 🏏

Open `index.html` in any browser. No install, no server, no internet needed.

## How it plays
1. **Pick a franchise.** All 10 start with ₹120 Cr, no retentions and 6 RTM cards (max 5 capped + 2 uncapped, the real 2025 rule).
2. **Player pool.** Before bidding starts you see all 259 players, split into sets like the real IPL mega auction: Marquee (M1, M2: 16 big names picked by stature, e.g. Kohli, Rohit, Dhoni, Bumrah), then capped Batters (BA), All-Rounders (AL), Wicketkeepers (WK), Fast Bowlers (FA) and Spinners (SP), each followed by uncapped sets for the same roles (UBA, UAL, UWK, UFA, USP). Each set has one base price, from ₹2 Cr for the top sets down to ₹30 L. Search, filter by category or set, and ⭐ shortlist players to get an alert when they come up.
3. **Auction.** Sets go in order (M1 → M2 → BA1 → AL1 → WK1 → FA1 → SP1 → UBA1 … → BA2 …), and players are drawn at random inside each set.
   - Each AI franchise decides whether to chase a player based on its purse, squad needs, overseas slots, the player's quality and its own style. A superstar can start a 7-team war; a squad filler might go unsold. Late paddles can appear mid-auction.
   - Buttons: **BID**, **Pass** (skip this player and fast-forward to the result), quick raises (+₹50 L / +₹1 Cr / +₹2 Cr), Pause, and the ⚙ menu has speed, hammer pace, the player pool, a custom bid amount, the sim options and Rules.
   - **Skip this set**: you sit out the rest of the current set; it resolves instantly between the AI teams.
   - **🏏 Skip to matches** (⚙ menu; also a green button in the top bar once you're out of money, your squad is full, or the Accelerated Round starts): the rest of the auction runs instantly while your AI manager builds the squad the way a person would, then your XI is auto-picked and the season starts. Base-price top-ups only happen if your purse is already spent.
   - **Out of money?** Your max bid always keeps ₹30 L for each slot you still need for 18, so you can't get stuck. Any gaps are filled at the end at base price (or with what's left, if you can't cover a base price).
   - **How your AI manager builds** (Skip to matches, Sim this set, Sim whole auction): it plans a balanced XI + impact player (WK, 4 batters, 2 all-rounders, 3 pacers, 2 spinners, max 4 overseas), bids only on players who genuinely improve that XI, looks ahead through the published auction order and skips a player if better ones for that role are still to come, spreads your purse over the open XI places (two or three marquee buys at most, so the bowling isn't starved), bids harder when it has more cash than rivals, and only then buys useful backups — so no money is wasted on depth and the XI isn't made of leftovers.
   - **Sim this set (auto-bid)** / **Sim whole auction**: from whatever point you press it, an AI manager bids for your team with your remaining purse, aiming for XI-quality players when you have saved cash, and makes your RTM calls. Your squad always ends with at least 18.
   - **Budget helper:** your squad panel shows how many players you still need to reach 18, the money per player that leaves you, and your max bid (it turns amber, then red, when money gets tight).
   - **Hammer:** when bids stop, the auctioneer calls Going once → Going twice → Going thrice → SOLD. Each call flashes on screen with a countdown (⚙ menu: Slow 3.5 s / Normal 2.2 s / Quick 1.2 s), whatever the auction speed. Pause freezes it.
   - Optional keys: `Space` bid · `S` pass · `J` +₹1 Cr · `P` pause. Phones get a sticky bid bar at the bottom of the screen.
   - **RTM (real 2025 rule):** 6 cards per team (max 5 capped, 2 uncapped). The 2026 team raises the card, the highest bidder gets one final raise, then the RTM team matches or walks away. A card is only used up if the RTM succeeds.
4. **Squad review.** Pick your Playing XI, captain and **Impact Player**. 200 simulated seasons give a forecast and your auction grade.
   - **Toss-aware Impact Player:** the impact sub and his ⇄ partner form a flex pair, one batter and one bowler, and the toss decides who starts. Bat first: the extra batter starts, and at the break the extra bowler comes on for whoever bowls least. Bowl first: the extra bowler starts, and for the chase the extra batter comes in for your weakest batter. The editor shows both plans, and the AI teams use the same logic.
   - **Batting order:** move players up and down, or leave it on auto. Whoever sits out after the toss is skipped.
   - **Bowling plan:** choose the bowler for each of the 20 overs, or tap ✨ *Suggest a plan*. The suggestion opens with the new-ball bowlers, gives the middle overs to spin and keeps the death specialists for overs 16–20. Max 4 overs each and no back-to-back overs. Overs left on Auto, or a planned bowler who isn't available, are picked by your captain during the match.
5. **Season.** 70 league matches in the real two-group format, then Qualifier 1, Eliminator, Qualifier 2 and the Final. Watch your matches ball by ball or quick-sim them. You get full scorecards with a Manhattan chart, NRR, Orange/Purple Cap, MVP and more.
   - **Match centre:**
     - team-coloured scoreboard with run rate, projected score and par;
     - the chase equation, and a live win-probability bar;
     - batters with 4s, 6s, strike rate and partnership; the current bowler's figures;
     - ball chips for the over, over summaries, and fifty, hundred and wicket call-outs;
     - Impact Player swaps announced at the break;
     - tabs for commentary, a live scorecard, a Manhattan chart and both XIs;
     - controls to skip to the end of the over, the end of the innings or the result.
   - **Season sim:** *My next match*, *Sim league* and *Sim to Final* run in a live overlay. Results tick in and the points table moves. You can stop it at any point, or tap ⚡ *Instant*.
   - **Auction sim:** while a set or the whole auction is simulated, the stage shows a live ticker of signings, your manager's buys, your squad shape and progress.
   - **Match engine** (tuned against IPL 2024–25): ~190 average first innings, about a third of totals past 200, powerplay ~9.7 / middle ~8.9 / death ~11 an over, ~6.3 wickets an innings, realistic extras (wides, leg-byes, no-balls with a **free hit**), dropped catches, and an IPL-like dismissal mix.
   - **Conditions:** every venue keeps its character, but the surface varies match to match; night games can bring **dew**, which helps the chasing side and blunts spin, so captains usually bowl first.
   - **Batting brain:** new batters are vulnerable and set ones get better; teams rebuild after early wickets and launch when they have wickets in hand; chases are paced to the required rate.
   - **Mid-season loan window (IPL playing conditions):**
     - It opens after league match 20 and closes after match 56.
     - From the season screen you can borrow players who have played **fewer than 2 matches** this season. They stay for the rest of the season and then go back to their club.
     - A loaned player can't play against his parent team, and the game rests him automatically for those games.
     - Limits: one loan per player, and at most 3 loans from one franchise to another. Salaries stay with the parent club, so your purse isn't touched.
     - An AI club only lends a player who isn't in its XI plans (judged on form), and only if it keeps enough cover without him.
     - Permanent trades aren't allowed during the season.
   - **Player of the Match** is judged against how the game went:
     - runs count for more in a low-scoring game, and strike rate and economy are measured against the match's own scoring rate;
     - a wicket is worth more the better the batter dismissed;
     - catches, stumpings and run-outs count, as do Super Over heroics;
     - finishing a chase not out earns extra;
     - being on the winning side matters. About 94% of awards go to the winning team, as in the IPL.
   - **Through the season:** players carry **form** (🔥 hot / 🥶 cold streaks), AI coaches pick their XI on form, and **injuries** rule players out for 1–5 matches (your XI gets the best stand-in from your bench for those matches only). Team news is shown above each fixture. The 200-season forecast uses the same rules.
6. **Off-season trade window → IPL 2028, 2029, …** After the final, open the trade window, then carry your squad into the next season.
   - **When trades are allowed:** IPL trades are never made *during* an auction. The window opens a month after a season and runs until a week before the auction, then reopens after the auction until a month before the next season. Players bought at an auction can't be traded in the window straight after it. After this game's mega auction, that means trading opens in the off-season.
   - **Deal types:** player-for-player swaps (any number each way) or one-way all-cash deals. The player keeps his salary and purses adjust by the difference. Squads must stay at 18–25 with at most 8 overseas, purses can't go negative, and each player can be traded once per window.
   - **How AI teams decide:** they value a deal by how it changes their best XI and their depth, the players' market value and the salary they take on. Their stars and loyal clubs (CSK) are harder to prise loose.
   - **What you can do:** build a trade with any franchise, ask 🤝 *What would they want?* for a player you like, or answer the offers AI teams send you. AI teams also trade with each other, and those deals appear in the trade news.

## Files
- `js/data.js`: player database and team info. OVR comes from batting (66% run-making, 34% strike rate) or bowling skill, with curated overrides (`OVR_FIX`) for the stars based on stature, consistency and IPL 2026 form.
- `js/engine.js`: ball-by-ball match engine, XI selection, the toss-aware impact plan, custom batting order and bowling plan.
- `js/auction.js`: AI valuations, bidding wars, RTM logic.
- `js/season.js`: fixtures, points table, playoffs, stats, Monte-Carlo forecast.
- `js/trade.js`: trade window, with legality checks, AI valuation of deals, suggested deals, AI offers, AI-to-AI trades, and AI decisions on mid-season loans.
- `js/app.js`: UI.

Edit `js/data.js` to tweak any player's ratings (`bat`, `pow`, `bowl`, `eco`, tags).
