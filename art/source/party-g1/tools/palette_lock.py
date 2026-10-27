"""Palette lock: snap every opaque pixel of a native cel to the nearest colour of the character's shipped palette
(b/<char>/palette.png, reduce.py's median cut of every shipped cel), in a perceptual (OKLab) distance; alpha binarised at
128. Deterministic. Removes the redraw's hue drift (Kaya's warmer boots) and keeps every heading and cel on one palette.

usage: palette_lock.py CHAR IN.png OUT.png   or import lock(img, char)"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image
HERE = Path(__file__).resolve().parent.parent


def _oklab(rgb):
    c = rgb / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    M1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929], [0.2119034982, 0.6806995451, 0.1073969566], [0.0883024619, 0.2817188376, 0.6299787005]])
    lms = np.cbrt(c @ M1.T)
    M2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468], [1.9779984951, -2.4285922050, 0.4505937099], [0.0259040371, 0.7827717662, -0.8086757660]])
    return lms @ M2.T


_pal = {}


def palette(char):
    if char not in _pal:
        p = np.asarray(Image.open(HERE / f'b/{char}/palette.png').convert('RGBA')).reshape(-1, 4)
        p = np.unique(p[p[:, 3] > 0][:, :3], axis=0).astype(float)
        _pal[char] = (p, _oklab(p))
    return _pal[char]


def lock(img, char):
    a = np.asarray(img.convert('RGBA')).astype(float)
    rgb, al = a[..., :3], a[..., 3]
    p, pl = palette(char)
    lab = _oklab(rgb.reshape(-1, 3))
    d = ((lab[:, None, :] - pl[None, :, :]) ** 2).sum(-1)
    out = p[d.argmin(1)].reshape(rgb.shape)
    res = np.zeros_like(a); res[..., :3] = out; res[..., 3] = np.where(al >= 128, 255, 0)
    res[al < 128] = 0
    return Image.fromarray(res.astype(np.uint8), 'RGBA')


if __name__ == '__main__':
    lock(Image.open(sys.argv[2]), sys.argv[1]).save(sys.argv[3])
