from common import *
import sys, json
# usage: anim.py endpoint name firstpng frames seed "action"
ep,name,first,n,seed,act=sys.argv[1:7]; n=int(n); seed=int(seed)
fr=Image.open(D/first).convert('RGBA')
if ep=='v3':
    p={'first_frame':pl.b64(fr),'action':act,'frame_count':n,'seed':seed,'no_background':False}; path='/animate-with-text-v3'
else:
    p={'first_frame':pl.b64(fr),'description':act,'frame_count':n,'seed':seed,'no_background':False,'view':'side'}; path='/animate-pixminimax'
import os
if os.environ.get('DRIFT'): p['drift_threshold']=float(os.environ['DRIFT'])
e,r=pl.run(path,p,name,'cutscene trial anim',estimate=20,region='cutscene_trial')
ims=getimgs(r); print(len(ims),ims[0].size if ims else None)
(D/name).mkdir(exist_ok=True)
for i,im in enumerate(ims): im.save(D/name/f'{i:02d}.png')
print('tally',tally())
