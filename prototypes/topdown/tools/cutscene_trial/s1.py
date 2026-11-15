from common import *
import sys
seed=int(sys.argv[1]); 
sty=Image.open('/home/user/Avatarrpg/public/art/portraits/mira.png').convert('RGBA').crop((0,50,160,110))
desc=("Detailed pixel art, top-down three-quarter view of a plain wooden outdoor table in a village square paved with pale limestone, early morning light from the upper left. "
"Four empty round clay bowls set out in a neat row on the table, with a thin wisp of steam rising from them, a wooden bench behind, hard crisp darker-tone 1 px outlines, hard form shadows, "
"warm green and cream and ochre palette of about 48 colours, careful hand-placed shading, selective dithering. No people, no text. Every pixel deliberate, no blur.")
e,r=pl.run('/create-image-pro-flash',{'description':desc,'image_size':{'width':W,'height':H},'no_background':False,'seed':seed,
 'style_image':{'image':pl.b64(sty),'size':{'width':160,'height':60},'usage_description':'colour palette and pixel rendering style only'}},
 f'cut_s1_first_s{seed}','cutscene trial shot1 first frame',estimate=6,region='cutscene_trial')
for i,im in enumerate(getimgs(r)): im.save(D/f's1_first_s{seed}.png'); print(im.size)
print('tally',tally())
