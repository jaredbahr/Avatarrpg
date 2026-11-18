"""Ba Dan art kit (stage 6, `docs/places/ba_dan_village.md` "Kit list (stage 5)"). create-object-pro-flash, view low top-down,
ONE angle/style reference per piece, the size in px in the prompt, the game palette as the target (ADR 0103); variants by
edit-image-pro-flash of a first take. Every job is booked in ledger.json by pl.run under `bd20_`, tagged `ba_dan_valley`, and
counted here against the stage's cap (CAP). Raw takes go to $BD20_RAW (outside the repo); `bd20proc.py` cleans them into
assets/objects_bd20/.
Usage (from prototypes/topdown):  python3 tools/bd20gen.py <key>[:seed] ...      (create)
                                  python3 tools/bd20gen.py edit <key>[:seed] ...  (edit of the source named in EDIT)"""
import os, sys, json
sys.path.insert(0, 'tools'); import pl
from PIL import Image

CAP = 180.0   # 162 (owner, 2026-11-18) + about 18 for three trees (owner, 2026-11-18)
RAW = os.environ.get('BD20_RAW', 'bd20/raw')
os.environ.setdefault('PIXELLAB_REGION', 'ba_dan_valley')
S = json.load(open('style.json'))
LOOK = ("An Earth Kingdom village object as in the Avatar animated style: green glazed upturned roof tiles on pale limestone walls and bases, warm weathered timber, "
        "packed earth. It is NOT European: no half-timbering, no chimney, no terracotta, no wrought iron, no cottage look. ")
BLD = ("Straight front view, horizontal base, the front facade square to the viewer, no side wall visible, the roof seen as a shallow sloping band above it, "
       "light from the upper left, one-pixel outline in a darker tone of each material. ")
