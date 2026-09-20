# Riverside tea cels

Built-in imagegen produced original Sura and Kaya seated-cup strips on
19 September 2026, using each current `riverside-locomotion-{name}.png`
as the identity/style reference. Selected source PNGs are preserved in
`sources/riverside-tea/`; they are not shipped or precached.

Prompt specification: exactly two same-scale, three-quarter screen-right
poses of the referenced adult woman, seated cross-legged on the floor with an
upright back. First holds a plain pale ceramic cup in both hands in her lap;
second supports it near her lips. Preserve face, hair, costume, boots and
adult anatomy. Match dark-brown ink and restrained two-tone cel shading.
Genuine alpha, no scenery, shadow, chair, table, text or franchise likeness.
The source request explicitly called these hold/sip cels, not sit-down motion.
Sura's generated right cel had an unwanted swirl emblem; one targeted
imagegen correction removed it while preserving the rest of the strip.

Sura generation: `exec-88c0fa8a-d867-4b91-a201-7d82347d584d`, corrected by
`exec-15f04547-7413-4b0d-943b-1d5b353fc175`. Kaya generation:
`exec-02e14322-630b-4ab9-a632-5446822b8b7d`. Built-in output was copied into the
repository; no API fallback or external character art was used.

Reproduce packing with `node --import tsx scripts/art/riverside-tea.ts`.
The existing alpha-aware trim/box-filter/baseline utilities split each strip,
uniformly reduce its visible height to 88 pixels and place it in 128×192 cells.
No anatomy is stretched, repainted or sliced. The only atlas writes are cells
(768,384) and (896,384), previously empty; atlas dimensions are unchanged.
The normalizer preserves alpha and creates no new ground shadow.

The two output cels are `tea/0.png` (cup in lap) and `tea/1.png` (sip).

The cup is held by the same two hands in both cels. Hair and clothing remain
recognizable at runtime scale. The quiet hold/sip alternation is intentionally
sparse, with no claim of a smooth sit/rise animation. Reduced motion holds the
lap cel. A standing procedural fallback remains available during image load.

Before/after captures and browser evidence are recorded in the task handoff.
The PNGs add 41,027 bytes; the units family remains below its unchanged
4.75 MiB cap. Existing atlas-cell pixels are preserved exactly.
