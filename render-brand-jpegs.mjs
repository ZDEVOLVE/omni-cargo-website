// Renders high-res JPEG brand files from brand-export.html.
// Usage: node render-brand-jpegs.mjs [baseUrl]  (default http://localhost:3013)
import puppeteer from 'puppeteer';
import { mkdirSync } from 'fs';

const BASE = process.argv[2] || 'http://localhost:3013';
const OUT = '../assets/brand-export';
mkdirSync(OUT, { recursive: true });

const jobs = [
  { v: 'navy-lockup',  w: 1200, h: 600,  out: 'omni-cargo-logo-navy.jpg' },
  { v: 'white-lockup', w: 1200, h: 600,  out: 'omni-cargo-logo-white.jpg' },
  { v: 'navy-symbol',  w: 1024, h: 1024, out: 'omni-cargo-symbol-navy-square.jpg' },
  { v: 'white-symbol', w: 1024, h: 1024, out: 'omni-cargo-symbol-white-square.jpg' },
];

const browser = await puppeteer.launch({ headless: 'shell', protocolTimeout: 120000 });
const page = await browser.newPage();
for (const j of jobs) {
  await page.setViewport({ width: j.w, height: j.h, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/brand-export.html?v=${j.v}`, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: `${OUT}/${j.out}`, type: 'jpeg', quality: 95 });
  console.log('rendered', j.out, `${j.w * 2}x${j.h * 2}`);
}
await browser.close();
