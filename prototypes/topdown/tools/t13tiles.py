"""Tutorial pass: the quarry's 32 px Wang terrain (pro mode, the village palette, Ba Dan's dirt as the road's reference)."""
import sys, json, os, io, base64; sys.path.insert(0, 'tools'); import pl
from PIL import Image
from tiles import tileset
S = json.load(open('style.json')); pal = {'target_palette': {'colors': S['palette'], 'name': 'village'}}
def _g(f): r, g, b = Image.open(f).convert('RGB').resize((1, 1), Image.BOX).getpixel((0, 0)); return g - (r + b) / 2
dirt = pl.b64(min(['assets/tiles/dirt32/c1111.png', 'assets/tiles/dirt32/c0000.png'], key=_g))
FLOOR = 'pale cream-grey limestone quarry floor: packed grit and fine gravel with scattered small white stone chips and pale dust, a few thin dark cracks'
def save25(label, tid):
    d = pl.req('GET', f'/tilesets/{tid}'); out = pl.HERE / 'assets' / 'tiles' / label; out.mkdir(parents=True, exist_ok=True)
    json.dump(pl.strip(d), open(out / 'meta.json', 'w'), indent=1)
    for i, t in enumerate(d['tileset']['tiles']):
        im = Image.open(io.BytesIO(base64.b64decode(t['image']['base64']))).convert('RGBA')
        c = t['corners']; key = ''.join({'upper': 'U', 'lower': 'L', 'transition': 'T'}[c[k]] for k in ('NW', 'NE', 'SW', 'SE'))
        im.save(out / f'{i:02d}_{key}.png')
    print(label, len(d['tileset']['tiles']))
n = sys.argv[1]
if n == 'floor':
    e, r = tileset('t13_ts_qfloor32', FLOOR, 'a packed brown dirt haul road with two faint wheel ruts and small pebbles', '', 0.0, 'pro', dict(pal, upper_reference_image=dirt), ts=32)
    save25('q_floor32', r['final']['last_response']['tileset_id'])
if n == 'floor2':   # v2 of the floor: the first came back as cracked paving slabs, which tile into a grid
    e, r = tileset('t13_ts_qfloor32b', 'pale cream-grey quarry floor of fine crushed limestone gravel and dust, small scattered pebbles and white stone chips, soft and uneven, no cracks, no slabs, no tiles, no pattern',
                   'a packed brown dirt haul road with two faint wheel ruts and small pebbles', '', 0.0, 'pro', dict(pal, upper_reference_image=dirt), ts=32)
    save25('q_floor32b', r['final']['last_response']['tileset_id'])
if n == 'terrace':
    e, r = tileset('t13_ts_qterrace32', FLOOR, 'the flat top of a raised rough limestone shelf: weathered pale grey rock with cracks, grit and a few dry grass tufts',
                   'a sheer cut limestone quarry face: pale cream rock in stepped blocks with vertical drill marks and dark cracks', 1.0, 'pro', pal, ts=32)
    save25('q_terrace32', r['final']['last_response']['tileset_id'])
if n == 'rim':
    e, r = tileset('t13_ts_qrim32', 'empty dark void, flat deep warm near-black purple, nothing in it', FLOOR,
                   'a crumbling pale limestone and brown earth cliff face with small stones', 1.0, 'pro', pal, ts=32)
    save25('q_rim32', r['final']['last_response']['tileset_id'])
if n == 'var':
    fl = Image.open('assets/tiles/q_floor32/06_LLLL.png')
    si = dict(pl.b64(fl), width=32, height=32)
    desc = '1). pale limestone quarry gravel with a few white chips 2). pale limestone quarry floor with a thin dark crack 3). pale limestone gravel with pale drill dust and a pebble 4). pale limestone floor with a few small grey stones'
    e, r = pl.run('/create-tiles-pro', {'description': desc, 'tile_type': 'square_topdown', 'tile_size': 32, 'tile_view': 'top-down', 'style_images': [si], 'seed': 5}, 't13_var_qfloor', estimate=12)
    tid = r['final']['last_response']['tile_id']; d = pl.req('GET', f'/tiles-pro/{tid}')
    os.makedirs('assets/tiles/q_var_floor', exist_ok=True)
    for k, u in sorted(d['storage_urls'].items(), key=lambda kv: int(kv[0].split('_')[1])): pl.fetch(u).save(f'assets/tiles/q_var_floor/{k}.png')
print(n, 'done')
