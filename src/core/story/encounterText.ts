import type { EncounterDef } from '../types';

/** Read the selected roster's authored guidance, including after loading a battle. */
export function encounterText(
  encounter: EncounterDef,
  variantId: string | null,
): Pick<EncounterDef, 'intro' | 'tip'> {
  const variant = encounter.variants.find((entry) => entry.id === variantId);
  return {
    intro: variant?.intro ?? encounter.intro,
    tip: variant?.tip ?? encounter.tip,
  };
}
