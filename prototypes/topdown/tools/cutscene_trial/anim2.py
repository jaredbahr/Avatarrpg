from common import *
import sys,os
name,first,n,seed,act=sys.argv[1:6]; n=int(n); seed=int(seed)
fr=Image.open(D/first).convert('RGBA')
p={'first_frame':pl.b64(fr),'description':act,'frame_count':n,'seed':seed,'no_background':False,'view':sys.argv[6] if len(sys.argv)>6 else 'side'}
if len(sys.argv)>7: p['direction']=sys.argv[7]
e,r=pl.run('/animate-pixminimax',p,name,'cutscene trial v2',estimate=5,region='cutscene_trial')
ims=getimgs(r); (D/name).mkdir(exist_ok=True)
for i,im in enumerate(ims): im.save(D/name/f'{i:02d}.png')
print(len(ims))
