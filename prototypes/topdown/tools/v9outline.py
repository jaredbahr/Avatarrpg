"""Close the outline where pale stone meets transparency (plinths, doorsteps, bridge abutments): those edge pixels take the
dark outline tone, so no light pixel rims any object."""
import json
from PIL import Image
m = json.load(open('assets/objects8/manifest.json'))
for k in m:
    im = Image.open(f'assets/objects8/{k}.png').convert('RGBA'); W, H = im.size; p = im.load(); hit = []
    for y in range(H):
        for x in range(W):
            r, g, b, a = p[x, y]
            if not a or not any(not (0 <= x + dx < W and 0 <= y + dy < H) or p[x + dx, y + dy][3] == 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): continue
            if 0.299 * r + 0.587 * g + 0.114 * b > 150 and max(r, g, b) - min(r, g, b) < 30: hit.append((x, y))
    if hit and k not in ('laundry_line',):
        for x, y in hit: p[x, y] = (0x32, 0x21, 0x25, 255) if y >= H * 0.6 else (0x4a, 0x3a, 0x3c, 255)
        im.save(f'assets/objects8/{k}.png'); print(k, len(hit))
