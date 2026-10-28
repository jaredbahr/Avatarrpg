"""In-game before/after crops for ADR 0093's fault list, from two runs of e2e/grounding.review.ts (Canvas, N = 2).

python3 -I art/source/grounding/tools/scene_crops.py <shots dir> <before label> <after label> <out dir>
Each crop is before on the left, after on the right, at 2x nearest.
"""
import sys
from pathlib import Path

from PIL import Image

CROPS = [  # name, frame, box in the frame's screen px
    ('forest-keeper-lodge-and-woodpile', 'forest-wide-lodge-N2.png', (440, 0, 1080, 330)),
    ('forest-fences-and-signpost', 'forest-wide-road-N2.png', (980, 0, 1368, 300)),
    ('forest-milestone', 'forest-wide-bank-N2.png', (760, 50, 880, 140)),
    ('forest-quarry-blocks-on-the-bank', 'forest-wide-bank-N2.png', (1000, 250, 1160, 380)),
    ('forest-lantern-unchanged', 'forest-wide-bank-N2.png', (630, 0, 760, 200)),
    ('badan-market-corner', 'badan-wide-N2.png', (0, 0, 1368, 420)),
]


def main(shots, before, after, out):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    for name, frame, box in CROPS:
        a = Image.open(Path(shots, before, 'canvas', frame)).convert('RGB').crop(box)
        b = Image.open(Path(shots, after, 'canvas', frame)).convert('RGB').crop(box)
        row = Image.new('RGB', (a.width * 2 + 4, a.height), 'white')
        row.paste(a, (0, 0))
        row.paste(b, (a.width + 4, 0))
        scale = 1 if row.width > 1200 else 2
        row.resize((row.width * scale, row.height * scale), Image.NEAREST).save(out / f'{name}.png', optimize=True)
    print(len(CROPS), 'crops in', out)


if __name__ == '__main__':
    main(*sys.argv[1:5])
