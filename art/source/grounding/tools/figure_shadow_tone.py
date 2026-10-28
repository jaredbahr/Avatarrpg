"""Fit the runtime shadow ink and levels to Ba Dan's painted shadow tone (ADR 0093's figure amendment).

The painting multiplies the ground under an object's cast by `SHADOW * COOL` and under its contact line by
`CONTACT * COOL` (`ba-dan-route-a/tools/objects.py`). The runtime lays an ink over the ground at a level instead:
`ground * (1 - a) + ink * a`. This finds the one ink and the two levels (cast, contact) that best land on the
painting's multiply over the ground its shadows actually fall on (the polish master's pixels the grounded master
darkened), and prints them with the fit's error. Run from the repository root:

    python3 -I art/source/grounding/tools/figure_shadow_tone.py
"""
import numpy as np
from PIL import Image

WORLD = 'art/source/ba-dan-route-a/world/'
SHADOW, CONTACT = 0.70, 0.50  # objects.py
COOL = np.array([0.93, 0.96, 1.06])  # objects.py


def main():
    grounded = np.asarray(Image.open(WORLD + 'world-g1-grounded.png').convert('RGB')).astype(float)
    polish = np.asarray(Image.open(WORLD + 'world-g1-polish.png').convert('RGB')).astype(float)
    shaded = (grounded.sum(2) < polish.sum(2) - 6) & (polish.max(2) > 60)
    ground = polish[shaded]
    ratio = np.median(grounded[shaded] / np.maximum(polish[shaded], 1), 0)
    print(f'painted shadow pixels {shaded.sum()}, median ratio {np.round(ratio, 3)}')
    cast_m, contact_m = SHADOW * COOL, CONTACT * COOL
    best = None
    for a in np.arange(0.30, 0.45, 0.005):
        for b in np.arange(0.45, 0.65, 0.005):
            # Least squares over both sets: ground * (1 - a) + ink * a = ground * m, solved for the ink.
            alpha = np.concatenate([np.full(len(ground), a), np.full(len(ground), b)])
            target = np.concatenate([ground * (cast_m - 1 + a), ground * (contact_m - 1 + b)])
            ink = np.clip((alpha[:, None] * target).sum(0) / (alpha ** 2).sum(), 0, 255)
            err = ((alpha[:, None] * np.round(ink) - target) ** 2).mean()
            if best is None or err < best[0]:
                best = (err, a, b, np.round(ink))
    err, a, b, ink = best
    print(f'cast {a:.3f}, contact {b:.3f}, ink {ink.astype(int).tolist()}, rmse {err ** 0.5:.2f} levels')
    mean = ground.mean(0)
    print(f'mean ground {np.round(mean, 1).tolist()}: cast ratio {np.round((mean * (1 - a) + ink * a) / mean, 3)}, '
          f'contact ratio {np.round((mean * (1 - b) + ink * b) / mean, 3)}')


if __name__ == '__main__':
    main()
