// One-off: renders favicon PNGs + OG image from local render pages.
import puppeteer from 'puppeteer';

const BASE = 'http://localhost:3010';
const jobs = [
  { url: `${BASE}/assets/favicon/render.html?mode=rounded`, w: 32,   h: 32,  out: 'assets/favicon/favicon-32.png' },
  { url: `${BASE}/assets/favicon/render.html`,              w: 180,  h: 180, out: 'assets/favicon/apple-touch-icon.png' },
  { url: `${BASE}/assets/favicon/render.html?mode=rounded`, w: 512,  h: 512, out: 'assets/favicon/icon-512.png' },
  { url: `${BASE}/assets/og/og.html`,                       w: 1200, h: 630, out: 'assets/og/omni-og.png' },
];

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
for (const j of jobs) {
  await page.setViewport({ width: j.w, height: j.h, deviceScaleFactor: 1 });
  await page.goto(j.url, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 400));
  await page.screenshot({ path: j.out, omitBackground: true });
  console.log('rendered', j.out);
}
await browser.close();
