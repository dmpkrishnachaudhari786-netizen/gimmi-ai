/**
 * Browser smoke test: serves the built app, loads it in headless Chromium,
 * exercises the real UI (open settings, type, toggle modes, persona menu),
 * captures console/page errors, and writes screenshots.
 *
 * Run: node scripts/smoke.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PORT = 4180;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png'
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  let fp = path.join(root, urlPath === '/' ? 'index.html' : urlPath);
  if (!fp.startsWith(root)) return res.writeHead(403).end();
  if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) fp = path.join(root, 'index.html');
  res.writeHead(200, { 'Content-Type': types[path.extname(fp)] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});

const log = [];
const errors = [];
const pass = [];
const fail = [];

function check(name, cond) {
  (cond ? pass : fail).push(name);
  console.log(`${cond ? 'PASS' : 'FAIL'} - ${name}`);
}

await new Promise((r) => server.listen(PORT, r));

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/chromium',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.on('console', (m) => log.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 600));

  // Core render
  const bodyText = await page.evaluate(() => document.body.innerText);
  check('App mounts (greeting visible)', /Namaste, Dost!/.test(bodyText));
  check('Starter cards render', /AI Image Generate Karo/.test(bodyText));
  check('No missing-API-key banner hidden', /Gemini API key add karein/.test(bodyText));

  // Tailwind actually applied (not unstyled HTML)
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector('.bg-\\[\\#0e1117\\]') || document.body).backgroundColor);
  check('Tailwind CSS applied (dark bg)', bg === 'rgb(14, 17, 23)');

  // Settings modal opens and shows the key field
  const opened = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => /API Key & Models/.test(b.innerText));
    if (btn) btn.click();
    return !!btn;
  });
  await new Promise((r) => setTimeout(r, 400));
  check('Settings button found + clicked', opened);
  const hasKeyInput = await page.evaluate(() => !!document.querySelector('#gimmi-key'));
  check('Settings modal shows API key field', hasKeyInput);
  await page.screenshot({ path: 'screenshots/settings.png' });

  // Close settings
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'Cancel');
    b && b.click();
  });
  await new Promise((r) => setTimeout(r, 300));

  // Type into the composer; send button should enable
  await page.type('textarea', 'Namaste Gimmi');
  await new Promise((r) => setTimeout(r, 200));
  const sendDisabled = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'Send message');
    return b ? b.disabled : null;
  });
  check('Send button enables when text present', sendDisabled === false);

  // Pressing send with no key should open Settings (real guard, not a fake reply)
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.getAttribute('aria-label') === 'Send message');
    b && b.click();
  });
  await new Promise((r) => setTimeout(r, 500));
  const guardOpened = await page.evaluate(() => !!document.querySelector('#gimmi-key'));
  check('Missing-key guard opens Settings instead of faking a reply', guardOpened);
  await page.keyboard.press('Escape').catch(() => {});

  // Home screenshot (close modal first)
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.innerText.trim() === 'Cancel');
    b && b.click();
  });
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: 'screenshots/mobile-home.png', fullPage: false });

  // Desktop viewport
  const desktop = await browser.newPage();
  await desktop.setViewport({ width: 1280, height: 800 });
  await desktop.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 500));
  await desktop.screenshot({ path: 'screenshots/desktop-home.png' });

  // Light theme toggle
  await desktop.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /Dark Theme/.test(x.innerText));
    b && b.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  await desktop.screenshot({ path: 'screenshots/desktop-light.png' });

  // Persona menu
  await desktop.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /Gimmi Smart/.test(x.innerText));
    b && b.click();
  });
  await new Promise((r) => setTimeout(r, 300));
  const personaOpen = await desktop.evaluate(() => /choose ai style/i.test(document.body.innerText));
  check('Persona menu opens', personaOpen);

  /* ---------- PWA / installability ---------- */
  const mf = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
  check('Manifest: name/short_name/start_url/display=standalone',
    !!(mf.name && mf.short_name && mf.start_url && mf.display === 'standalone'));
  check('Manifest: 192 and 512 icons present',
    mf.icons.some((i) => i.sizes === '192x192') && mf.icons.some((i) => i.sizes === '512x512'));
  check('Manifest: maskable icon present', mf.icons.some((i) => /maskable/.test(i.purpose || '')));
  check('Manifest: scope + theme/background colours set',
    !!mf.scope && !!mf.theme_color && !!mf.background_color);
  check('Icon files exist on disk',
    ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png'].every((f) => fs.existsSync(path.join(root, f))));

  const pwa = await browser.newPage();
  await pwa.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  pwa.on('pageerror', (e) => errors.push('PWA: ' + e));
  await pwa.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' });

  const swOk = await pwa.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return 'unsupported';
    try {
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((res) => setTimeout(() => res(null), 8000))
      ]);
      return !!(reg && (reg.active || reg.installing || reg.waiting));
    } catch {
      return false;
    }
  });
  check('Service worker registers and activates', swOk === true);

  // Offline: with the SW active, the installed app must still open.
  await pwa.reload({ waitUntil: 'networkidle0' });
  await pwa.setOfflineMode(true);
  await pwa.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await new Promise((r) => setTimeout(r, 900));
  const offlineOk = await pwa.evaluate(() => /Namaste, Dost!/.test(document.body.innerText));
  check('App opens offline from the cached shell', offlineOk);
  await pwa.setOfflineMode(false);

  // Simulate the browser offering a one-tap install, then use our button.
  await pwa.evaluate(() => {
    const e = new Event('beforeinstallprompt');
    e.prompt = () => { window.__prompted = true; };
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);
  });
  await new Promise((r) => setTimeout(r, 350));
  check('Install banner appears when installable',
    await pwa.evaluate(() => /app ki tarah install karein/i.test(document.body.innerText)));
  await pwa.screenshot({ path: 'screenshots/install-banner.png' });

  await pwa.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(
      (x) => x.getAttribute('aria-label') === 'Install Gimmi AI app');
    b && b.click();
  });
  await new Promise((r) => setTimeout(r, 300));
  check('Install button triggers the native install prompt',
    await pwa.evaluate(() => window.__prompted === true));

  // iOS Safari has no native prompt -> show manual instructions.
  const ios = await browser.newPage();
  await ios.setUserAgent(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  );
  await ios.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await ios.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle0' });
  await ios.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(
      (x) => x.getAttribute('aria-label') === 'Install Gimmi AI app');
    b && b.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  check('iOS shows "Add to Home Screen" instructions',
    await ios.evaluate(() => /add to home screen/i.test(document.body.innerText)));
  await ios.screenshot({ path: 'screenshots/install-ios.png' });
} catch (e) {
  errors.push('SCRIPT: ' + e.message);
} finally {
  await browser.close();
  server.close();
}

console.log('\n--- console log ---');
console.log(log.join('\n') || '(none)');
console.log('\n--- page errors ---');
console.log(errors.join('\n') || '(none)');
console.log(`\nSUMMARY: ${pass.length} passed, ${fail.length} failed`);
if (fail.length) {
  console.log('FAILED: ' + fail.join(' | '));
  process.exit(1);
}
