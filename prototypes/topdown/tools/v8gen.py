import sys, json; sys.path.insert(0, 'tools'); import pl
from PIL import Image
S = json.load(open('style.json')); pal = {'target_palette': {'colors': S['palette'], 'name': 'village'}}
n = sys.argv[1]
def edit(name, src, desc, seed=7):
    im = Image.open(src).convert('RGBA')
    e, r = pl.run('/edit-image-pro-flash', {'image': pl.b64(im), 'method': 'text', 'description': desc, 'no_background': True, 'seed': seed}, name, estimate=10)
    lr = r['final'].get('last_response') or r['final']; ims = []; pl.images(lr, ims)
    if not ims and lr.get('image_url'): ims = [pl.fetch(lr['image_url'])]
    ims[0].save(f'v8/edits/{name}.png'); print(name, ims[0].size, e['credits'])
KEEP = ' Keep the stone foundation plinth, the doorstep, the overall size and position, the pixel size, outline weight, shading and light from the upper left exactly as they are.'
if n == 'merchant':
    edit('v8_merchant', 'v8/edits/teahouse_plinth.png', 'Restyle this building into a European half-timbered village merchant house that matches a cottage village: replace the curved green tiled roof with a terracotta clay tile gabled roof with a brick chimney, replace the red pillars and paper screens with cream plaster walls and dark timber beams, two shuttered windows, a wide wooden shop door under a small plank awning, a hanging wooden shop sign without letters.' + KEEP)
if n == 'neighbour_a':
    edit('v8_neighbour_a', 'v8/edits/house_green_plinth.png', 'Turn this into a different neighbouring house of the same village: a terracotta clay tile roof instead of the green one, warm ochre plaster walls with dark timber beams, a blue-grey painted door, different window shutters, a small brick chimney on the right.' + KEEP)
if n == 'neighbour_b':
    edit('v8_neighbour_b', 'v8/edits/house_cream_plinth.png', 'Turn this into a different neighbouring house of the same village: a dark green glazed tile roof, pale grey-white plaster walls with dark timber beams, red-brown shutters, a hanging herb bundle by the door, the chimney on the left side of the roof.' + KEEP)
if n == 'props':
    stall = Image.open('assets/objects2/stall.png').convert('RGBA')   # the approved family's stall as the style anchor (84 px crop)
    crop = stall.crop((20, 20, 104, 104))
    e, r = pl.run('/create-1-direction-object', {'description': 'village market props, front view, same pixel size and style as the reference, ' + S['style_suffix'], 'view': 'top-down',
        'style_images': [pl.b64(crop)], 'item_descriptions': [
            'a wooden market table with woven baskets of cabbages, leeks and red peppers, front view, about 72 px wide',
            'a wooden market table with clay jars, a stack of folded cloth bolts and a small scale, front view, about 72 px wide',
            'a wooden two-wheeled handcart loaded with grain sacks and a crate, front view, about 76 px wide',
            'a low wooden dining table set with rice bowls, chopsticks and a clay teapot, front view, about 72 px wide',
            'a wooden water trough on short legs filled with hay, front view, about 56 px wide',
            'a square iron street drain grate set flush in the ground, seen from above, about 20 px wide',
            'stacked wooden crates with a burlap sack leaning on them, front view, about 40 px wide',
            'a pair of wooden barrels with iron bands, one with a lid, front view, about 40 px wide'], **pal}, 'v8_props_batch', estimate=26)
    lr = r['final'].get('last_response') or {}; ims = []
    for k, u in sorted((lr.get('storage_urls') or {}).items()): im = pl.fetch(u); im.save(f'v8/edits/props_{k}.png'); ims.append(im)
    print('props', len(ims), e['credits'])
if n in ('flag', 'cliff'):
    from tiles import tileset; import tsdl
    cob = pl.b64('assets/tiles/gc32/c1111.png'); grass = pl.b64('assets/tiles/gc32/c0000.png')
    if n == 'flag':
        e, r = tileset('v8_ts_flag32', 'large square grey-brown flagstone paving slabs with thin dark joints, worn smooth, a village plaza', 'big irregular rounded grey cobblestones of different sizes with dark mortar lines, a little warm brown', '', 0.0, 'pro', dict(pal, upper_reference_image=cob), ts=32)
        t = tsdl.save('flag32', r['final']['last_response']['tileset_id']); tsdl.preview(t, 'v8/flag_preview.png')
    else:
        e, r = tileset('v8_ts_cliff32', 'empty dark void, flat deep warm near-black purple, nothing in it', 'soft muted green village grass, gentle darker tufts, olive', 'a crumbling earth and rock cliff face with roots and small stones, brown soil and grey rock', 1.0, 'pro', dict(pal, upper_reference_image=grass), ts=32)
        tid = r['final']['last_response']['tileset_id']; d = pl.req('GET', f'/tilesets/{tid}')
        json.dump(pl.strip(d), open('v8/cliff_meta.json', 'w'), indent=1)
        import base64, io, os
        os.makedirs('assets/tiles/cliff32', exist_ok=True)
        for i, t in enumerate(d['tileset']['tiles']):
            im = Image.open(io.BytesIO(base64.b64decode(t['image']['base64']))).convert('RGBA')
            c = t['corners']; key = ''.join({'upper': 'U', 'lower': 'L', 'transition': 'T'}[c[k]] for k in ('NW', 'NE', 'SW', 'SE'))
            im.save(f'assets/tiles/cliff32/{i:02d}_{key}.png')
        print('cliff tiles', len(d['tileset']['tiles']))
if n == 'worn':
    for nm, key, desc in [('cobble2', '1111', '1). grey cobblestones with dark earth packed in the gaps near a wall 2). grey cobblestones worn smooth and slightly lighter in the middle of a street 3). grey cobblestones with a small shallow rain puddle 4). grey cobblestones with a little moss and grass growing in the gaps')]:
        si = dict(pl.b64(f'assets/tiles/gc32/c{key}.png'), width=32, height=32)
        e, r = pl.run('/create-tiles-pro', {'description': desc, 'tile_type': 'square_topdown', 'tile_size': 32, 'tile_view': 'top-down', 'style_images': [si], 'seed': 5}, 'v8_var_' + nm, estimate=12)
        tid = r['final']['last_response']['tile_id']; d = pl.req('GET', f'/tiles-pro/{tid}')
        import os; os.makedirs('assets/tiles/var_cobble2', exist_ok=True)
        for k, u in sorted(d['storage_urls'].items(), key=lambda kv: int(kv[0].split('_')[1])): pl.fetch(u).save(f'assets/tiles/var_cobble2/{k}.png')
        print(nm, len(d['storage_urls']), e['credits'])
if n == 'walkway':
    from obj import mapobj
    for seed in (5, 9):
        mapobj(f'v8_walkway_ew_{seed}', 'a long wooden plank walkway bridge seen from above, the planks run from left to right, low rope railings on both sides, its far end fading into darkness', 128, 64, extra={'seed': seed}, estimate=2)
        mapobj(f'v8_steps_{seed}', 'wooden plank steps going down a cliff edge seen from above and slightly in front, with a rope railing, a path continuing downward', 64, 96, extra={'seed': seed}, estimate=2)
