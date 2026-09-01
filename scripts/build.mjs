import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import sharp from 'sharp';

await rm('dist', { recursive: true, force: true });
await mkdir('dist/content', { recursive: true });
await mkdir('dist/background', { recursive: true });
await mkdir('dist/popup', { recursive: true });
await mkdir('dist/icons', { recursive: true });

for (const size of [16, 32, 48, 128]) {
  await sharp('src/assets/icon.svg')
    .resize(size, size)
    .png()
    .toFile(`dist/icons/icon${size}.png`);
}

await build({
  entryPoints: ['src/content/content-script.js'],
  outfile: 'dist/content/content-script.js',
  bundle: true,
  minify: true,
  target: 'chrome120'
});

await cp('src/content/extension-state.js', 'dist/content/extension-state.js');
await cp('src/content/card-copy-actions.js', 'dist/content/card-copy-actions.js');
await cp('src/content/card-position-fix.js', 'dist/content/card-position-fix.js');
await cp('src/content/image-background-fix.js', 'dist/content/image-background-fix.js');

await build({
  entryPoints: ['src/background/service-worker.js'],
  outfile: 'dist/background/service-worker.js',
  bundle: true,
  minify: true,
  target: 'chrome120'
});

await cp('manifest.json', 'dist/manifest.json');
await cp('src/content/content.css', 'dist/content/content.css');
await cp('src/content/save-loading.css', 'dist/content/save-loading.css');
await cp('src/popup/popup.html', 'dist/popup/popup.html');
await cp('src/popup/popup.css', 'dist/popup/popup.css');
await cp('src/popup/popup.js', 'dist/popup/popup.js');

console.log('Built extension in dist/');
