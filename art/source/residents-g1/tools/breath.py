"""Rollout step 5: the idle and the fighting-stance loops, built from one curated cel plus a skeleton-driven delta.

usage (repo root): python3 -I art/source/residents-g1/tools/breath.py
Writes cels/<char>/<idle|stance>/<dir>/NN.png and breath.json.

Why not generated: at 59 px PixelLab redraws every cel, and #290's generated idles boiled 36-54% (the shipped G idle 14-26%);
the softer take came back frozen. The owner's options for fault 2 included "one curated cel plus skeleton-driven deltas".

How: one breath cycle of a CMU take (77_02 standing for the idle, 77_03 ready stance for the guard), the trough-to-trough cycle
found below, sampled at the clip's cel count. Its neck height over the ankles is the delta. At this size a breath moves the
chest about 2 mm, under a pixel, so the cycle is normalised to its trough 0 and peak 1 px and each cel's delta rounded: a cel whose delta
rounds to 1 lifts the rows above the chest line (neck + 35% of the way to the hips, from the root's estimated skeleton) by one
pixel, duplicating the chest-line row, which is how a 1 px rise is drawn without a hole. Nothing else moves, nothing is
redrawn, every cel keeps the curated cel's palette, so the loop cannot boil beyond its 1 px rise.
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
import mocap
from motion import DIRS, origin, CMU
C = json.load(open(Path(__file__).resolve().parent / 'chars.json'))
HERE = Path(__file__).resolve().parent.parent
CHEST = 0.35
# The residents and bandits have no fighting stance: only the idle breathes (the party's 77_02 cycle, exactly).
LOOPS = {'idle': dict(clip='77_02', cels=4, window=(300, 937), attribution='CMU 77_02 standing, one breath cycle')}


def cycle(clip, window):
    s = clip.split('_')[0]; J, fps, n = mocap.load(('cmu', str(CMU / f'{s}.asf'), str(CMU / f'{clip}.amc')))
    z = J['neck'][:, 2] - (J['lank'][:, 2] + J['rank'][:, 2]) / 2
    zs = np.convolve(z, np.ones(31) / 31, mode='same')
    a, b = window; w = 60
    lows = [f for f in range(a + w, min(b, len(zs)) - w) if zs[f] == zs[f - w:f + w + 1].min()]
    if len(lows) < 2: raise SystemExit(f'no breath cycle in {clip} {window}')
    p, q = lows[0], lows[1]
    return zs, p, q


def lift(im, line):
    a = np.asarray(im).copy(); out = a.copy(); out[:line - 1] = a[1:line]
    return Image.fromarray(out)


def main():
    rec = {}
    for kind, L in LOOPS.items():
        zs, p, q = cycle(L['clip'], L['window'])
        fr = [p + (q - p) * i / L['cels'] for i in range(L['cels'])]
        d = np.array([zs[int(round(f))] for f in fr])
        delta = (d - d.min()) / max(float(np.ptp(d)), 1e-9)   # the cycle's trough 0, its peak 1 px
        rows = [int(round(v)) for v in delta]
        rec[kind] = dict(clip=L['clip'], frames=[round(f, 1) for f in fr], delta=[round(float(v), 3) for v in delta], lift_px=rows,
                         chest=CHEST, attribution=L['attribution'])
        for char in sys.argv[1:] or list(C):
            for dd in DIRS:
                root = Image.open(HERE / f'roots/{char}/{kind}/{dd}.png').convert('RGBA')
                sk = json.load(open(HERE / f'roots/{char}/{kind}/skeleton-96/{dd}.json'))
                ox, oy = origin(char, 96)
                P = {j['label']: (j['x'] * 96 - ox, j['y'] * 96 - oy) for j in sk['keypoints']}
                neck = P['NECK'][1]; hip = (P['LEFT HIP'][1] + P['RIGHT HIP'][1]) / 2
                line = int(round(neck + CHEST * (hip - neck)))
                out = HERE / f'cels/{char}/{kind}/{dd}'; out.mkdir(parents=True, exist_ok=True)
                for i, r in enumerate(rows):
                    (lift(root, line) if r else root).save(out / f'{i:02d}.png')
                rec.setdefault('lines', {})[f'{char}/{kind}/{dd}'] = line
    json.dump(rec, open(HERE / 'breath.json', 'w'), indent=1)
    print({k: rec[k]['lift_px'] for k in LOOPS})


if __name__ == '__main__':
    main()
