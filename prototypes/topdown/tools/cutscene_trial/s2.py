from common import *
import sys
seed=int(sys.argv[1]); 
sty=Image.open(D/'s1_first_s11.png').convert('RGBA')
desc=("Detailed pixel art close-up, low camera under a wooden table in a village square paved with pale limestone flagstones, morning light. "
"The dark underside of the table top and two thick wooden table legs frame the picture, warm light coming in from the left. "
"In the middle of the ground, a small child's worn brown cloth shoe with a green patch on a small brown ankle, seen from the side, toe pointing right toward a round clay bowl "
"completely covered with a plain cream linen cloth tied with string, sitting on the flagstones just in front of the shoe. "
"Hard crisp darker-tone 1 px outlines, hard form shadows, warm ochre cream and wood palette like the reference, careful hand-placed shading. No text, no other people. Every pixel deliberate, no blur.")
e,r=pl.run('/create-image-pro-flash',{'description':desc,'image_size':{'width':W,'height':H},'no_background':False,'seed':seed,
 'style_image':{'image':pl.b64(sty),'size':{'width':W,'height':H},'usage_description':'colour palette, outline and pixel rendering style only, not the composition'}},
 f'cut_s2_first_s{seed}','cutscene trial shot2 first frame',estimate=6,region='cutscene_trial')
ims=getimgs(r); ims[0].save(D/f's2_first_s{seed}.png'); print(len(ims),ims[0].size)
ims[0].convert('RGB').resize((768,432),Image.NEAREST).save(D/'v2.png')
print('tally',tally())
