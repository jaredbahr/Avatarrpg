"""Crop named regions of an overview PNG and scale them up nearest. Usage: t13crop.py in.png out.png scale x,y,w,h [x,y,w,h ...]"""
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGB'); s = int(sys.argv[3])
rs = [tuple(map(int, a.split(','))) for a in sys.argv[4:]]
cs = [im.crop((x, y, x + w, y + h)).resize((w * s, h * s), Image.NEAREST) for x, y, w, h in rs]
W = sum(c.width for c in cs) + 8 * (len(cs) - 1); H = max(c.height for c in cs)
out = Image.new('RGB', (W, H), (28, 23, 25)); x = 0
for c in cs: out.paste(c, (x, 0)); x += c.width + 8
out.save(sys.argv[2])
