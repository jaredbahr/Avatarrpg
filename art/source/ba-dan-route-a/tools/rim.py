"""Polish step: the village's edge. The first restyle invented stone and paving where the source had page colour, and
`world.keep_margin` faded it into the page, so faint ghosts of paving and a pale halo ring the canopies (strongest at the
top-left), and a ghosted patch of paving shows in the woods behind the north wall.

1. `unghost`: from the flat page, flood into pixels that are page-like or washed out (low saturation, not a 1 px dark
   outline), at most `REACH` px from the flat page, and set them to the page colour. The canopies' dark outlines stop it.
2. The patch behind the wall is redrawn as the woods' floor (Pro Flash inpaint)."""
from polishlib import *
from roots import flood

REACH = 14
BEHIND_WALL = [(2095, 360), (2232, 360), (2232, 426), (2214, 432), (2095, 368)]
WOODS = ('Fill the masked area with the shaded woodland floor beyond a garden wall: dark green shrubs, ferns and low foliage '
         'in deep shade, continuing the trees around it. ' + STYLE + '. No paving, no stones, no path, no people.')

def unghost(world):
    a = np.asarray(world).astype(np.float32)
    d = np.abs(a - MARGIN).max(-1)
    near = d <= 10
    flat = erode(near, 3)
    mx, mn = a.max(-1) / 255, a.min(-1) / 255
    s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    lum = a @ np.array([0.299, 0.587, 0.114])
    washed = (lum > 80) & (s < 0.36)  # pale ghosts only; the dark shadow fringe stays
    reach = dilate(flat, REACH)
    grown = flood(flat, (washed | near) & reach)
    out = a.copy(); out[grown] = MARGIN
    return Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8)), grown & ~near

def apply(world):
    ids = ids_world()
    m = polygon(ids.shape, BEHIND_WALL) & (ids == 0)
    world = inpaint(world, m, 'p1-rim-behind-wall', WOODS)
    world, _ = unghost(world)
    return world
