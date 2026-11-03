"""tone_thug.py - thug tone pass (BRIEF-2 item 1; Jared 2026-09-28 roster ruling: new enemies are toned toward the party
palette for consistency). Written in the spirit of media/party-consistency/tone/tone.py, which cannot take new params
(its PARAMS path is fixed and it only moves brightness); that tool and its frozen params.json are not touched.

  python tone_thug.py build [--params F]           # derive a params file from the 8 approved thug rotations (frozen once written)
  python tone_thug.py apply SRC OUT [--params F]   # tone every frame PNG under SRC (any layout) into OUT, mirroring the tree
  Final: --params params-v3.json (params.json = v1 and params-v2.json = v2, both superseded, kept for the record).

Per colour x of a frame pixel (alpha untouched, fully transparent pixels untouched) - a pure per-colour function:
 1. luma L = .299R + .587G + .114B. If L < INK (70) -> unchanged (outline/ink; the outline weight metric stays exact).
 2. protected -> unchanged, byte for byte (tone.py rule, thug joints thug/scripts/src_joints.json):
    - x in the exact protected list: skin colours of the 8 rotations (skin hue, sat >= SKIN_SAT_MIN, luma >= SKIN_LUMA_MIN;
      see build() for why the tone.py zone-share rule does not work on a sleeveless unit) + face features (>= FEATURE_SHARE
      of the time inside the face circle), or
    - the nearest reference colour (CIELAB, among all rotation colours with L >= INK) is protected and within PROTECT_DE.
 3. otherwise, in HSV: hue h -> h + HUE_PULL * (HUE_TARGET - h) for h in the warm band [WARM_LO, WARM_HI] (orange-rust
    pulled a few degrees toward the party red family, Kaya hue ~9), saturation s -> s * SAT_SCALE(h) (warm band) or
    s * SAT_OTHER, then RGB is rescaled so the luma equals the source luma exactly (brightness unchanged - the opposite
    half of tone.py, which moves only brightness). Ink guard: the change fades in over INK..INK+RAMP.
Idempotent and deterministic; manifest records sha256 of params, inputs and outputs. Sources are never written."""
import os, sys, json, hashlib, colorsys
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); PARAMS = os.path.join(HERE, 'params.json')
THUG = os.path.dirname(HERE)
ORDER = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west']
FACE_DIRS = ['south', 'south-east', 'east', 'west', 'south-west']
# v1 (params.json, superseded) used ink_ramp=30 copied from tone.py; the rust vest's shades sit at luma 72-80, inside that
# ramp, so v1 left the vest at sat 0.70 (from 0.74). tone.py needs the long ramp because it MOVES luma (no shade may collapse
# onto the ink); this pass keeps luma exactly, so v2 (params-v2.json) uses a 4-luma ramp. Ink (< 70) stays byte-identical.
CFG = dict(ink_luma=70, ink_ramp=4, protect_de=6.0, share=0.6, feature_share=0.8, face_r=14, hand_r=8, neck_r=7,
           skin_hue=[17, 26], skin_sat_min=0.55, skin_luma_min=95,
           warm_lo=-20, warm_hi=45, hue_target=8.0, hue_pull=0.25, sat_scale=0.6, sat_other=0.9)
# v2 (params-v2.json, superseded) had hue_pull 0.5: vest hue 17 -> 12, read as brick/maroon and the rag went mauve (lost
# the rust read, out/lineups/thug-tone-*-r2.png before v3; huepull-test.png compares 0.5 / 0.25 / 0). v3 = 0.25, FINAL.


# --- helpers copied verbatim from party-consistency/tone/tone.py (same definitions) ---
def luma(rgb): return .299 * rgb[..., 0] + .587 * rgb[..., 1] + .114 * rgb[..., 2]
def lab(rgb):
    c = np.asarray(rgb, float) / 255; c = np.where(c > .04045, ((c + .055) / 1.055) ** 2.4, c / 12.92)
    M = np.array([[.4124, .3576, .1805], [.2126, .7152, .0722], [.0193, .1192, .9505]]); xyz = c @ M.T / np.array([.95047, 1., 1.08883])
    f = np.where(xyz > 216 / 24389, np.cbrt(xyz), (24389 / 27 * xyz + 16) / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)
def hsv(rgb):
    a = np.asarray(rgb, float) / 255; mx = a.max(-1); mn = a.min(-1); d = mx - mn; r, g, b = a[..., 0], a[..., 1], a[..., 2]
    h = np.zeros_like(mx); i = d > 0; hr = (mx == r) & i; hg = (mx == g) & i & ~hr; hb = i & ~hr & ~hg
    h[hr] = ((g - b)[hr] / d[hr]) % 6; h[hg] = (b - r)[hg] / d[hg] + 2; h[hb] = (r - g)[hb] / d[hb] + 4
    return h * 60, np.where(mx > 0, d / np.maximum(mx, 1e-9), 0), mx
