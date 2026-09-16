/**
 * The art swap point.
 *
 * Nothing in the game references a drawing directly — units, portraits, NPCs
 * and ability effects all carry an asset *key*, and this file decides what that
 * key resolves to.
 *
 * Today every key resolves to a code-drawn painter: a named vector routine in
 * `src/render/painters/` tinted from a nation palette. To drop in commissioned
 * or generated art later, change the entry:
 *
 *   'unit.fire.kaya': { kind: 'painter', painter: 'bender', palette: 'fire' }
 *   'unit.fire.kaya': { kind: 'image', url: 'art/kaya.png', palette: 'fire' }
 *
 * ...and nothing else in the codebase changes. That is the whole contract.
 *
 * Portraits are the first real art (docs/art-bible.md): a 512x512 bust on
 * parchment dropped into `public/art/portraits/<name>.png` and pointed at here:
 *
 *   'portrait.kaya': { kind: 'image', url: 'art/portraits/kaya.png', palette: 'fire' }
 *
 * Keep the `palette` on an image entry. It is how the dialogue backdrop knows
 * which element to tint for the speaker, and how HUD chrome matches the art.
 */

export type AssetEntry =
  | {
      readonly kind: 'painter';
      /** Name of a routine registered in `src/render/painters/registry.ts`. */
      readonly painter: string;
      /** Palette key: fire | water | earth | air | nonbender | enemy | neutral. */
      readonly palette: string;
      /** Distinguishes the two characters of an element, or an enemy silhouette. */
      readonly variant?: string;
    }
  | {
      readonly kind: 'image';
      /** Relative to the site root (the `public/` folder), or an absolute URL. */
      readonly url: string;
      /** Palette key, so HUD chrome and the dialogue mood still know the element. */
      readonly palette?: string;
    };

const painter = (painterName: string, palette: string, variant?: string): AssetEntry =>
  variant
    ? { kind: 'painter', painter: painterName, palette, variant }
    : { kind: 'painter', painter: painterName, palette };

export const ASSETS: Readonly<Record<string, AssetEntry>> = {
  /* ------------------------------------------------------ Party sprites */
  'unit.fire.kaya': painter('bender', 'fire', 'lean'),
  'unit.fire.tenzo': painter('bender', 'fire', 'broad'),
  'unit.water.nilak': painter('bender', 'water', 'robed'),
  'unit.water.sura': painter('bender', 'water', 'lean'),
  'unit.earth.bo': painter('bender', 'earth', 'broad'),
  'unit.earth.linmei': painter('bender', 'earth', 'robed'),
  'unit.air.nima': painter('bender', 'air', 'lean'),
  'unit.air.jinu': painter('bender', 'air', 'robed'),
  'unit.non.riko': painter('bender', 'nonbender', 'lean'),
  'unit.non.wen': painter('bender', 'nonbender', 'broad'),

  /* ----------------------------------------------------- Enemy sprites */
  'unit.enemy.thug': painter('bandit', 'enemy', 'club'),
  'unit.enemy.slinger': painter('bandit', 'enemy', 'sling'),
  'unit.enemy.bruiser': painter('bandit', 'enemy', 'broad'),
  'unit.enemy.quarrybender': painter('bandit', 'earth', 'bender'),
  'unit.enemy.deserter': painter('bandit', 'fire', 'bender'),
  'unit.enemy.merc': painter('mercenary', 'enemy', 'blade'),
  'unit.enemy.crossbow': painter('mercenary', 'enemy', 'crossbow'),
  'unit.enemy.sergeant': painter('mercenary', 'enemy', 'sergeant'),
  'unit.enemy.grumbler': painter('driller', 'enemy'),
  'unit.ally.ruon': painter('mercenary', 'neutral', 'sergeant'),

  /* --------------------------------------------------------------- NPCs */
  'npc.elder': painter('villager', 'neutral', 'elder'),
  'npc.shopkeeper': painter('villager', 'earth', 'shopkeeper'),
  'npc.kid': painter('villager', 'air', 'kid'),
  'npc.guard': painter('villager', 'earth', 'guard'),

  /* --------------------------------------------------------------- Props */
  'prop.barrel': painter('prop', 'water', 'barrel'),
  'prop.flask': painter('prop', 'earth', 'flask'),
  'prop.brazier': painter('prop', 'fire', 'brazier'),
  'prop.hay': painter('prop', 'air', 'hay'),
  'prop.rubble': painter('prop', 'earth', 'rubble'),
  'prop.cart': painter('prop', 'air', 'cart'),

  /* ---------------------------------------------------------- Portraits */
  'portrait.kaya': painter('portrait', 'fire', 'kaya'),
  'portrait.tenzo': painter('portrait', 'fire', 'tenzo'),
  'portrait.nilak': painter('portrait', 'water', 'nilak'),
  'portrait.sura': painter('portrait', 'water', 'sura'),
  'portrait.bo': painter('portrait', 'earth', 'bo'),
  'portrait.linmei': painter('portrait', 'earth', 'linmei'),
  'portrait.nima': painter('portrait', 'air', 'nima'),
  'portrait.jinu': painter('portrait', 'air', 'jinu'),
  'portrait.riko': painter('portrait', 'nonbender', 'riko'),
  'portrait.wen': painter('portrait', 'nonbender', 'wen'),

  'portrait.narrator': painter('portrait', 'neutral', 'narrator'),
  'portrait.mira': painter('portrait', 'earth', 'mira'),
  'portrait.gao': painter('portrait', 'earth', 'gao'),
  'portrait.pella': painter('portrait', 'air', 'pella'),
  'portrait.dorin': painter('portrait', 'earth', 'dorin'),
  'portrait.ruon': painter('portrait', 'neutral', 'ruon'),
  'portrait.jin': painter('portrait', 'nonbender', 'jin'),
};

/**
 * Ability effects are keyed `fx.<element>.<name>`. Rather than list forty
 * near-identical entries, unlisted fx keys fall back to the generic impact
 * painter tinted by the element in the key — so adding an ability needs no
 * manifest edit, while overriding one still can.
 */
export function resolveAsset(key: string): AssetEntry {
  const explicit = ASSETS[key];
  if (explicit) return explicit;

  if (key.startsWith('fx.')) {
    const parts = key.split('.');
    const element = parts[1] ?? 'neutral';
    const name = parts[2] ?? 'impact';
    const palette = element === 'non' || element === 'enemy' ? 'nonbender' : element;
    return { kind: 'painter', painter: 'impact', palette, variant: name };
  }

  if (key.startsWith('portrait.')) {
    return { kind: 'painter', painter: 'portrait', palette: 'neutral', variant: 'unknown' };
  }

  // Without this a new prop would fall through to the generic 'bender' painter
  // and draw a barrel as a person.
  if (key.startsWith('prop.')) {
    const variant = key.split('.')[1] ?? 'crate';
    return { kind: 'painter', painter: 'prop', palette: 'neutral', variant };
  }

  return { kind: 'painter', painter: 'bender', palette: 'neutral' };
}
