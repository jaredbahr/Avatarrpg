"""Kaya polish, step 11: the turntable (review/kaya-polish/turntable-*.png), every clip in every heading she draws, 4x
nearest on the world's paving colour, rows in the engine's HEADINGS order. Cels are cut to the figure's box on their canvas
(128 px cels: x 28-100, y 26-122; 192 px cels: x 36-156, y 52-162) so the poses are large enough to judge.

- turntable-locomotion.png: idle (2), rest, walk (6), stance (2), hit (stance + 3);
- turntable-bend.png: the bend's twelve cels (0-11; cel 7 is not drawn, the set holds cel 6 there);
- turntable-ko.png: the four knockouts (stance + 6);
- turntable-riverside.png: wave (2) and tea (2).

usage (repo root): python3 -I art/source/party-world/tools/kp_review.py"""
from pathlib import Path
from PIL import Image, ImageDraw
HERE = Path(__file__).resolve().parent.parent
C = HERE / 'cels/kaya'; OUT = HERE / 'review/kaya-polish'
HEADINGS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east']
BG, INK, S = (128, 116, 92, 255), (30, 24, 18, 255), 4
BOX = {128: (28, 26, 100, 122), 192: (36, 52, 156, 162)}
LABEL = 14   # px a label row at 1x


def sheet(name, rows, cols_label):
    """rows: [(row label, [path or None, ...])], all cels one canvas size."""
    size = Image.open(next(p for _, r in rows for p in r if p)).width; x0, y0, x1, y1 = BOX[size]; w, h = x1 - x0, y1 - y0
    ncol = max(len(r) for _, r in rows); left = 80
    im = Image.new('RGBA', (left + w * ncol, LABEL + h * len(rows)), BG); d = ImageDraw.Draw(im)
    for k, t in enumerate(cols_label): d.text((left + k * w + 2, 2), t, fill=INK)
    for r, (lab, cels) in enumerate(rows):
        d.text((4, LABEL + r * h + h // 2 - 5), lab, fill=INK)
        for k, p in enumerate(cels):
            if p: im.alpha_composite(Image.open(p).convert('RGBA').crop((x0, y0, x1, y1)), (left + k * w, LABEL + r * h))
        d.line([(0, LABEL + r * h), (im.width, LABEL + r * h)], fill=(110, 100, 80, 255))
    im = im.resize((im.width * S, im.height * S), Image.NEAREST)
    OUT.mkdir(parents=True, exist_ok=True); im.convert('RGB').save(OUT / f'turntable-{name}.png', optimize=True)
    print(name, im.size)


if __name__ == '__main__':
    cols = ['idle 0', 'idle 1', 'rest'] + [f'walk {i}' for i in range(6)] + ['stance 0', 'stance 1'] + [f'hit {i}' for i in range(4)]
    rows = []
    for d in HEADINGS:
        rows.append((d, [C / f'idle/{d}/00.png', C / f'idle/{d}/01.png', C / f'rest/{d}/00.png'] + [C / f'walk/{d}/{i:02d}.png' for i in range(6)]
                     + [C / f'stance/{d}/{i:02d}.png' for i in range(2)] + [C / f'hit/{d}/{i:02d}.png' for i in range(4)]))
    sheet('locomotion', rows, cols)
    rows = [(d, [C / f'bend/{d}/{i:02d}.png' if (C / f'bend/{d}/{i:02d}.png').exists() else None for i in range(12)]) for d in HEADINGS]
    sheet('bend', rows, [f'bend {i}' for i in range(12)])
    rows = [(d, [C / f'ko/{d}/{i:02d}.png' for i in range(7)]) for d in ['south-east', 'south-west', 'north-west', 'north-east']]
    sheet('ko', rows, [f'ko {i}' for i in range(7)])
    sheet('riverside', [('wave', [C / 'riverside/wave-0.png', C / 'riverside/wave-1.png']), ('tea', [C / 'riverside/tea-0.png', C / 'riverside/tea-1.png'])],
          ['0', '1'])
