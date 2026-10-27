"""Polish step: the garden plot (d14, 3x2 at tile (2, 10)) as a tended bed set into the soil.

The round-2 plot was #288's garden kit laid over an older painted bed: the old furrows ran out past the fence to the
north-west, and its inpaint left a dark see-through box over the paving and grass around it. Here:
1. The kit and its shadows are lifted (`props_set.lift`), and the old furrows outside the plot are refilled as grass from
   the lawn a whole number of tiles away (`props_set._clone`).
2. A guide is drawn on the plot's exact diamond (`guide`): a low board frame, ridged soil and three crop rows (cabbages,
   beans on stakes, greens), on the 2:1 grid.
3. One PixelLab `edit-images-v2` `edit_with_text` pass over a 512 px crop renders it in the world's hand (the method of
   the G1 world itself); only the diamond is taken back.
4. With --geometry, d14's frozen sprite becomes the bed's diamond (footprint, depth and flags unchanged)."""
from polishlib import *
import props_set
from style import KEEP

T, R, B, L = (712, 484), (904, 580), (776, 644), (584, 548)   # the plot's corners, world px
LX, LY = (128, 320), (640, 768)                               # the plot in logical px (tile * 64)
CROP = (488, 308, 1000, 820)
PROMPT = ('Redraw as fine-grain pixel art matching the image around it: 1 px dark brown outline (#1b1410) only on silhouettes, '
          '3-5 flat tone groups per material, matte, warm key light from the upper left, cool brown shadows down-right. In the '
          'middle is a tended vegetable garden bed set into the ground: a low frame of thick wooden boards on edge, dark tilled '
          'soil in neat ridges, rows of round green cabbages, bean plants climbing short stakes and leafy greens, well kept. '
          'Grass, paving and trees around it stay as they are. No people, no fence. ' + KEEP)
# the old painted furrows outside the plot (north-west of it), world px
OLD_BED = [(560, 470), (640, 440), (712, 476), (712, 486), (586, 550), (566, 548)]

BOX = [(694, 426), (926, 426), (926, 612), (694, 612)]
BOX_PROMPT = ('Fill the masked area with the ground around it: the paved court of squared stone flags in one warm grey-beige with '
              'dark mossy joints to the north and east, a narrow strip of grass along the wooden garden frame; continue every '
              'joint line and colour, calm and even. ' + STYLE + '. No objects, no shadows, no people.')

GRASS = ('Fill the masked area with the lawn around it: a living grass lawn in three greens with scattered 1-2 px blade marks and a '
         'few small tufts, running up to the wooden garden frame with a little dark soil at its foot. ' + STYLE + '. No objects, no '
         'people, no paths.')
PAVING = ('Fill the masked area with the paved court around it: squared stone flags in one warm grey-beige with dark mossy '
          'joints continuing the joint lines exactly. ' + STYLE + '. No objects, no shadows, no people.')
SURROUND = [
    ('nw-verge', [(566, 486), (610, 470), (708, 470), (712, 486), (588, 549), (566, 549)], GRASS),
    ('west-court-pink', [(694, 424), (768, 424), (768, 460), (694, 460)], PAVING),
    ('east-verge', [(884, 566), (962, 566), (962, 634), (884, 634)], GRASS),
    ('south-verge', [(772, 624), (826, 624), (826, 656), (772, 656)], GRASS),
]

def logical(shape):
    yy, xx = np.mgrid[:shape[0], :shape[1]].astype(np.float32)
    wx, wy = xx - 1224, (yy - 100) * 2
    return (wx + wy) / 2, (wy - wx) / 2

def plot_mask(shape, grow=0):
    lx, ly = logical(shape)
    return (lx >= LX[0] - grow) & (lx < LX[1] + grow) & (ly >= LY[0] - grow) & (ly < LY[1] + grow)

def guide(world):
    a = np.asarray(world).astype(np.float32).copy(); shape = a.shape[:2]
    lx, ly = logical(shape)
    inside = plot_mask(shape)
    u, v = lx - LX[0], ly - LY[0]                       # 0..192 along the rows, 0..128 across
    edge = np.minimum(np.minimum(u, LX[1] - LX[0] - u), np.minimum(v, LY[1] - LY[0] - v))
    soil_dark, soil, ridge = np.array([66, 46, 34]), np.array([92, 64, 44]), np.array([118, 84, 56])
    a[inside] = soil
    rows = (v % 21.3)
    a[inside & (rows < 6)] = ridge
    a[inside & (rows > 15)] = soil_dark
    # crops on the ridges, every 14 px along the row: cabbages, beans, greens, by row
    k = np.floor(v / 21.3).astype(int)
    pu = (u % 14) - 7; pv = rows - 3
    plant = inside & (edge > 8) & (np.hypot(pu, pv * 1.3) < 4.6)
    kind = k % 3
    for kk, (dark, light) in enumerate([((70, 110, 52), (128, 170, 84)), ((52, 92, 44), (96, 140, 62)), ((60, 104, 48), (110, 156, 70))]):
        m = plant & (kind == kk)
        a[m] = dark; a[m & (pu < 0) & (pv < 1)] = light
    # bean stakes: a 1 px pole up 7 world px from each bean plant
    ys, xs = np.nonzero(plant & (kind == 1) & (np.abs(pu) < 0.6) & (np.abs(pv) < 0.6))
    for y, x in zip(ys, xs):
        a[max(0, y - 7):y, x] = (120, 88, 54)
    # the frame: boards 5 logical px wide, light top, a darker front face on the two near sides, an ink outline
    frame = inside & (edge < 5)
    a[frame] = (150, 106, 64)
    front = plot_mask(shape) & ~plot_mask(shape) if False else None
    ring = plot_mask(shape, 2) & ~inside
    near = ring & ((lx >= LX[1]) | (ly >= LY[1]))
    a[near] = (96, 64, 40)
    outline = plot_mask(shape, 3) & ~plot_mask(shape, 2)
    a[outline] = INK
    a[frame & ~erode(frame, 1) & ~inside] = INK
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

