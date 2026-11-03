"""gates.py [--md OUT.md] : per-frame facing and pitch table for the slinger's hit and knockout takes (cels/<clip>/NN.png, the
toned 192 px cels the packer reads), measured against each take's own frame 0 = the slinger's idle cel 0 for that facing.

  ratio   ink height / stance ink height.
  pred    the same ratio predicted from the skeleton that was sent (neck -> lowest ankle, plus the stance's neck-to-crown), so
          `size_pop = |ratio - pred - bias|` (bias = frame 0's own ratio - pred) is the pitch check: a frame that tilts the
          camera pitch grows or shrinks against its skeleton. Upright frames only (a lying body has no neck-to-ankle height).
  facing  head-band check on the top 17% of the ink: the skin share's x offset from the band centre (stance-relative, <= 0.15),
          the skin pixel count against the stance's (0.4..2.5) and the head width against the stance's (0.8..1.2). Skin = the
          frozen tone parameters' skin and face-feature colours. Informational on frames that are not upright: a face turning
          down or away while it falls is the fall, not a swing to profile.
  foot    lowest ink row against the stance's, in 192 px source pixels.
A frame that fails is reported as failing; nothing here is a visual PASS."""
import json, os, sys
import numpy as np
from PIL import Image
sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__)); CELS = os.path.join(HERE, 'cels')
M = json.load(open(os.path.join(HERE, 'tone', 'skin-mask.json')))   # the slinger's own skin and face colours (his tone mask)
SKIN = {tuple(c) for c in M['skin_refs'] + M['feature_refs']}
DIR = {'East': 'east', 'NorthEast': 'north-east', 'North': 'north', 'NorthWest': 'north-west', 'West': 'west',
       'SouthWest': 'south-west', 'South': 'south', 'SouthEast': 'south-east'}


def ink(a): return a[..., 3] > 0


def bbox(a):
    m = ink(a); ys, xs = np.nonzero(m); return xs.min(), ys.min(), xs.max(), ys.max()


def head(a, y0, hh):
    band = ink(a)[y0:y0 + hh]; ys, xs = np.nonzero(band)
    if not len(xs): return None, None, 0
    cx = (xs.min() + xs.max()) / 2; hw = xs.max() - xs.min() + 1
    sk = [(x, y) for y, x in zip(*np.nonzero(band)) if tuple(int(v) for v in a[y0 + y, x, :3]) in SKIN]
    if not sk: return None, hw, 0
    return (np.mean([x for x, _ in sk]) - cx) / hw, hw, len(sk)


def main(md):
    rows_out = ['# Per-frame facing and pitch (slinger hits and knockouts)', '', __doc__.split('\n\n')[0], '']
    for clip in sorted(os.listdir(CELS)):
        d = os.path.join(CELS, clip)
        if not os.path.isdir(d): continue
        kind = 'hit' if clip.startswith('hit') else 'ko'; facing = DIR[clip[3:] if kind == 'hit' else clip[2:]]
        t = json.load(open(os.path.join(d, 'timing.json')))
        rec = json.load(open(os.path.join(HERE, 'design', 'kp', f"{'hit' if kind == 'hit' else 'ko'}-lic-{facing}.json")))
        cels = [np.array(Image.open(os.path.join(d, f'{k:02d}.png')).convert('RGBA')) for k in range(t['n_frames'])]
        sx0, sy0, sx1, sy1 = bbox(cels[0]); sh = sy1 - sy0 + 1; hh = int(round(0.17 * sh))
        st_off, st_hw, st_ns = head(cels[0], sy0, hh)
        px = rec['px']; S = px[0]; et = S['NECK'][1]; eb = max(S['RA'][1], S['LA'][1]); ear_to_top = et - sy0
        # the generated frames come from the keypoint frames 1.. of the design, in order
        gen = t['raw'].split('frames')[1].strip(' []').split(',')
        rows = []
        for k, a in enumerate(cels):
            x0, y0, x1, y1 = bbox(a); h = y1 - y0 + 1; w = x1 - x0 + 1
            src = 'stance' if (k == 0 or (kind == 'hit' and k == len(cels) - 1)) else int(gen[k - 1])
            if src == 'stance': pk = px[0]
            else: pk = px[int(src) + 1]
            pred = ((max(pk['RA'][1], pk['LA'][1]) - pk['NECK'][1]) + ear_to_top) / ((eb - et) + ear_to_top)
            upright = h >= w * 1.15
            off, hw, ns = head(a, y0, hh)
            if st_ns < 15:   # seen from behind: no face to compare, the face must stay hidden (the party's back-view rule)
                ok = bool(ns < max(15, 1.5 * st_ns) and st_hw and hw and 0.8 <= hw / st_hw <= 1.2)
            else:
                ok = bool(off is not None and st_off is not None and abs(off - st_off) <= 0.15 and 0.4 <= ns / max(st_ns, 1) <= 2.5
                          and st_hw and hw and 0.8 <= hw / st_hw <= 1.2)
            rows.append(dict(f=k, src=src, h=h, w=w, ratio=h / sh, pred=pred, upright=upright, off=None if off is None else off - (st_off or 0),
                             hw=None if not st_hw or not hw else hw / st_hw, ns=ns, ok=ok, foot=y1 - sy1))
        bias = rows[0]['ratio'] - rows[0]['pred']
        rows_out += [f'## {clip}  ({facing}, {t["n_frames"]} frames, {kind})', '',
                     '| f | src | ms | height | w | ratio | pred | size pop | upright | face offset | skin px | head w | facing ok | foot dy |',
                     '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|']
        for r in rows:
            sp = abs(r['ratio'] - r['pred'] - bias)
            fl = ''
            if r['upright'] and sp > 0.03: fl += ' PITCH-FAIL'
            if r['upright'] and not r['ok']: fl += ' FACING-FAIL'
            rows_out.append(f"| {r['f']} | {r['src']} | {t['ms_per_frame'][r['f']]} | {r['h']} | {r['w']} | {r['ratio']:.3f} | {r['pred']:.3f} | "
                            f"{sp:.3f}{' (n/a)' if not r['upright'] else ''} | {r['upright']} | {'-' if r['off'] is None else round(r['off'], 3)} | {r['ns']} | "
                            f"{'-' if r['hw'] is None else round(r['hw'], 2)} | {r['ok'] if r['upright'] else str(r['ok']) + ' (info)'} | {r['foot']}{fl} |")
        rows_out.append('')
    text = '\n'.join(rows_out)
    if md: open(md, 'w', encoding='utf8').write(text)
    fails = [l for l in rows_out if 'FAIL' in l]
    print(text if not md else f'wrote {md}; {len(fails)} failing frames')
    return fails


if __name__ == '__main__':
    main(sys.argv[sys.argv.index('--md') + 1] if '--md' in sys.argv else None)
