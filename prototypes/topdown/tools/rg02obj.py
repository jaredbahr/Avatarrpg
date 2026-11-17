"""RG-02 (Saltstep and Emberwatch): the region's objects, made as the quarry's were (`t13obj.py`):
create-object-pro-flash, view low top-down, the oven as the ONE angle reference in every prompt, the size stated in px
against a person (44 px tall). A canvas is at least 48 px wide: the style image (the oven, 42 x 47) must fit it. Raw results -> rg02/obj/<key>_<seed>.png. Every job is booked in ledger.json by pl.run
under `rg02_obj_`, tagged `saltstep_emberwatch`, and counts toward RG-02's cap (`rg02chars.CAP`).
Usage (from prototypes/topdown): python3 tools/rg02obj.py <key>[:seed] ..."""
import os, sys, json
sys.path.insert(0, 'tools'); import pl
from rg02chars import cap
from PIL import Image

os.environ.setdefault('PIXELLAB_REGION', 'saltstep_emberwatch')
S = json.load(open('style.json'))
ref = Image.open('assets/objects8/oven.png').convert('RGBA')
REF = {'image': pl.b64(ref), 'size': {'width': ref.width, 'height': ref.height},
       'usage_description': ("the camera and style reference: a front-on low top-down view. The object's front face is square to the camera and parallel to "
                             "the bottom of the picture, its top is seen as a shallow slanted band above the front face, never seen from a corner, never from straight above. "
                             "Match its pixel size, one-pixel outline in a darker tone of the material, flat shading with light from the upper left, and palette.")}
