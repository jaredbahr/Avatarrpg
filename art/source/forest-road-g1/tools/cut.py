"""Forest road G1, step 3: clear the rubble heaps out of the restyled ground, then cut it back into the scene's pieces.

1. The two rubble heaps are their own ground pieces (`paintedRubble`): a cleared cover cell hides its heap, so the ground
   under it must be plain. The restyle saw them baked in, so a 256 px crop of the composite drawn WITHOUT the heaps is
   restyled again round each one (world.py's prompt and seed), colour-matched as tone.py does, and pasted over the heap's
   own footprint only (its alpha, dilated 3 px), gain-matched to the ground just outside. (A Pro Flash inpaint was
   tried first, `clear-heap-*` in the ledger: it filled smooth and pink, not pixel art.)
2. Every ground piece except the heaps becomes the one restyled ground under its own pre-G1 alpha, so the stack draws
   exactly world-g1 wherever the pieces covered the board, and no new pixel turns opaque. In the apron's fade the restyle
   was made over the page colour, so its ground colour is recovered by un-mixing the page (alpha >= 0.35) and carried
   outward from there below that.

1b. Generator glyphs: the restyle wrote a few pseudo-letters in black onto the grass west of the lodge (found at the 1.5
   camera, `GLYPHS`). Each dark pixel there takes the most common non-dark colour of its 7x7 neighbourhood, so the
   grass closes over them in its own tones; the kerb beside it is outside the box.

Writes WORK/world-g1-clear.png and WORK/pieces/<n>.png (RGBA, world px, the piece's rectangle).
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from PIL import Image, ImageFilter
from pl import RA, run, b64
from compose import X0, Y0, SCENE

PAGE = np.array([70, 91, 64], np.float32)
PROMPT = ('Fill the masked area with the same ground that surrounds it (grass, worn earth or cobbles, continuing their lines and '
          'colours) as calm walkable ground in the same pixel art style: 1 px marks, 3-4 flat tones. No stones heap, no rubble, '
          'no objects, no shadows, no people.')


def is_heap(piece):
    return '/rubble' in piece['url']


def inpaint(world, mask, tag):
    ys, xs = np.nonzero(mask)
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()) + 1, int(ys.min()), int(ys.max()) + 1
    w = max(32, ((x1 - x0 + 16 + 3) // 4) * 4); h = max(32, ((y1 - y0 + 16 + 3) // 4) * 4)
    bx, by = (x0 + x1) // 2 - w // 2, (y0 + y1) // 2 - h // 2
    a = np.asarray(world).copy()
    mk = Image.fromarray(mask.astype(np.uint8) * 255)
    ring = (np.asarray(mk.filter(ImageFilter.MaxFilter(15))) > 0) & ~(np.asarray(mk.filter(ImageFilter.MaxFilter(5))) > 0)
    a[mask] = np.median(a[ring], axis=0).astype(np.uint8)
    pre = Image.fromarray(a)
    crop = pre.crop((bx, by, bx + w, by + h))
    ctx_box = (max(0, bx - w), max(0, by - h), min(world.width, bx + 2 * w), min(world.height, by + 2 * h))
    ctx = pre.crop(ctx_box)
    mi = Image.fromarray((mask[by:by + h, bx:bx + w] * 255).astype(np.uint8)).convert('RGB')
    img, h1 = b64(crop); m64, h2 = b64(mi); c64, h3 = b64(ctx)
    out = run('/inpaint-image-pro-flash', {'image': img, 'mask_image': m64, 'description': PROMPT, 'context_image': c64,
              'bounding_box': {'x': bx - ctx_box[0], 'y': by - ctx_box[1], 'width': w, 'height': h},
              'output_method': 'Modify current layer', 'seed': 11},
              tag, {h1: f'{tag} crop ({bx},{by},{w}x{h}) of world-g1 (median pre-fill)', h2: f'{tag} mask', h3: f'{tag} context {ctx_box}'},
              'clear the baked rubble heap from the ground under it')
    new = np.asarray(out[0].convert('RGB').resize((w, h), Image.NEAREST)).astype(np.float32)
    mm = mask[by:by + h, bx:bx + w]
    raw = np.asarray(world.crop((bx, by, bx + w, by + h))).astype(np.float32)
    mmi = Image.fromarray(mm.astype(np.uint8) * 255)
    outer = (np.asarray(mmi.filter(ImageFilter.MaxFilter(9))) > 0) & ~mm
    inner = mm & ~(np.asarray(mmi.filter(ImageFilter.MinFilter(9))) > 0)
    if outer.sum() > 30 and inner.sum() > 30:
        new = np.clip(new * (raw[outer].mean(0) + 1) / (new[inner].mean(0) + 1), 0, 255)
    keep = raw.copy(); keep[mm] = new[mm]
    a = np.asarray(world).copy(); a[by:by + h, bx:bx + w] = np.clip(keep + 0.5, 0, 255).astype(np.uint8)
    return Image.fromarray(a)


def reground(world, mask, n, scene):
    from world import PROMPT, PAGE as PG
    from tone import lowpass, LUMA_K
    ys, xs = np.nonzero(mask)
    cx, cy = (int(xs.min()) + int(xs.max())) // 2, (int(ys.min()) + int(ys.max())) // 2
    bx, by = cx - 128, cy - 128
    comp = Image.new('RGBA', world.size, PG + (255,))
    from compose import place
    for k, piece in enumerate(scene['ground']):
        if not is_heap(piece): comp = Image.alpha_composite(comp, place(piece))
    crop = comp.convert('RGB').crop((bx, by, bx + 256, by + 256))
    img, h = b64(crop)
    out = run('/edit-images-v2', {'method': 'edit_with_text', 'edit_images': [{'image': img, 'width': 256, 'height': 256}],
              'image_size': {'width': 256, 'height': 256}, 'description': PROMPT, 'seed': 11},
              f'reground-{n}', {h: f'composite without heaps, crop ({bx},{by},256x256)'}, 'the ground under a rubble heap, for clearing it')
    o = np.asarray(crop.convert('YCbCr')); r = np.asarray(out[0].convert('RGB').resize((256, 256), Image.NEAREST).convert('YCbCr'))
    sh = lowpass(o) - lowpass(r); sh[..., 0] *= LUMA_K
    new = np.asarray(Image.fromarray(np.clip(r + sh + 0.5, 0, 255).astype(np.uint8), 'YCbCr').convert('RGB')).astype(np.float32)
    mm = mask[by:by + 256, bx:bx + 256]
    raw = np.asarray(world.crop((bx, by, bx + 256, by + 256))).astype(np.float32)
    mmi = Image.fromarray(mm.astype(np.uint8) * 255)
    outer = (np.asarray(mmi.filter(ImageFilter.MaxFilter(9))) > 0) & ~mm
    ring = outer & ~(np.asarray(mmi.filter(ImageFilter.MaxFilter(3))) > 0)
    new = np.clip(new * (raw[ring].mean(0) + 1) / (new[ring].mean(0) + 1), 0, 255)
    keep = raw.copy(); keep[mm] = new[mm]
    a = np.asarray(world).copy(); a[by:by + 256, bx:bx + 256] = np.clip(keep + 0.5, 0, 255).astype(np.uint8)
    return Image.fromarray(a)


# composite px boxes (x0, y0, x1, y1) with generator glyphs in them, minus a corner to keep (kerb stones)
GLYPHS = [((736, 386, 795, 430), (772, 386, 795, 400))]


def unglyph(world):
    from collections import Counter
    a = np.asarray(world).copy()
    luma = a.astype(np.float32) @ np.array([0.299, 0.587, 0.114], np.float32)
    for (x0, y0, x1, y1), (kx0, ky0, kx1, ky1) in GLYPHS:
        for y in range(y0, y1):
            for x in range(x0, x1):
                if luma[y, x] >= 75 or (kx0 <= x < kx1 and ky0 <= y < ky1): continue
                n = [tuple(a[j, i]) for j in range(y - 3, y + 4) for i in range(x - 3, x + 4) if luma[j, i] >= 75]
                if n: a[y, x] = Counter(n).most_common(1)[0][0]
    return Image.fromarray(a)


def ground_colour(world, alpha):
    """Un-mix the page where the composite was translucent; carry the recovered colour outward below alpha 0.35."""
    r = np.asarray(world).astype(np.float32); A = alpha[..., None]
    g = np.where(A > 0.999, r, (r - (1 - A) * PAGE) / np.maximum(A, 1e-3))
    ok = alpha >= 0.35
    g = np.clip(g, 0, 255) * ok[..., None]
    # carry outward: repeated 3x3 mean of known pixels into unknown ones
    known = ok.astype(np.float32)
    for _ in range(64):
        if known.min() > 0: break
        s = sum(np.roll(np.roll(g, dy, 0), dx, 1) for dy in (-1, 0, 1) for dx in (-1, 0, 1))
        n = sum(np.roll(np.roll(known, dy, 0), dx, 1) for dy in (-1, 0, 1) for dx in (-1, 0, 1))
        fill = (known == 0) & (n > 0)
        g[fill] = s[fill] / n[fill][:, None]; known[fill] = 1
    return g


if __name__ == '__main__':
    scene = json.load(open(SCENE))
    world = Image.open(f'{RA}/world-g1.png').convert('RGB')
    for n, piece in enumerate(scene['ground']):
        if is_heap(piece):
            m = np.asarray(Image.open(f'{RA}/layers/{n}.png')) > 20
            m = np.asarray(Image.fromarray(m.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(7))) > 0
            world = reground(world, m, n, scene)
    world = unglyph(world)
    world.save(f'{RA}/world-g1-clear.png')
    comp_a = np.asarray(Image.open(f'{RA}/composite.png').getchannel('A')).astype(np.float32) / 255
    colour = ground_colour(world, comp_a)
    os.makedirs(f'{RA}/pieces', exist_ok=True)
    for n, piece in enumerate(scene['ground']):
        if is_heap(piece): continue
        x, y = round(piece['x'] - X0), round(piece['y'] - Y0)
        w, h = round(piece['width']), round(piece['height'])
        a = np.asarray(Image.open(f'{RA}/layers/{n}.png'))[y:y + h, x:x + w]
        rgb = np.clip(colour[y:y + h, x:x + w] + 0.5, 0, 255).astype(np.uint8)
        Image.fromarray(np.dstack([rgb, a]), 'RGBA').save(f'{RA}/pieces/{n}.png')
    print('wrote', len(os.listdir(f'{RA}/pieces')), 'pieces')
