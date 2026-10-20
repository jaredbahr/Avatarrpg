"""lay_club.py SRC_RAW_DIR OUT_RAW_DIR FRAME[,FRAME..] : the one pixel edit this folder makes (ADR 0080 amendment).
In a held lying frame the generator drew the club standing upright out of the hand. The upright part (every opaque pixel above the
body's top edge inside the club's own column window) is cut out and laid down again, rotated 90 degrees counter-clockwise (rotation
only, the generator's own pixels, nothing painted), behind the figure on the far side of the thigh, its handle end at the original
handle column. The body and everything else is byte-identical. OUT_RAW_DIR gets a full copy of SRC with the edited frames replaced."""
import os, shutil, sys
import numpy as np
from PIL import Image
src, out, frames = sys.argv[1], sys.argv[2], [int(x) for x in sys.argv[3].split(',')]
shutil.rmtree(out, ignore_errors=True); shutil.copytree(src, out)
for f in frames:
    p = os.path.join(out, f'{f:02d}.png'); a = np.array(Image.open(p).convert('RGBA')); al = a[..., 3] > 0
    ys, xs = np.nonzero(al); top = ys.min(); cols = np.nonzero(al[top:top + 12].any(0))[0]
    x0, x1 = max(cols.min() - 3, 0), cols.max() + 4          # the club's column window
    wide = np.nonzero(al.sum(1) > 50)[0]; yb = int(wide[wide > top].min())   # first row of the body's top edge
    box = (slice(top, yb), slice(x0, x1)); club = a[box].copy(); cm = club[..., 3] > 0
    # rows above the body and inside the window belong to the club; boots etc. outside the window are untouched
    rows = np.nonzero(cm.any(1))[0]; cx = np.nonzero(cm.any(0))[0]
    club = club[rows.min():rows.max() + 1, cx.min():cx.max() + 1]
    handle_x = x0 + cx.max()
    a[box] = np.where(cm[..., None], 0, a[box])           # erase the standing club
    lay = np.rot90(club, 1)                               # head to the left, handle to the right
    h, w = lay.shape[:2]; y_top = yb - h + 2; x_left = handle_x - w + 1
    under = np.zeros_like(a); under[y_top:y_top + h, x_left:x_left + w] = lay
    # behind the figure: the body keeps every pixel it has
    res = under.copy(); m = a[..., 3] > 0; res[m] = a[m]
    Image.fromarray(res).save(p); print(f, 'club', club.shape, 'at', (x_left, y_top), 'body edge', yb)
