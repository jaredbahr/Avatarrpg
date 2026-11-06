import sys
from PIL import Image, ImageDraw
D8=['south','south-east','east','north-east','north','north-west','west','south-west']
bd,ad,out=sys.argv[1:4]; ks=[int(x) for x in (sys.argv[4] if len(sys.argv)>4 else '0,1').split(',')]
box=(30,30,270,230); W,H=240,200
im=Image.new('RGB',(W*2*len(ks),H*8),(0,0,0)); d=ImageDraw.Draw(im)
for r,dn in enumerate(D8):
    for j,k in enumerate(ks):
        for g,dd in enumerate((bd,ad)):
            im.paste(Image.open(f'{dd}/{dn}_{k}.png').crop(box),((g*len(ks)+j)*W,r*H))
    d.text((4,r*H+4),dn+'  BEFORE | AFTER',fill=(255,255,255))
im.save(out); print(im.size)
