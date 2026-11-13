import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import * as ts from 'typescript';

export interface CanonHit {
  file: string;
  line: number;
  column: number;
  name: string;
}

interface CanonPattern {
  name: string;
  pattern: RegExp;
}

function patterns(names: readonly string[]): CanonPattern[] {
  return names.map((name) => {
    const phrase = name
      .trim()
      .split(/\s+/u)
      .map((word) => word.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
      .join('\\s+');
    return {
      name,
      pattern: new RegExp(`(?<![\\p{L}\\p{N}_])${phrase}(?![\\p{L}\\p{N}_])`, 'giu'),
    };
  });
}

function matches(
  text: string,
  rules: readonly CanonPattern[],
): { start: number; end: number; name: string }[] {
  const found: { start: number; end: number; name: string }[] = [];
  for (const { name, pattern } of rules) {
    for (const match of text.matchAll(pattern)) {
      if (match.index === undefined) continue;
      found.push({ start: match.index, end: match.index + match[0].length, name });
    }
  }
  found.sort((a, b) => a.start - b.start || b.end - a.end);
  return found.filter(
    (hit, index) =>
      !found.slice(0, index).some((other) => other.start <= hit.start && other.end >= hit.end),
  );
}

function position(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, offset);
  const lastNewline = before.lastIndexOf('\n');
  return { line: before.split('\n').length, column: offset - lastNewline };
}

export function scanPlainText(text: string, file: string, names: readonly string[]): CanonHit[] {
  return matches(text, patterns(names)).map((match) => ({
    file,
    ...position(text, match.start),
    name: match.name,
  }));
}

export function scanTypeScript(text: string, file: string, names: readonly string[]): CanonHit[] {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const rules = patterns(names);
  const hits: CanonHit[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      const raw = node.getText(source);
      const direct = matches(raw, rules);
      for (const match of direct) {
        const at = source.getLineAndCharacterOfPosition(node.getStart(source) + match.start);
        hits.push({ file, line: at.line + 1, column: at.character + 1, name: match.name });
      }
      // Escaped strings still become player text. The opening line is the best
      // available source location when decoded characters have no raw offset.
      if (!direct.length) {
        for (const match of matches(node.text, rules)) {
          const at = source.getLineAndCharacterOfPosition(node.getStart(source));
          hits.push({ file, line: at.line + 1, column: at.character + 1, name: match.name });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return hits;
}

function sourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Linked player-facing source: ${path}`);
    if (entry.isDirectory()) files.push(...sourceFiles(path));
    else if (
      /\.(?:[cm]?js|tsx?)$/iu.test(entry.name) &&
      !/\.(?:test|spec|d)\.(?:[cm]?js|tsx?)$/iu.test(entry.name)
    ) {
      files.push(path);
    }
  }
  return files;
}

export function collectPlayerFacingHits(root: string, names: readonly string[]): CanonHit[] {
  const content = sourceFiles(join(root, 'src/content'));
  const app = sourceFiles(join(root, 'src/app'));
  if (!content.length || !app.length) throw new Error('Player-facing source inventory is empty');
  const files = [
    ...content,
    ...app,
    join(root, 'vite.config.ts'), // PWA manifest name, short name, and description.
  ];
  if (files.some((file) => !statSync(file).isFile())) {
    throw new Error('Player-facing source inventory is incomplete');
  }
  const hits = files.flatMap((path) => {
    const file = relative(root, path).replaceAll('\\', '/');
    return scanTypeScript(readFileSync(path, 'utf8'), file, names);
  });
  const html = join(root, 'index.html');
  hits.push(...scanPlainText(readFileSync(html, 'utf8'), 'index.html', names));
  // A checked-in manifest, if added later, is player-facing too. Today Vite
  // generates it from the manifest fields in vite.config.ts above.
  const publicDir = resolve(root, 'public');
  const manifestFiles = readdirSync(publicDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /manifest.*\.(?:json|webmanifest)$/iu.test(entry.name))
    .map((entry) => join(publicDir, entry.name));
  for (const path of manifestFiles) {
    const file = relative(root, path).replaceAll('\\', '/');
    hits.push(...scanPlainText(readFileSync(path, 'utf8'), file, names));
  }
  return hits.sort(
    (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column,
  );
}

export function formatCanonHit(hit: CanonHit): string {
  return `${hit.file}:${hit.line}:${hit.column}: canon name "${hit.name}"`;
}
