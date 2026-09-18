# Art references

These sources are tracked for art iteration and excluded from the game's
download and offline cache because they live outside `public/`.

- `character-poses/`: original six-pose hero sheets and the Kaya/Sura village
  walk/wave intermediates.
- `character-locomotion/`: original hero combat cels plus front/back idle and
  walk cels, before lateral walks were appended.
- `pose-guides/`: original diagrams used to describe motion to the image tool.

The active hero sheets are `public/art/units/walking-{name}.{png,json}`.
See `docs/art/side-walks.md` and `docs/art/directional-character-walks.md` for
the packing order and compatibility checks. No reference PNG is a runtime URL.
