# #399 — exploration collision with people

Owner: Codex root `npc399-resume-20261103`; claim6574184581. Branch
`codex/npc-walking-399`. Draft-only delivery under the latest direct user goal.

PR374's compatible main landing e96f1341 released the recorded reducer overlap;
#348 assignment6596337983 already designated #399 to Codex. Live open/draft
scopes and open/closed duplicate searches were checked before source edits.
Main90f872a3 (#375 pixel overlays) was later merged locally without a rebase.

Only runtime change: `handleWalkTo` uses the same resolved visible NPC and
background-role occupancy as `findApproach`, via a small private helper. Keep
approach ranking, dialogue, terrain, triggers/exits, RNG, schemas, art and the
landed #374 `handleResolveBattle` implementation intact.

Evidence: [source identities, reproduction and results](../evidence/399/README.md).
Core4red/3controls became7green; focused68/68green; native2red became2green,
then both cases repeated after the renderer's main merge. Independent SOL High
reviews found no blocking scope/validity or runtime findings. The initial
fixture-only typecheck setup failure and original discovery evidence are retained.

The native mouse click at projected10,4 actually selects Mira11,5; do not label
it a ground10,4 input. Core tests independently cover that ordinary command.
Native observations use normal motion and forwarded real renderer calls.

Final exact published object, clean `npm run ci:local` result, hosted actual jobs
(including skipped child matrices), review and remaining gates belong in the PR.
Do not infer hosted browser coverage from green aggregate checks. Do not bypass
a failed gate, create a competing PR, force-push a divergent metadata graph,
merge, mark ready, deploy, install software, generate art or call unverified paid
assistance. Continue corrections on the same published branch with its expected
remote head. Preserve the original local graph in the session bundle.

Remaining acceptance: physical devices/input, WebKit/Safari/PWA, GPU performance
and owner visual acceptance. No moving-resident/follower collision redesign is
part of this bounded leader pathfinding fix.
