"""Forest road G1, polish: the pines' feet. Their trunks ended in a flat cut on the grass. Each chosen pine (on its Pro
Flash canvas) is edited once more by Pro Flash with a sentence for the foot only; only the rows below the lowest bough
(`FOOT_ROWS` from the bottom) are taken from it, so the crown stays the selected one. select.py calls `foot`."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from PIL import Image
from pl import run, b64

FOOT_ROWS = {'pine': 34, 'pine-b': 34}
SEED = {'pine': 21, 'pine-b': 21}
PROMPT = ('Keep the tree exactly as drawn: every bough, needle, colour and the trunk. Only redraw the very foot of the trunk: it '
          'flares into three or four short thick roots that sink into the ground, with a small tuft of grass, a fern frond and a '
          'little dark soil around the base, so the tree grows out of the forest floor. High top-down view on a 2:1 isometric '
          'axis. Dark brown 1 pixel outline (#1b1410) on the silhouette, muted warm earth colours, 3 to 4 flat tone steps, warm '
          'light from the upper left, matte, no white pixels, no text, transparent background.')

def foot(pid, canvas_img):
    """canvas_img: the selected job's output on its canvas (RGBA). Returns it with the foot replaced."""
    if pid not in FOOT_ROWS: return canvas_img
    img, h = b64(canvas_img)
    out = run('/edit-image-pro-flash', {'image': img, 'method': 'text', 'description': PROMPT, 'no_background': True,
              'seed': SEED[pid]}, f'foot-{pid}-s{SEED[pid]}', {h: f'the chosen {pid} on its canvas'}, 'polish: root the pine')
    new = out[0].convert('RGBA').resize(canvas_img.size, Image.NEAREST)
    a = np.asarray(canvas_img).copy(); b = np.asarray(new)
    k = FOOT_ROWS[pid]
    a[-k:] = b[-k:]
    return Image.fromarray(a, 'RGBA')
