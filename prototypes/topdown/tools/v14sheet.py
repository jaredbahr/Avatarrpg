import sys; from PIL import Image
fs=sys.argv[2:]; ims=[]
for f in fs:
    im=Image.open(f).convert('RGBA'); ims.append(im.crop(im.getbbox()))
W=sum(i.width for i in ims)+10*(len(ims)+1); H=max(i.height for i in ims)+20
c=Image.new('RGBA',(W,H),(110,150,90,255)); x=10
for i in ims: c.alpha_composite(i,(x,H-10-i.height)); x+=i.width+10
c=c.resize((c.width*2,c.height*2),Image.NEAREST); c.save(sys.argv[1]); print(c.size)
