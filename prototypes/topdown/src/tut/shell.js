'use strict';
// The tutorial, Ba Dan to the Driller, as one page. The story is the game's own (story/act1.ts, encounters.ts), kept short:
// each area is a whole page (Ba Dan v13, or the board engine with one level) loaded into the iframe by srcdoc, so it shares this
// page's origin; it tells this page when it is done (postMessage). Between areas: a fade, the area's name, and the talk nodes.
// ?auto=1 plays itself; ?record=1 also steps every clock from outside (window.__adv), for frame-exact video.
const Q = new URLSearchParams(location.search);
const REC = Q.get('record') === '1', AUTO = REC || Q.get('auto') === '1';
const ROUTE = { gate: Q.get('gate') || 'knock', ruon: Q.get('ruon') || 'escort' };   // the choices the self-playing run makes
const $ = id => document.getElementById(id);
let clock = 0; const timers = [], tweens = [];
const wait = ms => new Promise(r => timers.push({ t: clock + ms, r }));
const op = { fade: 1, title: 0, tint: 0 };
function tween(k, to, ms) { return new Promise(r => tweens.push({ k, from: op[k], to, ms, t: 0, r })); }
let typing = null;
function tick(dt) {
  clock += dt;
  for (let i = timers.length - 1; i >= 0; i--) if (clock >= timers[i].t) { const r = timers[i].r; timers.splice(i, 1); r(); }
  for (let i = tweens.length - 1; i >= 0; i--) { const w = tweens[i]; w.t += dt; const k = Math.min(1, w.t / w.ms); op[w.k] = w.from + (w.to - w.from) * k; if (k >= 1) { tweens.splice(i, 1); w.r(); } }
  $('fade').style.opacity = op.fade.toFixed(3); $('title').style.opacity = op.title.toFixed(3); $('tint').style.opacity = op.tint.toFixed(3);
  if (typing) { typing.n = Math.min(typing.s.length, typing.n + dt * 0.05); $('dlg').querySelector('span').textContent = typing.s.slice(0, Math.floor(typing.n)); }
}
const frame = () => $('area').contentWindow;
window.__shell = { phase: 'start', speed: 1, done: false }; window.__errs = [];
if (REC) window.__adv = ms => { tick(ms); const w = frame(); if (w && w.__adv && w.__ready) w.__adv(ms); };
else { let last = 0; const loop = now => { const dt = last ? Math.min(50, now - last) : 16; last = now; tick(dt); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
// ---------- input: a tap anywhere advances the talk (a transparent catcher sits over the area while a box is up)
let tapR = null;
const catcher = document.createElement('div'); Object.assign(catcher.style, { position: 'fixed', inset: '0', display: 'none' }); document.body.insertBefore(catcher, $('dlg'));
const onTap = e => { e.preventDefault(); if (typing && typing.n < typing.s.length) { typing.n = typing.s.length; return; } if (tapR) { const r = tapR; tapR = null; r(); } };
catcher.addEventListener('pointerdown', onTap); $('dlg').addEventListener('pointerdown', onTap);
addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'e') onTap(e); });
// ---------- the pieces of a scene
// speaker -> portrait id (the shipped game's manifest: portrait.kaya, .ruon, .jin ...). The narrator has none, and neither does anyone
// not listed (no portrait is invented). The party sits on the left of the box, everyone else on the right.
const PORTRAIT_OF = { 'Kaya': ['kaya', 'left'], 'Captain Ruon': ['ruon', 'right'], 'Jin': ['jin', 'right'] };
function setPortrait(speaker) {
  const d = $('dlg'), im = d.querySelector('img'), po = PORTRAIT_OF[speaker];
  if (po && typeof PORTRAITS !== 'undefined' && PORTRAITS[po[0]]) { im.src = PORTRAITS[po[0]]; im.alt = speaker; d.className = 'hasp ' + po[1]; }
  else { im.removeAttribute('src'); d.className = ''; }
}
async function say(speaker, lines) {
  setPortrait(speaker); $('dlg').querySelector('span').textContent = '';
  $('dlg').style.display = 'block'; catcher.style.display = 'block'; $('dlg').querySelector('b').textContent = speaker;
  for (const s of lines) {
    typing = { s, n: 0 };
    if (AUTO) { await wait(s.length * 20 + 400); typing.n = s.length; await wait(350 + s.length * 10); }   // leftovers: the self-playing run reads a little faster (was +700 / 1200+22/char)
    else { await new Promise(r => { tapR = r; }); }
  }
  typing = null; $('dlg').style.display = 'none'; catcher.style.display = 'none';
}
async function choose(prompt, options, footer, autoPick) {
  const box = $('choice'); box.innerHTML = ''; const p = document.createElement('p'); p.textContent = prompt; box.appendChild(p);
  catcher.style.display = 'block';
  let pickR; const picked = new Promise(r => { pickR = r; });
  options.forEach((o, i) => {
    const b = document.createElement('button'); b.innerHTML = `${o.label}<small>${o.locked ? o.hint : o.detail}</small>`; b.disabled = !!o.locked;
    b.addEventListener('pointerdown', e => { e.preventDefault(); if (!AUTO) pickR(i); }); box.appendChild(b);
  });
  if (footer) { const f = document.createElement('div'); f.className = 'foot'; f.textContent = footer; box.appendChild(f); }
  box.style.display = 'block';
  if (AUTO) { await wait(2600); box.children[1 + autoPick].classList.add('pick'); await wait(900); pickR(autoPick); }
  const i = await picked; box.style.display = 'none'; catcher.style.display = 'none'; return i;
}
async function title(name, sub, ms = 2200) {
  $('title').innerHTML = `${name}${sub ? `<small>${sub}</small>` : ''}`;
  await tween('title', 1, 350); await wait(ms); await tween('title', 0, 350);   // leftovers: the fight cards hold 1.1 s (was 1.6), fades 350 ms (was 500)
}
async function card(head, lines, teaser, small) {
  const c = $('card'); c.innerHTML = `<h1>${head}</h1>` + lines.map(l => `<p>${l}</p>`).join('') + (teaser ? `<p class="teaser">${teaser}</p>` : '') + (small ? `<p class="small">${small}</p>` : '');
  c.style.display = 'flex';
}
// ---------- areas: each a whole page in the iframe
const msgs = [];
addEventListener('message', e => { const m = e.data; if (m && (m.from === 'board' || m.from === 'badan')) msgs.push(m); });
async function until(f, step = 50) { while (!f()) await wait(step); }
async function waitMsg(type) { let m; await until(() => (m = msgs.find(x => x.type === type)) != null); msgs.splice(msgs.indexOf(m), 1); return m; }
async function loadArea(kind, cfg) {
  msgs.length = 0;
  const f = $('area'), doc = DOCS[kind].replace('<head>', '<head><script>window.AREA=' + JSON.stringify(Object.assign({ rec: REC }, cfg)) + ';window.onerror=(m,s,l)=>{try{parent.__errs.push(m+" @"+l)}catch(e){}};<\/script>');
  let loaded = false; f.onload = () => { loaded = true; }; f.srcdoc = doc;
  await until(() => loaded);
  await until(() => { try { return frame().__ready || frame().AREA_API || (kind === 'badan' && frame().__tut && !REC); } catch (e) { return false; } });
  try { frame().focus(); } catch (e) { /* fine */ }
  if (REC && kind === 'board' && frame().__zoom) frame().__zoom(cfg.level === 'forest' || cfg.level === 'floor' ? 3 : 2);   // close-ups on the fire and the Driller
  if (REC && kind === 'badan' && frame().__g) frame().__g.zoom(3);
  return frame();
}
const fadeIn = () => tween('fade', 0, 700), fadeOut = () => tween('fade', 1, 700);
async function fight(level, opts = {}) {
  window.__shell.phase = 'fight-intro';
  let w = await loadArea('board', Object.assign({ level, hold: true }, opts)); await fadeIn();
  await title(LEVEL_NAMES[level][0], LEVEL_NAMES[level][1], 1100);
  if (opts.before) { const nv = await opts.before(); if (nv && nv !== opts.variant) { await fadeOut(); w = await loadArea('board', Object.assign({ level, hold: true }, opts, { variant: nv })); await fadeIn(); } }
  window.__shell.phase = 'fight';
  if (REC) w.__auto(); else w.AREA_API.start({ auto: AUTO });
  const m = await waitMsg('done'); window.__shell.phase = 'after';
  return m.result;
}
const LEVEL_NAMES = { forest: ['The Forest Road', 'Ambush'], road: ['The Switchbacks', 'The road up to the quarry'], gate: ['The Quarry Gate', ''], cutting: ['The Cutting', ''], floor: ['The Quarry Floor', 'Grumbler'] };
// ---------- Ba Dan's autopilot (record mode only): Mira, then Pella, then the east road
async function badanAuto(w) {
  const g = w.__g, talk = async id => {
    g.talkTo(id); await until(() => g.state().dlg, 100);
    while (g.state().dlg) { await wait(2600); g.advance(); await wait(60); if (g.state().dlg) g.advance(); }
  };
  window.__shell.phase = 'walk'; await wait(900); await talk('mira'); await wait(400);
  window.__shell.phase = 'walk'; await talk('pella'); await wait(300);
  window.__shell.phase = 'walk'; g.walkTo(1196, 528);
}
// ---------- the story
const flags = {};
async function walkHome() {
  // the walk home: Ba Dan at dusk, the party in along the east road to Mira
  const w = await loadArea('badan', { mode: 'home' }); op.tint = +(Q.get('tint') || 0); await fadeIn();   // leftovers: the dusk is graded inside Ba Dan itself now, so the dialogue box is not tinted
  await title('Home', 'Ba Dan, at dusk', 1300);
  window.__shell.phase = 'walk';
  if (REC) { const g = w.__g; g.talkTo('mira'); await until(() => g.state().dlg, 100); while (g.state().dlg) { await wait(2800); g.advance(); await wait(60); if (g.state().dlg) g.advance(); } }
  else await waitMsg('done');
  await wait(800); await fadeOut();
  await card('The Quarry of Ba Dan', ['Bo-shan and all four messengers are home.'], 'Across the bay, lamps burn in a Fire Nation outpost closed nine years ago. A supply boat ties up at its jetty.', 'End of the tutorial demo. Four Nations Tactics is a non-commercial fan work with original characters.');
  window.__shell.phase = 'end'; window.__shell.done = true;
}
async function story() {
  await wait(400);
  if (Q.get('start') === 'home') { window.__shell.phase = 'talk'; await walkHome(); return; }   // test hook: straight to the walk home
  await card('Ba Dan to the Driller', ['A playable demo of the Four Nations Tactics tutorial, in the top-down PixelLab style.'], null, 'A non-commercial fan work with original characters.');
  await wait(AUTO ? 2000 : 1800); $('card').style.display = 'none';
  window.__shell.phase = 'talk';
  await say('Ba Dan', ['Ba Dan lies below a limestone quarry, its houses built from the same pale stone as the hill.',
    'The cart has not come for a month. Elder Mira has asked you to find out why her messengers have not come home.']);
  // Ba Dan: explore and talk, leave by the east road
  let w = await loadArea('badan', { mode: 'badan' }); await fadeIn(); await title('Ba Dan', 'Talk to Elder Mira, then take the east road', 1400);
  window.__shell.phase = 'walk'; if (REC) badanAuto(w);
  const ex = await waitMsg('exit'); Object.assign(flags, ex.flags || {});
  await fadeOut();
  window.__shell.phase = 'talk';
  await say('The East Road', ['The road climbs between the pines. Rainwater fills the wheel ruts, and wet needles cling to your boots.',
    'At the bend, a boot scrapes on stone. Someone is standing behind the trees.']);
  // the Forest Road ambush
  let r = await fight('forest', { flags });
  if (r === 'defeat') await say('Ba Dan', ['You wake beside the road with grit in your mouth. Your food is gone.', 'Their tracks lead uphill, towards the quarry.']);
  window.__shell.phase = 'talk';
  await say('Kaya', ['Quarry dust in their cuffs. My mother used to make the stonecutters shake it out before they came inside.',
    'I thought we were going up there to get these people home. Why are they guarding the road?']);
  await fadeOut();
  // the road to the quarry: a short walk up the switchbacks
  w = await loadArea('board', { level: 'road', flags }); await fadeIn(); await title(...LEVEL_NAMES.road, 1100);
  window.__shell.phase = 'walk'; if (REC) w.__auto(); else w.AREA_API.start({ auto: AUTO });
  await waitMsg('exit'); await fadeOut();
  // the gate: the parley (the speaker choice), then the fight or the talk
  let variant = 'base', talked = false;
  r = await fight('gate', { flags, variant: ROUTE.gate === 'bluff' ? 'bluffed' : 'base', before: async () => {
    window.__shell.phase = 'talk';
    const i = await choose('Quarry workers watch from the wall. A Fire Nation deserter stands beside the oil barrels. How will you approach?', [
      { label: 'Walk up and knock', detail: 'Approach openly. The guards are armed and will fight.' },
      { label: 'Let the firebender do the talking', detail: 'Bluff the deserter into standing aside. You will still have to fight the quarry crew.' },
      { label: 'Let the earthbender speak: these are quarry workers', detail: 'Ask about the unsafe galleries. An earthbender may get Ruon to open the gate without a fight.' },
    ], null, ({ knock: 0, bluff: 1, kin: 2 })[ROUTE.gate] ?? 0);
    if (i === 1) return 'bluffed';
    if (i === 0) return 'base';
    if (i === 2) { talked = true; await say('Captain Ruon', ['Hold on. You know the galleries? The supports under the east face?', 'I told my quartermaster those needed replacing. He sent the crew back in anyway.', 'All right. Lower the slings. Open the gate.']); throw 'talked'; }
  } }).catch(e => { if (e === 'talked') return 'talked'; throw e; });
  if (r === 'defeat') await say('The Quarry Gate', ['You retreat down the switchbacks under a hail of stones.', 'When you climb back, the gate stands open. Captain Ruon waits in the yard.']);
  window.__shell.phase = 'talk';
  await say('Captain Ruon', ['My sabre stays on the ground. Tell me if anyone needs a bandage.',
    'The crews stopped getting paid. Then our wages stopped too. My quartermaster said holding the stone would make somebody listen.',
    'Jin’s mercenaries keep the inner gate. Jin holds a provincial bounty on me, and she will pay whoever hands me over.']);
  const rc = await choose('Ruon has surrendered. What happens to him?', [
    { label: 'Escort him back to Ba Dan for trial', detail: 'Keep Ruon with you to face the village court. Jin’s mercenaries will try to take him on the road.' },
    { label: 'Trade him to Jin for the quarry key', detail: 'Accept Jin’s payment and the inner gate key. Her crew will let you pass the cutting, but Gao will hear about the trade.' },
  ], 'Both routes reach the quarry floor.', ROUTE.ruon === 'trade' ? 1 : 0);
  if (rc === 0) {
    flags.ruon_spared = true;
    await say('Captain Ruon', ['Ba Dan, then, once the galleries are open.', "Jin will not let her bounty walk down the hill. She'll send people after us.", "If they catch us in the cutting, I'll need my sabre. You can take it back afterwards."]);
    await fadeOut();
    r = await fight('cutting', { flags });
    if (r === 'defeat') await say('The Cutting', ['The mercenaries block the road. Ruon points to a gap in the rocks and pulls you towards it.', 'You lose the pursuers below the cutting.']);
    window.__shell.phase = 'talk';
    await say('Captain Ruon', ['We cannot stay on the road. There is a path through the cutting to the quarry floor.',
      'My quartermaster will be down there. The crews call him Grumbler. He could find something wrong with a day off.',
      'He got hold of a mecha-driller last month. I signed for the delivery without asking who paid for it.']);
  } else {
    flags.ruon_traded = true;
    await say('Jin', ['The inner gate key, as agreed. Your payment is in the pouch.', 'Captain. Hands where I can see them.',
      'My crew is in the quarry securing the equipment. The key gets you through the gate. It does not give you a claim on the machinery.']);
  }
  await fadeOut();
  // the quarry floor: the descent, then Grumbler in the driller
  r = await fight('floor', { flags, variant: flags.ruon_traded ? 'jins_people' : 'base', before: async () => {
    window.__shell.phase = 'talk';
    await say('The Quarry', ['Stone ledges step down to the quarry floor. Below them, the gallery entrances have been barred with timber.',
      'A mecha-driller idles beside the lowest ramp, its cabin shaking between two broad treads.',
      'Oil drips from a split hose. The driver sees you and reaches for a lever.']);
  } });
  await fadeOut();
  if (r === 'defeat') {
    await say('The Quarry', ['The driller blocks the ramp. You scramble up the loose stone beside it while the drill tears into the slope.', 'Mira finds you there with Dorin and a handcart. “Sit down,” she says. “We can talk at home.”']);
    await card('The Quarry Keeps Running', ['Stone carts leave the quarry again. At the fork, each one takes the coast road past Ba Dan.', 'The driller is still down there. Its parts came from Republic City; someone paid to bring them all this way.'], 'Across the bay, lamps burn in a Fire Nation outpost closed nine years ago. A supply boat ties up at its jetty.');
    window.__shell.done = true; return;
  }
  window.__shell.phase = 'talk';
  await card('The Quarry of Ba Dan', ['The drill jams in the quarry floor. Grumbler tries the lever twice, then climbs out with his hands raised.',
    'You pull the bars from the gallery doors. Mira’s four messengers are there. Bo-shan follows them out and asks where Pella is.',
    'The workers help each other up the ramp and start down the west road. It is time to take the news home to Ba Dan.']);
  await wait(AUTO ? 5500 : 9000); $('card').style.display = 'none';   // the card stands on the dark (the board stays faded out)
  await walkHome();
}
story();
