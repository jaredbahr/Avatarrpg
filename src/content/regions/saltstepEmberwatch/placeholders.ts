/**
 * The trial slice's placeholders (RG-02), in one place so they are easy to find and replace.
 *
 * Text: the merged script (`docs/story/scripts/act2-sparks.md`) is used word for word. Where the
 * game needs a string the script does not give (a choice's detail line, a fight tip, an enemy's
 * description, a locked route's hint), it is wrapped in `writerPlaceholder`, so it reads
 * "[Writer placeholder] …" in game and `grep -rn writerPlaceholder` lists every one for the writing
 * pass. `docs/pipeline-trial-log.md` lists them too.
 *
 * Art: portraits that do not exist yet use the narrator frame (`PLACEHOLDER_PORTRAIT`); sprites
 * borrow existing figures (see `maps.ts` and the enemy records). Both wait for the art PR.
 */

/** A string the game needs and the script does not supply; the writing pass replaces it. */
export function writerPlaceholder(text: string): string {
  return `[Writer placeholder] ${text}`;
}

/** The narrator frame, standing in for a portrait the art pass has not made yet. */
export const PLACEHOLDER_PORTRAIT = 'portrait.narrator';
