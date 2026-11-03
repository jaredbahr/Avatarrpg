"""assemble.py : turns the accepted raw PixelLab frames (raw/) into the packer's source set (cels/).

Per take: hit = stance, H1, H2, H3, stance (the party's 5-frame structure); ko = stance, then the keypoint frames up to the
take's `final` frame (the last frame holds). The stance is the bruiser's own approved idle cel 0 for that facing (the cel the sheet
ships as `idle*/0`), so a take starts and ends on the identical pixels. Every generated frame is toned with the frozen
tone_p1.py (the frozen params-v3.json plus the bruiser's skin mask) exactly as his idle and walk were, the stance is
the already-toned idle cel (tone is idempotent, so it is copied, not re-toned).

usage: assemble.py ASSEMBLY.json   (see TAKES below; the choice of take per facing is recorded in assembly.json)
Writes cels/<clip>/NN.png, cels/<clip>/timing.json (attribution, ms, hitstop) and tone-manifest.json."""
import json, os, shutil, subprocess, sys
import numpy as np
from PIL import Image
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'cels'); RAW = os.path.join(HERE, 'raw'); TONE = os.path.join(HERE, 'tone', 'tone_p1.py')
TONED_IDLE = os.path.join(HERE, '..', 'bruiser-g', 'cels', 'idle', '{d}', '0.png')
HEADING = {'east': 'East', 'north-east': 'NorthEast', 'north': 'North', 'north-west': 'NorthWest', 'west': 'West',
           'south-west': 'SouthWest', 'south': 'South', 'south-east': 'SouthEast'}
CMU = ("The data used in this project was obtained from mocap.cs.cmu.edu. "
       "The database was created with funding from NSF EIA-0196217.")
clips = json.load(open(os.path.join(HERE, 'design', 'clips.json')))


def tone(src, out):
    p = subprocess.run([sys.executable, '-I', '-B', TONE, 'apply', '', src, out], capture_output=True, text=True)
    assert p.returncode == 0, p.stderr[-800:]
    return json.loads(p.stdout.strip().splitlines()[-1]) if p.stdout.strip() else {}


PIN_MAX = 8


def lowest(a): return int(np.nonzero(a[..., 3] > 0)[0].max())


def pin_feet(dest, kind, n):
    """A standing frame (a hit's, 1..n-2) keeps the stance's foot line: its lowest ink row is moved to the stance's when the two are
    within PIN_MAX px (a vertical shift only, nothing redrawn). A knockout is not pinned: its falling and lying frames are
    grounded by the skeleton, and a body lying on the ground legitimately sits off the stance's foot row."""
    pins = [0] * n
    if kind != 'hit': return pins
    st = np.array(Image.open(os.path.join(dest, '00.png')).convert('RGBA')); want = lowest(st)
    for k in range(1, n - 1):
        p = os.path.join(dest, f'{k:02d}.png'); a = np.array(Image.open(p).convert('RGBA')); dy = want - lowest(a)
        if dy == 0 or abs(dy) > PIN_MAX: continue
        b = np.zeros_like(a)
        if dy > 0: b[dy:] = a[:-dy]
        else: b[:dy] = a[-dy:]
        Image.fromarray(b).save(p); pins[k] = int(dy)
    return pins


def main(assembly):
    spec = json.load(open(assembly))
    shutil.rmtree(OUT, ignore_errors=True); os.makedirs(OUT)
    manifest = {}
    for t in spec['takes']:
        kind, d, raw, frames = t['kind'], t['dir'], t['raw'], t['frames']          # frames: raw indexes in play order
        name = ('hit' if kind == 'hit' else 'ko') + HEADING[d]
        cand = clips['hit-lic' if kind == 'hit' else 'ko-lic']
        tmp = os.path.join(OUT, '_tone_in'); shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
        for i in frames: shutil.copy(os.path.join(RAW, raw, f'{i:02d}.png'), os.path.join(tmp, f'{i:02d}.png'))
        toned = os.path.join(OUT, '_toned'); shutil.rmtree(toned, ignore_errors=True)
        manifest[name] = tone(tmp, toned)
        dest = os.path.join(OUT, name); os.makedirs(dest)
        stance = TONED_IDLE.format(d=d)
        seq = [stance] + [os.path.join(toned, f'{i:02d}.png') for i in frames] + ([stance] if kind == 'hit' else [])
        for n, f in enumerate(seq): shutil.copy(f, os.path.join(dest, f'{n:02d}.png'))
        pins = pin_feet(dest, kind, len(seq))
        base = cand['ms']   # a take that drops its last key frame holds its last frame for the take's full hold instead
        ms = t.get('ms') or (base[:len(seq) - 1] + [base[-1]] if kind == 'ko' and len(seq) <= len(base) else base)
        assert ms and len(ms) == len(seq), (name, len(seq))
        hitstop = {'frame': 1, 'ms': 80}
        timing = dict(take=name, foot_pin_dy=pins, kind=kind, n_frames=len(seq), ms_per_frame=ms, hitstop=hitstop, last_frame_holds=(kind == 'ko'),
                      cel={'size': [192, 192]}, raw_job=t['job'], raw=f'{raw} frames {frames}', seed=t['seed'],
                      attribution=cand['attribution'], credit=CMU, motion=f"{cand['clip']} source frames {cand['frames']}")
        json.dump(timing, open(os.path.join(dest, 'timing.json'), 'w'), indent=1)
        shutil.rmtree(tmp, ignore_errors=True); shutil.rmtree(toned, ignore_errors=True)
        print(name, len(seq), 'cels', ms)
    json.dump(manifest, open(os.path.join(OUT, 'tone-manifest.json'), 'w'), indent=1)


if __name__ == '__main__':
    main(sys.argv[1])
