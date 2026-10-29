# Forest ambush continuity (#334)

Baseline `7d6a5515`; implementation branch `codex/fix-334-ambush-continuity`.

The Forest Road's full-height x8 trigger stopped the walk at the correct tile,
but `createBattle` always used the map's x1/3 direct-entry spawns. Both battle
outcomes then returned to the saved x8 trigger tile, which put the explore
party against painted rubble. ADR 0098 adds optional, authored approach entries
to the battle story node. The actual crossing row chooses six legal combat
positions. Direct battle creation and the simulator's normal fixed spawns are
unchanged. On battle resolution, a matching recorded approach chooses a nearby
clear-road return position before either story branch. There is no new saved
state and no change to the map crossing, enemies, pond, or camera.

The content validator checks all nine crossing rows (y2–10), six distinct
walkable dry spawns per row, no rubble, props, or any base/variant enemy or
reinforcement overlap, leader distance at most one tile, and a clear six-seat
eastbound return lane within two tiles of the crossing. Core tests cover
party sizes 1–6 at every row, direct-entry fallback, the main real route, and
victory/defeat through aftermath dialogue save/load and departure.

## Paired legal-command balance screen

`runCombat` drove the same party AI and enemy AI under 40 matching seeds per
variant/roster row. The candidate used only the main-road approach positions
as the forest map's spawns in an in-memory `ContentIndex`; baseline used the
unmodified fixed spawns. Thus 480 paired seeds, 960 fights, exercised all
three variants and party sizes 1/2/3/6. The final rear-three adjustment was
compared with the same 40 six-person seeds per variant; it cannot affect
smaller parties. Solo was Riko, duo Sura/Riko, three
Kaya/Nilak/Bo, six Kaya/Nilak/Bo/Nima/Riko/Sura. Every row won 40/40 in both
layouts with no anomalies. HP is the mean remaining fraction of party maximum.

| Variant / party  | Deaths, baseline → approach | HP, baseline → approach |
| ---------------- | --------------------------: | ----------------------: |
| Thugs / solo     |                       0 → 0 |             .675 → .639 |
| Thugs / duo      |                    0 → .100 |             .817 → .732 |
| Thugs / three    |                       0 → 0 |             .793 → .835 |
| Thugs / six      |                1.850 → .075 |             .658 → .840 |
| Slingers / solo  |                       0 → 0 |             .783 → .762 |
| Slingers / duo   |                    .025 → 0 |             .428 → .604 |
| Slingers / three |                 .075 → .025 |             .793 → .816 |
| Slingers / six   |                1.850 → .100 |             .648 → .869 |
| Bruisers / solo  |                       0 → 0 |            1.000 → .814 |
| Bruisers / duo   |                       0 → 0 |             .804 → .888 |
| Bruisers / three |                    0 → .050 |             .813 → .876 |
| Bruisers / six   |                 .900 → .025 |             .780 → .866 |

The first, more rearward formation was rejected: it caused .900 mean deaths
for the Sura/Riko slinger duo and .475 for the three-person slinger party.
Keeping the leader at the real crossing while seating the next two near it
removed that regression. The rear three then moved nearer the explored party
line, replacing `(3,6),(3,2),(1,6)` with `(5,3),(4,4),(3,8)` on the main row.
That kept 40/40 wins in all three variants and changed their mean deaths from
`.125/.125/.150` to `.075/.100/.025` respectively. The final layout still makes a full six-person table
materially healthier than the fixed-spawn baseline; this difference is flagged
for product acceptance, not compensated with hidden enemy or hazard changes.
These are AI-driven legal-command screens, not proof of every human strategy.

## Browser evidence

The focused production-browser run of `e2e/ambush-continuity.spec.ts` passed
all three Surface-touch cases on isolated port 4334: Canvas and WebGL tapped
the painted x8 road tile, checked Kaya/Nilak/Bo at `(8,4),(8,3),(9,5)` in
combat, completed the fight through legal AI commands using the simulator's
party AI profiles, and checked the visible aftermath at `(8,3)`. The WebGL
case took 2.0 minutes under software rasterization. A separate Canvas case
tapped x7 then x8 with all six members and captured the party immediately
before and after the battle transition. Its rear line is visibly spread along
the western road and pond edge, without the previous reset to the x1/3 spawns.
The three-person Canvas images are in
`test-results/ambush-continuity-the-fore-8212c-turns-on-clear-road-canvas--surface-touch/`:
`forest-approach-canvas.png` and `forest-aftermath-canvas.png`. In the latter,
Kaya stands to the east of the painted rubble with clear ground under her.
WebGL images have the same basenames with `webgl` under the sibling WebGL
result. The six-player pair is in
`test-results/ambush-continuity-six-foll-c754b-eir-walked-approach-canvas--surface-touch/`.
The first browser attempt found that return memory alone did not move the
immediate dialogue scene; the final fix updates `location.pos` at resolution
as well. The existing campaign browser route remains the broader full-playthrough check.
