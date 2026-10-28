"""Write a 512x512 black/white mask from boxes or ellipses: mask.py OUT shape:x0,y0,x1,y1 ...  (shape = box | oval).
White is repainted, black is kept. Masks are part of the recipe, so they are committed in ../masks/."""
import sys
from PIL import Image, ImageDraw

out, *shapes = sys.argv[1:]
m = Image.new('RGB', (512, 512), 'black'); d = ImageDraw.Draw(m)
for s in shapes:
    kind, box = s.split(':'); box = [int(v) for v in box.split(',')]
    (d.ellipse if kind == 'oval' else d.rectangle)(box, fill='white')
m.save(out)
