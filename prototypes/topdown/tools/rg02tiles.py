"""RG-02 (Saltstep and Emberwatch): the region's four 32 px Wang terrain sets (ADR 0103), made as the quarry's were
(`t13tiles.py`): /create-tileset in pro mode, the village palette, per-pixel organic edges. Each is saved by corner key
under assets/tiles/rg02_<label>/. Every job is booked in ledger.json under `rg02_ts_`, tagged `saltstep_emberwatch`,
and counts toward RG-02's cap (`rg02chars.CAP`).
Usage (from prototypes/topdown): python3 tools/rg02tiles.py <planks|quay|parade|yard> ..."""
import io, os, sys, json, base64
sys.path.insert(0, 'tools'); import pl
from rg02chars import cap
from tiles import tileset
from PIL import Image

os.environ.setdefault('PIXELLAB_REGION', 'saltstep_emberwatch')
S = json.load(open('style.json'))
PAL = {'target_palette': {'colors': S['palette'], 'name': 'village'}}
# art-lessons: a flat floor came back as cracked paving that tiled into a grid; say "no cracks, no slabs, no pattern".
WATER = ('calm deep harbour water, dark green-teal with soft small ripples and a few pale glints, no foam, no pattern')
SETS = {
    # the freight pontoon and the market's stall platforms, standing in the harbour
    'planks': (WATER, 'a weathered wooden pontoon deck of long grey-brown planks laid side by side running left to right, '
                      'dark gaps between the planks, a few iron nail heads, worn and salt-bleached',
               'the deck\'s dark wet timber edge with a thin strip of shadow over the water', 0.25),
    # the first planks take (`rg02_ts_planks32`) came back as red-and-grey brick: name the wood, its colour and the
    # direction of the boards, and say what it is not
    'planks2': (WATER, 'a flat wooden boardwalk deck: long straight weathered brown timber boards running left to right, '
                       'each board with visible wood grain, thin dark gaps between the boards, a few iron nail heads; '
                       'wood, not brick, not stone',
                'the deck\'s dark wet timber edge with a thin strip of shadow over the water', 0.25),
    # Saltstep's quay: packed sand and shell grit down to the water
    'quay': (WATER, 'a packed pale sandy quay of fine tan sand and crushed shell grit with a few small pebbles, soft and '
                    'uneven, no cracks, no slabs, no tiles, no pattern',
             'a narrow wet dark sand edge where the quay meets the water', 0.25),
    # Emberwatch's parade ground: packed earth with the barracks' worn flagstones
    'parade': ('a packed dusty earth parade ground, warm tan-brown with fine grit and a few small stones, soft and uneven, '
               'no cracks, no pattern',
               'old worn grey barracks flagstones, large irregular stones fitted together with thin dark joints and a '
               'little moss in the joints',
               '', 0.0),
    # the power yard after rain: dark yard earth with standing puddles
    'yard': ('dark brown muddy yard earth after rain, damp and uneven with a few small stones and boot marks, no cracks, '
             'no pattern',
             'shallow standing rainwater puddle, dark grey-blue still water reflecting a little pale sky, a few glints',
             'a thin wet dark mud rim round the puddle', 0.25),
}


def save(label, tid):
    d = pl.req('GET', f'/tilesets/{tid}'); out = pl.HERE / 'assets' / 'tiles' / f'rg02_{label}'
    out.mkdir(parents=True, exist_ok=True)
    json.dump(pl.strip(d), open(out / 'meta.json', 'w'), indent=1)
    for i, t in enumerate(d['tileset']['tiles']):
        im = Image.open(io.BytesIO(base64.b64decode(t['image']['base64']))).convert('RGBA')
        c = t['corners']; key = ''.join({'upper': 'U', 'lower': 'L', 'transition': 'T'}[c[k]] for k in ('NW', 'NE', 'SW', 'SE'))
        im.save(out / f'{i:02d}_{key}.png')
    print(label, len(d['tileset']['tiles']))


if __name__ == '__main__':
    for label in sys.argv[1:]:
        lower, upper, trans, size = SETS[label]
        cap(15)
        e, r = tileset(f'rg02_ts_{label}32', lower, upper, trans, size, 'pro', PAL, ts=32)
        save(label, r['final']['last_response']['tileset_id'])
