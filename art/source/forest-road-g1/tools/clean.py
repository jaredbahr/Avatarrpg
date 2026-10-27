"""Forest road G1, step 3b (polish, owner 2026-10-27: "clean up visuals"): what the restyle invented or drew too hard.
Called by cut.py on the cleared world, before the pieces are cut. Composite px throughout.

- `INVENTED`: a fern past the east shelf in the apron's fade. `faces`: the board's south edge, whose cut face showed as
  horizontal stripes. (The bushes past the west corner lie where every ground piece is transparent, so they
  never show; `clean-west-bushes-*` in the ledger were not needed.) Each is redrawn by one Pro Flash inpaint (the meadow
  running on to the fade; the face as a shaded earth bank). Jobs in the ledger as `clean-*`.
- `unpad`: lily pads the restyle floated near the middle of water cells. A pad pixel (green, inside the water) more than
  `PAD_KEEP` px from the bank takes the commonest water colour of its 9x9 neighbourhood, so the open water reads as
  water and pads stay only in the shallows by the bank.
- `soft_kerb`: ADR 0085's 1 px contour on the kerb stones read as a stepped dark line at the 1.5 camera. On the route
  plate, away from the pond, the creeks and the shelf, a near-black pixel (luma < `INK_LUMA`) takes the road's own dark joint tone (the 10th luma percentile of the
  route's non-ink pixels)."""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from pl import run, b64

STYLE = ('fine-grain pixel art matching the image around it exactly: 1 px dark brown outline (#1b1410) only on silhouettes, '
         '3-5 flat tone groups per material, matte, warm key light from the upper left, cool brown shadows down-right')
MEADOW = ('Fill the masked area with the meadow grass around it, fading out the same way at the edge: broad patches of three '
          'greens with sparse 1-2 px blade marks. ' + STYLE + '. No bushes, no shrubs, no ferns, no trees, no people.')
FACE = ('Fill the masked area with the cut earth face under the meadow\'s edge: dark brown soil in shade with a few small stones '
        'and fine roots, grass overhanging the top lip, darker toward the bottom. ' + STYLE + '. No stripes, no people.')
INVENTED = {  # name: (polygon, prompt)
    'east-fern': ([(2350, 740), (2440, 740), (2440, 808), (2350, 808)], MEADOW),
}
PAD_KEEP = 10
INK_LUMA = 42
ROUTE_LAYER = 2
KEEP_INK_LAYERS = (3, 4, 5, 6)  # pond-bank, creek-west, creek-east, raised-shelf

def polygon(shape, pts):
    im = Image.new('L', (shape[1], shape[0])); ImageDraw.Draw(im).polygon(pts, fill=255)
    return np.asarray(im) > 0

# the south edge's four facets, each between the board's vertical corner lines (kept, 1 px each side). There the pieces
# are mostly below alpha 0.35, so what shows is cut.py's colour carried outward, which smeared into stripes: the facets
# are redrawn on that carried colour (`faces`), not on the world
FACES = {
    'face3-1': [(1360, 1192), (1458, 1242), (1458, 1344), (1360, 1344)],
    'face3-2': [(1462, 1240), (1597, 1176), (1597, 1279), (1462, 1343)],
    'face3-3': [(1601, 1176), (1739, 1242), (1739, 1343), (1601, 1279)],
    'face3-4': [(1743, 1240), (1822, 1203), (1822, 1344), (1743, 1344)],
}
SOIL = np.array([74, 56, 40])  # a face is blanked to this first, so the generator cannot continue the stripes

