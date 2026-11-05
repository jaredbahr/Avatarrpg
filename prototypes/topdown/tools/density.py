"""Effective pixel size of a sprite: the share of opaque pixels whose 2x2 block is one colour (1.0 = upscaled 2x),
and the mean horizontal run of identical colour (1 px art ~1.3-1.7; chunky nearest-upscales ~2+)."""
import sys, glob, json
from PIL import Image
def stats(p):
    im = Image.open(p).convert('RGBA'); W, H = im.size; px = im.load()
    runs = []; blocks = 0; tot = 0
    for y in range(H):
        run = 0; prev = None
        for x in range(W):
            c = px[x, y]
            if c[3] < 128: 
                if run: runs.append(run); run = 0; prev = None
                continue
            if c == prev: run += 1
            else:
                if run: runs.append(run)
                run = 1; prev = c
        if run: runs.append(run)
    for y in range(0, H - 1, 2):
        for x in range(0, W - 1, 2):
            q = [px[x, y], px[x + 1, y], px[x, y + 1], px[x + 1, y + 1]]
            if all(c[3] >= 128 for c in q): tot += 1; blocks += (q[0] == q[1] == q[2] == q[3])
    return round(sum(runs) / max(1, len(runs)), 2), round(blocks / max(1, tot), 2), (W, H)
if __name__ == '__main__':
    for p in sys.argv[1:]:
        r, b, s = stats(p); print(f'{p.split("/")[-1]:28s} run {r:5} same2x2 {b:5} size {s}')
