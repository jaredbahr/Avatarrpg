import { describe as suite, expect, it } from 'vitest';
import { CONTENT, CONTENT_BUNDLE } from '../../content';
import { conditionSchema, validateContent } from '../../content/schemas';
import { RETURNEES_HOME } from '../../content/story/return';
import type { Condition } from '../types';
import { describe } from './conditions';

type KindFixtures = {
  [K in Condition['kind']]: {
    condition: Extract<Condition, { kind: K }>;
    terms: readonly string[];
  };
};

// Matching Extract types make new kinds and fixtures under the wrong key fail
// compilation. The expectations name concepts, not an editorial sentence.
const kinds = {
  flag: { condition: { kind: 'flag', key: 'ruon_spared', op: 'set' }, terms: ['ruon', 'spared'] },
  partyHas: { condition: { kind: 'partyHas', characterId: 'kaya' }, terms: ['Kaya'] },
  standing: {
    condition: { kind: 'standing', nation: 'earth', op: 'gte', value: 2 },
    terms: ['Earth Kingdom'],
  },
  visited: { condition: { kind: 'visited', nodeId: 'after_forest' }, terms: ['been', 'before'] },
  partySize: { condition: { kind: 'partySize', op: 'gte', value: 3 }, terms: ['at least', '3'] },
  all: {
    condition: {
      kind: 'all',
      of: [
        { kind: 'partyHas', element: 'fire' },
        { kind: 'partySize', op: 'gte', value: 3 },
        { kind: 'visited', nodeId: 'after_forest' },
      ],
    },
    terms: ['firebender', 'at least', '3', 'been', 'before'],
  },
  any: {
    condition: {
      kind: 'any',
      of: [
        { kind: 'partyHas', element: 'fire' },
        { kind: 'partyHas', element: 'water' },
      ],
    },
    terms: ['firebender', 'waterbender', 'or'],
  },
  not: {
    condition: {
      kind: 'not',
      of: {
        kind: 'any',
        of: [
          { kind: 'partyHas', element: 'fire' },
          { kind: 'partyHas', element: 'water' },
        ],
      },
    },
    terms: ['it is not true that', 'firebender', 'waterbender', 'or'],
  },
  phase: {
    condition: { kind: 'phase', in: ['dawn', 'evening'] },
    terms: ['it is', 'dawn', 'evening', 'or'],
  },
  residentProfile: {
    condition: { kind: 'residentProfile', residentId: 'lw.npc.bo_shan', in: ['returning'] },
    terms: ['Bo-shan', 'returning'],
  },
} satisfies KindFixtures;

interface LocatedCondition {
  readonly path: string;
  readonly condition: Condition;
}

/** Retain every owner path, including aliases and each nested child. */
function collectConditions(
  value: unknown,
  path: string,
  found: LocatedCondition[] = [],
): LocatedCondition[] {
  if (Array.isArray(value)) {
    value.forEach((child, index) => {
      const id = child && typeof child === 'object' && 'id' in child ? `:${String(child.id)}` : '';
      collectConditions(child, `${path}[${index}${id}]`, found);
    });
  } else if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.kind === 'string' && Object.hasOwn(kinds, record.kind)) {
      // An unexpected same-kind object is a failure, never silently omitted.
      conditionSchema.parse(record);
      found.push({ path, condition: record as unknown as Condition });
    }
    for (const [key, child] of Object.entries(record))
      collectConditions(child, `${path}.${key}`, found);
  }
  return found;
}

// Walk the entire validated bundle, not selected `when` fields: this includes
// story options/variants, map exits/triggers/props/NPC routes, encounter variants,
// resident overrides and any future condition-bearing fields in those records.
const actual = collectConditions(CONTENT_BUNDLE, 'content');
const named = [
  ...CONTENT.characters.values(),
  ...CONTENT.residents.values(),
  ...CONTENT.enemies.values(),
  ...CONTENT.disciplines.values(),
  ...CONTENT.abilities.values(),
  ...CONTENT.props.values(),
];
const rawIds = new Set(
  named
    .filter((entry) => entry.id !== entry.name && /[._-]/.test(entry.id))
    .map((entry) => entry.id),
);

function children(condition: Condition): readonly Condition[] {
  if (condition.kind === 'all' || condition.kind === 'any') return condition.of;
  return condition.kind === 'not' ? [condition.of] : [];
}

