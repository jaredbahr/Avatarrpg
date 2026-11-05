import sys, json; sys.path.insert(0, 'tools'); import pl
from PIL import Image
S = json.load(open('style.json')); pal = {'target_palette': {'colors': S['palette'], 'name': 'village'}}
# anchor: v8's front-facing props (oven, herb shelf, trough, bench) on an 84 px canvas
anchor = Image.new('RGBA', (84, 84), (0, 0, 0, 0))
for k, x, y in [('herb_shelf', 0, 0), ('oven', 42, 0), ('trough', 0, 44), ('bench', 40, 40)]:
    im = Image.open(f'assets/objects8/{k}.png').convert('RGBA'); anchor.alpha_composite(im, (min(x, 84 - im.width), min(y, 84 - im.height)))
anchor.save('v9/props_anchor.png')
ITEMS = ['a large round grey stone well with a small wooden shingle roof on two posts and a hanging bucket, as wide as the whole canvas',
         'a tall grey stone garden lantern on a square stone pedestal, as tall as the whole canvas',
         'an open wooden woodshed with a sloping plank roof on four posts, split firewood stacked inside, as wide as the whole canvas',
         'a wooden market stall with a red and cream striped cloth awning on four posts, crates of vegetables on its counter, as wide as the whole canvas',
         'a wooden market table with woven baskets of vegetables on it',
         'a low wooden table set with rice bowls and a clay teapot',
         'a wooden market table with clay jars and folded blue cloth on it',
         'a wooden notice board on two posts with a small roof and paper notices pinned to it']
desc = ('village props, every one seen straight from the front in the same low top-down 3/4 view as the reference: the front face square to the viewer and '
        'parallel to the bottom of the canvas, never turned at an angle or seen from a corner, the top seen at the same slight slant; each object stands at the bottom centre of its canvas, '
        'same pixel size, one-pixel outline and shading as the reference, light from the upper left, no ground and no shadow under it, ' + S['style_suffix'])
e, r = pl.run('/create-1-direction-object', {'description': desc, 'view': 'top-down', 'style_images': [pl.b64(anchor)], 'item_descriptions': ITEMS, **pal}, 'v9_props', estimate=15)
lr = r['final'].get('last_response') or {}
for k, u in sorted((lr.get('storage_urls') or {}).items(), key=lambda kv: int(kv[0].split('_')[1])): pl.fetch(u).save(f'v9/edits/v9_props_{k}.png')
print(len(lr.get('storage_urls') or {}), e['credits'])
