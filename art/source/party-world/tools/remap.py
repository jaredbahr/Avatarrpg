"""Step 7: the combat motions. party-g1 retargeted CMU takes onto its stance roots for every hit, knockout and bend
(party-g1/design/<char>/<clip>-<dir>.json, fractions of a 96 or 128 canvas the root was padded onto at motion.CANVAS).
This folder's stance roots are those same drawings scaled 1.25 and restyled in place (compose.py, extract.py), so each
keypoint maps by the same crop, scale and offset the figure took: no new retarget, the motion exactly as shipped.

The target canvas holds the figure as the walk's does (sole on row 112 of a 128 canvas, centred), padded to CANVAS for
the clip so a fall or a lunge stays inside it (`PAD`).

usage (repo root): python3 -I art/source/party-world/tools/remap.py clip [clip ...]  (hit, ko, bend)
-> design/<char>/<clip>-<dir>.json and design/prev/<char>-<clip>-<dir>.png"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw
HERE = Path(__file__).resolve().parent.parent
G1 = HERE.parent / 'party-g1'
sys.path.insert(0, str(Path(__file__).parent))
from compose import scaled
SRC_CANVAS = {96: (16, 0), 128: (32, 16)}        # party-g1 motion.CANVAS: where the 64x96 root sits on each canvas
CANVAS = {'hit': 128, 'ko': 192, 'bend': 192}     # this folder's canvas a clip is drawn on
FOOT = {128: 112, 192: 150}                       # its sole row
DIRS = {'hit': ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'],
        'bend': ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'],
        'ko': ['south-east', 'north-east', 'north-west', 'south-west']}


def mapping(char, d):
    """(scale, offset) taking a point in party-g1's stance root px to this folder's root canvas (128, sole row 112)."""
    im = np.asarray(Image.open(G1 / f'roots/{char}/stance/{d}.png').convert('RGBA'))
    ys, xs = np.nonzero(im[..., 3] > 0); cx0, cy0 = xs.min() - 2, ys.min() - 2
    w0, h0 = xs.max() + 3 - cx0, ys.max() + 3 - cy0
    fig = scaled(char, 'stance', d); a = np.asarray(fig)[..., 3]; fy, fx = np.nonzero(a)
    sx, sy = fig.width / w0, fig.height / h0
    bw, bh = fx.max() - fx.min() + 1, fy.max() - fy.min() + 1
    ox = 64 - bw // 2 - fx.min(); oy = 113 - bh - fy.min()
    return (sx, sy), (ox - cx0 * sx, oy - cy0 * sy)


def root_on(char, d, W):
    """This folder's stance root on a W canvas, sole on FOOT[W], centred."""
    cv = Image.new('RGBA', (W, W), (0, 0, 0, 0))
    cv.alpha_composite(Image.open(HERE / f'roots/{char}/stance/{d}.png').convert('RGBA'), ((W - 128) // 2, FOOT[W] - 112))
    return cv


def remap(char, clip, d):
    src = json.load(open(G1 / f'design/{char}/{clip}-{d}.json'))
    Ws = src['canvas']; (px, py) = SRC_CANVAS[Ws]; (sx, sy), (ox, oy) = mapping(char, d)
    W = CANVAS[clip]; dx, dy = (W - 128) // 2, FOOT[W] - 112
    def m(kps):
        out = []
        for k in kps:
            x = (k['x'] * Ws - px) * sx + ox + dx; y = (k['y'] * Ws - py) * sy + oy + dy
            out.append(dict(label=k['label'], x=round(x / W, 4), y=round(y / W, 4), z_index=k['z_index']))
        return out
    rec = dict(src, canvas=W, first_frame_keypoints=m(src['first_frame_keypoints']), frames=[m(f) for f in src['frames']],
               remapped_from=f'party-g1/design/{char}/{clip}-{d}.json', foot_row=FOOT[W])
    (HERE / f'design/{char}').mkdir(parents=True, exist_ok=True); (HERE / 'design/prev').mkdir(parents=True, exist_ok=True)
    json.dump(rec, open(HERE / f'design/{char}/{clip}-{d}.json', 'w'), indent=1)
    # preview: the root with the first frame's skeleton and each frame's, 3x
    BON = [('NECK', 'RIGHT SHOULDER'), ('NECK', 'LEFT SHOULDER'), ('RIGHT SHOULDER', 'RIGHT ELBOW'), ('RIGHT ELBOW', 'RIGHT ARM'),
           ('LEFT SHOULDER', 'LEFT ELBOW'), ('LEFT ELBOW', 'LEFT ARM'), ('NECK', 'RIGHT HIP'), ('NECK', 'LEFT HIP'),
           ('RIGHT HIP', 'RIGHT KNEE'), ('RIGHT KNEE', 'RIGHT LEG'), ('LEFT HIP', 'LEFT KNEE'), ('LEFT KNEE', 'LEFT LEG'), ('NECK', 'NOSE')]
    root = root_on(char, d, W); cells = []
    for kps in [rec['first_frame_keypoints']] + rec['frames']:
        P = {k['label']: (k['x'] * W * 3, k['y'] * W * 3) for k in kps}
        bg = Image.new('RGBA', (W, W), (60, 60, 70, 255)); bg.alpha_composite(root); bg = bg.resize((W * 3, W * 3), Image.NEAREST)
        dr = ImageDraw.Draw(bg)
        for a_, b_ in BON:
            if a_ in P and b_ in P: dr.line([P[a_], P[b_]], fill=(255, 80, 80) if 'RIGHT' in a_ + b_ else (80, 200, 255), width=2)
        cells.append(bg)
    sh = Image.new('RGBA', (W * 3 * len(cells), W * 3)); [sh.paste(c, (i * W * 3, 0)) for i, c in enumerate(cells)]
    sh.convert('RGB').save(HERE / f'design/prev/{char}-{clip}-{d}.png')
    return rec


if __name__ == '__main__':
    for clip in sys.argv[1:]:
        for char in ['kaya', 'sura', 'bo']:
            for d in DIRS[clip]: r = remap(char, clip, d)
        print(clip, 'remapped')
