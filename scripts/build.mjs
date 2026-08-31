import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist/content', { recursive: true });
await mkdir('dist/background', { recursive: true });
await mkdir('dist/popup', { recursive: true });

await build({
  entryPoints: ['src/content/content-script.js'],
  outfile: 'dist/content/content-script.js',
  bundle: true,
  minify: true,
  target: 'chrome120'
});

await cp('src/content/card-position-fix.js', 'dist/content/card-position-fix.js');

await build({
  entryPoints: ['src/background/service-worker.js'],
  outfile: 'dist/background/service-worker.js',
  bundle: true,
  minify: true,
  target: 'chrome120'
});

await cp('manifest.json', 'dist/manifest.json');
await cp('src/content/content.css', 'dist/content/content.css');
await cp('src/popup/popup.html', 'dist/popup/popup.html');
await cp('src/popup/popup.css', 'dist/popup/popup.css');
await cp('src/popup/popup.js', 'dist/popup/popup.js');

console.log('Built extension in dist/');
