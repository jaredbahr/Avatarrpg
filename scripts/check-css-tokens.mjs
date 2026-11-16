import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import colorNames from 'color-name';
import postcss from 'postcss';
import ts from 'typescript';

const root = fileURLToPath(new URL('..', import.meta.url));
const base = 'src/styles/base.css';

// These values translate live DOM/canvas geometry into CSS pixels. They are
// measurements, not authored UI sizes. Match the exact expression and sink.
const measuredPixels = [
  [
    'src/app/scenes/CombatScene.ts',
    '--more-room',
    '`${Math.max(0, Math.round(room))}px`',
    'The bottom sheet uses the available viewport height measured in CSS pixels.',
  ],
  [
    'src/app/scenes/ExploreScene.ts',
    'translate',
    '`${labelX}px ${labelY}px`',
    'Map labels follow a world-to-screen projection already expressed in CSS pixels.',
  ],
  [
    'src/app/scenes/objectivePointer.ts',
    'left',
    '`left:${placement.x}px;top:${placement.y}px;--objective-edge-angle:${placement.angle}rad`',
    'The objective pointer placement is computed against the viewport in CSS pixels.',
  ],
  [
    'src/app/scenes/objectivePointer.ts',
    'top',
    '`left:${placement.x}px;top:${placement.y}px;--objective-edge-angle:${placement.angle}rad`',
    'The objective pointer placement is computed against the viewport in CSS pixels.',
  ],
  [
    'src/app/ui/Toasts.ts',
    '--toast-anchor',
    '`${Math.round(bottom - footer.getBoundingClientRect().top)}px`',
    'The toast anchors to a measured footer edge in the viewport.',
  ],
  [
    'src/app/ui/Toasts.ts',
    '--toast-aside',
    '`${Math.round(box.right - menu.left)}px`',
    'The toast shift comes from two DOM edges measured in CSS pixels.',
  ],
  [
    'src/app/ui/Toasts.ts',
    '--toast-reserve',
    '`${Math.round(height + 2 * gap)}px`',
    'The layout reserves the measured toast height and gap in CSS pixels.',
  ],
  [
    'src/app/ui/Toasts.ts',
    '--toast-anchor',
    '`${Math.round(top - box.top)}px`',
    'The normal toast anchor comes from the viewport and toast container edges.',
  ],
];

const colourFunctions = new Set([
  'rgb',
  'rgba',
  'hsl',
  'hsla',
  'hwb',
  'lab',
  'lch',
  'oklab',
  'oklch',
  'color',
  'device-cmyk',
]);
const namedColours = new Set(Object.keys(colorNames));
const colourProperty =
  /(?:^|-)color$|^(?:background(?:-image)?|border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?|border-image(?:-source)?|outline|box-shadow|text-shadow|text-decoration|text-emphasis|fill|stroke|filter|backdrop-filter|mask(?:-image)?|column-rule|caret|list-style(?:-image)?)$/;
const numeric = String.raw`[+-]?(?:\d*\.\d+|\d+\.?)(?:e[+-]?\d+)?`;
const valueTokens = new RegExp(
  String.raw`(?<![\w.-])(?:${numeric})(?:px|ms|s)?(?![\w.-])|#[a-f\d]+(?![\w-])|[a-z_-][\w-]*`,
  'gi',
);

function cssText(value) {
  // Comments, strings and URLs may contain colour-like fragments or dimensions.
  // Preserve CSS escapes until after stripping quoted payloads.
  return value
    .replace(
      /\/\*[\s\S]*?\*\/|\burl\(\s*(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|(?:\\.|[^)\\])*)\)|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/gi,
      ' ',
    )
    .replace(/\\(?:([\da-f]{1,6})(?:\r\n|[ \t\r\n\f])?|([^\r\n\f]))/gi, (_, hex, char) => {
      if (!hex) return char;
      const point = Number.parseInt(hex, 16);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '\ufffd';
    });
}

function rulesBroken(value, property) {
  const text = cssText(value);
  const result = new Set();
  const canContainNamedColour = property.startsWith('--') || colourProperty.test(property);
  const stacking = property === 'z-index' || property.startsWith('--z-');
  for (const match of text.matchAll(valueTokens)) {
    const token = match[0].toLowerCase();
    const after = text.slice(match.index + match[0].length);
    if (
      /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(token) ||
      (after.startsWith('(') && colourFunctions.has(token)) ||
      (namedColours.has(token) && canContainNamedColour)
    ) {
      result.add('literal colour');
    }
    if (/^[+-]?(?:\d|\.)/.test(token)) {
      if (token.endsWith('px') && Number(token.slice(0, -2)) !== 0) result.add('px length');
      if (/m?s$/.test(token)) result.add('literal duration');
      if (stacking && Number.isFinite(Number(token))) result.add('numeric z-index');
    }
    if (token === 'cubic-bezier' && after.startsWith('(')) result.add('literal easing');
  }
  return result;
}

