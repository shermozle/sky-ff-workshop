const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../public');
const output = path.resolve(__dirname, '../artifacts');
fs.mkdirSync(output, { recursive: true });
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/workshop\//, '/');
  const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.txt': 'text/plain' })[path.extname(file)] || 'text/plain');
    res.end(data);
  });
});
const check = (condition, message) => assert.ok(condition, message);
async function main() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/workshop/`;
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1512, height: 982 }, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage(); const errors = []; let practiceRequests = 0;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('https://**/*', route => { practiceRequests++; return route.abort(); });
    await context.route('**/config.js', route => route.fulfill({ contentType: 'text/javascript', body: "window.SKY_WORKSHOP_CONFIG = {projectId:'896821',orgId:'74301',projectName:'Feature Flag workshop',region:'us',analyticsApiKey:'YOUR_ANALYTICS_API_KEY',deploymentKey:'YOUR_CLIENT_DEPLOYMENT_KEY',deploymentName:'sky-workshop-web'};" }));
    await page.goto(base + 'app.html');
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Practice decision applied'));
    assert.equal(await page.locator('#rail-title').innerText(), 'Picked for Aroha');
    await page.selectOption('#target', 'Sky Sport'); await page.click('#evaluate');
    assert.equal(await page.locator('#rail-title').innerText(), 'Picked for Aroha');
    await page.selectOption('#profile', 'sky-workshop-ben'); await page.click('#evaluate');
    assert.equal(await page.locator('#rail-title').innerText(), 'Popular this week');
    await page.selectOption('#profile', 'sky-workshop-dev'); await page.click('#evaluate');
    assert.equal(await page.locator('#rail-title').innerText(), 'Picked for Dev');
    await page.click('#rollback');
    assert.equal(await page.locator('#rail-title').innerText(), 'Popular this week');
    await page.check('#enabled'); await page.fill('#flag', 'alex-recommendations'); await page.fill('#promo', 'alex-promo');
    await page.selectOption('#input-mode', 'historical'); await page.click('#evaluate');
    check(!JSON.parse(await page.locator('#request').textContent()).user_properties, 'Identity-only practice request');
    await page.click('#copy');
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    check(copied.includes('profile=sky-workshop-dev') && copied.includes('promo=alex-promo'), 'Scenario URL contains identity and both keys');
    check(!copied.includes('deployment') && !copied.includes('api-key'), 'No credentials in scenario URL');
    const privateContext = await browser.newContext(); const privatePage = await privateContext.newPage();
    await privatePage.goto(copied);
    assert.equal(await privatePage.locator('#profile').inputValue(), 'sky-workshop-dev');
    assert.equal(await privatePage.locator('#promo').inputValue(), 'alex-promo');
    assert.equal(await privatePage.locator('#target').inputValue(), 'Sky Sport');
    await privateContext.close();
    const beforeCached = practiceRequests; await page.click('#cached');
    check((await page.locator('#log').innerText()).includes('not a local rule evaluation'), 'Cache read explanation');
    assert.equal(practiceRequests, beforeCached); assert.equal(practiceRequests, 0, 'Practice makes zero external requests');
    await page.screenshot({ path: path.join(output, 'app-desktop.png'), fullPage: true });
    await page.selectOption('#mode', 'live'); await page.click('#evaluate');
    check((await page.locator('#status').innerText()).includes('No request was sent'), 'Placeholders block live requests');
    await page.unroute('https://**/*');
    const requests = [], analytics = []; let failure = false, malformed = false, missing = false, slow = false;
    await page.route('https://api.lab.amplitude.com/**', async route => {
      const headers = await route.request().allHeaders();
      const user = JSON.parse(Buffer.from(headers['x-amp-exp-user'], 'base64url').toString());
      const keys = JSON.parse(Buffer.from(headers['x-amp-exp-flag-keys'], 'base64url').toString());
      requests.push({ user, keys, headers });
      if (slow) await new Promise(resolve => setTimeout(resolve, 300));
      if (failure) return route.fulfill({ status: 503, body: '{}' });
      if (malformed) return route.fulfill({ status: 200, body: 'not JSON' });
      const variants = Object.fromEntries(keys.map(key => [key, { key: user.user_id === 'sky-workshop-casey' ? 'off' : 'on', value: user.user_id === 'sky-workshop-casey' ? 'off' : 'on', payload: { fixture: true } }]));
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(missing ? {} : variants) });
    });
    await page.route('https://api2.amplitude.com/**', async route => { analytics.push(route.request().postDataJSON()); return route.fulfill({ status: 200, contentType: 'application/json', body: '{"code":200,"events_ingested":1}' }); });
    await page.fill('#deployment', 'test-public-client-key'); await page.fill('#api-key', 'test-analytics-key'); await page.check('#track'); await page.click('#save-connection');
    await page.selectOption('#profile', 'sky-workshop-aroha'); await page.selectOption('#input-mode', 'explicit');
    await page.click('#evaluate'); await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Live decision applied'));
    assert.equal(await page.locator('#rail-title').innerText(), 'Picked for Aroha');
    assert.equal(requests.at(-1).user.user_properties.subscription_packages[1], 'Sky Sport');
    assert.equal(requests.at(-1).headers.authorization, 'Api-Key test-public-client-key');
    await page.selectOption('#input-mode', 'historical'); await page.click('#evaluate');
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Live decision applied'));
    assert.deepEqual(requests.at(-1).user.user_properties || {}, {}, 'Real SDK sends no targeting properties in historical mode');
    const prior = requests.length; await page.click('#cached'); assert.equal(requests.length, prior, 'Real SDK cached read makes no network request');
    await page.selectOption('#profile', 'sky-workshop-casey');
    assert.equal(await page.locator('#rail-title').innerText(), 'Popular this week', 'Identity switch immediately clears old result');
    await page.click('#evaluate'); await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Live decision applied'));
    assert.equal(await page.locator('#rail-title').innerText(), 'Popular this week');
    assert.equal(requests.at(-1).user.user_id, 'sky-workshop-casey');
    await page.selectOption('#profile', 'sky-workshop-ben'); slow = true; await page.click('#evaluate');
    await page.waitForFunction(() => document.querySelector('#evaluate').disabled);
    check(await page.locator('#profile').isDisabled(), 'Inputs cannot race a pending fetch');
    await page.waitForFunction(() => !document.querySelector('#evaluate').disabled); slow = false;
    assert.equal(await page.locator('#rail-title').innerText(), 'Picked for Ben');
    await page.click('#watch'); await page.waitForFunction(() => document.querySelector('#log').textContent.includes('Analytics accepted: Demo Content Previewed'));
    check(analytics.some(p => p.events[0].event_type === '$exposure'), 'Exposure events use documented $exposure shape');
    check(analytics.some(p => p.events[0].user_id === 'sky-workshop-ben' && p.events[0].event_type === 'Demo Content Previewed'), 'Analytics identity matches evaluated viewer');
    failure = true; await page.click('#evaluate'); await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Could not evaluate'));
    assert.equal(await page.locator('#rail-title').innerText(), 'Popular this week');
    assert.equal(await page.locator('#result-badge').innerText(), 'Fetch failed');
    check(await page.locator('#cached').isDisabled(), 'Failed fetch does not leave a cached decision');
    failure = false; malformed = true; await page.click('#evaluate'); await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Could not evaluate'));
    malformed = false; missing = true; await page.click('#evaluate'); await page.waitForFunction(() => document.querySelector('#status').textContent.includes('no returned entry'));
    assert.equal(await page.locator('#rail-title').innerText(), 'Popular this week');
    missing = false;
    await page.fill('#deployment', 'other-public-client-key'); await page.click('#save-connection'); await page.click('#evaluate');
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Live decision applied'));
    assert.equal(requests.at(-1).headers.authorization, 'Api-Key other-public-client-key', 'Changing deployment uses the new client key');
    await page.click('#copy'); const liveURL = await page.evaluate(() => navigator.clipboard.readText());
    check(!liveURL.includes('test-') && !liveURL.includes('other-public'), 'Live URLs omit keys');
    // Confirm layouts at repository subpaths and validate every local link/asset.
    const filenames = fs.readdirSync(root).filter(file => file.endsWith('.html'));
    for (const file of filenames) {
      await page.goto(base + file);
      const links = await page.locator('a[href],link[href],script[src]').evaluateAll(els => els.map(el => el.href || el.src).filter(Boolean));
      for (const link of links) if (link.startsWith(base)) { const res = await context.request.get(link.split('#')[0]); assert.equal(res.status(), 200, `${file} broken local link: ${link}`); }
      if (file === 'slides.html') {
        const problems = await page.evaluate(() => {
          const failures = [];
          for (const [i, slide] of [...document.querySelectorAll('.slide')].entries()) {
            slide.classList.add('on'); const body = slide.querySelector('.body');
            if (body.scrollHeight > body.clientHeight + 1) failures.push(`${i+1} ${slide.dataset.title}: vertical ${body.scrollHeight}/${body.clientHeight}`);
            for (const el of slide.querySelectorAll('pre,table,.grid,.flow,.steps,.urlbox')) if (el.scrollWidth > el.clientWidth + 2) failures.push(`${i+1} ${el.className}: horizontal overflow`);
            slide.classList.remove('on');
          }
          return failures;
        });
        assert.deepEqual(problems, [], 'Deck layout');
        assert.equal(await page.locator('.slide').count(), 20);
        assert.equal(await page.locator('#jump button').count(), 20);
        await page.keyboard.press('ArrowRight'); assert.equal(await page.locator('.slide.on').getAttribute('data-title'), 'Watch a rollout change the rail');
        await page.goto(base + 'slides.html#5');
        assert.equal(await page.locator('.slide.on').getAttribute('data-title'), 'Local and remote evaluation');
        await page.screenshot({ path: path.join(output, 'slides-architecture.png') });
        await page.keyboard.press('o'); check(await page.locator('#jump').isVisible(), 'Jump menu'); await page.keyboard.press('Escape');
        await page.emulateMedia({ media: 'print' });
        assert.equal(await page.locator('.slide:visible').count(), 20, 'Print shows all slides'); await page.emulateMedia({ media: 'screen' });
      } else {
        await page.setViewportSize({ width: 390, height: 844 });
        check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${file} has mobile horizontal overflow`);
        if (file === 'app.html') await page.screenshot({ path: path.join(output, 'app-mobile.png'), fullPage: true });
        await page.setViewportSize({ width: 1512, height: 982 });
      }
    }
    assert.deepEqual(errors, [], 'No browser runtime errors');
    await context.close();
    console.log('PASS · practice targeting/rollback, URL round-trip/private context, live real-SDK contracts, explicit/historical inputs, identity clearing, deployment switching, cache reads, HTTP/malformed/missing errors, exposure/preview events, all local links, 20-slide layout/navigation/print, mobile layouts.');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
