"""SQ-01's two pieces (art batch #38, owner's yes 2026-11-19, about 20-40 credits):

- `sq01_sled`: Bo-shan's delivery sled, tipped on its side in the Forest Road's ditch with the load spilled. Made as RG-02's
  objects were (`rg02obj.py`): create-object-pro-flash, low top-down, the oven as the ONE angle reference, the size in px
  against a person (44 px tall). It replaces the cabbage cart that stood in for it (`maps/world.ts`).
- `parcel_cart_tidy`: the persistent change (the story bible, SQ-01: "his later cart has a sensible lower stack and one
  absurd ceremonial cabbage on top"). An edit-image-pro-flash of the shipped `parcel_cart.png`, so the cart and Parcel stay
  on-model, as `bd20gen.py` edits Ba Dan's later-state props.

Every job is booked in ledger.json by pl.run under `sq01_`, and the batch stops at CAP. Raw takes go to $SQ01_RAW (outside
the repo); `sq01proc.py` cleans the chosen take into assets/objects_sq01/.
Usage (from prototypes/topdown):  python3 tools/sq01gen.py sled:<seed> | cart:<seed> ..."""
import os, sys, json
sys.path.insert(0, 'tools'); import pl
from PIL import Image

CAP = 40.0
RAW = os.environ.get('SQ01_RAW', 'sq01/raw')
os.environ.setdefault('PIXELLAB_REGION', 'ba_dan_valley')
S = json.load(open('style.json'))
ref = Image.open('assets/objects8/oven.png').convert('RGBA')
REF = {'image': pl.b64(ref), 'size': {'width': ref.width, 'height': ref.height},
       'usage_description': ("the camera and style reference: a front-on low top-down view. The object's front face is square to the camera and parallel to "
                             "the bottom of the picture, its top is seen as a shallow slanted band above the front face, never seen from a corner, never from straight above. "
                             "Match its pixel size, one-pixel outline in a darker tone of the material, flat shading with light from the upper left, and palette.")}

SLED = ("a small wooden snow-style delivery sled tipped over on its side in a roadside ditch, seen side-on: its two long wooden runners, curling up "
        "at the front like a sled's, are the most visible part, standing on edge one above the other on the right; the low slatted deck faces the viewer "
        "with a folded paper note tucked into its rail. Not a box, not a crate, not a cart: no wheels. On the ground in front of it a split burlap sack "
        "has spilled round green cabbages. Warm weathered timber, pale green cabbages, dusty brown sacking", 52, 30, 56, 48)

# The first take (seed 3) came back as a tipped crate with no runners showing: seeds 11 and 19 say what makes it a sled.
CART = ("Change ONLY the load on the cart behind the bird. Remove the big canvas-covered heap. In its place the load is low, neat and even: "
        "a tidy flat stack of sacks and crates no higher than the cart's side rails, squared off, tied down with a rope. On the very top in the middle "
        "sits ONE enormous round pale green cabbage, much bigger than a normal cabbage, clearly visible above the bird's head. "
        "Keep the ostrich horse, its harness and bell, the wheels, the shafts, the outline, the size and the colours exactly the same.")


def used():
    return sum(j.get('credits') or 0 for j in pl.ledger()['jobs'] if j['name'].startswith('sq01_'))


def guard(est):
    if used() + est > CAP: raise SystemExit(f'sq01 cap: {used()} spent, {est} more would pass {CAP}')


def fetch_one(r):
    fin = r['final']; lr = fin.get('last_response') or fin
    ims = [pl.fetch(u) for u in (lr.get('storage_urls') or {}).values()]
    if not ims:
        ims = []; pl.images(lr, ims)
        if not ims and lr.get('image_url'): ims = [pl.fetch(lr['image_url'])]
    return ims


def save(key, seed, ims, e):
    if not ims: print(key, 'no image'); return
    os.makedirs(RAW, exist_ok=True); ims[0].save(f'{RAW}/{key}_{seed}.png')
    print(key, seed, ims[0].size, e['credits'], 'sq01 total', used())


def sled(seed):
    d, w, h, W, H = SLED
    desc = (f"{d}, seen front-on from a low top-down camera: the front square to the viewer, the top a shallow band above it, not turned to a corner. "
            f"About {w} px wide and {h} px tall (a person is 44 px tall), lying at the bottom centre of an empty transparent canvas. "
            "No ground, no ditch drawn, no shadow, no background. " + S['style_suffix'])
    guard(8)
    e, r = pl.run('/create-object-pro-flash', {'description': desc, 'view': 'low top-down', 'n_directions': 1, 'image_size': {'width': W, 'height': H},
                                               'style_image': REF, 'target_palette': {'colors': S['palette'], 'name': 'village'}, 'seed': seed},
                  f'sq01_sled_{seed}', estimate=8)
    save('sled', seed, fetch_one(r), e)


def cart(seed):
    im = Image.open('../../public/art/topdown/objects/parcel_cart.png').convert('RGBA')
    W = (im.width + 8 + 3) // 4 * 4; H = (im.height + 12 + 3) // 4 * 4   # headroom above for the cabbage
    can = Image.new('RGBA', (W, H)); can.alpha_composite(im, ((W - im.width) // 2, H - im.height))
    D = (CART + " One-pixel dark outlines, flat colours, light from the upper left, the same low top-down front view, no blur, no anti-aliasing. "
         "Nothing around it, no ground, no shadow.")
    guard(6)
    e, r = pl.run('/edit-image-pro-flash', {'image': pl.b64(can), 'method': 'text', 'description': D, 'no_background': True, 'seed': seed},
                  f'sq01_cart_{seed}', estimate=6)
    save('cart', seed, fetch_one(r), e)


if __name__ == '__main__':
    for arg in sys.argv[1:]:
        k, _, sd = arg.partition(':'); {'sled': sled, 'cart': cart}[k](int(sd or 3))
