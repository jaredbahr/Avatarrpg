"""(B) the halo scan: every object's alpha edge, looking for light, near-grey pixels (a leftover backdrop plate or halo).
Counts edge pixels in the lowest 35% of the sprite (where a plate sits) and over the whole outline."""
import json, sys
from PIL import Image
m = json.load(open('assets/objects13/manifest.json')); rows = []
for k in m:
    im = Image.open(f'assets/objects13/{k}.png').convert('RGBA'); W, H = im.size; p = im.load()
    soft = sum(1 for y in range(H) for x in range(W) if 0 < p[x, y][3] < 255)
    low = allc = 0
    for y in range(H):
        for x in range(W):
            r, g, b, a = p[x, y]
            if a == 0: continue
            if not any(not (0 <= x + dx < W and 0 <= y + dy < H) or p[x + dx, y + dy][3] == 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): continue
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            if lum > 150 and max(r, g, b) - min(r, g, b) < 30:
                allc += 1
                if y >= H * 0.65: low += 1
    rows.append((k, f'{W}x{H}', soft, low, allc))
json.dump(rows, open('t13/halo13.json', 'w'))
for r in rows: print(r)
for r in rows: print(*r)
