import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ALL_STORY, CONTENT } from '../../src/content';
import { describe as describeCondition } from '../../src/core/story/conditions';
import type { Condition, ContentIndex, StoryNode } from '../../src/core/types';
import {
  STORY_GROUPS,
  buildStoryGraph,
  escapeMermaidLabel,
  generateStoryDocs,
  runCli,
  syncStoryDocs,
} from './story-graph';
import type { StoryGraphOptions, StoryGroup } from './story-graph';

function dialogue(id: string, next: string): StoryNode {
  return {
    id,
    kind: 'dialogue',
    speaker: 'Fixture speaker',
    portrait: '',
    lines: ['A line.'],
    next,
  };
}

function ending(id: string, next?: string): StoryNode {
  return { id, kind: 'end', title: 'The end', lines: [], teaser: '', next };
}

function fixture(nodes: readonly StoryNode[], groups?: readonly StoryGroup[]): StoryGraphOptions {
  return {
    content: { ...CONTENT, story: new Map(nodes.map((node) => [node.id, node])), maps: new Map() },
    runtimeNodes: nodes,
    groups: groups ?? [{ slug: 'fixture', title: 'Fixture', source: 'fixture.ts', nodes }],
    entryNodeIds: [],
  };
}

/** Read authored transition fields independently of graph extraction/rendering. */
function authoredPairs(nodes: readonly StoryNode[]): string[] {
  return nodes
    .flatMap((node) => {
      const targets =
        node.kind === 'choice'
          ? node.options.map((option) => option.next)
          : node.kind === 'battle'
            ? [node.next, node.onDefeat]
            : node.kind === 'branch'
              ? [node.ifSet, node.ifUnset]
              : node.kind === 'end'
                ? node.next === undefined
                  ? []
                  : [node.next]
                : [node.next];
      return targets.map((target) => `${node.id} -> ${target}`);
    })
    .sort();
}

