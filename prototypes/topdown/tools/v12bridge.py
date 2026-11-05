"""v12 item 2: the canal bridge, composed from the village's own wood and stone ramps (assets/objects12/bridge.png).
Low top-down, front-on like the houses: a stone abutment on EACH bank standing on the bank stones, a plank deck spanning the whole canal,
its front beam visible, posts and rails, light from the upper left, outlines a darker tone of each material.
Sprite 60 x 72 px; its (0,0) is world (478, 412), its base (the south abutment's foot) world y 484, centre x 508."""
from PIL import Image
import sys
from pathlib import Path
H = Path(__file__).resolve().parent.parent
W, Ht, OX, OY = 60, 72, 478, 412
im = Image.new('RGBA', (W, Ht), (0, 0, 0, 0)); P = im.load()
def hx(s): return tuple(int(s[i:i + 2], 16) for i in (1, 3, 5)) + (255,)
WD, W1, W2, W3, W4, W5 = map(hx, ['#3a2e2c', '#5a3d2b', '#7d5434', '#a6713f', '#c98b66', '#c99a5b'])
S0, S1, S2, S3, S4 = map(hx, ['#3e3d47', '#5d5b63', '#85807f', '#aea89c', '#2f2e37'])
WET = hx('#2c4a5a')
def px(x, y, c):
    x -= OX; y -= OY
    if 0 <= x < W and 0 <= y < Ht: P[x, y] = c
def fill(x0, y0, x1, y1, c):
    for y in range(y0, y1):
        for x in range(x0, x1): px(x, y, c)
def stone_block(x0, x1, ytop, yfront0, yfront1, seed):
    """an abutment: a lit top face (ytop..yfront0) and a south front face (yfront0..yfront1) in courses, outlined in the stone's dark tone"""
    fill(x0, ytop, x1, yfront0, S2); fill(x0, ytop, x1, ytop + 1, S3); fill(x0, ytop, x0 + 1, yfront0, S3)    # top face, its lit edges
    fill(x0, yfront0, x1, yfront1, S1)
    course = 0
    for y in range(yfront0, yfront1 - 1, 4):                                                                        # courses 4 px high
        fill(x0, y, x1, y + 1, S3 if y == yfront0 else S0)                                                         # mortar / lit lip
        off = 6 if course % 2 else 0
        for x in range(x0 + 4 + off, x1, 12):
            for yy in range(y + 1, min(y + 4, yfront1 - 1)): px(x, yy, S0)
        for x in range(x0 + 1, x1 - 1, 5):                                                                           # face lit on its left of each block
            px(x + (seed + y + course) % 3, y + 1, S2)
        course += 1
    fill(x1 - 3, yfront0, x1, yfront1, S0)                                                                           # right end in shade
    fill(x1 - 3, ytop + 1, x1, yfront0, S1)
    fill(x0 - 1, ytop, x0, yfront1, S4); fill(x1, ytop, x1 + 1, yfront1, S4)                                       # outline
    fill(x0 - 1, ytop - 1, x1 + 1, ytop, S4); fill(x0 - 1, yfront1, x1 + 1, yfront1 + 1, S4)
# north abutment: on the far bank, its front face dropping into the water
stone_block(486, 530, 423, 431, 441, 1)
fill(486, 441, 530, 443, WET)                       # the waterline under it
# deck: planks across, light from the upper left
DL, DR = 496, 520
for y in range(427, 463):
    k = (y - 427) % 4
    row = W3 if k in (0, 1) else W2
    fill(DL, y, DR, y + 1, row if k != 3 else W1)
    if k == 0: fill(DL, y, DR, y + 1, W4 if (y // 4) % 2 else W5)
for i, y in enumerate(range(427, 463, 4)):         # plank ends and nails, staggered joints
    jx = DL + 6 + (i * 7) % 15
    fill(jx, y + 1, jx + 1, y + 4, W1)
    px(DL + 2, y + 1, WD); px(DR - 3, y + 1, WD)
fill(DL, 427, DL + 1, 463, W4); fill(DR - 2, 427, DR, 463, W1)    # lit left edge, shaded right edge
fill(DL - 1, 427, DL, 463, WD); fill(DR, 427, DR + 1, 463, WD)    # side outline
fill(DL - 1, 426, DR + 1, 427, WD)
# the south abutment's lit top, either side of the deck, then the deck's front beam standing proud of it
stone_block(486, 530, 461, 468, 481, 2)
fill(DL - 1, 463, DR + 1, 470, WD); fill(DL, 463, DR, 469, W1); fill(DL, 463, DR, 464, W3); fill(DL, 464, DR, 465, W2)   # front fascia: lit lip, face
fill(DL, 468, DR, 469, WD)
for x in range(DL + 3, DR - 2, 9): fill(x, 465, x + 1, 468, WD)  # board seams on the face
fill(DL, 463, DL + 1, 469, W3); fill(DR - 2, 465, DR, 469, WD)
fill(DL + 1, 469, DR - 1, 471, S4)                  # the beam's shadow on the abutment face
# posts and rails: three pairs, the near pair standing on the front beam
def post(x, base, h):
    fill(x - 2, base - h - 1, x + 4, base + 1, WD)                      # outline
    fill(x - 1, base - h, x + 3, base, W2); fill(x - 1, base - h, x, base, W3); fill(x + 2, base - 2, x + 3, base, W1)
    fill(x - 2, base - h - 2, x + 4, base - h, WD); fill(x - 1, base - h - 1, x + 3, base - h, W4)   # cap, proud of the rail
def rail(x, y0, y1, c, d):
    fill(x, y0, x + 2, y1, c); fill(x + 1, y0, x + 2, y1, d); fill(x - 1, y0, x, y1, WD); fill(x + 2, y0, x + 3, y1, WD)
for X in (DL - 3, DR + 1):
    top = (X == DL - 3)
    rail(X, 430 - 8, 462 - 8, W3 if top else W2, W2 if top else W1)        # the top rail, the run of the deck, lifted by the post height
    rail(X, 430 - 3, 462 - 3, W2, W1)                                          # the low rail
for X in (DL - 3, DR + 1):
    for b, h in ((432, 8), (447, 8), (463, 10)): post(X, b, h)
im.save(H / 'assets' / 'objects12' / 'bridge.png')
Image.open(H / 'assets' / 'objects12' / 'bridge.png').resize((W * 6, Ht * 6), Image.NEAREST).save(H / 'v12' / 'bridge6.png')
print('bridge', W, Ht)
