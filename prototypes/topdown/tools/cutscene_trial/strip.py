import sys
from PIL import Image, ImageChops
import numpy as np
d=sys.argv[1]; idx=[int(x) for x in sys.argv[2].split(',')]; sc=int(sys.argv[3]) if len(sys.argv)>3 else 2
fs=[Image.open(f'{d}/{i:02d}.png').convert('RGB') for i in idx]
w,h=fs[0].size
cols=2; rows=(len(fs)+1)//2
sh=Image.new('RGB',(w*sc*cols,h*sc*rows))
for k,f in enumerate(fs): sh.paste(f.resize((w*sc,h*sc),Image.NEAREST),((k%cols)*w*sc,(k//cols)*h*sc))
sh.save(f'{d}_strip.png')
a=[np.array(Image.open(f'{d}/{i:02d}.png').convert('RGB')).astype(int) for i in range(len(__import__('os').listdir(d)))]
print('mean abs diff vs frame0:',[round(float(abs(x-a[0]).mean()),2) for x in a])
print('mean abs diff consecutive:',[round(float(abs(a[i+1]-a[i]).mean()),2) for i in range(len(a)-1)])
