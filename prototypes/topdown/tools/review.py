import json, sys; sys.path.insert(0, 'tools')
from sheet import sheet
from PIL import Image
D8 = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
c, prefix, out = sys.argv[1], sys.argv[2], sys.argv[3]
m = json.load(open(f'assets/chars/{c}/meta.json'))
v = next(val for k, val in m['anims'].items() if k.startswith(prefix))
rows = []
for d in D8:
    if d in v:
        ims = [Image.open(f'assets/chars/{c}/{f}') for f in v[d]]
        bb = [i.getbbox() for i in ims]
        print(d, 'tops', [b[1] for b in bb], 'bottoms', [b[3] for b in bb], 'x0', [b[0] for b in bb], 'x1', [b[2] for b in bb])
        rows.append([i.crop((12, 10, 68, 68)) for i in ims])
sheet(rows, 2).save(out)
