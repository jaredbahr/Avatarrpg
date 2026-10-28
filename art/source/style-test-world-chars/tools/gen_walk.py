"""Step 6: the walk cels. animate-with-skeleton-v3, first frame the restyled root on its 128 canvas with its estimated
skeleton, one designed skeleton per cel (design.py). Never PixelLab's own motion templates or a mocap take.

usage: python3 -I tools/gen_walk.py SEED char:dir [...]  -> raw/walk-<char>-<dir>-s<SEED>/NN.png"""
import json, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
import pl
HERE = Path(__file__).resolve().parent.parent
DESC = {
    'kaya': 'young woman with tan skin, dark brown hair in a high ponytail with a small red hair tie, fitted dark red jacket, red cloth waist sash, long dark red coat tails, dark baggy trousers, dark brown leather calf boots, dark forearm bracers',
    'sura': 'young woman, slim, deep brown skin, dark brown-black hair in one long thick braid, muted slate-blue knee-length wrap tunic with cream trim and cream fur elbow cuffs, wide brown belt, pale grey-blue front skirt panel, loose dark navy trousers, dark brown boots with cream fur tops; the tunic stays slate blue in every frame',
    'bo': 'young man, stocky with broad shoulders, tan skin, short thick tousled black hair, sleeveless olive-green knee-length tunic over an ochre-mustard shirt with sleeves rolled to the elbows, brown forearm wraps, wide brown sash with a hanging front flap, loose baggy cream trousers, brown cloth-wrapped boots',
    'gao': 'round olive-skinned merchant in his fifties, broad waist and sturdy short legs, short grey-flecked dark beard, brown soft flat cap, green tunic under a long cream apron, a string of dried red peppers at his right shoulder, two brown leather waterskins at his left hip, holding a small wooden abacus against his chest, charcoal trousers, brown cloth shoes',
}
STYLE = ', painterly pixel art with soft mottled tone clusters, warm light from the upper left, muted earth palette'
strip = lambda L: [dict(label=j['label'], x=j['x'], y=j['y'], z_index=j['z_index']) for j in L]


def one(spec, seed):
    char, d = spec.split(':')
    kp = json.load(open(HERE / f'design/{char}-{d}.json'))
    payload = dict(description=DESC[char] + STYLE, action='walk', direction=d, view='high top-down',
                   first_frame=pl.b64(Image.open(HERE / f'roots/{char}/{d}.png')), first_frame_keypoints=strip(kp['first_frame_keypoints']),
                   keypoints=[strip(f) for f in kp['frames']], template_id='mannequin', seed=seed, no_background=True)
    try:
        return pl.run('/animate-with-skeleton-v3', payload, f'walk-{char}-{d}-s{seed}',
                      inputs={'first_frame': f'roots/{char}/{d}.png (128 canvas)', 'keypoints': f'design/{char}-{d}.json (step {kp["step"]} H)'},
                      notes='designed six-pose walk')
    except Exception as e:
        print(spec, 'FAILED', e)


if __name__ == '__main__':
    seed = int(sys.argv[1])
    with ThreadPoolExecutor(8) as ex: list(ex.map(lambda s: one(s, seed), sys.argv[2:]))
