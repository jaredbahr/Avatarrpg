/**
 * Arrow keys in a radio group (#604).
 *
 * Right and Down choose the next option, Left and Up the previous one, and
 * both wrap at the ends, as the ARIA radio group pattern describes. Any other
 * key is not the group's to handle.
 */
export function nextRadioIndex(index: number, key: string, count: number): number | null {
  if (count <= 0) return null;
  const step =
    key === 'ArrowRight' || key === 'ArrowDown'
      ? 1
      : key === 'ArrowLeft' || key === 'ArrowUp'
        ? -1
        : 0;
  if (step === 0) return null;
  return (index + step + count) % count;
}
