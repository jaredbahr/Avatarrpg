"""v12 item 4: near-black outlines thicker than 1 px -> a 1 px outline in a darker tone of the adjacent material (Imagination's rule).
Reads assets/objects8, writes assets/objects12 (only the sprites that fail the scan). Per sprite:
  layer 1  = dark (max channel < 64) pixels touching transparency  -> the outline, recoloured material * 0.52 pulled toward #322125
  layer 2+ = dark pixels reached through layer 1                   -> body: the material colour * 0.82 (the outline is thinned to 1 px)
  pockets  = dark pixels not reached from the edge (foliage only)  -> material * 0.6, so a crown has shade, never black voids
Run: python3 tools/v12outline.py   (prints a before/after table; the list is copied to the README)"""
import sys, json
from collections import deque
from pathlib import Path
from PIL import Image
sys.path.insert(0, str(Path(__file__).resolve().parent))
from v12scan import scan
H = Path(__file__).resolve().parent.parent
SRC, DST = H / 'assets' / 'objects8', H / 'assets' / 'objects12'
LIM = 64; SH = (0x32, 0x21, 0x25)
FOLIAGE = {'tree', 'bush', 'tree_blossom'}
THRESH = 0.15     # share of the boundary whose near-black run is 2+ px
SKIP = set()      # sprites with deliberately dark bodies are handled by hand below
def isdark(p): return p[3] > 128 and max(p[:3]) < LIM
def material(px, w, h, x, y):
    for r in range(1, 9):
        acc = []; best = None
        for yy in range(max(0, y - r), min(h, y + r + 1)):
            for xx in range(max(0, x - r), min(w, x + r + 1)):
                if max(abs(xx - x), abs(yy - y)) != r: continue
                p = px[xx, yy]
                if p[3] > 128 and max(p[:3]) >= LIM: acc.append(p[:3])
        if acc: return tuple(sum(c[i] for c in acc) / len(acc) for i in range(3))
    return None
def fix(im, name):
    w, h = im.size; px = im.load(); out = im.copy(); op = out.load()
    layer = {}; q = deque()
    for y in range(h):
        for x in range(w):
            if not isdark(px[x, y]): continue
            if any(not (0 <= x + dx < w and 0 <= y + dy < h) or px[x + dx, y + dy][3] <= 128 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): layer[(x, y)] = 1; q.append((x, y))
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if 0 <= n[0] < w and 0 <= n[1] < h and n not in layer and isdark(px[n]): layer[n] = layer[(x, y)] + 1; q.append(n)
    for (x, y), L in layer.items():
        m = material(px, w, h, x, y)
        if m is None: continue
        if L == 1: c = tuple(int(m[i] * 0.52 * 0.78 + SH[i] * 0.22) for i in range(3))
        else: c = tuple(int(m[i] * 0.82) for i in range(3))
        op[x, y] = c + (255,)
    if name in FOLIAGE:
        for y in range(h):
            for x in range(w):
                if isdark(px[x, y]) and (x, y) not in layer:
                    m = material(px, w, h, x, y)
                    if m: op[x, y] = tuple(int(c * 0.6) for c in m) + (255,)
    return out
if __name__ == '__main__':
    rows = []
    for f in sorted(SRC.glob('*.png')):
        im = Image.open(f).convert('RGBA'); n, r2, r3, mx = scan(im)
        if not n or r2 / n < THRESH or f.stem in SKIP: continue
        out = fix(im, f.stem); n2, a2, a3, m2 = scan(out)
        out.save(DST / f.name); rows.append((f.stem, round(r2 / n, 2), round(r3 / n, 2), round(a2 / n2, 2), round(a3 / n2, 2)))
    print('%-16s %s' % ('asset', 'before(>=2px, >=3px)  after(>=2px, >=3px)'))
    for r in rows: print('%-16s %.2f %.2f   ->   %.2f %.2f' % r)
    json.dump(rows, open(H / 'v12' / 'outline_fixed.json', 'w'))
