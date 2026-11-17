# ADR 0117: `branchWhen`, a story node that chooses its road by a Condition

**Status:** accepted, 2026-11-17 (owner approval, same day). Amends the story-node set of ADR 0011 and
builds on the `Condition` DSL (ADR 0005 line of work, `src/core/story/conditions.ts`).

## Context

RG-02's Act II script (`docs/story/scripts/act2-sparks.md`) has hero-specific lines inside one long chain
(Sura and Wen in Scene 2.4, Riko in 2.6). A `branch` node reads one flag by truthiness, so a writer who
wanted "if Sura is in the party, she says this" had to copy the whole chain under another route (#836's notes,
friction item 3 in `docs/pipeline-trial-log.md`). Every later region needs the same thing.

Dialogue `variants` do not cover it: they swap the text of one node, but a hero line often has its own
speaker, portrait and reply, which are separate nodes.

## Decision

A new pass-through node kind, `branchWhen`:

```ts
{ id: 'x_sura_line', kind: 'branchWhen',
  when: { kind: 'partyHas', characterId: 'sura' },
  ifTrue: 'x_sura_speaks', ifFalse: 'x_next_line' }
```

- `when` is any `Condition`: `partyHas`, `flag`, `standing`, `visited`, `partySize`, `phase`,
  `residentProfile`, and nested `all` / `any` / `not`. `ifTrue` and `ifFalse` are story node ids.
- The story engine evaluates it with the same `evaluate` that gates choice options, then continues to the
  chosen node in the same step. Like `flags` and `branch` it never stops on screen and counts toward the
  chain guard. It adds the node to `story.visited`, as `branch` does.
- It is a **new kind**, not a change to `branch`. `branch` keeps `flag` / `ifSet` / `ifUnset` exactly as
  before, so no existing data, save or id changes. The `branch` rules stay: a `branch` must not read a
  `standing.` key or a `scene.` key; `branchWhen` is the right tool for both.
- Field names are `ifTrue` / `ifFalse`, not `then` / `else`, so a node is never a thenable.

## Where it is understood

- `src/core/types.ts` (`StoryNode`), `src/content/schemas.ts` (node schema; `validateContent` links both
  targets, so a missing target and a dead node are reported; conditions inside `when` are scanned for
  unknown characters, unknown `visited` ids and bad scene memory like any other condition; the phase-node
  walk passes through it).
- `src/core/story/storyEngine.ts` (traversal).
- `scripts/docs/story-graph.ts` (`npm run docs:story`): two edges labelled `when: <description>` and
  `otherwise (not: <description>)`, a diamond in the mermaid graph, counted with branches.
- `progression.test.ts`: the route enumerator evaluates `when` against the path's flags, party and visited
  list, so a gated line is one deterministic road per path and never a new decision, and it follows both
  targets in its link walks. Its warnings stand: it is not weakened and there is still no global "pick option N".

## Saves

Nothing new is stored. `branchWhen` reads `flags`, `party` and `story.visited`, all already in the save, so
`serialize.ts` is untouched. A node is new content: add it to `ids.ledger.json` with `npm run ids:ledger`.
A condition that reads a flag a shipped release never wrote follows ADR 0112 (`oldSaves` in the flag's
registry entry) exactly as any other reader does; `visited` on a new scene goes in `LATE_SCENES`.

## Consequences

- A hero variant is a small detour: `branchWhen` -> hero node(s) -> rejoin the chain. The chain is written
  once. Several heroes in a row are several `branchWhen` nodes in sequence.
- A gate is only as good as the party at the moment it is entered. `partyHas` ignores fallen members
  (`hp <= 0`); on exploration the party is whole, so this matters only for a gate placed right after a fight.
- A table that has neither hero takes `ifFalse`, which must lead on to something that makes sense alone.
