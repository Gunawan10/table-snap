import { build } from 'esbuild';
import { cp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
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

await build({
  entryPoints: ['src/content/modern-table-support.js'],
  outfile: 'dist/content/modern-table-support.js',
  bundle: true,
  minify: true,
  target: 'chrome120'
});

await build({
  entryPoints: ['src/content/modern-image-background-fix.js'],
  outfile: 'dist/content/modern-image-background-fix.js',
  bundle: true,
  minify: true,
  target: 'chrome120'
});

await build({
  entryPoints: ['src/content/expanded-export-support.js'],
  outfile: 'dist/content/expanded-export-support.js',
  bundle: true,
  minify: true,
  target: 'chrome120'
});

await cp('src/content/extension-state.js', 'dist/content/extension-state.js');
await cp('src/content/semantic-cell-content.js', 'dist/content/semantic-cell-content.js');
await cp('src/content/native-colspan-fix.js', 'dist/content/native-colspan-fix.js');
await cp('src/content/card-copy-actions.js', 'dist/content/card-copy-actions.js');
await cp('src/content/card-position-fix.js', 'dist/content/card-position-fix.js');
await cp('src/content/image-background-fix.js', 'dist/content/image-background-fix.js');
await cp('src/content/export-error-state.js', 'dist/content/export-error-state.js');
await cp('src/content/tabler-format-icons.js', 'dist/content/tabler-format-icons.js');
await cp('src/content/export-action-state.js', 'dist/content/export-action-state.js');
await cp('src/content/table-editor-foundation.js', 'dist/content/table-editor-foundation.js');
await cp('src/content/table-editor-content-file-settings.js', 'dist/content/table-editor-content-file-settings.js');
await cp('src/content/table-editor-format-settings.js', 'dist/content/table-editor-format-settings.js');
await cp('src/content/table-editor-accordion.js', 'dist/content/table-editor-accordion.js');
await cp('src/content/table-editor-backdrop-guard.js', 'dist/content/table-editor-backdrop-guard.js');

await build({
  entryPoints: ['src/background/service-worker.js'],
  outfile: 'dist/background/service-worker.js',
  bundle: true,
  minify: true,
  target: 'chrome120'
});

await cp('manifest.json', 'dist/manifest.json');
await cp('src/content/content.css', 'dist/content/content.css');
await cp('src/content/export-grid-v2.css', 'dist/content/export-grid-v2.css');
await cp('src/content/tabler-format-icons.css', 'dist/content/tabler-format-icons.css');
await cp('src/content/export-action-state.css', 'dist/content/export-action-state.css');
await cp('src/content/save-loading.css', 'dist/content/save-loading.css');
await cp('src/content/table-editor-foundation.css', 'dist/content/table-editor-foundation.css');
await cp('src/content/table-editor-format-settings.css', 'dist/content/table-editor-format-settings.css');
await cp('src/content/table-editor-accordion.css', 'dist/content/table-editor-accordion.css');
await cp('src/content/table-editor-spacing.css', 'dist/content/table-editor-spacing.css');
await cp('src/popup/popup.html', 'dist/popup/popup.html');
await cp('src/popup/popup.css', 'dist/popup/popup.css');
await cp('src/popup/popup.js', 'dist/popup/popup.js');

const REMOTE_CODE_CHECKS = [
  { label: 'dynamic import()', pattern: /\bimport\s*\(/ },
  { label: 'remote script tag', pattern: /<script\b[^>]*\bsrc\s*=\s*["']https?:\/\//i },
  { label: 'remote importScripts()', pattern: /\bimportScripts\s*\(\s*["']https?:\/\//i },
  { label: 'remote Worker()', pattern: /\b(?:new\s+)?(?:Shared)?Worker\s*\(\s*["']https?:\/\//i },
  { label: 'remote JavaScript URL', pattern: /["']https?:\/\/[^"']+\.m?js(?:[?#][^"']*)?["']/i }
];

async function listTextFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listTextFiles(fullPath);
    return /\.(?:js|mjs|html)$/i.test(entry.name) ? [fullPath] : [];
  }));
  return nested.flat();
}

async function assertNoRemoteCode() {
  const files = await listTextFiles('dist');
  const violations = [];

  for (const file of files) {
    const source = await readFile(file, 'utf8');
    for (const check of REMOTE_CODE_CHECKS) {
      if (check.pattern.test(source)) violations.push(`${file}: ${check.label}`);
    }
  }

  if (violations.length) {
    throw new Error(`MV3 remote-code check failed:\n${violations.join('\n')}`);
  }
}

await assertNoRemoteCode();
console.log('Built extension in dist/');
console.log('MV3 remote-code check passed.');