def ld(p): return np.array(Image.open(p).convert('RGBA'))
def sha(p): return hashlib.sha256(open(p, 'rb').read()).hexdigest()
def outline_weight(a):  # scripts/measure.py definition
    op = a[..., 3] > 0; pad = np.pad(op, 1); bd = op & ~(pad[:-2, 1:-1] & pad[2:, 1:-1] & pad[1:-1, :-2] & pad[1:-1, 2:])
    dark = op & (luma(a[..., :3].astype(float)) < 70); near = np.zeros_like(op)
    for dy in range(-2, 3):
        for dx in range(-2, 3): near |= np.roll(np.roll(bd, dy, 0), dx, 1)
    return float((dark & near).sum() / max(bd.sum(), 1))
def is_frame(p):
    try:
        im = Image.open(p)
        if im.size[0] > 256 or im.size[1] > 256: return False
        a = np.array(im.convert('RGBA')); return bool((a[..., 3] == 0).any())
    except Exception: return False


def build():
    if os.path.exists(PARAMS) and json.load(open(PARAMS)).get('frozen'):
        raise SystemExit('params.json is frozen; write a new params file instead of rebuilding')
    J =json.load(open(os.path.join(THUG, 'scripts/src_joints.json')))
    inside, feat, total = {}, {}, {}
    for d in ORDER:
        a = ld(os.path.join(THUG, f'base/approved/{d}.png')); m = a[..., 3] > 0; yy, xx = np.mgrid[:a.shape[0], :a.shape[1]]; S = J[d]
        fc = np.mean([S['NOSE'], S['RE'], S['LE']], 0)
        near = lambda p, r: (xx - p[0]) ** 2 + (yy - p[1]) ** 2 <= r * r
        face = near(fc, CFG['face_r']); zone = face | near(S['RW'], CFG['hand_r']) | near(S['LW'], CFG['hand_r']) | near(S['NECK'], CFG['neck_r'])
        for (y, x) in zip(*np.nonzero(m)):
            k = tuple(int(v) for v in a[y, x, :3]); total[k] = total.get(k, 0) + 1
            if zone[y, x]: inside[k] = inside.get(k, 0) + 1
            if face[y, x] and d in FACE_DIRS: feat[k] = feat.get(k, 0) + 1
    cols = [k for k in total if luma(np.array(k, float)) >= CFG['ink_luma']]
    H, Sat, _ = hsv(np.array(cols)); h0, h1 = CFG['skin_hue']
    skin, face_feat, other = [], [], []
    for k, h, sa in zip(cols, H, Sat):
        # skin: the thug is sleeveless with bare shins/feet, so most skin lies OUTSIDE the face/hand/neck circles and
        # tone.py's zone-share rule finds none (0 skin colours). Skin = the lit warm ramp instead: skin hue, sat >=
        # SKIN_SAT_MIN, luma >= SKIN_LUMA_MIN (the rust vest/rag share the hue but sit below luma 95 or at hue <= 14).
        # Checked visually on all 8 rotations (thug/tone/skin-rule.png, protected-mask.png).
        if h0 <= h <= h1 and sa >= CFG['skin_sat_min'] and float(luma(np.array(k, float))) >= CFG['skin_luma_min']: skin.append(k)
        elif feat.get(k, 0) / total[k] >= CFG['feature_share']: face_feat.append(k)
        else: other.append(k)
    P = dict(config=CFG, note=__doc__.split('\n\n')[0], protected_exact=[list(k) for k in sorted(set(skin + face_feat))],
             skin_refs=[list(k) for k in sorted(skin)], feature_refs=[list(k) for k in sorted(face_feat)], other_refs=[list(k) for k in sorted(other)],
             n=dict(skin=len(skin), feature=len(face_feat), other=len(other)),
             skin_px_share={str(k): round(inside.get(k, 0) / total[k], 3) for k in skin},
             sources={f'thug/base/approved/{d}.png': sha(os.path.join(THUG, f'base/approved/{d}.png')) for d in ORDER})
    json.dump(P, open(PARAMS, 'w'), indent=1)
    print(P['n'])


