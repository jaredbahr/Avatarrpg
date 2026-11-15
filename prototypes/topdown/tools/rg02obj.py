"""RG-02 (Saltstep and Emberwatch): the region's objects, made as the quarry's were (`t13obj.py`):
create-object-pro-flash, view low top-down, the oven as the ONE angle reference in every prompt, the size stated in px
against a person (44 px tall). Raw results -> rg02/obj/<key>_<seed>.png. Every job is booked in ledger.json by pl.run
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
IT = {
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
