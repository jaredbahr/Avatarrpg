"""v13: more depth in the six Ba Dan houses (Jared, on v12: the houses still feel a bit flat). Reads assets/objects12/house_*.png
(v12's outline fix and cues already in) and writes assets/objects_bd13/house_*.png; v12's files are untouched.
  1. eave shadow: v12's 3 px band becomes 6 px, darkest under the roof (x0.50 .. x0.90), so the overhang reads at 1x.
  2. the facade turns: the wall darkens over its last 12 columns toward the shaded right (light from the upper left).
  3. a side-wall hint: a 5 px strip of the right wall seen receding up the picture under the roof's overhang, in the wall's
     own colours a notch into shade, with its plinth and a 1 px outline in the stone's dark tone.
  4. recessed openings: inside every dark door and window opening the left jamb throws a 2 px shadow (v12 had the lintel only).
  5. the plinth's top edge catches the light (1 px), so the plinth reads as a step out from the wall."""
import json
from pathlib import Path
from PIL import Image
H = Path(__file__).resolve().parent.parent
SRC, DST = H / 'assets' / 'objects12', H / 'assets' / 'objects_bd13'
DST.mkdir(exist_ok=True)
SH = (0x32, 0x21, 0x25)
def roofish(p):
    r, g, b, a = p
    if a < 128: return False
    return (r >= 140 and r - g >= 62 and r - b >= 70) or (g >= r + 14 and g >= b + 8 and g > 60 and r < 140 and g - b > 12)
