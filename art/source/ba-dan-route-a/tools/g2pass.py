import os
from PIL import Image
from concurrent.futures import ThreadPoolExecutor
from pl import *; from style import *; from tiles import plan, stitch
from figures import frame
I=f'{RA}/inputs'; reg=os.environ.get('BA_DAN_WORK', f'{RA}/../regions')
f=Image.open(f'{reg}/faded.png').convert('RGB'); q=Image.open(f'{reg}/quiet.png').convert('RGB')
G=(945,0,3105,1320)
gw=q.crop(G).resize((720,440),Image.LANCZOS); gw.save(f'{I}/g2-ground.png')
tw=f.crop((1578,228,2058,696)).resize((160,156),Image.LANCZOS); tw.save(f'{I}/g2-tree.png')
FIG=[('kaya','walkSouthWest',3),('bo','idleSouthEast',0),('sura','idleNorthWest',0)]
def flash(img_pil, tag, desc, note, nobg=False):
    img,h=b64(img_pil); return run('/edit-image-pro-flash',{'image':img,'method':'text','description':desc,'no_background':nobg,'seed':11},tag,{h:note},note)
jobs=[]
for i,(x,y,w,h) in enumerate(plan(720,440,256,32)):
    jobs.append((gw.crop((x,y,x+w,y+h)),f'g2-ground-t{i}','Redraw as '+STYLE_G2+'. No people. '+KEEP,f'G2 ground tile {i} at ({x},{y},{w}x{h}) of inputs/g2-ground.png',False))
jobs.append((tw,'g2-tree','Redraw as '+STYLE_G2+'. A broad canopy tree, leaves as clustered masses of 3 greens. '+KEEP,'G2 canopy tree, inputs/g2-tree.png',False))
for n,c,k in FIG:
    fr=frame(n,c,k).resize((32,48),Image.BOX); fr.save(f'{I}/g2-{n}.png')
    jobs.append((fr,f'g2-fig-{n}',('Clean up this tiny character sprite into crisp pixel art at this exact size: keep the same person, pose, costume colours, hair and facing; '
      '1 px dark brown outline (#1b1410), 2-3 tones per material, light from the upper left, transparent background.'),f'G2 figure {n} {c}/{k} box-downsampled 4:1',True))
with ThreadPoolExecutor(6) as ex: list(ex.map(lambda j: flash(*j), jobs))
print(plan(720,440,256,32))
