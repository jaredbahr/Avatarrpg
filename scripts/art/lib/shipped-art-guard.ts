/**
 * The quarry floor pages (Gate, Cutting, Driller) ship with generated paving
 * filled into the packer's plates (docs/art/quarry-floor-fill.md), which the
 * packers cannot reproduce. Running one writes the plain packer plates over the
 * shipped pages and rewrites the byte pins, so a packer entry point only writes
 * when it is asked to by name.
 */
export const OVERWRITE_FLAG = '--overwrite-shipped-art';

export const wantsOverwrite = (argv: readonly string[]): boolean => argv.includes(OVERWRITE_FLAG);

/** Explain a dry run: what was built, and how to really write it. */
export function dryRunNotice(command: string): string {
  return `${command}: dry run, nothing written. These pages ship with generated floor paving the packer cannot reproduce; writing replaces them and the byte pins. Pass ${OVERWRITE_FLAG} to write.`;
}