ROOF = ("The roof is a sage green glazed-tile roof with thick eaves whose corners curve gently upward. ")
NOGROUND = "No ground, no shadow, no background, no steps, nothing around it. "
FILL = "It fills the canvas edge to edge with almost no empty margin. "
# key: (description, w, h, canvas w, canvas h, reference, kind)   reference: 'pella' | 'trough' | a key of an earlier take (its processed asset)
IT = {
 'mira_house': ("Mira's house, a wide welcoming two-storey Earth Kingdom village house: pale limestone ground floor with a big double wooden door in the centre, a warm timber upper floor with a lattice window "
                "each side and a small paper lantern, two tiers of green glazed roof with upturned eave corners. " + ROOF + BLD, 200, 108, 208, 112, 'pella', 'b'),
 'gao_shop': ("Gao's shop front, a one-storey Earth Kingdom village shop: pale limestone walls, a wide open wooden shop front with a plain counter shutter propped up, a lattice window to one side, "
              "a small plain door, one tier of green glazed roof with upturned eave corners. " + ROOF + BLD, 160, 76, 168, 80, 'pella', 'b'),
 'gao_store': ("a small plain one-storey storeroom: pale limestone walls, one small barred wooden window and a plain wooden door, no decoration, the same green glazed roof with upturned eave corners. " + ROOF + BLD, 80, 76, 128, 80, 'gao_shop', 'b'),
 'mason_house': ("the stonemason's house, a one-storey Earth Kingdom village house built entirely of fitted pale limestone blocks with a stone step at its plain wooden door and a stone windowsill under a lattice window, "
                 "one tier of green glazed roof with upturned eave corners. " + ROOF + BLD, 120, 72, 128, 80, 'pella', 'b'),
 'pella_house': ("Pella's house, a one-storey Earth Kingdom village house: pale limestone base, warm cream limewashed walls, one lattice window with a single wooden shutter hanging half open, a plain double door, "
                 "one tier of green glazed roof with upturned eave corners. " + ROOF + BLD, 160, 72, 168, 80, 'gao_shop', 'b'),
 'quarry_row': ("a plain quarry-company row house, all the same: a one-storey house of plain pale limestone blocks, a flat-faced plain wooden door in the centre, one small square window, "
                "one low tier of dull green glazed roof with only slightly upturned eaves, no ornament at all. " + ROOF + BLD, 120, 68, 128, 72, 'gao_shop', 'b'),
 'quarry_long': ("a long plain quarry-company row house, the same company style as its neighbours: a long one-storey house of plain pale limestone blocks, a plain wooden door at the right and two small square windows, "
                 "one of the windows has a wooden shutter hanging crooked and bent, one low tier of dull green glazed roof with only slightly upturned eaves, no ornament at all. " + ROOF + BLD, 160, 68, 168, 72, 'pella_house', 'b'),
 'awning': ("a patched market awning seen as a free-standing piece: a sagging cloth canopy of many patches, faded red, ochre and indigo, stitched together, stretched over four slim wooden poles at its four corners, "
            "the poles standing right at the front and back corners, the cloth seen from the front as a wide shallow slanted band above the poles. This is the one strong warm colour in the village. " + LOOK, 128, 96, 136, 104, 'stall', 'a'),
 'gate_post': ("a tall square pale limestone gate post with a hanging old bronze shift bell, the bell hung from a short weathered timber crossbeam on top of the post, a rope pull hanging down; a plain tall weathered post, no gate, no wall. " + LOOK, 40, 72, 48, 80, 'lamp', 'a'),
 'side_gate': ("a small garden side gate of weathered timber hung open on its pale limestone post, the single plank gate swung open to the right, showing a rope latch; low, about waist high to a person. " + LOOK, 40, 40, 48, 48, 'fence', 'a'),
 'guard_hut': ("a small guard hut: a little one-room Earth Kingdom watch house of pale limestone blocks with a plain wooden door and a small square window, one tier of green glazed roof with upturned eave corners. " + ROOF + BLD, 80, 63, 88, 72, 'pella', 'b'),
 'chair': ("a small repaired wooden chair with one leg mended with a lashed splint of pale wood and a patched cloth seat, plain weathered timber, seen front-on. " + LOOK, 24, 22, 48, 48, 'crate', 's'),
 'plant_chair': ("a small wooden chair holding a potted green leafy plant in a plain clay pot on its seat, plain weathered timber, seen front-on. " + LOOK, 24, 36, 48, 48, 'barrel', 's'),
 'stool': ("a small round three-legged wooden stool, plain weathered timber, seen front-on. " + LOOK, 14, 18, 48, 48, 'crate', 's'),
 'bucket': ("a small wooden bucket with two iron-free rope-bound hoops and a rope handle, plain weathered timber, empty. " + LOOK, 16, 18, 48, 48, 'crate', 's'),
 'basket': ("a small round woven bamboo basket with a rope handle, empty, plain. " + LOOK, 16, 18, 48, 48, 'crate', 's'),
 'washboard': ("a small wooden washboard with ridged slats in a plain timber frame, leaning upright on its end. " + LOOK, 16, 18, 48, 48, 'crate', 's'),
 'mason_bench': ("a mason's low work bench: a thick plain timber slab on two stout legs with a mallet and a chisel lying on it and a small half-carved pale limestone block. " + LOOK, 32, 27, 48, 48, 'planter', 's'),
 'wall_low': ("a straight section of low village boundary wall, one stone cell long: fitted pale cream limestone blocks with dark joints, a flat pale cap stone course along the top, a little moss at the foot, plain cut ends left and right so sections join end to end, "
              "no earth, no mound, no rubble heap, no grass tuft on top. " + LOOK, 40, 32, 48, 48, 'earth_wall', 'a'),
 'tree_pine': ("an upland pine tree of the Earth Kingdom hills: a slim dark green conifer with layered drooping boughs and a short warm brown trunk, natural and calm, seen from the front in low top-down. "
               "Not a European oak, no autumn colours. " + LOOK, 48, 86, 64, 96, 'tree', 'a'),
 'tree_broadleaf': ("a small summer-green broadleaf tree of an upland village: a rounded crown of mid green leaves in a few soft clumps, a short slim brown trunk, natural and calm, seen from the front in low top-down. "
                    "Summer green only, not autumn red, not a big oak. " + LOOK, 60, 81, 72, 88, 'tree', 'a'),
 'bamboo': ("a clump of green bamboo, a few slender jointed culms of different heights with narrow leaf sprays at the top, rooted in one tuft at the base, seen from the front in low top-down. " + LOOK, 40, 68, 48, 76, 'tree', 'a'),

 'peg': ("a short carved pale limestone boundary peg, a squat rounded stone post with a simple notched ring carved round its head. " + LOOK, 12, 14, 48, 48, 'crate', 's'),
}
# Retakes (a corrected prompt, the key and seed they replace): the first takes came back narrower or wider than asked, because the
# reference's aspect and the canvas set the drawn size (art-lessons: "canvas size doesn't set the drawn size").
RETAKE = {
 ('mira_house', 4): ("Mira's house, the most important house in the village: a very wide, low-spread two-storey Earth Kingdom house, wider than it is tall (about 200 px wide and 108 px tall, a wide five-bay facade), "
                     "pale cream limestone walls on BOTH floors (the upper floor is pale limestone too, not brown timber), a big double wooden door in the centre, a lattice window each side upstairs and one each side of the door, "
                     "a small paper lantern, two tiers of green glazed roof with upturned eave corners that spread wide past the walls. No banner, no sign. " + ROOF + BLD, 200, 108, 208, 112, 'gao_shop', 'b'),
 ('gao_store', 4): ("a small plain one-storey storeroom, a squat nearly square little building only 80 px wide: pale limestone walls, one small barred wooden window and a plain wooden door, no decoration, "
                    "the same green glazed roof with upturned eave corners. " + ROOF + BLD, 80, 76, 88, 80, 'gao_shop', 'b'),
 ('mason_house', 4): ("the stonemason's house, a wide low one-storey Earth Kingdom village house, wider than it is tall (about 120 px wide and 72 px tall), built of fitted pale limestone blocks with visible block joints, "
                      "a wide plain wooden door with one broad stone step in front of it, a lattice window beside it with a thick stone windowsill, one tier of green glazed roof with upturned eave corners. " + ROOF + BLD, 120, 72, 128, 80, 'pella_house', 'b'),
}
RETAKE[('gao_store', 5)] = (IT['gao_store'][0], 80, 76, 88, 80, 'pella', 'b')   # the reference's own drawn size sets the result: pella scaled to fit 84 x 76 is about 84 x 75
RETAKE[('awning', 4)] = ("a free-standing patched awning ONLY: four slim bare wooden posts, one at each corner, and a sagging patched cloth stretched across their tops, patches of faded red, ochre and indigo stitched together. "
    "The space under the cloth is completely empty and open: no counter, no table, no crates, no goods, no stall, no benches; just four thin posts standing on the ground and the cloth above, seen from the front, the cloth a wide shallow slanted band. "
    "It is wide: about 128 px wide and 96 px tall, the posts about 80 px tall. " + LOOK, 128, 96, 136, 104, 'stall_top', 'a')
