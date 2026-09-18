# Hand anatomy review — 2026-09-18

Reviewed the shipping art on `main` at
`3ca63b41725122bad06c55ad9f2d27c82f339ba3`: all 16 portraits, 24 combat and
locomotion atlases, and seven illustrated interludes. Portraits were inspected
at native resolution and hand close-ups; casting poses were enlarged to check
wrist continuity and hand silhouettes. Small sprite hands, closed fists and
occluded fingers were not treated as missing digits solely because their
individual fingers cannot be resolved at delivery size.

## Corrections

| Portrait | Correction                                                                        | Identity and gesture retained                                                   |
| -------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Bo       | Restore the fourth finger to the cupped right hand.                               | Floating stone, broad hand, mustard sleeve and brown wraps.                     |
| Jinu     | Replace the tangled finger arrangement with a readable right hand.                | Playful two-finger leaf gesture and relaxed arm.                                |
| Kaya     | Give the left hand four fingers and a thumb, with a consistent back-of-hand view. | Curved fire-controlling gesture, flame and gold-trimmed cuff.                   |
| Linmei   | Add the missing thumb and clarify its separation from the four fingers.           | Pebble balanced on the back of the left hand and original vertical wrist wraps. |
| Nima     | Correct the left palm's thumb side and show the two curled fingers.               | Two raised fingers, air spiral and brown wraps.                                 |
| Riko     | Correct the right palm's handedness.                                              | Paired upright index/middle fingers and wrapped wrist.                          |
| Sura     | Restore a distinct right thumb beside four spread fingers.                        | Ice crystals on the back of the right hand.                                     |
| Tenzo    | Separate all four fingers from the thumb in the cupped left hand.                 | Flame, palm-up gesture and red cuff.                                            |

The other eight portraits and the reviewed sprite/interlude assets had no
additional hand defect clear enough at their shipping resolution to justify a
replacement in this pass. This is a visual review, not an automated anatomy
certification. No animation frames, atlas coordinates, character identities,
story content or rendering contracts changed.

## Editing and integration

Corrections use the built-in image editing tool, with the existing portrait or
an enlarged crop as its edit target. Full-portrait attempts that repeated a
defect were rejected. The final hand regions were fitted into the original
512 × 512 portraits; surrounding faces and composition were retained. Wrist
and sleeve joins were inspected after compositing. The runtime continues to
load the same eight `public/art/portraits/<name>.png` paths.

Common edit brief:

> Repair only the hand anatomy. Preserve the established face, expression,
> hairstyle, proportions, costume, palette, dark-brown ink, cel shading,
> background, elemental motif and framing. Four fingers plus one opposable
> thumb; correct anatomical arm, palm/back orientation, finger joints and
> wrist connection. No character redesign, added props, labels or effects.

Final localized instructions:

- **Bo:** add the missing fourth curved finger; retain the thumb at image-left
  and the cupped right palm. Show fingertip pads rather than fingernails on the
  palm side.
- **Jinu:** anatomical right hand; index and middle gracefully raised, ring
  and little curled, single opposable thumb on the correct radial side.
- **Kaya:** back of the anatomical left hand; thumb on image-left, index
  curved toward it, with distinct middle, ring and little fingers beyond it.
- **Linmei:** add only the near-side left thumb. Retain all four fingers, the
  pebble and the wrist emerging upward from the original vertical green wraps.
- **Nima:** anatomical left palm; thumb on the outer image-right side, index
  and middle raised, ring and little curled visibly into the palm.
- **Riko:** mirror only the erroneous hand orientation. Right palm with the
  thumb rooted at image-left, raised index and middle beside it, curled ring
  and little toward image-right. Retain the cuff location.
- **Sura:** back of the anatomical right hand; four distinct fingers with a
  separate thumb on the inner image-right side, preserving the ice crystals.
- **Tenzo:** restore the fourth curved fingertip along the image-right side
  of the cupped left hand, keeping the separate upper-left thumb and flame.

The art bible and shared review checklist now explicitly require digit count,
handedness, palm/back consistency, wrist continuity, and checks at both source
and game size. These remain visual checks; the asset validator verifies file
and atlas compatibility rather than hand anatomy.
