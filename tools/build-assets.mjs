#!/usr/bin/env node
// Builds generated assets:
//   assets/og.jpg   1200×630 social preview (from the live title screen)
// The site intentionally has no CV download; the owner maintains their own CV.
//
//   node tools/build-assets.mjs

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './lib/browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.webp': 'image/webp' };
const server = http.createServer(async (req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(ROOT, url === '/' ? 'index.html' : url);
  try { res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(await readFile(file)); }
  catch { res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;
const browser = await launch();

// 1. OG image
{
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, reducedMotion: 'reduce', locale: 'en-US' });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: '.hud{display:none!important}' });
  await page.waitForTimeout(600);
  const png = path.join(ROOT, 'assets/og.png');
  await page.screenshot({ path: png });
  execFileSync('magick', [png, '-quality', '84', path.join(ROOT, 'assets/og.jpg')]);
  execFileSync('rm', [png]);
  await ctx.close();
  console.log('  og.jpg ok');
}

await browser.close();
server.close();
