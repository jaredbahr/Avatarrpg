# Cutting character art handoff

Owner: `quarry_composition`; integration remains with the lead.
Branch: `codex/cutting-character-art`, based on combined `492da8f`.
Runtime/art checkpoint: `dbd0808`. No push, PR or CI was started.

## Result and scope

Ruon, blade mercenary and sergeant now use illustrated nine-pose sheets with
distinct two-frame walking contacts and explicit melee aliases. Ruon follows his
approved portrait; enemy armor and rank distinctions follow the existing faction.
Original source PNGs, exact prompts, source hashes and credits are preserved in
Git. See `docs/art/cutting-characters.md` for deterministic reproduction.

The initial normal-sized frames were too short beside the heroes. Final standing
alpha height is 151 pixels for all three, versus Sura/Kaya's 121 × 1.25 = 151.25
effective pixels. At the reviewed 64-pixel tile zoom this is about 75.5 pixels
head to foot for the new figures and 75.6 for those heroes. Actual Ruon/party
captures show matching adult scale and foot contact. Minimum padded frames are
139×192, 169×199 and 147×203; every pose retains eight clear border pixels.

ADR 0032 records the authorized units-only 4.5 MiB ceiling and explicit optional
`frameSize` metadata. Undeclared sheets keep exact original dimension checks;
declared bounds are checked exactly and capped. Logical footprint, 128 pixels
per tile and 0.5/0.85 anchor remain unchanged. No backend, camera, UI or game-rule
code changed. Existing loading/failure painters remain mapped to blade/sergeant.

## Checks and evidence

- `npm run verify`: 808 tests, typecheck, lint and formatting passed.
- Build and `art:validate` passed; six repacked files have identical SHA-256 on
  a second run. Lossless PNG encoding preserves decoded RGBA.
- Units: 4,715,934 bytes of 4,718,592, leaving 2,658 bytes. New packages total
  540,375 bytes. Other family ceilings remain 4 MiB. Precache is about 17.22 MiB
  of 25 MiB; the generated worker includes all three atlas/PNG pairs.
- Four local art-review cases passed: Canvas/WebGL × normal/reduced motion.
  Exclusive strict port 4239, service workers blocked, exact visible build
  `v0.2.1 · build dbd0808` asserted before capture. The owned server stopped after
  the review. No port 4225 evidence was used.

Evidence root on this host:
`C:/Users/Jared/Documents/ChatGPT/Avatar RPG-cutting-character-art/.shots/cutting-characters-adult/`

Each of `canvas-normal`, `webgl-normal`, `canvas-reduced`, `webgl-reduced` contains:

- `source-build.png` and `provenance.json`: exact build, seed, camera, roster and
  sampled pose data.
- `actual-cutting.png`: natural three-member Cutting view at its default 96 zoom.
- `actual-ruon-64.png`, `actual-merc-64.png`: real focus/zoom controls at 64.
- `actual-sergeant-reinforcement.png`: naturally spawned six-member reinforcement,
  focused at 64; no fabricated combatant.
- `staged-*.png`: separately labelled presentation fixture in the actual Cutting.
  Normal samples 50/150/300/450/650 ms cover walking, 850 wind-up, 1000 release,
  1100 recovery, 1400/1750/2050/2400 settlement. Tests assert both walking cels and
  melee frame 1 were actually sampled for all three actors. Reduced samples at
  80/500 ms show settled poses. This fixture is not legal-combat outcome evidence.

The earlier `.shots/cutting-characters/` directory preserves superseded smaller
figures and fixture iterations; use the `-adult` directory for final assessment.
Walking remains a compact two-pose loop. This closes the three-figure correction,
not whole-route environment, UI, all-enemy scale or full animation acceptance.
