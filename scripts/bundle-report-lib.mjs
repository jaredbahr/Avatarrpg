import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodeVlq(text, state) {
  let encoded = 0;
  let multiplier = 1;
  let continuation = true;
  do {
    const digit = alphabet.indexOf(text[state.index++]);
    if (digit < 0) throw new Error('Invalid source map VLQ digit.');
    continuation = digit & 32;
    encoded += (digit & 31) * multiplier;
    if (!Number.isSafeInteger(encoded)) throw new Error('Source map VLQ value is too large.');
    multiplier *= 32;
    if (multiplier > Number.MAX_SAFE_INTEGER && continuation) {
      throw new Error('Source map VLQ value is too large.');
    }
  } while (continuation);
  const magnitude = Math.floor(encoded / 2);
  return encoded % 2 ? -magnitude : magnitude;
}

/** Decode the v3 mappings field, resetting generated columns at each line. */
export function decodeMappings(mappings) {
  let source = 0;
  let originalLine = 0;
  let originalColumn = 0;
  let name = 0;
  return mappings.split(';').map((line) => {
    let generatedColumn = 0;
    if (!line) return [];
    return line.split(',').map((segment) => {
      const state = { index: 0 };
      generatedColumn += decodeVlq(segment, state);
      const fields = [generatedColumn];
      if (state.index < segment.length) {
        source += decodeVlq(segment, state);
        originalLine += decodeVlq(segment, state);
        originalColumn += decodeVlq(segment, state);
        fields.push(source, originalLine, originalColumn);
        if (state.index < segment.length) {
          name += decodeVlq(segment, state);
          fields.push(name);
          if (name < 0) throw new Error('Negative source map name index.');
        }
      }
      if (state.index !== segment.length) throw new Error('Malformed source map segment.');
      if (![1, 4, 5].includes(fields.length))
        throw new Error('Malformed source map segment length.');
      if (generatedColumn < 0) throw new Error('Negative generated source map column.');
      if (fields.length >= 4 && (source < 0 || originalLine < 0 || originalColumn < 0)) {
        throw new Error('Negative source map source/original position.');
      }
      return fields;
    });
  });
}

function logicalSource(map, source, mapFile, rootDir) {
  const sourceRoot = map.sourceRoot ?? '';
  let candidate;
  if (/^[a-z][a-z\d+.-]*:/i.test(source)) candidate = source;
  else if (/^[a-z][a-z\d+.-]*:/i.test(sourceRoot))
    candidate = new URL(source, sourceRoot.endsWith('/') ? sourceRoot : `${sourceRoot}/`).href;
  else candidate = resolve(dirname(mapFile), sourceRoot, source);
  if (candidate.startsWith('file:')) candidate = fileURLToPath(candidate);
  if (!isAbsolute(candidate) && /^[a-z][a-z\d+.-]*:/i.test(candidate))
    return candidate.replaceAll('\\', '/');
  let path = relative(rootDir, candidate).split(sep).join('/');
  if (path === '..' || path.startsWith('../')) return null;
  if (path.startsWith('dist/node_modules/')) path = path.slice('dist/'.length);
  return path;
}

function utf8ColumnOffsets(line) {
  const offsets = new Map([[0, 0]]);
  let utf16 = 0;
  let bytes = 0;
  for (const char of line) {
    offsets.set(utf16, bytes);
    utf16 += char.length;
    bytes += Buffer.byteLength(char);
  }
  offsets.set(utf16, bytes);
  return { offsets, utf16, bytes };
}

function add(target, key, amount) {
  target.set(key, (target.get(key) ?? 0) + amount);
}

