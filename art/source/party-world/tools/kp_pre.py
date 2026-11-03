"""Kaya polish, step 2: the curated steeper idle drawings (kp_probe.py edit candidates), each scaled to one standing height
(premultiplied Lanczos, binary alpha) and set on a 128 canvas, sole on row 112, centred: polish/pre/idle/<dir>.png.
The steeper camera foreshortens the body, so the height is 70 world px (#321's roots stood 72-76).

usage (repo root): python3 -I art/source/party-world/tools/kp_pre.py"""
import json
from pathlib import Path
import numpy as np
from PIL import Image
HERE = Path(__file__).resolve().parent.parent
PICK = json.load(open(HERE / 'polish/curate.json'))
TARGET, CANVAS, FOOT = 70, 128, 112


def scaled(im, k):
    a = np.asarray(im); ys, xs = np.nonzero(a[..., 3] > 127)
    im = im.crop((xs.min() - 2, ys.min() - 2, xs.max() + 3, ys.max() + 3))
    w, h = round(im.width * k), round(im.height * k)
    p = np.asarray(im).astype(np.float32); p[..., 3] = np.where(p[..., 3] > 127, 255, 0); p[..., :3] *= p[..., 3:] / 255
    ch = [np.asarray(Image.fromarray(p[..., i]).resize((w, h), Image.LANCZOS)) for i in range(4)]
    al = np.clip(ch[3], 0, 255); col = np.stack([np.clip(c / np.maximum(al, 1e-3) * 255, 0, 255) for c in ch[:3]], -1)
    return Image.fromarray(np.dstack([col.astype(np.uint8), np.where(al >= 128, 255, 0).astype(np.uint8)]))


def place(fig):
    a = np.asarray(fig)[..., 3]; ys, xs = np.nonzero(a)
    cv = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
    cv.alpha_composite(fig, (int(round(CANVAS / 2 - (xs.min() + xs.max() + 1) / 2)), FOOT - int(ys.max())))
    return cv


if __name__ == '__main__':
    out = HERE / 'polish/pre/idle'; out.mkdir(parents=True, exist_ok=True)
    for d, job in PICK['idle'].items():
        im = Image.open(HERE / f'raw/{job}/00.png').convert('RGBA')
        a = np.asarray(im)[..., 3]; ys = np.nonzero(a > 127)[0]; h = ys.max() - ys.min() + 1
        fig = place(scaled(im, TARGET / h)); fig.save(out / f'{d}.png')
        ys = np.nonzero(np.asarray(fig)[..., 3])[0]; print(d, job, h, '->', ys.max() - ys.min() + 1)
