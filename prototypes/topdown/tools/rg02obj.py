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
    # Lore pass (owner, 2026-11-17: "follow the game's lore, so kingdom building styles"): Saltstep is an outer Earth
    # Kingdom harbour town (story bible: the Tidemark Reach), Korra era, drawn as in the animated style. The first
    # houses and lighthouse came out European; these replace them.
    'ek_cottage': ('a small Earth Kingdom fisher cottage as in the Avatar animated style: tan plaster and grey stone walls on a stone footing, a green glazed tile roof with gently upturned eave corners, a round lattice window, a plain wooden door, no chimney; straight front view, horizontal base; it fills the canvas, no empty margin', 92, 76, 96, 80),
    'ek_shophouse': ('a two-storey Earth Kingdom harbour shophouse as in the Avatar animated style: ochre plaster walls, dark wooden posts, two tiers of olive green glazed tile roofs with upturned eave corners, wooden lattice windows upstairs, an open shop front with a hanging green cloth sign below; no chimney, no half-timbering; straight front view, horizontal base; it fills the canvas, no empty margin', 104, 100, 112, 104),
    'ek_house_round': ('a narrow two-storey Earth Kingdom town house as in the Avatar animated style: cream plaster walls on a stone base, a circular moon doorway, a small round window, a green tile roof with upturned eaves, a bamboo pole with laundry hung from the upper window; no chimney; straight front view, horizontal base; it fills the canvas, no empty margin', 64, 92, 72, 96),
    'beacon_tower': ('an Earth Kingdom harbour beacon: a squat square tower of fitted grey stone blocks tapering upward, a small open pavilion on top with a green tile roof with upturned eaves sheltering a big round paper lantern, green and gold cloth banners hanging from the pavilion; straight front view; it fills the canvas height', 56, 120, 64, 128),
    'harbour_tree': ('a gnarled wind-bent coastal pine tree with a twisted trunk and flat layered dark green foliage', 60, 76, 64, 80),
    'stone_well': ('a round stone village well with a small green tiled roof on two wooden posts, a wooden bucket on a rope', 40, 50, 48, 56),
    'wayside_shrine': ('a small Earth Kingdom wayside shrine: a little stone niche with a green tiled roof, a bowl of offerings and two small lanterns in front of it', 34, 42, 48, 48),
    'laundry_line': ('a washing line of plain cloth laundry hung between two bamboo poles, tunics and sheets in green, cream and brown', 76, 46, 80, 48),
    'ek_warehouse': ('a long Earth Kingdom harbour warehouse as in the Avatar animated style: grey stone lower walls, dark timber upper walls, a wide green glazed tile roof with upturned eave corners, a pair of big closed wooden cargo doors with iron bands in the middle, small lattice vents; straight front view, horizontal base, no side wall; it fills the canvas, no empty margin', 152, 88, 160, 96),
    'banner_poles': ('two tall bamboo poles with long green and gold cloth banners hanging down, an Earth Kingdom market emblem on each banner', 60, 70, 64, 72),
    # Emberwatch (the Common Current bible): a Fire Nation outpost decommissioned nine years ago and reused by
    # civilians, with its old signal tower and lantern shrine. Fire Nation architecture as in the Avatar animated style, a decommissioned Fire Nation coastal outpost now used by civilians.
    'fn_signal_tower': ('an old Fire Nation signal tower as in the Avatar animated style, a decommissioned Fire Nation coastal outpost now used by civilians: a tall square tower of dark red plaster on a black stone base, black timber balconies, a top pavilion with a dark red tiled roof with sharp upswept eave tips and gold trim, a big brass signal lamp, a faded flame emblem; straight front view; it fills the canvas height', 60, 136, 64, 144),
    'fn_barracks': ('an old Fire Nation barracks hall as in the Avatar animated style, a decommissioned Fire Nation coastal outpost now used by civilians: long dark red plaster walls on black stone footings, black timber posts with gold-painted trim, a dark grey tiled roof with sharp upswept eave tips, barred windows, a plain wooden double door, slogans on the wall painted over in cream with planting dates; straight front view, horizontal base, no side wall; it fills the canvas, no empty margin', 152, 92, 160, 96),
    'fn_wall': ('a straight section of old Fire Nation outpost wall as in the Avatar animated style, a decommissioned Fire Nation coastal outpost now used by civilians: dark red plaster on a black stone base, a black tiled coping with small upswept tips, a faded gold flame emblem; straight front view, horizontal base, plain cut ends left and right so sections join; it fills the canvas, no empty margin', 116, 60, 120, 64),
    'fn_brazier': ('a Fire Nation iron brazier stand as in the Avatar animated style, a decommissioned Fire Nation coastal outpost now used by civilians: a wide black iron bowl on three curled legs with flame-shaped trim, glowing coals and small flames in it', 30, 42, 48, 48),
    'fn_banner': ('a tall black lacquered pole with a long faded red Fire Nation banner hanging from it, its flame emblem half painted over with cream planting dates', 30, 78, 48, 80),
    'fn_flag_mast': ('a very tall thin black flag mast with gold rings and a long red pennant flying out to the right at the top, on a small stone base', 30, 116, 48, 120),
    'sparring_ring': ('a round sparring ring seen from above at a low angle: a circle of packed red earth bordered by a ring of small flat stones, worn foot marks inside, lying flat on the ground', 100, 56, 104, 64),
    'rock_spur': ('a big jagged spur of dark grey and rust coloured headland rock with a few tufts of dry grass', 84, 62, 88, 64),
    'boulders': ('two weathered dark grey boulders with a little dry grass', 42, 30, 48, 48),
    'fn_lantern_shrine': ('a small Fire Nation lantern shrine as in the Avatar animated style, a decommissioned Fire Nation coastal outpost now used by civilians: a little stone plinth with a red tiled roof with upswept tips over a bronze lantern with a flame, a few paper offerings', 40, 54, 48, 56),
    'fn_tent': ('a Fire Nation army supply tent as in the Avatar animated style, a decommissioned Fire Nation coastal outpost now used by civilians: a faded red canvas tent on black poles with the flaps tied open, crates inside', 70, 52, 72, 56),
    'straw_target': ('a round straw practice target on a wooden easel stand, a few dents in it', 30, 42, 48, 48),
    'tool_crates': ('two stacked plain wooden supply crates with rope handles and a small sack beside them', 36, 32, 48, 48),
    # Bo-shan's delivery cart (Act I's ending; the story bible: Parcel is an ostrich horse), seen from the side so
    # the bird and the cart both read.
    'parcel_cart': ('a two-wheeled wooden delivery cart with a canvas-covered load of sacks and crates and a driver\'s '
                    'bench, harnessed between its two long shafts on the left a tall ostrich horse: a big flightless '
                    'bird with a long neck, a horse-like head with a short mane, tan and cream feathers, two strong '
                    'long legs, a leather harness and a brass bell on its collar, standing calmly. The whole cart and '
                    'bird seen from the side, the bird facing left', 88, 64, 112, 96),
    'generator_shed': ('an old Fire Nation generator shed as in the Avatar animated style, Korra-era Fire Nation engineering in a decommissioned Fire Nation coastal outpost now used by civilians: a squat brick-red plaster building on a black stone base, a dark red tiled roof with sharp upswept eave tips and gold trim, black timber posts, wide open double doors showing a big humming copper-wound generator with brass gauges inside, thick black cables running out under the doors, a small flame emblem over the door; straight front view, horizontal base, no side wall; it fills the canvas, no empty margin', 120, 96, 128, 104),
    'copper_coils': ('big copper coils as in the Avatar animated style, Korra-era Fire Nation engineering in a decommissioned Fire Nation coastal outpost now used by civilians: two large spools of bright copper wire on a black iron stand, a loose end of wire curling off', 40, 36, 48, 48),
    'transformer_drum': ('a transformer drum as in the Avatar animated style, Korra-era Fire Nation engineering in a decommissioned Fire Nation coastal outpost now used by civilians: a squat round dark green iron transformer tank on a stone plinth, three white porcelain insulators on top with a cable running off, a small red painted lightning bolt warning mark on its side', 34, 44, 48, 48),
    'warning_sign': ('a warning sign as in the Avatar animated style, Korra-era Fire Nation engineering in a decommissioned Fire Nation coastal outpost now used by civilians: a short black timber post with a square red wooden sign showing a bold yellow lightning bolt, a little gold trim at its corners', 22, 40, 48, 48),
    'cable_reel': ('a cable reel as in the Avatar animated style, Korra-era Fire Nation engineering in a decommissioned Fire Nation coastal outpost now used by civilians: a big wooden cable drum standing on its rim, wound with thick black cable, a few turns hanging loose', 36, 34, 48, 48),
    'cable_run': ('thick black power cables lying flat across bare ground in two loose curves, held down by a couple of small wooden pegs, lying completely flat', 80, 24, 88, 48),
    'insulator_crate': ('a crate of insulators as in the Avatar animated style, Korra-era Fire Nation engineering in a decommissioned Fire Nation coastal outpost now used by civilians: an open wooden crate packed in straw holding rows of white porcelain insulators, a red stencilled lightning mark on its side', 38, 32, 48, 48),
    'switch_panel': ('a switch panel as in the Avatar animated style, Korra-era Fire Nation engineering in a decommissioned Fire Nation coastal outpost now used by civilians: a black iron cabinet on short legs with its door open, big brass knife switches and two round gauges inside, a red painted flame mark on the door', 32, 44, 48, 48),
    # The market's second density pass (owner, 2026-11-17: fill the quay, Ba Dan's density): Earth Kingdom market pieces.
    'ek_stall_green': ('a small Earth Kingdom market stall as in the Avatar animated style, an outer Earth Kingdom harbour fish market (not European: no half-timbering, no chimney, no thatch, no red-and-white stripes): four bamboo poles holding a green glazed tile canopy with gently upturned corners and gold trim, a low stone-based counter heaped with silver fish on ice and woven baskets, a little hanging scale', 60, 56, 64, 64),
    'ek_stall_parasol': ('a small Earth Kingdom market stall as in the Avatar animated style, an outer Earth Kingdom harbour fish market (not European: no half-timbering, no chimney, no thatch, no red-and-white stripes): a big round oiled-paper parasol in jade green with a gold rim on a bamboo pole, shading a low wooden table of dried squid, shells and small clay pots, a stool beside it', 56, 56, 64, 64),
    'fish_crates': ('a low stack of three open wooden fish crates brimming with silver fish and chipped ice, a wooden scoop on top, as in the Avatar animated style, an outer Earth Kingdom harbour fish market (not European: no half-timbering, no chimney, no thatch, no red-and-white stripes)', 40, 32, 48, 48),
    'fish_hang': ('a bamboo A-frame hung with strings of dried salted fish and dried squid, as in the Avatar animated style, an outer Earth Kingdom harbour fish market (not European: no half-timbering, no chimney, no thatch, no red-and-white stripes)', 52, 52, 56, 56),
    'ek_cart': ('a two-wheeled Earth Kingdom merchant handcart as in the Avatar animated style, an outer Earth Kingdom harbour fish market (not European: no half-timbering, no chimney, no thatch, no red-and-white stripes): dark wood with a rounded green cloth canopy over bamboo hoops, loaded with sacks and fish crates, two long handles resting on the ground', 56, 44, 64, 48),
    'clay_jars': ('three big glazed brown clay storage jars with round wooden lids tied down with cord, one lid off showing salted fish, as in the Avatar animated style, an outer Earth Kingdom harbour fish market (not European: no half-timbering, no chimney, no thatch, no red-and-white stripes)', 40, 36, 48, 48),
    'basket_tower': ('a tall leaning stack of round woven bamboo baskets, a few holding silver fish and oysters, as in the Avatar animated style, an outer Earth Kingdom harbour fish market (not European: no half-timbering, no chimney, no thatch, no red-and-white stripes)', 32, 46, 48, 52),
    'lantern_post': ('a tall bamboo market lantern post as in the Avatar animated style, an outer Earth Kingdom harbour fish market (not European: no half-timbering, no chimney, no thatch, no red-and-white stripes): two round paper lanterns, one jade green and one gold, hanging from a curved bamboo arm, unlit', 24, 64, 48, 72),
    # SF-2.2's tipping platform (`docs/places/saltstep_platform.md`): the old stall's counter stub down the deck's seam,
    # three cells running straight away from the viewer, and the raised step along the north rim, laid in three sections.
    'counter_side': ('the stub of an old wooden market stall counter running straight away from the viewer, seen end-on from a low top-down camera: a long narrow counter of pale weathered planks on short square posts, so it shows as a tall narrow upright strip, the near end square to the viewer with two small empty iron bowl hooks on it; no roof, no awning, no goods. It is very tall and thin: it fills the whole canvas height, about 4 times as tall as it is wide', 28, 132, 48, 140),
    # the first take (seed 3) came back 80 px tall, too short for its three cells: seed 11 says it fills the height
    'deck_step': ('a low raised section of weathered wooden plank decking, one step up, on short square posts: a long low box seen front-on, its plank top a shallow band, its front a single plank-high face with the post ends showing, plain cut ends left and right so sections join; it fills the canvas width, no empty margin', 120, 48, 128, 56),
    'fish_mat': ('a woven reed mat lying completely flat on the ground, rows of silver fish and a few crabs laid out to sell on it, as in the Avatar animated style, an outer Earth Kingdom harbour fish market (not European: no half-timbering, no chimney, no thatch, no red-and-white stripes), seen from above at a low angle', 56, 28, 64, 48),
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
