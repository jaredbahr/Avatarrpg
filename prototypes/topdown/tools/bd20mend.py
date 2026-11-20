"""The mended wall section (kit line 25), code-drawn from `wall_low.png`: PixelLab's edit of the wall (bd20_wall_mended_3, on the
earth mound; its mend did not show) was not retaken because a second edit would pass the stage's 162-credit cap. The three middle
blocks of the face are lifted toward the palette's cream and given fresh seams, so the repair reads as newer, paler stone.
Writes assets/objects_bd20/wall_mended.png and adds its manifest entry (5 credits: the PixelLab edit that failed). Run after bd20proc.py wall_low:3."""
import json
from pathlib import Path
from PIL import Image
D = Path(__file__).resolve().parent.parent / 'assets' / 'objects_bd20'
im = Image.open(D / 'wall_low.png').convert('RGBA'); p = im.load()
CREAM = (0xf6, 0xee, 0xd6); SEAM = (0xc9, 0xb4, 0x8a)
for y in range(16, 23):
    for x in range(13, 27):
        r, g, b, a = p[x, y]
        if not a: continue
        t = 0.88 if max(r, g, b) > 150 else 0.55   # faces lift most, the old dark joints only a little
        p[x, y] = tuple(round(c + (k - c) * t) for c, k in zip((r, g, b), CREAM)) + (255,)
for y in range(16, 23):
    p[19, y] = SEAM + (255,)
for x in range(13, 27):
    p[x, 19] = SEAM + (255,) if x not in (19,) else p[x, 19]
im.save(D / 'wall_mended.png')
mf = D / 'manifest.json'; man = json.load(open(mf))
man['wall_mended'] = {'w': im.width, 'h': im.height, 'seed': None, 'ledger_job': None, 'credits': 5.0, 'job_id': None,
                      'note': 'code-drawn from wall_low (tools/bd20mend.py); the PixelLab edit bd20_wall_mended_3 of earth_wall showed no mend'}
json.dump(man, open(mf, 'w'), indent=1)