function assertReason(condition: Condition, path: string): string {
  const reason = describe(CONTENT, condition);
  expect(reason.trim(), path).not.toBe('');
  expect(reason, path).not.toMatch(/undefined|\[object| {2,}/);
  for (const token of reason.match(/[\p{L}\p{N}_.-]+/gu) ?? [])
    expect(rawIds.has(token.replace(/\.$/, '')), `${path}: raw identifier ${token}`).toBe(false);
  // This is the actual ConversationPanel fallback prefix. Its two current
  // gated story options supply authored hints; this tests the fallback contract.
  const framed = `Only if ${reason}.`;
  expect(framed, path).not.toMatch(/^Only if (?:at\s|in the\s)/i);
  expect(framed, path).not.toMatch(/\b(?:and|or)\s*[.)]/i);
  const requireNames = (node: Condition): void => {
    if (node.kind === 'residentProfile') {
      const resident = CONTENT.residents.get(node.residentId);
      if (!resident) throw new Error(`${path}: missing actual resident ${node.residentId}`);
      expect(reason, path).toContain(resident.name);
    }
    if (node.kind === 'partyHas' && node.characterId) {
      const character = CONTENT.characters.get(node.characterId);
      if (!character) throw new Error(`${path}: missing actual character ${node.characterId}`);
      expect(reason, path).toContain(character.name);
    }
    children(node).forEach(requireNames);
  };
  requireNames(condition);
  return reason;
}

function assertTerms(reason: string, terms: readonly string[], path: string): void {
  for (const term of terms) expect(reason.toLowerCase(), path).toContain(term.toLowerCase());
}

function assertMixedGroups(condition: Condition, path: string): void {
  if (condition.kind === 'all' || condition.kind === 'any') {
    const reason = describe(CONTENT, condition);
    for (const child of condition.of) {
      // Parentheses express scope rather than fixing punctuation elsewhere.
      const alternatives =
        (child.kind === 'any' && child.of.length > 1) ||
        ((child.kind === 'phase' || child.kind === 'residentProfile') && child.in.length > 1);
      const conjunction = child.kind === 'all' && child.of.length > 1;
      if ((condition.kind === 'all' && alternatives) || (condition.kind === 'any' && conjunction))
        expect(reason, path).toContain(`(${describe(CONTENT, child)})`);
    }
  }
  children(condition).forEach((child, index) =>
    assertMixedGroups(child, `${path}.child[${index}]`),
  );
}

