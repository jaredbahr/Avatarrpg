"""Forest road G1, step 0: lay the shipped (pre-G1) ground layers into one world-px composite.

Reads the pre-G1 scene (FOREST_ROAD_SCENE at main 5a41f98 as JSON, `pre-g1/scene.json`) and the pre-G1 files under
maps/forest-scene as they were at main 5a41f98 (`pre.py`). Every ground piece is drawn at its world rectangle in list order, exactly
as both backends draw them, onto the apron's bounding box (world x -320..2368, y -160..1184). Writes:

- WORK/composite.png  RGBA, the ground as the board shows it, 2688 x 1344 world px;
- WORK/layers/<n>.png the alpha of each piece at world px in the same frame, so a restyle can be cut back into the pieces.
"""
import json, os, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from pre import pre_g1

WORK = os.environ.get('FOREST_G1_WORK', '.review/forest-g1')
# FOREST_ROAD_SCENE as it was at main 5a41f98, as JSON: the registration the restyle is cut back into.
SCENE = 'art/source/forest-road-g1/pre-g1/scene.json'
X0, Y0, W, H = -320, -160, 2688, 1344


def place(piece):
    im = Image.open(pre_g1(piece['url'].removeprefix('art/').replace('maps/forest-g1/', 'maps/forest-scene/'))).convert('RGBA')
    x, y = round(piece['x'] - X0), round(piece['y'] - Y0)
    w, h = round(piece['width']), round(piece['height'])
    if im.size != (w, h):
        im = im.resize((w, h), Image.LANCZOS)
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    layer.paste(im, (x, y))
    return layer


if __name__ == '__main__':
    scene = json.load(open(sys.argv[1] if len(sys.argv) > 1 else SCENE))
    os.makedirs(f'{WORK}/layers', exist_ok=True)
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    for n, piece in enumerate(scene['ground']):
        layer = place(piece)
        layer.getchannel('A').save(f'{WORK}/layers/{n}.png')
        out = Image.alpha_composite(out, layer)
    out.save(f'{WORK}/composite.png')
    print('composite', out.size)
