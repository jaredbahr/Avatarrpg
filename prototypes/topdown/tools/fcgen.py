"""Forest combat terrain: two 32 px Wang sets (forest floor/dirt road, creek water/forest floor) and forest-floor variants."""
import sys, json, os; sys.path.insert(0, 'tools'); import pl
from tiles import tileset; import tsdl
S = json.load(open('style.json')); pal = {'target_palette': {'colors': S['palette'], 'name': 'village'}}
n = sys.argv[1]
grass = pl.b64('assets/tiles/gc32/c0000.png'); from PIL import Image
def _g(f): r, g, b = Image.open(f).convert('RGB').resize((1, 1), Image.BOX).getpixel((0, 0)); return g - (r + b) / 2
dirt = pl.b64(min(['assets/tiles/dirt32/c1111.png', 'assets/tiles/dirt32/c0000.png'], key=_g))
if n == 'road':
    e, r = tileset('fc_ts_road32', 'dark green forest floor: short moss and grass with fallen pine needles and scattered brown leaf litter, a little shadowed',
                   'a packed brown dirt road with two faint wheel ruts and small pebbles', '', 0.0, 'pro', dict(pal, lower_reference_image=grass, upper_reference_image=dirt), ts=32)
    t = tsdl.save('fc_road32', r['final']['last_response']['tileset_id']); tsdl.preview(t, 'fc/road_preview.png')
if n == 'creek':
    e, r = tileset('fc_ts_creek32', 'deep slow dark green-blue creek water with faint ripples', 'dark green forest floor: short moss and grass with fallen pine needles and scattered brown leaf litter',
                   'a muddy creek bank with a few small stones', 0.5, 'pro', dict(pal, upper_reference_image=grass), ts=32)
    t = tsdl.save('fc_creek32', r['final']['last_response']['tileset_id']); tsdl.preview(t, 'fc/creek_preview.png')
if n == 'var':
    si = dict(grass, width=32, height=32)
    desc = '1). dark mossy forest floor with fallen pine needles 2). forest floor with brown and orange leaf litter 3). forest floor with a small exposed tree root 4). forest floor with a few small grey pebbles and a fern sprig'
    e, r = pl.run('/create-tiles-pro', {'description': desc, 'tile_type': 'square_topdown', 'tile_size': 32, 'tile_view': 'top-down', 'style_images': [si], 'seed': 5}, 'fc_var_floor', estimate=12)
    tid = r['final']['last_response']['tile_id']; d = pl.req('GET', f'/tiles-pro/{tid}')
    os.makedirs('assets/tiles/fc_var_floor', exist_ok=True)
    for k, u in sorted(d['storage_urls'].items(), key=lambda kv: int(kv[0].split('_')[1])): pl.fetch(u).save(f'assets/tiles/fc_var_floor/{k}.png')
print(n, 'done')
