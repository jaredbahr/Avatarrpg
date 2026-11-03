"""Review helper: sheet.py OUT.png ROW [ROW ...], each ROW a comma-separated list of PNG paths drawn side by side at 4x
nearest on the world's grass, bottom-aligned. Nothing here ships."""
import sys
from PIL import Image
S = 4; BG = (112, 128, 92, 255)
rows = [[Image.open(p).convert('RGBA') for p in r.split(',') if p] for r in sys.argv[2:]]
cw = max(im.width for r in rows for im in r) * S; ch = max(im.height for r in rows for im in r) * S
out = Image.new('RGBA', (cw * max(len(r) for r in rows), ch * len(rows)), BG)
for y, r in enumerate(rows):
    for x, im in enumerate(r):
        out.alpha_composite(im.resize((im.width * S, im.height * S), Image.NEAREST), (x * cw, y * ch + ch - im.height * S))
out.save(sys.argv[1])
