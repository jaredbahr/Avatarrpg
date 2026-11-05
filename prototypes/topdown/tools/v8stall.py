import sys, json; sys.path.insert(0, 'tools'); import pl
from PIL import Image
S = json.load(open('style.json')); pal = {'target_palette': {'colors': S['palette'], 'name': 'village'}}
# the anchor: v8's own market tables (density ~0.3) laid on an 84 px canvas, so the stall comes out at their pixel size
anchor = Image.new('RGBA', (84, 84), (0, 0, 0, 0))
for k, x, y in [('market_veg', 0, 40), ('mira_table', 30, 0)]:
    im = Image.open(f'assets/objects8/{k}.png').convert('RGBA'); anchor.alpha_composite(im, (x, min(y, 84 - im.height)))
anchor.save('v8/stall_anchor.png')
ITEMS = ['a wooden market stall with a red and cream striped cloth awning on four posts, baskets of vegetables and fruit on its counter',
         'a wooden market stall with a red and cream striped cloth awning, crates of apples and cabbages on the counter',
         'a small wooden market stall with a striped red and cream awning and a counter of produce baskets',
         'a wooden produce stall with a slanted striped awning and woven baskets on the counter']
desc = ('village props in the same low top-down 3/4 front view as the reference: front faces visible, tops seen at the same slant; each object drawn at the bottom centre of its canvas '
        'at the same pixel size, outline and shading as the reference, light from the upper left, ' + S['style_suffix'])
e, r = pl.run('/create-1-direction-object', {'description': desc, 'view': 'top-down', 'style_images': [pl.b64(anchor)], 'item_descriptions': ITEMS, **pal}, 'v8_stall', estimate=15)
lr = r['final'].get('last_response') or {}
for k, u in sorted((lr.get('storage_urls') or {}).items(), key=lambda kv: int(kv[0].split('_')[1])): pl.fetch(u).save(f'v8/edits/v8_stall_{k}.png')
print(len(lr.get('storage_urls') or {}), e['credits'])
