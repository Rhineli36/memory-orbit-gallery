const { chromium } = require('playwright');
const { pathToFileURL } = require('url');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('pageerror', error => errors.push(String(error)));
  const galleryUrl = pathToFileURL(path.resolve(__dirname, '..', 'docs', 'index.html')).href;
  await page.goto(galleryUrl, { waitUntil: 'networkidle' });

  if (await page.locator('.orbit-photo').count() !== 41) throw new Error('Photo count is not 41');
  await page.locator('[data-mode="classic"]').click();
  if (await page.locator('#app').getAttribute('data-mode') !== 'classic') throw new Error('Classic mode failed');
  await page.locator('[data-mode="cluster"]').click();
  if (await page.locator('#app').getAttribute('data-mode') !== 'cluster') throw new Error('Cluster mode failed');
  if (await page.locator('.mode.is-active').getAttribute('data-mode') !== 'cluster') throw new Error('Active mode styling failed');
  await page.waitForTimeout(250);
  if (process.env.SCREENSHOT_PATH) await page.screenshot({ path: process.env.SCREENSHOT_PATH });

  await page.locator('.orbit-photo').evaluateAll(elements => {
    const visible = elements.find(element => Number(getComputedStyle(element).opacity) > .2);
    if (!visible) throw new Error('No front-facing photo found');
    visible.click();
  });
  await page.locator('#viewer.is-open').waitFor();
  const size = await page.locator('#viewerImage').evaluate(el => ({
    naturalWidth: el.naturalWidth,
    naturalHeight: el.naturalHeight,
    width: el.getBoundingClientRect().width,
    height: el.getBoundingClientRect().height,
  }));
  if (!size.naturalWidth || !size.naturalHeight || size.width > 1440 || size.height > 900) throw new Error('Contain viewer failed');
  await page.locator('#detailToggle').click();
  if (!(await page.locator('#viewer').getAttribute('class')).includes('details-hidden')) throw new Error('Details toggle failed');
  await page.locator('#closeViewer').click();
  if (await page.locator('#viewer').getAttribute('aria-hidden') !== 'true') throw new Error('Close failed');

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await mobile.goto(galleryUrl, { waitUntil: 'networkidle' });
  if (await mobile.locator('.orbit-photo').count() !== 41) throw new Error('Mobile photo count failed');
  if (!(await mobile.locator('#rotateToggle').isVisible())) throw new Error('Mobile controls hidden');
  await mobile.close();
  if (errors.length) throw new Error(errors.join('\n'));
  console.log('PASS: 41 photos, modes, viewer, details toggle, close, desktop and mobile');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
