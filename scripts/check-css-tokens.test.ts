import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const checker = fileURLToPath(new URL('./check-css-tokens.mjs', import.meta.url));
const violation = (name: string) =>
  fileURLToPath(new URL(`./lint/fixtures/${name}`, import.meta.url));

function run(...paths: string[]) {
  return spawnSync(process.execPath, [checker, ...paths], { encoding: 'utf8' });
}

describe('CSS token guard', () => {
  it('passes the shipped stylesheets and app inline styles', () => {
    const checked = run();
    expect(checked.status, checked.stderr).toBe(0);
  });

  it('fails on planted CSS and inline declarations', () => {
    const checked = run(
      violation('planted-css-tokens.css.txt'),
      violation('planted-inline-css.ts.txt'),
    );
    expect(checked.status, checked.stderr).toBe(1);
    const findings = checked.stderr.split('\n').filter(Boolean);
    expect(findings).toHaveLength(16);
    expect(checked.stderr).toContain('literal colour in --not-a-root-token: #f320');
    expect(checked.stderr).toContain('px length in @media: (min-width: 480px)');
    expect(checked.stderr).toContain(
      'literal colour in background: linear-gradient(rebeccapurple, var(--c-ink))',
    );
    expect(checked.stderr).toContain('literal colour in color: RGB(10 20 30 / 50%)');
    expect(checked.stderr).toContain('literal colour in border-color: hsl(10 20% 50%)');
    expect(checked.stderr).toContain('px length in width: calc(50% - 1.5PX)');
    expect(checked.stderr).toContain('numeric z-index in z-index: var(--z-overlay, 4)');
    expect(checked.stderr).toContain('literal duration in transition: opacity 0s');
    expect(checked.stderr).toContain('literal easing in transition: opacity 0s cubic-bezier');
    expect(checked.stderr).toContain('px length in --height: 1px');
    expect(checked.stderr).toContain('literal colour in color: red');
    expect(checked.stderr).toContain('px length in border: 1px solid var(--c-line)');
    expect(checked.stderr).toContain('px length in width: 4px');
    expect(checked.stderr).toContain('px length in margin: 3px');
    expect(checked.stderr).toContain('literal colour in fill: blue');
    expect(checked.stderr).toContain('px length in padding: 5px');
  });
});
