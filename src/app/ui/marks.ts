/**
 * Inline SVG marks.
 *
 * The four-nations wheel is the app icon (public/icons/favicon.svg) redrawn
 * with the palette tokens instead of hex, so the title screen, the backdrop
 * and any later use recolour with the theme from one source. Inline markup
 * rather than an <img>: an SVG loaded as an image cannot read CSS custom
 * properties, and this one is nothing but them.
 */

/** The wheel as the icon draws it: four nation quadrants, a gilt ring, an ink hub. */
export const WHEEL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
  <circle cx="32" cy="32" r="31" fill="var(--c-bg)"/>
  <path d="M32 32 L32 4 A28 28 0 0 0 4 32 Z" fill="var(--c-fire)"/>
  <path d="M32 32 L60 32 A28 28 0 0 0 32 4 Z" fill="var(--c-water)"/>
  <path d="M32 32 L32 60 A28 28 0 0 0 60 32 Z" fill="var(--c-earth)"/>
  <path d="M32 32 L4 32 A28 28 0 0 0 32 60 Z" fill="var(--c-air)"/>
  <circle cx="32" cy="32" r="28" fill="none" stroke="var(--c-gold)" stroke-width="3"/>
  <circle cx="32" cy="32" r="7" fill="var(--c-bg-deep)"/>
</svg>`;

/**
 * The wheel as a line drawing in the current text colour, for the backdrop:
 * rings and spokes only, hairline at any size (the stroke does not scale).
 */
export const WHEEL_LINES_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke">
  <circle cx="32" cy="32" r="30" vector-effect="non-scaling-stroke"/>
  <circle cx="32" cy="32" r="22" vector-effect="non-scaling-stroke"/>
  <circle cx="32" cy="32" r="7" vector-effect="non-scaling-stroke"/>
  <path d="M32 2 V62 M2 32 H62" vector-effect="non-scaling-stroke"/>
</svg>`;
