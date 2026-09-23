/**
 * Turning events into the combat log.
 *
 * The log is the game explaining itself. It is written for a reader who is
 * eight: short sentences, named units, and above all it says *why* something
 * happened — "Kaya is Wet, so the lightning hits double" rather than "24 dmg".
 */

import type { BattleState, ContentIndex, DayPhase, GameEvent, Unit } from '../types';

export const MAX_LOG_LINES = 120;

function nameOf(units: readonly Unit[] | undefined, id: string | null): string {
  if (!id) return 'Something';
  return units?.find((u) => u.id === id)?.name ?? id;
}

/** One log line, or null for events the log should stay quiet about. */
export function describeEvent(
  content: ContentIndex,
  battle: BattleState | null,
  event: GameEvent,
): string | null {
  const units = battle?.units;

  switch (event.type) {
    case 'message':
      return event.text;

    case 'roundStarted':
      return `— Round ${event.round} —`;

    case 'turnStarted':
      return `${nameOf(units, event.unitId)}'s turn.`;

    case 'unitMoved':
    case 'partyWalked':
      return null;

    case 'abilityUsed': {
      const ability = content.abilities.get(event.abilityId);
      return `${nameOf(units, event.unitId)} uses ${ability?.name ?? event.abilityId}.`;
    }

    case 'attackMissed':
      return `${nameOf(units, event.unitId)} misses ${nameOf(units, event.targetId)}.`;

    case 'damaged': {
      const target = nameOf(units, event.unitId);
      const crit = event.crit ? ' Critical hit!' : '';
      if (!event.sourceId) return `${target} takes ${event.amount} damage.${crit}`;
      return `${nameOf(units, event.sourceId)} hits ${target} for ${event.amount}.${crit}`;
    }

    case 'healed':
      return `${nameOf(units, event.unitId)} recovers ${event.amount} health.`;

    case 'statusApplied': {
      const status = content.statuses.get(event.status);
      return `${nameOf(units, event.unitId)} is ${status?.name ?? event.status}.`;
    }

    case 'statusExpired': {
      const status = content.statuses.get(event.status);
      return `${nameOf(units, event.unitId)} is no longer ${status?.name ?? event.status}.`;
    }

    case 'surfaceChanged':
      return event.label;

    case 'unitPushed':
      return `${nameOf(units, event.unitId)} is shoved back.`;

    case 'unitDied':
      return `${nameOf(units, event.unitId)} is down!`;

    /*
     * Props get their own cases rather than borrowing the unit ones, because
     * `nameOf` falls back to the raw id and would print "prop3 is shoved back"
     * into a log written for an eight-year-old.
     */
    case 'propDamaged':
      return null;

    case 'propDestroyed':
      // The prop's own plain-words line, exactly like a combo rule's label.
      return event.label;

    case 'propPushed': {
      const name = battle?.props.find((p) => p.id === event.propId)?.propId;
      const def = name ? content.props.get(name) : undefined;
      return `${def?.name ?? 'It'} slides across the ground.`;
    }

    case 'standingChanged': {
      const nation = content.elements.get(event.nation)?.name ?? event.nation;
      return event.delta > 0
        ? `Word travels. ${nation} thinks a little better of you.`
        : `Word travels. ${nation} will remember that.`;
    }

    case 'xpGained':
      return null;

    case 'leveledUp': {
      const unlocked = event.unlocked
        .map((id) => content.abilities.get(id)?.name ?? id)
        .filter(Boolean);
      const suffix = unlocked.length > 0 ? ` Learned ${unlocked.join(' and ')}.` : '';
      return `${nameOf(units, event.unitId)} reaches level ${event.level}!${suffix}`;
    }

    case 'levelChoiceOffered':
      return `${nameOf(units, event.unitId)} has a new technique to choose.`;

    case 'disciplineOffered':
      return `${nameOf(units, event.unitId)} is ready to choose a path.`;

    case 'disciplineChosen': {
      const name = content.disciplines.get(event.disciplineId)?.name ?? event.disciplineId;
      const unlocked = event.unlocked.map((id) => content.abilities.get(id)?.name ?? id);
      const suffix = unlocked.length > 0 ? ` Learned ${unlocked.join(' and ')}.` : '';
      return `${nameOf(units, event.unitId)} takes up ${name}.${suffix}`;
    }

    case 'battleEnded':
      return event.outcome === 'victory' ? 'The fight is won.' : 'The party is overwhelmed.';

    case 'phaseChanged': {
      const label: Record<DayPhase, string> = {
        dawn: 'Dawn breaks.',
        morning: 'Morning arrives.',
        midday: 'Midday arrives.',
        afternoon: 'Afternoon settles in.',
        evening: 'Evening falls.',
        night: 'Night falls.',
      };
      return label[event.to];
    }

    case 'flagSet':
    case 'storyNodeEntered':
    case 'dialogueAdvanced':
    case 'screenChanged':
    case 'battleStarted':
      return null;

    default:
      return null;
  }
}

/** Appends the loggable events to an existing log, capped at MAX_LOG_LINES. */
export function appendLog(
  content: ContentIndex,
  battle: BattleState | null,
  log: readonly string[],
  events: readonly GameEvent[],
): string[] {
  const lines: string[] = [];
  for (const event of events) {
    const line = describeEvent(content, battle, event);
    if (line) lines.push(line);
  }
  if (lines.length === 0) return [...log];
  const next = [...log, ...lines];
  return next.length > MAX_LOG_LINES ? next.slice(next.length - MAX_LOG_LINES) : next;
}
