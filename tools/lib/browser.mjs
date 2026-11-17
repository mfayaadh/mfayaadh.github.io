// Resolves playwright-core wherever it happens to live and launches the
// system Chromium/Chrome. The repo has no package.json on purpose, so it is
// resolved from the npx cache or a global npm install.

import { readdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export class PlaywrightUnavailable extends Error {
  constructor(tried) {
    super(
      'playwright-core not found. Install it once with:\n' +
      '  npx --yes playwright-core@1.49.1 --version\n' +
      'Tried:\n  ' + tried.join('\n  ')
    );
    this.name = 'PlaywrightUnavailable';
  }
}

/** Every plausible playwright-core entry point on this machine, best first. */
function candidates() {
  const out = [];
  const npx = path.join(homedir(), '.npm', '_npx');
  if (existsSync(npx)) {
    for (const hash of readdirSync(npx)) {
      const entry = path.join(npx, hash, 'node_modules', 'playwright-core', 'index.mjs');
      if (existsSync(entry)) out.push(entry);
    }
  }
  for (const base of ['.npm-global', '.local/share/npm']) {
    const entry = path.join(homedir(), base, 'lib', 'node_modules', 'playwright-core', 'index.mjs');
    if (existsSync(entry)) out.push(entry);
  }
  return out;
}

async function loadPlaywright() {
  const tried = ['bare specifier "playwright-core"'];
  try {
    return await import('playwright-core');
  } catch { /* no package.json here, so this is the expected path */ }

  const found = candidates();
  for (const entry of found) {
    try {
      return await import(pathToFileURL(entry).href);
    } catch (e) {
      tried.push(`${entry} (${e.code || e.message})`);
    }
  }
  throw new PlaywrightUnavailable(tried.concat(found.length ? [] : ['~/.npm/_npx/*/node_modules/playwright-core']));
}

/**
 * Launch headless system Chrome or Chromium.
 * @returns {Promise<import('playwright-core').Browser>}
 */
export async function launch() {
  const { chromium } = await loadPlaywright();
  for (const bin of ['/usr/bin/chromium', '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome']) {
    if (existsSync(bin)) {
      return chromium.launch({ executablePath: bin, headless: true });
    }
  }
  return chromium.launch({ channel: 'chrome', headless: true });
}