/** Allocate each shipped file's measured gzip bytes across mapped UTF-8 spans. */
export function analyzeChunk({ file, mapFile, mapValue, mapBasePath, rootDir, content }) {
  const compressedBytes = gzipSync(content).length;
  if (!mapFile && !mapValue)
    return { compressedBytes, modules: new Map([['[generated / unmapped]', compressedBytes]]) };
  let map;
  try {
    map = JSON.parse(mapValue ?? readFileSync(mapFile, 'utf8'));
  } catch (error) {
    throw new Error(`Cannot read sourcemap for ${file}: ${error.message}`);
  }
  if (map.version !== 3 || typeof map.mappings !== 'string' || !Array.isArray(map.sources)) {
    throw new Error(`Invalid v3 sourcemap for ${file}.`);
  }
  const lines = content.toString('utf8').split('\n');
  const mapLocation = mapFile ?? mapBasePath ?? resolve(rootDir, file);
  const mappings = decodeMappings(map.mappings);
  const names = map.names ?? [];
  if (!Array.isArray(names)) throw new Error(`Invalid source map names in ${mapFile}.`);
  for (const line of mappings) {
    for (const segment of line) {
      if (segment.length >= 4 && (segment[1] < 0 || segment[1] >= map.sources.length)) {
        throw new Error(`Invalid source index in ${mapFile}.`);
      }
      if (
        segment.length === 5 &&
        (segment[4] >= names.length || typeof names[segment[4]] !== 'string')
      ) {
        throw new Error(`Invalid source map name index in ${mapFile}.`);
      }
    }
  }
  if (mappings.slice(lines.length).some((line) => line.length > 0)) {
    throw new Error(`Sourcemap has generated lines beyond ${file}.`);
  }
  const raw = new Map();
  let unmapped = 0;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const { offsets, utf16, bytes } = utf8ColumnOffsets(line);
    const segments = mappings[lineIndex] ?? [];
    let cursor = 0;
    for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
      const segment = segments[segmentIndex];
      const column = segment[0];
      if (column < cursor || column > utf16 || !offsets.has(column)) {
        throw new Error(`Invalid generated column in ${mapFile} line ${lineIndex + 1}.`);
      }
      if (segmentIndex > 0 && column < segments[segmentIndex - 1][0]) {
        throw new Error(`Non-monotonic generated columns in ${mapFile} line ${lineIndex + 1}.`);
      }
      if (column > cursor) unmapped += offsets.get(column) - offsets.get(cursor);
      const next = segments[segmentIndex + 1]?.[0] ?? utf16;
      if (next < column || next > utf16 || !offsets.has(next)) {
        throw new Error(`Invalid generated column in ${mapFile} line ${lineIndex + 1}.`);
      }
      const span = offsets.get(next) - offsets.get(column);
      if (segment.length < 4) unmapped += span;
      else {
        const source = map.sources[segment[1]];
        if (typeof source !== 'string') throw new Error(`Invalid source index in ${mapFile}.`);
        const module = logicalSource(map, source, mapLocation, rootDir);
        if (module === null) unmapped += span;
        else add(raw, module, span);
      }
      cursor = next;
    }
    if (cursor < utf16) unmapped += bytes - offsets.get(cursor);
    // Newline bytes are generated bytes too.
    if (lineIndex < lines.length - 1) unmapped += 1;
  }
  add(raw, '[generated / unmapped]', unmapped);
  const totalRaw = [...raw.values()].reduce((sum, count) => sum + count, 0);
  if (totalRaw === 0)
    return { compressedBytes, modules: new Map([['[generated / unmapped]', compressedBytes]]) };
  const rows = [...raw].map(([module, count]) => ({
    module,
    bytes: Math.floor((count * compressedBytes) / totalRaw),
    remainder: (count * compressedBytes) % totalRaw,
  }));
  let remainder = compressedBytes - rows.reduce((sum, row) => sum + row.bytes, 0);
  rows.sort((a, b) => b.remainder - a.remainder || a.module.localeCompare(b.module));
  for (let i = 0; remainder > 0; i++, remainder--) rows[i % rows.length].bytes++;
  return { compressedBytes, modules: new Map(rows.map(({ module, bytes }) => [module, bytes])) };
}

export function foldFolder(module) {
  if (module.startsWith('node_modules/')) {
    const parts = module.split('/');
    const dependencyRoot = parts.lastIndexOf('node_modules');
    const packageStart = dependencyRoot + 1;
    const packageEnd = parts[packageStart]?.startsWith('@') ? packageStart + 1 : packageStart;
    return `node_modules/${parts.slice(packageStart, packageEnd + 1).join('/')}`;
  }
  if (module.startsWith('src/')) {
    const parts = module.split('/');
    return parts.slice(0, Math.min(parts.length - 1, 3)).join('/');
  }
  if (module.startsWith('[')) return module;
  return module.split('/').slice(0, -1).join('/') || '[root]';
}

