import type { CombatTuning, ContentIndex, Grid, WeatherIntensity } from '../types';
import type { ObscurementBreakdown } from './obscurement';

/** Rule-visible cloud cells, resolved before the renderer so backends never read content. */
export function obscuringTiles(content: ContentIndex, grid: Grid): { x: number; y: number }[] {
  const tiles: { x: number; y: number }[] = [];
  grid.tiles.forEach((tile, index) => {
    if (!tile.surface || !content.surfaces.get(tile.surface.id)?.obscures) return;
    tiles.push({ x: index % grid.width, y: Math.floor(index / grid.width) });
  });
  return tiles;
}

const penalty = (value: number): string => `−${Math.abs(value)}`;

/** Header copy comes entirely from the active tuning rung. */
export function weatherChipText(tuning: CombatTuning, intensity: WeatherIntensity): string | null {
  if (intensity === 0) return null;
  const level = tuning.weather[intensity];
  if (!level) return null;
  const label = intensity === 1 ? 'Blowing sand' : 'Sandstorm';
  return `${label} · long shots ${penalty(level.perTile)}/tile`;
}

/** Phone copy keeps the same active tuning value without the explanatory clause. */
export function weatherChipShortText(
  tuning: CombatTuning,
  intensity: WeatherIntensity,
): string | null {
  if (intensity === 0) return null;
  const level = tuning.weather[intensity];
  if (!level) return null;
  const label = intensity === 1 ? 'Blowing sand' : 'Sandstorm';
  return `${label} ${penalty(level.perTile)}/tile`;
}

/** Extra sentence for a miss, selected from the terms the real hit roll used. */
export function obscurementMissLine(obscurement: ObscurementBreakdown | undefined): string | null {
  if (!obscurement || obscurement.total === 0) return null;
  const steam = obscurement.inside + obscurement.through + obscurement.attacker;
  if (steam < 0 && Math.abs(steam) >= Math.abs(obscurement.weather)) return 'Lost in the steam.';
  if (obscurement.weather < 0) return 'The sand takes it.';
  if (steam < 0) return 'Lost in the steam.';
  return null;
}
