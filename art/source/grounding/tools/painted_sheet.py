"""Before/after of every object the grounding pass re-shades in the Ba Dan master (ADR 0093), at 3x nearest.

python3 art/source/grounding/tools/painted_sheet.py <before master> <after master> <out dir>
Writes one numbered crop pair per object (`NN-<name>-<piece>.png`, before left, after right), then the authored
barrel and the stray roof tile, and `index.json`.
"""
import json
import os
import sys

sys.path.insert(0, 'art/source/ba-dan-route-a/tools')
os.environ.setdefault('ROUTE_A_WORK', 'art/source/ba-dan-route-a/polish')
from PIL import Image

import shadows as S
import props_set as P


def main(before, after, out):
    os.makedirs(out, exist_ok=True)
    a, b = Image.open(before).convert('RGB'), Image.open(after).convert('RGB')
    first = [o for o in P.placed() if o['name'] not in S.SKIP]
    standing = [o for o in first if o['name'] not in S.PROPS] + S.redraws()
    standing.sort(key=lambda o: (o['xy'][1], o['xy'][0]))
    index = []
    for n, o in enumerate(standing, 1):
        w, h = o['image'].size
        x0, y0 = o['xy']
        box = (x0 - 14, y0 - 8, x0 + w + 30, y0 + h + 22)
        pa, pb = a.crop(box), b.crop(box)
        row = Image.new('RGB', (pa.width * 2 + 3, pa.height), 'white')
        row.paste(pa, (0, 0))
        row.paste(pb, (pa.width + 3, 0))
        name = f"{n:02d}-{o['name']}-{o['piece']}.png"
        row.resize((row.width * 3, row.height * 3), Image.NEAREST).save(f'{out}/{name}', optimize=True)
        index.append({'n': n, 'object': o['name'], 'piece': o['piece'], 'world_px': [x0, y0, w, h], 'crop': name})
    # The painted pieces the pass touched that no round set in: the authored barrel and the stray roof tile.
    extras = [(name, box) for name, box in S.EXTRA_RECTS.items()] + [('roof-tile', S.ROOF_TILE['box'])]
    for name, (x0, y0, x1, y1) in extras:
        n = len(index) + 1
        box = (x0 - 24, y0 - 16, x1 + 30, y1 + 22)
        pa, pb = a.crop(box), b.crop(box)
        row = Image.new('RGB', (pa.width * 2 + 3, pa.height), 'white')
        row.paste(pa, (0, 0))
        row.paste(pb, (pa.width + 3, 0))
        crop = f'{n:02d}-{name}.png'
        row.resize((row.width * 3, row.height * 3), Image.NEAREST).save(f'{out}/{crop}', optimize=True)
        index.append({'n': n, 'object': name, 'piece': None, 'world_px': [x0, y0, x1 - x0 + 1, y1 - y0 + 1], 'crop': crop})
    json.dump(index, open(f'{out}/index.json', 'w'), indent=2)
    print(len(index), 'crops in', out)


if __name__ == '__main__':
    main(*sys.argv[1:4])
