/**
 * Visual + smoke check for the playfield.
 *
 *   npm run build && npm run preview   # in one terminal
 *   node tools/screenshots.mjs         # in another
 *
 * Writes PNGs to tools/shots/ and prints any console errors.
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = process.env.OUT || 'tools/shots';
const URL = process.env.URL || 'http://localhost:4173/';

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

const problems = [];

async function open(name, width, height) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    hasTouch: width < 800,
    isMobile: width < 800,
  });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(`[${name}] console: ${m.text()}`);
  });
  page.on('pageerror', (e) => problems.push(`[${name}] pageerror: ${e.message}`));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  return { ctx, page, name };
}

const shot = (s, suffix = '') =>
  s.page.screenshot({ path: `${OUT}/${s.name}${suffix}.png` });

/** Drags back from the slingshot by a screen-space vector and releases. */
async function fire(page, dx, dy) {
  const box = await page.locator('#scene').boundingBox();
  const x = box.x + box.width * 0.35;
  const y = box.y + box.height * 0.55;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 18 });
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.waitForTimeout(2200);
}

// Read the HUD, not the unlocked sections: scrolling now reveals sections
// too, so only the counter reflects actual hits.
const brokenCount = (page) =>
  page.evaluate(() => Number(document.getElementById('hitCount').textContent) || 0);

/* ── desktop ──────────────────────────────────────────────────── */

let s = await open('desktop', 1440, 860);
await shot(s, '-hero');

// Sweep a few angles until something breaks, so the check does not depend
// on one lucky trajectory.
// Crates sit well above the pouch, so a useful shot pulls back AND down
// (down on screen = up in the world).
let hits = 0;
for (const [dx, dy] of [
  [-130, 120],
  [-150, 90],
  [-100, 145],
  [-165, 60],
  [-90, 155],
  [-120, 100],
]) {
  await fire(s.page, dx, dy);
  hits = await brokenCount(s.page);
  if (hits > 0) break;
}
console.log(`desktop: ${hits} section(s) unlocked by firing`);
await s.page.evaluate(() => window.scrollTo(0, 0));
await s.page.waitForTimeout(700);
await shot(s, '-after-hit');

await s.page.evaluate(() => document.getElementById('experience').scrollIntoView());
await s.page.waitForTimeout(800);
await shot(s, '-content');

await s.page.evaluate(() => document.getElementById('projects').scrollIntoView());
await s.page.waitForTimeout(600);
await shot(s, '-projects');
await s.ctx.close();

/* ── desktop, light theme ─────────────────────────────────────── */

s = await open('desktop-light', 1440, 860);
// The top bar only slides in once you are past the playfield.
await s.page.evaluate(() => document.getElementById('experience').scrollIntoView());
await s.page.waitForTimeout(700);
await s.page.click('#themeBtn');
await s.page.waitForTimeout(500);
await shot(s, '-content');
await s.page.evaluate(() => window.scrollTo(0, 0));
await s.page.waitForTimeout(900);
await shot(s, '-hero');
await s.ctx.close();

/* ── mobile ───────────────────────────────────────────────────── */

s = await open('mobile', 390, 844);
await shot(s, '-hero');
await fire(s.page, -95, 30);
await s.page.evaluate(() => window.scrollTo(0, 0));
await s.page.waitForTimeout(600);
await shot(s, '-after-hit');
await s.page.evaluate(() => document.getElementById('experience').scrollIntoView());
await s.page.waitForTimeout(700);
await shot(s, '-content');
await s.ctx.close();

/* ── reduced motion: the game is skipped, so nothing may stay dimmed ── */

{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 860 },
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`[reduced-motion] pageerror: ${e.message}`));
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const locked = await page.evaluate(
    () => document.querySelectorAll('.section.is-locked').length
  );
  console.log(`reduced-motion: ${locked} section(s) still locked (want 0)`);
  await page.evaluate(() => document.getElementById('experience').scrollIntoView());
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/reduced-motion.png` });
  await ctx.close();
}

console.log(problems.length ? problems.join('\n') : 'no console errors');
await browser.close();
