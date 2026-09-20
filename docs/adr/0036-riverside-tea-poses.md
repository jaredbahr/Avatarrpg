# ADR 0036: Seated Riverside tea poses

Status: accepted for the bounded Riverside tea interaction, 2026-09-19.

Tea arrival previously set a discovery flag and claimed the party sat with a
cup, while every figure remained standing outside the veranda railing. The
existing standing `rest` and defeated `ko` cels cannot represent a tea break.

Add an optional two-frame `tea` clip: a seated cup-in-lap hold and a quiet sip,
held for four seconds each. It falls back to idle on sheets without that art.
Only the Riverside Sura and Kaya sheets carry it. Each reuses its last two
128×192 cells in the existing 1024×576 atlas, retaining the 128 pixels-per-tile
scale, 85% contact anchor and every existing cell. No budget changes.

VillageLife owns the transient hold; it begins after arrival, remains until
walking or another action, and pauses its clock with the existing village
lifecycle. Only present Sura/Kaya actors on the two porch tiles are seated.
Other characters retain their normal pose, and the message does not claim
that every party member sits. Reduced motion selects the static lap pose.
VillageLayer draws the same cels and contact shadows above either board
backend. The frames depict hold/sip, not an invented stand-to-sit transition.

The tea destination moves from the outside path at (10,18) to the painted
veranda at (8,18). Two newly walkable tiles, (8,19) and (8,18), extend the
existing stone-step route from (9,19). The adjacent rail (9,18), house (8,17)
and table area (7,18) remain blocked. Logical movement and rendered positions
agree; no visual teleport is introduced.

Source images, prompts and normalization are recorded in
[the tea art note](../art/riverside-tea.md). This is a small Riverside action;
other character tea poses and a full seated transition need authored art.
