import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Unit } from '../../core/types';
import { CONTENT } from '../../content';
import type { BendSetDef } from '../../content/bends';
import { bendDamageRelease, isBendingAttack, resolveBendAttack } from './bendHandoff';

const readSet = (name: string): BendSetDef =>
  JSON.parse(readFileSync(join('public', `art/units/${name}-bend.json`), 'utf8')) as BendSetDef;

const kaya = {
  id: 'kaya',
  faction: 'party',
  element: 'fire',
  sprite: 'unit.fire.kaya',
} as Unit;

describe('combat bend handoff', () => {
  it('selects the unit bend and Animator eight-way heading for an eligible cast', () => {
    const ability = CONTENT.abilities.get('fire_jab')!;
    const result = resolveBendAttack(
      kaya,
      ability,
      readSet('kaya'),
      { x: 1, y: 3 },
      { x: 5, y: 3 },
      'oblique',
    );
    expect(result?.heading).toBe('southEast');
    expect(result?.attack.releases).toHaveLength(2);
    expect(bendDamageRelease(result!.attack)).toBe(1);
  });

  it('keeps melee, support, enemies and absent bend data on the legacy path', () => {
    expect(isBendingAttack(kaya, CONTENT.abilities.get('strike')!)).toBe(false);
    expect(isBendingAttack(kaya, CONTENT.abilities.get('fire_step')!)).toBe(false);
    expect(isBendingAttack({ ...kaya, faction: 'enemy' }, CONTENT.abilities.get('fire_jab')!)).toBe(
      false,
    );
    expect(
      resolveBendAttack(
        kaya,
        CONTENT.abilities.get('fire_jab')!,
        undefined,
        { x: 1, y: 3 },
        { x: 5, y: 3 },
        'oblique',
      ),
    ).toBeUndefined();
  });
});
