import os
from PIL import Image
from pl import *; from tiles import edit_tiled, plan; from style import *
from concurrent.futures import ThreadPoolExecutor
I=f'{RA}/inputs'
party,pp=b64(f'{I}/party-style.png'); refs={pp:'inputs/party-style.png'}
SLICE=(840,0,3220,1320)
q=Image.open(f'{os.environ.get("BA_DAN_WORK", ".review/regions")}/quiet.png').convert('RGB').crop(SLICE)
q.save(f'{I}/slice-paint.png'); qw=q.resize((round(q.width/1.5),round(q.height/1.5)),Image.LANCZOS); qw.save(f'{I}/slice-world.png')
print(qw.size, plan(*qw.size))
f=Image.open(f'{os.environ.get("BA_DAN_WORK", ".review/regions")}/faded.png').convert('RGB')
tb=(1578,228,2058,696); t=f.crop(tb); t.save(f'{I}/tree-crop-paint.png'); tw=t.resize((320,312),Image.LANCZOS); tw.save(f'{I}/tree-crop-world.png')
GROUND=('Walkable ground stays calm: grass, paving stones, the canal and its banks are broad flat areas of 3-4 tones with only sparse 1-2 px marks; '
        'no all-over noise or stipple.')
def ref(desc):
  return lambda img,w,h: ('/edit-images-v2',{'method':'edit_with_reference','edit_images':[{'image':img,'width':w,'height':h}],'image_size':{'width':w,'height':h},
   'reference_image':{'image':party,'width':300,'height':121},'description':desc,'seed':11})
def slice_pass():
  out=edit_tiled(qw,'a1-slice',ref(KEEP+' '+STYLE+'. '+GROUND),refs,'slice ground composition at world px from the shipped (quiet) painting',workers=4)
  out.save(f'{RA}/jobs/a1-slice-stitched.png')
def tree(seed):
  img,h=b64(tw); r=dict(refs); r[h]='inputs/tree-crop-world.png'
  p=ref(KEEP+' A broad canopy tree with a gnarled trunk. '+STYLE+'. Leaves as clustered masses of 3-4 greens with a few 1-2 px leaf marks at the lit edge, no all-over noise.')(img,320,312)
  p[1]['seed']=seed
  run(*p,f'a1-tree-s{seed}',r,'canopy tree (tree-5-5) at world px')
with ThreadPoolExecutor(3) as ex:
  fs=[ex.submit(slice_pass),ex.submit(tree,11),ex.submit(tree,23)]
  for x in fs: x.result()
