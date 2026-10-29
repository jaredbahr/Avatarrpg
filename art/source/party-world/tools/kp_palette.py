"""Kaya polish: one Kaya palette. K-means in OKLab (K colours, seeded, deterministic) over every opaque pixel of her
sixteen restyled roots (idle and stance, eight headings): polish/palette.json. Every cel of every clip and heading is put
on it (OKLab nearest, binary alpha, specks under 4 px cleared, assemble.py's lock), so no heading or clip drifts in colour
from another.

usage (repo root): python3 -I art/source/party-world/tools/kp_palette.py [K]"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
from colour import to_oklab, from_oklab
HERE = Path(__file__).resolve().parent.parent
DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']


def build(K=64, iters=40):
    px = np.concatenate([np.asarray(Image.open(HERE / f'roots/kaya/{k}/{d}.png').convert('RGBA')).reshape(-1, 4)
                         for k in ('idle', 'stance') for d in DIRS])
    px = px[px[:, 3] >= 128, :3]; lab = to_oklab(px); rng = np.random.default_rng(7)
    # k-means++ seeding
    C = [lab[rng.integers(len(lab))]]
    for _ in range(K - 1):
        d = ((lab[:, None] - np.array(C)[None]) ** 2).sum(-1).min(1); C.append(lab[rng.choice(len(lab), p=d / d.sum())])
    C = np.array(C)
    for _ in range(iters):
        a = ((lab[:, None] - C[None]) ** 2).sum(-1).argmin(1)
        C = np.array([lab[a == k].mean(0) if (a == k).any() else C[k] for k in range(K)])
    rgb = np.clip(from_oklab(C) + 0.5, 0, 255).astype(np.uint8)
    order = np.argsort(C[:, 0]); rgb = rgb[order]
    json.dump({'k': K, 'from': 'roots/kaya/{idle,stance}/<dir>.png', 'colors': ['#%02x%02x%02x' % tuple(c) for c in rgb]},
              open(HERE / 'polish/palette.json', 'w'), indent=1)
    return rgb


def palette():
    cols = json.load(open(HERE / 'polish/palette.json'))['colors']
    rgb = np.array([[int(c[i:i + 2], 16) for i in (1, 3, 5)] for c in cols], np.uint8); return rgb, to_oklab(rgb)


if __name__ == '__main__':
    print(len(build(int(sys.argv[1]) if len(sys.argv) > 1 else 64)), 'colours')
