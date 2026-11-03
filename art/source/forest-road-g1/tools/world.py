"""Forest road G1, step 1: restyle the whole ground composite at world px in one pass (one prompt, one seed).

Input: WORK/composite.png (compose.py) over the verdant page (#465b40, `palettes.ts`), 2688 x 1344 world px. PixelLab
`edit-images-v2` `edit_with_text` over 512 px tiles with at least 64 px overlap (tiles.py, Ba Dan's), no reference image.
A tile with no painted ground in it is the page and is not sent. Writes WORK/world-g1-raw.png.
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from PIL import Image
from concurrent.futures import ThreadPoolExecutor
from pl import RA, run, b64
from tiles import plan, stitch
from style import STYLE, KEEP, GROUND

PROMPT = 'Redraw as ' + STYLE + '. ' + GROUND + ' ' + KEEP
PAGE = (70, 91, 64)
TAG = os.environ.get('FOREST_G1_TAG', 'w1')

def page_rgb(src):
    bg = Image.new('RGBA', src.size, PAGE + (255,))
    return Image.alpha_composite(bg, src).convert('RGB')

if __name__ == '__main__':
    comp = Image.open(f'{RA}/composite.png').convert('RGBA')
    src = page_rgb(comp)
    alpha = np.asarray(comp.getchannel('A'))
    W, H = src.size
    boxes = plan(W, H, 512, 64)
    print(len(boxes), 'tiles')
    def one(i_box):
        i, (x, y, tw, th) = i_box
        crop = src.crop((x, y, x + tw, y + th))
        if (alpha[y:y + th, x:x + tw] > 8).mean() < 0.01:
            return ((x, y, tw, th), crop)
        img, h = b64(crop)
        out = run('/edit-images-v2', {'method': 'edit_with_text', 'edit_images': [{'image': img, 'width': tw, 'height': th}],
                  'image_size': {'width': tw, 'height': th}, 'description': PROMPT, 'seed': 11},
                  f'{TAG}-t{i}', {h: f'composite tile {i} ({x},{y},{tw}x{th})'}, f'forest G1 ground restyle tile {i} at ({x},{y})')
        return ((x, y, tw, th), out[0])
    with ThreadPoolExecutor(8) as ex:
        parts = list(ex.map(one, enumerate(boxes)))
    stitch(W, H, parts).convert('RGB').save(f'{RA}/world-g1-raw.png')
    print('wrote world-g1-raw.png')
