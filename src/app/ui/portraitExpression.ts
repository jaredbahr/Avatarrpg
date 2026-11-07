import { ASSETS } from '../../content/assets/manifest';
import type { PortraitExpression } from '../../core/types';

/**
 * Use a painted expression only when that image is registered. Missing variants
 * keep the character's neutral portrait instead of resolving to the unknown
 * portrait painter. The canvas requests the selected image on first use.
 */
export function portraitExpressionKey(
  portrait: string,
  expression: PortraitExpression | undefined,
  assets: Readonly<Record<string, unknown>> = ASSETS,
): string {
  if (!expression || !portrait.startsWith('portrait.')) return portrait;
  const candidate = `${portrait}.${expression}`;
  return candidate in assets ? candidate : portrait;
}
