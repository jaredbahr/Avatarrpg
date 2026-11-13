import * as ts from 'typescript';

/**
 * Read the emitted Workbox array without evaluating the service worker. A
 * changed output format must fail the audit instead of producing an empty set.
 */
export function precachePaths(source: string, workerUrl: URL): ReadonlySet<string> {
  const tree = ts.createSourceFile('sw.js', source, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
  const calls: ts.CallExpression[] = [];
  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'precacheAndRoute') {
        calls.push(node);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);

  const manifest = calls[0]?.arguments[0];
  if (calls.length !== 1 || !manifest || !ts.isArrayLiteralExpression(manifest)) {
    throw new Error('Expected one literal Workbox precache manifest in the built service worker');
  }
  if (manifest.elements.length === 0) throw new Error('The built precache manifest is empty');

  const paths = new Set<string>();
  for (const entry of manifest.elements) {
    const url = ts.isObjectLiteralExpression(entry)
      ? entry.properties.find(
          (property): property is ts.PropertyAssignment =>
            ts.isPropertyAssignment(property) &&
            (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
            property.name.text === 'url',
        )?.initializer
      : entry;
    if (!url || !ts.isStringLiteralLike(url) || !url.text) {
      throw new Error('Expected a literal URL in each built precache entry');
    }
    const resolved = new URL(url.text, workerUrl);
    if (resolved.origin !== workerUrl.origin) {
      throw new Error('Unexpected cross-origin URL in the built precache: ' + url.text);
    }
    paths.add(resolved.pathname);
  }
  return paths;
}
