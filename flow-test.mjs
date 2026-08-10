import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'shell', protocolTimeout: 60000 });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto('http://localhost:3010/app.html', { waitUntil: 'networkidle0' });

const visible = sel => page.$eval(sel, el => {
  const s = getComputedStyle(el.closest('.screen') || el);
  return s.visibility !== 'hidden' && s.opacity !== '0';
});

// 1. Login with wrong OTP then right OTP
await page.type('#lphone', '0712345678');
await page.type('#lotp', '1234');
await page.click('#loginForm .a-btn');
await page.type('#lotp', '0000');
await page.click('#loginForm .a-btn');
await new Promise(r => setTimeout(r, 400));
console.log('login → home:', await visible('#scr-home') ? 'OK' : 'FAIL');

// 2. Book flow
await page.click('.q-tile[data-go="scr-book"]');
await new Promise(r => setTimeout(r, 350));
await page.type('#bkFrom', 'Shimanzi Road, Mombasa');
await page.type('#bkTo', 'Westlands, Nairobi');
await page.click('#bkNext1');
await page.type('#bkCargo', '4 boxes of shop stock');
await page.click('#bkNext2');
const price = await page.$eval('#rvPrice', el => el.textContent);
console.log('book review price:', price.includes('KES') ? 'OK (' + price + ')' : 'FAIL');
await page.click('#bkConfirm');
const tn = await page.$eval('#newTn', el => el.textContent);
console.log('book confirmed tn:', /^OC-2026-\d{5}$/.test(tn) ? 'OK (' + tn + ')' : 'FAIL (' + tn + ')');

// 3. Track via success CTA
await page.evaluate(() => document.querySelector('#bk4 [data-go="scr-track"]').click());
await new Promise(r => setTimeout(r, 350));
console.log('track screen:', await visible('#scr-track') ? 'OK' : 'FAIL');

// 4. Payments + M-Pesa sheet
await page.evaluate(() => document.querySelector('.tab[data-go="scr-pay"]').click());
await new Promise(r => setTimeout(r, 350));
await page.evaluate(() => document.getElementById('payNow').click());
await new Promise(r => setTimeout(r, 400));
const sheetOn = await page.$eval('#mpesaVeil', el => el.classList.contains('on'));
console.log('mpesa sheet:', sheetOn ? 'OK' : 'FAIL');
await page.evaluate(() => document.getElementById('mpDone').click());
await new Promise(r => setTimeout(r, 300));
const paid = await page.$eval('#payNow', el => el.textContent);
console.log('payment simulated:', paid.includes('PAID') ? 'OK' : 'FAIL');

// 5. Profile + logout
await page.evaluate(() => document.querySelector('.tab[data-go="scr-profile"]').click());
await new Promise(r => setTimeout(r, 350));
await page.evaluate(() => document.getElementById('logoutBtn').click());
await new Promise(r => setTimeout(r, 350));
console.log('logout → login:', await visible('#scr-login') ? 'OK' : 'FAIL');

console.log('JS errors:', errors.length ? errors.join(' | ') : 'NONE');
await browser.close();