def mul(p, k, t=0.2): return tuple(int(p[i] * k * (1 - t) + SH[i] * t * k + SH[i] * (1 - k) * 0.35) for i in range(3)) + (255,)
def stoneish(p): r, g, b, a = p; return a > 128 and abs(r - g) < 20 and abs(g - b) < 22 and 70 < r < 210
def dark(p): return p[3] > 128 and max(p[:3]) < 96 and not roofish(p)
def go(name):
    im = Image.open(SRC / f'{name}.png').convert('RGBA'); W, Hh = im.size; px = im.load()
    roof = [[roofish(px[x, y]) for x in range(W)] for y in range(Hh)]
    for _ in range(2):
        new = [row[:] for row in roof]
        for y in range(1, Hh - 1):
            for x in range(2, W - 2):
                if roof[y][x] or px[x, y][3] < 128: continue
                if (any(roof[y][x - k] for k in (1, 2)) and any(roof[y][x + k] for k in (1, 2))) or (roof[y - 1][x] and roof[y + 1][x]): new[y][x] = True
        roof = new
    rbot = [max([y for y in range(Hh) if roof[y][x]], default=-1) for x in range(W)]
    out = im.copy(); op = out.load(); stats = {}
    # 1. eave band, rows 4-6 below the roof edge added to v12's 1-3 (which are deepened a notch)
    n = 0
    for x in range(W):
        y0 = rbot[x]
        if y0 < 0: continue
        for k in range(1, 7):
            y = y0 + k
            if y >= Hh or roof[y][x] or px[x, y][3] < 128: break
            f = (0.82, 0.84, 0.86, 0.78, 0.86, 0.93)[k - 1]; op[x, y] = mul(op[x, y], f, 0.1); n += 1
    stats['eave px'] = n
    # the wall body: opaque, not roof, below the roof edge; its right edge per row (the plinth rows included)
    rows = range(int(Hh * 0.45), Hh)
    right = {}
    for y in rows:
        xs = [x for x in range(W) if px[x, y][3] > 128 and not roof[y][x] and rbot[x] < y]
        if xs: right[y] = max(xs)
    xr = Counter(right.values()).most_common(1)[0][0] if right else W - 1
    # 2. the facade turns away on its right: the last 12 columns of wall darken step by step
    n = 0
    for y, r in right.items():
        if r < xr - 2: continue
        for k in range(12):
            x = r - k
            if x < 0 or px[x, y][3] < 128 or roof[y][x] or dark(px[x, y]): continue
            f = 1 - 0.2 * (1 - k / 12) ** 1.6; op[x, y] = mul(op[x, y], f, 0.05); n += 1
    stats['turn px'] = n
    # 6. the wall face darkens toward the ground: from the eave line to the plinth, x1.0 .. x0.86
    for x in range(W):
        y0 = rbot[x]
        if y0 < 0: continue
        ys = [y for y in range(y0 + 1, Hh) if px[x, y][3] > 128]
        if len(ys) < 8: continue
        for y in ys:
            if roof[y][x] or dark(px[x, y]): continue
            f = 1 - 0.14 * (y - y0) / max(1, Hh - y0); op[x, y] = mul(op[x, y], f, 0.0)
    # 3. the side-wall hint: grow the canvas 6 px to the right and draw a receding strip from the wall's right edge
    pad = 8; big = Image.new('RGBA', (W + pad, Hh)); big.alpha_composite(out, (0, 0)); bp = big.load()
    wall_rows = sorted(y for y, r in right.items() if r >= xr - 1)
    if wall_rows:
        top, bot = wall_rows[0], wall_rows[-1]
        for y in range(top, bot + 1):
            if right.get(y, -1) < xr - 1: continue
            # the side wall's material: the facade's own plaster (or plinth stone) from just inside the corner post, never the outline
            cand = [px[x, y] for x in range(max(0, xr - 22), xr - 2) if px[x, y][3] > 128 and not dark(px[x, y]) and not roof[y][x]]
            if not cand: continue
            cand.sort(key=lambda c: sum(c[:3])); src = cand[len(cand) * 2 // 3]; ston = stoneish(src) and y > bot - 14
            for k in range(1, 8):
                lift = (k + 1) // 2                 # the strip recedes up the picture: 1 px up for every 2 px across
                yy = y - lift
                if yy < 0 or (yy < Hh and xr + k < W and roof[yy][min(W - 1, xr + k)]): continue
                if bp[xr + k, yy][3] > 128 and not (xr + k < W and px[min(W - 1, xr + k), yy][3] < 128): continue
                c = mul(src, 0.7 if not ston else 0.64, 0.12)
                if k == 7 or y == top: c = tuple(int(v * 0.6) for v in c[:3]) + (255,)   # its outer edge: 1 px, the material's dark tone
                bp[xr + k, yy] = c
        # the strip's bottom edge on the ground line: a dark 1 px seam
        for k in range(1, 6):
            yy = bot - (k + 1) // 2
            if 0 <= yy < Hh: bp[xr + k, yy] = tuple(int(v * 0.5) for v in bp[xr + k, yy][:3]) + (255,)
    stats['side rows'] = len(wall_rows)
    # 4. jamb shadows inside the dark openings: the first 2 px of every dark run from the left
    n = 0
    for y in range(Hh):
        x = 1
        while x < W:
            if dark(px[x, y]) and not dark(px[x - 1, y]) and px[x - 1, y][3] > 128 and y < Hh - 4:
                run = 0
                while x + run < W and dark(px[x + run, y]): run += 1
                if run >= 5:
                    for k in range(2): bp[x + k, y] = tuple(int(c * 0.62) for c in bp[x + k, y][:3]) + (255,); n += 2
                x += run
            x += 1
    stats['jamb px'] = n
    # 5. the plinth's lit top edge: the first stone row under the wall, where the stone begins
    n = 0
    for x in range(W):
        for y in range(int(Hh * 0.6), Hh - 2):
            if stoneish(px[x, y]) and not stoneish(px[x, y - 1]) and px[x, y - 1][3] > 128 and not roof[y - 1][x] and stoneish(px[x, y + 1]):
                bp[x, y] = tuple(min(255, int(c * 1.18 + 8)) for c in bp[x, y][:3]) + (255,); n += 1; break
    stats['plinth px'] = n
    big = big.crop(big.getbbox()); big.save(DST / f'{name}.png')
    return big.size, stats
from collections import Counter
man = {}
for n in ('house_gao', 'house_mira', 'house_ne', 'house_pella', 'house_merchant', 'house_se'):
    size, st = go(n); man[n] = {'w': size[0], 'h': size[1]}; print(n, size, st)
json.dump(man, open(DST / 'manifest.json', 'w'), indent=1)
