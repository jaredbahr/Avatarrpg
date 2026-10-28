/** Inspect the actual production service-worker output after ci:local builds. */
import { readFileSync } from 'node:fs';

const worker = readFileSync('dist/sw.js', 'utf8');
if (worker.includes('art/portraits/expressions/'))
  throw new Error('Optional expressions leaked into the service-worker precache.');
if (!worker.includes('art/portraits/kaya.png'))
  throw new Error('Neutral Kaya portrait is missing from the service-worker precache.');
console.log('Production service worker precaches neutral Kaya and excludes optional expressions.');
