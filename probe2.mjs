import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'shell' });
const page = await browser.newPage();
await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto('http://localhost:3010/index.html', { waitUntil: 'networkidle0', timeout: 45000 });
await new Promise(r => setTimeout(r, 800));
const info = await page.evaluate(() => ({
  title: document.title,
  buttons: document.querySelectorAll('button').length,
  burgerHTML: document.querySelector('.burger')?.outerHTML?.slice(0, 80) ?? 'NULL',
  burgerDisplay: document.querySelector('.burger') ? getComputedStyle(document.querySelector('.burger')).display : '-',
  bodyChildren: document.body.children.length,
}));
console.log(JSON.stringify(info, null, 2));
await browser.close();
