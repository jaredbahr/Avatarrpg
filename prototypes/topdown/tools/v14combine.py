"""before|after crops with file timestamps: v14combine.py  -> qcrops/houses-<name>-{1x,3x}.png (1x shown at 3x nearest so it can be inspected; the pixels are the 1x game's)"""
import sys, os, time
from PIL import Image, ImageDraw
names = ['gao', 'mira', 'ne', 'pella', 'merchant', 'se']
for n in names:
    for z in ('1x', '3x'):
        ims = []
        for pre in ('before', 'after'):
            f = f'v14/shots/{pre}_house_{n}_{z}.png'; im = Image.open(f).convert('RGB')
            if z == '1x': im = im.resize((im.width * 3, im.height * 3), Image.NEAREST)
            else: im = im.crop((0, 0, 780, 960)) if n != 'merchant' else im.crop((0, 0, 900, 960))
            d = ImageDraw.Draw(im); d.rectangle((0, 0, 360, 14), fill=(0, 0, 0)); d.text((3, 1), f'{pre} {z} {time.strftime("%H:%M:%S", time.gmtime(os.path.getmtime(f)))}', fill=(255, 255, 255)); ims.append(im)
        W = Image.new('RGB', (sum(i.width for i in ims) + 6, max(i.height for i in ims)), (255, 0, 255)); x = 0
        for i in ims: W.paste(i, (x, 0)); x += i.width + 6
        W.save(f'qcrops/houses-{n}-{z}.png'); print(f'qcrops/houses-{n}-{z}.png', W.size)
