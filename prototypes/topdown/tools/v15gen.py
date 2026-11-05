"""v14: Ba Dan's houses redrawn with volume. create-object-pro-flash, view low top-down, the oven as the ONE angle/style reference in every prompt,
the size stated in px against Kaya (44 px tall). Raw -> v14/raw/<key>_<seed>.png.   Usage: python3 tools/v14gen.py key[:seed][:WxH] ..."""
import sys, json; sys.path.insert(0, 'tools'); import pl
from PIL import Image
S = json.load(open('style.json'))
ref = Image.open('assets/objects8/oven.png').convert('RGBA')
REF = {'image': pl.b64(ref), 'size': {'width': ref.width, 'height': ref.height},
       'usage_description': ("the camera-height and pixel-style reference: a low top-down camera, the front face square to the viewer and the top seen as a shallow slanted band above it. "
                             "Use the same camera height. Match its pixel size, one-pixel outline in a darker tone of the material, flat shading with light from the upper left, and palette.")}
VOL = ("STRAIGHT FRONT VIEW: the camera faces the facade squarely, the front wall is parallel to the picture plane and its bottom edge is a perfectly horizontal line. "
       "No side wall is visible, at most a very thin vertical sliver of shaded side at the far right edge; no corner view, no diagonal edges, no perspective angle. "
       "The roof is a gable seen from low above: its top plane recedes straight up the picture, symmetric, with thick deep front eaves that cast a dark shadow on the wall below. "
       "The door and windows are set deep in the wall: dark recessed reveals and a stone sill under every window. "
       "A solid grey stone foundation runs along the whole bottom, with a flat doorstep slab at the door. The front door is exactly in the centre of the facade. ")
IT = {
 'house_gao': "a narrow two-storey village cottage: warm ochre plaster walls with dark brown timber beams, a steep terracotta clay-tile gabled roof, a red brick chimney on the right of the roof, one small dark window in the upper gable, an arched wooden front door and a small window on each side of it",
 'house_mira': "a two-storey village house: cream plaster walls with dark brown half-timbering, a terracotta clay-tile gabled roof, a red brick chimney on the right of the roof, a round-topped window in the upper gable, a big wooden double front door and one arched window on each side",
 'house_ne': "a two-storey village house: pale grey-white plaster walls with dark timber beams, a dark green glazed-tile gabled roof, a grey stone chimney on the left of the roof, red-brown wooden shutters on the windows, an arched wooden front door with a small herb wreath hung on it",
 'house_pella': "a two-storey village house: cream plaster walls with dark brown half-timbering, a dark green glazed-tile gabled roof, no chimney, a window with a flower box above the door, a plain plank front door with a window and flower box on each side",
 'house_merchant': "a wide two-storey village shop-house: cream plaster walls with dark brown timber beams, a terracotta clay-tile gabled roof with a red brick chimney, green wooden shutters, wide wooden double shop doors under a small plank awning, a wooden hanging shop sign without letters beside the door, broad grey stone steps in front",
 'house_se': "a two-storey village house: warm ochre plaster walls with dark brown timber beams, a terracotta clay-tile gabled roof, a red brick chimney on the right of the roof, blue-grey shutters on the windows, a blue-grey painted front door, window flower boxes",
}
SIZE = {'house_gao': (225, 250), 'house_mira': (240, 250), 'house_ne': (235, 250), 'house_pella': (235, 250), 'house_merchant': (250, 190), 'house_se': (235, 250)}
for arg in sys.argv[1:]:
    p = arg.split(':'); k = p[0]; seed = int(p[1]) if len(p) > 1 and p[1] else 3
    w, h = SIZE[k]; W, H = map(int, p[2].split('x')) if len(p) > 2 else (256, 256 if k != 'house_merchant' else 224)
    desc = (f"{IT[k]}. {VOL}The house is very large and fills the canvas completely, edge to edge, with almost no empty margin: about {w} px wide and {h} px tall (a person is only 44 px tall, so the door is about 60 px tall and each window about 36 px), standing at the bottom centre of an empty transparent canvas. No ground, no shadow, no background. " + S['style_suffix'])
    body = {'description': desc, 'view': 'low top-down', 'n_directions': 1, 'image_size': {'width': W, 'height': H}, 'style_image': REF,
            'target_palette': {'colors': S['palette'], 'name': 'village'}, 'seed': seed}
    e, r = pl.run('/create-object-pro-flash', body, f'v15_{k}_{seed}_{W}x{H}', estimate=12)
    fin = r['final']; lr = fin.get('last_response') or fin; ims = [pl.fetch(u) for u in (lr.get('storage_urls') or {}).values()]
    if not ims: print(k, 'no image', list(lr.keys())[:10]); continue
    (pl.HERE / 'v15' / 'raw').mkdir(parents=True, exist_ok=True); ims[0].save(pl.HERE / 'v15' / 'raw' / f'{k}_{seed}_{W}x{H}.png'); print(k, seed, ims[0].size, e['credits'], e.get('balance_diff'))
