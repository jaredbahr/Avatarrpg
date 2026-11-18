"""v16: Ba Dan's houses redrawn in the Earth Kingdom style (owner, 2026-11-17: follow the game's lore). create-object-pro-flash, view low top-down,
ONE reference image per piece: the existing house, for its size and camera angle only (its European materials are named as not to copy). The
prompt names the nation and the animated style and says what the house is not (art-lessons: straight front view, horizontal base, no side wall,
fills the canvas). Raw -> v16/raw/<key>_<seed>.png. Cap 100 credits for the whole pass (owner), counted here from this tool's jobs.
Usage (from prototypes/topdown): python3 tools/v16gen.py key[:seed] ..."""
import os, sys, json; sys.path.insert(0, 'tools'); import pl
from PIL import Image
CAP = 100.0
S = json.load(open('style.json'))
NOT = ("It is an Earth Kingdom village house as in the Avatar animated style, and it is not European: no half-timbering, no timber-framed beams crossing the walls, "
       "no chimney, no Tudor or medieval look, no red clay tiles. ")
ROOF = ("The roof is a sage green glazed-tile roof with a clear sloping plane and thick eaves whose corners curve gently upward, ending in a dark shadowed underside. ")
BASE = ("Walls of warm rammed-earth brown and ochre with cream limewash panels, on a solid grey stone base along the bottom, held by dark reddish-brown timber posts. "
        "The windows are paper-screen windows with a lattice of wooden bars, set into the wall with a stone sill. ")
STRAIGHT = ("Straight front view, horizontal base, the front facade square to the viewer, no side wall visible, the roof seen as a shallow sloping band above it, "
            "light from the upper left. The front door or doorway is exactly in the centre of the front facade. ")
IT = {
 'house_gao': "a small one-storey Earth Kingdom farm cottage with a round lattice window on each side of a plain wooden door, a few bundles of dried herbs hanging by the door",
 'house_mira': "a larger two-storey Earth Kingdom house, wide and welcoming, a big double wooden front door with iron studs, a lattice window upstairs and a small paper lantern beside the door, a gently upturned green roof over a lower porch roof",
 'house_pella': "a two-storey Earth Kingdom house with solid, fully opaque warm cream and pale ochre limewashed walls on both floors (no green walls, no empty open wall), a round lattice window upstairs, a small flower box under it, a plain double wooden door below",
 'house_se': "a two-storey Earth Kingdom house with a narrow timber balcony with a plank rail on the upper floor, lattice windows, a plain wooden door at the centre, a hanging bamboo rain cover",
 'house_merchant': "a wide two-storey Earth Kingdom shop-house: lattice windows upstairs, an open wooden shop front with a counter and a hanging cloth sign in gold and brown under a small porch roof, two tiers of green glazed roofs with upturned eave corners",
}
SIZE = {'house_gao': (182, 190), 'house_mira': (226, 237), 'house_pella': (214, 221), 'house_se': (204, 218), 'house_merchant': (250, 188)}
RETAKE = {'house_se': (240, 230), 'house_merchant': (256, 200)}  # the first takes came back about 80% as wide
CANVAS = {'house_gao': (224, 224), 'house_mira': (256, 256), 'house_pella': (256, 256), 'house_se': (240, 240), 'house_merchant': (256, 224)}
def used():
    return sum(j.get('credits') or 0 for j in pl.ledger()['jobs'] if j['name'].startswith('v16_'))
for arg in sys.argv[1:]:
    p = arg.split(':'); k = p[0]; seed = int(p[1]) if len(p) > 1 and p[1] else 3
    w, h = SIZE[k]; W, H = CANVAS[k]
    if seed > 3 and k in RETAKE: w, h = RETAKE[k]; W, H = (256, 256) if k == 'house_se' else (256, 224)
    ref = Image.open(f'assets/objects_bd13/{k}.png').convert('RGBA')
    if not os.path.exists(f'v16/old_{k}.png'): os.makedirs('v16', exist_ok=True); ref.save(f'v16/old_{k}.png')
    ref = Image.open(f'v16/old_{k}.png')   # always the original, whatever the pass later writes to assets/
    REF = {'image': pl.b64(ref), 'size': {'width': ref.width, 'height': ref.height},
           'usage_description': ("the size and camera-angle reference only: the same overall size, the same low top-down camera height, the same front-on framing, the door in the same place. "
                                 "Do NOT copy its materials, roof, chimney, timber framing or colours. Match its pixel size, one-pixel outline in a darker tone of the material, and flat shading.")}
    desc = (f"{IT[k]}. {NOT}{ROOF}{BASE}{STRAIGHT}The house is very large and fills the canvas completely, edge to edge, with almost no empty margin: about {w} px wide and {h} px tall "
            f"(a person is only 44 px tall, so the door is about 60 px tall), standing at the bottom centre of an empty transparent canvas. No ground, no shadow, no background. " + S['style_suffix'])
    body = {'description': desc, 'view': 'low top-down', 'n_directions': 1, 'image_size': {'width': W, 'height': H}, 'style_image': REF,
            'target_palette': {'colors': S['palette'], 'name': 'village'}, 'seed': seed}
    if used() + 14 > CAP: raise SystemExit(f'v16 cap: {used()} spent')
    e, r = pl.run('/create-object-pro-flash', body, f'v16_{k}_{seed}_{W}x{H}', estimate=12, region='ba_dan_valley')
    fin = r['final']; lr = fin.get('last_response') or fin; ims = [pl.fetch(u) for u in (lr.get('storage_urls') or {}).values()]
    if not ims: print(k, 'no image', list(lr.keys())[:10]); continue
    os.makedirs('v16/raw', exist_ok=True); ims[0].save(f'v16/raw/{k}_{seed}_{W}x{H}.png'); print(k, seed, ims[0].size, e['credits'], 'v16 total', used())
