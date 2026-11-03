"""Ba Dan at G1, the ground pass (2026-10-27, owner: "complete Ba Dan as is").

The first G1 restyle left the paving bleached and patchy and the grass flat olive. This pass re-renders only the ground:
1. PixelLab `edit-images-v2` `edit_with_text` over the current G1 world (`world/world-g1.png`), 512 px tiles, one prompt
   (`GROUND_PROMPT`), seed 11, no reference image.
2. Only plain ground takes the result: pixels no geometry piece owns (`village/ids.png` of the current geometry) and
   that are not canal water; everything else keeps the current world. The join is feathered 2 px.
3. `level`: per material (paving, grass and earth), the large-scale tone (Gaussian, `LEVEL_SIGMA`) is pulled toward the
   material's own median by `LEVEL_PULL`, so no tile or patch tint survives, while every 1-2 px mark is kept.
Writes ROUTE_A_WORK/world-g1-ground.png.
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from PIL import Image, ImageFilter
from pl import RA
from tiles import edit_tiled, plan
from style import STYLE, KEEP

GROUND_PROMPT = ('Redraw only the ground as ' + STYLE + '. Paving: even, clean squared stone flags in one warm grey-beige, crisp '
                 'dark joints with a little moss, no bleached or blotchy patches. Grass: a living lawn with visible texture '
                 'everywhere: scattered 1-2 px blade strokes in a lighter and a darker green over a mid green, small tufts, '
                 'clover and a few tiny flowers, calm and even, never one flat colour. Earth paths stay soft brown. No people. ' + KEEP)
LEVEL_SIGMA = 28      # world px: larger than a paving flag, smaller than a court
LEVEL_PULL = 0.7      # how far the large-scale tone moves to the material's median

def payload(img, w, h):
    return ('/edit-images-v2', {'method': 'edit_with_text', 'edit_images': [{'image': img, 'width': w, 'height': h}],
            'image_size': {'width': w, 'height': h}, 'description': GROUND_PROMPT, 'seed': 11})

def gauss(x, sigma):
    r = int(3 * sigma); k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2); k /= k.sum()
    p = np.pad(x, r, mode='edge')
    p = np.apply_along_axis(lambda v: np.convolve(v, k, mode='valid'), 0, p)
    return np.apply_along_axis(lambda v: np.convolve(v, k, mode='valid'), 1, p)

def ids_world(reg, shape):
    ids = np.asarray(Image.open(f'{reg}/village/ids.png')).astype(np.int32)
    ids = ids[..., 0] | (ids[..., 1] << 8) | (ids[..., 2] << 16)
    g = Image.fromarray((ids == 0).astype(np.uint8) * 255).resize((shape[1], shape[0]), Image.BOX)
    return np.asarray(g) > 200

def materials(rgb):
    """paving / grass / water masks by colour (HSV); earth is ground that is neither."""
    a = rgb.astype(np.float32) / 255
    mx, mn = a.max(-1), a.min(-1); v = mx; s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    hue = np.degrees(np.arctan2(np.sqrt(3) * (g - b), 2 * r - g - b)) % 360
    water = (hue > 170) & (hue < 230) & (s > 0.3)
    grass = (hue > 55) & (hue < 150) & (s > 0.22) & ~water
    # Ba Dan's paving is a warm grey-beige (hue 15-55, saturation up to about 0.45, light); earth paths are darker
    paving = ((hue >= 15) & (hue <= 55) & (s < 0.45) & (v > 0.55) | (s < 0.15) & (v > 0.5)) & ~water & ~grass
    return paving, grass, water

def level(rgb, mask, sigma=LEVEL_SIGMA, pull=LEVEL_PULL):
    a = rgb.astype(np.float32); m = mask.astype(np.float32)
    out = a.copy()
    den = np.maximum(gauss(m, sigma), 1e-4)
    target = np.median(a[mask], axis=0)
    for c in range(3):
        low = gauss(a[..., c] * m, sigma) / den
        out[..., c] = np.where(mask, a[..., c] + pull * (target[c] - low), a[..., c])
    return np.clip(out, 0, 255)

def compose(world, gen, ground):
    w = np.asarray(world.convert('RGB')).astype(np.float32); g = np.asarray(gen.convert('RGB')).astype(np.float32)
    _, _, water_w = materials(w.astype(np.uint8))
    take = ground & ~water_w
    t = gauss(take.astype(np.float32), 1.0) * take
    t = np.maximum(t, np.asarray(Image.fromarray(take.astype(np.uint8) * 255).filter(ImageFilter.MinFilter(3))) > 0)
    out = w * (1 - t[..., None]) + g * t[..., None]
    pav, grs, _ = materials(out.astype(np.uint8))
    out = level(out, pav & take); out = level(out, grs & take)
    return Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8))

if __name__ == '__main__':
    reg = os.environ.get('BA_DAN_WORK', '.review/regions')
    world = Image.open('art/source/ba-dan-route-a/world/world-g1.png').convert('RGB')
    W, H = world.size
    only = [int(i) for i in os.environ.get('GROUND_TILES', '').split(',') if i]
    if only:  # a probe: just these tiles of the full plan
        boxes = plan(W, H, 512, 48)
        from pl import run, b64
        for i in only:
            x, y, tw, th = boxes[i]; img, h = b64(world.crop((x, y, x + tw, y + th)))
            run(*payload(img, tw, th), f'{os.environ.get("GROUND_TAG", "g5")}-t{i}', {h: f'world-g1 tile {i} ({x},{y})'}, 'ground pass probe')
        sys.exit(0)
    gp = f'{RA}/world-g1-ground-gen.png'
    if os.path.exists(gp) and os.environ.get('GROUND_REUSE'):
        gen = Image.open(gp).convert('RGB')
    else:
        gen = edit_tiled(world, 'g6', payload, {}, 'ground pass over world-g1', min_ov=48, workers=8)
        gen.save(gp)
    from world import keep_margin
    out = keep_margin(world, compose(world, gen, ids_world(reg, (H, W))))  # the page margin stays the page colour
    out.save(f'{RA}/world-g1-ground.png')
