"""The river road's countryside terrain (RG-02, owner's yes 2026-11-20, up to 90 credits): four 32 px Wang sets made as
the coast's were (`rg02tiles.py`), /create-tileset in pro mode with the village palette. They replace the harbour and
quarry tiles the stage-4 bake borrowed, which read as a speckled road, black water, peach gravel and cracked paving.
Saved under assets/tiles/rg02_<label>/; booked in ledger.json under `rg02_ts_`, inside RG-02's cap (`rg02chars.CAP`).
Usage (from prototypes/topdown): python3 tools/rrtiles.py <road|river|ford|rise> ..."""
import os, sys, json
sys.path.insert(0, 'tools'); import pl
from rg02chars import cap
from rg02tiles import save
from tiles import tileset

os.environ.setdefault('PIXELLAB_REGION', 'saltstep_emberwatch')
S = json.load(open('style.json'))
PAL = {'target_palette': {'colors': S['palette'], 'name': 'village'}}
# art-lessons: name what the ground is NOT, and ask for calm (few tones, low contrast) so objects read on it.
GRASS = ('short soft meadow grass in a bright morning, even mid green with a few slightly lighter and darker blades, calm '
         'and low contrast, no flowers, no stones, no pattern')
SETS = {
    # the cart road: packed earth worn smooth by wheels, on meadow
    'road': ('a packed earth country cart road worn smooth by wheels, warm light brown, calm and even with only a few faint '
             'darker wheel-rut streaks and a very few tiny pebbles, low contrast, no speckle, no cracks, no stones, no pattern',
             GRASS, 'a soft trodden verge where short grass thins out onto the earth', 0.25),
    # the river and its side stream: slow, brown-green, shallow-looking at the edge, a muddy bank
    'river': ('a slow wide country river, calm brownish green-teal water, mid tone not dark, with soft long ripples running '
              'left to right and a few pale glints, no foam, no rocks, no pattern',
              GRASS, 'a narrow damp brown mud bank with a few reeds where the grass meets the water', 0.25),
    # the ford and the gravel bars: pale grey river gravel, clear shallows over pebbles
    'ford': ('clear shallow river water over pale pebbles, light greenish-grey with soft ripples, the pebbles showing through, '
             'calm, no foam, no pattern',
             'a dry pale grey river gravel bar of small rounded pebbles and coarse grey sand, calm and low contrast, '
             'no large stones, no cracks, no slabs',
             'wet darker gravel at the waterline', 0.25),
    # the lookout rise and the cliff at the bend: weathered grey rock outcrop with grass in its hollows
    'rise': (GRASS,
             'the flat top of a weathered grey rock outcrop, smooth rounded light grey stone with a few soft darker hollows '
             'and small tufts of grass in them, calm, not paving, not slabs, no regular cracks, no pattern',
             'grass thinning over the rock\'s rounded edge', 0.25),
}

if __name__ == '__main__':
    for label in sys.argv[1:]:
        lower, upper, trans, size = SETS[label]
        cap(15)
        e, r = tileset(f'rg02_ts_{label}32', lower, upper, trans, size, 'pro', PAL, ts=32)
        save(label, r['final']['last_response']['tileset_id'])
