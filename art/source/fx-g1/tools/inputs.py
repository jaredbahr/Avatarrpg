"""Builds the PixelLab input sheets for the G1 effects pass from the shipped art.

Run from the repo root:  python3 -I art/source/fx-g1/tools/inputs.py

Sources (both shipped, both pinned by the TS packer `scripts/art/fx-g1.ts`):
- the painted bend page `public/art/fx/bend-fx.webp` + `.json` (ADR 0055): every cel is
  reduced 2:1 to world px (the page is 128 px a tile, the world 64), area-averaged on
  premultiplied alpha;
- the element cel sheets `public/art/fx/<name>-cels.png` (ADR 0021): every 192 px cel is
  reduced 2:1 to the 96 px master.

Cels are laid on 256 px sheets with clear gutters, transparent, and the layout written to
`art/source/fx-g1/layout.json`, which the packer reads to cut the generated sheets back.
Writes `art/raw/fx-g1/inputs/*.png` (ignored). Deterministic: no randomness, fixed order.
"""
import json, os
from PIL import Image

OUT = 'art/raw/fx-g1/inputs'
LAYOUT = 'art/source/fx-g1/layout.json'
SHEET = 256
GUTTER = 12


def half(img):
    w, h = (img.width + 1) // 2, (img.height + 1) // 2
    pad = Image.new('RGBA', (w * 2, h * 2), (0, 0, 0, 0))
    pad.paste(img, (0, 0))
    return pad.convert('RGBa').resize((w, h), Image.BOX).convert('RGBA')


def shelves(items, sheet_prefix):
    """items: (name, image). Shelf-packs them into as few SHEET squares as fit."""
    sheets, placed = [], []
    x = y = GUTTER
    row = 0
    cur = Image.new('RGBA', (SHEET, SHEET), (0, 0, 0, 0))
    for name, img in items:
        if img.width + 2 * GUTTER > SHEET or img.height + 2 * GUTTER > SHEET:
            raise SystemExit(f'{name} is too large for a sheet')
        if x + img.width + GUTTER > SHEET:
            x, y, row = GUTTER, y + row + GUTTER, 0
        if y + img.height + GUTTER > SHEET:
            sheets.append(cur)
            cur = Image.new('RGBA', (SHEET, SHEET), (0, 0, 0, 0))
            x = y = GUTTER
            row = 0
        sheet = f'{sheet_prefix}-{len(sheets)}'
        cur.paste(img, (x, y))
        placed.append({'name': name, 'sheet': sheet, 'x': x, 'y': y, 'w': img.width, 'h': img.height})
        x += img.width + GUTTER
        row = max(row, img.height)
    sheets.append(cur)
    return sheets, placed


def main():
    os.makedirs(OUT, exist_ok=True)
    layout = {'sheet': SHEET, 'gutter': GUTTER, 'bend': [], 'cels': []}
    page = json.load(open('public/art/fx/bend-fx.json'))
    atlas = Image.open('public/art/fx/bend-fx.webp').convert('RGBA')
    groups = {}
    for name, entry in page['frames'].items():
        f = entry['frame']
        element = name.split('.')[1]
        cel = atlas.crop((f['x'], f['y'], f['x'] + f['w'], f['y'] + f['h']))
        groups.setdefault(element, []).append((name, half(cel)))
    for element in ['fire', 'earth', 'water']:
        sheets, placed = shelves(groups[element], f'bend-{element}')
        for i, s in enumerate(sheets):
            s.save(f'{OUT}/bend-{element}-{i}.png')
        layout['bend'] += placed

    from_ts = open('src/content/fxCels.ts').read()
    sheets_def = [('fire', ['flame', 'fire-burst', 'lightning']), ('water', ['splash', 'ice', 'healing']),
                  ('earth', ['boulder', 'earth-rise', 'metal']), ('air', ['wind', 'cyclone', 'cushion']),
                  ('flask', ['flask'])]
    for sheet, clips in sheets_def:
        assert f"art/fx/{sheet}-cels.png" in from_ts
        img = Image.open(f'public/art/fx/{sheet}-cels.png').convert('RGBA')
        for row, clip in enumerate(clips):
            items = [(f'{clip}/{col}', half(img.crop((col * 192, row * 192, col * 192 + 192, row * 192 + 192))))
                     for col in range(4)]
            # Two by two, 96 px masters with 16 px gutters, centred on the 256 sheet.
            s = Image.new('RGBA', (SHEET, SHEET), (0, 0, 0, 0))
            g = (SHEET - 2 * 96) // 3
            for i, (name, cel) in enumerate(items):
                x, y = g + (i % 2) * (96 + g), g + (i // 2) * (96 + g)
                s.paste(cel, (x, y))
                layout['cels'].append({'name': name, 'sheet': f'cel-{clip}', 'x': x, 'y': y, 'w': 96, 'h': 96})
            s.save(f'{OUT}/cel-{clip}.png')
    json.dump(layout, open(LAYOUT, 'w'), indent=1)
    print(sorted({p['sheet'] for p in layout['bend'] + layout['cels']}))


if __name__ == '__main__':
    main()