def inpaint(world, mask, tag, prompt):
    if prompt is FACE:
        a = np.asarray(world).copy(); a[mask] = SOIL; world = Image.fromarray(a)
    ys, xs = np.nonzero(mask)
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()) + 1, int(ys.min()), int(ys.max()) + 1
    w = max(32, ((x1 - x0 + 16 + 3) // 4) * 4); h = max(32, ((y1 - y0 + 16 + 3) // 4) * 4)
    assert w <= 256 and h <= 256, (tag, w, h)
    bx = min(max(0, (x0 + x1) // 2 - w // 2), world.width - w); by = min(max(0, (y0 + y1) // 2 - h // 2), world.height - h)
    crop = world.crop((bx, by, bx + w, by + h))
    ctx_box = (max(0, bx - w), max(0, by - h), min(world.width, bx + 2 * w), min(world.height, by + 2 * h))
    ctx = world.crop(ctx_box)
    mi = Image.fromarray((mask[by:by + h, bx:bx + w] * 255).astype(np.uint8)).convert('RGB')
    img, h1 = b64(crop); m64, h2 = b64(mi); c64, h3 = b64(ctx)
    out = run('/inpaint-image-pro-flash', {'image': img, 'mask_image': m64, 'description': prompt, 'context_image': c64,
              'bounding_box': {'x': bx - ctx_box[0], 'y': by - ctx_box[1], 'width': w, 'height': h},
              'output_method': 'Modify current layer', 'seed': 11},
              tag, {h1: f'{tag} crop ({bx},{by},{w}x{h}) of world-g1-clear', h2: f'{tag} mask', h3: f'{tag} context {ctx_box}'},
              'polish: redraw what the restyle invented')
    new = np.asarray(out[0].convert('RGB').resize((w, h), Image.NEAREST)).astype(np.float32)
    old = np.asarray(crop).astype(np.float32); mm = mask[by:by + h, bx:bx + w]
    mmi = Image.fromarray(mm.astype(np.uint8) * 255)
    ring = (np.asarray(mmi.filter(ImageFilter.MaxFilter(11))) > 0) & ~(np.asarray(mmi.filter(ImageFilter.MaxFilter(3))) > 0)
    if ring.sum() > 40:
        new = np.clip(new * (old[ring].mean(0) + 1) / (new[ring].mean(0) + 1), 0, 255)
    keep = old.copy(); keep[mm] = new[mm]
    a = np.asarray(world).copy(); a[by:by + h, bx:bx + w] = np.clip(keep + 0.5, 0, 255).astype(np.uint8)
    return Image.fromarray(a)

def hsv(a):
    f = a.astype(np.float32) / 255
    mx, mn = f.max(-1), f.min(-1); s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    return np.degrees(np.arctan2(np.sqrt(3) * (g - b), 2 * r - g - b)) % 360, s, mx

def grow(m, r):
    return np.asarray(Image.fromarray(m.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(2 * r + 1))) > 0

def unpad(world):
    from collections import Counter
    a = np.asarray(world).copy()
    h, s, v = hsv(a)
    water = (h > 175) & (h < 235) & (s > 0.35)
    body = ~grow(~grow(water, 6), 6)              # the water closed over its pads: the water's own extent
    pad = body & ~water & (h > 50) & (h < 160)
    shore = ~body
    far = ~grow(shore, PAD_KEEP)
    todo = pad & far
    ys, xs = np.nonzero(todo)
    for y, x in zip(ys, xs):
        n = a[max(0, y - 4):y + 5, max(0, x - 4):x + 5].reshape(-1, 3)
        wm = water[max(0, y - 4):y + 5, max(0, x - 4):x + 5].reshape(-1)
        if wm.any(): a[y, x] = Counter(map(tuple, n[wm])).most_common(1)[0][0]
    return Image.fromarray(a), int(todo.sum())

def soft_kerb(world, layers):
    a = np.asarray(world).astype(np.float32)
    route = np.asarray(Image.open(f'{layers}/{ROUTE_LAYER}.png')) > 200
    for n in KEEP_INK_LAYERS:  # the pond and creek banks and the shelf keep their contour
        route &= ~grow(np.asarray(Image.open(f'{layers}/{n}.png')) > 10, 3)
    luma = a @ np.array([0.299, 0.587, 0.114], np.float32)
    ink = route & (luma < INK_LUMA)
    tone = np.percentile(a[route & ~ink], 10, axis=0) if (route & ~ink).any() else a[route].mean(0)
    # the darkest road tone that is still a joint, not the ink
    dark = a[route & ~ink & (luma < np.percentile(luma[route & ~ink], 12))]
    tone = np.median(dark, axis=0)
    a[ink] = tone
    return Image.fromarray(np.clip(a + 0.5, 0, 255).astype(np.uint8)), int(ink.sum())

def faces(colour):
    """The facets redrawn as a shaded earth bank on cut.py's carried colour (float RGB array); returns the array."""
    world = Image.fromarray(np.clip(colour + 0.5, 0, 255).astype(np.uint8))
    shape = (world.height, world.width)
    for name, pts in FACES.items():
        world = inpaint(world, polygon(shape, pts), f'clean-{name}', FACE)
    return np.asarray(world).astype(np.float32)

def apply(world, layers):
    shape = (world.height, world.width)
    comp_a = np.asarray(Image.open(f'{layers}/../composite.png').getchannel('A')) > 10
    for name, (pts, prompt) in INVENTED.items():
        m = polygon(shape, pts) & comp_a
        if m.any(): world = inpaint(world, m, f'clean-{name}', prompt)
    world, n_pad = unpad(world)
    world, n_ink = soft_kerb(world, layers)
    print('clean: pad px', n_pad, 'kerb ink px', n_ink)
    return world
