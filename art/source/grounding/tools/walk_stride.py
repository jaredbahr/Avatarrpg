"""How far a G1 locomotion clip's planted foot slides against the ground the game moves the figure over (ADR 0093, 0095).

For each heading of a shipped walk, jog or stroll clip it finds the planted foot in every stance cel pair and compares its
travel in the art with the figure's travel in the game over the same cel:

- **Planted foot.** The cels where the mocap take has that foot on the ground (world-frame ankle speed under 1 m/s, from
  the family's `motion.json` spec), both ends of a pair planted. Its sole is the lowest two rows of the opaque pixels
  nearer that foot's requested ankle (the motion design, placed as the packer placed the cel: `pack.json` walkDx and
  idleDy + walkDy) than the other's.
- **Game travel.** A move along the logical grid shows on a heading clip at its real screen direction: east and west are
  the logical diagonals (90.5 world px a tile), north and south the other diagonals (45.3), and the four screen
  diagonals the logical axes at a slope of one half (71.6). The clip plays `cel_ms` of clip time a cel and
  `ms_per_tile[heading]` a tile (`src/content/assets/manifest.ts`), so the figure moves ppt * cel_ms / ms_per_tile world
  px a cel, whatever the pace (the clip time is distance-phased, ADR 0050).
- **Slide** is their sum along the heading (the sole should move back exactly as far as the figure moves on), in world
  px a stance cel at the oblique figure scale `--scale` (default 1.0: one art px a world px). `fit` is the tiles a loop
  the drawn feet cover, which is the `ms_per_tile` (cycle / fit) that would make the mean slide zero.

The old sole-path ratio (ADR 0093's first measure: lowest two rows of the whole cel, half its loop path, over the game's
loop travel) is kept as `ratio` for comparison with the earlier tables.

python3 -I art/source/grounding/tools/walk_stride.py party-g1 kaya walk --cel-ms 114 --tiles 1.825   # ADR 0067's timing
python3 -I art/source/grounding/tools/walk_stride.py residents-g1 thug jog --manifest                  # as it ships
(--tiles: one number, or east, diagonal, north/south loop lengths in tiles; --manifest reads the clip's fps and the sheet's
clip time a tile from src/content/assets/manifest.ts instead, so a resident's walk is measured as its errand ambles,
and divides that clip time by --scale as the animator does on an oblique board (pass the board's figure scale, 1.25);
--json prints the rows as JSON)
"""
import subprocess
import argparse
import importlib.util
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.dont_write_bytecode = True
REPO = Path(__file__).resolve().parents[4]
UNITS = REPO / 'public/art/units'
U = 1 / 0.45 * 0.0254  # metres per CMU ASF length unit
CAMEL = {'east': '', 'south-east': 'SouthEast', 'south': 'South', 'south-west': 'SouthWest', 'west': 'West',
         'north-west': 'NorthWest', 'north': 'North', 'north-east': 'NorthEast'}
SCREEN = {'east': (1, 0), 'south-east': (2, 1), 'south': (0, 1), 'south-west': (-2, 1), 'west': (-1, 0),
          'north-west': (-2, -1), 'north': (0, -1), 'north-east': (2, -1)}
GROUP = {'east': 0, 'west': 0, 'south-east': 1, 'south-west': 1, 'north-east': 1, 'north-west': 1, 'south': 2, 'north': 2}


def px_per_tile(d):
    """World px of screen travel per logical tile for a move shown on heading clip d, under x - y, (x + y) / 2."""
    ux, uy = SCREEN[d]
    lx, ly = (2 * uy + ux) / 2, (2 * uy - ux) / 2
    n = math.hypot(lx, ly)
    lx, ly = lx / n, ly / n
    return 64 * math.hypot(lx - ly, (lx + ly) / 2)


