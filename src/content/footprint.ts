/**
 * Content's default for the size-2 footprint gate.
 *
 * Keep this in content (rather than importing the core rule) because core is
 * intentionally independent from authored content. The cross-layer equality
 * test keeps the two defaults synchronized until the gate is enabled.
 */
export const SQUARE_FOOTPRINT_CONTENT_DEFAULT = false;
