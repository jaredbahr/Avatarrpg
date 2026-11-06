# Executed inside build3.py after the atlases are written (shares its names: A, AX, AY, CELL, D8, uri, out, Image, json).
# Measures what the motion layer needs from the anchored atlases, and packs the VFX per direction.
import math as _m

_K = A / 'chars' / 'kaya2'
_meta = out['chars']['kaya']
# 1. part bands, rows relative to the foot line (y = AY); authored once from the rotations (see README)
BANDS = {'head': -28, 'torso': -19, 'hem': -8}       # head: top..-28, torso -28..-19, hem -19..-8, legs -8..foot
# 2. ponytail columns: the back 35% of the head band, on the side views and the front diagonals only
rot = Image.open(_K / 'rot_atlas.png')
tail = {}
for d, side in [('east', -1), ('south-east', -1), ('west', 1), ('south-west', 1)]:
    r = _meta['rot']['dirs'].index(d)
    band = rot.crop((0, r * CELL, CELL, r * CELL + AY + BANDS['head']))
    x0, _, x1, _ = band.getbbox(); w = x1 - x0
    tail[d] = {'side': side, 'x': round(x0 + 0.35 * w) if side < 0 else round(x1 - 0.35 * w)}
# 3. walk contact phase: the frame where the feet are furthest apart, fitted on the two side views
walk = Image.open(_K / 'walk_atlas.png')
def _spread(row, f):
    c = walk.crop((f * CELL, row * CELL, (f + 1) * CELL, (row + 1) * CELL)); a = c.split()[3]
    xs = [x for y in range(AY - 4, AY) for x in range(CELL) if a.getpixel((x, y)) > 128]
    return (max(xs) - min(xs)) if xs else 0
_NW = _meta['walk']['frames']   # v3-era phase fit; unused since v4, kept working for 8-frame walks
sp = [0.0] * _NW
for d in ('east', 'west'):
    r = _meta['walk']['dirs'].index(d)
    for f in range(_NW): sp[f] += _spread(r, f)
spread_phase = max(range(6), key=lambda p: sum(sp[f] * _m.cos(2 * _m.pi * (f - p) / 6) for f in range(_NW)))
# the spread signal is weak (9-12 px), so the phase is fitted to PixelLab's own head dip instead (lowest head = contact),
# which also makes the added bob reinforce the drawn one rather than fight it
tops = [0.0] * _NW
for d in ('east', 'west', 'south-east', 'south-west'):
    r = _meta['walk']['dirs'].index(d)
    for f in range(_NW): tops[f] += walk.crop((f * CELL, r * CELL, (f + 1) * CELL, (r + 1) * CELL)).getbbox()[1]
best = max([i / 2 for i in range(12)], key=lambda p: sum(tops[f] * _m.cos(2 * _m.pi * (f - p) / 6) for f in range(_NW)))
# 4. Fire Jab: strike frame = the east frame reaching furthest forward; fist = furthest pixel along the heading there
jab = Image.open(_K / 'jab_atlas.png'); jr = _meta['jab']['dirs']
def _reach(row, f, ux, uy, rows=None):
    c = jab.crop((f * CELL, row * CELL, (f + 1) * CELL, (row + 1) * CELL)); a = c.split()[3]; bestv, bp = -1e9, None
    for y in range(rows[0] if rows else 0, rows[1] if rows else CELL):
        for x in range(CELL):
            if a.getpixel((x, y)) > 128:
                v = (x - AX) * ux + (y - (AY - 22)) * uy
                if v > bestv: bestv, bp = v, (x - AX, y - AY)
    return bestv, bp
er = jr.index('east')
strike = max(range(_meta['jab']['frames']), key=lambda f: _reach(er, f, 1, 0)[0])
VEC = {'east': (1, 0), 'south-east': (0.7071, 0.7071), 'south': (0, 1), 'south-west': (-0.7071, 0.7071), 'west': (-1, 0),
       'north-west': (-0.7071, -0.7071), 'north': (0, -1), 'north-east': (0.7071, -0.7071)}
fist = {}
for d in D8:
    ux, uy = VEC[d]
    # only the arm's height band counts, so the head never reads as the fist on the north view
    _, p = _reach(jr.index(d), strike, ux, uy, rows=(AY - 30, AY - 14))
    # PixelLab painted a flame on the fist: its bright yellow pixels are the most reliable fist marker
    c = jab.crop((strike * CELL, jr.index(d) * CELL, (strike + 1) * CELL, (jr.index(d) + 1) * CELL)).convert('RGBA'); pxs = c.load()
    hot = [(x, y) for y in range(CELL) for x in range(CELL) if pxs[x, y][3] > 128 and pxs[x, y][0] > 200 and pxs[x, y][1] > 140 and pxs[x, y][2] < 120]
    if len(hot) >= 3: p = (round(sum(x for x, _ in hot) / len(hot)) - AX, round(sum(y for _, y in hot) / len(hot)) - AY); src = 'flame'
    else: src = 'reach'
    fist[d] = p; fist_src = fist_src if 'fist_src' in dir() else {}; fist_src[d] = src
