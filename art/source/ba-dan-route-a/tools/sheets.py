from PIL import Image, ImageDraw
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from compose import *
from geo import paint
o = lambda n: Image.open(f'{RA}/{n}').convert('RGBA')
A, C = o('mock-route-a.png'), o('mock-current.png')
def rel(tx, ty): x, y = paint(tx, ty); return x - G[0], y - G[1]
def crop4(im, cx, cy, w=150, h=110):
    b = (round(cx - w / 2), round(cy - h / 2), round(cx + w / 2), round(cy + h / 2))
    return im.crop(b).resize((w * 4, h * 4), Image.NEAREST)
crops = [  # label, centre (painting px rel. to G)
    ('Kaya beside the house doorway', rel(8.5, 4.2)),
    ('roof edge and chimney', (rel(8, 1)[0] - 20, rel(8, 1)[1] - 60)),
    ('fruit baskets on the table, Bo head', rel(6.8, 5.0)),
    ('table leg and ground contact', rel(7.6, 5.9)),
    ('tree trunk and canopy edge', (rel(5.5, 5.5)[0], rel(5.5, 5.5)[1] - 60)),
    ('bridge, canal bank, Sura', rel(9.8, 6.8)),
]
rows = []
for lab, (cx, cy) in crops:
    r = Image.new('RGBA', (1200 + 30, 440 + 24), (24, 24, 24, 255)); d = ImageDraw.Draw(r)
    r.paste(crop4(C, cx, cy), (0, 24)); r.paste(crop4(A, cx, cy), (630, 24))
    d.text((4, 4), f'current | Route A   - {lab} (4x nearest)', fill='white'); rows.append(r)
sheet = Image.new('RGBA', (1230, sum(r.height for r in rows)), (24, 24, 24, 255)); y = 0
for r in rows: sheet.paste(r, (0, y)); y += r.height
sheet.save(f'{RA}/sheet-4x-crops.png')
# 1x before/after (full composition) stacked
s = Image.new('RGBA', (A.width, A.height * 2 + 20), (24, 24, 24, 255))
s.paste(C, (0, 0)); s.paste(A, (0, A.height + 20)); s.save(f'{RA}/sheet-1x-before-after.png')
# projection check: tile grid of the slice over Route A
g = A.copy(); d = ImageDraw.Draw(g)
for t in range(0, 15): d.line([rel(t, 0), rel(t, 10)], fill=(255, 255, 255, 110))
for t in range(0, 11): d.line([rel(0, t), rel(14, t)], fill=(255, 255, 255, 110))
g.save(f'{RA}/check-grid-route-a.png')
# material swatches from the generated ground composition (4x)
GC = o('out-ground-composition.png')
sw = [('grass verge', rel(9.5, 0.6)), ('paving / road', rel(6.5, 8.0)), ('canal bank', rel(3.5, 6.1)), ('canal water', rel(4.0, 6.5))]
w = Image.new('RGBA', (4 * 330, 280 + 20), (24, 24, 24, 255)); d = ImageDraw.Draw(w)
for i, (lab, (cx, cy)) in enumerate(sw):
    w.paste(GC.crop((round(cx - 40), round(cy - 35), round(cx + 40), round(cy + 35))).resize((320, 280), Image.NEAREST), (i * 330, 20)); d.text((i * 330 + 4, 4), lab, fill='white')
w.save(f'{RA}/swatches-4x.png')