def motion_module(family):
    spec = importlib.util.spec_from_file_location(f'motion_{family}', REPO / f'art/source/{family}/tools/motion.py')
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def contacts(M, spec, n):
    """For each cel, which feet the take has planted (world-frame ankle speed under 1 m/s)."""
    J, _, _ = M.load(spec['clip'])
    start, period = (spec['cycle'] if spec.get('cycle') else M.gait_cycle(J, spec['clip'])[:2])
    out = []
    for i in range(n):
        f = start + period * i / n
        row = {}
        for k, jk in (('LA', 'lank'), ('RA', 'rank')):
            a, b = int(math.floor(f)), min(int(math.floor(f)) + 1, len(J[jk]) - 1)
            row[k] = float(np.linalg.norm(J[jk][b, :2] - J[jk][a, :2]) * 120 * U) < 1.0
        out.append(row)
    return out


def cels(atlas, key, clip, n):
    data = json.loads((UNITS / f'{atlas}.json').read_text())
    sheet = Image.open(UNITS / data['meta']['image']).convert('RGBA')
    out = []
    for i in range(n):
        r = data['frames'][f'{key}/{clip}/{i}']['frame']
        out.append(np.asarray(sheet.crop((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h'])))[..., 3] > 127)
    return out


def sole(mask, me, other):
    """Centroid of the lowest two rows of the opaque pixels nearer ankle `me` than ankle `other`, below me's knee line."""
    ys, xs = np.nonzero(mask)
    near = ((xs - me[0]) ** 2 + (ys - me[1]) ** 2) < ((xs - other[0]) ** 2 + (ys - other[1]) ** 2)
    keep = near & (ys >= me[1] - 6) & (np.abs(xs - me[0]) <= 9)
    if not keep.any():
        return None
    ys, xs = ys[keep], xs[keep]
    low = ys >= ys.max() - 1
    return float(xs[low].mean()), float(ys[low].mean())


def manifest_timing(key, kind):
    """(cel ms, {heading: clip ms a tile}) for `kind` on the sheet `key` declares, read from the manifest itself."""
    js = (f"import {{ ASSETS }} from './src/content/assets/manifest';"
          f"const a = ASSETS['{key}']; const out = {{}};"
          f"for (const [h, ms] of Object.entries(a.locomotion.walkMsPerTile)) {{"
          f"const c = h === 'east' ? '{kind}' : '{kind}' + h[0].toUpperCase() + h.slice(1);"
          f"out[h] = [1000 / a.clips[c].fps, ms]; }} console.log(JSON.stringify(out));")
    r = subprocess.run(['npx', 'tsx', '-e', js], cwd=REPO, capture_output=True, text=True, check=True)
    camel = {'east': 'east', 'southEast': 'south-east', 'south': 'south', 'southWest': 'south-west', 'west': 'west',
             'northWest': 'north-west', 'north': 'north', 'northEast': 'north-east'}
    return {camel[h]: v for h, v in json.loads(r.stdout.strip().splitlines()[-1]).items()}


def measure(family, name, kind, cel_ms, tiles, scale, timing=None):
    M = motion_module(family)
    chars = json.loads((REPO / f'art/source/{family}/tools/chars.json').read_text())
    spec = M.spec_for(name, kind) if hasattr(M, 'spec_for') else (
        M.SPECS[name][kind] if kind in M.SPECS.get(name, {}) else M.SPECS['_shared'][kind])
    pack = json.loads((REPO / f'art/source/{family}/cels/{name}/pack.json').read_text())
    key = pack['key']
    atlas = f'{name}-g'
    n = spec['frames']
    feet = contacts(M, spec, n)
    rows = []
    for d in M.DIRS:
        clip = (kind if d == 'east' else kind + CAMEL[d])
        cs = cels(atlas, key, clip, n)
        H, W = cs[0].shape
        pl = pack['placement'][d]
        dx = pl.get(f'{kind}Dx', pl.get('walkDx', 0)) if kind != 'walk' else pl['walkDx']
        dy = pl['idleDy'] + (pl.get(f'{kind}Dy', pl.get('walkDy', 0)) if kind != 'walk' else pl['walkDy'])
        ox = (96 - W) // 2
        design = json.loads((REPO / f'art/source/{family}/design/{name}/{spec.get("design", kind)}-{d}.json').read_text())
        ank = [{k: (v[0] - ox + dx, v[1] + dy) for k, v in P.items() if k in ('LA', 'RA')} for P in design['px']]
        ux, uy = SCREEN[d]
        un = math.hypot(ux, uy)
        ux, uy = ux / un, uy / un
        ppt = px_per_tile(d)
        if timing:
            cel_ms, ms_tile = timing[d]
            ms_tile /= scale  # the animator stretches the clip by the figure scale (Animator.walkClipTime, ADR 0095)
            t = n * cel_ms / ms_tile
        else:
            t = tiles[GROUP[d]]
            ms_tile = n * cel_ms / t
        game = ppt * cel_ms / ms_tile  # world px the figure moves a cel
        slides, backs = [], []
        for i in range(n):
            j = (i + 1) % n
            for k, o in (('LA', 'RA'), ('RA', 'LA')):
                if not (feet[i][k] and feet[j][k]):
                    continue
                a = sole(cs[i], ank[i][k], ank[i][o])
                b = sole(cs[j], ank[j][k], ank[j][o])
                if a is None or b is None:
                    continue
                along = ((b[0] - a[0]) * ux + (b[1] - a[1]) * uy) * scale
                backs.append(-along)
                slides.append(along + game)
        # ADR 0093's first measure, for comparison: the whole cel's lowest two rows, half the loop path.
        pts = []
        for c in cs:
            ys, xs = np.nonzero(c)
            low = ys >= ys.max() - 1
            pts.append((xs[low].mean(), ys.max()))
        path = sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(pts, pts[1:] + pts[:1])) * scale
        ratio = (path / 2) / (ppt * t)
        back = float(np.mean(backs)) if backs else float('nan')
        rows.append(dict(heading=d, pairs=len(slides), game=round(game, 2), back=round(back, 2), loop=round(t, 3),
                         slide=round(float(np.mean(slides)), 2) if slides else None,
                         worst=round(float(max(slides, key=abs)), 2) if slides else None,
                         fit=round(back * n / ppt, 3) if backs else None, ratio=round(ratio, 2)))
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('family')
    ap.add_argument('name')
    ap.add_argument('kind', nargs='?', default='walk')
    ap.add_argument('--cel-ms', type=float, default=114)
    ap.add_argument('--tiles', default='1.825')
    ap.add_argument('--scale', type=float, default=1.0)
    ap.add_argument('--manifest', action='store_true')
    ap.add_argument('--json', action='store_true')
    a = ap.parse_args()
    t = [float(x) for x in a.tiles.split(',')]
    tiles = t * 3 if len(t) == 1 else t
    timing = None
    if a.manifest:
        key = json.loads((REPO / f'art/source/{a.family}/cels/{a.name}/pack.json').read_text())['key']
        timing = manifest_timing(key, a.kind)
    rows = measure(a.family, a.name, a.kind, a.cel_ms, tiles, a.scale, timing)
    if a.json:
        print(json.dumps(rows))
        return
    when = 'manifest timing' if timing else f'{a.cel_ms} ms a cel, loop {tiles} tiles (E, diag, N/S)'
    print(f'{a.name} {a.kind}: {when}, figure scale {a.scale}; world px a stance cel; loop = tiles a loop as timed')
    for r in rows:
        print(f"  {r['heading']:11s} pairs {r['pairs']:2d}  game {r['game']:5.2f}  foot back {r['back']:5.2f}  "
              f"slide {r['slide'] if r['slide'] is not None else '-':>6}  worst {r['worst'] if r['worst'] is not None else '-':>6}  "
              f"fit {r['fit'] if r['fit'] is not None else '-':>5} tiles  ratio {r['ratio']:4.2f}")


if __name__ == '__main__':
    main()
