import os
from PIL import Image
from pl import *; from tiles import edit_tiled, plan; from style import *
I=f'{RA}/inputs'
G=(945,0,3105,1320)
q=Image.open(f'{os.environ.get("BA_DAN_WORK", ".review/regions")}/quiet.png').convert('RGB').crop(G)
qw=q.resize((1440,880),Image.LANCZOS); qw.save(f'{I}/ground-world.png'); print(plan(1440,880,512,48))
GROUND=('Walkable ground stays calm: grass, paving stones, the canal water and its stone banks are broad flat areas of 3-4 tones with only sparse 1-2 px marks; '
        'no all-over noise or stipple. No people.')
def txt(img,w,h): return ('/edit-images-v2',{'method':'edit_with_text','edit_images':[{'image':img,'width':w,'height':h}],'image_size':{'width':w,'height':h},
   'description':'Redraw as '+STYLE+'. '+GROUND+' '+KEEP,'seed':11})
out=edit_tiled(qw,'a2-ground',txt,{},'slice ground composition at world px, text edit, from the shipped (quiet) painting; crop painting x 945..3105 y 0..1320',min_ov=48,workers=6)
out.save(f'{RA}/jobs/a2-ground-stitched.png')
