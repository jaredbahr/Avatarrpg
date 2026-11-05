"""3x crop, optionally before|after: q13crop.py out.png level x y w h  [before_prefix after_prefix]  (nearest, caption with file mtime)"""
import sys, os, time
from PIL import Image, ImageDraw
out, level, x, y, w, h = sys.argv[1], sys.argv[2], *map(int, sys.argv[3:7]); pres = sys.argv[7:] or ['w/after']
ims = []
for p in pres:
    f = f'{p}_{level}.png'; im = Image.open(f).convert('RGB').crop((x, y, x + w, y + h)).resize((w * 3, h * 3), Image.NEAREST)
    d = ImageDraw.Draw(im); d.rectangle((0, 0, 330, 14), fill=(0, 0, 0)); d.text((3, 1), f'{f} {time.strftime("%H:%M:%S", time.gmtime(os.path.getmtime(f)))}', fill=(255, 255, 255)); ims.append(im)
W = Image.new('RGB', (sum(i.width for i in ims) + 6 * (len(ims) - 1), ims[0].height), (255, 0, 255)); xx = 0
for i in ims: W.paste(i, (xx, 0)); xx += i.width + 6
W.save(out); print(out, W.size)
