"""Forest road G1, step 1b: put the composite's broad colour back under the restyle, then flatten to one palette.

The restyle draws the right marks but drifts in hue tile by tile (the road went salmon, the grass yellow) and the tile joins
differ a little in gain. Here the restyle keeps its own pixels and only its low frequencies move: in YCbCr, the chroma's
Gaussian low-pass (sigma 12 world px, coarser than any mark) is replaced by the composite's, and the luma's is moved
LUMA_K of the way. Then the whole board is put on one adaptive palette with no dither, so flat tone groups stay flat.

The raised shelf's pale sandstone read bleached beside the G1 grass at the combat fit, so under the shelf's own alpha the
luma is taken down SHELF_GAIN (face and top alike, so the step between them keeps its ratio).

Writes WORK/world-g1.png (RGB, world px).
"""
import os, sys
import numpy as np
from PIL import Image, ImageFilter

WORK = os.environ.get('FOREST_G1_WORK', '.review/forest-g1')
SIGMA = 12
LUMA_K = 0.6
COLOURS = 192
SHELF_LAYER = 6  # raised-shelf, its index in the scene's ground list
SHELF_GAIN = 0.9
PAGE = (70, 91, 64)


def lowpass(a, sigma=SIGMA):
    return np.stack([np.asarray(Image.fromarray(a[..., c]).filter(ImageFilter.GaussianBlur(sigma)), dtype=np.float32)
                     for c in range(3)], -1)


if __name__ == '__main__':
    comp = Image.open(f'{WORK}/composite.png').convert('RGBA')
    bg = Image.new('RGBA', comp.size, PAGE + (255,))
    orig = np.asarray(Image.alpha_composite(bg, comp).convert('YCbCr'))
    raw = np.asarray(Image.open(f'{WORK}/world-g1-raw.png').convert('YCbCr'))
    shift = lowpass(orig) - lowpass(raw)
    shift[..., 0] *= LUMA_K
    out = raw.astype(np.float32) + shift
    shelf = np.asarray(Image.open(f'{WORK}/layers/{SHELF_LAYER}.png'), dtype=np.float32) / 255
    out[..., 0] *= 1 - (1 - SHELF_GAIN) * shelf
    out = np.clip(out + 0.5, 0, 255).astype(np.uint8)
    rgb = Image.fromarray(out, 'YCbCr').convert('RGB')
    rgb = rgb.quantize(COLOURS, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    rgb.save(f'{WORK}/world-g1.png')
    print('wrote world-g1.png')
