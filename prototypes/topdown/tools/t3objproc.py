"""T3: clean the Ba Dan objects (route sign, school notice, the redrawn canal bridge) into assets/objects_t3/: hard 1-bit alpha, detached specks under 6 px dropped, cropped to
the bounding box (the object stands on its lowest pixel). PICK maps key -> the seed kept. Run from prototypes/topdown."""
from pathlib import Path
from PIL import Image
H = Path(__file__).resolve().parent.parent; OUT = H / 'assets' / 'objects_t3'
PICK = {'route_sign': 4, 'school_notice': 3, 'bridge': 'high_7_wide'}   # the bridge: take 3 of 3 (tools/t3bridge.py), the only one 60 px wide
for k, seed in PICK.items():
    im = Image.open(OUT / 'raw' / f'{k}_{seed}.png').convert('RGBA'); p = im.load(); W, Hh = im.size
    soft = 0
    for y in range(Hh):
        for x in range(W):
            a = p[x, y][3]
            if 0 < a < 128: p[x, y] = (0, 0, 0, 0); soft += 1
            elif 128 <= a < 255: p[x, y] = p[x, y][:3] + (255,); soft += 1
    seen = set(); specks = 0
    for y in range(Hh):
        for x in range(W):
            if (x, y) in seen or not p[x, y][3]: continue
            st, comp = [(x, y)], []; seen.add((x, y))
            while st:
                cx, cy = st.pop(); comp.append((cx, cy))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < W and 0 <= ny < Hh and (nx, ny) not in seen and p[nx, ny][3]: seen.add((nx, ny)); st.append((nx, ny))
            if len(comp) < 6:
                for cx, cy in comp: p[cx, cy] = (0, 0, 0, 0)
                specks += len(comp)
    im = im.crop(im.getbbox()); im.save(OUT / f'{k}.png')
    print(f'{k:14s} {im.width}x{im.height} soft {soft} specks {specks}')