# key: (description, w, h, canvas w, canvas h)
# Saltstep's and Emberwatch's pieces (the art list in `docs/pipeline-trial-log.md`).
IT = {
    'stall_broth': ('a small floating market food stall on a square wooden platform: a striped faded red and cream cloth awning on four poles over a counter with a big iron broth pot and stacked earthenware bowls', 56, 56, 64, 64),
    'stall_fish': ('a small market stall on a square wooden platform: a faded blue cloth awning on four poles over a counter of baskets of silver fish on ice and a hanging scale', 56, 56, 64, 64),
    'level_pole': ('a tall thin wooden tide level pole standing upright, painted in bright alternating red and white bands with black tick marks, a small flag at the top', 14, 72, 48, 80),
    'customs_stall': ('a small floating customs stall on a square wooden raft: a little counter desk with a stool, a brass seal on a chain on the desk, a pile of papers, and a tall pole with a plain green flag', 52, 64, 64, 72),
    'ferry': ('a flat wooden harbour ferry boat with a low rail, a short mast with a furled sail, coils of rope, a bell on a post at the bow, seen from the side, the bow pointing right', 104, 48, 112, 64),
    'warehouse': ('a long harbour warehouse: weathered dark timber walls on a stone foundation, a wide pair of closed cargo doors in the middle, a grey slate roof, a loading beam with a pulley over the doors; straight front view, horizontal base, no side wall; front facade, thick eaves, recessed windows with sills, stone foundation; it fills the canvas, no empty margin', 152, 104, 160, 112),
    'jin_office': ('a neat small freight office front: clean pale plaster walls, a dark green tiled roof, a half-lowered wooden shutter over the counter window, a polished brass plate beside the door, a lantern by the door; straight front view, horizontal base, no side wall; front facade, thick eaves, recessed windows with sills, stone foundation; it fills the canvas, no empty margin', 112, 96, 120, 104),
    'lantern_crates': ('a stack of four small wooden lantern crates, each stamped with a simple dark lantern shape, rope handles, one crate open with paper lanterns inside', 40, 36, 48, 48),
    'pump_crate': ('a big wooden crate open on one side holding a cast-iron hand pump with a long handle, packed in straw', 40, 40, 48, 48),
    'teapot': ('a small mended clay teapot with a neat silver solder line round the spout, sitting on a little folded cloth', 14, 12, 48, 48),
    'handcart': ('a small flat two-wheeled wooden handcart with two long handles, empty', 44, 28, 48, 48),
    'winch': ('a heavy iron dockside winch: a big drum wound with thick rope on an iron frame, two crank handles and a brake lever with a red-painted handle', 44, 40, 48, 48),
    'crane_sling': ('a wooden dockside crane: a tall timber post with a long jib arm, a rope running over a pulley down to a rope sling holding a large wooden crate, one strap frayed', 64, 104, 80, 112),
    'barge': ('a long flat low cargo barge of dark tarred planks with a few lashed crates on its deck and a long steering oar at the back, seen from the side', 120, 40, 128, 48),
    'bollard': ('a short thick iron mooring bollard with a loop of rope round it', 16, 18, 48, 48),
    'dock_lamp': ('a tall iron harbour lamp post with a glass lantern at the top, unlit', 16, 64, 48, 72),
    'bean_canvas': ('an old tent canvas spread flat on the ground covered in drying red and brown beans, its corners weighted with stones, lying completely flat', 72, 36, 80, 48),
    'spear_trellis': ('an old wooden spear rack used as a garden trellis: an upright rack of empty wooden slots with green bean vines climbing all over it, with small red bean pods', 56, 56, 64, 64),
    'barracks': ('an old outpost barracks building: long weathered red-ochre plaster walls with patches painted over in cream, a dark tiled roof, a row of small barred windows, a plain wooden door; straight front view, horizontal base, no side wall; front facade, thick eaves, recessed windows with sills, stone foundation; it fills the canvas, no empty margin', 152, 96, 160, 104),
    'jetty': ('a short wooden jetty of grey planks on round posts with a mooring post at the end, seen front-on', 64, 40, 72, 48),
    'line_pole': ('a tall wooden power line pole with a cross arm and two white ceramic insulators, a black cable running off to the right', 36, 92, 48, 104),
    'cistern': ('a big round stone rain cistern with an iron rim and a wooden lid half slid off, water brimming over its edge', 52, 48, 64, 64),
    'copper_spur': ('a dead length of copper cable hanging slack between two short leaning wooden poles, a coil of copper on the ground beneath', 64, 56, 72, 64),
    'workshop_bench': ('a public workshop bench: a heavy wooden workbench with a vice, hand tools, a small brass regulator part and a coil of wire on it', 52, 36, 64, 48),
    'outpost_lamp': ('an old iron outpost lamp on a stone base, a big round glass lantern on top, unlit', 22, 56, 48, 64),
    # The parade ground's back wall (row 1, 22 cells) beside the barracks, and the power yard's fence (row 1 and
    # column 17): pieces repeated along the map's blocked cells, so each has plain ends that meet the next one.
    'parade_wall': ('a straight section of old outpost wall: weathered red-ochre plaster with a few cream painted patches, a low grey stone foundation, a dark tiled coping along the top; straight front view, horizontal base, plain cut ends left and right so sections join, no door, no window, no side wall; it fills the canvas, no empty margin', 120, 64, 120, 72),
    'yard_fence': ('a straight section of rough wooden yard fence: three horizontal weathered planks nailed to square posts at each end; straight front view, horizontal base; it fills the canvas width, no empty margin', 80, 36, 80, 48),
    'yard_fence_side': ('a straight section of the same rough wooden yard fence running straight away from the viewer: seen end-on, a narrow upright strip of square posts one behind the other with the plank ends between them', 16, 56, 48, 64),
    # Dressing for the market's quay and the parade ground (owner, 2026-11-15): small scatter on blocked cells.
    'net_pile': ('a heap of brown fishing net piled on the ground with a few cork floats and a coil of its rope', 36, 22, 48, 48),
    'fish_baskets': ('two round woven wicker baskets side by side, one holding silver fish, one empty', 36, 24, 48, 48),
    'rope_coil': ('a big neat coil of thick hemp rope lying flat on the ground beside a small wooden barrel', 32, 26, 48, 48),
    'training_dummy': ('a wooden training dummy: a straw-stuffed sacking body tied to an upright post with a cross-bar for arms, standing on a small wooden base', 24, 44, 48, 56),
    'water_trough': ('a long low wooden water trough on short legs, full of water, an iron band round each end', 60, 24, 64, 48),
    'weapon_rack': ('an upright wooden rack of wooden practice staffs and blunt wooden training spears leaning in a row', 40, 44, 48, 56),
    # The density pass (owner, 2026-11-17: "think about the density in Ba Dan"): the market, a noisy fish quay.
    'lighthouse': ('a small old harbour lighthouse: a round tapering white-washed stone tower with a red band, a black iron lantern room with glass on top, a small wooden door at its foot, on a rough stone base; straight front view; it fills the canvas height', 52, 124, 64, 128),
    'house_fisher': ('a small fisherman\'s cottage: weathered pale blue plank walls on a stone footing, a dark red tiled roof, one shuttered window, a low wooden door, a net hung on the wall; straight front view, horizontal base; it fills the canvas, no empty margin', 100, 84, 104, 88),
    'house_harbour': ('a two-storey harbour house: ochre plaster walls with dark timber beams, a dark grey tiled roof with a small chimney, two upper windows with green shutters, a shop door below with a little sign; straight front view, horizontal base; it fills the canvas, no empty margin', 116, 100, 120, 104),
    'house_narrow': ('a tall narrow townhouse: white-washed walls, a steep teal tiled roof, a small balcony with a washing line of laundry, a blue door; straight front view, horizontal base; it fills the canvas, no empty margin', 72, 96, 80, 104),
    'drying_rack': ('a wooden fish drying rack: two upright posts and three cross poles hung with rows of split silver fish drying in the sun', 44, 44, 48, 48),
    'crate_stack': ('a tall stack of four wooden fish crates, the lower ones stamped with a fish mark, a coil of rope on top', 36, 54, 48, 56),
    'barrels': ('three wooden barrels with iron hoops standing together, one with its lid off showing salt', 40, 34, 48, 48),
    'rowboat': ('a small wooden rowing boat floating on water seen from above at a low angle, two oars resting inside, painted blue with a white stripe', 60, 28, 64, 48),
    'sailboat': ('a small wooden fishing sailboat floating on water, a single mast with a furled cream sail, nets piled in the stern, red hull; side view', 84, 68, 88, 72),
    'shore_rocks': ('a low cluster of wet dark grey shoreline rocks with a little green weed, poking out of water', 46, 26, 48, 48),
    'fish_table': ('a sturdy wooden fish gutting table with a wooden board, a knife, a bucket under it and a few fish on top', 46, 38, 48, 48),
    'lobster_pots': ('a stack of three round wicker lobster pots with rope handles', 34, 30, 48, 48),
    'bunting_poles': ('two tall thin wooden poles with a string of colourful triangular cloth bunting flags hung between them, red yellow blue and green', 84, 56, 88, 64),
    'awning_shed': ('an open market fish shed: a striped red and white cloth awning on four wooden poles over a long counter of fish laid on ice and baskets; straight front view', 84, 60, 88, 64),
    'gulls': ('two white and grey seagulls floating on calm water, seen from above at a low angle', 30, 18, 48, 48),
    # The pontoon, a working freight dock.
    'dock_crane': ('a tall wooden dockside crane: a heavy square timber tower braced with iron, a long jib arm with a big iron pulley wheel and a hook on a chain hanging down; straight front view; it fills the canvas height', 60, 116, 64, 120),
    'cargo_stack': ('a big stack of wooden cargo crates under a brown canvas tarpaulin tied down with ropes', 54, 50, 56, 56),
    'chain_pile': ('a heavy iron anchor chain lying in a loose heap on wooden planks, seen from a low top-down angle', 40, 22, 48, 48),
    'pilings': ('three old weathered wooden mooring piles sticking up out of calm water, tied together with rope at the top', 30, 38, 48, 48),
    # the first take (seed 3) came back end-on and small: say it lies broadside, three times as long as it is tall
    'big_barge': ('a long low wooden cargo barge lying broadside on calm water, seen from the side: the hull runs the whole width of the picture from left to right, three times as long as it is tall, dark tarred planks, a deck stacked with crates and sacks under a tarp, a small wheelhouse at the right end', 168, 60, 176, 80),
    'gangway': ('a narrow wooden gangway plank with rope hand-lines on both sides, lying flat across from left to right, seen from above at a low angle', 64, 20, 64, 48),
    'rope_line': ('a long thick hemp rope strung between two short wooden posts over calm water, sagging in the middle', 92, 24, 96, 48),
    'oil_drums': ('two dark iron oil drums standing together, one with a dent and a rusty band', 34, 34, 48, 48),
    'pulley_gantry': ('a wooden dock gantry: two tall posts with a cross beam, two iron block-and-tackle pulleys hanging from it with ropes and a cargo net of sacks', 70, 92, 72, 96),
    'buoy': ('a small red and white wooden harbour buoy bobbing on calm water with a short rope', 20, 24, 48, 48),
    'tool_crates': ('two stacked plain wooden supply crates with rope handles and a small sack beside them', 36, 32, 48, 48),
    # Bo-shan's delivery cart (Act I's ending; the story bible: Parcel is an ostrich horse), seen from the side so
    # the bird and the cart both read.
    'parcel_cart': ('a two-wheeled wooden delivery cart with a canvas-covered load of sacks and crates and a driver\'s '
                    'bench, harnessed between its two long shafts on the left a tall ostrich horse: a big flightless '
                    'bird with a long neck, a horse-like head with a short mane, tan and cream feathers, two strong '
                    'long legs, a leather harness and a brass bell on its collar, standing calmly. The whole cart and '
                    'bird seen from the side, the bird facing left', 88, 64, 112, 96),
}


