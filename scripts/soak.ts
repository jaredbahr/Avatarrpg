/**
 * Full combat soak: npm run soak [-- --json /path/to/report.json]
 * SOAK_TRIALS overrides the default 200 seeds in every encounter/variant/size.
 * No retries, balance tuning, discipline sweep or altered round caps.
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CONTENT } from '../src/content';
import { readSoakTrials, runSoakReport } from './soak/report';

export function parseSoakArgs(args: readonly string[]): { jsonPath: string; help: boolean } {
  let jsonPath = 'soak-report.json';
  let help = false;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--help') {
      help = true;
    } else if (arg === '--json') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error('--json requires a path');
      jsonPath = value;
    } else {
      throw new Error(`Unknown soak option: ${arg}`);
    }
  }
  return { jsonPath, help };
}

function main(): void {
  try {
    const { jsonPath, help } = parseSoakArgs(process.argv.slice(2));
    if (help) {
      console.log('Usage: npm run soak [-- --json PATH]');
      console.log('SOAK_TRIALS: positive integer seeds per encounter/variant/size (default 200).');
      console.log('All encounters, all roster variants, sizes 1–6, normal 60-round cap.');
      return;
    }
    const report = runSoakReport(CONTENT, {
      trials: readSoakTrials(process.env.SOAK_TRIALS),
      onRow: (row) => {
        console.log(
          `${row.encounterId}/${row.variantId ?? '(authored)'}/${row.partySize}: ` +
            `${row.completed}/${row.attempted} completed, ${row.throws} throws, ` +
            `${row.maxRoundsReached} capped, ${row.idleTurns} legal-but-idle turns`,
        );
      },
    });
    writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Combat soak: ${report.trials} seeds per encounter/variant/size`);
    console.table(
      report.rows.map((row) => ({
        encounter: row.encounterId,
        variant: row.variantId ?? '(authored)',
        size: row.partySize,
        attempts: row.attempted,
        completed: row.completed,
        throws: row.throws,
        capped: row.maxRoundsReached,
        'cap %': (row.maxRoundsRate * 100).toFixed(2),
        'legal but idle': row.idleTurns,
        'median rounds': row.medianRounds,
        'max rounds': row.maxRounds,
        passed: row.passed,
      })),
    );
    console.log(JSON.stringify(report.summary));
    console.log(`JSON report: ${resolve(jsonPath)}`);
    console.log('Legal-but-idle examples are bounded; counts include every observed idle turn.');
    console.log('Throws fail the gate; more than 1% capped fights in any cell fails the gate.');
    for (const violation of report.violations) console.error(violation);
    process.exitCode = report.summary.passed ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
