import type { ShoveForecast } from '../../core/rules/reactions';

/** The visible subject is a unit or prop, so both displacement modes need -s. */
function shoveVerb(mode: ShoveForecast['mode']): 'pushes' | 'pulls' {
  return mode === 'push' ? 'pushes' : 'pulls';
}

/** The unblocked movement sentence used by the combat confirmation chip. */
export function formatShoveMovement(
  name: string,
  mode: ShoveForecast['mode'],
  destination: string,
): string {
  return `${name}: ${shoveVerb(mode)} to ${destination}`;
}
