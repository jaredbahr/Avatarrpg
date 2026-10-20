"""rawsheet.py KIND OUT.png [SCALE] : every raw take of KIND (hit|ko) as a row (the facing's idle cel 0, then the frames), on the lineup grey."""
import os, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); RAW = os.path.join(HERE, 'raw')
kind, out = sys.argv[1:3]; sc = int(sys.argv[3]) if len(sys.argv) > 3 else 1
D = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east']
rows = []
for d in D:
    ts = sorted(t for t in os.listdir(RAW) if t.startswith(f'{kind}-{d}-s'))
    for t in ts:
        fr = [os.path.join(HERE, '..', 'bruiser-g', 'cels', 'idle', d, '0.png')] + [os.path.join(RAW, t, f) for f in sorted(os.listdir(os.path.join(RAW, t)))]
        rows.append((t, fr))
n = max(len(r[1]) for r in rows); S = 192
sh = Image.new('RGBA', (S * n, S * len(rows)), (60, 60, 70, 255))
for y, (t, fr) in enumerate(rows):
    for x, f in enumerate(fr): sh.alpha_composite(Image.open(f).convert('RGBA'), (x * S, y * S))
sh = sh.convert('RGB')
if sc != 1: sh = sh.resize((sh.width * sc, sh.height * sc), Image.NEAREST)
sh.save(out); print(len(rows), 'rows', sh.size)
