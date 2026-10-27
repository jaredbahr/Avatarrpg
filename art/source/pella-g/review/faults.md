# pella G review: measured flags

- south idle: boiling, 38% of head/torso pixels change between cels (gate 20%; Kaya measures 8-17%)
- south-east idle: boiling, 33% of head/torso pixels change between cels (gate 20%; Kaya measures 8-17%)
- east idle: boiling, 25% of head/torso pixels change between cels (gate 20%; Kaya measures 8-17%)
- north-east idle: boiling, 28% of head/torso pixels change between cels (gate 20%; Kaya measures 8-17%)
- north idle: boiling, 21% of head/torso pixels change between cels (gate 20%; Kaya measures 8-17%)
- north-west idle: boiling, 29% of head/torso pixels change between cels (gate 20%; Kaya measures 8-17%)
- west idle: boiling, 24% of head/torso pixels change between cels (gate 20%; Kaya measures 8-17%)
- south-west idle: boiling, 29% of head/torso pixels change between cels (gate 20%; Kaya measures 8-17%)

## Eye review

Flags the gates cannot see, from the sheets at game scale and 3x.

- Rotations: three takes on two models drew detached strokes or swooshes above her head; the used set is the v3 take with detached blobs removed by clean.py (rotations/clean.json lists the pixels dropped). Nothing touching her was changed.
- Identity drift: south and diagonals hug the cabbage; east, west, north-east and north-west hold it out in front.
- Idle boil 21-38%, the worst of the six (small figure, dense detail); quieter motion (idle-still s8503) and an 8-cel take (idle8 s8504) did not lower it, so the 0.6x takes stand.
- Height 113 px in the 192 canvas (59%), on her established ~58%.
