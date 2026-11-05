"""v12: scan every object (and character) sprite for near-black outlines thicker than 1 px.
A boundary pixel is an opaque pixel with a transparent 4-neighbour; its outline thickness is the run of near-black pixels walking inward
(opposite the transparent neighbour). Prints per-asset: boundary px, share with run>=2, share with run>=3, max run."""
import sys, json
from pathlib import Path
from PIL import Image
H = Path(__file__).resolve().parent.parent
def dark(p, lim=64): return p[3] > 128 and max(p[:3]) < lim
def scan(im, lim=64):
    w, h = im.size; px = im.load(); n = r2 = r3 = mx = 0
    for y in range(h):
        for x in range(w):
            if px[x, y][3] <= 128: continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] > 128: continue
                run = 0; cx, cy = x, y
                while 0 <= cx < w and 0 <= cy < h and dark(px[cx, cy], lim): run += 1; cx -= dx; cy -= dy
                n += 1; r2 += run >= 2; r3 += run >= 3; mx = max(mx, run); break
    return n, r2, r3, mx
if __name__ == '__main__':
    rows = []
    d = Path(sys.argv[1]) if len(sys.argv) > 1 else H / 'assets' / 'objects8'
    for f in sorted(d.glob('*.png')):
        im = Image.open(f).convert('RGBA'); n, r2, r3, mx = scan(im)
        if n: rows.append((f.stem, n, round(r2 / n, 2), round(r3 / n, 2), mx))
    rows.sort(key=lambda r: -r[2])
    for r in rows: print('%-16s boundary %4d  >=2px %.2f  >=3px %.2f  max %d' % r)
