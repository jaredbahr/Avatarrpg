import sys, json; sys.path.insert(0, 'tools'); import pl
from PIL import Image
S = json.load(open('style.json')); pal = {'target_palette': {'colors': S['palette'], 'name': 'village'}}
n = sys.argv[1]; size = {'A': 32, 'B': 48, 'C': 60}[n]
stall = Image.open('assets/objects2/stall.png').convert('RGBA')
anchor = stall.crop((24, 24, 24 + size, 24 + size))        # a crop of the same anchor, at the canvas size that sets the object scale
ITEMS = {
 'A': ['a single wooden barrel with iron bands', 'a wooden rain barrel with a lid', 'three small clay pots', 'a wooden bucket with a straw broom leaning on it',
       'two clay flower pots with small green plants', 'a burlap grain sack tied at the top', 'a small grey stone garden lantern', 'a small wooden crate'],
 'B': ['two wooden barrels with iron bands side by side', 'two stacked wooden crates with a burlap sack', 'a wooden crate of carrots and cabbages', 'a neat stack of split firewood logs',
       'grain sacks next to a small hanging scale', 'a long low wooden planter box with red and yellow flowers', 'a wooden wheelbarrow with hay', 'a cooking pot hanging over a small campfire in a ring of stones'],
 'C': ['a wooden market table with woven baskets of vegetables', 'a wooden market table with clay jars and folded cloth', 'a low wooden dining table set with rice bowls and a clay teapot',
       'a wooden bench with a backrest', 'a wooden two-wheeled handcart loaded with grain sacks', 'a wooden shelf rack with herb bundles and jars', 'a wooden water trough with hay',
       'a straw training dummy on a wooden post'],
}[n]
desc = ('village props in the same low top-down 3/4 front view as the reference: front faces visible, tops seen at the same slant; each object drawn at the bottom centre of its canvas '
        'at the same pixel size, outline and shading as the reference, light from the upper left, ' + S['style_suffix'])
e, r = pl.run('/create-1-direction-object', {'description': desc, 'view': 'top-down', 'style_images': [pl.b64(anchor)], 'item_descriptions': ITEMS, **pal}, f'v8_scale_{n}', estimate=26)
lr = r['final'].get('last_response') or {}
for k, u in sorted((lr.get('storage_urls') or {}).items(), key=lambda kv: int(kv[0].split('_')[1])): pl.fetch(u).save(f'v8/edits/v8_scale_{n}_{k}.png')
print(n, len(lr.get('storage_urls') or {}), e['credits'])