export function aggregate(chunks) {
  const modules = new Map();
  let total = 0;
  for (const chunk of chunks) {
    const allocated = [...chunk.modules.values()].reduce((sum, bytes) => sum + bytes, 0);
    if (allocated !== chunk.compressedBytes) {
      throw new Error(
        `Chunk allocation mismatch: ${allocated} estimated bytes for ${chunk.compressedBytes} measured bytes.`,
      );
    }
    total += chunk.compressedBytes;
    for (const [name, bytes] of chunk.modules) add(modules, name, bytes);
  }
  return { total, modules };
}

export function renderMarkdown(current, base = null) {
  const folders = (modules) => {
    const result = new Map();
    for (const [module, bytes] of modules) add(result, foldFolder(module), bytes);
    return result;
  };
  const delta = (now, before) => now - before;
  const fmt = (bytes) => `${(bytes / 1024).toFixed(2)} KB`;
  const fmtMeasured = (bytes) => `${fmt(bytes)} (${bytes.toLocaleString()} B)`;
  const moduleRows = [...current.modules]
    .map(([name, bytes]) => ({ name, bytes, before: base?.modules.get(name) ?? 0 }))
    .concat(
      base
        ? [...base.modules]
            .filter(([name]) => !current.modules.has(name))
            .map(([name, bytes]) => ({ name, bytes: 0, before: bytes }))
        : [],
    )
    .sort(
      (a, b) =>
        (base
          ? Math.abs(delta(b.bytes, b.before)) - Math.abs(delta(a.bytes, a.before))
          : b.bytes - a.bytes) || a.name.localeCompare(b.name),
    );
  const folderNow = folders(current.modules);
  const folderBefore = base ? folders(base.modules) : new Map();
  const folderKeys = new Set([...folderNow.keys(), ...folderBefore.keys()]);
  const folderRows = [...folderKeys]
    .map((name) => ({ name, bytes: folderNow.get(name) ?? 0, before: folderBefore.get(name) ?? 0 }))
    .sort(
      (a, b) =>
        (base
          ? Math.abs(delta(b.bytes, b.before)) - Math.abs(delta(a.bytes, a.before))
          : b.bytes - a.bytes) || a.name.localeCompare(b.name),
    );
  const header = base
    ? '| Module | Current est. gzip | Base est. gzip | Δ est. gzip |\n|---|---:|---:|---:|'
    : '| Module | Estimated gzip |\n|---|---:|';
  const line = (row) =>
    base
      ? `| \`${row.name}\` | ${fmt(row.bytes)} | ${fmt(row.before)} | ${delta(row.bytes, row.before) >= 0 ? '+' : ''}${fmt(delta(row.bytes, row.before))} |`
      : `| \`${row.name}\` | ${fmt(row.bytes)} |`;
  return [
    '### JavaScript bundle attribution',
    '',
    `Measured shipped JS gzip: **${fmtMeasured(current.total)}**${base ? ` (base ${fmtMeasured(base.total)}, Δ ${delta(current.total, base.total) >= 0 ? '+' : ''}${fmt(delta(current.total, base.total))} (${delta(current.total, base.total) >= 0 ? '+' : ''}${delta(current.total, base.total).toLocaleString()} B))` : ''}.`,
    '',
    'Module values are **estimates**: measured chunk gzip bytes are apportioned by mapped generated UTF-8 source spans; gzip is not additive by module. Generated and unmapped bytes are kept in an explicit bucket.',
    '',
    '#### Top 30 modules',
    '',
    header,
    ...moduleRows.slice(0, 30).map(line),
    '',
    '#### Folder totals',
    '',
    base
      ? '| Folder | Current est. gzip | Base est. gzip | Δ est. gzip |\n|---|---:|---:|---:|'
      : '| Folder | Estimated gzip |\n|---|---:|',
    ...folderRows.map(line),
  ].join('\n');
}
