import sys
from PIL import Image
def sheet(rows, scale=4, bg=(120,140,110,255), pad=2):
    """rows: list of lists of RGBA images -> one image"""
    w = max(sum(i.width + pad for i in r) for r in rows); h = sum(max(i.height for i in r) + pad for r in rows)
    out = Image.new('RGBA', (w, h), bg); y = 0
    for r in rows:
        x = 0
        for i in r: out.alpha_composite(i, (x, y)); x += i.width + pad
        y += max(i.height for i in r) + pad
    return out.resize((out.width*scale, out.height*scale), Image.NEAREST)
