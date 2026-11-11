/**
 * Test-only audit of explicit claims in authored ability descriptions.
 *
 * This is a finite grammar, not general language understanding. Numbered range,
 * shape, displacement, AP, cooldown, status and surface clauses are distinct.
 * Named statuses are classified as applications, cleanses, prerequisites,
 * surface contact or conditional reactions. Only stated facts are required.
 * Unconsumed numbers next to mechanical units/cues are reported for review.
 * Adding a new prose construction requires a grammar example, not an ability-ID
 * exemption. Flavor text is deliberately outside this check.
 */
import type { Ability, ContentIndex } from '../../src/core/types';

export interface DescriptionSpan {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

export interface DescriptionClaim {
  readonly abilityId: string;
  readonly kind: string;
  readonly span: DescriptionSpan;
  /** What the prose asserts. */
  readonly expected: unknown;
  /** The corresponding authored mechanic. */
  readonly actual: unknown;
}

export interface DescriptionIssue extends DescriptionClaim {
  readonly message: string;
}

export interface DescriptionAnalysis {
  readonly claims: readonly DescriptionClaim[];
  readonly issues: readonly DescriptionIssue[];
}

const WORD_NUMBERS: Readonly<Record<string, number>> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  a: 1,
  an: 1,
};
const NUMBER = '(?:\\d+(?:\\.\\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten)';
const DISTANCE = `(?:${NUMBER}|a|an)`;
const STATUS_FORMS: Readonly<Record<string, readonly string[]>> = {
  burning: ['Burning', 'Burn'],
  wet: ['Wet'],
  chilled: ['Chilled', 'Chill'],
  frozen: ['Frozen', 'Freeze'],
  shocked: ['Shocked', 'Shock'],
  stunned: ['Stunned', 'Stun'],
  slowed: ['Slowed', 'Slows', 'Slow'],
  blinded: ['Blinded', 'Blind'],
  rooted: ['Rooted', 'Roots', 'Root'],
  chiBlocked: ['Chi-Blocked', 'Chi-Blocks', 'Chi-Block'],
  guarded: ['Guarded'],
  inspired: ['Inspired'],
};