def make(key, seed):
    d, w, h, W, H = IT[key]
    desc = (f"{d}, seen front-on from a low top-down camera: the front face square to the viewer, the top a shallow band above it, not turned to a corner. "
            f"About {w} px wide and {h} px tall (a person is 44 px tall), standing at the bottom centre of an empty transparent canvas. "
            "No ground, no shadow, no background. " + S['style_suffix'])
    body = {'description': desc, 'view': 'low top-down', 'n_directions': 1, 'image_size': {'width': W, 'height': H}, 'style_image': REF,
            'target_palette': {'colors': S['palette'], 'name': 'village'}, 'seed': seed}
    cap(8)
    e, r = pl.run('/create-object-pro-flash', body, f'rg02_obj_{key}_{seed}', estimate=8)
    fin = r['final']; lr = fin.get('last_response') or fin; ims = [pl.fetch(u) for u in (lr.get('storage_urls') or {}).values()]
    if not ims: print(key, 'no image', list(lr.keys())[:10]); return
    out = pl.HERE / 'rg02' / 'obj'; out.mkdir(parents=True, exist_ok=True)
    ims[0].save(out / f'{key}_{seed}.png'); print(key, seed, ims[0].size, e['credits'])


if __name__ == '__main__':
    for arg in sys.argv[1:]:
        k, _, sd = arg.partition(':'); make(k, int(sd or 3))
