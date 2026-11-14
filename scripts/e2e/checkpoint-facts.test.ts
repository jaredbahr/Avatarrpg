import { describe, expect, it } from 'vitest';
import {
  REPIN_COMMAND,
  diffFacts,
  factsReport,
  firstDivergence,
  saveShape,
} from './checkpoint-facts';

describe('save shape', () => {
  interface Member {
    id: string;
    cooldowns: Record<string, number>;
    statuses: { id: string }[];
  }
  const party: Member[] = [
    { id: 'p0', cooldowns: {}, statuses: [] },
    { id: 'p1', cooldowns: { fire_jab: 1 }, statuses: [{ id: 'wet' }] },
  ];
  const flags: Record<string, number | boolean> = { 'standing.earth': 0, ruon_traded: true };
  const save = {
    format: 5,
    state: {
      flags,
      party,
      battle: null,
    },
  };

  it('lists every key path with its type, whatever the lengths and ids', () => {
    expect(saveShape(JSON.stringify(save))).toEqual([
      'save.format: number',
      'save.state.battle: null',
      'save.state.flags.*: boolean',
      'save.state.flags.*: number',
      'save.state.party[].cooldowns.*: number',
      'save.state.party[].cooldowns: {}',
      'save.state.party[].id: string',
      'save.state.party[].statuses: []',
      'save.state.party[].statuses[].id: string',
    ]);
  });

  it('does not move when a fight only ran longer or set another flag', () => {
    const longer = structuredClone(save);
    longer.state.flags = { 'standing.earth': 2, ruon_traded: false, act1_complete: true };
    longer.state.party.push({
      id: 'p2',
      cooldowns: { rock_throw: 2 },
      statuses: [{ id: 'rooted' }],
    });
    expect(saveShape(JSON.stringify(longer))).toEqual(saveShape(JSON.stringify(save)));
  });

  it('names a field the save gained, lost or retyped', () => {
    const next = structuredClone(save) as unknown as {
      format: string;
      state: { battle: unknown; openingRng?: number; party?: unknown };
    };
    next.format = 'five';
    next.state.openingRng = 7;
    delete next.state.party;
    expect(
      diffFacts(saveShape(JSON.stringify(save)), saveShape(JSON.stringify(next)), 'saveShape'),
    ).toEqual([
      'saveShape: - "save.format: number" (was item 1)',
      'saveShape: - "save.state.party[].cooldowns.*: number" (was item 5)',
      'saveShape: - "save.state.party[].cooldowns: {}" (was item 6)',
      'saveShape: - "save.state.party[].id: string" (was item 7)',
      'saveShape: - "save.state.party[].statuses: []" (was item 8)',
      'saveShape: - "save.state.party[].statuses[].id: string" (was item 9)',
      'saveShape: + "save.format: string" (first)',
      'saveShape: + "save.state.openingRng: number" (after "save.state.flags.*: number")',
    ]);
  });
});

describe('fact diff', () => {
  const gate = {
    story: { nodeId: 'gate_trade_explore', visited: ['act1_open', 'gate_parley', 'ruon_choice'] },
    party: [
      { id: 'p0', level: 3, xp: 400, abilities: ['fire_jab', 'flame_arc'] },
      { id: 'p1', level: 3, xp: 400, abilities: ['water_whip'] },
    ],
    flags: { ruon_traded: true },
    world: { cleared: ['enc_forest_road'] },
  };

  it('is empty for equal facts', () => {
    expect(diffFacts(gate, structuredClone(gate), 'trade.gate')).toEqual([]);
  });

  it('names each moved fact by its path, with the old and the new value', () => {
    const next: Omit<typeof gate, 'flags'> & { flags: Record<string, boolean> } =
      structuredClone(gate);
    next.story.nodeId = 'gate_escort_explore';
    next.story.visited.splice(2, 0, 'gate_ruon_listens');
    next.party[1]!.xp = 420;
    next.party[0]!.abilities = ['flame_arc', 'fire_jab'];
    next.flags = { ruon_spared: true };
    next.world.cleared = [];
    expect(diffFacts(gate, next, 'trade.gate')).toEqual([
      'trade.gate.story.nodeId: "gate_trade_explore" -> "gate_escort_explore"',
      'trade.gate.story.visited: + "gate_ruon_listens" (after "gate_parley")',
      'trade.gate.party[0].abilities: same items, new order: ["fire_jab","flame_arc"] -> ["flame_arc","fire_jab"]',
      'trade.gate.party[1].xp: 400 -> 420',
      '- trade.gate.flags.ruon_traded: true',
      '+ trade.gate.flags.ruon_spared: true',
      'trade.gate.world.cleared: - "enc_forest_road" (was item 1)',
    ]);
  });

  it('names a party member who joined or left', () => {
    expect(diffFacts(gate.party, [gate.party[0]], 'party')).toEqual([
      '- party[1]: {"id":"p1","level":3,"xp":400,"abilities":["water_whip"]}',
    ]);
    expect(diffFacts([gate.party[0]], gate.party, 'party')).toEqual([
      '+ party[1]: {"id":"p1","level":3,"xp":400,"abilities":["water_whip"]}',
    ]);
  });

  it('treats a missing pin as every fact being new', () => {
    expect(diffFacts(undefined, { nodeId: 'a' }, 'trade.gate')).toEqual([
      'trade.gate: undefined -> {"nodeId":"a"}',
    ]);
  });

  it('writes a failure that says what moved and how to re-pin it', () => {
    const report = factsReport('The trade gate checkpoint', ['a: 1 -> 2', 'b: 2 -> 3', 'c'], 2);
    expect(report.split('\n')).toEqual([
      'The trade gate checkpoint: 3 pinned facts moved.',
      '  a: 1 -> 2',
      '  b: 2 -> 3',
      '  ... and 1 more',
      `If your change means to move them, run \`${REPIN_COMMAND}\` and paste its summary into the pull request.`,
      'If it does not, the lines above are the regression.',
    ]);
  });
});

describe('transcript divergence', () => {
  const walk = { type: 'walkTo', pos: { x: 1, y: 1 } } as const;
  const end = { type: 'endTurn', unitId: 'p0' } as const;

  it('is null for the same transcript', () => {
    expect(firstDivergence([walk, end], [walk, end])).toBeNull();
  });

  it('names the first command that differs', () => {
    expect(firstDivergence([walk, end], [walk, { ...end, unitId: 'p1' }])).toBe(
      'command 2: {"type":"endTurn","unitId":"p0"} -> {"type":"endTurn","unitId":"p1"}',
    );
  });

  it('says when one transcript only runs longer', () => {
    expect(firstDivergence([walk], [walk, end])).toBe(
      'the first 1 commands agree; then 1 -> 2 commands',
    );
  });
});
