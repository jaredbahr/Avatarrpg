"""Shared helpers for the polish pass (`polish.py`): the world, its piece map at world px, and a Pro Flash inpaint that
keeps the hand of the pixels around it. PixelLab jobs and their outputs live in `polish/` (ledger and jobs), so the pass
re-runs offline."""
import json, math, os, sys
os.environ.setdefault('ROUTE_A_WORK', 'art/source/ba-dan-route-a/polish')
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from pl import run, b64

REG = os.environ.get('BA_DAN_WORK', '.review/regions')
MARGIN = np.array([70, 91, 64])
INK = np.array([27, 20, 16])

def foot(x, y):
    """World px (pan box corner at 0, 0) of the centre of ground cell (x, y)."""
    return ((x - y + 16) * 64 + 200, (x + y + 1) * 32 + 100)

def corner(x, y):
    return ((x - y + 16) * 64 + 200, (x + y) * 32 + 100)

_ids = None
def ids_world(shape=(1601, 3000)):
    """The geometry's piece index + 1 (0 = plain ground) at every world px (nearest from the 1.5 painting px render)."""
    global _ids
    if _ids is None:
        a = np.asarray(Image.open(f'{REG}/village/ids.png')).astype(np.int32)
        a = a[..., 0] | (a[..., 1] << 8) | (a[..., 2] << 16)
        ys = np.minimum((np.arange(shape[0]) * 1.5 + 0.75).astype(int), a.shape[0] - 1)
        xs = np.minimum((np.arange(shape[1]) * 1.5 + 0.75).astype(int), a.shape[1] - 1)
        _ids = a[ys][:, xs]
    return _ids

_pieces = None
def piece_index(pid):
    global _pieces
    if _pieces is None:
        _pieces = {p['id']: p['index'] for p in json.load(open(f'{REG}/village/pieces.json'))['pieces']}
    return _pieces[pid] + 1

def ellipse(shape, cx, cy, rx, ry):
    yy, xx = np.mgrid[:shape[0], :shape[1]]
    return ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1

def polygon(shape, pts):
    im = Image.new('L', (shape[1], shape[0])); ImageDraw.Draw(im).polygon([tuple(p) for p in pts], fill=255)
    return np.asarray(im) > 0

def dilate(m, r):
    return np.asarray(Image.fromarray(m.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(2 * r + 1))) > 0

def erode(m, r):
    return np.asarray(Image.fromarray(m.astype(np.uint8) * 255).filter(ImageFilter.MinFilter(2 * r + 1))) > 0

def _box(x, r, axis):
    p = np.pad(x, [(r + 1, r) if i == axis else (0, 0) for i in range(x.ndim)], mode='edge')
    c = np.cumsum(p, axis=axis, dtype=np.float64)
    n = x.shape[axis]
    hi = np.take(c, np.arange(2 * r + 1, 2 * r + 1 + n), axis=axis); lo = np.take(c, np.arange(0, n), axis=axis)
    return ((hi - lo) / (2 * r + 1)).astype(np.float32)

def gauss(x, sigma):
    """A Gaussian of a 2-D array, approximated by three box blurs per axis (edges extended); fast at any sigma."""
    x = np.asarray(x, np.float32)
    if sigma <= 0.8:  # small: an exact kernel
        r = max(1, int(3 * sigma)); k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2); k /= k.sum()
        p = np.pad(x, r, mode='edge')
        p = np.apply_along_axis(lambda v: np.convolve(v, k, mode='valid'), 0, p)
        return np.apply_along_axis(lambda v: np.convolve(v, k, mode='valid'), 1, p)
    r = max(1, int(round((np.sqrt(4 * sigma * sigma + 1) - 1) / 2)))
    for _ in range(3):
        x = _box(_box(x, r, 0), r, 1)
    return x

STYLE = ('fine-grain pixel art matching the image around it exactly: 1 px dark brown outline (#1b1410) only on silhouettes, '
         '3-5 flat tone groups per material, matte, no glossy highlights, warm key light from the upper left, cool brown '
         'shadows down-right')

def inpaint(world, mask, tag, prompt, seed=11, gain=True, pick=0):
    """One Pro Flash inpaint of `mask` (bool, world px; its box must fit 256 px with an 8 px border) with 3x context.
    The generated crop is colour-matched by what it changed outside the mask (it should have changed nothing there), and
    only the mask is taken, feathered 1 px. Returns the new world (RGB Image)."""
    ys, xs = np.nonzero(mask)
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()) + 1, int(ys.min()), int(ys.max()) + 1
    w = max(32, ((x1 - x0 + 16 + 3) // 4) * 4); h = max(32, ((y1 - y0 + 16 + 3) // 4) * 4)
    assert w <= 256 and h <= 256, (tag, w, h)
    cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
    bx = min(max(0, cx - w // 2), world.width - w); by = min(max(0, cy - h // 2), world.height - h)
    crop = world.crop((bx, by, bx + w, by + h)).convert('RGB')
    mk = Image.fromarray((mask[by:by + h, bx:bx + w] * 255).astype(np.uint8)).convert('RGB')
    ctx_box = (max(0, bx - w), max(0, by - h), min(world.width, bx + 2 * w), min(world.height, by + 2 * h))
    ctx = world.crop(ctx_box).convert('RGB')
    img, h1 = b64(crop); mi, h2 = b64(mk); ci, h3 = b64(ctx)
    out = run('/inpaint-image-pro-flash', {'image': img, 'mask_image': mi, 'description': prompt, 'context_image': ci,
              'bounding_box': {'x': int(bx - ctx_box[0]), 'y': int(by - ctx_box[1]), 'width': int(w), 'height': int(h)},
              'output_method': 'Modify current layer', 'seed': seed},
              tag, {h1: f'{tag} crop ({bx},{by},{w}x{h}) of the world', h2: f'{tag} mask', h3: f'{tag} context {ctx_box}'},
              'polish pass (owner: "clean up visuals")')
    new = np.asarray(out[pick].convert('RGB').resize((w, h), Image.NEAREST)).astype(np.float32)
    old = np.asarray(crop).astype(np.float32)
    mm = mask[by:by + h, bx:bx + w]
    if gain:
        ring = dilate(mm, 10) & ~dilate(mm, 2)
        if ring.sum() > 40:
            new = np.clip(new * (old[ring].mean(0) + 1) / (new[ring].mean(0) + 1), 0, 255)
    # local tone: outside the mask the job should have changed nothing, so what it did change there is its drift; that
    # drift, spread a few px into the mask (normalised Gaussian of the outside), is taken back near the edge
    out_w = (~mm).astype(np.float32)
    den = gauss(out_w, 5)
    drift = np.stack([gauss((old[..., c] - new[..., c]) * out_w, 5) for c in range(3)], -1) / np.maximum(den, 1e-3)[..., None]
    new = np.clip(new + drift * np.clip(den * 2, 0, 1)[..., None], 0, 255)
    a = np.clip(gauss(mm.astype(np.float32), 0.7), 0, 1); a[erode(mm, 1)] = 1; a[~dilate(mm, 1)] = 0
    res = old * (1 - a[..., None]) + new * a[..., None]
    world = world.copy(); world.paste(Image.fromarray(np.clip(res + 0.5, 0, 255).astype(np.uint8)), (bx, by))
    return world

def crop4(img, box, k=4):
    c = img.crop(box); return c.resize((c.width * k, c.height * k), Image.NEAREST)
