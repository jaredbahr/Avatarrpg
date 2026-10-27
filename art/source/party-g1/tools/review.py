"""Review sheets and measurements for the party G1 comparison (no PixelLab calls).

usage (repo root, after extract.py, reduce.py, select_a.py and mock.py):  python3 art/source/party-g1/tools/review.py
Writes art/source/party-g1/review/:
  crops-4x.png          4x nearest crops of the three mocks (rows current, A, B): each figure's head, hands and feet in place
  faces-native-8x.png   the S, SE, E idle heads at 8x on the world grid (current reduced 0.5 Lanczos, A, B)
  rotations-a-vs-b.png  all eight headings, A (native rotations) over B (reduced shipped idles), 4x
  idle-sheet.png        S, SE, E idles, 4 cels each, current | A | B, 4x
  walk-strip-se.png     the 12-cel south-east walk, current | A | B per character, 4x
  walk-se.gif           the three walks side by side, 3x, 90 ms per cel
  metrics.json          boil, colour count, contour and foot measurements (definitions inside)
"Current" at world scale is the shipped cel at 0.5 Lanczos, the nearest still image to what the game draws (it filters the
sheet down on the GPU); A and B are shown as they are, pixel for pixel.
"""
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent.parent
REV = HERE / 'review'
CHARS = ['kaya', 'sura', 'bo']; V = ['current', 'a', 'b']
DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
BG = (150, 140, 110, 255)
CONTOUR = np.array([0x1b, 0x14, 0x10])


def cel(v, char, kind, d, i):
    """64x96 world-px cel, foot baseline at y 81.6."""
    if v == 'current': return Image.open(HERE / f'ref/{char}/{kind}/{d}/{i:02d}.png').convert('RGBA').resize((64, 96), Image.LANCZOS)
    if v == 'b': return Image.open(HERE / f'b/{char}/{kind}/{d}/{i:02d}.png').convert('RGBA')
    p = HERE / f'a/{char}/{kind}/{d}/{i:02d}.png'
    if not p.exists(): p = HERE / f'a/{char}/rotations/{d}.png'
    return Image.open(p).convert('RGBA').crop((16, 0, 80, 96))


def grid(cells, cols, cw, ch, z, label_rows=None, gap=0):
    rows = (len(cells) + cols - 1) // cols
    out = Image.new('RGBA', (cols * cw * z + (cols - 1) * gap, rows * ch * z), BG)
    for k, im in enumerate(cells):
        r, c = divmod(k, cols)
        if im is not None: out.alpha_composite(im.resize((cw * z, ch * z), Image.NEAREST), (c * (cw * z + gap), r * ch * z))
    return out


