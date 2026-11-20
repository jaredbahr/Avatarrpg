"""The river road's object kit (stage 6 of `docs/level-design.md`; the kit list in `docs/places/river_road.md`; owner's
yes 2026-11-20, RG-02's cap raised to 1,850). Made as RG-02's objects are (`rg02obj.py`): create-object-pro-flash, view
low top-down, the oven as the ONE angle reference, the size stated in px against a person (44 px tall). Raw results ->
$RR_RAW/<key>_<seed>.png (outside the repo). Every job is booked in ledger.json under `rg02_obj_rr_`, inside RG-02's cap.
Usage (from prototypes/topdown): python3 tools/rrobj.py <key>[:seed] ..."""
import os, sys
sys.path.insert(0, 'tools'); import pl
from rg02chars import cap
from rg02obj import REF, S

os.environ.setdefault('PIXELLAB_REGION', 'saltstep_emberwatch')
# Outer Earth Kingdom countryside between the coast and Causeway: packed earth, grey river stone, weathered plank.
EK = ', in the Avatar animated style, the outer Earth Kingdom countryside (not European: no half-timbering, no thatch)'
# key: (description, w, h, canvas w, canvas h) -- sizes are the kit list's, in px
IT = {
    'shade_tree': ('a big old broad shade tree with a thick gnarled trunk and a wide round canopy of layered green leaves, '
                   'roots spreading at its foot; it fills the canvas', 80, 117, 88, 120),
    'log_bench': ('a weathered fallen log lying on its side as a seat, bark worn smooth on top where people sit', 64, 20, 72, 48),
    'hitching_post': ('a single short wooden hitching post with an iron ring and a loop of rope tied to it', 10, 40, 48, 48),
    'plank_bridge': ('a short sturdy plank footbridge seen front-on from a low top-down camera: a deck of weathered grey-brown '
                     'boards running left to right, a plain wooden rail on round posts along its far side and its near side, '
                     'wheel ruts worn into the planks; no water, no ground', 80, 96, 88, 104),
    'toll_bar_down': ('a borrowed official red-and-white striped road barrier arm lying level across, its pivot end propped on '
                      'a wooden crate on the left with a stone on it to hold it down, a little too smart for where it is'
                      + EK, 72, 24, 80, 48),
    'toll_bar_up': ('a borrowed official red-and-white striped road barrier arm raised upright, its foot lashed to a short '
                    'wooden post with rope, a wooden crate at its foot' + EK, 20, 72, 48, 80),
    'cold_fire': ('a cold campfire: a ring of grey stones round grey ash and a few charred sticks, no flames, lying flat on '
                  'the ground', 40, 20, 48, 48),
    'bedroll': ('a rolled-up brown blanket bedroll tied with two straps lying on the ground, a little folded tunic on top', 40, 20, 48, 48),
    'rubbish_heap': ('a small untidy heap of camp rubbish on the ground: empty sacks, a broken crate slat, an empty tin, '
                     'cabbage leaves and rice husks', 40, 20, 48, 48),
    'cook_pot': ('a small dented iron cooking pot with a lid and a wire handle, a wooden spoon resting on it', 16, 16, 48, 48),
    'toll_sign': ('a hand-lettered wooden sign on a stake, the board painted with the word TOLL and a crude drawing of a '
                  'cabbage and a sack of rice, the paint a little drippy' + EK, 24, 40, 48, 48),
    'stepping_stones': ('a line of five flat grey river stepping stones running left to right, wet on their sides, seen from a '
                        'low top-down angle, lying flat with no water drawn', 80, 40, 88, 48),
    'fallen_log': ('a long fallen tree trunk lying left to right with broken branch stubs and a little moss, its bark dark and '
                   'wet', 80, 24, 88, 48),
    'driftwood': ('a pale bleached piece of driftwood with a forked end lying on the ground', 40, 16, 48, 48),
    'rockfall': ('a heap of fallen grey rocks and broken stone of different sizes at the foot of a cliff, a little grass between '
                 'them', 120, 45, 128, 56),
    # the first take (seed 3) came back half its length: say it is three times as long as it is deep
    'country_jetty': ('a long low country jetty three times as wide as it is deep, filling the canvas width of rough grey planks on round wooden posts running left to right, a short mooring '
                      'post with a rope at its right end; no water drawn', 120, 40, 128, 48),
    'rowboat': ('a small plain wooden river rowboat lying broadside, seen from the side: the hull runs left to right, much '
                'longer than tall, weathered brown planks, two oars resting inside; no water drawn', 88, 18, 96, 48),
    'net_rack': ('a fishing net hung up to dry between two upright wooden poles, a brown net with cork floats along its top '
                 'edge' + EK, 64, 40, 72, 48),
    'flat_rock': ('a low flat-topped grey rock, smooth and worn where travellers sit, a little grass at its foot', 56, 20, 64, 48),
    'milestone': ('a small carved grey stone milestone, rounded on top, with a simple carved mark and a short line of carved '
                  'characters' + EK, 16, 27, 48, 48),
    # the first take (seed 3) came back 40 px tall: say it reaches the top of the canvas, twice a person's height
    'bent_tree': ('a tall lone wind-bent hill tree, twice as tall as a person, reaching from the bottom to the top of the canvas on a rise: a thin twisted trunk leaning to the right and a flat windswept crown '
                  'of dark green leaves streaming to the right; it fills the canvas height', 40, 90, 48, 96),
    'cabbage_sack': ('a burlap sack of cabbages sitting upright on the ground, slumped open at the top with three round pale '
                     'green cabbages showing', 40, 30, 48, 48),
}


def make(key, seed):
    d, w, h, W, H = IT[key]
    desc = (f"{d}, seen front-on from a low top-down camera: the front face square to the viewer, the top a shallow band above it, not turned to a corner. "
            f"About {w} px wide and {h} px tall (a person is 44 px tall), standing at the bottom centre of an empty transparent canvas. "
            "No ground, no shadow, no background. " + S['style_suffix'])
    body = {'description': desc, 'view': 'low top-down', 'n_directions': 1, 'image_size': {'width': W, 'height': H}, 'style_image': REF,
            'target_palette': {'colors': S['palette'], 'name': 'village'}, 'seed': seed}
    cap(6)
    e, r = pl.run('/create-object-pro-flash', body, f'rg02_obj_rr_{key}_{seed}', estimate=6)
    fin = r['final']; lr = fin.get('last_response') or fin; ims = [pl.fetch(u) for u in (lr.get('storage_urls') or {}).values()]
    if not ims: print(key, 'no image', list(lr.keys())[:10]); return
    out = pl.Path(os.environ.get('RR_RAW', 'rr/obj')); out.mkdir(parents=True, exist_ok=True)
    ims[0].save(out / f'{key}_{seed}.png'); print(key, seed, ims[0].size, e['credits'])


if __name__ == '__main__':
    for arg in sys.argv[1:]:
        k, _, sd = arg.partition(':'); make(k, int(sd or 3))
