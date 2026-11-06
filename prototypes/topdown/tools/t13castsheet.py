"""The new cast's sprite sheet: for each figure, every heading (rows) of idle frame 0, walk frames 0/2/4/6, and the strike frame of
each posed clip; plus the Driller's eight views. Written at 3x as cast-sheet.png. Reads the atlases build_b3.py packed."""
import json
from pathlib import Path
from PIL import Image, ImageDraw
H = Path(__file__).resolve().parent.parent; A = H / 'assets' / 'chars'; CELL = 80
D8 = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
CAST = [('kaya2', ['blast']), ('fc_sura', ['idle', 'walk', 'attack', 'ice', 'heal']), ('fc_bo', ['idle', 'walk', 'attack', 'wall', 'stance']),
        ('fc_thug', ['idle', 'walk', 'attack']), ('fc_slinger', ['idle', 'walk', 'attack']), ('fc_bruiser', ['idle', 'walk', 'attack']),
        ('t13_deserter', ['idle', 'walk', 'attack', 'throw']), ('t13_qbender', ['idle', 'walk', 'attack']), ('t13_merc', ['idle', 'walk', 'attack']),
        ('t13_xbow', ['idle', 'walk', 'attack']), ('t13_ruon', ['idle', 'walk', 'attack'])]
def cells(folder, clip):
    p = A / folder / f'{clip}_atlas.png'
    if not p.exists(): return None
    at = Image.open(p).convert('RGBA'); n = at.width // CELL
    pick = [0] if clip == 'idle' else [0, 2, 4, 6] if clip == 'walk' else [n // 2]
    return at, pick
blocks = []
for folder, clips in CAST:
    cols = []
    for c in clips:
        r = cells(folder, c)
        if r: cols.append((c, r))
    w = sum(len(p) for _, (_, p) in cols) * 56; blk = Image.new('RGBA', (w + 4, 8 * 60 + 14), (120, 112, 96, 255)); x = 2
    d = ImageDraw.Draw(blk); d.text((2, 0), folder.replace('t13_', '').replace('fc_', ''), fill=(28, 23, 25))
    for c, (at, pick) in cols:
        rows = at.height // CELL
        for f in pick:
            for r in range(rows): blk.alpha_composite(at.crop((f * CELL + 12, r * CELL + 10, f * CELL + 68, r * CELL + 72)), (x - 2, 12 + r * 60))
            x += 56
    blocks.append(blk)
W = sum(b.width for b in blocks) + 4 * len(blocks); Hh = max(b.height for b in blocks)
sheet = Image.new('RGBA', (W, Hh + 110), (90, 84, 74, 255)); x = 0
for b in blocks: sheet.alpha_composite(b, (x, 0)); x += b.width + 4
x = 4
for d in D8:
    im = Image.open(H / 'assets' / 'objects13' / f"driller_{d.replace('-', '')}.png").convert('RGBA'); sheet.alpha_composite(im, (x, Hh + 4)); x += im.width + 6
sheet.resize((sheet.width * 2, sheet.height * 2), Image.NEAREST).save(H / 'cast-sheet.png'); print(sheet.size)