RETAKE_EDIT = {('wall_mended', 4): ('wall_low', "Change only the middle of the wall: three of its blocks are replaced by visibly newer, whiter, neater blocks, with a bright line of fresh pale mortar round them, so a repair is easy to spot. "
    "Keep the same wall shape, the same outline, the same colours elsewhere.", None)}
# edits: key -> (source key, prompt, canvas w, canvas h)
EDIT = {
 'quarry_amri': ('quarry_row', "Change only the door colour: the front door is painted a bright cornflower blue instead of plain timber. Keep everything else exactly the same: the same walls, window, roof, outline and colours.", None),
 'hanru_house': ('quarry_row', "This house was squeezed narrower and is blurry. Redraw it as crisp pixel art at this size, the same house with the same roof, walls, door and colours, but its one window is now covered by a closed wooden shutter. Keep the same style.", (80, 60)),
 'senn_annex': ('quarry_long', "This building was squeezed narrow and is blurry. Redraw it as crisp pixel art at this size: a narrow square annex wing of a plain house, the same pale limestone walls, the same dull green roof, a plain closed wooden door, no window. Keep the same style.", (44, 60)),
 'wall_mended': ('earth_wall', "Show the same low stone wall section but one block course in the middle has been repaired with a few newer, paler, neater blocks and a patch of fresh mortar; keep the same outline, same shape and same colours.", None),
}
SRC_PATH = {'earth_wall': '../../public/art/topdown/props/earth_wall.png'}


def ref_image(name, canvas):
    if name == 'stall_top':   # the old stall's cloth and posts only, its counter cut off and widened, so nothing is left to copy under the cloth
        st = Image.open('assets/objects12/stall.png').convert('RGBA').crop((0, 0, 77, 46))
        return st.resize((round(77 * 1.5), round(46 * 1.5)), Image.LANCZOS)
    p = {'pella': 'assets/objects_bd13/house_pella.png', 'trough': 'assets/objects12/trough.png', 'crate': 'assets/objects12/crate.png', 'barrel': 'assets/objects12/barrel.png',
         'planter': 'assets/objects12/planter.png', 'lamp': 'assets/objects_t3/lamp.png', 'fence': 'assets/objects12/fence.png', 'stall': 'assets/objects12/stall.png', 'earth_wall': '../../public/art/topdown/props/earth_wall.png', 'tree': 'assets/objects12/tree.png'}.get(name) or f'assets/objects_bd20/{name}.png'
    im = Image.open(p).convert('RGBA')
    mw, mh = canvas[0] - 4, canvas[1] - 4
    if im.width > mw or im.height > mh:
        f = min(mw / im.width, mh / im.height); im = im.resize((max(1, round(im.width * f)), max(1, round(im.height * f))), Image.LANCZOS)
    return im


