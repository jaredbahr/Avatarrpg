# ADR 0112: A save survives the story being edited after it was written

**Status:** proposed, 2026-11-14 (#773). Builds on #791 (the first backfill and corpus check), #765
(content ids are forever), ADR 0111 (regions) and the "Scale and saves" section of
`docs/pipeline-proof-plan.md`. Changes the save contract: a save file gains a history revision.

## Context

A save is protected in **format** (`migrate()`, v1 to v5) and in **ids** (`ids.ledger.json`,
`idAliases.ts`). It was not protected in **history**. A save is a place in the story plus what was
recorded on the way there. When a later scene reads a flag that an earlier, already-played scene only
started setting after the save was written, that save can never hold it. Unset and `0` are falsy, so
the later scene quietly takes the "never happened" road or never opens a gate.

The rule to enforce:

> For every frozen save, each flag that content still ahead of that save can read must be one of:
> already in the save, still settable from where the save stands, or covered by a declared backfill.

#791 shipped a first version: rules in `flagBackfills.ts`, applied on load when the flag is absent and
a setter was visited, and a check that walked the story graph forward from each frozen save. Working
from it showed three problems:

1. **"Still settable" cannot be read off the graph.** Free roam makes nearly every scene reachable
   with conditions ignored. Over-approximating is the right direction for _readers_ and the wrong
   one for _setters_: a scene behind a one-shot gate looks as reachable as one ahead. The check also
   could not tell "the save did not take that branch" from "the branch did not record this yet"; its
   one real rule (`ruon_traded`) answered a flag that the save's own content already set.
2. **The frozen saves had no record of the story that wrote them.** `fixtures/golden/v5` was written
   on 2026-11-08; the check compared those saves with today's graph only.
3. **A rule with no memory of having been applied is unsafe.** "Flag absent and setter visited" is
   also true of a save played on today's content by a player who chose the other option. A rule
   that re-fires on every load can overwrite a real answer, and a standing delta would be added twice.

## Decision

### 1. A backfill rule is plain data with a revision

`src/core/save/backfill.ts` (pure; the rules are passed in):

```ts
type BackfillRule =
  | { rev: number; when: Condition; key: string; set: FlagValue } // a flag
  | { rev: number; when: Condition; key: string; adjust: number } // a standing delta
  | { rev: number; when: Condition; node: string }; // a scene counted as visited
```

- `when` is a `Condition` over what the **old** save holds (a visited node, an older flag). It must
  show both that the save is past the scene and that it took the road that records the thing.
- `rev` is the **history revision** the rule introduces: whole numbers that only grow, in file order.
- Rules live in `src/content/story/flagBackfills.ts`, apart from the registry so the app ships the
  few rules without the 800-line registry. `HISTORY_REV` is the highest `rev`.

### 2. The save file records its history revision

`SaveBlob.history` (default 0, so no format bump: a file from before revisions has had no rule
applied, which is what 0 means). The app stamps every save and export with the higher of
`HISTORY_REV` and the revision of the file the running game was loaded from, so a file never goes
down. A revision that cannot be read (negative, fractional, not a number) loads as 0 with a warning
instead of refusing the save. On load,
`App.adoptLoaded` runs, in order: `applyIdAliases`, then `applyBackfills(state, blob.history, rules)`,
then the reconcile steps. A rule applies only when `rule.rev > blob.history`, in `rev` order:

- **once:** a save written after the rule shipped is never touched by it;
- **stable:** the answer is decided at the first load after the rule ships and saved with the game;
- **composable:** a later rule may read what an earlier rule supplied.

A `set` rule never overwrites a value the save holds. `adjust` goes through `adjustStanding`, so it
is clamped as in play, and absent standing is neutral (the `0 is falsy` trap is not touched: standing
is only ever compared).

### 3. Releases are frozen with a snapshot of the story

`src/core/save/fixtures/releases/index.json` lists the releases, oldest first. Each has a folder with
`history.json` (every flag write site, with its kind and values; every area of every region; the
rules it shipped; its `HISTORY_REV`) and its saves. `npm run saves:release -- <id> ["note"]` freezes
one from today's content: the golden route's eighteen saves and the snapshot. It refuses an id that
exists, and the index holds every file's SHA-256, so a regenerated or edited release fails the test.
The test also lists the release ids, so one cannot be dropped or reordered without editing the test.

The first release, `2026-11-08-golden-v5`, is the existing `golden/v5` corpus. Its snapshot was read
back from the commit that wrote those saves (`982e5e65`) with today's scanner, and its app writes
were confirmed by searching that commit for each key.

A second, `2026-11-15-demo`, is frozen with this ADR from the story as it merges. It is a test
fixture, not a product release: it pins every site answered so far, so a later write at one of them
is a changed write the check asks about.

### 4. The check compares stories, and does not guess reachability

`src/content/story/saveHistory.ts`, run by `saveHistory.test.ts`:

| Check                    | Asks                                                                                                                                                                                               | Sound because                                                                                                                                                                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checkReleases` (writes) | Has a flag that **anything** reads gained or changed a write site, inside a region a release already contained (or in shared content or the app)? Then its registry entry must declare `oldSaves`. | No reachability is used: every reader counts, and every new or changed write site in shipped territory counts. It compares write sites only. It does not see the story's edges, so it is sound for writes added or changed and silent about roads rerouted. |
| `checkReleases` (scenes) | Is a scene that a `visited` condition reads new in a region a release contained? Then `LATE_SCENES` must answer for it.                                                                            | Same.                                                                                                                                                                                                                                                       |
| `checkSave`              | Has this frozen save, loaded as the app loads it, visited a `flags` node that sets a read flag it does not hold?                                                                                   | Exact: a `flags` node writes on entry, so the save was written before it set the flag.                                                                                                                                                                      |
| `checkRules`             | Does each rule read only nodes and flags the releases it serves had (or an earlier rule supplies)? Is every released rule unchanged?                                                               | Compared with the snapshots.                                                                                                                                                                                                                                |
| Played forward           | Each frozen save, loaded and played down the rest of today's golden route to the ending card, against a new game at the same checkpoints: flags and `visited`-read scenes must match.              | Real rules, real conditions, no approximation; it throws where a gate no longer opens for the old save.                                                                                                                                                     |

The answer in `oldSaves` (and `LATE_SCENES`) is one of:

- `backfill`: a rule newer than the release gives the save its answer;
- `open`: every save can still play the scene (the writer's claim, with a reason);
- `unset`: a save past it answers "never happened", and that is intended (with a reason).

Each answer names the newest release it was decided for (`upTo`) and, for a flag, the write sites it
answers for (`sites`). A write added under a later release, or at a site the answer does not name, is
not covered: the check asks again. Sites are compared per option of a choice, so a flag added to one
more option counts. "A region the release contained" is decided by what the region holds, not by its
id, so renaming or splitting a region hides nothing.

A rule must answer something added under every release it serves. A rule aimed at a flag a release
already recorded is rejected: it would overwrite a real answer, or add a delta twice. So a rule ships
in the same release as the write it answers for.

A flag written only in a region newer than the release needs nothing. That is the normal case when
the saga grows region by region.

### 5. The report

`npm run docs:saves` writes `docs/save-history.md` (checked in CI with `--check`): what each part of
the story reads from the others, what is remembered and not yet read, what was added under each
release with its answer, and the rules. Writers read it before drafting.

## What this covers

| Case                                              | Covered                    | How                                                                                                                                                                                                                                                                                                                |
| ------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A flag added to an old scene, read later          | yes                        | `checkReleases`; `checkSave` names each stranded frozen save.                                                                                                                                                                                                                                                      |
| A flag added on a new scene in a shipped region   | yes                        | Same; the answer is usually `open` or `unset`, and the writer has to say which.                                                                                                                                                                                                                                    |
| Standing keys (0 is falsy)                        | yes                        | An `adjust` added to an option is a late write (sites are compared per option); the rule adds the delta once.                                                                                                                                                                                                      |
| Flags set by app code                             | partly                     | The registry's `app:` writers are write sites, but per module: a second write in a module already listed, or a changed value, is not seen.                                                                                                                                                                         |
| A setter that moves to another scene              | partly                     | A new write site is a late write; saves past the old site keep the flag. An **edge** rerouted to a setter that already existed is not seen (below).                                                                                                                                                                |
| A site that now writes a different value          | partly                     | Reported as a changed write, so the writer must answer. The check cannot tell whether the meaning changed.                                                                                                                                                                                                         |
| Deleted or renamed scenes and flags               | yes                        | Snapshots and saves go through `ID_ALIASES` before comparing; a rule naming a missing scene fails.                                                                                                                                                                                                                 |
| A save in the middle of a battle                  | yes                        | Rules apply on load whatever the screen; the mid-battle saves are played forward to the ending.                                                                                                                                                                                                                    |
| A branch the save can no longer take              | yes                        | Not a strand: the snapshot shows the save's content already set the flag there, so unset is its true answer.                                                                                                                                                                                                       |
| A rule whose inputs were added later              | yes                        | `checkRules` fails a rule that reads a scene or flag a release it serves did not have.                                                                                                                                                                                                                             |
| A new scene read by `visited`                     | yes                        | `LATE_SCENES`, and a `node` rule where the save shows it would have been there.                                                                                                                                                                                                                                    |
| The node a save stands on changes kind            | partly                     | Seen by the played-forward check on the golden route only (it found `act1_epilogue`, an ending that became a scene; the app reads on, so it is fine).                                                                                                                                                              |
| A flag whose **meaning** changes, same values     | no                         | Nothing in the data shows it. Rule for writers: a new meaning is a new key.                                                                                                                                                                                                                                        |
| A whole **region inserted behind** existing saves | no                         | A new region is treated as ahead of every save. A prequel region needs its flags answered by hand.                                                                                                                                                                                                                 |
| Resident profiles written by a `flags` node       | no                         | `residentProfiles` is history a `residentProfile` condition reads, and the scanner does not model it. Same hazard, not checked yet.                                                                                                                                                                                |
| An `open` or `unset` answer that is wrong         | partly                     | It is the writer's claim. The played-forward check contradicts an `open` only when a new game picks the flag up on the legs the old save has just played without getting it.                                                                                                                                       |
| Saves written between releases                    | no                         | A snapshot exists per release. Between two releases a flag could be added, saved without, and read later only if a write was removed and re-added.                                                                                                                                                                 |
| An older build loading a newer save               | partly                     | A build from this ADR on stamps the higher of the file's revision and its own, so it never lowers a file. A build from before this ADR drops `history`, as it already drops `difficulty`; the next load then offers every rule again (`set` and `node` rules are harmless then, an `adjust` rule would add twice). |
| An unreadable revision in the file                | yes                        | Loaded as revision 0 with a warning, never refused: the campaign is worth more than the stamp. The same cost as the row above applies.                                                                                                                                                                             |
| An edge rerouted to an existing setter            | yes, from 2026-11-19-roads | A release in snapshot format 2 records every road into a scene (`edges`). A road opened, in shipped territory, into a scene the release already had is asked about in `LATE_EDGES`. Releases frozen before format 2 recorded no roads, so against them it is still not seen (amendment below).                     |
| A later write at a site already answered          | no, until the next release | An answer names sites, not the values written there. A fourth option on an answered choice passes until a release is frozen with the three; after that it is a changed write. This is why a release is frozen with this ADR.                                                                                       |
| A new reader of a flag answered `unset`           | yes                        | An `unset` answer names the readers it was decided for (`readers`); a new reader is asked about again.                                                                                                                                                                                                             |
| An option inserted in the middle of a choice      | yes, from 2026-11-19-roads | Options are named by where they lead (`options[→home]`) and records with ids by id (`npcs[#mira]`). Against the two releases frozen before, the old positional form is compared, which still asks.                                                                                                                 |

## Consequences

- Adding a remembered fact to a released region costs one registry field, and the test says exactly
  which one. Adding it to a new region costs nothing.
- The first run against 2026-11-08 found 16 flags (17 write sites) and 5 scenes added under that release, 21 answers in all. All but one
  are `open` or `unset`. One is a real strand: SQ-01 starts with a scene spliced after `pella_asked`,
  so a save that had already been asked could never start it. Rule 1 gives such a save the list.
- `ruon_traded`'s rule from #791 is removed: the 2026-11-08 story already set it on that option, so
  a save without it chose the escort.
- `flagContinuity.ts` (the graph walk) is removed. Reachability is no longer part of the guarantee.

## Known soft spots

- `App.adoptSave` defaults its revision to the current one (right for a game that never left memory),
  and `SaveMeta.history` defaults to 0 (right for fixtures). Both defaults fail quietly if a new caller
  picks the wrong one. `src/app/saveHistory.test.ts` holds the app's three readers and two writers by
  a source scan. Making both parameters required is the stricter follow-up (about forty call sites).
- The played-forward check follows one route (walk up, escort Ruon, no side stories). It proves that
  route and nothing beside it; rule 1's sled is not on it.
- The first snapshot was reconstructed from git, and its app writes were found by text search.

## Open decisions for the owner

1. **What counts as a release?** The check is exact for saves written by a released build. Recommended:
   freeze one whenever a build reaches the family's tablet (the deploy), so no real save falls between
   two snapshots.
2. **Is 2026-11-08 a release worth answering for?** It is the only frozen corpus, so it is used. If no
   real save from before today matters, the 21 answers can be dropped by freezing a release today and
   retiring the first one. Keeping it costs nothing and is the stricter choice.
3. **Rule 1 (Pella's list)** changes what an old save can do. It is small and follows the story, but it
   is a story decision.

## Amendment 2026-11-19: roads, option identity and new readers (#813)

The independent review of #801 found four things the check could not see. Three are closed here;
the fourth is open.

- **Roads.** A release snapshot in format 2 (`SNAPSHOT_FORMAT`) records `edges`: area to every road
  it opens into a story scene, read from the road fields only (`next`, `onDefeat`, `ifSet`,
  `ifUnset`, `ifTrue`, `ifFalse`, and the `node` an NPC, route or trigger opens). Other fields can
  hold a scene's id by coincidence (a flag key, an NPC id, a camera target) and are not roads.
  `lateEdges` reports a road that is new in an area the release had and leads into a scene the
  release also had: a save of that release went the old way, so whatever that scene (or one after
  it) records, the save lacks, and no write site changed. A road into a new scene needs nothing,
  because whatever the new scene records is a new write site. The writer answers in `LATE_EDGES`
  (`flags.ts`), with `sites` naming the roads. A `backfill` answer accepts any newer rule: the
  rules answer for the flags past the road, and the flags' own entries name them.
- **Option identity.** A choice's option is named by where it leads (`options[→home]`, `#2` for a
  shared destination), and records with their own ids by id (`npcs[#mira]`), in write sites and in
  roads. Every write keeps its old positional form (`WriteSite.positional`), which is what the two
  releases frozen before format 2 are compared in. Those still ask on an inserted option.
- **New readers.** `OldSavesAnswer.readers` names the readers an `unset` answer was decided for. A
  reader added since is asked about again. The six existing `unset` answers name today's readers.
  The newest of them, #875's later-state props in Ba Dan, show nothing for a save without the side
  story, which is the "never happened" line the answers claim.
- **Release `2026-11-19-roads`** is frozen with this change, as a test fixture like
  `2026-11-15-demo`, so roads and option names are pinned from today.

Still open:

- **A second app write in a module already listed, or a changed value.** App code writes flags in
  several shapes (literals, constants such as `FIRST_FIGHT_GUIDANCE.stage`, computed keys such as
  `guidance.tip.${feature}`, object spreads), so a text scan would be a guess. The answer needs
  the app to write flags through one helper that can be listed, and that is a code change of its
  own.
- Roads opened by content outside the story bundle's records (none today) are not recorded.
