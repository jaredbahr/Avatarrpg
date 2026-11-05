"""v10 angle retakes: create-object-pro-flash, view low top-down, ONE reference for the angle (the oven, front-on), the size stated
against Kaya (44 px tall) as Imagination's PIXELLAB_CONSISTENCY recipe does."""
import sys, json; sys.path.insert(0, 'tools'); import pl
from PIL import Image
S = json.load(open('style.json'))
ref = Image.open('assets/objects8/oven.png').convert('RGBA')
REF = {'image': pl.b64(ref), 'size': {'width': ref.width, 'height': ref.height},
       'usage_description': ("the camera and style reference: a front-on low top-down view. The object's front face is square to the camera and parallel to "
                             "the bottom of the picture, its top is seen as a shallow slanted band above the front face, never seen from a corner, never from straight above. "
                             "Match its pixel size, one-pixel outline in a darker tone of the material, flat shading with light from the upper left, and palette.")}
ITEMS = json.load(open('v10/items.json'))
FC = {'earth_wall', 'pine_a', 'pine_b', 'pine_c', 'rubble', 'boulder', 'oil_flask', 'hay_bale', 'puddle', 'stump', 'cart_wheel', 'milestone', 'log'}
for k in sys.argv[1:]:
    it = ITEMS[k]; W, H = it['canvas']
    desc = (f"{it['desc']}, seen front-on from a low top-down camera: the front face square to the viewer, the top a shallow band above it, not turned to a corner. "
            f"About {it['w']} px wide and {it['h']} px tall (a person is 44 px tall), standing at the bottom centre of an empty transparent canvas. "
            "No ground, no shadow, no background. " + S['style_suffix'])
    body = {'description': desc, 'view': 'low top-down', 'n_directions': 1, 'image_size': {'width': W, 'height': H}, 'style_image': REF,
            'target_palette': {'colors': S['palette'], 'name': 'village'}, 'seed': it.get('seed', 3)}
    e, r = pl.run('/create-object-pro-flash', body, (f'fc_{k}' if k in FC else f'v10_{k}' if not k.endswith(('2',)) and k not in ('barrow','canal_bridge','east_bridge','steps') else f'v11_{k}'), estimate=8)
    fin = r['final']; lr = fin.get('last_response') or fin; ims = []
    for u in (lr.get('storage_urls') or {}).values(): ims.append(pl.fetch(u))
    if not ims:
        oid = lr.get('object_id') or fin.get('object_id') or (r['post'] or {}).get('object_id')
        print(k, 'no inline image; keys', list(lr.keys())[:12], 'object', oid)
        json.dump({'final': fin, 'post': r['post']}, open(f'v10/{k}_resp.json', 'w'))
        continue
    ims[0].save(f'v10/{k}.png' if k not in FC else f'fc/obj_{k}.png'); print(k, ims[0].size, e['credits'])
