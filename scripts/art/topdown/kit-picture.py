"""The kit picture (tool T1, `docs/level-design.md` sections 7 and 9) for Ba Dan: every object the set-piece plan uses, new and
reused, at its drawn size (1 art px per world px) on Ba Dan's baked ground, one row a set piece, Kaya's standing cel at the left of
each row for scale, at 3x nearest-neighbour. Also `new-pieces-3x.png`, a contact sheet of only the new pieces, and a table of each
piece's drawn height in figures against the plan's (a ratio far from 1 is off-scale).

    node --import tsx scripts/art/topdown/kit-plan.ts > plan.json     (the plan, exported from the TS)
    python3 scripts/art/topdown/kit-picture.py plan.json OUT_DIR      (kit-picture.png, new-pieces-3x.png, kit-table.txt)

It reads art from prototypes/topdown/assets (the sources the packers ship), public/art/topdown/kaya and ba-dan/ground.webp, and writes only to
OUT_DIR, outside the repository: pictures are evidence and are never committed. Kaya's standing cel is the 45 px figure of the scale chart.
Members with no art of their own (flats baked into the plate, the awning's posts, one sprite with the cloth) are listed, not drawn.
The rim row shows each tree sprite the layout uses and how many stand."""
import json, sys, re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[3]
A = ROOT / 'prototypes' / 'topdown' / 'assets'
SC = 3
FIG = 45.0
# every member's art file comes from the plan export (`kit-plan.ts`, which reads the layout's own table), so the picture can never drift from the game
FONT = ImageFont.load_default(10)


def load(rel):
    p = (A / rel).resolve()
    return Image.open(p).convert('RGBA') if p.exists() else None


def kaya():
    j = json.load(open(ROOT / 'public/art/topdown/kaya.json'))['frames']['unit.fire.kaya/idle/0']['frame']
    im = Image.open(ROOT / 'public/art/topdown/kaya.webp').convert('RGBA').crop((j['x'], j['y'], j['x'] + j['w'], j['y'] + j['h']))
    return im.crop(im.getbbox())


def ground_tile(h):
    g = Image.open(ROOT / 'public/art/topdown/ba-dan/ground.webp').convert('RGBA').crop((820, 470, 1100, 630))   # the east road and the grass below it, clear of the blockout's pads
    t = Image.new('RGBA', (1500, h))
    for x in range(0, 1500, g.width):
        for y in range(0, h, g.height): t.paste(g, (x, y))
    return t


def main(plan_path, out_dir):
    out = Path(out_dir); out.mkdir(parents=True, exist_ok=True)
    plan = json.load(open(plan_path)); K = kaya(); rows = []; table = []; missing = []
    for pc in plan['pieces']:
        if pc['bulk']:
            items = [(f'rim {k} x{v["count"]}', load(v['art'])) for k, v in plan['rim'].items()]
            items = [(n, i) for n, i in items if i]; plan_h = {}
        else:
            items = []; plan_h = {}
            for m in pc['members']:
                rel = m['art']
                if rel is None: missing.append(m['id']); continue
                im = load(rel)
                if im is None: missing.append(f"{m['id']} ({rel} not found)"); continue
                items.append((m['id'], im)); plan_h[m['id']] = m['height']
                table.append((pc['id'], m['id'], im.width, im.height, im.height / FIG, m['height'], m['w'] * 40))
        rows.append((pc['id'], items))
    # rows -> one picture, wrapped at 1500 px native
    W = 1500; blocks = []
    for pid, items in rows:
        lines = [[]]; x = K.width + 20
        for n, im in items:
            if x + im.width + 8 > W and lines[-1]: lines.append([]); x = K.width + 20
            lines[-1].append((n, im)); x += im.width + 8
        for li, line in enumerate(lines):
            h = max([K.height] + [im.height for _, im in line]) + 22
            blk = ground_tile(h); d = ImageDraw.Draw(blk); blk.alpha_composite(K, (6, h - 6 - K.height))
            x = K.width + 20; labels = []
            for n, im in line:
                blk.alpha_composite(im, (x, h - 6 - im.height)); labels.append((x, n, im)); x += im.width + 8
            blk = blk.crop((0, 0, max(x, 200), h)).resize((max(x, 200) * SC, h * SC), Image.NEAREST); d = ImageDraw.Draw(blk)
            d.text((4, 2), pid + (' (cont.)' if li else ''), fill=(255, 255, 255, 255), font=FONT, stroke_width=1, stroke_fill=(0, 0, 0, 255))
            for lx, n, im in labels:
                d.text((lx * SC, (h - 6) * SC + 2), n, fill=(255, 255, 255, 255), font=FONT, stroke_width=1, stroke_fill=(0, 0, 0, 255))
            blocks.append(blk)
    H = sum(b.height + 6 for b in blocks); WW = max(b.width for b in blocks)
    pic = Image.new('RGBA', (WW, H), (28, 23, 25, 255)); y = 0
    for b in blocks: pic.paste(b, (0, y)); y += b.height + 6
    pic.save(out / 'kit-picture.png')
    # the new pieces only
    man = json.load(open(A / 'objects_bd20' / 'manifest.json')); ims = [(k, Image.open(A / 'objects_bd20' / f'{k}.png').convert('RGBA')) for k in man]
    big = [(k, i) for k, i in ims if i.width > 60]; small = [(k, i) for k, i in ims if i.width <= 60]
    def sheet(group, cols_w):
        lines = [[]]; x = 0
        for k, i in group:
            if x + max(i.width + 10, 62) > cols_w and lines[-1]: lines.append([]); x = 0
            lines[-1].append((k, i)); x += max(i.width + 10, 62)
        hs = [max(i.height for _, i in ln) + 18 for ln in lines]
        c = Image.new('RGBA', (cols_w, sum(hs) + 6), (150, 140, 120, 255)); d = ImageDraw.Draw(c); y = 0
        for ln, h in zip(lines, hs):
            x = 4
            for k, i in ln: c.alpha_composite(i, (x, y + h - 14 - i.height)); d.text((x, y + h - 12), f'{k[:7]} {i.width}x{i.height}', fill=(255, 255, 255, 255), font=ImageFont.load_default(8), stroke_width=1, stroke_fill=(0, 0, 0, 255)); x += max(i.width + 10, 62)
            y += h
        return c
    s1 = sheet(big, 480); s2 = sheet([('kaya 45px', K)] + small, 480)
    cs = Image.new('RGBA', (480, s1.height + s2.height), (150, 140, 120, 255)); cs.paste(s1, (0, 0)); cs.paste(s2, (0, s1.height))
    cs.resize((cs.width * SC, cs.height * SC), Image.NEAREST).save(out / 'new-pieces-3x.png')
    with open(out / 'kit-table.txt', 'w') as f:
        f.write('piece | member | drawn w x h | drawn figures | plan figures | ratio | footprint px\n')
        for pid, mid, w, h, fg, pf, fw in table: f.write(f'{pid} | {mid} | {w}x{h} | {fg:.2f} | {pf:.2f} | {fg / pf if pf else 0:.2f} | {fw:.0f}\n')
        f.write('\nno art found or mapped: ' + ', '.join(missing) + '\n')
    print(f'{len(table)} members drawn, {len(missing)} unmapped; wrote {out}')


if __name__ == '__main__': main(sys.argv[1], sys.argv[2])
