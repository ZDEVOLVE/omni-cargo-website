import puppeteer from 'puppeteer';
import { mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const url = process.argv[2] || 'http://localhost:3001/index.html';
const label = process.argv[3] || 'viewport';
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
await page.screenshot({ path: join(dir, filename), fullPage: false });
await browser.close();
console.log(`Saved: ${join(dir, filename)}`);
