// ---------- the people of Ba Dan (src/content/residents/baDan.ts and routines.ts, simplified to one daytime loop)
const kaya = new Actor('kaya', 300, 532, 'east');          // the party spawn on the west road, (3,7)
kaya.solid = true;
// lines: the opening of each resident's real talk node (story/act1.ts, story/baDanDay.ts)
const RES = [
  { id: 'mira', name: 'Elder Mira', at: [612, 402], face: 'south', speed: 0,
    lines: ['Come in. There is rice if you have not eaten. We need to talk about the quarry.',
            'No carts for a month. I sent four people to find out why. None came home.'] },
  { id: 'gao', name: 'Gao the Shopkeeper', at: [460, 404], face: 'west', speed: 40,   // BD02 shopfront: display, lane, door step, lane
    route: [[460, 404, 4000, 'west'], [508, 362, 5000, 'south'], [448, 354, 2500, 'north'], [508, 362, 6000, 'south']],
    lines: ['For the quarry? Water skins are by the door. Take one. You can pay me when everyone is home.',
            'The cutting is flooded in places. Mind your footing, especially if there is a fight.'] },
  { id: 'pella', name: 'Pella', at: [560, 690], face: 'south', speed: 44,           // BD04: plays around the well in the court between the south houses
    route: [[560, 690, 3000, 'south'], [592, 700, 2500, 'east'], [578, 770, 2500, 'south'], [552, 662, 2000, 'west']],
    lines: ['My brother took vegetables up before Mira sent the others. Bo-shan. That makes five missing. He was supposed to be back on Tuesday.',
            'Mira says \u201cthe missing people\u201d every time. She could say his name. She knows his name.'] },
  { id: 'dorin', name: 'Gate Guard Dorin', at: [828, 478], face: 'south', speed: 54, // BD03 post, then footing drill at the dummy on the canal bank
    route: [[828, 478, 7000, 'south'], [192, 424, 9000, 'north']],
    lines: ['East road, then the switchbacks. About two hours. Longer if the mud is bad.',
            'Mira wants me here in case anyone makes it back. If you find someone who can walk, send them down. I will watch for them.'] },
  { id: 'hanru', name: 'Hanru', at: [786, 480], face: 'south', speed: 0,            // the handover spot (16,6)
    lines: ['I have the watch until dawn. Walk where you like. I only ask where people are going when they look lost.',
            'That lamp by the east road stays lit. If anyone comes down from the quarry in the dark, they will see it.'] },
  { id: 'household', name: null, at: [448, 834], face: 'south', speed: 40,           // bg.pella_household: a basket up to the square and back
    route: [[448, 834, 1500, 'south'], [222, 834, 1500, 'west'], [196, 640, 1500, 'north'], [300, 548, 1500, 'east'],
            [524, 372, 3500, 'north'], [508, 548, 1500, 'south'], [196, 640, 1500, 'west'], [222, 810, 1500, 'south']] },
];
const people = RES.map(r => {
  const a = new Actor(r.id, r.at[0], r.at[1], r.face, r.speed || WALK_SPEED); a.solid = true; a.def = r; a.leg = 0; a.hold = 1000 + rnd() * 2000; a.phase = rnd() * 1500;
  return a;
});
const cat = new Actor('cat', 200, 836, 'east', 26); cat.cycle = 22; cat.fw = 10; cat.fh = 4;
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
const catRoute = [[200, 836], [356, 836]]; let catLeg = 1, catSit = 0, catSitT = 0;
function updateCat(dt) {
  if (catSit > 0) { catSit -= dt; catSitT += dt; cat.drive(0, 0, dt); return; }
  if (!cat.path.length) { cat.path = [catRoute[catLeg]]; cat.arrive = () => { catLeg = 1 - catLeg; catSit = 5200; catSitT = 0; }; }
  cat.follow(dt);
  const h = cat.heading; if (h !== 'east' && h !== 'west') cat.face = cat.vx >= 0 ? 0 : Math.PI;
}
