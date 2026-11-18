"""Ba Dan art kit (stage 6): raw takes -> assets/objects_bd20/<key>.png and manifest.json.
Hard 1-bit alpha (cut at 128), the largest piece kept plus any piece of 6 px or more, PixelLab's baked grey ground plate peeled off
(`t13objproc.py`'s rule, small objects only), the near-black outline recoloured to a darker tone of the material beside it
(`v16proc.py`), cropped to the bounding box. Prints the size and the stats of each.
Usage (from prototypes/topdown): python3 tools/bd20proc.py key:seed [key:seed ...]   (merges into manifest.json)"""
import os, sys, json
sys.path.insert(0, 'tools'); import pl
from PIL import Image
from pathlib import Path
H = Path(__file__).resolve().parent.parent
RAW = Path(os.environ.get('BD20_RAW', H / 'bd20' / 'raw'))
OUT = H / 'assets' / 'objects_bd20'; OUT.mkdir(exist_ok=True)
SH = (0x32, 0x21, 0x25)
SMALL = {'chair', 'plant_chair', 'stool', 'bucket', 'basket', 'washboard', 'mason_bench', 'peg', 'side_gate', 'wall_mended', 'wall_low'}


def outline(im):
    w, h = im.size; px = im.load(); out = im.copy(); op = out.load(); n = 0
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            if p[3] == 0 or max(p[:3]) > 40: continue
            if not any(not (0 <= x + dx < w and 0 <= y + dy < h) or px[x + dx, y + dy][3] == 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): continue
            acc = []
            for r in range(1, 5):
                for yy in range(max(0, y - r), min(h, y + r + 1)):
                    for xx in range(max(0, x - r), min(w, x + r + 1)):
                        q = px[xx, yy]
                        if max(abs(xx - x), abs(yy - y)) == r and q[3] and max(q[:3]) >= 64: acc.append(q[:3])
                if acc: break
            if not acc: continue
            m = [sum(c[i] for c in acc) / len(acc) for i in range(3)]
            op[x, y] = tuple(int(m[i] * 0.52 * 0.78 + SH[i] * 0.22) for i in range(3)) + (255,); n += 1
    return out, n


def greyish(c): r, g, b, a = c; return a and max(r, g, b) - min(r, g, b) < 18 and 110 < r < 205


def clean(im, small):
    W, Hh = im.size; p = im.load()
    for y in range(Hh):
        for x in range(W):
            r, g, b, a = p[x, y]; p[x, y] = (r, g, b, 255) if a >= 128 else (0, 0, 0, 0)
    plate = 0
    if small:
        bb = im.getbbox(); top = bb[1] + (bb[3] - bb[1]) // 3; ch = True
        while ch:
            ch = False
            for y in range(top, Hh):
                for x in range(W):
                    if greyish(p[x, y]) and any(0 <= x + dx < W and 0 <= y + dy < Hh and p[x + dx, y + dy][3] == 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                        if sum(1 for k in range(-3, 4) if 0 <= x + k < W and greyish(p[x + k, y])) >= 5: p[x, y] = (0, 0, 0, 0); ch = True; plate += 1
    seen = set(); comps = []
    for y in range(Hh):
        for x in range(W):
            if (x, y) in seen or not p[x, y][3]: continue
            st, c = [(x, y)], []; seen.add((x, y))
            while st:
                cx, cy = st.pop(); c.append((cx, cy))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        n = (cx + dx, cy + dy)
                        if 0 <= n[0] < W and 0 <= n[1] < Hh and n not in seen and p[n[0], n[1]][3]: seen.add(n); st.append(n)
            comps.append(c)
    comps.sort(key=len, reverse=True); drop = 0
    for i, c in enumerate(comps):
        if i == 0 or (small and len(c) >= 6 and False): continue
        if len(c) < 6 or not small or True:
            for x, y in c: p[x, y] = (0, 0, 0, 0); drop += 1
    return im.crop(im.getbbox()), plate, drop


if __name__ == '__main__':
    mf = OUT / 'manifest.json'; man = json.load(open(mf)) if mf.exists() else {}
    L = {j['name']: j for j in pl.ledger()['jobs']}
    for arg in sys.argv[1:]:
        k, _, sd = arg.partition(':'); sd = int(sd or 3)
        im, plate, drop = clean(Image.open(RAW / f'{k}_{sd}.png').convert('RGBA'), k in SMALL)
        im, n = outline(im); im.save(OUT / f'{k}.png')
        man[k] = {'w': im.width, 'h': im.height, 'seed': sd, 'ledger_job': f'bd20_{k}_{sd}', 'credits': sum(j['credits'] for n_, j in L.items() if n_.startswith(f'bd20_{k}_')),
                  'job_id': L.get(f'bd20_{k}_{sd}', {}).get('job'),
                  'takes': sum(1 for n_ in L if n_.startswith(f'bd20_{k}_')),
                  'prompt': (L.get(f'bd20_{k}_{sd}', {}).get('settings', {}).get('description') or '')[:230]}
        print(f'{k:14s} {im.width:3d}x{im.height:<3d} plate {plate} dropped {drop} outline {n}')
    json.dump(man, open(mf, 'w'), indent=1)
