/**
 * The icon sprite, built from the Game Icons set.
 *
 *   npm run art:icons            # rewrite public/art/icons/game-icons.svg
 *   npm run art:icons -- --check # fail if it is out of date
 *
 * Reads `@iconify-json/game-icons`, a development dependency that never
 * reaches the bundle, and writes one `<symbol>` per mark kind named by
 * `ICON_IDS` in `src/app/ui/icons.ts`. That table is the only place an icon
 * is chosen; this script has no list of its own, so the sprite and the game
 * cannot disagree about which icon a kind gets.
 *
 * The set is CC BY 3.0. The credit lives in `src/content/credits.ts` and
 * shows in the game, which is what that licence asks for.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import iconSet from '@iconify-json/game-icons/icons.json';
import { ICON_IDS, SPRITE_URL, SYMBOL_PREFIX } from '../../src/app/ui/icons';
import { MARK_KINDS } from '../../src/app/ui/marks';

interface IconSet {
  readonly width?: number;
  readonly height?: number;
  readonly icons: Record<string, { body: string; width?: number; height?: number } | undefined>;
  readonly aliases?: Record<string, { parent: string } | undefined>;
}

const set = iconSet as unknown as IconSet;

/** An icon by name, following an alias to the icon it stands for. */
function iconNamed(name: string): { body: string; width: number; height: number } {
  const direct = set.icons[name];
  const parent = direct ? undefined : set.aliases?.[name]?.parent;
  const icon = direct ?? (parent ? set.icons[parent] : undefined);
  if (!icon) throw new Error(`Game Icons has no "${name}"`);
  return {
    body: icon.body,
    width: icon.width ?? set.width ?? 512,
    height: icon.height ?? set.height ?? 512,
  };
}

/** The sprite: one symbol per mark kind, in the order the kinds are declared. */
export function spriteText(): string {
  const symbols = MARK_KINDS.map((kind) => {
    const icon = iconNamed(ICON_IDS[kind]);
    const id = `${SYMBOL_PREFIX}${kind}`;
    return `  <symbol id="${id}" viewBox="0 0 ${icon.width} ${icon.height}">${icon.body}</symbol>`;
  });
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">',
    // Generated: the table that picks these is src/app/ui/icons.ts.
    '  <!-- Game Icons, CC BY 3.0. Rebuild with: npm run art:icons -->',
    ...symbols,
    '</svg>',
    '',
  ].join('\n');
}

const target = resolve('public', SPRITE_URL);

// Importing this module (the drift test does) must not write or exit.
if (process.argv[1]?.endsWith('icons.ts')) {
  const text = spriteText();
  if (process.argv.includes('--check')) {
    let current = '';
    try {
      current = readFileSync(target, 'utf8');
    } catch {
      console.error(`${SPRITE_URL} is missing. Run: npm run art:icons`);
      process.exit(1);
    }
    if (current !== text) {
      console.error(`${SPRITE_URL} is out of date with ICON_IDS. Run: npm run art:icons`);
      process.exit(1);
    }
    console.warn(`${SPRITE_URL} matches the icon table.`);
  } else {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, text);
    const kb = Math.round(text.length / 1024);
    console.warn(`wrote ${target} (${MARK_KINDS.length} icons, ${kb} KB)`);
    console.warn('Then: npm run check:assets');
  }
}
