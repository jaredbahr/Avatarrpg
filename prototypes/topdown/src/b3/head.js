'use strict';
// The board engine (v3): the Forest Road ambush and the tutorial's quarry boards, in the Ba Dan top-down style, on the
// game's real elemental rules (ported in rules.js). One engine, one level per page load: forest-combat.html runs 'forest';
// tutorial-demo.html loads the same document once per area with window.AREA = { level, variant, flags, rec }.
const AREA = window.AREA || null;
const Q = new URLSearchParams(location.search);
const LEVEL_KEY = (AREA && AREA.level) || Q.get('level') || 'forest';
const LV = LEVELS[LEVEL_KEY];
const FLAGS = (AREA && AREA.flags) || {};
const REC = AREA ? !!AREA.rec : Q.get('record') === '1', OVERVIEW = Q.get('overview') === '1';
const T = 32, CS = 40, GW = 20, GH = 12, GX = 80, GY = 128, PW = 960, PH = 680;
const DIRS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];
let seed = 424242;
const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
const CELL = ASSETS.cell, AX = ASSETS.ax, AY = ASSETS.ay;
const ROWS = LV.rows;
const at = (x, y) => (x < 0 || y < 0 || x >= GW || y >= GH ? '#' : ROWS[y][x]);
const LEG = c => LEGEND[c] || LEGEND['.'];
const elevAt = (x, y) => (x < 0 || y < 0 || x >= GW || y >= GH ? 2 : LV.ground === 'forest' ? 0 : LEG(ROWS[y][x]).elev || 0);
const cellX = x => GX + x * CS + CS / 2, cellY = y => GY + y * CS + CS - 9;   // a figure's feet in a cell
const IMG = {};
const load = (key, src) => new Promise(r => { const i = new Image(); i.onload = () => { IMG[key] = i; r(); }; i.src = src; });
const loads = [load('tiles', ASSETS.tiles.src)];
if (ASSETS.qtiles) for (const [k, v] of Object.entries(ASSETS.qtiles)) loads.push(load('q:' + k, v));
for (const [c, clips] of Object.entries(ASSETS.chars)) for (const [n, v] of Object.entries(clips)) loads.push(load(`ch:${c}:${n}`, v.src));
for (const [k, v] of Object.entries(ASSETS.objects)) loads.push(load('ob:' + k, v.src));
for (const [k, v] of Object.entries(ASSETS.moves.vfx)) { if (v.src) loads.push(load('fx:' + k, v.src)); else for (const [d, w] of Object.entries(v)) loads.push(load(`fx:${k}:${d}`, w.src)); }
for (const [k, v] of Object.entries(ASSETS.vfx13 || {})) loads.push(load('vx:' + k, v.src));
for (const [k, v] of Object.entries(ASSETS.driller || {})) for (const [d, w] of Object.entries(v)) loads.push(load(`dr:${k}:${d}`, w.src));
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
const hash2 = (x, y, k) => { let t = (x * 374761393 + y * 668265263 + k * 1442695041) >>> 0; t = Math.imul(t ^ (t >>> 13), 1274126177) >>> 0; return ((t ^ (t >>> 16)) & 0xffff) / 65535; };
function vnoise(x, y, k, p = 2.6) {
  const fx = x / p, fy = y / p, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = hash2(ix, iy, k), b = hash2(ix + 1, iy, k), c = hash2(ix, iy + 1, k), d = hash2(ix + 1, iy + 1, k);
  return ((a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy) * 2 - 1;
}
// tell the tutorial shell (tutorial-demo.html) what happened; a stand-alone page ignores it
function tellShell(msg) { try { if (AREA && parent !== window) parent.postMessage(Object.assign({ from: 'board', level: LEVEL_KEY }, msg), '*'); } catch (e) { /* stand-alone */ } }
