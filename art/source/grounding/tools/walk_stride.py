"""How far a G walk's planted foot travels in its art, against how far the game moves the figure (ADR 0093).

For each heading of a 12-cel party walk (or an 8-cel enemy walk), finds the sole (the opaque pixels on the lowest
two rows of each cel) and reports how far it moves across the cycle in the art, and how far the game carries the
figure over the same cels: G_STRIDE_TILES (1.825 logical tiles) per loop, ADR 0067, through the oblique projection
(one logical tile is 64 world px across). On the ground, a planted foot should travel backwards in the cel as fast as
the figure moves forwards; the ratio below is how much of the travel the art's feet account for. 1.0 is no slide.

python3 -I art/source/grounding/tools/walk_stride.py kaya-g unit.fire.kaya 12
"""
import json
import math
import sys
from pathlib import Path

from PIL import Image

STRIDE_TILES = 1.825  # src/content/assets/manifest.ts G_STRIDE_TILES
HEADINGS = {
    'walk': (1, 0), 'walkSouthEast': (1, 1), 'walkSouth': (0, 1), 'walkSouthWest': (-1, 1),
    'walkWest': (-1, 0), 'walkNorthWest': (-1, -1), 'walkNorth': (0, -1), 'walkNorthEast': (1, -1),
}


def px_per_tile(screen):
    """World px of screen travel per logical tile along a screen heading, under x - y, (x + y) / 2."""
    ux, uy = screen
    n = math.hypot(ux, uy)
    ux, uy = ux / n, uy / n
    lx, ly = uy + ux / 2, uy - ux / 2  # the logical direction that projects onto it
    ln = math.hypot(lx, ly)
    lx, ly = lx / ln, ly / ln
    return 64 * math.hypot(lx - ly, (lx + ly) / 2)


def soles(atlas, key, clip, frames):
    data = json.loads(Path(f'public/art/units/{atlas}.json').read_text())
    sheet = Image.open(Path('public/art/units') / data['meta']['image']).convert('RGBA')
    out = []
    for i in range(frames):
        r = data['frames'][f'{key}/{clip}/{i}']['frame']
        cel = sheet.crop((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h']))
        a = cel.getchannel('A').load()
        pts = [(x, y) for y in range(cel.height) for x in range(cel.width) if a[x, y] > 128]
        bottom = max(y for _, y in pts)
        sole = [(x, y) for x, y in pts if y >= bottom - 1]
        out.append((sum(x for x, _ in sole) / len(sole), bottom))
    return out


def main(atlas, key, frames):
    print(f'{atlas}: art sole travel per loop vs game travel per loop (world px)')
    for clip, screen in HEADINGS.items():
        s = soles(atlas, key, clip, frames)
        # The sole's path round the loop, horizontal and vertical; a planted foot's share of it is the stride.
        path = sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(s, s[1:] + s[:1]))
        art = path / 2  # out and back: each foot covers the stride once planted, once swinging
        game = px_per_tile(screen) * STRIDE_TILES
        lift = max(b for _, b in s) - min(b for _, b in s)
        print(f'  {clip:14s} art {art:5.1f}  game {game:6.1f}  ratio {art / game:4.2f}  sole lift {lift} px')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], int(sys.argv[3]))
