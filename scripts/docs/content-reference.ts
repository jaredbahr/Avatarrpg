import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { AbilityEffect, EncounterPlacement, KitEntry, Targeting } from '../../src/core/types';
import { describe } from '../../src/core/story/conditions';
import { ALL_MAPS, CHARACTERS, CONTENT, DISCIPLINES, ENEMIES, ENCOUNTERS } from '../../src/content';
import { ABILITY_BY_ID, UNIVERSAL_ABILITY_IDS } from '../../src/content/abilities';
import { ENEMY_BY_ID } from '../../src/content/enemies';
import { format, resolveConfig } from 'prettier';

const OUTPUT = resolve('docs/content-reference.md');
const CHECK = process.argv.includes('--check');

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sorted<T>(items: readonly T[], key: (item: T) => string): T[] {
  return [...items].sort((left, right) => compare(key(left), key(right)));
}

function kitEntry(entry: KitEntry): string {
  if ('ability' in entry) return `${entry.level}: ${abilityName(entry.ability)}`;
  if ('choose' in entry)
    return `${entry.level}: choose ${entry.choose.map(abilityName).join(' / ')}`;
  return `${entry.level}: specialize ${entry.specialize.map(disciplineName).join(' / ')}`;
}

function abilityName(id: string): string {
  return ABILITY_BY_ID.get(id)?.name ?? id;
}

function disciplineName(id: string): string {
  return DISCIPLINES.find((discipline) => discipline.id === id)?.name ?? id;
}

function targetText(target: Targeting): string {
  switch (target.shape) {
    case 'unit':
      return `unit (${target.allow})`;
    case 'blast':
      return `blast, radius ${target.radius}`;
    case 'line':
    case 'cone':
      return `${target.shape}, length ${target.length}`;
    case 'self':
    case 'tile':
      return target.shape;
  }
}

function effectText(effect: AbilityEffect): string {
  switch (effect.kind) {
    case 'damage':
      return `${effect.damageType} damage ${effect.base} + ${effect.scale}× power${effect.ignoreDefense ? ' (ignores defense)' : ''}`;
    case 'heal':
      return `healing ${effect.base} + ${effect.scale}× focus`;
    case 'status':
      return `${effect.status} for ${effect.duration} round${effect.duration === 1 ? '' : 's'} (${Math.round(effect.chance * 100)}%, to ${effect.to})`;
    case 'surface':
      return `${effect.surface} surface (${effect.area}, ${durationText(effect.duration)})`;
    case 'push':
    case 'pull':
      return `${effect.kind} ${effect.distance} tile${effect.distance === 1 ? '' : 's'}`;
    case 'dash':
      return 'dash';
    case 'wall':
      return `wall for ${durationText(effect.duration)}`;
    case 'cleanse':
      return `cleanse ${effect.statuses.join(', ')}`;
    case 'grantAp':
      return `grant ${effect.amount} AP to ${effect.to}`;
    case 'revealSurfaces':
      return 'reveal surfaces';
  }
}

function durationText(rounds: number): string {
  if (rounds < 0) return 'permanent';
  return `${rounds} round${rounds === 1 ? '' : 's'}`;
}

function abilityOwners(): Map<string, string[]> {
  const owners = new Map<string, Set<string>>();
  const add = (id: string, owner: string) => {
    const existing = owners.get(id) ?? new Set<string>();
    existing.add(owner);
    owners.set(id, existing);
  };
  const kitAbilities = (kit: readonly KitEntry[]) =>
    kit.flatMap((entry) =>
      'ability' in entry ? [entry.ability] : 'choose' in entry ? entry.choose : [],
    );

  for (const character of CHARACTERS) {
    for (const id of kitAbilities(character.kit)) add(id, `Character: ${character.name}`);
  }
  for (const discipline of DISCIPLINES) {
    for (const id of kitAbilities(discipline.kit)) add(id, `Discipline: ${discipline.name}`);
  }
  for (const enemy of ENEMIES) {
    for (const id of enemy.abilities) add(id, `Enemy: ${enemy.name}`);
  }
  for (const id of UNIVERSAL_ABILITY_IDS) add(id, 'Universal');

  return new Map([...owners].map(([id, values]) => [id, sorted([...values], (value) => value)]));
}

function placementList(placements: readonly EncounterPlacement[]): string {
  if (placements.length === 0) return '—';
  return placements
    .map((placement) => {
      const enemy = ENEMY_BY_ID.get(placement.enemyId);
      const label = enemy?.name ?? placement.enemyId;
      return `${label}${placement.level ? ` (level ${placement.level})` : ''}${placement.nameSuffix ? `, ${placement.nameSuffix}` : ''}`;
    })
    .join('; ');
}

function rosterXp(placements: readonly EncounterPlacement[]): number {
  return placements.reduce((total, placement) => {
    const enemy = ENEMY_BY_ID.get(placement.enemyId);
    if (!enemy) throw new Error(`Unknown enemy ${placement.enemyId} in encounter roster`);
    return total + enemy.xp;
  }, 0);
}

function percentDelta(value: number, baseline: number): string {
  if (baseline === 0) return 'n/a';
  const delta = ((value - baseline) / baseline) * 100;
  return `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`;
}

