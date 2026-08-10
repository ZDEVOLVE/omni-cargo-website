import puppeteer from 'puppeteer';
import { mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const url = process.argv[2] || 'http://localhost:3001/index.html';
const selector = process.argv[3] || '#inventory';
const label = process.argv[4] || 'section';
const dir = join(__dirname, 'temporary screenshots');
mkdirSync(dir, { recursive: true });

const existing = readdirSync(dir).filter(f => f.startsWith('screenshot-'));
const num = existing.length + 1;
const filename = `screenshot-${num}-${label}.png`;

const browser = await puppeteer.launch({ headless: 'shell', protocolTimeout: 120000 });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });
await page.evaluate(() => new Promise(r => setTimeout(r, 1500)));
const el = await page.$(selector);
if (!el) { console.error('Selector not found:', selector); process.exit(1); }
await el.screenshot({ path: join(dir, filename) });
await browser.close();
console.log(`Saved: ${join(dir, filename)}`);
