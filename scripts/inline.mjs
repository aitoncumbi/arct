// Folds the built JS and CSS into one self-contained dist/standalone.html.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
let html = readFileSync(join(dist, 'index.html'), 'utf8');

html = html.replace(/<link rel="stylesheet"[^>]*href="\.\/([^"]+)"[^>]*>/g, (_, file) =>
  `<style>${readFileSync(join(dist, file), 'utf8')}</style>`);
html = html.replace(/<script type="module"[^>]*src="\.\/([^"]+)"[^>]*><\/script>/g, (_, file) => {
  const js = readFileSync(join(dist, file), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script type="module">${js}</script>`;
});

writeFileSync(join(dist, 'standalone.html'), html);
console.log('wrote dist/standalone.html', (html.length / 1024).toFixed(0) + ' kB');