# 5. VFX strips, turned per heading with exact 90-degree turns and flips only (no resampling)
def _strip(name):
    mm = json.load(open(A / 'vfx' / f'{name}.json')); sh = Image.open(A / 'vfx' / f'{name}.png').convert('RGBA')
    fr = [sh.crop((f['frame']['x'], f['frame']['y'], f['frame']['x'] + f['frame']['w'], f['frame']['y'] + f['frame']['h'])) for f in mm['frames']]
    pv = mm['frames'][0]['pivot']; w, h = fr[0].size
    return fr, (round(pv['x'] * w), round(pv['y'] * h)), [f['duration'] for f in mm['frames']]
def _turn(frames, pivot, how):
    w, h = frames[0].size; px, py = pivot
    if how == 'id': return frames, pivot
    if how == 'fh': return [f.transpose(Image.FLIP_LEFT_RIGHT) for f in frames], (w - 1 - px, py)
    if how == 'fv': return [f.transpose(Image.FLIP_TOP_BOTTOM) for f in frames], (px, h - 1 - py)
    if how == 'fhv': return [f.transpose(Image.ROTATE_180) for f in frames], (w - 1 - px, h - 1 - py)
    if how == 'cw': return [f.transpose(Image.ROTATE_270) for f in frames], (h - 1 - py, px)     # right -> down
    if how == 'ccw': return [f.transpose(Image.ROTATE_90) for f in frames], (py, w - 1 - px)     # right -> up
def _pack(frames, pivot, durs):
    w, h = frames[0].size; s = Image.new('RGBA', (w * len(frames), h))
    for i, f in enumerate(frames): s.alpha_composite(f, (i * w, 0))
    return {'src': uri(s), 'w': w, 'h': h, 'n': len(frames), 'px': pivot[0], 'py': pivot[1], 'ms': durs}
burst, ball, diag, emb = _strip('vfx_burst'), _strip('vfx_ball'), _strip('vfx_ball_diag'), _strip('vfx_embers')
TURN_AX = {'east': 'id', 'west': 'fh', 'south': 'cw', 'north': 'ccw'}
TURN_DG = {'north-east': 'id', 'north-west': 'fh', 'south-east': 'fv', 'south-west': 'fhv'}
vfx = {'burst': {}, 'ball': {}, 'embers': _pack(*emb)}
for d in D8:
    if d in TURN_AX:
        vfx['burst'][d] = _pack(*_turn(burst[0], burst[1], TURN_AX[d]), burst[2]); vfx['ball'][d] = _pack(*_turn(ball[0], ball[1], TURN_AX[d]), ball[2])
    else:
        hx = 'id' if 'east' in d else 'fh'
        vfx['burst'][d] = _pack(*_turn(burst[0], burst[1], hx), burst[2]); vfx['ball'][d] = _pack(*_turn(diag[0], diag[1], TURN_DG[d]), diag[2])

# v4: strike frames of the two new moves (one shared 3D motion per move, so measured once)
wr = Image.open(_K / 'whip_atlas.png'); sr = Image.open(_K / 'stomp_atlas.png')
def _bb(img, row, f): return img.crop((f * CELL, row * CELL, (f + 1) * CELL, (row + 1) * CELL)).getbbox()
wdirs = _meta['whip']['dirs']; sdirs = _meta['stomp']['dirs']
# whip: the frame where the south view's arms span widest (the sweep crossing her front)
whip_strike = max(range(_meta['whip']['frames']), key=lambda f: (lambda b: b[2] - b[0])(_bb(wr, wdirs.index('south'), f)))
# stomp: the landing, where the south view's head is lowest
stomp_strike = min(range(_meta['stomp']['frames']), key=lambda f: -_bb(sr, sdirs.index('south'), f)[1])
whip = _strip('vfx_whip_pro'); ring = _strip('vfx_ring_pro')
vfx['whip'] = {}
for d in D8:
    how = TURN_AX.get(d) or ('id' if 'east' in d else 'fh')
    vfx['whip'][d] = _pack(*_turn(whip[0], whip[1], how), whip[2])
vfx['ring'] = _pack(*ring)
out['moves'] = {'jab': {'strike': strike, 'fist': fist}, 'whip': {'strike': whip_strike}, 'stomp': {'strike': stomp_strike}, 'vfx': vfx}
print('moves: jab strike', strike, 'whip strike', whip_strike, 'stomp strike', stomp_strike)
