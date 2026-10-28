# Painted portrait expressions — #299

Owner: the existing Codex Avatar session; Claude's issue comment assigns this
lane to Codex. Branch `codex/portrait-expressions-299`. Preserve the separate
NPC marker PR and the rejected 3D prototype stop.

## Reviewable scope

This first fidelity proof delivers Kaya's angry, worried and warm expressions,
not the complete seven-character issue. Six characters and owner visual
acceptance remain open. No story lines, choices or outcomes are rewritten.

The neutral PNG conversion is its own commit (`ca44f4f6`): 13 current full-color
files encoded to 256 colors, 1,623,635 bytes saved. Existing indexed portraits
are untouched. The only RGBA source was fully opaque before conversion.

Three built-in OpenAI edits use the shipped neutral as reference. Original
returned images, exact prompts and source hashes are preserved under
`art/source/portraits-variants/` and `docs/art/prompts/portraits/kaya.*.md`.
The initial whole-image palette conversion failed visual review for new flame /
trim stippling. Final packing uses only a feathered face region over neutral
and retains its palette indices elsewhere. Independent actual-pixel review
passes identity, expression, framing, approved softness and lack of seams at
512px and 2x crops; this is not the owner's acceptance.

Optional expression fields resolve through node/party variants in the pure
story engine. Both UI presentations use registered expression keys only.
Unknown keys, cold images and failed/offline requests retain neutral, with its
painter only if neutral itself is unavailable. Workbox excludes expression PNGs
from precache. No budget is raised. ADR0096 records this proposed proof.

## Validation and delivery

The PR is the authoritative exact-head test record. The prepared focused suite
passed91/91 and typecheck passed before the current-main integration; a packed
image invariant suite and scoped browser review add final-head coverage.

Required before publication: green `npm run ci:local`. The dedicated local
`playwright.portrait-expressions.config.ts` verifies real-node expression
selection, app-level on-demand requests and exact rendered bitmap pixels at
desktop and iPad portrait, including a failed-request neutral fallback. It
blocks service workers; inspect the production service-worker manifest
separately to verify precache exclusion. Inspect saved in-game PNGs as pixels,
and distinguish these scoped checks from full gameplay/gallery acceptance.

Keep the PR draft for Claude and owner review. No merge, deployment, PixelLab
generation, API-key fallback or paid service is authorized by this checkpoint.
Admit heavy validation only when the higher-priority game workloads are clear.

## Scoped native evidence at e10ea354

The dedicated single-worker browser review passed 8/8 in 11.3 seconds on
2026-10-28: angry, worried, warm and aborted-request neutral fallback on desktop
Chromium (1368x912) and emulated iPad portrait WebKit (834x1194 CSS, DPR2).
Each case compares actual portrait backing-store RGBA pixels to its selected
PNG and verifies expression requests occur only after selection. Screenshots
are in `art/source/portraits-variants/review/in-game/`.

All eight screenshots were inspected. The portrait, speaker label, dialogue
and Next control remain visible without clipping. Expression detail is subtler
at the smaller iPad portrait size; this is not a physical-device check or
Jared's aesthetic acceptance. The neutral failed-load portrait is visible.
The production build passed and check-delivery.mjs confirmed the actual built
service worker includes neutral Kaya and excludes the expression folder.
Full ci:local remains the publication gate; see the PR for its exact-head result.
