# ADR 0016 — Stationary illustrated story interludes

Status: accepted for the playable Act I slice.

## Context

The owner approved painted story frames with text underneath and rejected
smoothly animated characters. Interludes should interrupt play occasionally
to show scale, travel and ordinary life. They must not become another story
engine, autoplay choices, or invalidate saved games.

## Decision

`src/content/story/interludes.ts` assigns static paintings to existing dialogue
and ending nodes. `DialogueScene` presents those paintings above the existing
story text. No camera movement, fades, moving characters or video downloads.
The story graph remains authoritative for dialogue, branches, flags and XP.

The opening, east road, quarry descent and both Act I endings use this treatment.
Other conversations and every decision retain their current interactive form.
Art is 1280-wide WebP under `public/art/interludes`, contained rather than
cropped, with useful image descriptions and a text fallback on load failure.
It uses the existing PWA precache and the unchanged 4 MiB family / 25 MiB total
asset budgets. This is a DOM illustration contract, separate from combat atlases.

Scenes initially wait for the reader. Play scene opts into timed captions at
roughly 150 words/minute with an additional pause, minimum six seconds per
frame. Next, Restart and Skip remain available. Automatic playback stops on
the final frame: Continue explicitly enters the following battle or hub.
Skip follows only the current dialogue node's authored next link. It never
skips decisions or chooses an outcome. A menu or hidden document stops playback;
resuming requires Play scene. Missing art does not prevent manual progression.

Dialogue saves retain the existing node and line index. Playback preference and
timers are transient, so loading always waits. Endings use a presentation-only
frame index; reloading an ending starts its illustration sequence again without
applying any reward. Read summary retains the complete original ending and its
save/title controls; Replay is available from that summary. No save migration.

## Consequences

Authors can add illustrated presentations without new commands or save fields.
Tests require a frame for every line and teaser, shipped art, no choice-node
attachments, and outcome-safe images. Any future variant with a different line
count needs matching presentation authoring and validation before adding it.
The full campaign placement notes are editorial plans, not implemented missions.

Art is generated with the built-in image tool; provenance and exact prompts are
in `docs/art/interludes.md`. Sprite-only camera and alpha rules do not apply to
full-background narrative paintings. Brown ink, cel shading, original designs
and painterly environments continue to apply.
