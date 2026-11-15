'use strict';
/* =====================================================================
   IPL 2027 MEGA AUCTION — PLAYER & TEAM DATABASE
   Ratings are built from IPL 2026 season numbers (Orange/Purple cap
   tables, strike rates, economies) plus recent T20 reputation.
   bat  = batting quality (timing, consistency, avg)
   pow  = power / strike-rate intent
   bowl = wicket-taking threat
   eco  = control / economy
   ===================================================================== */

const TEAMS = [
  { id: 'CSK', name: 'Chennai Super Kings', short: 'CSK', color: '#F9CD05', fg: '#13213f',
    venue: 'MA Chidambaram Stadium, Chennai', pitch: { run: 0.95, spin: 4 },
    persona: { label: 'Loyal, spin-heavy & experienced', agg: 1.0, rtm: 1.3, pref: { SPIN: 1.15, IND: 1.06 } } },
  { id: 'MI', name: 'Mumbai Indians', short: 'MI', color: '#0A5BC4', fg: '#ffffff',
    venue: 'Wankhede Stadium, Mumbai', pitch: { run: 1.05, spin: -1 },
    persona: { label: 'Star hunters', agg: 1.07, rtm: 1.15, pref: { STAR: 1.18, PACE: 1.05 } } },
  { id: 'RCB', name: 'Royal Challengers Bengaluru', short: 'RCB', color: '#D11F2E', fg: '#ffffff',
    venue: 'M. Chinnaswamy Stadium, Bengaluru', pitch: { run: 1.08, spin: -2 },
    persona: { label: 'Back-to-back champions', agg: 1.05, rtm: 1.15, pref: { POW: 1.1, PACE: 1.08 } } },
  { id: 'KKR', name: 'Kolkata Knight Riders', short: 'KKR', color: '#4B2A86', fg: '#F2C14E',
    venue: 'Eden Gardens, Kolkata', pitch: { run: 1.03, spin: 2 },
    persona: { label: 'Mystery spin & muscle', agg: 1.03, rtm: 1.2, pref: { SPIN: 1.12, AR: 1.12 } } },
  { id: 'DC', name: 'Delhi Capitals', short: 'DC', color: '#1F4FB5', fg: '#ffffff',
    venue: 'Arun Jaitley Stadium, Delhi', pitch: { run: 1.04, spin: 0 },
    persona: { label: 'Balanced builders', agg: 1.0, rtm: 1.0, pref: { AR: 1.08 } } },
  { id: 'PBKS', name: 'Punjab Kings', short: 'PBKS', color: '#DD1F2D', fg: '#ffffff',
    venue: 'Maharaja Yadavindra Singh Stadium, Mullanpur', pitch: { run: 1.0, spin: -1 },
    persona: { label: 'Big spenders', agg: 1.12, rtm: 1.0, pref: { STAR: 1.1, IND: 1.05 } } },
  { id: 'RR', name: 'Rajasthan Royals', short: 'RR', color: '#E4237F', fg: '#ffffff',
    venue: 'Sawai Mansingh Stadium, Jaipur', pitch: { run: 0.99, spin: 2 },
    persona: { label: 'Moneyball talent scouts', agg: 0.93, rtm: 1.1, pref: { UNC: 1.35, SPIN: 1.05 } } },
  { id: 'SRH', name: 'Sunrisers Hyderabad', short: 'SRH', color: '#F26522', fg: '#111111',
    venue: 'Rajiv Gandhi Intl. Stadium, Hyderabad', pitch: { run: 1.07, spin: -1 },
    persona: { label: 'Powerplay carnage', agg: 1.04, rtm: 1.1, pref: { POW: 1.18, PACE: 1.05 } } },
  { id: 'GT', name: 'Gujarat Titans', short: 'GT', color: '#1C2C4C', fg: '#D9B867',
    venue: 'Narendra Modi Stadium, Ahmedabad', pitch: { run: 1.02, spin: 0 },
    persona: { label: 'Bowlers win titles', agg: 1.0, rtm: 1.1, pref: { PACE: 1.12, SPIN: 1.08, ANC: 1.06 } } },
  { id: 'LSG', name: 'Lucknow Super Giants', short: 'LSG', color: '#2C6BE0', fg: '#FF8A2A',
    venue: 'BRSABV Ekana Stadium, Lucknow', pitch: { run: 0.95, spin: 3 },
    persona: { label: 'Pace & power', agg: 1.03, rtm: 1.0, pref: { PACE: 1.12, OVS: 1.05 } } },
];