const temporaryDirectories: string[] = [];
async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'avatar-story-graph-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('runtime story graph', () => {
  it('covers every effective runtime node and every authored transition exactly once', async () => {
    const graph = buildStoryGraph();
    expect(graph.nodes.map((item) => item.node.id).sort()).toEqual(
      [...CONTENT.story.keys()].sort(),
    );
    expect(graph.nodes).toHaveLength(ALL_STORY.length);
    for (const item of graph.nodes) expect(item.node).toBe(CONTENT.story.get(item.node.id));
    expect(graph.edges.map((edge) => `${edge.from} -> ${edge.to}`).sort()).toEqual(
      authoredPairs([...CONTENT.story.values()]),
    );
    expect(graph.parts.flatMap((part) => part.nodeIds).sort()).toEqual(
      [...CONTENT.story.keys()].sort(),
    );
    const documents = await generateStoryDocs();
    expect([...documents.keys()].sort()).toEqual([
      'README.md',
      'act1.md',
      'ba-dan-day.md',
      'discoveries.md',
      'return.md',
      'riverside.md',
      'sq01-cabbages.md',
      'world.md',
    ]);
    expect([...documents.values()].join('\n').match(/ -->\|/g)).toHaveLength(graph.edges.length);
    expect(documents.get('README.md')).toContain(`${ALL_STORY.length} nodes;`);
    for (const group of STORY_GROUPS) {
      const nodes = graph.nodes.filter((item) => item.group === group.slug);
      expect(documents.get(`${group.slug}.md`)).toContain(
        `${nodes.length} nodes; ${nodes.filter((item) => item.node.kind === 'battle').length} fights; ${nodes.filter((item) => item.node.kind === 'branch').length} branches;`,
      );
    }
  });

  it('uses effective party voice dialogue nodes without inventing variant transitions', () => {
    const graph = buildStoryGraph();
    const augmented = graph.nodes.find((item) => {
      const source = STORY_GROUPS.flatMap((group) => group.nodes).find(
        (node) => node.id === item.node.id,
      );
      return (
        item.node.kind === 'dialogue' &&
        source?.kind === 'dialogue' &&
        (item.node.variants?.length ?? 0) > (source.variants?.length ?? 0)
      );
    });
    expect(augmented?.node.kind).toBe('dialogue');
    if (augmented?.node.kind !== 'dialogue')
      throw new Error('Expected runtime party voice dialogue');
    expect(augmented.node).toBe(CONTENT.story.get(augmented.node.id));
    expect(graph.edges.filter((edge) => edge.from === augmented.node.id)).toEqual([
      { from: augmented.node.id, to: augmented.node.next, label: 'Next' },
    ]);
  });

  it('describes choice conditions using real content and preserves false, zero and string flag values', () => {
    const condition: Condition = {
      kind: 'all',
      of: [
        { kind: 'partyHas', characterId: 'kaya' },
        { kind: 'flag', key: 'score', op: 'gte', value: 0 },
      ],
    };
    const nodes: StoryNode[] = [
      {
        id: 'choose',
        kind: 'choice',
        speaker: 'Guide',
        portrait: '',
        prompt: 'Choose',
        options: [
          {
            label: 'Ask Kaya',
            detail: '',
            next: 'finish',
            requires: condition,
            lockedHint: 'This hint must not replace the actual condition.',
            setFlags: { zero: 0, text: 'said "yes"', disabled: false },
            adjust: { earth: -1 },
          },
        ],
      },
      ending('finish'),
    ];
    const edge = buildStoryGraph(fixture(nodes)).edges[0];
    expect(edge?.label).toContain(`Ask Kaya; requires: ${describeCondition(CONTENT, condition)}`);
    expect(edge?.label).toContain(`disabled=false, text=${JSON.stringify('said "yes"')}, zero=0`);
    expect(edge?.label).toContain('standing deltas: earth=-1');
    expect(edge?.label).not.toContain('This hint');
  });

  it('truncates long option text while retaining the complete gate and mutation metadata', () => {
    const label = 'A long option with a clear opening and additional consequences. '.repeat(4);
    const condition: Condition = {
      kind: 'flag',
      key: 'a_deliberately_long_required_story_flag',
      op: 'eq',
      value: 'ready for the complete condition',
    };
    const nodes: StoryNode[] = [
      {
        id: 'choose',
        kind: 'choice',
        speaker: 'Guide',
        portrait: '',
        prompt: 'Choose',
        options: [
          {
            label,
            detail: '',
            next: 'finish',
            requires: condition,
            setFlags: { result: 'a deliberately long stored value that must remain complete' },
            adjust: { earth: 2 },
          },
        ],
      },
      ending('finish'),
    ];
    const text = buildStoryGraph(fixture(nodes)).edges[0]?.label ?? '';
    const optionText = text.split('; requires: ')[0] ?? '';
    expect(Array.from(optionText)).toHaveLength(64);
    expect(optionText).toBe(`${label.slice(0, 63)}…`);
    expect(text).toContain(`requires: ${describeCondition(CONTENT, condition)}`);
    expect(text).toContain(
      'set: result="a deliberately long stored value that must remain complete"',
    );
    expect(text).toContain('standing deltas: earth=2');
  });

  it('includes both truthiness branches, battle outcomes, flag effects, ending continuations and cycles', async () => {
    const encounter = [...CONTENT.encounters.values()][0];
    if (encounter === undefined) throw new Error('Expected a real encounter');
    const nodes: StoryNode[] = [
      { id: 'branch', kind: 'branch', flag: 'chosen', ifSet: 'fight', ifUnset: 'flags' },
      { id: 'fight', kind: 'battle', encounterId: encounter.id, next: 'finish', onDefeat: 'loss' },
      {
        id: 'flags',
        kind: 'flags',
        set: { chosen: false, count: 0, text: 'done' },
        phase: 'evening',
        grantXp: 25,
        residentProfiles: { 'lw.npc.gao': 'ready' },
        next: 'finish',
      },
      ending('finish', 'branch'),
      ending('loss'),
    ];
    const options = fixture(nodes);
    const graph = buildStoryGraph(options);
    expect(graph.edges.map((edge) => [edge.from, edge.to, edge.label])).toEqual(
      expect.arrayContaining([
        ['branch', 'fight', expect.stringContaining('chosen: truthy')],
        ['branch', 'flags', expect.stringContaining('chosen: falsy')],
        ['fight', 'finish', 'Victory'],
        ['fight', 'loss', 'Defeat'],
        ['finish', 'branch', 'Continue after ending'],
      ]),
    );
    expect(graph.edges).toHaveLength(6);
    const flagLabel = graph.edges.find((edge) => edge.from === 'flags')?.label;
    expect(flagLabel).toContain('chosen=false, count=0, text="done"');
    expect(flagLabel).toContain(
      'phase: evening; grant XP: 25; resident profiles: lw.npc.gao="ready"',
    );
    const markdown = (await generateStoryDocs(options)).get('fixture.md');
    expect(markdown).toContain(
      `Fight: ${encounter.id} (expected level ${encounter.expectedLevel})`,
    );
    expect(markdown).toMatch(/n\d+\{\{"fight<br\/>Fight:/);
    expect(markdown).toMatch(/n\d+\{"branch<br\/>Branch:/);
  });

  it('marks effective map interaction entries without fabricating edges or live travel progression', () => {
    const map = [...CONTENT.maps.values()].find((candidate) => candidate.exits?.length);
    if (map === undefined) throw new Error('Expected a connected map');
    const nodes: StoryNode[] = [
      { id: 'explore', kind: 'explore', mapId: map.id, objective: 'Walk', next: 'fallback' },
      ending('fallback'),
      dialogue('npc', 'explore'),
      dialogue('route', 'explore'),
      dialogue('trigger', 'explore'),
    ];
    const options = fixture(nodes);
    const content: ContentIndex = {
      ...(options.content ?? CONTENT),
      maps: new Map([
        [
          map.id,
          {
            ...map,
            npcs: [
              {
                id: 'fixture',
                name: 'Fixture',
                sprite: '',
                node: 'npc',
                routes: [{ when: { kind: 'flag', key: 'ready', op: 'set' }, node: 'route' }],
              },
            ],
            triggers: [
              {
                id: 'fixture',
                area: [],
                label: 'Fixture',
                sprite: '',
                node: 'trigger',
                once: true,
              },
            ],
          },
        ],
      ]),
    };
    const graph = buildStoryGraph({ ...options, content });
    for (const id of ['npc', 'route', 'trigger'])
      expect(graph.nodes.find((item) => item.node.id === id)?.entry).toBe(true);
    expect(graph.edges.map((edge) => `${edge.from} -> ${edge.to}`).sort()).toEqual(
      authoredPairs(nodes),
    );
    expect(graph.edges.find((edge) => edge.from === 'explore')?.label).toBe(
      'Legacy/audit exit (live map exits differ)',
    );
  });

  it('rejects duplicate runtime IDs and missing or ambiguous group coverage', () => {
    const first = ending('one');
    const second = ending('two');
    const nodes = [first, second];
    const options = fixture(nodes);
    expect(() => buildStoryGraph({ ...options, runtimeNodes: [...nodes, first] })).toThrow(
      'Duplicate runtime story ID: one',
    );
    expect(() => buildStoryGraph({ ...options, runtimeNodes: [first] })).toThrow(
      'omitted from runtime nodes: two',
    );
    expect(() =>
      buildStoryGraph(
        fixture(nodes, [{ slug: 'first', title: 'First', source: 'first.ts', nodes: [first] }]),
      ),
    ).toThrow('no registered group: two');
    expect(() =>
      buildStoryGraph(
        fixture(nodes, [
          { slug: 'first', title: 'First', source: 'first.ts', nodes: [first, first, second] },
        ]),
      ),
    ).toThrow('Duplicate grouped story ID: one');
    expect(() =>
      buildStoryGraph(
        fixture(nodes, [
          {
            slug: 'first',
            title: 'First',
            source: 'first.ts',
            nodes: [...nodes, ending('unknown')],
          },
        ]),
      ),
    ).toThrow('Unknown story ID in group first: unknown');
  });

  it('rejects unresolved transitions, encounters and map entries instead of drawing phantom targets', () => {
    expect(() => buildStoryGraph(fixture([dialogue('one', 'missing')]))).toThrow(
      'Missing story target: one -> missing',
    );
    expect(() =>
      buildStoryGraph(
        fixture([
          { id: 'fight', kind: 'battle', encounterId: 'missing', next: 'fight', onDefeat: 'fight' },
        ]),
      ),
    ).toThrow('Missing encounter missing');
    expect(() =>
      buildStoryGraph({ ...fixture([ending('one')]), entryNodeIds: ['missing'] }),
    ).toThrow('Missing story entry target: missing');
  });

  it('escapes Mermaid syntax and HTML in labels while keeping readable short node titles', async () => {
    const label = 'Say "yes" | <script> & #quot; `code` \\ path\nnext';
    const nodes: StoryNode[] = [
      {
        id: 'choose',
        kind: 'choice',
        speaker: 'A speaker',
        portrait: '',
        prompt: 'A long prompt '.repeat(20),
        options: [{ label, detail: '', next: 'finish' }],
      },
      ending('finish'),
    ];
    const markdown = (await generateStoryDocs(fixture(nodes))).get('fixture.md') ?? '';
    expect(escapeMermaidLabel(label)).toBe(
      'Say #quot;yes#quot; #124; #lt;script#gt; #amp; #35;quot; #96;code#96; #92; path next',
    );
    expect(markdown).toContain(escapeMermaidLabel(label));
    expect(markdown).not.toContain('<script>');
    expect(markdown).toContain('…');
    expect(markdown.match(/A long prompt/g)?.length).toBeLessThan(6);
  });

  it('keeps cross-file exits explicit and highlights their destination entry', async () => {
    const first = dialogue('start', 'finish');
    const last = ending('finish');
    const options = fixture(
      [first, last],
      [
        { slug: 'first', title: 'First', source: 'first.ts', nodes: [first] },
        { slug: 'last', title: 'Last', source: 'last.ts', nodes: [last] },
      ],
    );
    const graph = buildStoryGraph(options);
    expect(graph.nodes.find((item) => item.node.id === 'finish')?.entry).toBe(true);
    const documents = await generateStoryDocs(options);
    expect(documents.get('first.md')).toContain('finish — exit to last / part 1');
    expect(documents.get('first.md')).toContain('(./last.md#part-1)');
    expect(documents.get('first.md')).toContain(':::external');
    expect(documents.get('last.md')).toContain(':::entry');
  });

  it('splits a long linear story and cycle without losing or duplicating nodes or edges', async () => {
    const nodes = Array.from({ length: 161 }, (_, index) =>
      dialogue(
        `step_${String(index).padStart(3, '0')}`,
        `step_${String((index + 1) % 161).padStart(3, '0')}`,
      ),
    );
    const options = { ...fixture(nodes), entryNodeIds: ['step_000'] };
    const graph = buildStoryGraph(options);
    expect(graph.parts.map((part) => part.nodeIds.length)).toEqual([80, 80, 1]);
    expect(graph.parts.flatMap((part) => part.nodeIds).sort()).toEqual(
      nodes.map((node) => node.id).sort(),
    );
    expect(graph.edges.map((edge) => `${edge.from} -> ${edge.to}`).sort()).toEqual(
      authoredPairs(nodes),
    );
    const markdown = (await generateStoryDocs(options)).get('fixture.md') ?? '';
    expect(markdown.match(/ -->\|/g)).toHaveLength(161);
    for (const part of graph.parts) expect(markdown).toContain(`<a id="part-${part.number}"></a>`);
    expect(markdown).toContain('step_080 — continue / part 2');
    expect(markdown).toContain('(./fixture.md#part-2)');
    expect(markdown).toContain('step_160 — continue / part 3');
    expect(markdown).toContain('step_000 — continue / part 1');
    expect(markdown.match(/step_\d+<br\/>/g)).toHaveLength(161);
  });

  it('starts separate large-graph parts at independent entry points', () => {
    const nodes = Array.from({ length: 82 }, (_, index) =>
      dialogue(`node_${index}`, `node_${(index + 1) % 82}`),
    );
    const graph = buildStoryGraph({ ...fixture(nodes), entryNodeIds: ['node_0', 'node_41'] });
    expect(graph.parts.map((part) => part.entry)).toEqual(['node_0', 'node_41']);
    expect(graph.parts.map((part) => part.nodeIds.length)).toEqual([41, 41]);
  });

  it('produces identical bytes when source registration and index insertion order change', async () => {
    const forward = await generateStoryDocs();
    const reverse = await generateStoryDocs({
      content: {
        ...CONTENT,
        story: new Map([...CONTENT.story].reverse()),
        maps: new Map([...CONTENT.maps].reverse()),
      },
      runtimeNodes: [...ALL_STORY].reverse(),
      groups: [...STORY_GROUPS]
        .reverse()
        .map((group) => ({ ...group, nodes: [...group.nodes].reverse() })),
      entryNodeIds: ['act1_open'],
    });
    expect([...reverse]).toEqual([...forward]);
  });
});

describe('story documentation check and CLI', () => {
  it('checks missing and stale files without writing, and the CLI regenerates all eight documents', async () => {
    const directory = await temporaryDirectory();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await runCli(['--check'], directory)).toBe(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('missing or stale'));
    expect(await readdir(directory)).toEqual([]);
    expect(await runCli([], directory)).toBe(0);
    expect(await readdir(directory)).toHaveLength(8);
    expect(await runCli(['--check'], directory)).toBe(0);
    await writeFile(join(directory, 'act1.md'), 'stale\n', 'utf8');
    await rm(join(directory, 'world.md'));
    expect(await runCli(['--check'], directory)).toBe(1);
    expect(error).toHaveBeenLastCalledWith(expect.stringContaining('act1.md, world.md'));
    expect(await readFile(join(directory, 'act1.md'), 'utf8')).toBe('stale\n');
    expect(await readdir(directory)).not.toContain('world.md');
    expect(await runCli([], directory)).toBe(0);
    expect(await runCli(['--check'], directory)).toBe(0);
    expect(await runCli(['--unknown'], directory)).toBe(1);
  });

  it('reports missing output in a nonexistent directory without creating it', async () => {
    const directory = join(await temporaryDirectory(), 'absent');
    expect(await syncStoryDocs(new Map([['README.md', 'expected\n']]), directory, true)).toEqual([
      'README.md',
    ]);
    await expect(readdir(directory)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
