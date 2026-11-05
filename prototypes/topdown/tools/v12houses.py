"""v12 item 3 (sprite half): depth cues painted into the six house sprites, after v12outline.py.
  * eave shadow: the wall (and timber) directly under the roof edge takes a shadow band, 3 px deep, darkest at the roof (ART_DIRECTION: eaves cast a
    shadow band on the wall under them). The roof is found by hue (saturated tile red/orange, or the green tile), closed and hole-filled.
  * lintel shadow: a 2 px top shadow inside each dark door/window opening, so they read recessed.
  * plinth foot: the bottom two rows of the plinth darken (the wall-foot occlusion), a ragged third row as the stone sinks into the ground.
Runtime half (doorstep, trodden-earth band, skirt of earth/grass/stones over the plinth edge) lives in src/v12/ground.js."""
import sys
from pathlib import Path
from PIL import Image
H = Path(__file__).resolve().parent.parent
D = H / 'assets' / 'objects12'
SH = (0x32, 0x21, 0x25)
def roofish(p):
    r, g, b, a = p
    if a < 128: return False
    return (r >= 140 and r - g >= 62 and r - b >= 70) or (g >= r + 14 and g >= b + 8 and g > 60 and r < 140 and g - b > 12)
def mul(p, k, tint=SH, t=0.18):
    return tuple(int(p[i] * k * (1 - t) + tint[i] * t) for i in range(3)) + (255,)
def shade(name):
    im = Image.open(D / f'{name}.png').convert('RGBA'); w, h = im.size; px = im.load()
    roof = [[roofish(px[x, y]) for x in range(w)] for y in range(h)]
    # close: a roof pixel with roof 2 px to its left and right (or above and below) joins; then drop non-roof specks of 1-3 px wide inside the roof
    for _ in range(2):
        new = [row[:] for row in roof]
        for y in range(1, h - 1):
            for x in range(2, w - 2):
                if roof[y][x] or px[x, y][3] < 128: continue
                if (any(roof[y][x - k] for k in (1, 2)) and any(roof[y][x + k] for k in (1, 2))) or (roof[y - 1][x] and roof[y + 1][x]): new[y][x] = True
        roof = new
    out = im.copy(); op = out.load(); n = 0
    # eave band: non-roof opaque pixels within 3 px below a roof pixel (the lowest roof pixel of the run), only where the roof actually ends above them
    for x in range(w):
        y = 0
        while y < h - 1:
            if roof[y][x] and not roof[y + 1][x]:
                for k in range(1, 4):
                    yy = y + k
                    if yy >= h or roof[yy][x] or px[x, yy][3] < 128: break
                    op[x, yy] = mul(px[x, yy], (0.56, 0.7, 0.84)[k - 1]); n += 1
            y += 1
    # lintels: a dark opening (door / window pane) gets a 2 px top shadow
    def dark(p): return p[3] > 128 and max(p[:3]) < 96 and not roofish(p)
    for y in range(8, h - 40):
        for x in range(1, w - 1):
            if dark(px[x, y]) and not dark(px[x, y - 1]) and px[x, y - 1][3] > 128 and dark(px[x, y + 2]) and dark(px[x - 1, y]) | dark(px[x + 1, y]):
                for k in range(2):
                    op[x, y + k] = tuple(int(c * 0.6) for c in px[x, y + k][:3]) + (255,)
    # plinth foot: the last rows of every column
    for x in range(w):
        ys = [y for y in range(h) if px[x, y][3] > 128]
        if not ys: continue
        b = max(ys)
        if h - b > 3: continue
        for k, f in ((0, 0.45), (1, 0.62), (2, 0.8)):
            if b - k >= 0: op[x, b - k] = mul(px[x, b - k], f)
    out.save(D / f'{name}.png'); return n
if __name__ == '__main__':
    for n in ('house_gao', 'house_mira', 'house_ne', 'house_pella', 'house_merchant', 'house_se'):
        print(n, shade(n))
