/**
 * Production build: Tailwind CLI for CSS + esbuild for the JS bundle.
 * Both are native tools, so the build is fast and dependency-light.
 * Output goes to ./dist, ready to serve from any static host.
 */
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const dist = path.join(root, 'dist');
const assets = path.join(dist, 'assets');

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(assets, { recursive: true });

// 1. CSS via Tailwind
execSync('npx tailwindcss -i ./src/index.css -o ./dist/assets/app.css --minify', {
  stdio: 'inherit'
});

// 2. JS bundle via esbuild (React + app + the icons actually used)
await build({
  entryPoints: [path.join(root, 'src/main.jsx')],
  bundle: true,
  minify: true,
  format: 'esm',
  target: ['es2019'],
  jsx: 'automatic',
  loader: { '.js': 'jsx', '.css': 'empty' },
  outfile: path.join(assets, 'app.js'),
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'info'
});

// 3. Static files (icons, manifest, service worker)
for (const name of fs.readdirSync(path.join(root, 'public'))) {
  fs.copyFileSync(path.join(root, 'public', name), path.join(dist, name));
}

// 4. Cache-busting version stamped into index.html and the service worker
const hash = crypto
  .createHash('sha256')
  .update(fs.readFileSync(path.join(assets, 'app.js')))
  .update(fs.readFileSync(path.join(assets, 'app.css')))
  .digest('hex')
  .slice(0, 10);

const html = `<!doctype html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0e1117" />
    <meta name="description" content="Gimmi AI - a warm, smart assistant that speaks Hinglish, Hindi and English. Chat, generate images, search live and listen to replies." />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <link rel="icon" type="image/png" href="./icon-192.png" />
    <link rel="apple-touch-icon" href="./icon-192.png" />
    <link rel="manifest" href="./manifest.webmanifest" />
    <link rel="stylesheet" href="./assets/app.css?v=${hash}" />
    <title>Gimmi AI - Smart Hinglish Assistant</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./assets/app.js?v=${hash}"></script>
  </body>
</html>
`;
fs.writeFileSync(path.join(dist, 'index.html'), html);

// Point the service worker cache at this build so old shells are purged.
const swPath = path.join(dist, 'sw.js');
fs.writeFileSync(swPath, fs.readFileSync(swPath, 'utf8').replace('gimmi-ai-v1', `gimmi-ai-${hash}`));

// 5. SPA fallback for hosts that look for 404.html (GitHub Pages)
fs.copyFileSync(path.join(dist, 'index.html'), path.join(dist, '404.html'));

console.log(`\nBuild complete -> dist/  (version ${hash})`);
