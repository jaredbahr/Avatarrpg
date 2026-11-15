from common import *
import sys
seed=int(sys.argv[1]); 
sty=Image.open(D/'v2_s2_first_s11.png').convert('RGBA')
desc=("Detailed pixel art close-up, side view from table height. A long wooden table top fills the bottom of the picture. "
"On the table four small shallow round clay bowls stand in an even row, all in the left two thirds of the picture, and the right third of the table top is completely empty. "
"Above that empty space on the right, an old woman's two wrinkled brown hands (five fingers each) hold one more small shallow clay bowl of the same kind, covered with a plain cream linen cloth laid loosely over it, lifted a little above the table. "
"Her sleeves are a green shawl edged with a yellow band, coming in from the right edge of the picture. "
"Pale limestone block wall behind, morning light from the upper left. Hard crisp darker-tone 1 px outlines, hard form shadows, warm ochre cream wood and green palette like the reference, careful hand-placed shading. No face, no text, no string. Every pixel deliberate, no blur.")
e,r=pl.run('/create-image-pro-flash',{'description':desc,'image_size':{'width':W,'height':H},'no_background':False,'seed':seed,
 'style_image':{'image':pl.b64(sty),'size':{'width':W,'height':H},'usage_description':'colour palette, outline, the shallow clay bowl, the cloth over a bowl and pixel rendering style, not the composition'}},
 f'cut2_s3_first_s{seed}','cutscene trial v2 shot3 first frame',estimate=6,region='cutscene_trial')
ims=getimgs(r); ims[0].save(D/f'v2_s3_first_s{seed}.png')
ims[0].convert('RGB').resize((768,432),Image.NEAREST).save(D/f'vv3_{seed}.png')
