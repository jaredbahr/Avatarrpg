// ---------- v13: Ba Dan inside the tutorial (tutorial-demo.html sets window.AREA = { mode: 'badan' | 'home', rec }).
// The real hub (story/act1.ts village_explore): the objective, Mira's, Gao's, Pella's and Dorin's talk nodes (kept short), the
// pella_asked flag (it parks Bo-shan's cabbage cart on the quarry floor three fights later), and the east road out. Sura and Bo
// walk Kaya's trail. 'home' is the walk home at the end: the party comes back in along the east road at dusk.
const TUTM = AREA && AREA.mode;
const tutFlags = {};
function tellShell(msg) { try { if (AREA && parent !== window) parent.postMessage(Object.assign({ from: 'badan' }, msg), '*'); } catch (e) { /* stand-alone */ } }
if (TUTM) {
  const L = id => RES.find(r => r.id === id);
  L('mira').lines = ['Come in. There is rice if you have not eaten. We need to talk about the quarry.',
    'No carts for a month. I sent four people to find out why. None came home.',
    'Dorin went as far as the gate yesterday. They have guards now. Would not let him through.',
    'I can offer you food and a bed here. I wish it were more. Will you look for our people?'];
  L('gao').lines = ['For the quarry? Water skins are by the door. Take one. You can pay me when everyone is home.',
    'The cutting is flooded in places. Mind your footing, especially if there is a fight.'];
  L('pella').lines = ["You're going to the quarry? I can show you the way. I know it. Mira keeps saying I'm too little.",
    'My brother took vegetables up before Mira sent the others. Bo-shan. That makes five missing.',
    "Look for the cart with cabbages piled above the seat. Tell him I'm not doing his chores again this week."];
  L('dorin').lines = ['East road, then the switchbacks. About two hours. Longer if the mud is bad.',
    'I got as far as the gate yesterday. There were workers up on the wall with slings. Would not answer me.'];
  if (TUTM === 'home') {
    L('mira').lines = ['Bo-shan came through the gate ahead of you. Pella has not let go of his sleeve.',
      'Bo-shan and all four messengers are home. I have counted everyone twice. They keep telling me to stop.',
      'You can stay as long as you need. Leave your washing by the door.'];
    kaya.x = 1120; kaya.y = 530; kaya.face = kaya.want = Math.PI;
  }
}
// the party: Sura and Bo follow Kaya's trail, 30 and 58 px behind her (never solid, so they never block her)
const party = [];
if (TUTM) {
  for (const [k, back] of [['sura', 30], ['bo', 58]]) {
    const a = new Actor(k, kaya.x - back, kaya.y - 2, TUTM === 'home' ? 'west' : 'east', WALK_SPEED * 1.08);
    a.def = { id: k, name: null, route: [], follow: back }; a.phase = rnd() * 1500; a.solid = false; party.push(a); people.push(a);
  }
}
const trailPts = [];
const updatePerson0 = updatePerson;
updatePerson = function (p, dt) {
  if (!p.def.follow) return updatePerson0(p, dt);
  let need = p.def.follow, at = null, px = kaya.x, py = kaya.y;   // walk back along the trail until 'need' px are used up
  for (const [x, y] of trailPts) { const d = Math.hypot(x - px, y - py); if (need <= d) { const t = need / d; at = [px + (x - px) * t, py + (y - py) * t]; break; } need -= d; px = x; py = y; }
  if (!at) at = trailPts.length ? trailPts[trailPts.length - 1] : [p.x, p.y];
  if (Math.hypot(at[0] - p.x, at[1] - p.y) > 3) { p.path = [at]; p.follow(dt); } else { p.path = []; p.drive(0, 0, dt); if (!kaya.moving) p.want = Math.atan2(kaya.y - p.y, kaya.x - p.x); }
};
// the objective line (story/act1.ts village_explore and its variant once Mira has been visited)
let objEl = null;
function setObjective(s) {
  if (!TUTM) return;
  if (!objEl) { objEl = document.createElement('div'); objEl.id = 'objective'; Object.assign(objEl.style, { position: 'fixed', left: '0.75rem', top: 'max(0.6rem, env(safe-area-inset-top))', maxWidth: 'min(26rem, 70vw)', font: 'bold 0.8rem/1.35 monospace', color: '#f6eed6', background: 'color-mix(in srgb, #1c1719 78%, transparent)', padding: '0.4rem 0.7rem', borderLeft: '0.2rem solid #d9a441', borderRadius: '0.2rem', pointerEvents: 'none' }); document.body.appendChild(objEl); }
  objEl.textContent = s; objEl.style.display = s ? '' : 'none';
}
// a talk node ends: Mira opens the road; Pella sets pella_asked
const advanceDialog0 = advanceDialog;
advanceDialog = function () {
  const who = dlg.who; advanceDialog0();
  if (TUTM && who && !dlg.open) {
    tutFlags['talked_' + who.def.id] = true;
    if (who.def.id === 'mira' && TUTM === 'badan') { tutFlags.metMira = true; setObjective('Take the east road to the quarry. You can speak with the neighbors before you leave.'); }
    if (who.def.id === 'mira' && TUTM === 'home') tellShell({ type: 'done' });
    if (who.def.id === 'pella') tutFlags.pella_asked = true;
  }
};
// the east road out: off the rim at the east edge. Before Mira, Kaya turns back with a nudge (the objective, not a wall)
let leaving = false, nudgeT = 0;
const update0 = update;
update = function (dt) {
  update0(dt);
  if (!TUTM) return;
  const last = trailPts[0];
  if (!last || Math.hypot(last[0] - kaya.x, last[1] - kaya.y) > 4) { trailPts.unshift([kaya.x, kaya.y]); if (trailPts.length > 60) trailPts.pop(); }
  if (nudgeT > 0) { nudgeT -= dt; if (nudgeT <= 0) setObjective(tutFlags.metMira ? 'Take the east road to the quarry.' : 'Talk to Elder Mira, then take the east road to the quarry.'); }
  if (TUTM === 'badan' && !leaving && kaya.x > 1150 && kaya.y > 470 && kaya.y < 600) {
    if (tutFlags.metMira) { leaving = true; tellShell({ type: 'exit', flags: Object.assign({}, tutFlags) }); }
    else { setObjective('Elder Mira is waiting for you in the square. Talk to her first.'); nudgeT = 2600; walkTo(1080, 530); }
  }
};
if (TUTM) {
  setObjective(TUTM === 'home' ? 'Home. Find Mira in the square.' : 'Talk to Elder Mira, then take the east road to the quarry.');
  window.__tut = { flags: () => Object.assign({}, tutFlags), leaving: () => leaving };
  const h = document.getElementById('hint'); if (h) h.style.display = 'none';
}

