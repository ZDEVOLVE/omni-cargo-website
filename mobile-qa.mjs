import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: 'shell', protocolTimeout: 90000 });
const page = await browser.newPage();
await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const issues = [];
page.on('pageerror', e => issues.push('JS ERROR: ' + e.message));

const pages = ['index','services','fleet','pricing','track','book','about','faqs','contact','app'];
for (const p of pages) {
  await page.goto(`https://zdevolve.github.io/omni-cargo-website/${p}.html`, { waitUntil: 'networkidle0', timeout: 45000 });
  await new Promise(r => setTimeout(r, 700));
  const m = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    burger: !!document.querySelector('.burger') && getComputedStyle(document.querySelector('.burger')).display !== 'none',
  }));
  console.log(`${p.padEnd(9)} overflowX:${m.overflow}px  burger:${m.burger ? 'visible' : (p==='app'?'n/a':'MISSING')}`);
  if (m.overflow > 1) issues.push(`${p}: horizontal overflow ${m.overflow}px`);
}

// Burger menu interaction on index
await page.goto('https://zdevolve.github.io/omni-cargo-website/index.html', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 2200));
await page.evaluate(() => document.querySelector('.burger').click());
await new Promise(r => setTimeout(r, 400));
const menuOpen = await page.evaluate(() => document.getElementById('mobileMenu').classList.contains('open'));
console.log('burger opens menu:', menuOpen ? 'OK' : 'FAIL');
await page.evaluate(() => { const a=[...document.querySelectorAll('#mobileMenu a')].find(x=>x.textContent==='Fleet'); a.click(); });
await new Promise(r => setTimeout(r, 1500));
console.log('menu link navigates:', page.url().includes('fleet') ? 'OK' : 'FAIL (' + page.url() + ')');

// FAQ accordion tap
await page.goto('https://zdevolve.github.io/omni-cargo-website/faqs.html', { waitUntil: 'networkidle0' });
await page.evaluate(() => document.querySelector('.faq-item summary').click());
const faqOpen = await page.evaluate(() => document.querySelector('.faq-item').open);
console.log('faq accordion:', faqOpen ? 'OK' : 'FAIL');

// Track demo chip on mobile
await page.goto('https://zdevolve.github.io/omni-cargo-website/track.html', { waitUntil: 'networkidle0' });
await page.evaluate(() => document.querySelector('.chip-btn').click());
await new Promise(r => setTimeout(r, 900));
const resShown = await page.evaluate(() => document.getElementById('result').style.display === 'block');
console.log('track chip → result:', resShown ? 'OK' : 'FAIL');

// Book stepper on mobile
await page.goto('https://zdevolve.github.io/omni-cargo-website/book.html', { waitUntil: 'networkidle0' });
await page.type('#pickup', 'Shimanzi, Mombasa');
await page.type('#dropoff', 'Westlands, Nairobi');
await page.evaluate(() => document.querySelector('[data-next="2"]').click());
const step2 = await page.evaluate(() => document.querySelector('[data-step="2"]').classList.contains('on'));
console.log('book step 1→2 mobile:', step2 ? 'OK' : 'FAIL');

// Tap target audit (nav CTA + wa-float + chips ≥ 40px)
await page.goto('https://zdevolve.github.io/omni-cargo-website/track.html', { waitUntil: 'networkidle0' });
const taps = await page.evaluate(() => {
  const out = [];
  for (const [name, sel] of [['wa-float','.wa-float'],['nav Book','.nav-cta .btn-primary'],['demo chip','.chip-btn'],['track btn','#trackForm .btn-primary']]) {
    const el = document.querySelector(sel); if (!el) { out.push(name+': MISSING'); continue; }
    const r = el.getBoundingClientRect();
    out.push(`${name}: ${Math.round(r.width)}x${Math.round(r.height)}${r.height < 38 ? ' TOO SMALL' : ''}`);
  }
  return out;
});
taps.forEach(t => console.log('tap:', t));

console.log('ISSUES:', issues.length ? issues.join(' | ') : 'NONE');
await browser.close();
