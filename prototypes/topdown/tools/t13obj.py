"""Tutorial pass: the quarry's objects and the Driller. create-object-pro-flash, view low top-down, the oven as the ONE angle
reference in every prompt, the size stated in px against Kaya (44 px tall). Raw results -> t13/obj/<key>_<seed>.png.
Usage: python3 tools/t13obj.py <key>[:seed] ..."""
import sys, json; sys.path.insert(0, 'tools'); import pl
from PIL import Image
S = json.load(open('style.json'))
ref = Image.open('assets/objects8/oven.png').convert('RGBA')
REF = {'image': pl.b64(ref), 'size': {'width': ref.width, 'height': ref.height},
       'usage_description': ("the camera and style reference: a front-on low top-down view. The object's front face is square to the camera and parallel to "
                             "the bottom of the picture, its top is seen as a shallow slanted band above the front face, never seen from a corner, never from straight above. "
                             "Match its pixel size, one-pixel outline in a darker tone of the material, flat shading with light from the upper left, and palette.")}
# key: (description, w, h, canvas w, canvas h)
IT = {
 'gatehouse': ('a quarry gatehouse: a pair of heavy closed timber gates with iron straps between two squat square towers of pale cream cut limestone blocks, a plank walkway with a low rail across the top of the gate', 120, 92, 128, 112),
 'qwall': ('a straight section of quarry curtain wall built of rough pale cream limestone blocks with dark joints, a few blocks chipped, a plank walkway rail along its top', 64, 52, 72, 64),
 'qwall_b': ('a straight section of quarry curtain wall of rough pale cream limestone blocks with dark joints and one heavy square buttress in the middle, a plank rail along its top', 64, 56, 72, 64),
 'brazier': ('an iron fire brazier: a shallow iron bowl of glowing coals and small flames on three thin legs', 22, 30, 48, 48),
 'oil_barrels': ('three small dark wooden barrels of lamp oil standing together, iron hoops, black oil stains running down their sides', 36, 34, 48, 48),
 'cabbage_cart': ('a small two-wheeled wooden handcart piled high with green cabbages heaped above the seat and turnips underneath, two long handles at the back', 56, 44, 64, 64),
 'scaffold': ('a rickety timber scaffold of lashed wooden poles with two plank platforms and a short ladder, rope lashings at the joints', 48, 64, 64, 72),
 'rails': ('a short straight section of mine-cart rail track lying flat on the ground and running from left to right: two thin iron rails on dark wooden sleepers', 64, 18, 72, 48),
 'minecart': ('a small iron mine cart on four little wheels, its tub heaped with chunks of pale limestone', 38, 32, 48, 48),
 'stone_blocks': ('a stack of three cut rectangular blocks of pale cream limestone with chisel marks, the top one smaller', 40, 30, 48, 48),
 'drill_junk': ('a small heap of worn steel drill bits, a coil of split black hose and a dented oil can lying on the ground', 40, 22, 48, 48),
 'headframe': ('a tall timber headframe over a mine drill shaft: two heavy wooden legs braced in an A-frame, a big iron pulley wheel at the top and a chain hanging down', 64, 100, 80, 112),
 'gallery_door': ('a mine gallery entrance in a pale limestone rock face: a dark square opening framed with timber, barred shut by heavy crossed planks nailed across it', 48, 46, 56, 56),
 'tool_rack': ('a wooden rack with pickaxes, sledgehammers and shovels leaning against it', 32, 36, 48, 48),
 'lime_rubble': ('a low heap of broken pale cream limestone chunks and grit', 36, 20, 48, 48),
 'lime_boulder': ('a big rough pale cream limestone boulder with a few dark cracks', 40, 32, 48, 48),
 'lean_to': ('a small lean-to shelter of the quarry crew: stained cream canvas stretched on two wooden poles over a bedroll and a cooking pot', 56, 44, 64, 64),
 'dead_shrub': ('a small dead dry shrub of grey-brown bare twisted twigs with a few dry tan leaves, growing from a crack in pale rock', 26, 22, 48, 48),
 'scree': ('a small low scatter of loose grey and pale limestone stones and pebbles lying together, no grass', 30, 12, 48, 48),
 'driller_big': ('a large mecha-driller boss machine, as big as a small cart, facing the viewer: a boxy rust-orange riveted iron body on two broad dark caterpillar treads, a small open driver cabin on top with a stout scowling bald man in a dusty vest gripping two levers, '
             'a thick riveted arm at the front ending in a big steel spiral drill bit pointing to the left, a short smoking exhaust pipe at the back, oil stains, a split black hose; it is a big heavy machine, more than twice as tall as a person', 112, 100, 128, 128),
}
for arg in sys.argv[1:]:
    k, _, sd = arg.partition(':'); seed = int(sd or 3); d, w, h, W, H = IT[k]
    desc = (f"{d}, seen front-on from a low top-down camera: the front face square to the viewer, the top a shallow band above it, not turned to a corner. "
            f"About {w} px wide and {h} px tall (a person is 44 px tall), standing at the bottom centre of an empty transparent canvas. "
            "No ground, no shadow, no background. " + S['style_suffix'])
    body = {'description': desc, 'view': 'low top-down', 'n_directions': 1, 'image_size': {'width': W, 'height': H}, 'style_image': REF,
            'target_palette': {'colors': S['palette'], 'name': 'village'}, 'seed': seed}
    e, r = pl.run('/create-object-pro-flash', body, f't13_obj_{k}_{seed}', estimate=8)
    fin = r['final']; lr = fin.get('last_response') or fin; ims = [pl.fetch(u) for u in (lr.get('storage_urls') or {}).values()]
    if not ims: print(k, 'no image', list(lr.keys())[:10]); continue
    (pl.HERE / 't13' / 'obj').mkdir(parents=True, exist_ok=True); ims[0].save(pl.HERE / 't13' / 'obj' / f'{k}_{seed}.png'); print(k, seed, ims[0].size, e['credits'])
