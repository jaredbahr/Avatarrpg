"""The river road's raw takes (`rrobj.py`) -> assets/objects_rr/<key>.png and manifest.json: hard 1-bit alpha (cut at
128), specks under 6 px dropped, the near-black outline recoloured to a darker tone of the material (`bd20proc.outline`),
cropped to the bounding box. Unlike `bd20proc.clean` it keeps every part of a piece made of separate parts (the
stepping stones, the camp's rubbish), and never peels a grey "ground plate": half this kit is grey river stone.
Usage (from prototypes/topdown): RR_RAW=<raw dir> python3 tools/rrproc.py <key>[:seed] ..."""
import os, sys, json
sys.path.insert(0, 'tools'); import pl
from bd20proc import outline
from PIL import Image
from pathlib import Path
H = Path(__file__).resolve().parent.parent
RAW = Path(os.environ.get('RR_RAW', H / 'rr' / 'obj'))
OUT = H / 'assets' / 'objects_rr'; OUT.mkdir(exist_ok=True)
# the harbour already has a `rowboat` (objects_rg02), which the baker would find first
NAME = {'rowboat': 'river_rowboat'}


def clean(im):
    W, Hh = im.size; p = im.load()
    for y in range(Hh):
        for x in range(W):
            r, g, b, a = p[x, y]; p[x, y] = (r, g, b, 255) if a >= 128 else (0, 0, 0, 0)
    seen = set(); drop = 0
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
            if len(c) < 6:
                for cx, cy in c: p[cx, cy] = (0, 0, 0, 0); drop += 1
    return im.crop(im.getbbox()), drop


def across(down):
    """`toll_bar_across`: the toll bar as it lies across the road (north-south) on the bridge. The take was drawn running
    left to right, along the road; this turns the same striped arm's pixels a quarter turn and stands it on the same
    crate, so the barrier reads across the deck. A stop-gap until a retake draws it running straight away from the
    viewer (`docs/places/river_road.md`, kit list)."""
    w, h = down.size; p = down.load()
    split = next(x for x in range(w) if sum(1 for y in range(h) if p[x, y][3]) <= 8)
    crate = down.crop((0, 0, split, h)); arm = down.crop((split, 0, w, h)); arm = arm.crop(arm.getbbox()).rotate(90, expand=True)
    out = Image.new('RGBA', (max(crate.width, arm.width), crate.height + arm.height - 4))
    out.alpha_composite(arm, ((out.width - arm.width) // 2, 0))
    out.alpha_composite(crate, ((out.width - crate.width) // 2, out.height - crate.height))
    return out.crop(out.getbbox())


if __name__ == '__main__':
    mf = OUT / 'manifest.json'; man = json.load(open(mf)) if mf.exists() else {}
    L = {j['name']: j for j in pl.ledger()['jobs']}
    for arg in sys.argv[1:]:
        k, _, sd = arg.partition(':'); sd = int(sd or 3); job = f'rg02_obj_rr_{k}_{sd}'
        im, drop = clean(Image.open(RAW / f'{k}_{sd}.png').convert('RGBA'))
        im, n = outline(im); name = NAME.get(k, k); im.save(OUT / f'{name}.png')
        man[name] = {'w': im.width, 'h': im.height, 'seed': sd, 'ledger_job': job, 'job_id': L.get(job, {}).get('job'),
                  'credits': sum(j['credits'] or 0 for n_, j in L.items() if n_.startswith(f'rg02_obj_rr_{k}_')),
                  'takes': sum(1 for n_ in L if n_.startswith(f'rg02_obj_rr_{k}_')),
                  'prompt': (L.get(job, {}).get('settings', {}).get('description') or '')[:230]}
        print(f'{name:18s} {im.width:3d}x{im.height:<3d} dropped {drop} outline {n}')
    if (OUT / 'toll_bar_down.png').exists():
        im = across(Image.open(OUT / 'toll_bar_down.png').convert('RGBA')); im.save(OUT / 'toll_bar_across.png')
        man['toll_bar_across'] = {'w': im.width, 'h': im.height, 'derived_from': 'toll_bar_down', 'credits': 0}
        print(f'toll_bar_across    {im.width:3d}x{im.height:<3d} (derived)')
    json.dump(man, open(mf, 'w'), indent=1)
