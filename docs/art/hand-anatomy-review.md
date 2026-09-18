# Hand anatomy review — 2026-09-18

The initial review covered 16 portraits, 24 combat and locomotion atlases, and
seven interlude paintings on `3ca63b41725122bad06c55ad9f2d27c82f339ba3`.
That pass changed eight portraits, but its visual acceptance was insufficient:
Jared identified a poor earth pose, malformed fingers, and reversed hands in
four of the delivered portraits. The earlier per-hand descriptions are
superseded by this follow-up.

This revision starts from `74db30a192950c58b40e9fade71c12961b3f6afa` and changes
Linmei, Jinu, Nima and Sura from that feedback. Rechecking the earlier edits
also exposed the same handedness error in Bo, Kaya and Riko, so those three
are corrected in this revision as well. Their prompt packs are updated too.

## Corrected poses

| Portrait | Anatomical hand and view                                          | Correction                                                                                                                                                                                                             |
| -------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bo       | Right palm; raised arm on image-left                              | Replace the reversed cupped hand with an open-palm casting pose. Four naturally graduated fingers, an image-right thumb, and the stone hovering clear above them.                                                      |
| Kaya     | Left palm; raised arm on image-right                              | Replace dorsal marks with palm creases and fingertip pads. The thumb is on image-left and four naturally curved fingers guide the flame.                                                                               |
| Riko     | Right palm; raised arm on image-left                              | Reverse the incorrect thumb/finger layout: index and middle raised, ring and little curled on image-left, thumb from image-right.                                                                                      |
| Linmei   | Left fist, palm side toward the viewer; raised arm on image-right | Replace the drooping pebble-balancing pose with a straight wrist and an upright fist. Four fingers curl together; the thumb crosses them from image-left. A small stone floats above the fist.                         |
| Jinu     | Right palm; raised arm on image-left                              | Two raised fingers, two separately curled fingers, and a thumb rooted on image-right. The index is beside the thumb; the middle is the other raised finger.                                                            |
| Nima     | Left palm; raised arm on image-right                              | Move the thumb to image-left and the curled ring/little fingers to image-right. Retain the two-finger wind gesture.                                                                                                    |
| Sura     | Right palm; raised arm on image-left                              | Replace the contradictory dorsal marks with a coherent palm view. Four spread fingers and an image-right thumb; middle longest, index and ring of comparable length, little shortest. Ice floats clear of the fingers. |

Handedness is checked from the character's shoulder through the elbow and
wrist. The screen side occupied by an arm is not the hand's anatomical name.
The upright-hand table in `prompts/_style.md` records the palm/back distinction
that the first pass mishandled.

## Edit briefs and integration

The built-in image editing tool generated each replacement from its existing
portrait. The shared brief was:

> Redraw only the specified hand and forearm. Preserve the face, expression,
> hairstyle, costume design, elemental motif, dark-brown outlines, cel shading,
> warm palette, parchment background and framing. Trace the hand to its own
> arm. Show four fingers and one opposable thumb with natural joints, lengths,
> palm/back markings and wrist alignment. No character redesign or new props.

Individual pose instructions:

- **Bo:** right palm facing the viewer in a broad open casting gesture,
  image-right thumb, middle finger longest and little shortest, rock floating
  above the fingertips. Rejected cupped-hand variants with poor finger lengths.
- **Kaya:** left palm toward the viewer, image-left thumb, four gently curved
  fingers with palm-side markings, same flame and red/gold cuff.
- **Riko:** right palm, index and middle raised together, ring and little
  separately curled on image-left, thumb from image-right, same grey wraps.

- **Linmei:** a naturally closed left fist, palm side toward the viewer,
  thumb from image-left across the folded fingers, straight wrist in the
  olive wraps, small angular stone hovering above it.
- **Jinu:** right palm, index and middle raised in a relaxed V, ring and
  little curled separately on image-left, thumb from image-right across them;
  retain the leaves and air arc.
- **Nima:** left palm, index and middle raised, ring and little curled on
  image-right, thumb from image-left across them; retain the white wind spiral.
- **Sura:** right palm with four spread fingers and an image-right thumb,
  palm creases and fingertip pads, natural graduated lengths, ice clear of
  the digits. A follow-up edit lengthened an initially short index finger.

Only the revised hand/arm regions are composited into the original portraits.
The final assets remain 512 × 512 PNGs at the same seven
`public/art/portraits/<name>.png` paths. They retain the established colors
without forcing the new art into the old indexed palette, which introduced
visible speckling during review. Faces are preserved from the original files.

## Acceptance

- Inspect the full portrait and enlarged hand, including every curled digit.
- Confirm thumb side, palm/back markings, finger lengths and wrist continuity.
- Compare the original and replacement for identity, costume and style.
- Inspect the circular game crop and the captured party/battle presentation.
- Run the repository verification, art validation and asset budgets. These
  checks establish compatibility; they do not establish anatomical correctness.

No animation atlas, gameplay, character identity or story change is included.
