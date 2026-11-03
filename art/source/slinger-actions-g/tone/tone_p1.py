"""tone_p1.py - bandit faction tone with the THUG's frozen params (models-p0p1/thug/tone/params-v3.json, read only, sha
checked) plus a per-unit skin mask. The thug tool's own code is imported and used unchanged (Toner.colour, apply gates).

  python tone_p1.py mask UNIT            # derive UNIT/tone/skin-mask.json from UNIT/base/a1 (frozen once written) + mask png
  python tone_p1.py apply UNIT SRC OUT   # tone every frame under SRC into OUT (manifest + gates as tone_thug.apply)

Why a per-unit mask: params-v3 protects the thug's own skin colours (exact list + nearest-thug-colour within dE 6). A new
unit's skin shades are not all in that list, so they would be desaturated like cloth. The mask adds, for this unit only:
 - skin = the thug's own skin rule (tone_thug.build): hue 17-26, sat >= 0.55, luma >= 95, on the unit's 8 rotations;
 - face features = colours >= 80 % of the time inside the face circle (r 14 around the unit's hand-read NOSE/RE/LE) in the
   face-visible directions (the thug rule);
 - a frame colour is protected if the thug rule protects it, OR it is in the unit's exact list, OR its nearest reference
   colour among the unit's rotation colours is protected and within dE 6 (the thug's protect_de).
Everything else (cloth, sash, rope, weapon) goes through params-v3's colour function unchanged."""
import os, sys, json, hashlib, importlib.util
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
H = os.path.dirname(HERE)   # the slinger-actions-g folder; the unit's mask is ./skin-mask.json (copied, frozen)
TT = os.path.join(HERE, 'tone_thug.py')
V3 = os.path.join(HERE, 'params-v3.json')
V3_SHA = 'd6f5afc6'  # REPORT-2: params-v3 sha256 d6f5afc6...1494
spec = importlib.util.spec_from_file_location('tone_thug', TT); T = importlib.util.module_from_spec(spec); spec.loader.exec_module(T)
T.PARAMS = V3
assert T.sha(V3).startswith(V3_SHA) and T.sha(V3).endswith('1494'), 'params-v3 changed?'
ORDER = T.ORDER; FACE_DIRS = T.FACE_DIRS


def mask_path(U):
    """newest mask version: skin-mask-v2.json (sash exclusion) if it exists, else skin-mask.json"""
    p2 = os.path.join(H, U, 'tone/skin-mask-v2.json')
    return p2 if os.path.exists(p2) else os.path.join(H, U, 'tone/skin-mask.json')


def mask(U, v2=False):
    """v2 (quarry bender): the ochre sash (hue ~25, sat > .55, luma > 95) passes the thug skin rule. v2 rejects a
    skin-rule colour when >= 50 % of its pixels lie in the sash box (hip-joint row -6..+14 px, x between the hips +-6 px)
    and outside the hand circles (r 8 around RW/LW). Everything else identical to v1."""
    P = os.path.join(H, U, 'tone/skin-mask-v2.json' if v2 else 'tone/skin-mask.json')
    if os.path.exists(P): raise SystemExit(f'{P} exists (frozen); write a new file instead')
    C = json.load(open(V3))['config']; J = json.load(open(os.path.join(H, U, 'scripts/src_joints.json')))
    feat, total, sash = {}, {}, {}
    for d in ORDER:
        a = T.ld(os.path.join(H, U, f'base/a1/{d}.png')); m = a[..., 3] > 0; yy, xx = np.mgrid[:a.shape[0], :a.shape[1]]; S = J[d]
        fc = np.mean([S['NOSE'], S['RE'], S['LE']], 0); face = (xx - fc[0]) ** 2 + (yy - fc[1]) ** 2 <= C['face_r'] ** 2
        hy = (S['RH'][1] + S['LH'][1]) / 2; hx0, hx1 = min(S['RH'][0], S['LH'][0]) - 6, max(S['RH'][0], S['LH'][0]) + 6
        hand = ((xx - S['RW'][0]) ** 2 + (yy - S['RW'][1]) ** 2 <= 64) | ((xx - S['LW'][0]) ** 2 + (yy - S['LW'][1]) ** 2 <= 64)
        box = (yy >= hy - 6) & (yy <= hy + 14) & (xx >= hx0) & (xx <= hx1) & ~hand
        for (y, x) in zip(*np.nonzero(m)):
            k = tuple(int(v) for v in a[y, x, :3]); total[k] = total.get(k, 0) + 1
            if face[y, x] and d in FACE_DIRS: feat[k] = feat.get(k, 0) + 1
            if box[y, x]: sash[k] = sash.get(k, 0) + 1
    cols = [k for k in total if T.luma(np.array(k, float)) >= C['ink_luma']]
    Hh, Sat, _ = T.hsv(np.array(cols)); h0, h1 = C['skin_hue']
    skin, ff, other = [], [], []
    for k, h, sa in zip(cols, Hh, Sat):
        if h0 <= h <= h1 and sa >= C['skin_sat_min'] and float(T.luma(np.array(k, float))) >= C['skin_luma_min'] \
                and not (v2 and sash.get(k, 0) / total[k] >= 0.5): skin.append(k)
        elif feat.get(k, 0) / total[k] >= C['feature_share']: ff.append(k)
        else: other.append(k)
    out = dict(unit=U, rule='thug skin rule + face-feature rule on the unit rotations (see tone_p1.py)' + (' + v2 sash exclusion' if v2 else ''), params_v3_sha256=T.sha(V3),
               skin_refs=[list(k) for k in sorted(skin)], feature_refs=[list(k) for k in sorted(ff)], other_refs=[list(k) for k in sorted(other)],
               n=dict(skin=len(skin), feature=len(ff), other=len(other)), frozen=True,
               sources={f'{U}/base/a1/{d}.png': T.sha(os.path.join(H, U, f'base/a1/{d}.png')) for d in ORDER})
    os.makedirs(os.path.dirname(P), exist_ok=True); json.dump(out, open(P, 'w'), indent=1); print(U, out['n'])
    # visual check: protected pixels (thug rule OR unit mask) in magenta over the 8 rotations
    tn = UnitToner(U, P); cells = []
    for d in ORDER:
        a = T.ld(os.path.join(H, U, f'base/a1/{d}.png')); o = a.copy(); m = a[..., 3] > 0
        for (y, x) in zip(*np.nonzero(m)):
            k = tuple(int(v) for v in a[y, x, :3])
            if T.luma(np.array(k, float)) >= C['ink_luma'] and tn.protected(k): o[y, x, :3] = (255, 0, 255)
        cells += [a, o]
    sh = Image.new('RGBA', (192 * 8, 384), (110, 110, 110, 255))
    for i, d in enumerate(ORDER):
        sh.alpha_composite(Image.fromarray(cells[2 * i]), (192 * i, 0)); sh.alpha_composite(Image.fromarray(cells[2 * i + 1]), (192 * i, 192))
    sh.resize((sh.width * 2, sh.height * 2), Image.NEAREST).save(os.path.join(H, U, 'tone/mask-check' + ('-v2' if v2 else '') + '.png'))


