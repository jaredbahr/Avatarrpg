from common import *
import sys
seed=int(sys.argv[1]); 
sty=Image.open(D/'s2_first_s11.png').convert('RGBA')
desc=("Detailed pixel art close-up, side view from table height, of an old woman's two wrinkled brown hands with thin fingers (five fingers each) lifting a round clay bowl completely covered with a cream linen cloth tied with string, "
"holding it just above a wooden table. Her sleeves are a green shawl edged with a yellow band, coming in from the right edge of the picture. "
"On the wooden table top, four empty round clay bowls stand in a row to the left, and the lifted covered bowl is about to be set down as the fifth beside them. "
"Pale limestone square behind, morning light from the upper left. Hard crisp darker-tone 1 px outlines, hard form shadows, warm ochre cream wood and green palette like the reference, careful hand-placed shading. No face, no text. Every pixel deliberate, no blur.")
e,r=pl.run('/create-image-pro-flash',{'description':desc,'image_size':{'width':W,'height':H},'no_background':False,'seed':seed,
 'style_image':{'image':pl.b64(sty),'size':{'width':W,'height':H},'usage_description':'colour palette, outline, the cloth-covered bowl and pixel rendering style, not the composition'}},
 f'cut_s3_first_s{seed}','cutscene trial shot3 first frame',estimate=6,region='cutscene_trial')
ims=getimgs(r); ims[0].save(D/f's3_first_s{seed}.png'); print(len(ims),ims[0].size)
ims[0].convert('RGB').resize((768,432),Image.NEAREST).save(D/f'v3_{seed}.png')
print('tally',tally())