function number(value: string): number {
  return WORD_NUMBERS[value.toLowerCase()] ?? Number(value);
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface StatusMention {
  readonly id: string;
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

export function analyzeAbilityDescription(
  content: ContentIndex,
  ability: Ability,
  description = ability.description,
): DescriptionAnalysis {
  const claims: DescriptionClaim[] = [];
  const issues: DescriptionIssue[] = [];
  const classifiedNumbers: { start: number; end: number }[] = [];
  const span = (start: number, end: number): DescriptionSpan => ({
    start,
    end,
    text: description.slice(start, end),
  });
  const add = (
    kind: string,
    start: number,
    end: number,
    expected: unknown,
    actual: unknown,
    valid = expected === actual,
  ): void => {
    const claim: DescriptionClaim = {
      abilityId: ability.id,
      kind,
      span: span(start, end),
      expected,
      actual,
    };
    claims.push(claim);
    if (!valid) {
      issues.push({
        ...claim,
        message: `${kind}: stated ${JSON.stringify(expected)}, data ${JSON.stringify(actual)}`,
      });
    }
  };
  const mark = (start: number, raw: string): void => {
    classifiedNumbers.push({ start, end: start + raw.length });
  };
  const markCapture = (match: RegExpMatchArray, raw: string, last = true): void => {
    const offset = last ? match[0].lastIndexOf(raw) : match[0].indexOf(raw);
    mark((match.index ?? 0) + offset, raw);
  };
  const matches = (expression: RegExp, visit: (match: RegExpMatchArray) => void): void => {
    for (const match of description.matchAll(expression)) visit(match);
  };
  const numeric = (
    kind: string,
    match: RegExpMatchArray,
    raw: string,
    actual: unknown,
    valid?: boolean,
  ): void => {
    add(kind, match.index ?? 0, (match.index ?? 0) + match[0].length, number(raw), actual, valid);
    markCapture(match, raw);
  };
  const damage = ability.effects.filter((effect) => effect.kind === 'damage');
  const surfaces = ability.effects.filter((effect) => effect.kind === 'surface');
  const statuses = ability.effects.filter((effect) => effect.kind === 'status');
  const cleansed = ability.effects.flatMap((effect) =>
    effect.kind === 'cleanse' ? [...effect.statuses] : [],
  );
  const applications = [
    ...new Set([
      ...damage.map((effect) => effect.damageType),
      ...surfaces.map((effect) => effect.surface),
    ]),
  ];

  // Range is the authored base range, not a cone's depth, a line's length,
  // displacement, or the optional height-reach bonus.
  matches(
    new RegExp(`\\bwithin (${NUMBER})(?: tiles?\\b|(?=\\s+in a single burst\\b|[.!?,;:]|$))`, 'gi'),
    (match) => {
      const raw = match[1];
      if (raw) numeric('range', match, raw, ability.range);
    },
  );
  matches(new RegExp(`\\bup to (${NUMBER}) tiles? away\\b`, 'gi'), (match) => {
    const raw = match[1];
    if (raw) numeric('range', match, raw, ability.range);
  });
  matches(/\badjacent\b/gi, (match) => {
    add('range', match.index ?? 0, (match.index ?? 0) + match[0].length, 1, ability.range);
  });
  matches(
    new RegExp(`\\b(?:cone|fan|wave)\\b[^.!?;]*?\\b(${NUMBER}) tiles? deep\\b`, 'gi'),
    (match) => {
      const raw = match[1];
      if (raw)
        numeric(
          'shape',
          match,
          raw,
          ability.targeting.shape === 'cone' ? ability.targeting.length : ability.targeting.shape,
        );
    },
  );
  matches(new RegExp(`\\b(?:line of|along) (${NUMBER}) tiles?\\b`, 'gi'), (match) => {
    const raw = match[1];
    if (raw)
      numeric(
        'shape',
        match,
        raw,
        ability.targeting.shape === 'line' ? ability.targeting.length : ability.targeting.shape,
      );
  });
  matches(new RegExp(`\\b(${NUMBER})[×x](${NUMBER}) area\\b`, 'gi'), (match) => {
    const first = match[1];
    const second = match[2];
    if (!first || !second) return;
    const diameter =
      ability.targeting.shape === 'blast'
        ? 2 * ability.targeting.radius + 1
        : ability.targeting.shape;
    add(
      'shape',
      match.index ?? 0,
      (match.index ?? 0) + match[0].length,
      [number(first), number(second)],
      diameter,
      number(first) === diameter && number(second) === diameter,
    );
    markCapture(match, first, false);
    markCapture(match, second);
  });
  matches(
    new RegExp(
      `\\b(push(?:es|ed|ing)?|knock(?:s|ed|ing)?|drag(?:s|ged|ging)?|pull(?:s|ed|ing)?)\\b[^.!?;]*?\\b(${DISTANCE}) tiles?\\b`,
      'gi',
    ),
    (match) => {
      const verb = match[1];
      const raw = match[2];
      if (!verb || !raw) return;
      const kind = /^(?:drag|pull)/i.test(verb) ? 'pull' : 'push';
      const distances = ability.effects.flatMap((effect) =>
        (effect.kind === 'push' || effect.kind === 'pull') && effect.kind === kind
          ? [effect.distance]
          : [],
      );
      numeric('displacement', match, raw, distances, distances.includes(number(raw)));
    },
  );

  matches(new RegExp(`\\bthrown (${DISTANCE}) tiles? outward\\b`, 'gi'), (match) => {
    const raw = match[1];
    const distances = ability.effects.flatMap((effect) =>
      effect.kind === 'push' ? [effect.distance] : [],
    );
    if (raw) numeric('displacement', match, raw, distances, distances.includes(number(raw)));
  });
  matches(/\bonto (one|a|an) tile\b/gi, (match) => {
    const raw = match[1];
    const actual =
      ability.targeting.shape === 'tile' || surfaces.some((effect) => effect.area === 'center')
        ? 1
        : ability.targeting.shape;
    if (raw) numeric('surfacePlacement', match, raw, actual);
  });

  matches(new RegExp(`\\b(?:at|costs?|costing) (${NUMBER}) AP\\b`, 'gi'), (match) => {
    const raw = match[1];
    if (raw) numeric('apCost', match, raw, ability.apCost);
  });
  matches(new RegExp(`\\b(${NUMBER})[- ]AP cost\\b`, 'gi'), (match) => {
    const raw = match[1];
    if (raw) numeric('apCost', match, raw, ability.apCost);
  });
  matches(
    new RegExp(`\\b(?:gives? (?:you|them|an ally) )?(${NUMBER}) (?:extra AP|AP back)\\b`, 'gi'),
    (match) => {
      const raw = match[1];
      if (!raw) return;
      const amounts = ability.effects.flatMap((effect) =>
        effect.kind === 'grantAp' ? [effect.amount] : [],
      );
      numeric('apGrant', match, raw, amounts, amounts.includes(number(raw)));
    },
  );
  matches(
    new RegExp(`\\b(?:cooldown(?: of|:)?|recharges? (?:in|every)) (${NUMBER}) rounds?\\b`, 'gi'),
    (match) => {
      const raw = match[1];
      if (raw) numeric('cooldown', match, raw, ability.cooldown);
    },
  );
  matches(new RegExp(`\\b(${NUMBER})[- ]round cooldown\\b`, 'gi'), (match) => {
    const raw = match[1];
    if (raw) numeric('cooldown', match, raw, ability.cooldown);
  });
  matches(new RegExp(`\\b(?:once )?every (${NUMBER}) (?:rounds?|turns?)\\b`, 'gi'), (match) => {
    const raw = match[1];
    if (raw) numeric('cooldown', match, raw, ability.cooldown);
  });
  matches(/\b(?:only once a turn|one shot a turn)\b/gi, (match) => {
    add(
      'cooldownUpperBound',
      match.index ?? 0,
      (match.index ?? 0) + match[0].length,
      'at most one use per activation',
      ability.cooldown,
      ability.cooldown >= 1,
    );
    const one = /\bone\b/i.exec(match[0]);
    if (one) mark((match.index ?? 0) + one.index, one[0]);
  });

  matches(
    /\b(?:you can see|you must see|requires? (?:a clear view|line of sight))\b/gi,
    (match) => {
      add(
        'abilityLoS',
        match.index ?? 0,
        (match.index ?? 0) + match[0].length,
        true,
        ability.requiresLineOfSight,
      );
    },
  );
  matches(
    /\b(?:do(?:es)? not need a clear view|ignores? line of sight|no line of sight (?:is )?required)\b/gi,
    (match) => {
      add(
        'abilityLoS',
        match.index ?? 0,
        (match.index ?? 0) + match[0].length,
        false,
        ability.requiresLineOfSight,
      );
    },
  );
  matches(/\b(?:the )?cloud (does not block|blocks?) sight\b/gi, (match) => {
    const expected = match[1]?.toLowerCase() !== 'does not block';
    const values = surfaces.map((effect) => content.surfaces.get(effect.surface)?.blocksSight);
    add(
      'surfaceLoS',
      match.index ?? 0,
      (match.index ?? 0) + match[0].length,
      expected,
      values,
      values.length > 0 && values.every((value) => value === expected),
    );
  });

  matches(
    new RegExp(
      `\\bbase (?:fire |water |earth |air |cold |lightning |physical |pure )?damage(?::| of)? (${NUMBER})\\b`,
      'gi',
    ),
    (match) => {
      const raw = match[1];
      if (!raw) return;
      const bases = damage.map((effect) => effect.base);
      numeric('baseDamage', match, raw, bases, bases.includes(number(raw)));
    },
  );
  matches(
    new RegExp(
      `\\bbase (${NUMBER}) (?:fire |water |earth |air |cold |lightning |physical |pure )?damage\\b`,
      'gi',
    ),
    (match) => {
      const raw = match[1];
      if (!raw) return;
      const bases = damage.map((effect) => effect.base);
      numeric('baseDamage', match, raw, bases, bases.includes(number(raw)));
    },
  );
  matches(/\bignores? defen[cs]e\b/gi, (match) => {
    const values = damage.map((effect) => effect.ignoreDefense === true);
    add(
      'ignoreDefence',
      match.index ?? 0,
      (match.index ?? 0) + match[0].length,
      true,
      values,
      values.length > 0 && values.every(Boolean),
    );
  });
  matches(
    /\b(?:double damage against anyone Wet|Wet targets take double|doubled if they are Wet)\b/gi,
    (match) => {
      const values = damage.map(
        (effect) =>
          content.statuses.get('wet')?.modifiers.incomingMultiplier[effect.damageType] ?? 1,
      );
      add(
        'wetMultiplier',
        match.index ?? 0,
        (match.index ?? 0) + match[0].length,
        2,
        values,
        values.length > 0 && values.every((value) => value === 2),
      );
    },
  );

  // Status names are explicit aliases, not stemming. Clauses decide whether
  // a name denotes a prerequisite, cleanse, direct effect or terrain reaction.
  const aliasIds = new Map<string, string>();
  for (const definition of content.statuses.values()) {
    for (const form of [definition.name, ...(STATUS_FORMS[definition.id] ?? [])]) {
      aliasIds.set(form.toLowerCase(), definition.id);
    }
  }
  const statusExpression = new RegExp(
    `\\b(?:${[...aliasIds.keys()]
      .sort((a, b) => b.length - a.length)
      .map(escape)
      .join('|')})\\b`,
    'gi',
  );
  const mentions: StatusMention[] = [...description.matchAll(statusExpression)].map((match) => ({
    id: aliasIds.get(match[0].toLowerCase()) ?? match[0],
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
    text: match[0],
  }));
  const boundaryBefore = (position: number): number => {
    const before = description.slice(0, position);
    return Math.max(before.lastIndexOf('.'), before.lastIndexOf(';'), before.lastIndexOf(':')) + 1;
  };
  const durationFor = (mention: StatusMention, next?: StatusMention) => {
    const end = next?.start ?? description.length;
    const tail = description.slice(mention.end, end);
    const match = new RegExp(
      `^\\s*(?:\\(\\d+(?:\\.\\d+)?%\\)\\s*)?(?:them |you |each )?for (${NUMBER})(?: rounds?\\b|(?=[,.;:!?]|$))`,
      'i',
    ).exec(tail);
    if (!match?.[1]) return undefined;
    // Bare "for 2" is supported only in a description already declaring
    // rounds; its immediately preceding status supplies the binding.
    if (!/round/i.test(match[0]) && !/\brounds?\b/i.test(description)) return undefined;
    const offset = mention.end + match.index;
    mark(offset + match[0].lastIndexOf(match[1]), match[1]);
    return { value: number(match[1]), end: offset + match[0].length };
  };
  const durations = mentions.map((mention, index) => durationFor(mention, mentions[index + 1]));
  // A duration at the end of an explicit coordinated status list belongs to
  // every member of that list, never an unrelated nearest status or surface.
  for (let index = mentions.length - 2; index >= 0; index--) {
    const current = mentions[index];
    const next = mentions[index + 1];
    if (!current || !next || durations[index] || !durations[index + 1]) continue;
    if (
      /^\s*(?:\(\d+(?:\.\d+)?%\)\s*)?(?:,|and\/or|and)\s*$/i.test(
        description.slice(current.end, next.start),
      )
    ) {
      durations[index] = durations[index + 1];
    }
  }
  for (const [index, mention] of mentions.entries()) {
    const clauseStart = boundaryBefore(mention.start);
    const before = description.slice(clauseStart, mention.start);
    const after = description.slice(mention.end);
    // "Slow to cross" describes the created terrain's movement cost, not
    // application of the named Slowed status.
    if (mention.id === 'slowed' && /^\s+to cross\b/i.test(after)) {
      const costs = surfaces.map((effect) => content.surfaces.get(effect.surface)?.moveCost);
      add(
        'surfaceMove',
        mention.start,
        mention.end + ' to cross'.length,
        'extra movement cost',
        costs,
        costs.length > 0 && costs.every((cost) => typeof cost === 'number' && cost > 0),
      );
      continue;
    }
    const previous = mentions[index - 1];
    const sincePrevious = description.slice(
      Math.max(clauseStart, previous?.end ?? 0),
      mention.start,
    );
    const isCleanse =
      /\b(?:clears?|clearing|washes away|shake off|shakes off|snuffs out|frees? you from)\b[^.;:]*$/i.test(
        before,
      );
    const isCondition =
      /\b(?:against anyone|if they are)\s*$/i.test(before) ||
      /^\s+targets take double\b/i.test(after);
    const isContact =
      /^\s+whoever steps on it\b/i.test(after) ||
      /\bstarts?\s*$/i.test(before) ||
      /\bcan leave you\s*$/i.test(before);
    const isReaction = /\bstanding in (?:water|ice|fire|mud|oil|steam|rubble)\b[^.;:]*$/i.test(
      before,
    );
    if (isCondition) {
      add(
        'statusCondition',
        mention.start,
        mention.end,
        mention.id,
        content.statuses.has(mention.id as never),
        content.statuses.has(mention.id as never),
      );
      continue;
    }
    if (isCleanse) {
      add(
        'cleanse',
        mention.start,
        mention.end,
        mention.id,
        cleansed,
        cleansed.some((id) => id === mention.id),
      );
      continue;
    }
    const contact = surfaces.flatMap((effect) => {
      const definition = content.surfaces.get(effect.surface);
      return definition?.enterStatus === mention.id ? [definition] : [];
    });
    const existing = /\bstanding in (water|ice|fire|mud|oil|steam|rubble)\b/i.exec(before)?.[1];
    const reaction = existing
      ? content.combos.filter(
          (rule) =>
            rule.existing === existing &&
            applications.some((applied) => rule.applied === applied) &&
            rule.status === mention.id,
        )
      : [];
    const direct = statuses.filter((effect) => effect.status === mention.id);
    const source = isReaction ? reaction : isContact ? contact : direct;
    add(
      isReaction ? 'reactionStatus' : isContact ? 'contactStatus' : 'status',
      mention.start,
      mention.end,
      mention.id,
      source.map((value) => ('status' in value ? value.status : value.enterStatus)),
      source.length > 0,
    );
    const duration = durations[index];
    if (duration) {
      const actual = isContact
        ? contact.map((value) =>
            value.enterStatus
              ? content.statuses.get(value.enterStatus)?.defaultDuration
              : undefined,
          )
        : isReaction
          ? reaction.map((value) =>
              value.status ? content.statuses.get(value.status)?.defaultDuration : undefined,
            )
          : direct.map((value) => value.duration);
      add(
        'statusDuration',
        mention.start,
        duration.end,
        duration.value,
        actual,
        actual.length > 0 && actual.every((value) => value === duration.value),
      );
    }
    const parenthesized = /^\s*\((\d+(?:\.\d+)?)%\)/.exec(after);
    const chanceMatches = [
      ...sincePrevious.matchAll(
        /(\d+(?:\.\d+)?)% chance(?: of(?: being)?| to(?: be| leave them)?)?\s*$/gi,
      ),
    ];
    const percent = parenthesized ?? chanceMatches.at(-1);
    const even = /\b(?:an? )?even chance (?:of (?:being )?|to (?:be )?)?\s*$/i.test(sincePrevious);
    const chances = isContact
      ? contact.map((value) => value.enterStatusChance)
      : isReaction
        ? reaction.map((value) => value.statusChance)
        : direct.map((value) => value.chance);
    if (percent?.[1]) {
      const raw = percent[1];
      const start = parenthesized
        ? mention.end
        : Math.max(clauseStart, previous?.end ?? 0) + (percent.index ?? 0);
      mark(start + percent[0].indexOf(raw), raw);
      add(
        'statusChance',
        start,
        parenthesized ? start + percent[0].length : mention.end,
        Number(raw) / 100,
        chances,
        chances.length > 0 && chances.every((value) => value === Number(raw) / 100),
      );
    } else if (even) {
      add(
        'statusChance',
        Math.max(clauseStart, previous?.end ?? 0),
        mention.end,
        0.5,
        chances,
        chances.length > 0 && chances.every((value) => value === 0.5),
      );
    } else if (/\b(?:may|can)\b/i.test(sincePrevious)) {
      add(
        'statusPossible',
        mention.start,
        mention.end,
        'possible',
        chances,
        chances.some((value) => value > 0),
      );
    } else {
      add(
        'statusChance',
        mention.start,
        mention.end,
        1,
        chances,
        chances.length > 0 && chances.every((value) => value === 1),
      );
    }
  }
  matches(
    /\b(?:[Ll]eaves? (?:them |you )?|[Bb]ecomes? |[Bb]e |[Cc]lears? )([A-Z][a-z]+(?:-[A-Z][a-z]+)?)\b/g,
    (match) => {
      const term = match[1];
      if (term && !aliasIds.has(term.toLowerCase())) {
        add(
          'status',
          match.index ?? 0,
          (match.index ?? 0) + match[0].length,
          term,
          [...content.statuses.values()].map((status) => status.name),
          false,
        );
      }
    },
  );
  matches(/\bloses every harmful status\b/gi, (match) => {
    const harmful = [...content.statuses.values()]
      .filter((status) => status.kind === 'debuff')
      .map((status) => status.id);
    add(
      'cleanse',
      match.index ?? 0,
      (match.index ?? 0) + match[0].length,
      harmful,
      cleansed,
      harmful.every((id) => cleansed.includes(id)),
    );
  });

  // Positive creation verbs and explicit referents distinguish a created
  // surface from visual bending material or pre-existing reaction ingredients.
  const createdSurface = (
    id: string,
    start: number,
    end: number,
    duration?: { raw: string; start: number; end: number },
  ): void => {
    const effects = surfaces.filter((effect) => effect.surface === id);
    add(
      'surface',
      start,
      end,
      id,
      surfaces.map((effect) => effect.surface),
      effects.length > 0,
    );
    if (duration) {
      mark(duration.start, duration.raw);
      const values = effects.map((effect) => effect.duration);
      add(
        'surfaceDuration',
        start,
        duration.end,
        number(duration.raw),
        values,
        values.length > 0 && values.every((value) => value === number(duration.raw)),
      );
    }
  };
  const immediateDuration = (end: number) => {
    const match = new RegExp(
      `^\\s*(?:that lasts |for )(${NUMBER})(?: rounds?\\b|(?=[,.;:!?]|$))`,
      'i',
    ).exec(description.slice(end));
    if (!match?.[1]) return undefined;
    if (!/round/i.test(match[0]) && !/\brounds?\b/i.test(description)) return undefined;
    return {
      raw: match[1],
      start: end + match[0].lastIndexOf(match[1]),
      end: end + match[0].length,
    };
  };
  matches(
    /\b(?:ground (?:turns to|stays on)|bare ground catches) (fire|water|ice|mud|steam|oil|rubble)\b/gi,
    (match) => {
      const id = match[1]?.toLowerCase();
      const start = match.index ?? 0;
      const end = start + match[0].length;
      if (id) createdSurface(id, start, end, immediateDuration(end));
    },
  );
  matches(/\b(fire|water|ice|mud|steam|oil|rubble)(?= that lasts )/gi, (match) => {
    const id = match[1]?.toLowerCase();
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (id) createdSurface(id, start, end, immediateDuration(end));
  });
  matches(
    new RegExp(`\\b(?:sets?|setting)\\b[^.!?;]*?\\bablaze(?: for (${NUMBER}) rounds?)?\\b`, 'gi'),
    (match) => {
      const start = match.index ?? 0;
      const raw = match[1];
      createdSurface(
        'fire',
        start,
        start + match[0].length,
        raw
          ? { raw, start: start + match[0].lastIndexOf(raw), end: start + match[0].length }
          : undefined,
      );
    },
  );
  matches(
    new RegExp(`\\binto (mud|ice|water|fire|rubble) for (${NUMBER}) rounds?\\b`, 'gi'),
    (match) => {
      const id = match[1]?.toLowerCase();
      const raw = match[2];
      const start = match.index ?? 0;
      if (id && raw)
        createdSurface(id, start, start + match[0].length, {
          raw,
          start: start + match[0].lastIndexOf(raw),
          end: start + match[0].length,
        });
    },
  );
  matches(
    new RegExp(
      `\\bleaks? (oil|water|fire|ice|mud|steam|rubble) onto the centre tile for (${NUMBER}) rounds?\\b`,
      'gi',
    ),
    (match) => {
      const id = match[1]?.toLowerCase();
      const raw = match[2];
      const start = match.index ?? 0;
      if (id && raw)
        createdSurface(id, start, start + match[0].length, {
          raw,
          start: start + match[0].lastIndexOf(raw),
          end: start + match[0].length,
        });
    },
  );
  matches(
    new RegExp(
      `\\bfreezes a line of ${NUMBER} tiles out from you for (${NUMBER}) rounds?\\b`,
      'gi',
    ),
    (match) => {
      const raw = match[1];
      const start = match.index ?? 0;
      if (raw)
        createdSurface('ice', start, start + match[0].length, {
          raw,
          start: start + match[0].lastIndexOf(raw),
          end: start + match[0].length,
        });
    },
  );
  matches(
    new RegExp(`\\bground floods for (${NUMBER})(?: rounds?\\b|(?=[,.;:!?]|$))`, 'gi'),
    (match) => {
      const raw = match[1];
      const start = match.index ?? 0;
      if (raw)
        createdSurface('water', start, start + match[0].length, {
          raw,
          start: start + match[0].lastIndexOf(raw),
          end: start + match[0].length,
        });
    },
  );
  matches(/\b(?:smoke|warm mist) fills\b/gi, (match) => {
    createdSurface('steam', match.index ?? 0, (match.index ?? 0) + match[0].length);
  });
  matches(new RegExp(`\\bthe cloud\\b[^.!?]*?\\bfor (${NUMBER}) rounds?\\b`, 'gi'), (match) => {
    const raw = match[1];
    const start = match.index ?? 0;
    if (raw)
      createdSurface('steam', start, start + match[0].length, {
        raw,
        start: start + match[0].lastIndexOf(raw),
        end: start + match[0].length,
      });
  });
  matches(/\b(?:the )?(oil|rubble) (?:stays|left)\b/gi, (match) => {
    const id = match[1]?.toLowerCase();
    if (id) createdSurface(id, match.index ?? 0, (match.index ?? 0) + match[0].length);
  });
  matches(/\b(?:smashes[^.!?]*?\boil|sprays oil|rubble stays along the crack)\b/gi, (match) => {
    createdSurface(
      /rubble/i.test(match[0]) ? 'rubble' : 'oil',
      match.index ?? 0,
      (match.index ?? 0) + match[0].length,
    );
  });
  matches(
    /\b(?:the oil|it) stays until something lights it\b|\brubble stays for the rest of the fight\b/gi,
    (match) => {
      const values = surfaces.map((effect) => effect.duration);
      add(
        'surfaceDuration',
        match.index ?? 0,
        (match.index ?? 0) + match[0].length,
        -1,
        values,
        values.length > 0 && values.every((value) => value === -1),
      );
    },
  );
  matches(new RegExp(`\\bwall\\b[^.!?]*?\\bfor (${NUMBER}) rounds?\\b`, 'gi'), (match) => {
    const raw = match[1];
    if (!raw) return;
    const values = ability.effects.flatMap((effect) =>
      effect.kind === 'wall' ? [effect.duration] : [],
    );
    numeric('wallDuration', match, raw, values, values.includes(number(raw)));
  });

  const reactionClaim = (
    match: RegExpMatchArray,
    existing: string,
    result: string | null,
    spread = false,
    chain = false,
  ): void => {
    const rules = applications.flatMap((applied) => {
      const rule = content.combos.find(
        (candidate) => candidate.existing === existing && candidate.applied === applied,
      );
      return rule ? [rule] : [];
    });
    const valid = rules.some(
      (rule) =>
        rule.result === result &&
        (!spread || rule.spread > 0) &&
        (!chain || rule.chainThroughExisting),
    );
    add(
      'surfaceReaction',
      match.index ?? 0,
      (match.index ?? 0) + match[0].length,
      { existing, result, spread, chain },
      rules.map((rule) => ({
        existing: rule.existing,
        applied: rule.applied,
        result: rule.result,
        spread: rule.spread,
        chain: rule.chainThroughExisting,
      })),
      valid,
    );
  };
  matches(/\blights? any oil\b|\boil there catches and spreads the fire\b/gi, (match) =>
    reactionClaim(match, 'oil', 'fire', /spreads/i.test(match[0])),
  );
  matches(/\bsmothers fire\b/gi, (match) => reactionClaim(match, 'fire', null));
  matches(/\bchurns water into mud\b/gi, (match) => reactionClaim(match, 'water', 'mud'));
  matches(/\bclears steam\b/gi, (match) => reactionClaim(match, 'steam', null));
  matches(/\bspreads fire\b/gi, (match) => reactionClaim(match, 'fire', 'fire', true));
  matches(/\b(?:races through any water|water in the line carries the charge)\b/gi, (match) =>
    reactionClaim(match, 'water', 'water', false, true),
  );
  matches(/\bwater (?:flashes|turns) (?:in)?to steam\b/gi, (match) =>
    reactionClaim(match, 'water', 'steam'),
  );

  if (ability.effects.some((effect) => effect.kind === 'dash')) {
    matches(/\bany tile\b/gi, (match) => {
      add(
        'dashLanding',
        match.index ?? 0,
        (match.index ?? 0) + match[0].length,
        'open/unoccupied legal destination',
        match[0],
        false,
      );
    });
    for (const effect of surfaces) {
      const expression = new RegExp(`\\byou land in ${escape(effect.surface)}\\b[^.!?]*`, 'gi');
      matches(expression, (match) => {
        const outcomes = content.combos
          .filter((rule) => rule.applied === effect.surface && rule.result !== effect.surface)
          .map((rule) => ({ existing: rule.existing, result: rule.result }));
        // A following action such as "and can attack" does not qualify the
        // landing. Require an explicit terrain condition on the landing clause.
        const prior = description.slice(boundaryBefore(match.index ?? 0), match.index ?? 0);
        const landing = match[0].split(/,\s*(?:and|so)\b|\band\s+(?:you\s+)?can\b/i)[0] ?? match[0];
        const qualified =
          /\bbare ground\b|\b(?:if|when) (?:the )?(?:tile|ground) is (?:bare|clear|empty)\b|\bunless (?:the )?(?:tile|ground) (?:has|contains) (?:water|ice|mud|oil|steam|rubble)\b/i.test(
            prior + landing,
          );
        add(
          'surfaceGuarantee',
          match.index ?? 0,
          (match.index ?? 0) + match[0].length,
          'terrain-qualified landing consequence',
          outcomes,
          qualified || outcomes.length === 0,
        );
      });
    }
  }

  // Ignore narrative counts ("two shockfronts"). A number beside a mechanical
  // unit, or following a mechanical cue in its clause, must have been consumed.
  matches(new RegExp(`\\b${NUMBER}\\b`, 'gi'), (match) => {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (classifiedNumbers.some((range) => range.start <= start && range.end >= end)) return;
    const after = description.slice(end);
    const before = description.slice(boundaryBefore(start), start);
    const mechanicalUnit =
      /^\s*(?:AP\b|extra AP\b|tiles?\b|rounds?\b|turns?\b|%|damage\b|[×x]\d|mana\b|energy\b)/i.test(
        after,
      );
    const mechanicalCue = /\b(?:range|cooldown|costs?|within|for|grants?|damage)\s*:?\s*$/i.test(
      before,
    );
    if (mechanicalUnit || mechanicalCue) {
      add('unclassified', start, end, 'a supported explicit mechanical claim', match[0], false);
    }
  });
  return { claims, issues };
}

export function checkAbilityDescription(
  content: ContentIndex,
  ability: Ability,
  description = ability.description,
): readonly DescriptionIssue[] {
  return analyzeAbilityDescription(content, ability, description).issues;
}
