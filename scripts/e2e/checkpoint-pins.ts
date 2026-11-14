/**
 * The quarry checkpoints' pinned facts, and their behaviour on demand (#795).
 *
 *   npm run checkpoints                       check the pinned facts (the unit suite does the same)
 *   npm run checkpoints -- --write            re-pin them and print a summary for the pull request
 *   npm run checkpoints -- --dump before.json write every save and transcript, in full
 *   npm run checkpoints -- --diff before.json compare today's saves and transcripts with a dump
 *
 * The facts file holds what an AI retune must not move. `--dump` on `main` and
 * `--diff` on a branch answer the other question, "did this change how the
 * canonical routes play?", field by field, without a pin anybody has to merge.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  REPIN_COMMAND,
  diffFacts,
  factsReport,
  firstDivergence,
  quarryCheckpointBehaviour,
  quarryCheckpointFacts,
  type CheckpointBehaviour,
} from './checkpoint-facts';

export const FACTS_PATH = fileURLToPath(
  new URL('./quarry-checkpoints.facts.json', import.meta.url),
);

export function readPinnedFacts(): unknown {
  return existsSync(FACTS_PATH) ? JSON.parse(readFileSync(FACTS_PATH, 'utf8')) : {};
}

function optionValue(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a path`);
  return value;
}

function behaviourDiff(before: Record<string, CheckpointBehaviour>): string[] {
  const after = quarryCheckpointBehaviour();
  const lines: string[] = [];
  for (const name of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const was = before[name];
    const is = after[name];
    if (!was || !is) {
      lines.push(`${name}: ${was ? 'no longer generated' : 'new checkpoint'}`);
      continue;
    }
    const parted = firstDivergence(was.transcript, is.transcript);
    const moved = [
      ...diffFacts(was.commandsByType, is.commandsByType, 'commands'),
      ...diffFacts(was.fights, is.fights, 'fights'),
      ...diffFacts(was.save, is.save, 'save'),
    ];
    if (!parted && moved.length === 0) {
      lines.push(`${name}: identical (${is.commands} commands)`);
      continue;
    }
    lines.push(`${name}: ${was.commands} -> ${is.commands} commands`);
    if (parted) lines.push(`  transcript parts at ${parted}`);
    const limit = 60;
    lines.push(...moved.slice(0, limit).map((line) => `  ${line}`));
    if (moved.length > limit) lines.push(`  ... and ${moved.length - limit} more`);
  }
  return lines;
}

function main(): void {
  const dumpPath = optionValue('--dump');
  const diffPath = optionValue('--diff');
  if (dumpPath) {
    writeFileSync(dumpPath, `${JSON.stringify(quarryCheckpointBehaviour())}\n`);
    console.log(`Wrote every quarry checkpoint's save and transcript to ${dumpPath}`);
    return;
  }
  if (diffPath) {
    const before = JSON.parse(readFileSync(diffPath, 'utf8')) as Record<
      string,
      CheckpointBehaviour
    >;
    console.log(`Quarry checkpoint behaviour, ${diffPath} -> this tree\n`);
    console.log(behaviourDiff(before).join('\n'));
    return;
  }

  const pinned = readPinnedFacts();
  const current = quarryCheckpointFacts();
  const differences = diffFacts(pinned, current);
  if (process.argv.includes('--write')) {
    writeFileSync(FACTS_PATH, `${JSON.stringify(current, null, 2)}\n`);
    if (differences.length === 0) {
      console.log('Quarry checkpoint facts are unchanged; nothing to re-pin.');
      return;
    }
    console.log(
      `Re-pinned ${differences.length} quarry checkpoint fact(s). For the pull request:\n`,
    );
    console.log('```');
    console.log(differences.join('\n'));
    console.log('```');
    return;
  }
  if (differences.length > 0) {
    console.error(factsReport('Quarry checkpoints', differences, 200));
    process.exitCode = 1;
    return;
  }
  console.log(`Quarry checkpoint facts match ${FACTS_PATH}. Re-pin with \`${REPIN_COMMAND}\`.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
