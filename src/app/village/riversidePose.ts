import type { Unit } from '../../core/types';
import type { Animator } from '../animator';

/** The characters the riverside draws from their village sheets (ADR 0047). */
const VILLAGE_SHEETS: ReadonlySet<string> = new Set(['sura', 'kaya']);

/**
 * The sheet a party member is drawn with: on the riverside, Sura and Kaya
 * wear their village sheets (`unit.village.<id>`) in place of their unit art.
 */
export function drawnSprite(member: Pick<Unit, 'characterId' | 'sprite'>, riverside: boolean) {
  return riverside && member.characterId && VILLAGE_SHEETS.has(member.characterId)
    ? `unit.village.${member.characterId}`
    : member.sprite;
}

/**
 * A party member's walk clip, facing and clip time, read from the sheet it is
 * actually drawn with. The gait is the sheet's: a four-way village sheet
 * plays 500 ms of clip a tile, while the unit art it replaces may declare an
 * eight-way gait of its own (ADR 0050), so timing the drawn sheet from the
 * other one runs its walk several times too fast.
 */
export function drawnPose(
  animator: Animator,
  now: number,
  member: Pick<Unit, 'id' | 'characterId' | 'sprite'>,
  riverside: boolean,
) {
  const sprite = drawnSprite(member, riverside);
  return {
    clipTime: animator.unitPose(now, member.id, sprite)?.clipTime,
    ...animator.locomotion(now, member.id, 'rest', sprite),
  };
}
