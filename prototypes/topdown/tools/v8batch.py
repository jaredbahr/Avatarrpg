import sys, json; sys.path.insert(0, 'tools'); import pl
from PIL import Image
S = json.load(open('style.json')); pal = {'target_palette': {'colors': S['palette'], 'name': 'village'}}
n = sys.argv[1]
def batch(name, style, items, desc):
    e, r = pl.run('/create-1-direction-object', {'description': desc + ', ' + S['style_suffix'], 'view': 'top-down', 'style_images': [pl.b64(style)], 'item_descriptions': items, **pal}, name, estimate=26)
    lr = r['final'].get('last_response') or {}; ims = []
    for k, u in sorted((lr.get('storage_urls') or {}).items(), key=lambda kv: int(kv[0].split('_')[1])): im = pl.fetch(u); im.save(f'v8/edits/{name}_{k}.png'); ims.append(im)
    print(name, len(ims), e['credits'])
anchor = Image.open('assets/objects2/stall.png').convert('RGBA').crop((20, 20, 104, 104))   # the same anchor crop as the first batch
FRONT = 'village props in the same low top-down 3/4 front view as the reference: front faces visible, tops seen at the same slant, same pixel size, outline and shading, light from the upper left'
if n == 'b2':
    batch('v8_b2', anchor, ['a slim dark iron street lamp post with a glass lantern on top, about 80 px tall', 'a wooden signpost with two blank arrow boards pointing left and right, no writing, about 56 px tall',
        'a round grey stone village well with a small wooden shingle roof and a bucket on a rope, about 70 px wide', 'a wooden bench with a backrest, about 44 px wide',
        'a long low wooden planter box full of red and yellow flowers, about 56 px wide', 'a wooden village notice board on two posts with pinned paper notes, about 44 px tall',
        'a small grey stone garden lantern, about 36 px tall', 'three clay storage pots of different sizes, about 32 px wide'], FRONT)
if n == 'b3':
    batch('v8_b3', anchor, ['a market stall with a striped red and cream cloth awning on poles over a wooden counter with baskets of fruit and vegetables, about 84 px wide',
        'a short low wooden picket fence section, about 56 px wide', 'a tall wooden pole with a long hanging red cloth banner, about 80 px tall',
        'a laundry line between two wooden posts with hanging cloths, about 72 px wide', 'a wooden rain barrel with iron bands and a lid, about 24 px wide',
        'a wooden water bucket and a straw broom leaning against nothing, about 28 px tall', 'a neat stack of split firewood logs, about 44 px wide',
        'two clay flower pots with small green plants, about 30 px wide'], FRONT)
if n == 'bridge':
    # the canal's own bank and water tiles as the style reference, so the bridge's stone matches the bank
    T = {k: Image.open(f'assets/tiles/canal32/c{k}.png').convert('RGBA') for k in ['1111', '1100', '0000', '0011']}
    mos = Image.new('RGBA', (112, 112))
    for y, k in enumerate(['1111', '1100', '0000', '0011']):
        for x in range(4): mos.alpha_composite(T[k].crop((0, 0, 28, 28)) if False else T[k], (x * 28 - 2, y * 28 - 2))
    mos = mos.crop((0, 0, 112, 112)); mos.save('v8/bridge_style.png')
    e, r = pl.run('/create-1-direction-object', {'description': 'a short footbridge over a stone-banked canal, seen in low top-down 3/4 front view like an RPG village: the bridge runs from the bottom of the image to the top (crossing the canal north to south), a wooden plank deck with low wooden side rails, solid grey stone abutments at both ends built from the same stones as the reference bank, the near abutment face visible; same pixel size, stone texture, palette, outline and shading as the reference', 'view': 'top-down',
        'style_images': [pl.b64(mos)], **pal}, 'v8_bridge', estimate=26)
    lr = r['final'].get('last_response') or {}
    for k, u in sorted((lr.get('storage_urls') or {}).items()): pl.fetch(u).save(f'v8/edits/v8_bridge_{k}.png')
    print('bridge', len(lr.get('storage_urls') or {}), e['credits'])
