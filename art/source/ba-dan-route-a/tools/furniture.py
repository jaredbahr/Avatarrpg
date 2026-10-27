"""Ba Dan at G1: the market furniture with the world furniture's mass, and goods that read at 1x.

#288's tables and bench were drawn at the figures' screen grain and reduced to G1 (factor 0.41), which leaves 1 px legs
and fruit that merges into a smudge. Each is redrawn here at its own G1 size by PixelLab Pro Flash (`edit-image-pro-flash`,
text, no background), from #288's toned G1 image on the same canvas (padded to a multiple of 4), so the anchor and the
footprint placement of `grain/grain.json` still hold. Outputs `objects-g1b/<name>.png` at the original size.
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from PIL import Image
from pl import run, b64

SRC = 'art/source/ba-dan-route-a/objects-288/grain/g1-toned'
OUT = 'art/source/ba-dan-route-a/objects-g1b'
COMMON = ('Keep the same object, position, footprint and camera angle (high top-down, 2:1 isometric), same canvas. Make it '
          'sturdier, matching heavy village furniture: thicker legs and plank top (legs 2-3 px wide, top edge 3 px thick), a '
          'strong dark brown 1 px outline (#1b1410) all round, warm wood in 3-4 flat tones, light from the upper left. ')
GOODS = {
    'gao-display': 'On the table: four woven baskets heaped with fruit drawn as a few clear round clusters, red apples, green '
                   'pears and yellow citrus, each fruit 3-4 px with one highlight pixel; a basket of apples and a crate on the ground.',
    'south-market-display': 'On the table: open grain sacks and bowls of rice and beans as clear mounded shapes in 2-3 tones, '
                            'a small hanging balance; sacks on the ground.',
    'north-market-display': 'On the table: a row of glazed clay pots and jars in terracotta, ochre and one blue, each a clear '
                            'rounded shape with a dark rim; larger jars on the ground.',
    'bench-2x1': 'A plain wooden bench: thick seat plank and four sturdy legs.',
    'baskets-south': 'A group of three sturdy woven baskets on the ground, one lidded stock basket and two open ones heaped '
                     'with red peppers and green leaves as a few clear clusters.',
    'baskets-north': 'A group of sturdy woven baskets on the ground: nested empty baskets, one of root vegetables and one of '
                     'apples, as a few clear clusters.',
    'shop-stack': 'Stacked wooden crates and a small drying rack with hanging peppers and gourds, sturdy planks, clear goods.',
}
CREAM = np.array([226, 214, 190])  # the lightest a matte surface goes: no white glints (brief section 2)

def pad4(im):
    w, h = im.size; W, H = max(32, -(-w // 4) * 4), max(32, -(-h // 4) * 4)
    c = Image.new('RGBA', (W, H)); c.paste(im, (0, 0)); return c

def redo(name, seed=11, tag=None):
    src = Image.open(f'{SRC}/{name}.png').convert('RGBA')
    img, h = b64(pad4(src))
    out = run('/edit-image-pro-flash', {'image': img, 'method': 'text', 'description': COMMON + GOODS[name],
              'no_background': True, 'seed': seed}, tag or f'f1-{name}', {h: f'objects-288 g1-toned/{name}.png padded'},
              f'G1 furniture redraw: {name}')
    res = out[0].convert('RGBA').crop((0, 0) + src.size)
    a = np.asarray(res).copy(); a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)
    rgb = a[..., :3].astype(np.float32)
    white = (rgb.min(-1) > 200) & (a[..., 3] > 0)
    a[..., :3][white] = np.minimum(rgb[white], CREAM).astype(np.uint8)
    res = Image.fromarray(a, 'RGBA'); os.makedirs(OUT, exist_ok=True); res.save(f'{OUT}/{name}.png')
    return src, res

if __name__ == '__main__':
    names = sys.argv[1:] or list(GOODS)
    for n in names: redo(n)
