"""Step 9: the combat cels (hit, ko, bend). animate-with-skeleton-v3, first frame the restyled stance root on the clip's
canvas (remap.root_on), first-frame and per-frame skeletons from remap.py (party-g1's CMU retargets, mapped onto this
folder's roots). The description is party-g1's root description (Sura's bend east its clip description, as there) and
#317's style clause. Never PixelLab's own motion templates.

usage (repo root): python3 -I art/source/party-world/tools/gen_clip.py SEED char:clip:dir [...]
-> raw/<char>-<clip>-<dir>-s<SEED>/NN.png (one PNG a skeleton frame; the first frame itself is not returned)"""
import json, sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
import pl
from remap import root_on
HERE = Path(__file__).resolve().parent.parent
C = json.load(open(HERE.parent / 'party-g1/tools/chars.json'))
STYLE = ', painterly pixel art with soft mottled tone clusters, warm light from the upper left, muted earth palette'
strip = lambda L: [dict(label=j['label'], x=j['x'], y=j['y'], z_index=j['z_index']) for j in L]


def one(spec, seed):
    char, clip, d = spec.split(':')
    kp = json.load(open(HERE / f'design/{char}/{clip}-{d}.json'))
    desc = C[char].get('clip_description', C[char]['root_description']) if clip == 'bend' and d == 'east' else C[char]['root_description']
    payload = dict(description=desc + STYLE, action=kp['action'], direction=d, view='high top-down',
                   first_frame=pl.b64(root_on(char, d, kp['canvas'])), first_frame_keypoints=strip(kp['first_frame_keypoints']),
                   keypoints=[strip(f) for f in kp['frames']], template_id='mannequin', seed=seed, no_background=True)
    try:
        return pl.run('/animate-with-skeleton-v3', payload, f'{char}-{clip}-{d}-s{seed}',
                      inputs={'first_frame': f'roots/{char}/stance/{d}.png on a {kp["canvas"]} canvas',
                              'keypoints': f'design/{char}/{clip}-{d}.json ({kp["remapped_from"]})', 'motion': kp['attribution']},
                      notes=f'{clip} {d}')
    except Exception as e:
        print(spec, 'FAILED', e, flush=True)


if __name__ == '__main__':
    seed = int(sys.argv[1])
    with ThreadPoolExecutor(8) as ex: list(ex.map(lambda s: one(s, seed), sys.argv[2:]))
