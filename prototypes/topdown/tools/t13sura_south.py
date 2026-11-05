"""Sura, SOUTH heading only (fixes 2026-11-05; owner: her model is good, one heading reads blank-white/possessed).
Her south frames (rot_south, idle, walk, strike, ice, heal) draw each eye as 2 exact-white px with no iris. East, west and the
diagonals already have a dark pupil beside the white. Here, per eye (2 px wide), the INNER pixel becomes the iris
(36,27,44): whites stay, she looks ahead. Cream (248,237,211) eye whites (the walk frames) are found by sitting in face colours.
Reads fc_sura-v1 (pristine), writes only *_south*.png frames of fc_sura; no other file is touched."""
import glob, re, os
from PIL import Image
H = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC, DST = f'{H}/assets/chars/fc_sura-v1', f'{H}/assets/chars/fc_sura'
IRIS = (36, 27, 44, 255)
SK = {(0xa4,0x5b,0x33),(0xad,0x68,0x3d),(0x7d,0x36,0x21),(0x5e,0x1e,0x16),(0x6d,0x28,0x1a),(0,0,0)}
def eyes(px, w, h, bb):
    s = set()
    for y in range(bb[1], min(h, bb[1] + 16)):
        for x in range(w):
            p = px[x, y]
            if not p[3]: continue
            if p[:3] == (255, 255, 252): s.add((x, y))
            elif p[:3] == (248, 237, 211) and sum(1 for dy in (-1,0,1) for dx in (-1,0,1) if (dx or dy) and 0<=x+dx<w and 0<=y+dy<h and px[x+dx,y+dy][3] and px[x+dx,y+dy][:3] in SK) >= 6: s.add((x, y))
    return s
def groups(s):
    s = set(s); out = []
    while s:
        st = [s.pop()]; g = set(st)
        while st:
            x, y = st.pop()
            for q in ((x+1,y),(x-1,y),(x,y+1),(x,y-1)):
                if q in s: s.remove(q); g.add(q); st.append(q)
        out.append(g)
    return sorted(out, key=lambda g: min(p[0] for p in g))
if __name__ == '__main__':
    n = fr = 0; log = []
    for f in sorted(glob.glob(SRC + '/*.png')):
        b = os.path.basename(f)
        if not re.search(r'(^rot_south\.png$|_south_\d+\.png$)', b): continue
        im = Image.open(f).convert('RGBA'); px = im.load(); gs = groups(eyes(px, im.width, im.height, im.getbbox()))
        if len(gs) == 2:
            for i, g in enumerate(gs):
                xs = sorted({p[0] for p in g})
                if len(xs) < 2: continue                       # a lone px is left white
                xc = xs[-1] if i == 0 else xs[0]               # inner side: left eye's right px, right eye's left px
                col = [p for p in g if p[0] == xc]
                for p in (col if len(col) <= 2 else [max(col, key=lambda p: p[1])]): px[p] = IRIS; n += 1
        else: log.append((b, len(gs)))
        im.save(f.replace(SRC, DST)); fr += 1
    print('south frames', fr, 'iris px', n, 'frames not 2 eyes:', log)
