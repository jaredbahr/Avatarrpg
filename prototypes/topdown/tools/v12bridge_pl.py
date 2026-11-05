"""v12b: the canal bridge from PixelLab: create-object-pro-flash, view low top-down, the oven as the ONE angle/style reference, three seeds."""
import sys, json; sys.path.insert(0, 'tools'); import pl
from PIL import Image
S = json.load(open('style.json'))
ref = Image.open('assets/objects8/oven.png').convert('RGBA')
REF = {'image': pl.b64(ref), 'size': {'width': ref.width, 'height': ref.height},
       'usage_description': ("the camera and style reference: a front-on low top-down view. The object's front face is square to the camera and parallel to the bottom of the picture, "
                             "its top is seen as a shallow slanted band above the front face, never from a corner, never from straight above. Match its pixel size, one-pixel outline in a darker tone of the material, flat shading with light from the upper left, and palette.")}
desc = ("a short wooden plank footbridge over a narrow canal, seen from the front and slightly above: a flat plank deck receding a little up the picture, "
        "a thick side beam and a low wooden rail with posts along each side, and a block of grey cut stone at each end holding the deck up (the near stone block lower in the picture, the far one higher), "
        "the deck running up the picture between them. About 46 px wide and 54 px tall (a person is 44 px tall), standing at the bottom centre of an empty transparent canvas. "
        "No water, no ground, no shadow, no background. " + S['style_suffix'])
for seed in map(int, sys.argv[1:]):
    body = {'description': desc, 'view': 'low top-down', 'n_directions': 1, 'image_size': {'width': 64, 'height': 64}, 'style_image': REF,
            'target_palette': {'colors': S['palette'], 'name': 'village'}, 'seed': seed}
    e, r = pl.run('/create-object-pro-flash', body, f'v12b_bridge_{seed}', estimate=8)
    fin = r['final']; lr = fin.get('last_response') or fin; ims = []
    for u in (lr.get('storage_urls') or {}).values(): ims.append(pl.fetch(u))
    if not ims: print(seed, 'no image', list(lr.keys())[:10]); continue
    ims[0].save(f'v12/bridge_seed{seed}.png'); print(seed, ims[0].size, e['credits'])
