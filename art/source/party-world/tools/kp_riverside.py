"""Kaya polish, step 8: the riverside's wave and seated tea (ADR 0054) in the new rendering, replacing #321's G1 cels.

- wave: animate-with-skeleton-v3 from the south-east idle root (the G1 wave's facing), her screen-right arm raised beside
  her head and swung out and back (3 frames, 2 generations); cels 0 and 1 are frames 0 and 1.
- tea: edit-image-pro-flash on the south idle root: sitting cross-legged on the ground with a cup in both hands (tea 0);
  then tea 0 edited to lift the cup to her lips (tea 1), so the two cels share one drawing.

usage (repo root): python3 -I art/source/party-world/tools/kp_riverside.py wave SEED | tea0 SEED | tea1 SEED SRCSEED"""
import json, sys
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path(__file__).parent))
import pl
from kp_stance import DESC, kps
HERE = Path(__file__).resolve().parent.parent
TEA = ('Redraw this exact character, same costume, colours, painterly texture, camera and light, now sitting cross-legged '
       'on the ground facing the viewer, relaxed, {pose}. Her folded legs rest flat on the ground with the bottom of her '
       'trousers and boots on the same row her soles stand on now; keep the same size of head and body. Painterly pixel art '
       'with soft mottled tone clusters, warm light from the upper left, soft dark edge. ' + DESC)


def wave(seed):
    d = 'south-east'; K = kps(HERE / f'roots/kaya/idle/skeleton/{d}.json')
    side = 'LEFT' if K['LEFT SHOULDER']['x'] > K['RIGHT SHOULDER']['x'] else 'RIGHT'
    sh = np.array([K[f'{side} SHOULDER']['x'], K[f'{side} SHOULDER']['y']]) * 128
    def pose(dx):
        F = [dict(label=l, x=j['x'], y=j['y'], z_index=j['z_index']) for l, j in K.items()]
        for j in F:
            if j['label'] == f'{side} ELBOW': j['x'], j['y'] = (sh[0] + 8) / 128, (sh[1] - 4) / 128
            if j['label'] == f'{side} ARM': j['x'], j['y'] = (sh[0] + 9 + dx) / 128, (sh[1] - 16 + abs(dx) // 3) / 128
            j['x'], j['y'] = round(j['x'], 4), round(j['y'], 4)
        return F
    first = [dict(label=l, x=j['x'], y=j['y'], z_index=j['z_index']) for l, j in K.items()]
    frames = [pose(-2), pose(5), pose(-2)]
    (HERE / 'polish/design').mkdir(parents=True, exist_ok=True)
    json.dump(dict(dir=d, side=side, first_frame_keypoints=first, frames=frames), open(HERE / 'polish/design/wave.json', 'w'), indent=1)
    payload = dict(description=DESC, action='waving hello with one raised hand', direction=d, view='high top-down',
                   first_frame=pl.b64(HERE / f'roots/kaya/idle/{d}.png'), first_frame_keypoints=first, keypoints=frames,
                   template_id='mannequin', seed=seed, no_background=True)
    return pl.run('/animate-with-skeleton-v3', payload, f'kp-wave-s{seed}', inputs={'first_frame': f'roots/kaya/idle/{d}.png',
                  'keypoints': 'polish/design/wave.json'}, notes='Kaya polish: riverside wave')


def tea(cel, seed, src_seed=None):
    if cel == 0:
        src = 'roots/kaya/idle/south.png'; pose = 'holding a small clay tea cup in both hands in her lap'
    else:
        src = f'raw/kp-tea0-s{src_seed}/00.png'; pose = 'lifting the small clay tea cup in both hands to her lips to sip; only her arms, hands and head move'
    payload = dict(image=pl.b64(HERE / src), method='text', description=TEA.format(pose=pose), no_background=True, seed=seed)
    return pl.run('/edit-image-pro-flash', payload, f'kp-tea{cel}-s{seed}', inputs={'image': src}, notes=f'Kaya polish: riverside tea {cel}')


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[0] == 'wave': wave(int(a[1]))
    elif a[0] == 'tea0': tea(0, int(a[1]))
    else: tea(1, int(a[1]), int(a[2]))