suite('player-facing condition descriptions', () => {
  it('collects every actual nested condition with its content provenance', () => {
    expect(validateContent(CONTENT_BUNDLE)).toEqual([]);
    for (const root of ['story', 'maps', 'encounters', 'residents'])
      expect(
        actual.filter((entry) => entry.path.startsWith(`content.${root}[`)).length,
        root,
      ).toBeGreaterThan(0);
    for (const entry of actual) {
      const nested = children(entry.condition);
      for (const child of nested)
        expect(
          actual.some(
            (candidate) =>
              candidate.condition === child && candidate.path.startsWith(entry.path + '.'),
          ),
          entry.path,
        ).toBe(true);
    }
    process.stdout.write(
      `${JSON.stringify({ kind: 'condition description coverage', actualConditions: actual.length, byRoot: Object.fromEntries(['story', 'maps', 'encounters', 'residents', 'disciplines'].map((root) => [root, actual.filter((entry) => entry.path.startsWith(`content.${root}[`)).length])), kinds: [...new Set(actual.map((entry) => entry.condition.kind))].sort() })}\n`,
    );
  });

  it.each(actual)('describes actual $path', ({ condition, path }) => {
    assertReason(condition, path);
    assertMixedGroups(condition, path);
  });

  it.each(Object.entries(kinds))(
    'covers the %s kind with a matching typed fixture',
    (kind, fixture) => {
      expect(fixture.condition.kind).toBe(kind);
      const reason = assertReason(fixture.condition, `kind ${kind}`);
      assertTerms(reason, fixture.terms, kind);
      assertMixedGroups(fixture.condition, kind);
    },
  );

  it('uses the real returning Bo-shan identity, not a humanised storage key', () => {
    const entry = actual.find(
      ({ condition }) =>
        condition.kind === 'residentProfile' &&
        condition.residentId === 'lw.npc.bo_shan' &&
        condition.in.includes('returning'),
    );
    if (!entry) throw new Error('No actual Bo-shan returning condition was collected');
    assertTerms(assertReason(entry.condition, entry.path), ['Bo-shan', 'returning'], entry.path);
  });

  it('retains the alternatives inside Gao’s actual plant-chair conjunction', () => {
    const village = CONTENT.maps.get('ba_dan_village');
    const route = village?.npcs
      .find((npc) => npc.id === 'shopkeeper_gao')
      ?.routes?.find((candidate) => candidate.node === 'plant_chair');
    if (!route) throw new Error('Missing actual Gao plant-chair route');
    expect(route.when.kind).toBe('all');
    assertMixedGroups(route.when, 'Gao plant-chair route');
  });

  it.each(['dawn', 'morning', 'midday', 'afternoon', 'evening', 'night'] as const)(
    'fits phase %s after the actual Only if prefix',
    (phase) => {
      const reason = assertReason({ kind: 'phase', in: [phase] }, `phase ${phase}`);
      assertTerms(reason, ['it is', phase], phase);
    },
  );

  it('keeps not(any(...)) under one complete, clearly scoped negation', () => {
    const condition = kinds.not.condition;
    const inner = describe(CONTENT, condition.of);
    const reason = assertReason(condition, 'generated not(any)');
    assertTerms(reason, ['it is not true that', 'firebender', 'waterbender'], 'generated not(any)');
    expect(reason).toContain(`(${inner})`);
    expect(reason.match(/it is not true that/gi)).toHaveLength(1);
  });

  it('retains every clause in conjunctions of three and four requirements', () => {
    const clauses: Condition[] = [
      kinds.partyHas.condition,
      kinds.partySize.condition,
      kinds.visited.condition,
      kinds.standing.condition,
    ];
    for (const count of [3, 4]) {
      const condition: Condition = { kind: 'all', of: clauses.slice(0, count) };
      const reason = assertReason(condition, `generated all${count}`);
      for (const child of condition.of) expect(reason).toContain(describe(CONTENT, child));
      expect(reason.match(/\band\b/g)).toHaveLength(count - 1);
    }
  });

  it('groups multiple alternative phases when another requirement also applies', () => {
    const phase = kinds.phase.condition;
    const condition: Condition = { kind: 'all', of: [phase, kinds.partyHas.condition] };
    const reason = assertReason(condition, 'generated phase conjunction');
    expect(reason).toContain(`(${describe(CONTENT, phase)})`);
    expect(reason).toContain(describe(CONTENT, kinds.partyHas.condition));
  });

  it('groups alternative resident profiles when another requirement also applies', () => {
    const profile: Condition = {
      kind: 'residentProfile',
      residentId: 'lw.npc.bo_shan',
      in: ['resting', 'recovering', 'ready'],
    };
    const condition: Condition = { kind: 'all', of: [profile, kinds.partyHas.condition] };
    const reason = assertReason(condition, 'generated resident-profile conjunction');
    assertTerms(
      reason,
      ['Bo-shan', 'resting', 'recovering', 'ready', 'Kaya'],
      'generated resident-profile conjunction',
    );
    assertMixedGroups(condition, 'generated resident-profile conjunction');
  });

  it('retains every alternative profile inside the real returnees-home condition', () => {
    const entry = actual.find(({ condition }) => condition === RETURNEES_HOME);
    if (!entry) throw new Error('The actual returnees-home condition was not collected');
    assertReason(entry.condition, entry.path);
    assertMixedGroups(entry.condition, entry.path);
  });

  it('labels discipline flag adapters separately from actual Condition objects', () => {
    // DisciplineDef uses requiresFlag, not Condition. These derived cases do
    // not contribute to the actual-content condition count above.
    expect(actual.filter((entry) => entry.path.startsWith('content.disciplines['))).toEqual([]);
    const gated = CONTENT_BUNDLE.disciplines.filter(
      (discipline) => discipline.requiresFlag !== null,
    );
    expect(gated.length).toBeGreaterThan(0);
    for (const discipline of gated) {
      const key = discipline.requiresFlag;
      if (key === null) throw new Error('Missing gated discipline flag');
      assertReason(
        { kind: 'flag', key, op: 'set' },
        `derived discipline ${discipline.id}.requiresFlag`,
      );
      expect(discipline.lockedHint.trim(), discipline.id).not.toBe('');
      expect(discipline.lockedHint, discipline.id).not.toMatch(/undefined|\[object| {2,}/);
    }
  });
});
