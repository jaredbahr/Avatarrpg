/**
 * The top-down ground packer (ADR 0104 §3): bakes each registered board (`boards/index.ts`) and
 * packs it into lossless 1 px plates, an upright atlas and the scene the runtime draws, under
 * `public/art/topdown/<board>/`.
 *
 *   node --import tsx scripts/art/topdown/pack-ground.ts [--map <id>] [--check]
 *
 * With no `--map`, every board. Deterministic; `--check` bakes in memory and fails when a shipped
 * file differs, is missing or is not the packer's.
 */
import { BOARDS } from './boards/index';
import { packBoard, writeOrCheck } from './lib/board';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const mapAt = args.indexOf('--map');
  const only = mapAt >= 0 ? args[mapAt + 1] : undefined;
  const boards = only ? BOARDS.filter((b) => b.id === only) : BOARDS;
  if (only !== undefined && boards.length === 0) {
    console.error(`no board "${only}"; boards: ${BOARDS.map((b) => b.id).join(', ')}`);
    process.exit(1);
  }
  let failed = false;
  for (const board of boards) {
    const files = await packBoard(board);
    const { stale, extra, bytes } = writeOrCheck(board, files, check);
    if (check) for (const p of stale) console.error(`stale: ${p}`);
    for (const p of extra) console.error(`not packed: ${p}`);
    console.log(
      `${board.id}: ${files.size} files, ${bytes} bytes under ${board.out}${check ? `, ${stale.length} stale` : `, ${stale.length} written`}`,
    );
    if (check && (stale.length > 0 || extra.length > 0)) failed = true;
  }
  if (failed) process.exit(1);
}

if (process.argv[1]?.endsWith('pack-ground.ts')) await main();