def labelled(im, rows, h):
    """Left-hand row labels (plain names, no verdicts)."""
    out = Image.new('RGBA', (im.width + 120, im.height), (24, 24, 24, 255)); out.alpha_composite(im, (120, 0)); d = ImageDraw.Draw(out)
    for k, t in enumerate(rows): d.text((6, k * h + h // 2 - 6), t, fill=(235, 235, 235))
    return out


def boil(a, b):
    """Share of the union silhouette whose colour differs (sum |dRGBA| > 60) after the best whole-body shift of up to 2 world
    px (the residents' review.py measure, its 3 sheet px shift scaled to the world grid)."""
    A = np.asarray(a).astype(int); B = np.asarray(b).astype(int); best = 1.0
    for dx in range(-2, 3):
        for dy in range(-2, 3):
            Bs = np.roll(np.roll(B, dy, 0), dx, 1); m = (A[..., 3] > 0) | (Bs[..., 3] > 0)
            if m.sum(): best = min(best, float(((np.abs(A - Bs).sum(2) > 60) & m).sum() / m.sum()))
    return best


def colours(im):
    a = np.asarray(im); return int(len(np.unique(a[a[..., 3] > 0].reshape(-1, 4), axis=0)))


def contour(im):
    """Silhouette edge pixels: share within 40 (sum |dRGB|) of #1b1410, and share that is semi-transparent (soft edge)."""
    a = np.asarray(im).astype(int); op = a[..., 3] > 0
    p = np.pad(op, 1); edge = op & ~(p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:])
    e = a[edge]
    return round(float((np.abs(e[:, :3] - CONTOUR).sum(1) < 40).mean()), 3), round(float((e[:, 3] < 255).mean()), 3)


def foot(im):
    ys = np.nonzero(np.asarray(im)[..., 3] > 127)[0]; return int(ys.max())


def metrics():
    M = {'definitions': {
        'idle_boil': 'max over consecutive idle cel pairs (wrapping) of the boil measure; Kaya shipped idles measure 6-17% at sheet scale (residents README)',
        'colours': 'mean distinct opaque RGBA per cel',
        'contour_dark': 'share of silhouette edge pixels within 40 of #1b1410', 'edge_soft': 'share of silhouette edge pixels that are semi-transparent',
        'walk_foot_rows': 'lowest opaque row of each walk cel (world px); the spread is how far the baseline moves'}}
    for c in CHARS:
        for v in V:
            r = {}
            for d in ['south', 'south-east', 'east']:
                cs = [cel(v, c, 'idle', d, i) for i in range(4)]
                r[f'idle_boil_{d}'] = round(max(boil(cs[i], cs[(i + 1) % 4]) for i in range(4)), 3)
                r[f'colours_{d}'] = round(float(np.mean([colours(x) for x in cs])), 1)
                r[f'contour_dark_{d}'], r[f'edge_soft_{d}'] = contour(cs[0])
            w = [cel(v, c, 'walk', 'south-east', i) for i in range(12)]
            r['walk_foot_rows'] = [foot(x) for x in w]
            r['walk_boil_consecutive_max'] = round(max(boil(w[i], w[(i + 1) % 12]) for i in range(12)), 3)
            r['walk_colours'] = round(float(np.mean([colours(x) for x in w])), 1)
            M[f'{c}/{v}'] = r
    return M


if __name__ == '__main__':
    REV.mkdir(exist_ok=True)
    # mocks: crops around each figure (painting px; feet from mock.py's print, iPad frame)
    feet = {'bo': (636, 285), 'kaya': (828, 381), 'sura': (732, 621)}
    mocks = {v: Image.open(REV / f'mock-{v}-ipad.webp').convert('RGBA') for v in V}
    cells = []
    for v in V:
        for c in CHARS:
            fx, fy = feet[c]
            cells.append(mocks[v].crop((fx - 36, fy - 132, fx + 36, fy + 12)))   # whole figure, head to contact shadow
    sheet = grid(cells, 3, 72, 144, 4, gap=8); labelled(sheet, ['current', 'A native', 'B reduced'], 144 * 4).save(REV / 'crops-4x.png')
    # native faces at 8x
    cells = []
    for v in V:
        for c in CHARS:
            for d in ['south', 'south-east', 'east']: cells.append(cel(v, c, 'idle', d, 0).crop((20, 18, 44, 50)))
    labelled(grid(cells, 9, 24, 32, 8, gap=4), ['current', 'A native', 'B reduced'], 32 * 8).save(REV / 'faces-native-8x.png')
    # rotations
    cells = [cel(v, c, 'idle', d, 0).crop((8, 16, 56, 84)) for c in CHARS for v in ['a', 'b'] for d in DIRS]
    labelled(grid(cells, 8, 48, 68, 4), [f'{c} {v}' for c in CHARS for v in ['A', 'B']], 68 * 4).save(REV / 'rotations-a-vs-b.png')
    # idles
    cells = [cel(v, c, 'idle', d, i).crop((8, 16, 56, 84)) for c in CHARS for d in ['south', 'south-east', 'east'] for v in V for i in range(4)]
    labelled(grid(cells, 12, 48, 68, 4), [f'{c} {d}' for c in CHARS for d in ['S', 'SE', 'E']], 68 * 4).save(REV / 'idle-sheet.png')
    # walk strip + gif
    cells = [cel(v, c, 'walk', 'south-east', i).crop((8, 16, 56, 84)) for c in CHARS for v in V for i in range(12)]
    labelled(grid(cells, 12, 48, 68, 4), [f'{c} {v}' for c in CHARS for v in ['current', 'A', 'B']], 68 * 4).save(REV / 'walk-strip-se.png')
    frames = []
    for i in range(12):
        f = Image.new('RGBA', (9 * 48 * 3, 68 * 3), BG)
        for k, (c, v) in enumerate([(c, v) for c in CHARS for v in V]):
            f.alpha_composite(cel(v, c, 'walk', 'south-east', i).crop((8, 16, 56, 84)).resize((144, 204), Image.NEAREST), (k * 144, 0))
        frames.append(f.convert('RGB').quantize(255, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))
    frames[0].save(REV / 'walk-se.gif', save_all=True, append_images=frames[1:], duration=90, loop=0)
    M = metrics(); json.dump(M, open(REV / 'metrics.json', 'w'), indent=1)
    for k, r in M.items():
        if k != 'definitions': print(k, {q: r[q] for q in r if 'boil' in q or q.startswith('colours_s') or q.startswith('contour_dark_s') or q == 'walk_foot_rows'})
