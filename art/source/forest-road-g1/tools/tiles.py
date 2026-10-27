"""Run one PixelLab edit over a large image as overlapping <=512 tiles, then stitch them back."""
import math
import numpy as np
from PIL import Image
from concurrent.futures import ThreadPoolExecutor
from pl import run, b64

def grid(n, tile, min_ov=64):
    if n <= tile: return [0]
    k = math.ceil((n - min_ov) / (tile - min_ov))
    step = (n - tile) / (k - 1)
    return [round(i * step) for i in range(k)]

def plan(w, h, tile=512, min_ov=64):
    tw, th = min(w, tile), min(h, tile)
    return [(x, y, tw, th) for y in grid(h, th, min_ov) for x in grid(w, tw, min_ov)]

def stitch(w, h, parts, hard=False, r=64):
    """parts: list of ((x,y,tw,th), Image). Colour-match each tile to what is already laid, feather overlaps."""
    acc = np.zeros((h, w, 4)); wsum = np.zeros((h, w, 1))
    for (x, y, tw, th), im in parts:
        a = np.asarray(im.convert('RGBA').resize((tw, th), Image.NEAREST)).astype(float)
        # colour gain vs what is already there
        prev = wsum[y:y+th, x:x+tw, 0] > 0
        if prev.any():
            cur = acc[y:y+th, x:x+tw, :3][prev] / wsum[y:y+th, x:x+tw][prev]
            mine = a[..., :3][prev]
            gain = (cur.mean(0) + 1) / (mine.mean(0) + 1)
            a[..., :3] = np.clip(a[..., :3] * gain, 0, 255)
        # weight: ramps to 0 at tile edges that are interior
        wx = np.ones(tw); wy = np.ones(th)
        if x > 0: wx[:r] = np.linspace(0.01, 1, r)
        if x + tw < w: wx[-r:] = np.minimum(wx[-r:], np.linspace(1, 0.01, r))
        if y > 0: wy[:r] = np.linspace(0.01, 1, r)
        if y + th < h: wy[-r:] = np.minimum(wy[-r:], np.linspace(1, 0.01, r))
        if hard:
            wx = np.ones(tw); wy = np.ones(th)
        wt = (wy[:, None] * wx[None, :])[..., None]
        if hard:
            acc[y:y+th, x:x+tw] = a; wsum[y:y+th, x:x+tw] = 1
            continue
        acc[y:y+th, x:x+tw] += a * wt; wsum[y:y+th, x:x+tw] += wt
    out = acc / np.maximum(wsum, 1e-6)
    return Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8), 'RGBA')

def edit_tiled(src, tag, payload_fn, refs, notes, tile=512, min_ov=64, workers=4):
    w, h = src.size
    boxes = plan(w, h, tile, min_ov)
    def one(i_box):
        i, (x, y, tw, th) = i_box
        crop = src.crop((x, y, x + tw, y + th))
        img, hsh = b64(crop)
        r = dict(refs); r[hsh] = f'{tag} tile {i} ({x},{y},{tw},{th}) of source'
        out = run(*payload_fn(img, tw, th), f'{tag}-t{i}', r, notes + f' tile {i} at ({x},{y},{tw}x{th})')
        return ((x, y, tw, th), out[0])
    with ThreadPoolExecutor(workers) as ex:
        parts = list(ex.map(one, enumerate(boxes)))
    return stitch(w, h, parts)
