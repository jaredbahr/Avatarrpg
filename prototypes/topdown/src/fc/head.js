'use strict';
// Forest Road ambush: a look-and-feel test of combat in the Ba Dan top-down style. The board is the game's own
// FOREST_GROUND_ROWS (src/content/maps/combat.ts) with its props and the enc_forest_road spawns (encounters.ts);
// the rules are a demo's, not the game's.
const T = 32, CS = 40, GW = 20, GH = 12, GX = 80, GY = 128, PW = 960, PH = 680;
const DIRS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
const Q = new URLSearchParams(location.search);
const REC = Q.get('record') === '1', OVERVIEW = Q.get('overview') === '1';
let seed = 424242;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
const CELL = ASSETS.cell, AX = ASSETS.ax, AY = ASSETS.ay;
const ROWS = [
  'TTTT,,TTTTTTTT,TTTTT',
  'TT,,,,,TTT,,,,,,^^TT',
  'T,,,,,,,,,,,,,,^^^^A',
  ',,,,,,,r,,,,,,,,^^^^',
  '====================',
  ',====~~~====,,,,,,^^',
  ',,==~~~~====,,,,,,,^',
  ',,===~~=====,,,,,,,,',
  ',,================,,',
  ',,,,,,,,r,,,,,,,,,,,',
  'T,,,WW,,,,,,,,,T,,,T',
  'TTWWWWWTTTTTWWWWWTTT',
];
const at = (x, y) => (x < 0 || y < 0 || x >= GW || y >= GH ? '#' : ROWS[y][x]);
const cellX = x => GX + x * CS + CS / 2, cellY = y => GY + y * CS + CS - 9;   // a figure's feet in a cell
const IMG = {};
const load = (key, src) => new Promise(r => { const i = new Image(); i.onload = () => { IMG[key] = i; r(); }; i.src = src; });
const loads = [load('tiles', ASSETS.tiles.src)];
for (const [c, clips] of Object.entries(ASSETS.chars)) for (const [n, v] of Object.entries(clips)) loads.push(load(`ch:${c}:${n}`, v.src));
for (const [k, v] of Object.entries(ASSETS.objects)) loads.push(load('ob:' + k, v.src));
for (const [k, v] of Object.entries(ASSETS.moves.vfx)) { if (v.src) loads.push(load('fx:' + k, v.src)); else for (const [d, w] of Object.entries(v)) loads.push(load(`fx:${k}:${d}`, w.src)); }
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
