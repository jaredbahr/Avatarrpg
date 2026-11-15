import numpy as np, subprocess, shutil, os
from PIL import Image
from PIL import ImageFilter
D='.'
def load(d,n=13): return [Image.open(f'{d}/{i:02d}.png').convert('RGB') for i in range(n)]
# shot 1: crisp plate + animated steam only
s1=load('a1_mm12_s11'); plate=np.array(s1[0]).astype(int)
arr=np.stack([np.array(f).astype(int) for f in s1[1:]]); med=np.median(arr,axis=0)
out1=[s1[0]]
for f in s1[1:]:
    a=np.array(f).astype(int)
    m=(abs(a-med).max(axis=2)>30)
    m=np.array(Image.fromarray((m*255).astype('uint8')).filter(ImageFilter.MaxFilter(5)))>0
    # steam is light/low-saturation pixels: keep only changed pixels that moved, composite over the plate
    o=np.where(m[...,None],a,plate); out1.append(Image.fromarray(o.astype('uint8')))
sh1=out1+out1[11:0:-1]+out1[:7]          # 13+11+7 = 31
sh1=sh1[:24+0] if False else sh1
sh2=load('a2_mm12_s5'); seq2=[sh2[0]]*4+sh2+[sh2[-1]]*8
sh3=load('a3_mm12_s7'); seq3=[sh3[0]]*4+sh3+[sh3[-1]]*8
seq=sh1[:24]+seq2+seq3
print(len(sh1[:24]),len(seq2),len(seq3),len(seq))
os.makedirs('final',exist_ok=True)
S=4
big=[f.resize((f.width*S,f.height*S),Image.NEAREST) for f in seq]
for i,f in enumerate(big): f.save(f'final/{i:03d}.png')
# gif with a shared palette
mont=Image.new('RGB',(192*8,108*4))
for k,f in enumerate(seq[::max(1,len(seq)//32)][:32]): mont.paste(f,((k%8)*192,(k//8)*108))
pal=mont.quantize(256,method=Image.MEDIANCUT,dither=Image.NONE)
g=[f.quantize(palette=pal,dither=Image.NONE) for f in big]
g[0].save('cutscene_trial.gif',save_all=True,append_images=g[1:],duration=125,loop=0,optimize=False,disposal=1)
subprocess.run(['ffmpeg','-y','-loglevel','error','-framerate','8','-i','final/%03d.png','-vf','fps=24,format=yuv420p','-c:v','libx264','-crf','12','cutscene_trial.mp4'],check=True)
# contact sheet at 3x: 4 frames per shot
rows=[(sh1[:24],[0,6,12,18]),(seq2,[0,6,10,16]),(seq3,[0,7,12,18])]
cs=Image.new('RGB',(192*3*4+30,108*3*3+20),(20,20,20))
for r,(fs,ix) in enumerate(rows):
    for c,i in enumerate(ix):
        cs.paste(fs[min(i,len(fs)-1)].resize((576,324),Image.NEAREST),(c*(576+10),r*(324+10)))
cs.save('contact_sheet.png'); print(cs.size)
