from common import *
import sys
seed=int(sys.argv[1]); 
sty=Image.open(D/'s1_first_s11.png').convert('RGBA')
desc=("Detailed pixel art close-up, low camera under a wooden table in a village square paved with pale limestone flagstones, morning light. "
"Dark underside of the table top across the top of the picture and two thick wooden table legs at the far left and far right edges. "
"On the left, a child's slim bare brown leg and ankle in a worn brown cloth shoe with a small green patch, the shin and a rolled-up trouser hem running straight up out of the top of the picture, seen from the side, toe pointing right. "
"To the right of the shoe on the flagstones sits one small shallow round clay bowl, the same kind of bowl as in the reference, with a plain cream linen cloth laid loosely over it, draped with soft folds, no string, no jar, no lid. "
"Hard crisp darker-tone 1 px outlines, hard form shadows, warm ochre cream and wood palette like the reference, careful hand-placed shading. No text, no faces. Every pixel deliberate, no blur.")
e,r=pl.run('/create-image-pro-flash',{'description':desc,'image_size':{'width':W,'height':H},'no_background':False,'seed':seed,
 'style_image':{'image':pl.b64(sty),'size':{'width':W,'height':H},'usage_description':'colour palette, outline, the shape of the shallow clay bowls and pixel rendering style only, not the composition'}},
 f'cut2_s2_first_s{seed}','cutscene trial v2 shot2 first frame',estimate=6,region='cutscene_trial')
ims=getimgs(r); ims[0].save(D/f'v2_s2_first_s{seed}.png')
ims[0].convert('RGB').resize((768,432),Image.NEAREST).save(D/f'vv2_{seed}.png')
