"""#408: the walk's bob, measured as the game draws it. The store stands every walk cel on its own lowest sole
(src/render/sheets/feet.ts, `plantAnchor`), so what the eye sees of the trunk from cel to cel is the trunk's row in the
cel minus the cel's ground row. Per cel:

- `trunk`: the idle root's head and torso (kp_body.py's parts on the idle's estimated skeleton) found in the cel, the
  offset (within 10 px) where the most of its pixels match exactly (the walk's trunk is the root's own pixels, moved);
- `ground`: the row under the lowest opaque pixel (feet.ts's `ground`);
- `y`: the trunk's screen row relative to the idle standing on the same ground (trunk dy minus the ground's change).

The bob is the change of `y` between consecutive cels (the loop wraps), in world px: the party's world sheets are one art
px a world px at the oblique figure scale. `ms` is a cel's real hold at the shipped pace: 750 ms a tile over the
animator's clip ms a tile (worldParty.ts's walkMsPerTile divided by the figure scale).

usage (repo root): python3 -I art/source/party-world/tools/kp_bob.py [CELS_DIR] [WORLD_PARTY_TS]  -> JSON on stdout"""
import json, re, sys
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
from kp_body import NAMES, joints, labels
HERE = Path(__file__).resolve().parent.parent
REPO = HERE.parents[2]
HEADINGS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east']   # worldParty.ts order
TRUNK = [NAMES.index('head'), NAMES.index('torso')]
PACE, FIGURE_SCALE, SEARCH = 750, 1.25, 10


def rgba(p):
    return np.asarray(Image.open(p).convert('RGBA'))


def ground(a):
    ys = np.nonzero((a[..., 3] >= 128).any(1))[0]; return int(ys.max()) + 1


def trunk_offset(root, kps, cel):
    lab = labels(root[..., 3] >= 128, *joints(kps, root.shape[1])); ys, xs = np.nonzero(np.isin(lab, TRUNK)); W = root.shape[1]
    best = None
    for dy in range(-SEARCH, SEARCH + 1):
        for dx in range(-SEARCH, SEARCH + 1):
            y2, x2 = ys + dy, xs + dx; ok = (y2 >= 0) & (y2 < W) & (x2 >= 0) & (x2 < W)
            same = np.zeros(len(ys), bool)
            same[ok] = (cel[y2[ok], x2[ok], 3] >= 128) & np.all(cel[y2[ok], x2[ok], :3] == root[ys[ok], xs[ok], :3], -1)
            v = same.mean() - 0.001 * (abs(dx) + abs(dy))
            if best is None or v > best[0]: best = (v, dx, dy)
    return best[1], best[2], round(float(best[0]), 3)


def shipped_ms(ts):
    src = Path(ts).read_text(); m = re.search(r'kaya: \{.*?walkCels: (\d+),.*?walkCelMs: (\d+),.*?walkMsPerTile: \[([^\]]*)\]', src, re.S)
    n, cel, per = int(m.group(1)), int(m.group(2)), [float(v) for v in m.group(3).split(',')]
    return n, {d: round(cel * PACE / (per[i] / FIGURE_SCALE), 1) for i, d in enumerate(HEADINGS)}


def measure(cels_dir, ts):
    n, ms = shipped_ms(ts); out = {}
    for d in HEADINGS:
        root = rgba(Path(cels_dir) / f'idle/{d}/00.png'); kps = json.load(open(HERE / f'roots/kaya/idle/skeleton/{d}.json'))['keypoints']
        g0 = ground(root); rows = []
        for p in sorted((Path(cels_dir) / f'walk/{d}').glob('*.png')):
            c = rgba(p); dx, dy, fit = trunk_offset(root, kps, c); g = ground(c)
            rows.append(dict(cel=int(p.stem), dx=dx, dy=dy, fit=fit, ground=g, y=dy - (g - g0)))
        ys = [r['y'] for r in rows]; bob = [ys[(i + 1) % len(ys)] - ys[i] for i in range(len(ys))]
        out[d] = dict(cels=len(rows), ms_per_cel=ms[d], y=ys, bob=bob, max_bob=max(abs(b) for b in bob),
                      range=max(ys) - min(ys), trunk_fit=min(r['fit'] for r in rows), rows=rows)
    return dict(walk_cels=n, headings=out)


if __name__ == '__main__':
    cels = sys.argv[1] if len(sys.argv) > 1 else HERE / 'cels/kaya'
    ts = sys.argv[2] if len(sys.argv) > 2 else REPO / 'src/content/assets/worldParty.ts'
    r = measure(cels, ts)
    for d, h in r['headings'].items():
        print(f"{d:11s} cels {h['cels']} ms {h['ms_per_cel']:6.1f}  y {h['y']}  bob {h['bob']}  max {h['max_bob']} range {h['range']} fit {h['trunk_fit']}", file=sys.stderr)
    print(json.dumps(r))
