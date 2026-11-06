"""Drop detached chips from a sprite (a stray stick beside the shrine, wood chips lying loose under a stack): any 8-connected
piece smaller than 12% of the main body goes, except where small pieces are the point (bees, a banner's tassels)."""
import json, sys
from PIL import Image
KEEP = {'beehive', 'banner_pole', 'laundry_line', 'flowers', 'tuft', 'garden'}
def clean(path):
    im = Image.open(path).convert('RGBA'); W, H = im.size; p = im.load(); seen = [[0] * W for _ in range(H)]; comps = []
    for y in range(H):
        for x in range(W):
            if p[x, y][3] and not seen[y][x]:
                st = [(x, y)]; seen[y][x] = 1; c = []
                while st:
                    a, b = st.pop(); c.append((a, b))
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            u, v = a + dx, b + dy
                            if 0 <= u < W and 0 <= v < H and p[u, v][3] and not seen[v][u]: seen[v][u] = 1; st.append((u, v))
                comps.append(c)
    comps.sort(key=len, reverse=True); n = 0
    for c in comps[1:]:
        if len(c) < 0.12 * len(comps[0]):
            for a, b in c: p[a, b] = (0, 0, 0, 0)
            n += len(c)
    if n: im = im.crop(im.getbbox()); im.save(path)
    return n, im.size
if __name__ == '__main__':
    m = json.load(open('assets/objects8/manifest.json'))
    for k in (sys.argv[1:] or list(m)):
        if k in KEEP: continue
        n, sz = clean(f'assets/objects8/{k}.png')
        if n: m[k]['w'], m[k]['h'] = sz; print(k, n, sz)
    json.dump(m, open('assets/objects8/manifest.json', 'w'), indent=1)
