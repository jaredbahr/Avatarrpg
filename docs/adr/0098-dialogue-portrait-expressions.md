# ADR 0098: Optional dialogue expressions load on first use

**Status:** proposed proof, 2026-10-28; issue #299. Owner visual acceptance pending.

Dialogue and choice nodes, including party-aware variants, may name `angry`,
`worried` or `warm`. Omission retains neutral. A selected variant inherits its
node's expression unless it supplies one. Presentation resolves an expression
only when its manifest key exists; an absent key remains the neutral portrait.

Expression PNGs live under `art/portraits/expressions/` and are excluded from
Workbox precache. The image cache requests them only when displayed. While the
image is cold, offline or fails, the neutral image remains visible; its painter
is the last fallback only if neutral itself is unavailable. No save field or
story text changes are needed. Both dialogue presentations use this contract.

The first reviewable slice ships Kaya's three expressions. It does not complete
the seven-character batch or claim owner acceptance. The other six characters
and any necessary measured portrait-family increase remain follow-up work.
No family, JavaScript or precache budget is raised here. The existing neutral
full-color PNGs are first encoded to 256 colors in their own commit.

The OpenAI tool edits the shipped neutral reference. Raw outputs and exact
prompts are preserved. The existing importer normalizes each to 512 pixels;
the packer uses only its face region over the neutral and encodes on the
neutral's palette. This holds the flame, hand, costume and background outside
the face region byte-for-byte in decoded pixels. The comparison sheet and
in-game views, rather than tests alone, decide whether the expressions work.

PixelLab, new paid APIs, deployments and automatic merges are outside this proof.
