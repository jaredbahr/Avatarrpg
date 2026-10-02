import { describe, expect, it } from 'vitest';
import { CONTENT, ENEMIES } from '../../content';
import { ASSETS } from '../../content/assets/manifest';
import { portraitKeyFor } from './PartyRoster';

describe('portraitKeyFor', () => {
  it('resolves the shipped boss to its registered portrait', () => {
    const boss = CONTENT.enemies.get('grumbler');
    if (!boss) throw new Error('missing shipped boss');
    const key = portraitKeyFor(CONTENT, { characterId: null, sprite: boss.sprite });
    expect(key.startsWith('portrait.')).toBe(true);
    expect(ASSETS[key]).toBeDefined();
  });

  it('uses every matching shipped enemy portrait', () => {
    for (const enemy of ENEMIES) {
      const matching = enemy.sprite.replace(/^unit\./, 'portrait.');
      if (!ASSETS[matching]) continue;
      expect(portraitKeyFor(CONTENT, { characterId: null, sprite: enemy.sprite })).toBe(matching);
    }
  });
});
