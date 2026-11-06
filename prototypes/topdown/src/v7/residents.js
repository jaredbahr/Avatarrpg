// ---------- the people of Ba Dan (src/content/residents/baDan.ts and routines.ts, simplified to one daytime loop)
const kaya = new Actor('kaya', C2X(3) + 20, C2Y(8) - 4, 'east');          // the party spawn, (3,7)
kaya.solid = true;
// lines: the opening of each resident's real talk node (story/act1.ts, story/baDanDay.ts)
const RES = [
  { id: 'mira', name: 'Elder Mira', at: [C2X(12) + 4, C2Y(6) - 6], face: 'south', speed: 0,
    lines: ['Come in. There is rice if you have not eaten. We need to talk about the quarry.',
            'No carts for a month. I sent four people to find out why. None came home.'] },
  { id: 'gao', name: 'Gao the Shopkeeper', at: [C2X(9) + 20, C2Y(6) - 8], face: 'west', speed: 40,   // BD02 shopfront: display, lane, door, lane
    route: [[C2X(8) + 26, C2Y(6) - 8, 4000, 'west'], [C2X(9) + 20, C2Y(5) - 4, 5000, 'south'], [C2X(10) + 22, C2Y(4) + 14, 2500, 'north'], [C2X(9) + 20, C2Y(5) - 4, 6000, 'south']],
    lines: ['For the quarry? Water skins are by the door. Take one. You can pay me when everyone is home.',
            'The cutting is flooded in places. Mind your footing, especially if there is a fight.'] },
  { id: 'pella', name: 'Pella', at: [C2X(11) + 20, C2Y(13) - 6], face: 'south', speed: 44,           // BD04 court: plays between the planter, the notice and the well
    route: [[C2X(11) + 20, C2Y(13) - 6, 3000, 'south'], [C2X(10) + 24, C2Y(12) + 14, 2500, 'west'], [C2X(12) + 30, C2Y(12) + 26, 2500, 'east'], [C2X(12) + 8, C2Y(13) + 10, 2000, 'south']],
    lines: ['My brother took vegetables up before Mira sent the others. Bo-shan. That makes five missing. He was supposed to be back on Tuesday.',
            'Mira says “the missing people” every time. She could say his name. She knows his name.'] },
  { id: 'dorin', name: 'Gate Guard Dorin', at: [C2X(17) + 20, C2Y(7) - 6], face: 'south', speed: 54, // BD03 post on the road, then footing drill by the canal
    route: [[C2X(17) + 20, C2Y(7) - 6, 7000, 'south'], [C2X(3) + 24, C2Y(6) - 6, 9000, 'west']],
    lines: ['East road, then the switchbacks. About two hours. Longer if the mud is bad.',
            'Mira wants me here in case anyone makes it back. If you find someone who can walk, send them down. I will watch for them.'] },
  { id: 'hanru', name: 'Hanru', at: [C2X(16) + 16, C2Y(7) - 8], face: 'south', speed: 0,           // the handover spot (16,6)
    lines: ['I have the watch until dawn. Walk where you like. I only ask where people are going when they look lost.',
            'That lamp by the east road stays lit. If anyone comes down from the quarry in the dark, they will see it.'] },
  { id: 'household', name: null, at: [C2X(11) + 20, C2Y(15) - 6], face: 'south', speed: 40,          // bg.pella_household: a basket up to the square and back
    route: [[C2X(11) + 20, C2Y(15) - 6, 1500, 'south'], [C2X(1) + 30, C2Y(15) - 2, 1500, 'west'], [C2X(1) + 30, C2Y(9), 1500, 'north'],
            [C2X(9) + 20, C2Y(8) + 4, 1500, 'east'], [C2X(10) + 10, C2Y(5) + 12, 3500, 'north'], [C2X(9) + 20, C2Y(8) + 4, 1500, 'south'],
            [C2X(1) + 30, C2Y(9), 1500, 'west'], [C2X(1) + 30, C2Y(15) - 2, 1500, 'south']] },
];
const people = RES.map(r => {
  const a = new Actor(r.id, r.at[0], r.at[1], r.face, r.speed || WALK_SPEED); a.solid = true; a.def = r; a.leg = 0; a.hold = 1000 + rnd() * 2000; a.phase = rnd() * 1500;
  return a;
});
const cat = new Actor('cat', C2X(6), C2Y(15) + 2, 'east', 26); cat.cycle = 22; cat.fw = 10; cat.fh = 4;
const ACTORS = [kaya, ...people, cat];
const talkable = people.filter(p => p.def.lines);
function updatePerson(p, dt) {
  const r = p.def;
  if (p.talking) { p.drive(0, 0, dt); p.want = Math.atan2(kaya.y - p.y, kaya.x - p.x); return; }
  if (!r.route) { p.drive(0, 0, dt); p.want = angOf(r.face); return; }
  if (p.hold > 0) { p.hold -= dt; p.drive(0, 0, dt); if (p.faceTo) p.want = angOf(p.faceTo); return; }
  if (!p.path.length && !p.going) {
    p.leg = (p.leg + 1) % r.route.length; const [x, y] = r.route[p.leg];
    p.path = astar(p.x, p.y, x, y, p) || [[x, y]]; p.going = true;
    p.arrive = () => { const w = r.route[p.leg]; p.hold = w[2]; p.faceTo = w[3]; p.going = false; };
  }
  p.follow(dt);
  if (p.going && !p.path.length && !p.moving) { p.going = false; p.hold = 800; }   // blocked: wait, then try the next leg
}
// the cat pads along the south lawn and settles down between walks
const catRoute = [[C2X(6), C2Y(15) + 2], [C2X(10) + 10, C2Y(15) + 2]]; let catLeg = 1, catSit = 0, catSitT = 0;
function updateCat(dt) {
  if (catSit > 0) { catSit -= dt; catSitT += dt; cat.drive(0, 0, dt); return; }
  if (!cat.path.length) { cat.path = [catRoute[catLeg]]; cat.arrive = () => { catLeg = 1 - catLeg; catSit = 5200; catSitT = 0; }; }
  cat.follow(dt);
  const h = cat.heading; if (h !== 'east' && h !== 'west') cat.face = cat.vx >= 0 ? 0 : Math.PI;
}