function scanCss(text, file, report) {
  const css = postcss.parse(text, { from: file });
  css.walkDecls((decl) => {
    const parent = decl.parent;
    if (
      file === base &&
      parent?.type === 'rule' &&
      parent.selector.trim() === ':root' &&
      parent.parent === css
    ) {
      return;
    }
    report(decl.source.start.line, decl.prop.toLowerCase(), decl.value);
  });
  css.walkAtRules(/^(media|container|supports)$/i, (rule) => {
    report(rule.source.start.line, `@${rule.name}`, rule.params);
  });
}

function memberName(node) {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) {
    return node.argumentExpression.text;
  }
}

function scanTypeScript(text, file, report) {
  const filename = file.replace(/\.txt$/, '');
  const source = ts.createSourceFile(
    filename,
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const options = { noLib: true, noResolve: true, types: [] };
  const checker = ts
    .createProgram([filename], options, {
      ...ts.createCompilerHost(options),
      getSourceFile: (name) => (name === filename ? source : undefined),
    })
    .getTypeChecker();
  const writes = new Map();

  function addWrite(name, value) {
    if (!value || !ts.isIdentifier(name)) return;
    const symbol = checker.getSymbolAtLocation(name);
    if (!symbol) return;
    if (!writes.has(symbol)) writes.set(symbol, []);
    writes.get(symbol).push(value);
  }

  function collectWrites(node) {
    if (ts.isVariableDeclaration(node)) addWrite(node.name, node.initializer);
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      addWrite(node.left, node.right);
    }
    ts.forEachChild(node, collectWrites);
  }
  collectWrites(source);

  function initializers(node) {
    return ts.isIdentifier(node) ? (writes.get(checker.getSymbolAtLocation(node)) ?? []) : [];
  }

  function isStyle(node, seen = new Set()) {
    if (seen.has(node)) return false;
    return (
      memberName(node) === 'style' ||
      initializers(node).some((value) => isStyle(value, new Set(seen).add(node)))
    );
  }

  function values(node, seen = new Set()) {
    if (seen.has(node)) return [];
    const next = new Set(seen).add(node);
    if (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node))
      return [{ text: node.text, node }];
    if (ts.isTemplateExpression(node)) {
      return [
        {
          text:
            node.head.text +
            node.templateSpans
              .map((span) => (values(span.expression, next)[0]?.text ?? '1') + span.literal.text)
              .join(''),
          node,
        },
      ];
    }
    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isSatisfiesExpression(node)
    ) {
      return values(node.expression, next);
    }
    if (ts.isConditionalExpression(node)) {
      return [...values(node.whenTrue, next), ...values(node.whenFalse, next)];
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const left = values(node.left, next);
      const right = values(node.right, next);
      if (!left.length && !right.length) return [];
      return (left.length ? left : [{ text: '1' }]).flatMap((a) =>
        (right.length ? right : [{ text: '1' }]).map((b) => ({ text: a.text + b.text, node })),
      );
    }
    return initializers(node).flatMap((value) => values(value, next));
  }

  function propertyValue(property, node) {
    for (const value of values(node)) {
      const line = source.getLineAndCharacterOfPosition(value.node.getStart(source)).line + 1;
      const site = value.node.getText(source);
      if (property === 'cssText') {
        // Parse declaration lists as CSS so delimiters in strings and functions
        // cannot split an inline value into unrelated declarations.
        const list = postcss.parse(`x{${value.text}}`, { from: file });
        list.walkDecls((decl) => report(line, decl.prop.toLowerCase(), decl.value, site));
      } else {
        const cssProperty = property.startsWith('--')
          ? property
          : property.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());
        report(line, cssProperty, value.text, site);
      }
    }
  }

  function objectStyle(node, seen = new Set()) {
    if (seen.has(node)) return;
    const next = new Set(seen).add(node);
    if (ts.isStringLiteralLike(node) || ts.isTemplateExpression(node)) {
      propertyValue('cssText', node);
      return;
    }
    if (!ts.isObjectLiteralExpression(node)) {
      for (const value of initializers(node)) objectStyle(value, next);
      return;
    }
    for (const property of node.properties) {
      if (ts.isSpreadAssignment(property)) objectStyle(property.expression, next);
      if (
        ts.isPropertyAssignment(property) &&
        (ts.isIdentifier(property.name) || ts.isStringLiteralLike(property.name))
      ) {
        propertyValue(property.name.text, property.initializer);
      }
      if (ts.isShorthandPropertyAssignment(property))
        propertyValue(property.name.text, property.name);
    }
  }

  function visit(node) {
    if (
      ts.isPropertyAssignment(node) &&
      (ts.isIdentifier(node.name) || ts.isStringLiteralLike(node.name)) &&
      node.name.text === 'style'
    ) {
      objectStyle(node.initializer);
    }
    if (ts.isShorthandPropertyAssignment(node) && node.name.text === 'style') {
      const symbol = checker.getShorthandAssignmentValueSymbol(node);
      for (const value of writes.get(symbol) ?? []) objectStyle(value);
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const left = node.left;
      const property = memberName(left);
      if (property && isStyle(left)) propertyValue('cssText', node.right);
      else if (property && isStyle(left.expression)) propertyValue(property, node.right);
    }
    if (ts.isCallExpression(node)) {
      const method = memberName(node.expression);
      const owner = method ? node.expression.expression : undefined;
      const [first, second] = node.arguments;
      if (
        method === 'setProperty' &&
        isStyle(owner) &&
        first &&
        second &&
        ts.isStringLiteralLike(first)
      ) {
        propertyValue(first.text, second);
      }
      if (
        method === 'setAttribute' &&
        first &&
        second &&
        ts.isStringLiteralLike(first) &&
        first.text.toLowerCase() === 'style'
      ) {
        propertyValue('cssText', second);
      }
      if (
        method === 'assign' &&
        ts.isIdentifier(owner) &&
        owner.text === 'Object' &&
        first &&
        isStyle(first)
      ) {
        for (const argument of node.arguments.slice(1)) objectStyle(argument);
      }
    }
    if (ts.isStringLiteralLike(node) || ts.isTemplateExpression(node)) {
      for (const value of values(node)) {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        for (const [, , style] of value.text.matchAll(/<[^<>]*?\sstyle\s*=\s*(["'])(.*?)\1/gis)) {
          postcss.parse(`x{${style}}`, { from: file }).walkDecls((decl) => {
            report(line, decl.prop.toLowerCase(), decl.value, node.getText(source));
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

function* filesIn(directory, extension) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* filesIn(path, extension);
    else if (entry.name.endsWith(extension)) yield path;
  }
}

const paths = process.argv.slice(2);
const defaults = paths.length === 0;
const diagnostics = new Set();
const usedExceptions = new Map();
for (const path of defaults
  ? [...filesIn(join(root, 'src/styles'), '.css'), ...filesIn(join(root, 'src/app'), '.ts')]
  : paths) {
  const file = relative(root, path).replaceAll('\\', '/');
  const scan = /\.css(?:\.txt)?$/i.test(path) ? scanCss : scanTypeScript;
  const report = (line, property, value, site) => {
    for (const issue of rulesBroken(value, property)) {
      const exception =
        issue === 'px length' &&
        measuredPixels.find(
          (entry) => entry[0] === file && entry[1] === property && entry[2] === site,
        );
      if (exception) {
        const key = `${file}:${line}:${property}:${site}`;
        if (!usedExceptions.has(exception)) usedExceptions.set(exception, new Set());
        usedExceptions.get(exception).add(key);
      } else {
        diagnostics.add(`${file}:${line}: ${issue} in ${property}: ${value}`);
      }
    }
  };
  scan(readFileSync(path, 'utf8'), file, report);
}
if (defaults) {
  for (const exception of measuredPixels) {
    const [file, property, site, reason] = exception;
    const count = usedExceptions.get(exception)?.size ?? 0;
    if (count !== 1)
      diagnostics.add(
        `${file}: expected one measured pixel site (${property}: ${site}), found ${count}. ${reason}`,
      );
  }
}
if (diagnostics.size) {
  for (const detail of diagnostics) process.stderr.write(detail + '\n');
  process.exitCode = 1;
} else {
  process.stdout.write('CSS token check passed.\n');
}
