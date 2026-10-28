"""Before/after sheets for ADR 0093 from two runs of e2e/grounding.review.ts.

python3 -I art/source/grounding/tools/sheets.py <shots dir> <before label> <after label> art/source/grounding/review
Each sheet is before on the left, after on the right, one row per capture; wide frames at half size, 4x crops as
captured, the walk strip before above after.
"""
import sys
from pathlib import Path

from PIL import Image

SHEETS = {
    'wide-badan': ['badan-wide-N3.png'],
    'wide-forest': ['forest-wide-bank-N2.png'],
    'feet-badan': ['badan-feet-kaya-N3-4x.png', 'badan-feet-lw-npc-gao-N3-4x.png', 'badan-feet-lw-npc-mira-N3-4x.png'],
    'feet-forest': ['forest-bank-enemy-bandit-thug-N2-4x.png', 'forest-road-party-bo-N2-4x.png',
                    'forest-bank-enemy-bandit-slinger-N3-4x.png'],
    'props-forest': ['forest-bank-prop-oil-flask-13-6-N2-4x.png', 'forest-bank-prop-hay-bale-12-5-N2-4x.png',
                     'forest-bank-prop-water-barrel-14-4-N2-4x.png', 'forest-bank-prop-water-barrel-15-3-N2-4x.png'],
}


def pair(before, after, scale):
    a, b = (Image.open(p).convert('RGB') for p in (before, after))
    if scale != 1:
        a, b = (im.resize((round(im.width * scale), round(im.height * scale)), Image.NEAREST) for im in (a, b))
    row = Image.new('RGB', (a.width + b.width + 8, max(a.height, b.height)), 'white')
    row.paste(a, (0, 0))
    row.paste(b, (a.width + 8, 0))
    return row


def stack(rows, gap=8):
    out = Image.new('RGB', (max(r.width for r in rows), sum(r.height for r in rows) + gap * (len(rows) - 1)), 'white')
    y = 0
    for r in rows:
        out.paste(r, (0, y))
        y += r.height + gap
    return out


def main(shots, before_label, after_label, dest):
    for backend in ('canvas', 'webgl'):
        before, after = Path(shots, before_label, backend), Path(shots, after_label, backend)
        out = Path(dest, backend)
        out.mkdir(parents=True, exist_ok=True)
        for name, files in SHEETS.items():
            rows = [pair(before / f, after / f, 0.5 if name.startswith('wide') else 1)
                    for f in files if (before / f).exists() and (after / f).exists()]
            if rows:
                stack(rows).save(out / f'{name}.png', optimize=True)
        strips = [Image.open(d / 'badan-walk-strip.png').convert('RGB') for d in (before, after)
                  if (d / 'badan-walk-strip.png').exists()]
        if strips:
            stack(strips).save(out / 'walk-strip.png', optimize=True)


if __name__ == '__main__':
    main(*sys.argv[1:5])