def used():
    return sum(j.get('credits') or 0 for j in pl.ledger()['jobs'] if j['name'].startswith('bd20_'))


def fetch_one(r):
    fin = r['final']; lr = fin.get('last_response') or fin
    ims = [pl.fetch(u) for u in (lr.get('storage_urls') or {}).values()]
    if not ims:
        ims = []; pl.images(lr, ims)
        if not ims and lr.get('image_url'): ims = [pl.fetch(lr['image_url'])]
    return ims


def make(key, seed):
    d, w, h, W, H, ref, kind = RETAKE.get((key, seed)) or IT[key]
    im = ref_image(ref, (W, H))
    use = {'b': "the camera, size and style reference: the same low top-down front-on camera, the same flat shading, the same crisp one-pixel outline and the same glazed green roof, but NOT its size or its exact design. ",
           'a': "the camera and style reference: a front-on low top-down view, front face square to the viewer, its top a shallow slanted band. ",
           's': "the camera and style reference: a front-on low top-down view, front face square to the viewer, its top a shallow slanted band. "}[kind]
    REF = {'image': pl.b64(im), 'size': {'width': im.width, 'height': im.height},
           'usage_description': use + "Match its pixel density, one-pixel outline in a darker tone of the material, flat shading with light from the upper left, and palette. Do not copy its colours or design."}
    scale = {'b': "(a person is only 45 px tall, so the door is about 38 px tall)", 'a': "(a person is 45 px tall)", 's': "(a person is 45 px tall; this is a small thing, well under half a person's height)"}[kind]
    desc = (f"{d}{FILL if kind == 'b' else ''}About {w} px wide and {h} px tall {scale}, standing at the bottom centre of an empty transparent canvas. {NOGROUND}" + S['style_suffix'])
    body = {'description': desc, 'view': 'low top-down', 'n_directions': 1, 'image_size': {'width': W, 'height': H}, 'style_image': REF,
            'target_palette': {'colors': S['palette'], 'name': 'village'}, 'seed': seed}
    if used() + 9 > CAP: raise SystemExit(f'bd20 cap: {used()} spent, 9 more would pass {CAP}')
    e, r = pl.run('/create-object-pro-flash', body, f'bd20_{key}_{seed}', estimate=9)
    ims = fetch_one(r)
    if not ims: print(key, 'no image'); return
    os.makedirs(RAW, exist_ok=True); ims[0].save(f'{RAW}/{key}_{seed}.png'); print(key, seed, ims[0].size, e['credits'], 'bd20 total', used())


def edit(key, seed):
    src, prompt, rs = RETAKE_EDIT.get((key, seed)) or EDIT[key]
    p = f'assets/objects_bd20/{src}.png' if os.path.exists(f'assets/objects_bd20/{src}.png') else SRC_PATH[src]
    im = Image.open(p).convert('RGBA')
    if rs: im = im.resize(rs, Image.LANCZOS)
    W = max(32, (im.width + 8 + 3) // 4 * 4); H = max(32, (im.height + 4 + 3) // 4 * 4)
    can = Image.new('RGBA', (W, H)); can.alpha_composite(im, ((W - im.width) // 2, H - im.height))
    D = (prompt + " One-pixel dark outlines, flat colours, light from the upper left, the same low top-down front view, no blur, no anti-aliasing. Nothing around it, no ground, no shadow.")
    if used() + 6 > CAP: raise SystemExit(f'bd20 cap: {used()} spent, 6 more would pass {CAP}')
    e, r = pl.run('/edit-image-pro-flash', {'image': pl.b64(can), 'method': 'text', 'description': D, 'no_background': True, 'seed': seed}, f'bd20_{key}_{seed}', estimate=6)
    ims = fetch_one(r)
    if not ims: print(key, 'no image'); return
    os.makedirs(RAW, exist_ok=True); ims[0].save(f'{RAW}/{key}_{seed}.png'); print(key, seed, ims[0].size, e['credits'], 'bd20 total', used())


if __name__ == '__main__':
    a = sys.argv[1:]
    fn = make
    if a and a[0] == 'edit': fn = edit; a = a[1:]
    if a and a[0] == 'balance': print(pl.balance()); sys.exit()
    for arg in a:
        k, _, sd = arg.partition(':'); fn(k, int(sd or 3))
