#!/usr/bin/env node
// Mechanical QA for the static site. Serves the repo on a random local port and
// checks, per viewport: console/page errors, failed local requests, horizontal
// overflow, broken in-page anchors, images that fail to decode. Also verifies the
// page is fully readable with JavaScript disabled and with reduced motion.
//
//   node tools/check.mjs                 run checks
//   node tools/check.mjs --shots <dir>   also save full-page screenshots

import http from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './lib/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argShots = process.argv.indexOf('--shots');
const SHOTS = argShots > -1 ? path.resolve(process.argv[argShots + 1]) : null;
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.pdf': 'application/pdf' };

const server = http.createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(ROOT, url === '/' ? 'index.html' : url);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end('not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;
if (SHOTS) await mkdir(SHOTS, { recursive: true });

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1180, height: 760 },
  { name: 'tablet', width: 820, height: 1100 },
  { name: 'phone', width: 390, height: 844 },
  { name: 'small', width: 320, height: 640 },
];

const browser = await launch();
let failures = 0;
const fail = (scope, msg) => { failures++; console.log(`  ✗ [${scope}] ${msg}`); };

async function settle(page) {
  // scroll through so every lazy image and reveal fires
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo({ top: y, behavior: 'instant' }); await new Promise(r => setTimeout(r, 60)); }
    window.scrollTo({ top: 0, behavior: 'instant' });
  });
  await page.waitForTimeout(900);
}

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push(e.message));
  page.on('requestfailed', r => { if (r.url().startsWith(BASE)) errors.push(`request failed: ${r.url()}`); });
  page.on('response', r => { if (r.url().startsWith(BASE) && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2200); // intro curtain
  await settle(page);

  errors.forEach(e => fail(vp.name, e));

  const r = await page.evaluate(() => {
    const out = { overflow: [], anchors: [], images: [], hidden: [] };
    const W = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > W + 1) out.overflow.push(`document scrollWidth ${document.documentElement.scrollWidth} > ${W}`);
    for (const el of document.querySelectorAll('main *')) {
      const cs = getComputedStyle(el);
      if (cs.position === 'absolute' || el.closest('.scene,.ticker,.sec__maze,.burst,.tape,svg')) continue;
      const b = el.getBoundingClientRect();
      if (b.width && (b.right > W + 2 || b.left < -2) && !el.closest('[aria-hidden="true"]')) {
        out.overflow.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} [${Math.round(b.left)}, ${Math.round(b.right)}]`);
      }
    }
    for (const a of document.querySelectorAll('a[href^="#"]')) {
      const id = a.getAttribute('href').slice(1);
      if (id && !document.getElementById(id)) out.anchors.push(a.getAttribute('href'));
    }
    for (const img of document.querySelectorAll('img')) {
      if (!img.complete || img.naturalWidth === 0) out.images.push(img.getAttribute('src'));
    }
    for (const el of document.querySelectorAll('.rv, .ransom, .stamp')) {
      if (el.offsetParent !== null && getComputedStyle(el).opacity === '0') out.hidden.push(el.className);
    }
    return out;
  });
  r.overflow.slice(0, 8).forEach(o => fail(vp.name, `overflow: ${o}`));
  r.anchors.forEach(a => fail(vp.name, `broken anchor ${a}`));
  r.images.forEach(s => fail(vp.name, `image not loaded ${s}`));
  r.hidden.slice(0, 5).forEach(h => fail(vp.name, `still hidden after scroll: ${h}`));

  if (SHOTS) {
    await page.screenshot({ path: path.join(SHOTS, `${vp.name}-fold.png`) });
    await page.screenshot({ path: path.join(SHOTS, `${vp.name}-full.png`), fullPage: true });
  }
  console.log(`  ${r.overflow.length + r.anchors.length + r.images.length + errors.length ? '…' : '✓'} ${vp.name} ${vp.width}×${vp.height}`);
  await ctx.close();
}

// No-JS: everything readable
{
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const hidden = await page.evaluate(() => [...document.querySelectorAll('.rv, .ransom, .stamp, .mission')]
    .filter(el => getComputedStyle(el).opacity === '0').length);
  hidden ? fail('nojs', `${hidden} elements invisible without JS`) : console.log('  ✓ no-JS readable');
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'nojs-full.png'), fullPage: true });
  await ctx.close();
}

// Reduced motion: no intro, everything visible immediately
{
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  const st = await page.evaluate(() => ({
    intro: document.documentElement.classList.contains('intro'),
    hidden: [...document.querySelectorAll('.rv, .ransom .rl, .stamp')].filter(el => getComputedStyle(el).opacity === '0').length,
  }));
  if (st.intro) fail('reduced', 'intro curtain shown under reduced motion');
  st.hidden ? fail('reduced', `${st.hidden} elements hidden under reduced motion`) : console.log('  ✓ reduced-motion readable');
  await ctx.close();
}

// Language toggle swaps visible copy
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US' });
  const page = await ctx.newPage();
  await page.goto(BASE + '#profile', { waitUntil: 'networkidle' });
  await page.click('#lang-btn');
  const ok = await page.evaluate(() => document.documentElement.lang === 'id' &&
    getComputedStyle(document.querySelector('.dossier .l-id')).display !== 'none' &&
    getComputedStyle(document.querySelector('.dossier .l-en')).display === 'none');
  ok ? console.log('  ✓ language toggle') : fail('lang', 'toggle did not swap EN → ID');
  await ctx.close();
}

await browser.close();
server.close();
console.log(failures ? `\n${failures} problem(s)` : '\nall checks passed');
process.exit(failures ? 1 : 0);
