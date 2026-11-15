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
4. **Squad review.** Pick your Playing XI, **Impact Player** (and who they replace) and captain. 200 simulated seasons give a forecast and your auction grade.
5. **Season.** 70 league matches in the real two-group format, then Qualifier 1, Eliminator, Qualifier 2 and the Final. Watch your matches ball by ball with commentary or quick-sim them. You get full scorecards, NRR, Orange/Purple Cap, MVP and more.
   - **Match engine** (tuned against IPL 2024–25): ~190 average first innings, about a third of totals past 200, powerplay ~9.7 / middle ~8.9 / death ~11 an over, ~6.3 wickets an innings, realistic extras (wides, leg-byes, no-balls with a **free hit**), dropped catches, and an IPL-like dismissal mix.
   - **Conditions:** every venue keeps its character, but the surface varies match to match; night games can bring **dew**, which helps the chasing side and blunts spin, so captains usually bowl first.
   - **Batting brain:** new batters are vulnerable and set ones get better; teams rebuild after early wickets and launch when they have wickets in hand; chases are paced to the required rate.
   - **Through the season:** players carry **form** (🔥 hot / 🥶 cold streaks), AI coaches pick their XI on form, and **injuries** rule players out for 1–5 matches (your XI gets the best stand-in from your bench for those matches only). Team news is shown above each fixture. The 200-season forecast uses the same rules.

## Files
- `js/data.js`: player database and team info. OVR comes from batting (66% run-making, 34% strike rate) or bowling skill, with curated overrides (`OVR_FIX`) for the stars based on stature, consistency and IPL 2026 form.
- `js/engine.js`: ball-by-ball match engine, XI and impact-player selection.
- `js/auction.js`: AI valuations, bidding wars, RTM logic.
- `js/season.js`: fixtures, points table, playoffs, stats, Monte-Carlo forecast.
- `js/app.js`: UI.

Edit `js/data.js` to tweak any player's ratings (`bat`, `pow`, `bowl`, `eco`, tags).
