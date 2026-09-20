# Dialogue portraits

The ten playable heroes and six named NPC speakers use 512 × 512 PNG busts
through the existing asset manifest, dialogue stage, and HUD canvas loader.
The narrator keeps the existing symbolic painter. No asset format, renderer,
or download budget changed.

| Cast       | Portrait keys                      |
| ---------- | ---------------------------------- |
| Fire       | Kaya, Tenzo                        |
| Water      | Nilak, Sura                        |
| Earth      | Bo, Linmei                         |
| Air        | Nima, Jinu                         |
| Nonbenders | Riko, Wen                          |
| NPCs       | Mira, Gao, Pella, Dorin, Ruon, Jin |

All files ship at `public/art/portraits/<name>.png`, with lowercase names.
Entries retain their element palette so the dialogue backdrop and portrait
ring match the speaker. While an image loads or if it fails, the original
character-specific portrait painter remains visible instead of an empty disc.

## Source and import

Hero portraits reuse the project's existing generated character-art delivery.
The six NPCs were generated individually using the built-in OpenAI image tool
on 2026-09-17. Each uses the exact first Prompt paragraph in
`docs/art/prompts/portraits/<name>.md`, followed by:

> Production dialogue portrait for Four Nations Tactics. Follow the existing
> original character description precisely. No text, no border, no watermark.
> Flat cel shading.

The character briefs govern faces, clothing and signature props. The style is
hand-drawn animation with dark-brown outlines, cel shadows and a plain warm
parchment background. These are original project characters, not downloaded
third-party character packs. Generated shading has some softer variation than
the strict two-tone brief; this delivery is a first art pass.

NPC sources were processed with the existing portrait importer:

```bash
node --import tsx scripts/art/portrait.ts --key mira --in art/raw/portraits/mira.png
```

All sixteen shipping portraits were then encoded as 256-colour PNGs with
ImageMagick to stay below the existing 4 MiB portrait-family budget:

```bash
convert input.png -strip -dither None -colors 256 -define png:compression-level=9 PNG8:output.png
```

This is an authoring step, not a runtime dependency. It preserves 512 × 512
resolution. Original candidates stay in ignored `art/raw/`; the game consumes
only the packed portraits. Credits are recorded in `src/content/credits.ts`
and the generated `NOTICE.md`.

## Dialogue input regression

A Next/Continue click previously advanced twice: once on the native button,
then again as its click bubbled to the enclosing dialogue panel. The panel
now ignores button-originated clicks and lets native button keyboard events
produce their normal click. Panel Enter/Space still advances, held-key repeats
are ignored, and a line refresh restores keyboard focus.

`e2e/dialogue.spec.ts` walks every line with mouse, touch, Enter and Space,
checks the final transition, and checks panel input. These tests require the
Chromium/WebKit binaries installed by CI.
