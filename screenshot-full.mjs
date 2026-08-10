// Full-page screenshot at deviceScaleFactor 1 — avoids Chrome's 16384px texture
// corruption on very tall pages. Usage: node screenshot-full.mjs <url> <label> [width]
import puppeteer from 'puppeteer';
import { mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const url = process.argv[2] || 'http://localhost:3010';
const label = process.argv[3] || 'full';
const width = Number(process.argv[4]) || 1440;
const dir = join(__dirname, 'temporary screenshots');
mkdirSync(dir, { recursive: true });
const num = readdirSync(dir).filter(f => f.startsWith('screenshot-')).length + 1;
const filename = `screenshot-${num}-${label}.png`;

// 'shell' headless: new-headless Page.captureScreenshot hangs on this machine (2026-08).
const browser = await puppeteer.launch({ headless: 'shell', protocolTimeout: 120000 });
const page = await browser.newPage();
await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
// Scroll through the page to trigger loading="lazy" images, then return to top.
await page.evaluate(async () => {
  const step = window.innerHeight;
  for (let y = 0; y < document.body.scrollHeight; y += step) {
    window.scrollTo(0, y);
    await new Promise(r => setTimeout(r, 120));
  }
  window.scrollTo(0, 0);
});
await page.evaluate(() => new Promise(r => setTimeout(r, 1200)));
// House rule: freeze all animation before capture — also prevents
// Page.captureScreenshot stalls from infinite compositor animations.
await page.evaluate(() => {
  const s = document.createElement('style');
  s.textContent = '*,*::before,*::after{animation-play-state:paused!important;transition:none!important}';
  document.head.appendChild(s);
  if (window.gsap) { gsap.killTweensOf('*'); gsap.globalTimeline.pause(); }
});
await page.screenshot({ path: join(dir, filename), fullPage: true });
await browser.close();
console.log(`Saved: ${join(dir, filename)}`);
