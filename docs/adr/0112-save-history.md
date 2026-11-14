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
applied, which is what 0 means). The app stamps `HISTORY_REV` on every save and export. On load,
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

The first release, `2026-11-08-golden-v5`, is the existing `golden/v5` corpus. Its snapshot was read
back from the commit that wrote those saves (`982e5e65`) with today's scanner.

### 4. The check compares stories, and does not guess reachability

`src/content/story/saveHistory.ts`, run by `saveHistory.test.ts`:

| Check                    | Asks                                                                                                                                                                                               | Sound because                                                                                           |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `checkReleases` (writes) | Has a flag that **anything** reads gained or changed a write site, inside a region a release already contained (or in shared content or the app)? Then its registry entry must declare `oldSaves`. | No reachability is used. Every reader counts; every new write in shipped territory counts.              |
| `checkReleases` (scenes) | Is a scene that a `visited` condition reads new in a region a release contained? Then `LATE_SCENES` must answer for it.                                                                            | Same.                                                                                                   |
| `checkSave`              | Has this frozen save, loaded as the app loads it, visited a `flags` node that sets a read flag it does not hold?                                                                                   | Exact: a `flags` node writes on entry, so the save was written before it set the flag.                  |
| `checkRules`             | Does each rule read only nodes and flags the releases it serves had (or an earlier rule supplies)? Is every released rule unchanged?                                                               | Compared with the snapshots.                                                                            |
| Played forward           | Each frozen save, loaded and played down the rest of today's golden route to the ending card, against a new game at the same checkpoints: flags and `visited`-read scenes must match.              | Real rules, real conditions, no approximation; it throws where a gate no longer opens for the old save. |

The answer in `oldSaves` (and `LATE_SCENES`) is one of:

- `backfill`: a rule newer than the release gives the save its answer;
- `open`: every save can still play the scene (the writer's claim, with a reason);
- `unset`: a save past it answers "never happened", and that is intended (with a reason).

Each answer names the newest release it was decided for (`upTo`). A write added under a later release
is not covered by an older answer: the check asks again.

A flag written only in a region newer than the release needs nothing. That is the normal case when
the saga grows region by region.

### 5. The report

`npm run docs:saves` writes `docs/save-history.md` (checked in CI with `--check`): what each part of
the story reads from the others, what is remembered and not yet read, what was added under each
release with its answer, and the rules. Writers read it before drafting.

## What this covers

| Case                                              | Covered | How                                                                                                                                                   |
| ------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| A flag added to an old scene, read later          | yes     | `checkReleases`; `checkSave` names each stranded frozen save.                                                                                         |
| A flag added on a new scene in a shipped region   | yes     | Same; the answer is usually `open` or `unset`, and the writer has to say which.                                                                       |
| Standing keys (0 is falsy)                        | yes     | An `adjust` on an old option is a late write; the rule adds the delta once.                                                                           |
| Flags set by app code                             | yes     | The registry's `app:` writers are write sites like any other.                                                                                         |
| A setter that moves to another scene              | yes     | The new site is a late write; saves past the old site keep the flag.                                                                                  |
| A site that now writes a different value          | partly  | Reported as a changed write, so the writer must answer. The check cannot tell whether the meaning changed.                                            |
| Deleted or renamed scenes and flags               | yes     | Snapshots and saves go through `ID_ALIASES` before comparing; a rule naming a missing scene fails.                                                    |
| A save in the middle of a battle                  | yes     | Rules apply on load whatever the screen; the mid-battle saves are played forward to the ending.                                                       |
| A branch the save can no longer take              | yes     | Not a strand: the snapshot shows the save's content already set the flag there, so unset is its true answer.                                          |
| A rule whose inputs were added later              | yes     | `checkRules` fails a rule that reads a scene or flag a release it serves did not have.                                                                |
| A new scene read by `visited`                     | yes     | `LATE_SCENES`, and a `node` rule where the save shows it would have been there.                                                                       |
| The node a save stands on changes kind            | partly  | Seen by the played-forward check on the golden route only (it found `act1_epilogue`, an ending that became a scene; the app reads on, so it is fine). |
| A flag whose **meaning** changes, same values     | no      | Nothing in the data shows it. Rule for writers: a new meaning is a new key.                                                                           |
| A whole **region inserted behind** existing saves | no      | A new region is treated as ahead of every save. A prequel region needs its flags answered by hand.                                                    |
| An `open` or `unset` answer that is wrong         | no      | It is the writer's claim. The played-forward check contradicts it only along the golden route.                                                        |
| Saves written between releases                    | no      | A snapshot exists per release. Between two releases a flag could be added, saved without, and read later only if a write was removed and re-added.    |
| An older build loading a newer save               | no      | It drops `history` and writes 0, as it already drops `difficulty`. The next load re-runs rules; `set` rules are harmless then, `adjust` adds twice.   |

## Consequences

- Adding a remembered fact to a released region costs one registry field, and the test says exactly
  which one. Adding it to a new region costs nothing.
- The first run against 2026-11-08 found 16 flags and 5 scenes added under that release. All but one
  are `open` or `unset`. One is a real strand: SQ-01 starts with a scene spliced after `pella_asked`,
  so a save that had already been asked could never start it. Rule 1 gives such a save the list.
- `ruon_traded`'s rule from #791 is removed: the 2026-11-08 story already set it on that option, so
  a save without it chose the escort.
- `flagContinuity.ts` (the graph walk) is removed. Reachability is no longer part of the guarantee.

## Open decisions for the owner

1. **What counts as a release?** The check is exact for saves written by a released build. Recommended:
   freeze one whenever a build reaches the family's tablet (the deploy), so no real save falls between
   two snapshots.
2. **Is 2026-11-08 a release worth answering for?** It is the only frozen corpus, so it is used. If no
   real save from before today matters, the 21 answers can be dropped by freezing a release today and
   retiring the first one. Keeping it costs nothing and is the stricter choice.
3. **Rule 1 (Pella's list)** changes what an old save can do. It is small and follows the story, but it
   is a story decision.
