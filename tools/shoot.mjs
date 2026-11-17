#!/usr/bin/env node
// Captures screenshots of the public project sites into assets/shots/<slug>.webp.
//
//   node tools/shoot.mjs              all targets
//   node tools/shoot.mjs cakap        subset by slug prefix

import { mkdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './lib/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets/shots');

const TARGETS = [
  { slug: 'cakap-home',  url: 'https://cakap.biz.id/' },
  { slug: 'sekolahrcm',  url: 'https://sekolahrcm.sch.id/', wait: 3500 },
];

mkdirSync(OUT, { recursive: true });
const filter = process.argv.slice(2);
const list = filter.length ? TARGETS.filter(t => filter.some(f => t.slug.startsWith(f))) : TARGETS;

const browser = await launch();
for (const t of list) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const png = path.join(OUT, `${t.slug}.png`);
  const dest = path.join(OUT, `${t.slug}.webp`);
  process.stdout.write(`  ${t.slug.padEnd(12)} ${t.url} ... `);
  try {
    await page.goto(t.url, { waitUntil: 'networkidle', timeout: 30000 })
      .catch(() => page.goto(t.url, { waitUntil: 'load', timeout: 20000 }));
    await page.waitForTimeout(t.wait || 2000);
    if (t.click) { await page.click(t.click, { timeout: 5000 }).catch(() => {}); await page.waitForTimeout(4000); }
    await page.screenshot({ path: png, clip: { x: 0, y: 0, width: 1280, height: 800 } });
    execFileSync('magick', [png, '-resize', '960x600', '-quality', '78', dest]);
    execFileSync('rm', [png]);
    console.log(`ok (${Math.round(statSync(dest).size / 1024)} KB)`);
  } catch (e) {
    console.log(`SKIP (${e.message.split('\n')[0]})`);
  }
  await ctx.close();
}
await browser.close();