const COUNTRY = {
  IND: { flag: '🇮🇳', name: 'India' }, AUS: { flag: '🇦🇺', name: 'Australia' }, ENG: { flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', name: 'England' },
  SA: { flag: '🇿🇦', name: 'South Africa' }, NZ: { flag: '🇳🇿', name: 'New Zealand' }, WI: { flag: '🌴', name: 'West Indies' },
  AFG: { flag: '🇦🇫', name: 'Afghanistan' }, SL: { flag: '🇱🇰', name: 'Sri Lanka' }, BAN: { flag: '🇧🇩', name: 'Bangladesh' },
};

const BOWL_TYPE = {
  RF: 'Right-arm fast', RM: 'Right-arm medium-fast', LF: 'Left-arm fast', OS: 'Off-spin',
  LS: 'Leg-spin', SLA: 'Left-arm orthodox', LWS: 'Left-arm wrist-spin', '': '—',
};

const TAG_INFO = {
  PP: ['Powerplay Specialist', 'Bonus wicket threat & control in overs 1–6'],
  DTH: ['Death Specialist', 'Yorkers & slower balls — better at overs 16–20'],
  MID: ['Middle-overs Strangler', 'Spin control in overs 7–15'],
  ANC: ['Anchor', 'Lower dismissal risk, builds innings'],
  FIN: ['Finisher', 'Extra boundary threat at the death'],
  HIT: ['Six Machine', 'Elite six-hitting range'],
  CAP: ['Leader', 'Captaincy experience — small team boost when captain'],
  UNC: ['Uncapped', 'Has not played international cricket for India'],
};

const RAW = [];
// P(name, country, role, 2026 team, bat, pow, bowl, eco, bowlType, battingPos, tags, statline)
function P(n, c, r, t, bat, pow, bowl, eco, bt, pos, tags, stat) {
  RAW.push({ name: n, c, role: r, prev: t, bat, pow, bowl: bowl || 10, eco: eco || 15, bt: bt || '', pos, tags: tags ? tags.split(' ') : [], stat: stat || '' });
}
// U(...) helper for fringe domestic players
function U(n, t, r, bt, pos, lvl, capped) {
  let bat, pow, bowl, eco;
  if (r === 'BAT' || r === 'WK') { bat = lvl; pow = lvl + 9; bowl = 10; eco = 15; }
  else if (r === 'BOWL') { bat = 15; pow = 25; bowl = lvl + 1; eco = lvl - 1; }
  else { bat = lvl - 5; pow = lvl + 4; bowl = lvl - 3; eco = lvl - 4; }
  RAW.push({ name: n, c: 'IND', role: r, prev: t, bat, pow, bowl, eco, bt: bt || '', pos, tags: capped ? [] : ['UNC'], stat: '' });
}

/* ---------------- Chennai Super Kings ---------------- */
P('MS Dhoni', 'IND', 'WK', 'CSK', 67, 80, 0, 0, '', 'F', 'FIN CAP UNC', 'Thala — still finishing at 45 (uncapped rule)');
P('Sanju Samson', 'IND', 'WK', 'CSK', 85, 88, 0, 0, '', 'O', 'CAP', '477 runs · SR 166 · 2 hundreds (2026)');
P('Ruturaj Gaikwad', 'IND', 'BAT', 'CSK', 83, 76, 0, 0, '', 'O', 'ANC CAP', 'Classy top-order anchor');
P('Shivam Dube', 'IND', 'AR', 'CSK', 78, 91, 45, 40, 'RM', 'M', 'HIT', 'Spin-hitting specialist');
P('Ayush Mhatre', 'IND', 'BAT', 'CSK', 76, 86, 20, 20, 'OS', 'O', 'UNC', 'Teenage opener, fearless intent');
P('Dewald Brevis', 'SA', 'BAT', 'CSK', 79, 92, 20, 20, 'LS', 'M', 'HIT', '"Baby AB" — six-hitting machine');
P('Urvil Patel', 'IND', 'WK', 'CSK', 66, 90, 0, 0, '', 'O', 'UNC HIT', 'Fastest T20 hundred-maker in domestic cricket');
P('Kartik Sharma', 'IND', 'WK', 'CSK', 66, 86, 0, 0, '', 'M', 'UNC', '₹14.2 Cr uncapped buy in the 2026 auction');
P('Prashant Veer', 'IND', 'AR', 'CSK', 60, 74, 68, 72, 'SLA', 'M', 'UNC', '₹14.2 Cr uncapped buy in the 2026 auction');
P('Akeal Hosein', 'WI', 'BOWL', 'CSK', 30, 55, 77, 84, 'SLA', 'L', 'PP', 'New-ball spinner');
P('Matt Henry', 'NZ', 'BOWL', 'CSK', 25, 40, 80, 74, 'RF', 'L', 'PP', '');
P('Matthew Short', 'AUS', 'AR', 'CSK', 75, 85, 52, 62, 'OS', 'O', '', '');
P('Sarfaraz Khan', 'IND', 'BAT', 'CSK', 72, 78, 0, 0, '', 'M', '', '');
P('Zak Foulkes', 'NZ', 'AR', 'CSK', 52, 70, 70, 62, 'RM', 'L', '', '');
P('Jamie Overton', 'ENG', 'AR', 'CSK', 62, 86, 74, 64, 'RF', 'F', 'DTH', '');
P('Gurjapneet Singh', 'IND', 'BOWL', 'CSK', 15, 20, 70, 66, 'LF', 'L', 'UNC', '');
P('Mukesh Choudhary', 'IND', 'BOWL', 'CSK', 15, 20, 68, 62, 'LF', 'L', 'UNC PP', '');
P('Nathan Ellis', 'AUS', 'BOWL', 'CSK', 25, 40, 80, 76, 'RF', 'L', 'DTH', '');
P('Shreyas Gopal', 'IND', 'BOWL', 'CSK', 35, 45, 66, 68, 'LS', 'L', '', '');
P('Noor Ahmad', 'AFG', 'BOWL', 'CSK', 20, 30, 86, 80, 'LWS', 'L', 'MID', 'Wrist-spin wizard');
P('Khaleel Ahmed', 'IND', 'BOWL', 'CSK', 15, 20, 79, 72, 'LF', 'L', 'PP', '');
P('Rahul Chahar', 'IND', 'BOWL', 'CSK', 25, 35, 72, 72, 'LS', 'L', '', '');
P('Anshul Kamboj', 'IND', 'BOWL', 'CSK', 38, 55, 81, 68, 'RM', 'L', 'PP', '21 wkts in 14 games (2026)');

/* ---------------- Delhi Capitals ---------------- */
P('KL Rahul', 'IND', 'WK', 'DC', 89, 85, 0, 0, '', 'O', 'ANC CAP', '593 runs · SR 174 · 152* — highest score of 2026');
P('Axar Patel', 'IND', 'AR', 'DC', 73, 82, 84, 88, 'SLA', 'M', 'CAP MID', 'Elite control left-arm spinner');
P('Kuldeep Yadav', 'IND', 'BOWL', 'DC', 20, 25, 84, 77, 'LWS', 'L', 'MID', 'Chinaman — off-colour 2026, still lethal');
P('Mitchell Starc', 'AUS', 'BOWL', 'DC', 30, 55, 86, 75, 'LF', 'L', 'PP DTH', 'Left-arm yorker machine');
P('Tristan Stubbs', 'SA', 'BAT', 'DC', 80, 88, 30, 40, 'OS', 'F', 'FIN', '');
P('Abishek Porel', 'IND', 'WK', 'DC', 72, 84, 0, 0, '', 'O', 'UNC', '');
P('Karun Nair', 'IND', 'BAT', 'DC', 73, 78, 0, 0, '', 'T', '', '');
P('Ashutosh Sharma', 'IND', 'BAT', 'DC', 66, 92, 0, 0, '', 'F', 'FIN HIT UNC', 'Chases from nowhere');
P('Dushmantha Chameera', 'SL', 'BOWL', 'DC', 25, 40, 75, 68, 'RF', 'L', '', '');
P('Mukesh Kumar', 'IND', 'BOWL', 'DC', 15, 20, 72, 66, 'RM', 'L', 'DTH', '');
P('Vipraj Nigam', 'IND', 'AR', 'DC', 50, 75, 70, 72, 'LS', 'L', 'UNC', '');
P('Nitish Rana', 'IND', 'BAT', 'DC', 74, 82, 40, 50, 'OS', 'M', '', '');
P('T Natarajan', 'IND', 'BOWL', 'DC', 10, 10, 74, 70, 'LF', 'L', 'DTH', 'Yorker king');
P('Sameer Rizvi', 'IND', 'BAT', 'DC', 68, 85, 0, 0, '', 'M', 'UNC', '');
P('Auqib Nabi', 'IND', 'BOWL', 'DC', 25, 40, 72, 68, 'RM', 'L', 'UNC', '');
P('David Miller', 'SA', 'BAT', 'DC', 77, 85, 0, 0, '', 'F', 'FIN', 'Killer Miller');
P('Kyle Jamieson', 'NZ', 'BOWL', 'DC', 40, 65, 75, 68, 'RF', 'L', '', '');
P('Ben Duckett', 'ENG', 'BAT', 'DC', 78, 87, 0, 0, '', 'O', '', '');
P('Pathum Nissanka', 'SL', 'BAT', 'DC', 80, 80, 0, 0, '', 'O', 'ANC', '');
P('Prithvi Shaw', 'IND', 'BAT', 'DC', 66, 84, 0, 0, '', 'O', '', '');

/* ---------------- Gujarat Titans ---------------- */
P('Shubman Gill', 'IND', 'BAT', 'GT', 91, 84, 0, 0, '', 'O', 'ANC CAP', '732 runs · Avg 45.8 · SR 163 (2026)');
P('Sai Sudharsan', 'IND', 'BAT', 'GT', 89, 80, 0, 0, '', 'O', 'ANC', '722 runs · 8 fifties · SR 158 (2026)');
P('Jos Buttler', 'ENG', 'WK', 'GT', 87, 87, 0, 0, '', 'O', '', '526 runs · SR 152 (2026)');
P('Kagiso Rabada', 'SA', 'BOWL', 'GT', 30, 50, 91, 77, 'RF', 'L', 'PP', '29 wkts — Purple Cap · record 20 powerplay wkts');
P('Rashid Khan', 'AFG', 'AR', 'GT', 50, 82, 90, 84, 'LS', 'L', 'MID', '21 wkts (2026) · only spinner in top 10');
P('Mohammed Siraj', 'IND', 'BOWL', 'GT', 15, 20, 83, 75, 'RF', 'L', 'PP', '19 wkts (2026)');
P('Prasidh Krishna', 'IND', 'BOWL', 'GT', 10, 10, 80, 70, 'RF', 'L', '', '16 wkts in 12 (2026)');
P('Jason Holder', 'WI', 'AR', 'GT', 60, 80, 82, 84, 'RM', 'F', 'DTH', '17 wkts @ 7.56 econ (2026)');
P('Glenn Phillips', 'NZ', 'AR', 'GT', 74, 87, 45, 58, 'OS', 'M', '', 'Superman in the field');
P('Washington Sundar', 'IND', 'AR', 'GT', 66, 72, 76, 82, 'OS', 'M', '', '');
P('Rahul Tewatia', 'IND', 'AR', 'GT', 66, 86, 40, 50, 'LS', 'F', 'FIN', '');
P('Shahrukh Khan', 'IND', 'BAT', 'GT', 66, 87, 20, 30, 'OS', 'F', 'HIT UNC', '');
P('Sai Kishore', 'IND', 'BOWL', 'GT', 30, 40, 76, 78, 'SLA', 'L', 'MID', '');
P('Ishant Sharma', 'IND', 'BOWL', 'GT', 15, 15, 68, 62, 'RF', 'L', '', '');
P('Tom Banton', 'ENG', 'BAT', 'GT', 72, 87, 0, 0, '', 'T', '', '');
P('Luke Wood', 'ENG', 'BOWL', 'GT', 20, 40, 70, 64, 'LF', 'L', '', '');
P('Kumar Kushagra', 'IND', 'WK', 'GT', 62, 74, 0, 0, '', 'M', 'UNC', '');
P('Anuj Rawat', 'IND', 'WK', 'GT', 60, 78, 0, 0, '', 'M', 'UNC', '');
P('Arshad Khan', 'IND', 'AR', 'GT', 45, 78, 65, 58, 'LF', 'L', 'UNC', '');
P('Manav Suthar', 'IND', 'BOWL', 'GT', 20, 30, 64, 68, 'SLA', 'L', 'UNC', '');
P('Gurnoor Brar', 'IND', 'BOWL', 'GT', 15, 20, 66, 60, 'RF', 'L', 'UNC', '');

/* ---------------- Kolkata Knight Riders ---------------- */
P('Sunil Narine', 'WI', 'AR', 'KKR', 70, 91, 88, 94, 'OS', 'O', 'MID', '15 wkts · Econ 6.64 — best in the league (2026)');
P('Varun Chakravarthy', 'IND', 'BOWL', 'KKR', 10, 10, 88, 86, 'LS', 'L', 'MID', 'Mystery spinner');
P('Cameron Green', 'AUS', 'AR', 'KKR', 80, 84, 70, 64, 'RF', 'T', '', '₹25.20 Cr — record buy of the 2026 auction');
P('Rinku Singh', 'IND', 'BAT', 'KKR', 76, 87, 0, 0, '', 'F', 'FIN', '5 sixes in an over — remember?');
P('Ajinkya Rahane', 'IND', 'BAT', 'KKR', 75, 78, 0, 0, '', 'T', 'CAP', '');
P('Harshit Rana', 'IND', 'BOWL', 'KKR', 40, 62, 76, 66, 'RF', 'L', 'DTH', '');
P('Angkrish Raghuvanshi', 'IND', 'BAT', 'KKR', 72, 79, 0, 0, '', 'T', 'UNC', '');
P('Matheesha Pathirana', 'SL', 'BOWL', 'KKR', 10, 10, 80, 68, 'RF', 'L', 'DTH', '"Baby Malinga" sling action');
P('Finn Allen', 'NZ', 'BAT', 'KKR', 72, 95, 0, 0, '', 'O', 'HIT', '349 runs · SR 214 (2026)');
P('Rovman Powell', 'WI', 'BAT', 'KKR', 68, 89, 0, 0, '', 'F', 'HIT', '');
P('Ramandeep Singh', 'IND', 'AR', 'KKR', 58, 86, 52, 52, 'RM', 'F', '', '');
P('Vaibhav Arora', 'IND', 'BOWL', 'KKR', 15, 20, 74, 66, 'RM', 'L', 'PP UNC', '');
P('Umran Malik', 'IND', 'BOWL', 'KKR', 10, 10, 66, 52, 'RF', 'L', '', '150 kph tearaway');
P('Kartik Tyagi', 'IND', 'BOWL', 'KKR', 15, 20, 76, 66, 'RF', 'L', '', '18 wkts (2026)');
P('Rachin Ravindra', 'NZ', 'AR', 'KKR', 80, 81, 52, 66, 'SLA', 'O', '', '');
P('Mustafizur Rahman', 'BAN', 'BOWL', 'KKR', 10, 10, 79, 77, 'LF', 'L', 'DTH', 'The Fizz — cutter king');
P('Tim Seifert', 'NZ', 'WK', 'KKR', 70, 87, 0, 0, '', 'O', '', '');
P('Akash Deep', 'IND', 'BOWL', 'KKR', 15, 25, 70, 62, 'RF', 'L', '', '');
P('Manish Pandey', 'IND', 'BAT', 'KKR', 68, 70, 0, 0, '', 'M', '', '');
P('Rahul Tripathi', 'IND', 'BAT', 'KKR', 66, 79, 0, 0, '', 'T', '', '');
P('Anukul Roy', 'IND', 'AR', 'KKR', 45, 58, 64, 70, 'SLA', 'L', 'UNC', '');

/* ---------------- Lucknow Super Giants ---------------- */
P('Rishabh Pant', 'IND', 'WK', 'LSG', 80, 89, 0, 0, '', 'M', 'CAP', '₹27 Cr — most expensive IPL player ever (2025)');
P('Nicholas Pooran', 'WI', 'WK', 'LSG', 84, 97, 0, 0, '', 'M', 'HIT', 'Six-hitting monster');
P('Mitchell Marsh', 'AUS', 'AR', 'LSG', 84, 88, 45, 50, 'RM', 'O', '', '563 runs · SR 163 · 36 sixes (2026)');
P('Aiden Markram', 'SA', 'BAT', 'LSG', 82, 80, 50, 62, 'OS', 'O', 'CAP', '');
P('Matthew Breetzke', 'SA', 'BAT', 'LSG', 75, 78, 0, 0, '', 'T', '', '');
P('Josh Inglis', 'AUS', 'WK', 'LSG', 76, 87, 0, 0, '', 'T', '', '');
P('Ayush Badoni', 'IND', 'BAT', 'LSG', 70, 80, 30, 40, 'OS', 'M', 'UNC', '');
P('Abdul Samad', 'IND', 'BAT', 'LSG', 65, 89, 0, 0, '', 'F', 'HIT UNC', '');
P('Avesh Khan', 'IND', 'BOWL', 'LSG', 15, 20, 74, 64, 'RF', 'L', 'DTH', '');
P('Mayank Yadav', 'IND', 'BOWL', 'LSG', 10, 10, 77, 66, 'RF', 'L', '', '156 kph express pace');
P('Mohammed Shami', 'IND', 'BOWL', 'LSG', 20, 30, 78, 70, 'RF', 'L', 'PP', 'Seam-up master');
P('Wanindu Hasaranga', 'SL', 'AR', 'LSG', 50, 76, 82, 78, 'LS', 'L', 'MID', '');
P('Digvesh Rathi', 'IND', 'BOWL', 'LSG', 15, 20, 74, 78, 'LS', 'L', 'UNC', 'Notebook celebration');
P('Prince Yadav', 'IND', 'BOWL', 'LSG', 15, 20, 74, 72, 'RM', 'L', 'UNC', '16 wkts (2026)');
P('Anrich Nortje', 'SA', 'BOWL', 'LSG', 15, 20, 74, 64, 'RF', 'L', '', '');
P('Mohsin Khan', 'IND', 'BOWL', 'LSG', 15, 20, 70, 66, 'LF', 'L', 'UNC', '');
P('Shahbaz Ahmed', 'IND', 'AR', 'LSG', 55, 70, 64, 68, 'SLA', 'M', '', '');
P('Arjun Tendulkar', 'IND', 'AR', 'LSG', 35, 55, 60, 58, 'LF', 'L', 'UNC', '');
P('Arshin Kulkarni', 'IND', 'AR', 'LSG', 55, 72, 50, 50, 'RM', 'M', 'UNC', '');
P('M Siddharth', 'IND', 'BOWL', 'LSG', 15, 15, 64, 66, 'SLA', 'L', 'UNC', '');

/* ---------------- Mumbai Indians ---------------- */
P('Rohit Sharma', 'IND', 'BAT', 'MI', 82, 89, 0, 0, '', 'O', 'CAP', 'Hitman — 5-time IPL winning captain');
P('Suryakumar Yadav', 'IND', 'BAT', 'MI', 86, 95, 0, 0, '', 'M', 'CAP HIT', 'Mr. 360°');
P('Hardik Pandya', 'IND', 'AR', 'MI', 78, 89, 76, 68, 'RF', 'F', 'CAP DTH FIN', '');
P('Jasprit Bumrah', 'IND', 'BOWL', 'MI', 15, 20, 97, 97, 'RF', 'L', 'PP DTH', 'The best bowler on the planet');
P('Tilak Varma', 'IND', 'BAT', 'MI', 83, 84, 30, 40, 'OS', 'T', '', '');
P('Ryan Rickelton', 'SA', 'WK', 'MI', 79, 91, 0, 0, '', 'O', 'HIT', '38 sixes in just 12 games (2026)');
P('Quinton de Kock', 'SA', 'WK', 'MI', 78, 85, 0, 0, '', 'O', '', '');
P('Will Jacks', 'ENG', 'AR', 'MI', 78, 89, 58, 66, 'OS', 'T', '', '');
P('Trent Boult', 'NZ', 'BOWL', 'MI', 15, 20, 84, 76, 'LF', 'L', 'PP', 'First-over wicket specialist');
P('Deepak Chahar', 'IND', 'BOWL', 'MI', 35, 50, 76, 68, 'RM', 'L', 'PP', '');
P('Mitchell Santner', 'NZ', 'AR', 'MI', 55, 72, 80, 84, 'SLA', 'L', 'MID', '');
P('Allah Ghazanfar', 'AFG', 'BOWL', 'MI', 15, 20, 78, 72, 'OS', 'L', 'MID', '15 wkts in 11 (2026)');
P('Sherfane Rutherford', 'WI', 'BAT', 'MI', 70, 89, 0, 0, '', 'F', 'HIT', '');
P('Corbin Bosch', 'SA', 'AR', 'MI', 55, 74, 70, 66, 'RF', 'L', '', '');
P('Naman Dhir', 'IND', 'AR', 'MI', 66, 84, 45, 50, 'OS', 'M', 'UNC', '');
P('Shardul Thakur', 'IND', 'AR', 'MI', 45, 74, 70, 60, 'RM', 'L', '', 'Lord Shardul — golden arm');
P('Ashwani Kumar', 'IND', 'BOWL', 'MI', 15, 20, 70, 62, 'LF', 'L', 'UNC', '');
P('Mayank Markande', 'IND', 'BOWL', 'MI', 20, 30, 66, 66, 'LS', 'L', '', '');
P('Robin Minz', 'IND', 'WK', 'MI', 60, 84, 0, 0, '', 'F', 'UNC', '');

/* ---------------- Punjab Kings ---------------- */
P('Shreyas Iyer', 'IND', 'BAT', 'PBKS', 86, 87, 0, 0, '', 'T', 'CAP', '498 runs · Avg 55.3 · SR 169 (2026)');
P('Arshdeep Singh', 'IND', 'BOWL', 'PBKS', 20, 30, 88, 80, 'LF', 'L', 'PP DTH', "India's T20 wicket king");
P('Yuzvendra Chahal', 'IND', 'BOWL', 'PBKS', 15, 20, 82, 72, 'LS', 'L', 'MID', "IPL's all-time leading wicket-taker");
P('Prabhsimran Singh', 'IND', 'WK', 'PBKS', 78, 89, 0, 0, '', 'O', '', '510 runs · SR 169 (2026)');
P('Priyansh Arya', 'IND', 'BAT', 'PBKS', 74, 95, 0, 0, '', 'O', 'UNC HIT', '364 runs · SR 212 (2026)');
P('Marco Jansen', 'SA', 'AR', 'PBKS', 58, 82, 82, 72, 'LF', 'L', 'PP', '');
P('Marcus Stoinis', 'AUS', 'AR', 'PBKS', 74, 87, 64, 58, 'RM', 'F', 'FIN', '');
P('Shashank Singh', 'IND', 'BAT', 'PBKS', 72, 89, 0, 0, '', 'F', 'FIN UNC', '');
P('Nehal Wadhera', 'IND', 'BAT', 'PBKS', 72, 81, 0, 0, '', 'M', 'UNC', '');
P('Azmatullah Omarzai', 'AFG', 'AR', 'PBKS', 62, 80, 74, 68, 'RM', 'M', '', '');
P('Lockie Ferguson', 'NZ', 'BOWL', 'PBKS', 15, 25, 78, 68, 'RF', 'L', '', '');
P('Cooper Connolly', 'AUS', 'AR', 'PBKS', 77, 87, 55, 66, 'SLA', 'T', '', '491 runs · 107* (2026)');
P('Mitchell Owen', 'AUS', 'AR', 'PBKS', 68, 91, 50, 55, 'RM', 'O', 'HIT', '');
P('Harpreet Brar', 'IND', 'BOWL', 'PBKS', 35, 50, 72, 78, 'SLA', 'L', '', '');
P('Vyshak Vijaykumar', 'IND', 'BOWL', 'PBKS', 15, 20, 70, 62, 'RM', 'L', 'UNC DTH', '');
P('Xavier Bartlett', 'AUS', 'BOWL', 'PBKS', 25, 40, 76, 68, 'RF', 'L', 'PP', '');
P('Yash Thakur', 'IND', 'BOWL', 'PBKS', 15, 20, 68, 60, 'RM', 'L', 'UNC', '');
P('Ben Dwarshuis', 'AUS', 'BOWL', 'PBKS', 30, 50, 72, 66, 'LF', 'L', '', '');

/* ---------------- Rajasthan Royals ---------------- */
P('Vaibhav Sooryavanshi', 'IND', 'BAT', 'RR', 80, 97, 0, 0, '', 'O', 'HIT', '776 runs · SR 237 · 72 sixes — Orange Cap & MVP (2026)');
P('Yashasvi Jaiswal', 'IND', 'BAT', 'RR', 88, 90, 0, 0, '', 'O', '', '');
P('Riyan Parag', 'IND', 'AR', 'RR', 78, 87, 50, 60, 'OS', 'M', 'CAP', '');
P('Dhruv Jurel', 'IND', 'WK', 'RR', 77, 83, 0, 0, '', 'M', '', '515 runs · SR 155 (2026)');
P('Ravindra Jadeja', 'IND', 'AR', 'RR', 70, 76, 80, 84, 'SLA', 'F', '', 'Sir Jadeja');
P('Sam Curran', 'ENG', 'AR', 'RR', 66, 78, 76, 68, 'LF', 'M', 'DTH', '');
P('Jofra Archer', 'ENG', 'BOWL', 'RR', 25, 55, 88, 79, 'RF', 'L', 'PP DTH', '25 wkts (2026)');
P('Shimron Hetmyer', 'WI', 'BAT', 'RR', 74, 89, 0, 0, '', 'F', 'FIN', '');
P('Ravi Bishnoi', 'IND', 'BOWL', 'RR', 15, 20, 78, 74, 'LS', 'L', 'MID', '');
P('Sandeep Sharma', 'IND', 'BOWL', 'RR', 15, 20, 76, 76, 'RM', 'L', 'DTH', '');
P('Tushar Deshpande', 'IND', 'BOWL', 'RR', 15, 20, 70, 60, 'RM', 'L', '', '');
P('Nandre Burger', 'SA', 'BOWL', 'RR', 15, 20, 72, 64, 'LF', 'L', 'PP', '');
P('Kwena Maphaka', 'SA', 'BOWL', 'RR', 15, 20, 70, 60, 'LF', 'L', '', '');
P('Donovan Ferreira', 'SA', 'AR', 'RR', 66, 89, 45, 50, 'OS', 'F', '', '');
P('Lhuan-dre Pretorius', 'SA', 'WK', 'RR', 72, 87, 0, 0, '', 'O', '', '');
P('Adam Milne', 'NZ', 'BOWL', 'RR', 15, 25, 72, 62, 'RF', 'L', '', '');
P('Kuldeep Sen', 'IND', 'BOWL', 'RR', 15, 15, 66, 58, 'RF', 'L', '', '');
P('Shubham Dubey', 'IND', 'BAT', 'RR', 60, 85, 0, 0, '', 'F', 'UNC', '');
P('Yudhvir Singh Charak', 'IND', 'BOWL', 'RR', 30, 45, 64, 58, 'RM', 'L', 'UNC', '');
P('Vignesh Puthur', 'IND', 'BOWL', 'RR', 10, 10, 64, 62, 'LWS', 'L', 'UNC', '');

/* ---------------- Royal Challengers Bengaluru ---------------- */
P('Virat Kohli', 'IND', 'BAT', 'RCB', 93, 86, 0, 0, '', 'O', 'ANC', '675 runs · Avg 56.3 · 75* in the Final (POTM)');
P('Rajat Patidar', 'IND', 'BAT', 'RCB', 82, 92, 0, 0, '', 'M', 'CAP HIT', 'Back-to-back title-winning captain · SR 193');
P('Phil Salt', 'ENG', 'WK', 'RCB', 81, 95, 0, 0, '', 'O', 'HIT', '');
P('Josh Hazlewood', 'AUS', 'BOWL', 'RCB', 15, 20, 85, 79, 'RF', 'L', 'PP', '');
P('Bhuvneshwar Kumar', 'IND', 'BOWL', 'RCB', 30, 40, 88, 86, 'RM', 'L', 'PP DTH', '28 wkts @ 7.95 econ (2026)');
P('Krunal Pandya', 'IND', 'AR', 'RCB', 60, 74, 76, 80, 'SLA', 'M', 'MID', '14 wkts @ 8.41 (2026)');
P('Tim David', 'AUS', 'BAT', 'RCB', 72, 95, 0, 0, '', 'F', 'FIN HIT', '');
P('Jitesh Sharma', 'IND', 'WK', 'RCB', 68, 87, 0, 0, '', 'F', 'FIN', '');
P('Venkatesh Iyer', 'IND', 'AR', 'RCB', 72, 81, 30, 40, 'RM', 'T', '', '');
P('Devdutt Padikkal', 'IND', 'BAT', 'RCB', 76, 79, 0, 0, '', 'T', '', '');
P('Romario Shepherd', 'WI', 'AR', 'RCB', 58, 93, 64, 58, 'RF', 'F', 'HIT', '');
P('Jacob Bethell', 'ENG', 'AR', 'RCB', 74, 85, 58, 64, 'SLA', 'T', '', '');
P('Rasikh Dar', 'IND', 'BOWL', 'RCB', 20, 30, 77, 66, 'RM', 'L', 'DTH UNC', '19 wkts in 12 (2026)');
P('Yash Dayal', 'IND', 'BOWL', 'RCB', 15, 20, 74, 66, 'LF', 'L', 'UNC', '');
P('Suyash Sharma', 'IND', 'BOWL', 'RCB', 10, 10, 74, 74, 'LS', 'L', 'UNC', '');
P('Nuwan Thushara', 'SL', 'BOWL', 'RCB', 10, 10, 72, 64, 'RF', 'L', '', '');
P('Jacob Duffy', 'NZ', 'BOWL', 'RCB', 15, 20, 74, 70, 'RF', 'L', 'PP', '');
P('Jordan Cox', 'ENG', 'WK', 'RCB', 68, 87, 0, 0, '', 'M', '', '');
P('Swapnil Singh', 'IND', 'AR', 'RCB', 40, 60, 62, 68, 'SLA', 'L', 'UNC', '');

/* ---------------- Sunrisers Hyderabad ---------------- */
P('Abhishek Sharma', 'IND', 'BAT', 'SRH', 86, 98, 50, 60, 'SLA', 'O', 'HIT', '563 runs · SR 205 · 135* (2026)');
P('Travis Head', 'AUS', 'BAT', 'SRH', 87, 96, 30, 40, 'OS', 'O', 'HIT', 'Powerplay destroyer');
P('Heinrich Klaasen', 'SA', 'WK', 'SRH', 88, 94, 0, 0, '', 'M', 'HIT', '624 runs · SR 160 (2026)');
P('Ishan Kishan', 'IND', 'WK', 'SRH', 84, 90, 0, 0, '', 'T', '', '602 runs · SR 182 (2026)');
P('Pat Cummins', 'AUS', 'BOWL', 'SRH', 45, 74, 84, 74, 'RF', 'L', 'CAP PP', 'World Cup-winning captain');
P('Harshal Patel', 'IND', 'BOWL', 'SRH', 30, 45, 80, 66, 'RM', 'L', 'DTH', 'Slower-ball sorcerer');
P('Nitish Kumar Reddy', 'IND', 'AR', 'SRH', 70, 81, 64, 60, 'RM', 'M', '', '');
P('Eshan Malinga', 'SL', 'BOWL', 'SRH', 10, 10, 77, 68, 'RF', 'L', '', '20 wkts (2026)');
P('Liam Livingstone', 'ENG', 'AR', 'SRH', 74, 91, 55, 62, 'LS', 'M', 'HIT', '');
P('Kamindu Mendis', 'SL', 'AR', 'SRH', 72, 76, 52, 60, 'OS', 'M', '', 'Bowls with both arms');
P('Jaydev Unadkat', 'IND', 'BOWL', 'SRH', 20, 30, 70, 66, 'LF', 'L', '', '');
P('Brydon Carse', 'ENG', 'BOWL', 'SRH', 30, 55, 74, 64, 'RF', 'L', '', '');
P('Harsh Dubey', 'IND', 'AR', 'SRH', 40, 55, 68, 70, 'SLA', 'L', 'UNC', '');
P('Aniket Verma', 'IND', 'BAT', 'SRH', 66, 91, 0, 0, '', 'F', 'UNC HIT', '');
P('Sakib Hussain', 'IND', 'BOWL', 'SRH', 10, 10, 72, 62, 'RF', 'L', 'UNC', '15 wkts in 11 (2026)');
P('Zeeshan Ansari', 'IND', 'BOWL', 'SRH', 10, 10, 64, 64, 'LS', 'L', 'UNC', '');
P('Shivam Mavi', 'IND', 'BOWL', 'SRH', 20, 30, 66, 58, 'RF', 'L', '', '');
P('Jack Edwards', 'AUS', 'AR', 'SRH', 60, 80, 62, 60, 'RF', 'M', '', '');
P('Smaran Ravichandran', 'IND', 'BAT', 'SRH', 66, 77, 0, 0, '', 'M', 'UNC', '');

/* ---------------- Free agents (not in a 2026 squad — no RTM) ---------------- */
P('Devon Conway', 'NZ', 'BAT', '', 79, 78, 0, 0, '', 'O', 'ANC', '');
P('Daryl Mitchell', 'NZ', 'BAT', '', 79, 84, 40, 50, 'RM', 'M', '', '');
P('Jake Fraser-McGurk', 'AUS', 'BAT', '', 68, 94, 0, 0, '', 'O', 'HIT', '');
P('Rahmanullah Gurbaz', 'AFG', 'WK', '', 74, 88, 0, 0, '', 'O', '', '');
P('Jonny Bairstow', 'ENG', 'WK', '', 76, 86, 0, 0, '', 'O', '', '');
P('Gerald Coetzee', 'SA', 'BOWL', '', 30, 55, 74, 62, 'RF', 'L', '', '');
P('Spencer Johnson', 'AUS', 'BOWL', '', 20, 30, 72, 62, 'LF', 'L', '', '');
P('Fazalhaq Farooqi', 'AFG', 'BOWL', '', 10, 10, 73, 66, 'LF', 'L', 'PP', '');
P('Naveen-ul-Haq', 'AFG', 'BOWL', '', 20, 30, 74, 66, 'RM', 'L', 'DTH', '');
P('Mujeeb Ur Rahman', 'AFG', 'BOWL', '', 15, 20, 72, 76, 'OS', 'L', 'PP', '');
P('Mayank Agarwal', 'IND', 'BAT', '', 70, 78, 0, 0, '', 'O', '', '');

/* ---------------- Domestic pool (uncapped fringe) ---------------- */
U('Ramakrishna Ghosh', 'CSK', 'AR', 'RM', 'M', 62); U('Aman Khan', 'CSK', 'AR', 'RM', 'F', 60);
U('Madhav Tiwari', 'DC', 'AR', 'RM', 'L', 60); U('Tripurana Vijay', 'DC', 'AR', 'OS', 'L', 58);
U('Ajay Mandal', 'DC', 'AR', 'SLA', 'L', 59); U('Sahil Parakh', 'DC', 'BAT', '', 'T', 61);
U('Nishant Sindhu', 'GT', 'AR', 'SLA', 'M', 61); U('Ashok Sharma', 'GT', 'BOWL', 'RF', 'L', 63);
U('Prithvi Raj Yarra', 'GT', 'BOWL', 'LF', 'L', 60); U('Jayant Yadav', 'GT', 'AR', 'OS', 'L', 60, true);
U('Daksh Kamra', 'KKR', 'AR', 'LS', 'L', 58); U('Tejasvi Singh', 'KKR', 'WK', '', 'M', 60);
U('Prashant Solanki', 'KKR', 'BOWL', 'LS', 'L', 60); U('Sarthak Ranjan', 'KKR', 'BAT', '', 'T', 59);
U('Himmat Singh', 'LSG', 'BAT', '', 'M', 61); U('Akash Singh', 'LSG', 'BOWL', 'LF', 'L', 61);
U('Akshat Raghuwanshi', 'LSG', 'BAT', '', 'T', 60); U('Mukul Choudhary', 'LSG', 'WK', '', 'F', 60);
U('Naman Tiwari', 'LSG', 'BOWL', 'LF', 'L', 59);
U('Raghu Sharma', 'MI', 'BOWL', 'LS', 'L', 60); U('Atharva Ankolekar', 'MI', 'AR', 'SLA', 'L', 58);
U('Danish Malewar', 'MI', 'BAT', '', 'T', 61); U('Mayank Rawat', 'MI', 'AR', 'OS', 'M', 57);
U('Mohammad Izhar', 'MI', 'BOWL', 'RF', 'L', 57); U('Raj Angad Bawa', 'MI', 'AR', 'RM', 'M', 60);
U('Harnoor Singh Pannu', 'PBKS', 'BAT', '', 'T', 61); U('Pyla Avinash', 'PBKS', 'BAT', '', 'M', 60);
U('Musheer Khan', 'PBKS', 'AR', 'SLA', 'M', 61); U('Suryansh Shedge', 'PBKS', 'AR', 'RM', 'F', 60);
U('Vishnu Vinod', 'PBKS', 'WK', '', 'M', 60, true); U('Pravin Dubey', 'PBKS', 'BOWL', 'LS', 'L', 59, true);
U('Vishal Nishad', 'PBKS', 'BOWL', 'LS', 'L', 57);
U('Aman Rao', 'RR', 'BAT', '', 'T', 60); U('Sushant Mishra', 'RR', 'BOWL', 'LF', 'L', 59);
U('Yash Raj Punja', 'RR', 'BOWL', 'LS', 'L', 57); U('Brijesh Sharma', 'RR', 'BOWL', 'RM', 'L', 58);
U('Abhinandan Singh', 'RCB', 'BOWL', 'RF', 'L', 60); U('Satvik Deswal', 'RCB', 'AR', 'LS', 'L', 57);
U('Mangesh Yadav', 'RCB', 'BOWL', 'LF', 'L', 59); U('Vihaan Malhotra', 'RCB', 'BAT', '', 'T', 58);
U('Kanishk Chouhan', 'RCB', 'AR', 'OS', 'L', 58); U('Vicky Ostwal', 'RCB', 'BOWL', 'SLA', 'L', 59);
U('Shivang Kumar', 'SRH', 'AR', 'LWS', 'M', 58); U('Salil Arora', 'SRH', 'WK', '', 'M', 60);
U('Krains Fuletra', 'SRH', 'BOWL', 'SLA', 'L', 57); U('Onkar Tarmale', 'SRH', 'BOWL', 'RF', 'L', 57);
U('Amit Kumar', 'SRH', 'BOWL', 'LS', 'L', 57); U('Praful Hinge', 'SRH', 'BOWL', 'RF', 'L', 58);

/* ---------------- Derived fields ---------------- */
const SPIN_TYPES = new Set(['OS', 'LS', 'SLA', 'LWS']);
function batRating(p) { return p.bat * 0.66 + p.pow * 0.34; } // run-making + consistency first, strike rate second
function bowlRating(p) { return p.bowl * 0.6 + p.eco * 0.4; }

/* Curated OVR for the stars: the formula gives the base, but stature, big-match record,
   consistency over several seasons and current form (IPL 2026) decide the final number. */
const OVR_FIX = {
  // ---- batters / keepers ----
  'Virat Kohli': 94, 'Shubman Gill': 90, 'Abhishek Sharma': 90, 'Travis Head': 89, 'Suryakumar Yadav': 89,
  'Heinrich Klaasen': 89, 'Yashasvi Jaiswal': 88, 'KL Rahul': 88, 'Jos Buttler': 88, 'Sai Sudharsan': 88,
  'Nicholas Pooran': 87, 'Shreyas Iyer': 87, 'Sanju Samson': 86, 'Ishan Kishan': 86, 'Vaibhav Sooryavanshi': 85,
  'Phil Salt': 85, 'Rohit Sharma': 85, 'Rishabh Pant': 84, 'Rajat Patidar': 84, 'Ryan Rickelton': 83,
  'Tilak Varma': 83, 'Ruturaj Gaikwad': 82, 'Prabhsimran Singh': 82, 'Dewald Brevis': 82, 'Tristan Stubbs': 82,
  'Tim David': 80, 'Rinku Singh': 80, 'Josh Inglis': 80, 'Quinton de Kock': 80, 'Finn Allen': 79,
  'David Miller': 79, 'Jonny Bairstow': 79, 'Ben Duckett': 79, 'Pathum Nissanka': 79, 'Daryl Mitchell': 79,
  'Priyansh Arya': 78, 'Devon Conway': 78, 'Rahmanullah Gurbaz': 78, 'Jitesh Sharma': 78, 'Devdutt Padikkal': 78,
  'Nitish Rana': 75, 'Tom Banton': 75, 'Jake Fraser-McGurk': 74, 'MS Dhoni': 74, 'Sarfaraz Khan': 72,
  'Mayank Agarwal': 70, 'Prithvi Shaw': 68, 'Manish Pandey': 67,
  // ---- all-rounders ----
  'Sunil Narine': 89, 'Rashid Khan': 88, 'Hardik Pandya': 87, 'Axar Patel': 86, 'Mitchell Marsh': 85,
  'Ravindra Jadeja': 84, 'Cameron Green': 84, 'Jason Holder': 81, 'Will Jacks': 81, 'Marco Jansen': 81,
  'Washington Sundar': 80, 'Mitchell Santner': 80, 'Krunal Pandya': 79, 'Wanindu Hasaranga': 79,
  'Liam Livingstone': 79, 'Cooper Connolly': 78, 'Marcus Stoinis': 78, 'Venkatesh Iyer': 77,
  'Rahul Tewatia': 75, 'Romario Shepherd': 75, 'Shardul Thakur': 72,
  // ---- bowlers ----
  'Jasprit Bumrah': 95, 'Varun Chakravarthy': 88, 'Kagiso Rabada': 88, 'Arshdeep Singh': 87, 'Bhuvneshwar Kumar': 87,
  'Jofra Archer': 85, 'Josh Hazlewood': 85, 'Noor Ahmad': 84, 'Mitchell Starc': 84, 'Kuldeep Yadav': 83,
  'Pat Cummins': 82, 'Mohammed Siraj': 82, 'Prasidh Krishna': 81, 'Yuzvendra Chahal': 81, 'Trent Boult': 81,
  'Matheesha Pathirana': 79, 'Khaleel Ahmed': 78, 'Mustafizur Rahman': 77, 'Harshal Patel': 77, 'Lockie Ferguson': 77,
  'Harshit Rana': 77, 'Ravi Bishnoi': 77, 'Akeal Hosein': 76, 'Mohammed Shami': 76, 'Deepak Chahar': 76,
  'T Natarajan': 75, 'Avesh Khan': 74, 'Anrich Nortje': 74, 'Mayank Yadav': 74, 'Mukesh Kumar': 73,
  'Yash Dayal': 73, 'Vaibhav Arora': 73, 'Gerald Coetzee': 72,
};

/* Marquee players are chosen by stature, not only OVR (split into 2 sets). */
const MARQUEE = [
  'Jasprit Bumrah', 'Virat Kohli', 'Rohit Sharma', 'MS Dhoni', 'Shubman Gill', 'Suryakumar Yadav', 'Hardik Pandya', 'Rishabh Pant',
  'Abhishek Sharma', 'Yashasvi Jaiswal', 'KL Rahul', 'Shreyas Iyer', 'Travis Head', 'Heinrich Klaasen', 'Rashid Khan', 'Jos Buttler', 'Sunil Narine',
];
/* Brand value (lakhs): the minimum a franchise will happily pay for a fan-favourite, whatever the OVR. */
const BRAND = { 'MS Dhoni': 650, 'Rohit Sharma': 1200, 'Virat Kohli': 1800 };

function formulaOvr(p) {
  const br = batRating(p), bw = bowlRating(p);
  if (p.role === 'BAT') return br;
  if (p.role === 'WK') return br + 1;
  if (p.role === 'BOWL') return bw;
  return Math.max(br, bw, 0.7 * Math.max(br, bw) + 0.3 * Math.min(br, bw) + 6);
}

const PLAYERS = RAW.map((p0, i) => {
  const p = { ...p0 };
  let ovr = formulaOvr(p);
  const fix = OVR_FIX[p.name];
  if (fix) {
    // move the player's main skills too, so match performance agrees with the OVR
    const dl = (fix - ovr) / (p.role === 'AR' ? 0.7 : 1);
    const adj = v => Math.max(1, Math.min(99, Math.round(v + dl)));
    const batSide = p.role === 'BAT' || p.role === 'WK' || (p.role === 'AR' && batRating(p) >= bowlRating(p));
    if (batSide) { p.bat = adj(p.bat); p.pow = adj(p.pow); } else { p.bowl = adj(p.bowl); p.eco = adj(p.eco); }
    ovr = fix;
  }
  ovr = Math.min(99, Math.round(ovr));
  const br = batRating(p), bw = bowlRating(p);
  const unc = p.tags.includes('UNC');
  const spin = SPIN_TYPES.has(p.bt);
  let cat;
  if (p.role === 'WK') cat = 'WK';
  else if (p.role === 'BAT') cat = 'BAT';
  else if (p.role === 'AR') cat = 'AR';
  else cat = spin ? 'SPIN' : 'PACE';
  return { ...p, id: i, ovr, unc, ovs: p.c !== 'IND', spin, cat, batR: Math.round(br), bowlR: Math.round(bw), brand: BRAND[p.name] || 0 };
});

/* ---------------- Auction sets (as in the real IPL mega auction) ----------------
   M1, M2 = Marquee. Then cycles of capped BA (batters), AL (all-rounders), WK (keepers),
   FA (fast bowlers), SP (spinners), followed by the same roles for uncapped players (UBA, UAL…).
   Each set has one base price (lakhs), set by the strength of the set. */
const SET_CATS = [
  { cat: 'BAT', code: 'BA', label: 'Batters' },
  { cat: 'AR', code: 'AL', label: 'All-Rounders' },
  { cat: 'WK', code: 'WK', label: 'Wicketkeepers' },
  { cat: 'PACE', code: 'FA', label: 'Fast Bowlers' },
  { cat: 'SPIN', code: 'SP', label: 'Spinners' },
];
const SETS = [];
(() => {
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const chunk = (arr, n) => {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    if (out.length > 1 && out[out.length - 1].length < 4) { const last = out.pop(); out[out.length - 1].push(...last); }
    return out;
  };
  const cappedBase = o => o >= 85 ? 200 : o >= 81 ? 150 : o >= 77 ? 100 : o >= 73 ? 75 : 50;
  const median = ps => ps.map(p => p.ovr).sort((a, b) => a - b)[Math.floor(ps.length / 2)];
  const assign = (players, code, name, cat, unc, base) => {
    SETS.push({ code, name, cat, unc, base, n: players.length });
    players.forEach(p => { p.set = code; p.base = base; });
  };
  const marquee = shuffle(MARQUEE.map(n => PLAYERS.find(p => p.name === n)).filter(Boolean));
  const mset = new Set(marquee.map(p => p.id));
  const half = Math.ceil(marquee.length / 2);
  assign(marquee.slice(0, half), 'M1', 'Marquee Set 1', 'M', false, 200);
  assign(marquee.slice(half), 'M2', 'Marquee Set 2', 'M', false, 200);
  const split = unc => SET_CATS.map(c => chunk(PLAYERS.filter(p => !mset.has(p.id) && p.unc === unc && p.cat === c.cat).sort((a, b) => b.ovr - a.ovr), unc ? 10 : 8));
  const capped = split(false), uncapped = split(true);
  const rounds = Math.max(...capped.concat(uncapped).map(c => c.length));
  for (let r = 0; r < rounds; r++) {
    SET_CATS.forEach((c, i) => { const ps = capped[i][r]; if (ps) assign(ps, c.code + (r + 1), `${c.label} ${r + 1}`, c.cat, false, cappedBase(median(ps))); });
    SET_CATS.forEach((c, i) => { const ps = uncapped[i][r]; if (ps) assign(ps, 'U' + c.code + (r + 1), `Uncapped ${c.label} ${r + 1}`, c.cat, true, median(ps) >= 72 ? 40 : 30); });
  }
})();

if (typeof module !== 'undefined') module.exports = { TEAMS, PLAYERS, SETS, COUNTRY, BOWL_TYPE, TAG_INFO, SPIN_TYPES };
