import json
from PIL import Image, ImageDraw, ImageFont
D8 = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
CELL = 80; CROP = (10, 14, 70, 76); CW, CH = CROP[2] - CROP[0], CROP[3] - CROP[1]; GAP = 2; LW = 64
F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 9)
src = open('topdown-demo.html').read()
meta = json.loads(src.split('const ASSETS = ', 1)[1].split(';\n', 1)[0])
BLOCKS = [('kaya', 'walk', 'Kaya walk (skeleton-v3 custom, 12 frames)'), ('kaya', 'idle', 'Kaya breathing idle (12 frames)'),
          ('kaya', 'look', 'Kaya look-around (15 frames)'), ('kaya', 'rot', 'Kaya rotations'),
          ('villager', 'walk', 'Villager walk (12 frames)'), ('villager', 'idle', 'Villager idle (12 frames)'),
          ('shopkeeper', 'idle', 'Shopkeeper idle (12 frames)'), ('cat', 'walk', 'Cat walk (template walk-8-frames, skeleton-v3)'), ('cat', 'sit', 'Cat seated idle (10 frames)')]
FOLDER = {'kaya': 'kaya2', 'villager': 'vill2', 'shopkeeper': 'shop2', 'cat': 'cat2'}
ncol = 15
H = sum(14 + (1 if b[1] == 'rot' else len(meta['chars'][b[0]][b[1]]['dirs'])) * (CH + GAP) + 6 for b in BLOCKS)
W = LW + ncol * (CW + GAP)
img = Image.new('RGBA', (W, H), (86, 104, 82, 255)); dr = ImageDraw.Draw(img); y = 0
for c, clip, title in BLOCKS:
    m = meta['chars'][c][clip]; atlas = Image.open(f'assets/chars/{FOLDER[c]}/{clip}_atlas.png')
    dr.text((2, y + 2), title.upper(), fill=(240, 232, 210, 255), font=F); y += 14
    if clip == 'rot':
        for r, d in enumerate(m['dirs']):
            x = LW + r * (CW + GAP); dr.rectangle([x, y, x + CW - 1, y + CH - 1], fill=(96, 116, 92, 255))
            img.alpha_composite(atlas.crop((CROP[0], r * CELL + CROP[1], CROP[2], r * CELL + CROP[3])), (x, y))
            dr.text((x + 1, y + CH - 10), d.replace('south', 'S').replace('north', 'N').replace('east', 'E').replace('west', 'W').replace('-', ''), fill=(240, 232, 210, 255), font=F)
        y += CH + GAP
    else:
        for r, d in enumerate(m['dirs']):
            dr.text((2, y + CH // 2 - 5), d, fill=(230, 225, 200, 255), font=F)
            for i in range(m['frames']):
                cellim = atlas.crop((i * CELL + CROP[0], r * CELL + CROP[1], i * CELL + CROP[2], r * CELL + CROP[3]))
                if not cellim.getbbox(): continue
                x = LW + i * (CW + GAP); dr.rectangle([x, y, x + CW - 1, y + CH - 1], fill=(96, 116, 92, 255))
                dr.line([x, y + 70 - CROP[1], x + CW - 1, y + 70 - CROP[1]], fill=(110, 132, 104, 255))
                img.alpha_composite(cellim, (x, y))
            y += CH + GAP
    y += 6
img.resize((W * 4, H * 4), Image.NEAREST).save('spritesheet-4x.png'); print(img.size)