class Toner:
    def __init__(self):
        P = json.load(open(PARAMS)); self.cfg = P['config']; self.exact = {tuple(k) for k in P['protected_exact']}
        refs = [(k, 1) for k in P['skin_refs'] + P['feature_refs']] + [(k, 0) for k in P['other_refs']]
        self.rl = lab(np.array([k for k, _ in refs], float)); self.rp = np.array([p for _, p in refs], bool); self.cache = {}; self.pcache = {}
    def protected(self, k):
        if k not in self.pcache:
            if k in self.exact: r = True
            else:
                d = np.sqrt(((self.rl - lab(np.array(k, float))) ** 2).sum(-1)); i = int(d.argmin())
                r = bool(self.rp[i] and d[i] <= self.cfg['protect_de'])
            self.pcache[k] = r
        return self.pcache[k]
    def colour(self, k):
        if k in self.cache: return self.cache[k]
        c = self.cfg; L = float(luma(np.array(k, float)))
        if L < c['ink_luma'] or self.protected(k): out = k
        else:
            h, s, v = colorsys.rgb_to_hsv(*[x / 255 for x in k]); hd = h * 360; hd = hd - 360 if hd > 180 else hd
            w = min(1.0, (L - c['ink_luma']) / c['ink_ramp'])
            if c['warm_lo'] <= hd <= c['warm_hi']:
                hd2 = hd + w * c['hue_pull'] * (c['hue_target'] - hd); s2 = s * (1 - w * (1 - c['sat_scale']))
            else:
                hd2 = hd; s2 = s * (1 - w * (1 - c['sat_other']))
            rgb = np.array(colorsys.hsv_to_rgb((hd2 % 360) / 360, s2, v)) * 255
            Ln = float(luma(rgb)); rgb = rgb * (L / Ln) if Ln > 0 else rgb   # luma kept exactly (up to rounding)
            if rgb.max() > 255: rgb = rgb * 255 / rgb.max()
            out = tuple(int(x) for x in np.clip(np.round(rgb), 0, 255))
        self.cache[k] = out; return out
    def frame(self, a):
        o = a.copy(); m = a[..., 3] > 0
        px = a[m][:, :3]; u, inv = np.unique(px, axis=0, return_inverse=True)
        lut = np.array([self.colour(tuple(int(v) for v in k)) for k in u], np.uint8)
        o[m, :3] = lut[inv.ravel()]; return o


def apply(src, out):
    src = os.path.abspath(src); out = os.path.abspath(out)
    if src.startswith(os.path.join(HERE, 'out')): raise SystemExit(f'refusing to tone an already-toned folder: {src}')
    T = Toner(); man = dict(source=src.replace('\\', '/'), params_sha256=sha(PARAMS), files={}, skipped=[])
    G = dict(frames=0, skin_identical=True, alpha_identical=True, colours_as_intended=True, outline_weight_max_delta=0.0,
             luma_max_abs_delta=0.0, changed_px=0, protected_px=0)
    for root, _, files in os.walk(src):
        for fn in sorted(files):
            p = os.path.join(root, fn); rel = os.path.relpath(p, src); q = os.path.join(out, rel)
            if fn.lower().endswith('.png') and is_frame(p):
                os.makedirs(os.path.dirname(q), exist_ok=True)
                a = ld(p); o = T.frame(a); Image.fromarray(o).save(q)
                chk = ld(q); m = a[..., 3] > 0
                G['alpha_identical'] &= bool((chk[..., 3] == a[..., 3]).all())
                u, inv = np.unique(a[m][:, :3], axis=0, return_inverse=True); inv = inv.ravel()
                uk = [tuple(int(v) for v in k) for k in u]
                prot = np.array([T.protected(k) or float(luma(np.array(k, float))) < T.cfg['ink_luma'] for k in uk])[inv]
                exp = np.array([T.colour(k) for k in uk], np.uint8)[inv]
                G['colours_as_intended'] &= bool((chk[m][:, :3] == exp).all())
                G['skin_identical'] &= bool((chk[m][prot, :3] == a[m][prot, :3]).all())
                G['outline_weight_max_delta'] = max(G['outline_weight_max_delta'], abs(outline_weight(chk) - outline_weight(a)))
                G['luma_max_abs_delta'] = max(G['luma_max_abs_delta'], float(np.abs(luma(chk[m][:, :3].astype(float)) - luma(a[m][:, :3].astype(float))).max()))
                G['changed_px'] += int((chk[m][:, :3] != a[m][:, :3]).any(1).sum()); G['protected_px'] += int(prot.sum()); G['frames'] += 1
                man['files'][rel.replace('\\', '/')] = dict(src=sha(p), out=sha(q))
            else:
                man['skipped'].append(rel.replace('\\', '/'))
    G['luma_max_abs_delta'] = round(G['luma_max_abs_delta'], 2)
    man['gates'] = G; os.makedirs(out, exist_ok=True); json.dump(man, open(os.path.join(out, 'tone-manifest.json'), 'w'), indent=1)
    return G


if __name__ == '__main__':
    if '--params' in sys.argv:   # e.g. --params params-v2.json (a params file is frozen once written; changes = a new file)
        i = sys.argv.index('--params'); PARAMS = os.path.join(HERE, sys.argv[i + 1]); del sys.argv[i:i + 2]
    cmd = sys.argv[1]
    if cmd == 'build': build()
    elif cmd == 'apply': print(json.dumps(apply(sys.argv[2], sys.argv[3])))
