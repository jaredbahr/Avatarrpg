// Builds gallery/index.html from the shots.jsonl each gallery project wrote.
//
// Plain Node, no dependencies: it runs in the deploy job between the gallery
// capture and the copy into dist/, and it must never be the reason a deploy
// fails. A project with no shots is simply absent from the page.

import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'gallery';

if (!existsSync(ROOT)) {
  console.error('No gallery/ directory: run `npm run gallery` first.');
  process.exit(1);
}

const escape = (text) => String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const projects = readdirSync(ROOT)
  .filter((name) => statSync(join(ROOT, name)).isDirectory())
  .sort();

const sections = [];
let total = 0;

for (const project of projects) {
  const file = join(ROOT, project, 'shots.jsonl');
  if (!existsSync(file)) continue;
  const shots = readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  if (shots.length === 0) continue;
  total += shots.length;

  // Group a filmstrip's frames under one heading.
  const byBeat = new Map();
  for (const shot of shots) {
    const group = byBeat.get(shot.beat) ?? { title: shot.title, shots: [] };
    group.shots.push(shot);
    byBeat.set(shot.beat, group);
  }

  const figures = [...byBeat.entries()]
    .map(([beat, group]) => {
      const images = group.shots
        .map(
          (shot) =>
            `<figure><a href="${escape(`${project}/${shot.file}`)}"><img loading="lazy" src="${escape(`${project}/${shot.file}`)}" alt="${escape(shot.title)}"></a><figcaption>${escape(shot.note)}</figcaption></figure>`,
        )
        .join('\n');
      return `<section class="beat" id="${escape(`${project}-${beat}`)}"><h3>${escape(beat)} · ${escape(group.title)}</h3><div class="strip">${images}</div></section>`;
    })
    .join('\n');

  sections.push(
    `<section class="project" id="${escape(project)}"><h2>${escape(project)}</h2>${figures}</section>`,
  );
}

const sha = process.env.GITHUB_SHA ? process.env.GITHUB_SHA.slice(0, 7) : 'local';
const when = new Date().toISOString().slice(0, 16).replace('T', ' ');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Four Nations Tactics — gallery</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; padding: 1rem; background: #120d0a; color: #f4e9d8; font: 16px/1.4 system-ui, sans-serif; }
  h1 { font-size: 1.5rem; margin: 0 0 0.25rem; }
  h2 { font-size: 1.2rem; margin: 2rem 0 0.5rem; border-bottom: 1px solid #3a2d24; padding-bottom: 0.25rem; }
  h3 { font-size: 1rem; margin: 1.25rem 0 0.5rem; color: #d9a441; }
  .meta { color: #a89880; font-size: 0.9rem; margin: 0 0 1rem; }
  nav a { color: #f0c674; margin-right: 1rem; }
  .strip { display: flex; gap: 0.75rem; overflow-x: auto; padding-bottom: 0.5rem; }
  figure { margin: 0; flex: 0 0 auto; width: min(90vw, 40rem); }
  img { width: 100%; height: auto; display: block; border: 1px solid #3a2d24; border-radius: 4px; background: #000; }
  figcaption { font-size: 0.85rem; color: #cfc3ae; margin-top: 0.35rem; }
</style>
</head>
<body>
<h1>Four Nations Tactics — gallery</h1>
<p class="meta">${escape(total)} pictures · build ${escape(sha)} · ${escape(when)} UTC · captured from the production build with a fixed seed. Scroll a strip sideways to step through a playback.</p>
<nav>${projects.map((p) => `<a href="#${escape(p)}">${escape(p)}</a>`).join('')}</nav>
${sections.join('\n')}
</body>
</html>
`;

writeFileSync(join(ROOT, 'index.html'), html);
console.log(`gallery/index.html: ${total} pictures across ${sections.length} project(s).`);