// dialogue portraits: the tutorial shell holds the images (PORTRAITS); a resident with one gets it on the right of the box (Kaya's on
// the left, in the shell). Hanru has none, so his box stays plain. Same box styling as the shell's.
if (TUTM) {
  const PORT_OF = { mira: 'mira', gao: 'gao', pella: 'pella', dorin: 'dorin' };
  const st = document.createElement('style');
  st.textContent = '#dlg.hasp { min-height: 7.25rem; padding-right: 7.1rem; } #dlg img { display: none; position: absolute; top: 0.75rem; right: 0.75rem; width: 5.25rem; height: 5.25rem; box-sizing: border-box; object-fit: cover; background: #e8d8b0; border: 0.1875rem solid #e8d8b0; outline: 0.125rem solid #1c1719; border-radius: 0.2rem; image-rendering: auto; } #dlg.hasp img { display: block; }';
  document.head.appendChild(st);
  const im = document.createElement('img'); im.alt = ''; dlgEl.insertBefore(im, dlgEl.firstChild);
  const renderDialog0 = renderDialog;
  renderDialog = function () {
    renderDialog0();
    let P = null; try { P = parent.PORTRAITS; } catch (e) { /* stand-alone */ }
    const k = dlg.who && PORT_OF[dlg.who.def.id];
    if (k && P && P[k]) { if (im.getAttribute('src') !== P[k]) im.src = P[k]; im.alt = dlg.who.def.name; dlgEl.classList.add('hasp'); }
    else { im.removeAttribute('src'); dlgEl.classList.remove('hasp'); }
  };
}