def restyle(g):
    crop = g.crop(CROP)
    img, h = b64(crop)
    return run('/edit-images-v2', {'method': 'edit_with_text', 'edit_images': [{'image': img, 'width': 512, 'height': 512}],
               'image_size': {'width': 512, 'height': 512}, 'description': PROMPT, 'seed': 11},
               'p1-garden-bed', {h: 'garden guide crop (488,308,512x512)'}, 'the garden bed from its guide')[0]

def apply(world, geometry=False):
    ids = ids_world(); shape = ids.shape
    world, old = props_set.lift(world, {'garden-kit'})
    kit = np.zeros(shape, bool)
    for lst in old.values():
        for _, obj in lst: kit |= obj
    bed = plot_mask(shape, 3)
    # what the kit and the old furrows leave outside the bed is lawn or paving again
    a = np.asarray(world).astype(np.float32)
    lum = a @ np.array([0.299, 0.587, 0.114])
    furrow = polygon(shape, OLD_BED) & (lum < 110) & ~bed
    # the plot's own piece, plain ground, and tree-3-15, whose frozen silhouette runs over the plot's west corner (no canopy
    # is drawn there; that tree's sprite will carry the corner of the bed)
    mine = (ids == 0) | (ids == piece_index('d14')) | (ids == piece_index('tree-3-15'))
    hole = (dilate(kit, 1) | dilate(furrow, 1)) & ~bed & mine
    from ground import materials
    _, grass, _ = materials(np.asarray(world))
    clean = (ids == 0) & ~dilate(hole | bed, 3) & ~polygon(shape, OLD_BED)
    world = props_set._clone(world, hole, clean)
    # the see-through box the round-2 inpaint left beside the plot: redrawn as the paving and verge around it
    box = polygon(shape, BOX) & ~bed & mine & ~dilate(kit, 1)
    world = inpaint(world, box, 'p1-garden-box2', BOX_PROMPT)
    g = guide(world)
    g.save(os.environ.get('POLISH_WORK', '.review/polish') + '/garden-guide.png')
    out = restyle(g).convert('RGB').resize((512, 512), Image.NEAREST)
    new = np.asarray(world).astype(np.float32).copy()
    o = np.asarray(out).astype(np.float32)
    x0, y0 = CROP[:2]
    sub = new[y0:y0 + 512, x0:x0 + 512]
    take = bed & mine                                   # never over the stone lantern or another piece
    m = take[y0:y0 + 512, x0:x0 + 512]
    ring = dilate(m, 12) & ~dilate(m, 3)
    o = np.clip(o * (sub[ring].mean(0) + 1) / (o[ring].mean(0) + 1), 0, 255)
    sub[m] = o[m]
    new[y0:y0 + 512, x0:x0 + 512] = sub
    world = Image.fromarray(np.clip(new + 0.5, 0, 255).astype(np.uint8))
    # the ground right around the bed, where the old box and furrows still showed as pale see-through patches
    for name, pts, what in SURROUND:
        m = polygon(shape, pts) & ~dilate(take, 1) & ((ids == 0) | (ids == piece_index('d14')))
        if m.any(): world = inpaint(world, m, f'p1-garden-{name}', what)
    if geometry:
        import objects as O
        scene = json.load(open(f'{O.GEO}/scene.json'))
        rgba = np.dstack([np.asarray(world), bed * 255]).astype(np.uint8)
        ys, xs = np.nonzero(bed); bx0, by0 = xs.min(), ys.min()
        im = Image.fromarray(rgba[by0:ys.max() + 1, bx0:xs.max() + 1], 'RGBA')
        spr, inside = O.geometry_sprite({'piece': 'd14', 'image': im, 'xy': (int(bx0), int(by0))}, scene)
        assert inside
        spr.save(f'{O.GEO}/sprites/g1-d14.webp', lossless=True)
    return world, take
