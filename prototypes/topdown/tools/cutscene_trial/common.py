import sys; sys.path.insert(0,'/home/user/Avatarrpg/prototypes/topdown/tools')
import pl
from PIL import Image
from pathlib import Path
W,H=192,108
D=Path(__file__).parent
START=5711.0345359375
def tally(): return round(pl.spent()-START,2)
def getimgs(r):
    lr=r['final'].get('last_response') or r['final']; ims=[]; pl.images(lr,ims)
    if not ims:
        for k in ('image_url','url'):
            if lr.get(k): ims.append(pl.fetch(lr[k]))
    return ims
