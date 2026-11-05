import sys, json; sys.path.insert(0, 'tools'); import pl
from PIL import Image
S = json.load(open('style.json')); pal = {'target_palette': {'colors': S['palette'], 'name': 'village'}}
n = int(sys.argv[1])
anchor = Image.new('RGBA', (n, n), (0, 0, 0, 0))
for k, x, y in [('trough', 0, 99), ('oven', 99, 0), ('barrel', 0, 0)]:
    im = Image.open(f'assets/objects8/{k}.png').convert('RGBA')
    if im.width <= n and im.height <= n: anchor.alpha_composite(im, (min(x, n - im.width), min(y, n - im.height)))
ITEMS = {60: ['a round grey stone well with a small wooden shingle roof on two posts and a hanging bucket', 'a round grey stone well with a wooden roof and a rope bucket',
              'a stone well with a small pitched wooden roof', 'a round fieldstone village well with a wooden winch roof',
              'a wooden water trough', 'a wooden bench', 'a wooden crate of apples', 'a small wooden handcart'],
         48: ['a grey stone garden lantern on a square pedestal', 'a short stone pagoda lantern on a plinth', 'a grey stone lantern with a little roof cap', 'a squat stone lantern',
              'a wooden barrel', 'a clay pot', 'a wooden crate', 'a burlap sack']}[n]
desc = ('village props, every one seen straight from the front in the same low top-down 3/4 view as the reference: the front face square to the viewer, never turned to a corner, '
        'the top seen at the same slight slant; each stands at the bottom centre of its canvas, same pixel size, one-pixel outline and shading as the reference, '
        'light from the upper left, no ground and no shadow under it, ' + S['style_suffix'])
e, r = pl.run('/create-1-direction-object', {'description': desc, 'view': 'top-down', 'style_images': [pl.b64(anchor)], 'item_descriptions': ITEMS, **pal}, f'v9_small{n}', estimate=15)
lr = r['final'].get('last_response') or {}
for k, u in sorted((lr.get('storage_urls') or {}).items(), key=lambda kv: int(kv[0].split('_')[1])): pl.fetch(u).save(f'v9/edits/v9_small{n}_{k}.png')
print(len(lr.get('storage_urls') or {}), e['credits'])