BaseToner = T.Toner   # the thug class, bound before apply() swaps T.Toner


class UnitToner(BaseToner):
    unit = None
    def __init__(self, U=None, mpath=None):
        super().__init__(); U = U or UnitToner.unit
        self.mpath = mpath or mask_path(U)
        M = json.load(open(self.mpath))
        self.uexact = {tuple(k) for k in M['skin_refs'] + M['feature_refs']}
        refs = [(k, 1) for k in M['skin_refs'] + M['feature_refs']] + [(k, 0) for k in M['other_refs']]
        self.url = T.lab(np.array([k for k, _ in refs], float)); self.urp = np.array([p for _, p in refs], bool); self.upc = {}
    def protected(self, k):
        # the unit mask decides for colours of the unit's own palette (exact, or nearest unit colour within dE 6);
        # only colours far from every unit colour fall back to the thug rule (params-v3). Without this, the thug's own
        # skin shades (dE <= 6) re-protect the quarry bender's ochre sash.
        if k not in self.upc:
            if k in self.uexact: r = True
            else:
                d = np.sqrt(((self.url - T.lab(np.array(k, float))) ** 2).sum(-1)); i = int(d.argmin())
                r = bool(self.urp[i]) if d[i] <= self.cfg['protect_de'] else BaseToner.protected(self, k)
            self.upc[k] = r
        return self.upc[k]


def check(U):
    """UNIT/tone/mask-check-final.png: rotations (top) and the pixels the FINAL rule protects in magenta (bottom)."""
    C = json.load(open(V3))['config']; tn = UnitToner(U)
    sh = Image.new('RGBA', (192 * 8, 384), (110, 110, 110, 255))
    for i, d in enumerate(ORDER):
        a = T.ld(os.path.join(H, U, f'base/a1/{d}.png')); o = a.copy(); m = a[..., 3] > 0
        for (y, x) in zip(*np.nonzero(m)):
            k = tuple(int(v) for v in a[y, x, :3])
            if T.luma(np.array(k, float)) >= C['ink_luma'] and tn.protected(k): o[y, x, :3] = (255, 0, 255)
        sh.alpha_composite(Image.fromarray(a), (192 * i, 0)); sh.alpha_composite(Image.fromarray(o), (192 * i, 192))
    sh.resize((sh.width * 2, sh.height * 2), Image.NEAREST).save(os.path.join(H, U, 'tone/mask-check-final.png')); print(U, tn.mpath)


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'check': check(sys.argv[2])
    if cmd == 'mask': mask(sys.argv[2], '--v2' in sys.argv)
    elif cmd == 'apply':
        U, src, out = sys.argv[2:5]; UnitToner.unit = U; T.Toner = UnitToner   # tone_thug.apply instantiates T.Toner()
        G = T.apply(src, out)
        man = os.path.join(out, 'tone-manifest.json'); m = json.load(open(man))
        m.update(unit_mask=os.path.relpath(mask_path(U), H).replace('\\', '/'), unit_mask_sha256=T.sha(mask_path(U)), tool='tone_p1.py (tone_thug.py code + params-v3 + unit skin mask)')
        json.dump(m, open(man, 'w'), indent=1); print(U, json.dumps(G))
