"""Kaya polish, step 1 probe: a steeper body. Two levers on the south (and one diagonal) idle root, each ledgered:
- edit: edit-image-pro-flash (text) on #321's restyled root, told to raise the camera;
- create: create-image-pro-flash at 128x128 with #321's root as the style image, the view in words.

Seeds from 520 add ADULT (the 502/503 candidates came back with large heads).

usage (repo root): python3 -I art/source/party-world/tools/kp_probe.py edit|create SEED dir [dir ...] -> raw/kp-<lever>-<dir>-s<SEED>/"""
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import pl
HERE = Path(__file__).resolve().parent.parent
KAYA = ('young woman with tan skin, dark brown hair in a high ponytail with a small red hair tie, fitted dark red jacket with '
        'thin ochre-gold piping at the collar and front edge, red cloth waist sash tied at her left hip with the ends hanging, '
        'long dark red coat tails, dark baggy trousers, dark brown leather calf boots, dark forearm bracers')
VIEW = ('Seen from a high oblique camera looking down at about 40 degrees, the same camera as a 2:1 dimetric town map: the top '
        'of the head and the crown of the hair, the tops of the shoulders and the top of the ponytail are visible, the torso is '
        'foreshortened, the legs look shorter, and the feet are seen from above on the ground plane. ')
FACE = {'south': 'She faces the viewer (south, down the screen); her face stays visible under her fringe, eyes looking ahead, not down.',
        'south-east': 'She faces down and to the right (south-east); her face stays visible in three-quarter view.',
        'east': 'She faces right (east).', 'north-east': 'She faces away, up and to the right (north-east); her back is to the viewer.',
        'north': 'She faces directly away (north); only her back and the back of her head are visible.',
        'north-west': 'She faces away, up and to the left (north-west); her back is to the viewer.',
        'west': 'She faces left (west).', 'south-west': 'She faces down and to the left (south-west); her face stays visible in three-quarter view.'}
ADULT = ('She is an adult woman with adult proportions: a small head about one seventh of her height, a slim neck, '
         'long torso and long legs; not a chibi or child figure. ')
STYLE = ('Painterly pixel art with soft mottled tone clusters, warm light from the upper left, muted earth palette, '
         'soft dark edge, no hard black outline. A standing figure about 70 pixels tall, the soles on the same row as now, relaxed, arms at her sides.')


def one(lever, seed, d):
    src = f'roots/kaya/idle/{d}.png'
    img = pl.b64(HERE / src)
    if lever == 'edit':
        desc = ('Redraw this exact character, same costume, colours, size and facing, but ' + VIEW + FACE[d] + ' '
                + (ADULT if seed >= 520 else '') + STYLE + ' ' + KAYA)
        payload = dict(image=img, method='text', description=desc, no_background=True, seed=seed)
        ep = '/edit-image-pro-flash'
    else:
        desc = KAYA + '. ' + VIEW + FACE[d] + ' ' + STYLE
        payload = dict(description=desc, image_size={'width': 128, 'height': 128}, no_background=True, seed=seed,
                       style_image={'image': img, 'size': {'width': 128, 'height': 128},
                                    'usage_description': 'the same character: copy her costume, colours, proportions and painterly texture, not her camera'})
        ep = '/create-image-pro-flash'
    return pl.run(ep, payload, f'kp-{lever}-{d}-s{seed}', inputs={'image': src}, notes=f'Kaya polish: steeper-body probe ({lever}) {d}')


if __name__ == '__main__':
    lever, seed = sys.argv[1], int(sys.argv[2])
    with ThreadPoolExecutor(8) as ex: list(ex.map(lambda d: one(lever, seed, d), sys.argv[3:]))
