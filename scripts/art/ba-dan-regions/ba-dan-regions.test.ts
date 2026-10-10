import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

/**
 * The Ba Dan painting tools are python (PIL + numpy) around one node render and one node packer, so each
 * check is a case in test_regions.py and this file runs them. The geometry's render is cached under `work`.
 * `regen.sh --check` is the guard that the shipped files are a pure function of the tracked sources.
 */
const work = '.review/regions/test-work';

function run(name: string): string {
  return execFileSync('python', ['scripts/art/ba-dan-regions/test_regions.py', name, work], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

describe('ba-dan-regions', () => {
  it('plans a grid covering the pan box with the stated overlap', () => {
    expect(run('plan_covers_pan_box')).toContain('ok');
  });
  it('guides a region: the painting under the frozen uprights, at exactly 1536x1024', () => {
    expect(run('guide_is_the_painting_under_the_uprights')).toContain('ok');
  }, 180_000);
  it('gates: passes itself, fails a 4 px shift, a shifted blob, another region and a wrong size', () => {
    expect(run('gate_self_and_shifts')).toContain('ok');
  }, 180_000);
  it('runs guide, gate and accept from the command line on the shipped painting', () => {
    expect(run('guide_gate_accept_commands')).toContain('ok');
  }, 300_000);
  it('stitches identical regions back to the source and lists disagreements', () => {
    expect(run('stitch_identical_reproduces')).toContain('ok');
  }, 180_000);
  it('joins regions with a ramp for colour, crisp detail and no cut patch', () => {
    expect(run('stitch_joins_without_ghosts_or_steps')).toContain('ok');
  }, 180_000);
  it('moves a hidden fill by the repaint colour change measured on the painted pixels', () => {
    expect(run('match_fill_follows_the_colour_change')).toContain('ok');
  });
  it('splits to the geometry silhouette, painted where it is seen and filled where it is hidden', () => {
    expect(run('split_keeps_the_silhouette_and_paints_the_rest')).toContain('ok');
  }, 180_000);
  it('cuts plates that cover the painting and overlap by two pixels', () => {
    expect(run('split_plates_cover_and_overlap')).toContain('ok');
  }, 180_000);
  it('reports planting painted across an upright edge', () => {
    expect(run('straddle_detects_added_clutter')).toContain('ok');
  }, 180_000);
  it('draws as uprights exactly the pieces a figure on a walkable cell can stand behind', () => {
    expect(run('uprights_are_the_pieces_figures_stand_behind')).toContain('ok');
  }, 180_000);
  it("ships every upright with its geometry's silhouette as its alpha, trimmed to what it draws", () => {
    expect(run('shipped_uprights_are_the_geometry_silhouette')).toContain('ok');
  }, 180_000);
  it('ships ground plates that cover the painting and join without a step', () => {
    expect(run('shipped_plates_are_continuous')).toContain('ok');
  }, 180_000);
  it('fades the painting into the margin colour: flat at the perimeter, ragged, bounded', () => {
    expect(run('edge_fade_is_flat_bounded_irregular_and_deterministic')).toContain('ok');
  });
  it('ships plates whose whole outer edge is the margin colour', () => {
    expect(run('shipped_plate_perimeter_is_the_margin')).toContain('ok');
  }, 180_000);
  it('reproduces every shipped file from the accepted regions and the frozen geometry', () => {
    const out = execFileSync('sh', ['scripts/art/ba-dan-regions/regen.sh', '--check'], {
      encoding: 'utf8',
      env: { ...process.env, BA_DAN_WORK: '.review/regions/regen-check' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    expect(out).toContain('ba-dan-regions pack matches');
  }, 600_000);
});
