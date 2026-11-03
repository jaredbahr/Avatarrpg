from PIL import Image
from pl import *; from tiles import edit_tiled; from style import *
from concurrent.futures import ThreadPoolExecutor
I=f'{RA}/inputs'
party,pp=b64(f'{I}/party-style.png'); refs={pp:'inputs/party-style.png'}
src10=Image.open(f'{I}/gao-crop-paint.png').convert('RGB')
src13=Image.open(f'{I}/gao-crop-x133.png').convert('RGB')
def ref(img,w,h): return ('/edit-images-v2',{'method':'edit_with_reference','edit_images':[{'image':img,'width':w,'height':h}],'image_size':{'width':w,'height':h},
   'reference_image':{'image':party,'width':300,'height':121},'description':KEEP+' '+STYLE,'seed':11})
def txt(img,w,h): return ('/edit-images-v2',{'method':'edit_with_text','edit_images':[{'image':img,'width':w,'height':h}],'image_size':{'width':w,'height':h},
   'description':'Redraw as '+STYLE+'. '+KEEP,'seed':11})
jobs=[(src10,'p2-gao-ref10',ref,'editref at painting res (1 gen px = 1 screen px)'),
      (src13,'p2-gao-ref13',ref,'editref at 4/3 painting res (figure density), downsample after'),
      (src10,'p2-gao-txt10',txt,'edittext at painting res')]
def go(j):
  out=edit_tiled(j[0],j[1],j[2],refs,j[3],workers=2); out.save(f'{RA}/jobs/{j[1]}-stitched.png'); return j[1]
with ThreadPoolExecutor(3) as ex: print(list(ex.map(go,jobs)))
