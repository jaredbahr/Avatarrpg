"""Forest road G1, step 4: the shipped sources, at world px, from the chosen jobs.

- Ground: WORK/pieces/<n>.png (cut.py), each with its pre-G1 piece's exact alpha and resolution, so every footprint
  test of the old plates still holds. (Clearing what an opaque upper piece hides saved only 40 KB; not worth a new footprint.)
- Uprights and props: the chosen Pro Flash job (`SELECTION`, output 0), cut back from its edit canvas to the rectangle
  the piece is drawn at (bottom-centred, as uprights.py placed it), alpha made binary at 128, and the silhouette's dark
  edge pixels taken CONTOUR of the way to #1b1410 (ADR 0085's contour). Props keep their own trimmed size.

- `pine-b` came out teal beside the warm `pine` and read as another species in the wall, so its chroma is moved
  PINE_B_TOWARD of the way to `pine`'s mean chroma (YCbCr, opaque pixels; luma untouched).
- Delivery scale: the uprights ship as they are, 1 px per world px (ADR 0088: crisp at every integer zoom). Until
  then each was also scaled to 1.5 px per world px (pieces/uprights-1.5x, EPX x2 then a 0.75 Lanczos), which the
  integer-zoom camera smoothed at N = 2; that folder is gone.

Writes art/source/forest-road-g1/pieces/{ground,uprights,props}/<name>.png, the inputs of
scripts/art/forest-g1-pack.ts.
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from PIL import Image
from uprights import PIECES, source
from pl import JOBS
from compose import SCENE  # noqa: E402
X0, Y0 = -320, -160  # forest compose.py's frame

WORK = os.environ.get('FOREST_G1_WORK', '.review/forest-g1')
OUT = 'art/source/forest-road-g1/pieces'
INK = np.array([27, 20, 16], np.float32)
CONTOUR = 0.8
PINE_B_TOWARD = 0.5

# piece -> job tag (output 0). Seed picks are recorded in the README with why.
SELECTION = json.load(open(os.path.join(os.path.dirname(__file__), '..', 'selection.json')))


def ground():
    """Each ground piece as cut.py made it: the restyle under the piece's own pre-G1 alpha, footprint unchanged. A piece
    whose pre-G1 plate was finer than world px (the pond and the creeks, 2 px per world px) keeps that resolution: its
    colour enlarged by nearest neighbour, its alpha the pre-G1 plate's own, so its footprint tests hold exactly."""
    from pre import pre_g1
    scene = json.load(open(SCENE))
    os.makedirs(f'{OUT}/ground', exist_ok=True)
    for n, piece in enumerate(scene['ground']):
        f = f'{WORK}/pieces/{n}.png'
        if not os.path.exists(f): continue
        name = piece['url'].split('/')[-1].removesuffix('.webp')
        im = Image.open(f).convert('RGBA')
        old = Image.open(pre_g1(f'maps/forest-scene/{name}.webp')).convert('RGBA')
        if old.size != im.size:
            k = old.width // im.width
            assert old.size == (im.width * k, im.height * k), (name, old.size, im.size)
            im = im.resize(old.size, Image.NEAREST)
            im.putalpha(old.getchannel('A'))
        im.save(f'{OUT}/ground/{name}.png')


def contour(im):
    a = np.asarray(im.convert('RGBA')).astype(np.float32)
    on = a[..., 3] >= 128
    a[..., 3] = np.where(on, 255, 0)
    a[~on] = 0
    pad = np.pad(on, 1)
    edge = on & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    luma = a[..., :3] @ np.array([0.299, 0.587, 0.114], np.float32)
    dark = edge & (luma < 110)
    a[dark, :3] = a[dark, :3] * (1 - CONTOUR) + INK * CONTOUR
    return Image.fromarray(np.clip(a + 0.5, 0, 255).astype(np.uint8), 'RGBA')


def toward_pine(img):
    ref = np.asarray(Image.open(f'{OUT}/uprights/pine.png').convert('YCbCr'), np.float32)
    ref_a = np.asarray(Image.open(f'{OUT}/uprights/pine.png').getchannel('A')) > 0
    a = np.asarray(img.convert('YCbCr'), np.float32)
    on = np.asarray(img.getchannel('A')) > 0
    for c in (1, 2):
        a[..., c][on] += (ref[..., c][ref_a].mean() - a[..., c][on].mean()) * PINE_B_TOWARD
    out = Image.fromarray(np.clip(a + 0.5, 0, 255).astype(np.uint8), 'YCbCr').convert('RGBA')
    out.putalpha(img.getchannel('A'))
    return out


def upright(pid, tag):
    path, size, _ = PIECES[pid]
    out = Image.open(f'{JOBS}/{tag}-0.png').convert('RGBA')
    from feet import foot
    out = foot(pid, out)  # polish: the pines' trunks root into the floor
    canvas = source(pid)
    assert out.size == canvas.size, (pid, out.size, canvas.size)
    if size is None:  # a prop keeps its own trim
        kind, img = 'props', out.crop(out.getchannel('A').point(lambda v: 255 if v >= 128 else 0).getbbox())
    else:
        cw, ch = canvas.size
        kind, img = 'uprights', out.crop(((cw - size[0]) // 2, ch - size[1], (cw - size[0]) // 2 + size[0], ch))
    os.makedirs(f'{OUT}/{kind}', exist_ok=True)
    img = contour(img)
    if pid == 'pine-b':
        img = toward_pine(img)
    img.save(f'{OUT}/{kind}/{pid}.png')


if __name__ == '__main__':
    ground()
    for pid, tag in SELECTION.items():
        upright(pid, tag)
    print('pieces written')
