/**
 * Which look the page boots in (ADR 0104 T6): top-down is the default, so a fresh link and a
 * Continue both land in it, since the style is a URL choice and never part of a save (§4).
 * `?style=oblique` keeps the old painted look for one release (T7 deletes it), `?style=world` is
 * the oblique look with the world-style figure test, and `?style=topdown` stays as an alias.
 */
export type PageStyle = 'topdown' | 'oblique' | 'world';

export function pageStyle(search: string): PageStyle {
  const style = new URLSearchParams(search).get('style');
  return style === 'oblique' || style === 'world' ? style : 'topdown';
}
