"""Ba Dan at G1, step 1: restyle the whole stitched painting at world px, one hand, one prompt, one seed.

Input: the shipped stitched painting with the ADR 0083 calm (`BA_DAN_WORK/quiet.png`, 4500 x 2401 painting px),
reduced to world px (3000 x 1601, Lanczos). PixelLab `edit-images-v2` `edit_with_text` over 512 px tiles with at
least 48 px overlap; no reference image (a figure reference pastes ghost figures into the scene, round 1).
Writes ROUTE_A_WORK/world-g1-raw.png (world px, tiles stitched with a 64 px feather; G1 tiles register).
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from PIL import Image
from pl import RA
from tiles import edit_tiled, plan
from style import STYLE, KEEP

GROUND = ('Walkable ground stays calm: grass, paving stones, the canal water and its stone banks are broad flat areas of 3-4 tones '
          'with only sparse 1-2 px marks; no all-over noise or stipple. No people.')
PROMPT = 'Redraw as ' + STYLE + '. ' + GROUND + ' ' + KEEP
W, H = 3000, 1601

def payload(img, w, h):
    return ('/edit-images-v2', {'method': 'edit_with_text', 'edit_images': [{'image': img, 'width': w, 'height': h}],
            'image_size': {'width': w, 'height': h}, 'description': PROMPT, 'seed': 11})

MARGIN = (70, 91, 64)  # regions.MARGIN_RGB, the page behind the village

def keep_margin(src, out):
    """Where the input is the flat page colour, the generator invents water and foliage with tile-edged steps. Put the page
    colour back there (pixels within 10 of it whose 7 px neighbourhood is flat), feathered over 6 px into the restyle."""
    import numpy as np
    from PIL import ImageFilter
    a = np.asarray(src).astype(np.int16); m = np.array(MARGIN)
    near = (np.abs(a - m).max(-1) <= 10)
    flat = np.asarray(Image.fromarray((near * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(7))) > 0
    w = np.asarray(Image.fromarray((flat * 255).astype(np.uint8)).filter(ImageFilter.BoxBlur(3))).astype(np.float32)[..., None] / 255
    o = np.asarray(out.convert('RGB')).astype(np.float32)
    return Image.fromarray(np.clip(o * (1 - w) + m * w + 0.5, 0, 255).astype(np.uint8))

if __name__ == '__main__':
    reg = os.environ.get('BA_DAN_WORK', '.review/regions')
    src = Image.open(f'{reg}/quiet.png').convert('RGB').resize((W, H), Image.LANCZOS)
    os.makedirs(f'{RA}/inputs', exist_ok=True); src.save(f'{RA}/inputs/world-quiet-g1.png')
    print(len(plan(W, H, 512, 48)), 'tiles')
    out = edit_tiled(src, 'w1', payload, {}, 'Ba Dan G1 world restyle from quiet.png at world px', min_ov=48, workers=8)
    out = keep_margin(src, out)
    out.save(f'{RA}/world-g1-raw.png')
