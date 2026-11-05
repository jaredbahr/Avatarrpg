import json
from PIL import Image, ImageDraw, ImageFont
D8 = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
BG = (86, 104, 82, 255); CELL = 48; GAP = 2; LABEL_W = 70
try: F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 9)
except Exception: F = ImageFont.load_default()
def pick(meta, prefix):
    for k, v in meta['anims'].items():
        if k.startswith(prefix) and not k.endswith('1081cc'): return v
    return {}
blocks = []
for c, idle_p, walk_p in [('kaya', 'breathing-idle', 'walking-8-frames'), ('villager', None, 'walking-8-frames'),
                          ('shopkeeper', 'breathing-idle', None), ('cat', 'seated-on-belly-idle', 'walk-8-frames')]:
    m = json.load(open(f'assets/chars/{c}/meta.json'))
    idle = pick(m, idle_p) if idle_p else {}; walk = pick(m, walk_p) if walk_p else {}
    rows = []
    for d in D8:
        rot = Image.open(f'assets/chars/{c}/rot_{d}.png')
        cells = []
        r48 = Image.new('RGBA', (CELL, CELL)); r48.alpha_composite(rot, ((CELL - rot.width) // 2, (CELL - rot.height) // 2)); cells.append(('rot', r48))
        for i, f in enumerate(idle.get(d, [])): cells.append((f'idle{i}', Image.open(f'assets/chars/{c}/{f}')))
        for i, f in enumerate(walk.get(d, [])): cells.append((f'walk{i}', Image.open(f'assets/chars/{c}/{f}')))
        rows.append((d, cells))
    blocks.append((c, rows, idle_p, walk_p, len(next(iter(idle.values()), [])), len(next(iter(walk.values()), []))))
ncol = max(len(cells) for _, rows, *_ in blocks for _, cells in rows)
W = LABEL_W + ncol * (CELL + GAP); H = sum(14 + len(rows) * (CELL + GAP) + 8 for _, rows, *_ in blocks)
img = Image.new('RGBA', (W, H), BG); dr = ImageDraw.Draw(img); y = 0
for c, rows, ip, wp, ni, nw in blocks:
    dr.text((2, y + 2), f'{c.upper()}  rotation | {ip or "-"} x{ni} | {wp or "-"} x{nw}', fill=(240, 232, 210, 255), font=F); y += 14
    for d, cells in rows:
        dr.text((2, y + CELL // 2 - 5), d, fill=(230, 225, 200, 255), font=F)
        for i, (_, im) in enumerate(cells):
            x = LABEL_W + i * (CELL + GAP)
            dr.rectangle([x, y, x + CELL - 1, y + CELL - 1], fill=(96, 116, 92, 255))
            img.alpha_composite(im, (x, y))
        y += CELL + GAP
    y += 8
img.resize((W * 4, H * 4), Image.NEAREST).save('spritesheet-4x.png')
print(img.size, ncol)
