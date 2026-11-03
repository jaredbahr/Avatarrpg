"""req.py CAND DIR : prints the animate_with_skeleton_v3 first_frame_keypoints and keypoints for a designed candidate (kp/<cand>-<dir>.json).
A hit sends H1..H3 (frames 1-3, the closing stance is the idle cel again); a knockout sends every frame after the stance."""
import json, sys
cand, d = sys.argv[1:3]
r = json.load(open(f'kp/{cand}-{d}.json'))
def c(L): return [dict(label=j['label'], x=round(j['x'],3), y=round(j['y'],3), z_index=j['z_index']) for j in L]
fr = r['frames']; ks = fr[1:4] if r['kind'] == 'hit' else fr[1:]
print(json.dumps(c(fr[0]), separators=(',', ':')))
print(json.dumps([c(f) for f in ks], separators=(',', ':')))
