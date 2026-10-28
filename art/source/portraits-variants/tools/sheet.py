"""review/sheet.png: one row per character, columns grouped by route. Neutral is the shipped portrait; A the chosen
expressions (picks.json); B is empty (not sampled, cost); C the 128 px reduction at 2x nearest (256 px, as the 512s
are shown at half size). Also review/faces-2x.png: each A face crop beside the shipped one at 2x nearest."""
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
HERE = Path(__file__).resolve().parent.parent; ROOT = HERE.parents[2]
cast = json.load(open(HERE / 'tools' / 'cast.json')); picks = json.load(open(HERE / 'picks.json'))
F = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
font, big = ImageFont.truetype(F, 18), ImageFont.truetype(F, 24)
T, PAD, HEAD, LAB = 256, 16, 70, 120
chars = ['kaya', 'mira', 'thug']; nA = 2
cols = [('Neutral (shipped)', 1), ('Route A: expressions', nA), ('Route B: pose', 1), ('Route C: pixel 128', 1)]
W = LAB + sum(n for _, n in cols) * (T + PAD) + PAD; H = HEAD + len(chars) * (T + 40) + PAD
sheet = Image.new('RGB', (W, H), (40, 34, 30)); d = ImageDraw.Draw(sheet)
x = LAB
for title, n in cols:
    d.text((x, 14), title, font=big, fill=(240, 228, 210)); x += n * (T + PAD)
def tile(im, x, y, label):
    sheet.paste(im, (x, y)); d.text((x, y + T + 6), label, font=font, fill=(220, 210, 195))
def empty(x, y, text):
    d.rectangle([x, y, x + T - 1, y + T - 1], outline=(110, 98, 88), width=2)
    for i, line in enumerate(text.split('\n')): d.text((x + 16, y + 100 + i * 24), line, font=font, fill=(160, 150, 140))
for r, ch in enumerate(chars):
    y = HEAD + r * (T + 40); d.text((PAD, y + T // 2 - 12), ch.capitalize(), font=big, fill=(240, 228, 210))
    src = Image.open(ROOT / 'public/art/portraits' / cast[ch]['file']).convert('RGB')
    x = LAB; tile(src.resize((T, T), Image.LANCZOS), x, y, 'neutral'); x += T + PAD
    moods = [k.split('.')[1] for k in picks if k.startswith(ch + '.')]
    for i in range(nA):
        if i < len(moods): tile(Image.open(HERE / 'out' / f'{ch}.{moods[i]}.png').convert('RGB').resize((T, T), Image.LANCZOS), x, y, moods[i])
        else: empty(x, y, 'not sampled\n(credit cap)')
        x += T + PAD
    empty(x, y, 'not sampled:\nneeds a full 512\nredraw, est. 25+ gens'); x += T + PAD
    tile(Image.open(HERE / 'out' / f'{ch}.c128.png').resize((T, T), Image.NEAREST), x, y, 'scripted reduction, 2x')
sheet.save(HERE / 'review' / 'sheet.png')
# faces at 2x nearest: shipped crop | variant crop
rows = []
for key in picks:
    ch, mood = key.split('.'); x0, y0, n = cast[ch]['moods'][mood]['crop']
    a = Image.open(ROOT / 'public/art/portraits' / cast[ch]['file']).convert('RGB').crop((x0, y0, x0 + 192, y0 + 192))
    b = Image.open(HERE / 'out' / f'{ch}.{mood}.png').convert('RGB').crop((x0, y0, x0 + 192, y0 + 192))
    rows.append((key, a.resize((384, 384), Image.NEAREST), b.resize((384, 384), Image.NEAREST)))
faces = Image.new('RGB', (2 * 384 + 3 * PAD, len(rows) * (384 + 36) + PAD), (40, 34, 30)); fd = ImageDraw.Draw(faces)
for i, (key, a, b) in enumerate(rows):
    y = PAD + i * (384 + 36); faces.paste(a, (PAD, y)); faces.paste(b, (2 * PAD + 384, y))
    fd.text((PAD, y + 388), f'{key}: shipped | variant (2x nearest)', font=font, fill=(220, 210, 195))
faces.save(HERE / 'review' / 'faces-2x.png'); print('ok')
