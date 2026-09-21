# Handoff — Ba Dan exterior apron (v0.2.8 candidate)

Owner: DeepSeek Flash scheduled continuation, 20 September 2026 (session
worktree `C:/Users/Jared/.codex/worktrees/village-outer-apron`, branch
`codex/village-outer-apron`, based on `87c97b3`, the v0.2.6 merge).

## What shipped in this change

The village's authored ground covered the playable diamond and stopped there, so
the outer grass, the eastern plaza and the western road all met the bare page
along the board's diagonal. That is the first thing the Ba Dan reference does
not do. This change adds an authored apron outside the rim:
`public/art/maps/ba-dan-scene/exterior-apron.webp`, packed by
`scripts/art/ba-dan-exterior-apron.ts`, registered last in `BA_DAN_SCENE.ground`,
and documented in [`docs/art/ba-dan-exterior-apron.md`](../../art/ba-dan-exterior-apron.md).

It paints the procedural cells' own terrace colours outside the board, carries
the outer cell's road or paving for about a tile, ramps in grain and recession,
and fades to nothing 2.2 tiles out. Every playable pixel stays untouched: the
art test scans the whole plate and asserts that no sample inside the board, and
none past the fade, carries any alpha.

Also here: `scene.ground`'s schema bound moves 8 → 12 (nine pieces are now
registered; the headroom is the same figure the in-flight
`codex/frame-surround-coverage` branch uses, so the two changes land as one
identical hunk instead of a conflict).

## Evidence on `HEAD`

- `npm run verify` — see the PR's local summary line (typecheck, lint, format,
  full vitest run) recorded before push.
- `npx tsx scripts/art/ba-dan-exterior-apron.ts` reproduces the shipped plate
  byte-for-byte; `scripts/art/ba-dan-exterior-apron.test.ts` asserts that, the
  zero-alpha-inside guarantee, the opaque rim, the band's dimensions and the
  road-to-meadow continuation.
- Frames, both backends: `.shots/rim-probe/{canvas,webgl}/` captured with
  `FNT_REVIEW_BROWSER_CHANNEL=chrome npx playwright test -c
playwright.ba-dan-apron.config.ts`, which runs the committed review fixture
  `e2e/ba-dan-apron.review.ts` (it is not in the default Playwright projects, so
  it never runs in CI). Views: `village_explore` at the default follow camera
  plus zoom 64 centred on the north, west, east and south rim and both road exits
  (`0,7` and `23,7`), Canvas and WebGL side by side.
  `.shots/` is git-ignored; re-capture rather than looking for the frames.
  Read them against `assets/reference/player-view-2026-09-17/ba-dan-exploration.png`:
  the hard diagonal is gone; the plaza's east exit and the western road now walk
  out of frame and dissolve.

## Open gaps (not closed by this change)

- The **forest road** has the same rim defect and no apron; it is the obvious
  sibling change, using its own materials rather than the village's.
- The tone step between authored pieces and procedural cells _inside_ the board
  is pre-existing and still visible; the apron deliberately matches the
  procedural side, because that is what borders the rim.
- Nothing here was checked on a physical device, at Large text, or by listening;
  no claim is made about those.
- The default follow camera in the captures is a review fixture, not a
  playthrough.

## Next action

This branch is deliberately **draft**: PR #69 (v0.2.7) is the release in flight
and touching `main` first would make its package.json/CHANGELOG overlap a real
conflict. When #69 has merged with a merge commit:

1. Rebase this branch on the merge (expect a trivial package.json,
   package-lock.json and CHANGELOG overlap: keep 0.2.8 on top).
2. Re-run `npm run verify` and re-capture one rim frame.
3. Mark the PR ready, arm merge-commit auto-merge, confirm the exact-head checks
   and then confirm Pages serves the version.

If `codex/frame-surround-coverage` lands first as 0.2.8, renumber this branch to
0.2.9 in the rebase — the apron has no ordering dependency on it.