function generate(): string {
  const lines = [
    '# Content reference',
    '',
    '> Generated from `src/content/` by `npm run docs:content`. Do not edit by hand.',
    '',
    'Names are shown in authored content order within each entry; sections and records are sorted by name. Encounter XP totals cover the listed roster only. Conditional enemies, allied placements, and reinforcements are listed separately and do not affect the authored-roster comparison.',
    '',
    '## Characters',
    '',
  ];

  for (const character of sorted(CHARACTERS, (item) => item.name)) {
    lines.push(
      `### ${character.name}`,
      '',
      `- Element: ${character.element}`,
      `- Kit: ${character.kit.map(kitEntry).join('; ')}`,
      '',
    );
  }

  lines.push('## Disciplines', '');
  for (const discipline of sorted(DISCIPLINES, (item) => item.name)) {
    const availability = discipline.requiresFlag
      ? describe(CONTENT, { kind: 'flag', key: discipline.requiresFlag, op: 'set' })
      : 'always available';
    lines.push(
      `### ${discipline.name}`,
      '',
      `- Element: ${discipline.element}`,
      `- Availability: ${availability}`,
      `- Abilities: ${discipline.kit.map(kitEntry).join('; ')}`,
      '',
    );
  }

  lines.push(
    '## Abilities',
    '',
    '| Ability | Owner | AP | Range | Targeting | Line of sight | Effects | Cooldown | Status or surface |',
    '| --- | --- | ---: | --- | --- | --- | --- | ---: | --- |',
  );
  const owners = abilityOwners();
  for (const ability of sorted([...ABILITY_BY_ID.values()], (item) => item.name)) {
    const effects = ability.effects.map(effectText);
    const statusesAndSurfaces =
      ability.effects
        .flatMap((effect) =>
          effect.kind === 'status' || effect.kind === 'surface'
            ? [effect.kind === 'status' ? effect.status : effect.surface]
            : [],
        )
        .join(', ') || '—';
    lines.push(
      `| ${ability.name} | ${(owners.get(ability.id) ?? ['Unassigned']).join(', ')} | ${ability.apCost} | ${ability.minRange > 0 ? `${ability.minRange}–` : ''}${ability.range} | ${targetText(ability.targeting)} | ${ability.requiresLineOfSight ? 'yes' : 'no'} | ${effects.join('; ') || '—'} | ${ability.cooldown || '0 (every turn)'} | ${statusesAndSurfaces} |`,
    );
  }
  lines.push('');

  lines.push('## Enemies', '');
  for (const enemy of sorted(ENEMIES, (item) => item.name)) {
    const stats = Object.entries(enemy.stats)
      .sort(([left], [right]) => compare(left, right))
      .map(([name, value]) => `${name} ${value}`)
      .join(', ');
    lines.push(
      `### ${enemy.name}`,
      '',
      `- Stats: ${stats}`,
      `- Abilities: ${enemy.abilities.map(abilityName).join(', ')}`,
      `- XP: ${enemy.xp}`,
      '',
    );
  }

  const mapNames = new Map(ALL_MAPS.map((map) => [map.id, map.name]));
  lines.push('## Encounters', '');
  for (const encounter of sorted(ENCOUNTERS, (item) => item.name)) {
    const baseXp = rosterXp(encounter.enemies);
    const conditional =
      encounter.conditionalEnemies
        .map(
          (group) =>
            `${placementList(group.placements)} when ${group.flag} is ${group.whenSet ? 'set' : 'unset'}`,
        )
        .join('; ') || '—';
    const variants = encounter.variants.length
      ? encounter.variants
          .map((variant) => {
            const roster = variant.enemies ?? encounter.enemies;
            const xp = rosterXp(roster);
            return `${variant.id}: ${placementList(roster)} (${xp} XP, ${percentDelta(xp, baseXp)} vs authored roster)`;
          })
          .join('; ')
      : '—';
    lines.push(
      `### ${encounter.name}`,
      '',
      `- Map: ${mapNames.get(encounter.mapId) ?? encounter.mapId}`,
      `- Expected level: ${encounter.expectedLevel}`,
      `- Baseline party size: ${encounter.baselinePartySize}`,
      `- Authored roster: ${placementList(encounter.enemies)} (${baseXp} XP)`,
      `- Conditional enemies: ${conditional}`,
      `- Variants: ${variants}`,
      `- Allies: ${placementList(encounter.allies)}`,
      `- Reinforcements: ${placementList(encounter.reinforcements)}`,
      '',
    );
  }

  return `${lines.join('\n').replace(/\n+$/, '')}\n`;
}

async function main(): Promise<void> {
  const prettierOptions = (await resolveConfig(OUTPUT)) ?? {};
  const generated = await format(generate(), {
    ...prettierOptions,
    filepath: OUTPUT,
    parser: 'markdown',
  });
  if (CHECK) {
    let current: string;
    try {
      current = await readFile(OUTPUT, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      current = '';
    }
    if (current !== generated) {
      console.error(
        'Content reference is stale. Run `npm run docs:content` and commit the updated docs/content-reference.md.',
      );
      process.exitCode = 1;
    }
    return;
  }

  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, generated, 'utf8');
}

void main();
