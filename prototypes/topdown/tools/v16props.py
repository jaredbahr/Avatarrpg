"""v16 props: the two Ba Dan village props that read European (the gabled stone shrine, the wrought-iron street lamp, the timber-gabled well), redrawn Earth Kingdom.
Same method as v16gen.py (the old piece is the ONE size/angle reference). Raw -> v16/raw/<key>_<seed>.png. Shares v16gen's 100-credit cap.
Usage (from prototypes/topdown): python3 tools/v16props.py key[:seed] ..."""
import os, sys, json; sys.path.insert(0, 'tools'); import pl
from PIL import Image
CAP = 100.0
S = json.load(open('style.json'))
NOT = "It is an Earth Kingdom village piece as in the Avatar animated style, and it is not European: no gable, no wrought iron, no gothic arch, no Tudor or medieval look. "
IT = {
 'shrine': ("a small Earth Kingdom wayside shrine: a little stone niche on a stepped stone base with a sage green glazed-tile roof with gently upturned eave corners, "
            "a bowl of offerings and two tiny paper lanterns in front, a small green cloth hanging in the niche", 46, 72, 64, 80),
 'well': ("a round Earth Kingdom village well: a low round wall of fitted grey stone, two dark reddish-brown wooden posts holding a small sage green glazed-tile roof with gently upturned eave corners, a wooden bucket on a rope, a plain wooden crank", 40, 58, 64, 72),
 'lamp': ("a tall Earth Kingdom village lamp post: a slim dark reddish-brown wooden post on a small stone footing with a crossbar from which hangs a round cream paper lantern in a wooden frame, "
          "a tiny green-tiled cap above the lantern", 37, 80, 48, 96),
}
def used(): return sum(j.get('credits') or 0 for j in pl.ledger()['jobs'] if j['name'].startswith('v16_'))
for arg in sys.argv[1:]:
    k, _, sd = arg.partition(':'); seed = int(sd or 3); d, w, h, W, H = IT[k]
    os.makedirs('v16', exist_ok=True)
    if not os.path.exists(f'v16/old_{k}.png'): Image.open(f'assets/objects12/{k}.png').convert('RGBA').save(f'v16/old_{k}.png')
    ref = Image.open(f'v16/old_{k}.png')
    REF = {'image': pl.b64(ref), 'size': {'width': ref.width, 'height': ref.height},
           'usage_description': ("the size and camera-angle reference only: the same overall size and the same low top-down camera height, front-on. Do NOT copy its materials, shapes or colours. "
                                 "Match its pixel size, one-pixel outline in a darker tone of the material, and flat shading.")}
    desc = (f"{d}. {NOT}Straight front view, horizontal base, light from the upper left. About {w} px wide and {h} px tall (a person is 44 px tall), standing at the bottom centre "
            "of an empty transparent canvas. It fills the canvas height. No ground, no shadow, no background. " + S['style_suffix'])
    body = {'description': desc, 'view': 'low top-down', 'n_directions': 1, 'image_size': {'width': W, 'height': H}, 'style_image': REF,
            'target_palette': {'colors': S['palette'], 'name': 'village'}, 'seed': seed}
    if used() + 10 > CAP: raise SystemExit(f'v16 cap: {used()} spent')
    e, r = pl.run('/create-object-pro-flash', body, f'v16_{k}_{seed}_{W}x{H}', estimate=10, region='ba_dan_ek_houses')
    fin = r['final']; lr = fin.get('last_response') or fin; ims = [pl.fetch(u) for u in (lr.get('storage_urls') or {}).values()]
    if not ims: print(k, 'no image'); continue
    os.makedirs('v16/raw', exist_ok=True); ims[0].save(f'v16/raw/{k}_{seed}_{W}x{H}.png'); print(k, seed, ims[0].size, e['credits'], 'v16 total', used())
