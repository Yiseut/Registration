import { chromium } from 'playwright';

const baseUrl = new URL(process.argv[2] || 'http://127.0.0.1:8780/');
const failures = [];

function urlFor(path) {
  return new URL(path, baseUrl).href;
}

function assert(condition, message, detail = '') {
  if (!condition) failures.push(detail ? `${message}: ${detail}` : message);
}

async function openCheckedPage(context, path, viewport = { width: 1360, height: 980 }) {
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message || String(error)));
  await page.setViewportSize(viewport);
  const response = await page.goto(urlFor(path), { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(800);
  assert(response?.ok(), `Page did not load successfully (${path})`, String(response?.status()));
  assert(!consoleErrors.length, `Console errors on ${path}`, consoleErrors.join(' | '));
  assert(!pageErrors.length, `Page errors on ${path}`, pageErrors.join(' | '));
  return page;
}

async function main() {
  const overview = await fetch(urlFor('assets/data/overview.json')).then((res) => res.json());
  const manifest = await fetch(urlFor('assets/data/manifest.json')).then((res) => res.json());
  const expectedRecords = Number(overview?.kpi?.main_records || 0);

  const launchOptions = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {};
  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({ deviceScaleFactor: 1 });

  const overviewPage = await openCheckedPage(context, 'index.html');
  const overviewState = await overviewPage.evaluate(() => ({
    h1: document.querySelector('h1')?.textContent?.trim() || '',
    recordRows: document.querySelectorAll('#table-records tbody tr').length,
    recordCount: document.querySelector('#record-count')?.textContent?.trim() || '',
    concentrationRows: document.querySelectorAll('#table-concentration tbody tr').length,
    canvasCount: document.querySelectorAll('canvas').length,
    hasLegacyDataScript: Array.from(document.scripts).some((script) => script.src.includes('codex-data.js')),
    methodologyText: document.querySelector('.methodology-strip')?.textContent || '',
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  assert(overviewState.h1.includes('市场格局'), 'Overview heading is missing');
  assert(overviewState.recordRows === expectedRecords, 'Overview record rows do not match main_records', `${overviewState.recordRows} !== ${expectedRecords}`);
  assert(overviewState.recordCount === String(expectedRecords), 'Overview record count label is wrong', overviewState.recordCount);
  assert(overviewState.concentrationRows === 7, 'Concentration table should render seven rows', String(overviewState.concentrationRows));
  assert(overviewState.canvasCount >= 4, 'Overview charts did not render');
  assert(!overviewState.hasLegacyDataScript, 'Legacy codex-data.js should not be loaded on overview');
  assert(overviewState.methodologyText.includes('不代表销量'), 'Methodology strip is missing non-sales-share disclaimer');
  assert(overviewState.overflowX <= 1, 'Overview has horizontal overflow', String(overviewState.overflowX));

  await overviewPage.selectOption('#filter-origin', 'hkmt');
  await overviewPage.waitForTimeout(250);
  assert(new URL(overviewPage.url()).searchParams.get('origin') === 'hkmt', 'Origin filter did not update the URL');
  await overviewPage.close();

  const filteredPage = await openCheckedPage(context, 'index.html?segment=botulinum&origin=imported&q=Dysport&grain=year&map=registrations');
  const filteredState = await filteredPage.evaluate(() => ({
    rows: document.querySelectorAll('#table-records tbody tr').length,
    cert: document.querySelector('#table-records tbody tr td')?.textContent?.trim() || '',
    query: document.querySelector('#filter-query')?.value || '',
    segment: document.querySelector('#filter-segment')?.value || '',
    origin: document.querySelector('#filter-origin')?.value || '',
    activeGrain: document.querySelector('[data-trend-grain].active')?.dataset.trendGrain || '',
    activeMap: document.querySelector('[data-map-metric].active')?.dataset.mapMetric || '',
  }));
  assert(filteredState.rows === 1, 'Shared filter URL should show one Dysport row', String(filteredState.rows));
  assert(filteredState.cert === 'S20200016', 'Dysport certificate should use the corrected approval number', filteredState.cert);
  assert(filteredState.query === 'Dysport', 'Query parameter was not restored into the search input', filteredState.query);
  assert(filteredState.segment === 'botulinum', 'Segment parameter was not restored', filteredState.segment);
  assert(filteredState.origin === 'imported', 'Origin parameter was not restored', filteredState.origin);
  assert(filteredState.activeGrain === 'year', 'Trend grain parameter was not restored', filteredState.activeGrain);
  assert(filteredState.activeMap === 'registrations', 'Map metric parameter was not restored', filteredState.activeMap);
  await filteredPage.locator('#table-records tbody tr').first().click();
  await filteredPage.waitForTimeout(250);
  assert(await filteredPage.locator('.drawer.open').count() === 1, 'Record drawer did not open from filtered table');
  await filteredPage.close();

  const mobilePage = await openCheckedPage(context, 'index.html', { width: 390, height: 900 });
  const mobileState = await mobilePage.evaluate(() => ({
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    collapseButtons: document.querySelectorAll('.mobile-collapse-toggle').length,
    collapsedPanels: document.querySelectorAll('[data-mobile-collapse].is-mobile-collapsed').length,
    toolbarPosition: getComputedStyle(document.querySelector('.records-toolbar')).position,
  }));
  assert(mobileState.overflowX <= 1, 'Mobile overview has horizontal overflow', String(mobileState.overflowX));
  assert(mobileState.collapseButtons >= 2, 'Mobile collapse controls were not added');
  assert(mobileState.collapsedPanels >= 2, 'Long matrix panels should start collapsed on mobile');
  assert(mobileState.toolbarPosition === 'sticky', 'Mobile record filters should be sticky', mobileState.toolbarPosition);
  await mobilePage.close();

  for (const track of manifest.tracks || []) {
    const page = await openCheckedPage(context, `tracks/${track.key}.html`);
    const trackState = await page.evaluate(() => ({
      h1: document.querySelector('h1')?.textContent?.trim() || '',
      canvasCount: document.querySelectorAll('canvas').length,
      tableRows: document.querySelectorAll('table tbody tr').length,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    assert(trackState.h1.length > 0, `Track heading missing for ${track.key}`);
    assert(trackState.canvasCount > 0, `Track charts did not render for ${track.key}`);
    assert(trackState.tableRows > 0, `Track tables did not render for ${track.key}`);
    assert(trackState.overflowX <= 1, `Track page has horizontal overflow for ${track.key}`, String(trackState.overflowX));
    await page.close();
  }

  await browser.close();

  if (failures.length) {
    console.error(`Dashboard smoke test failed with ${failures.length} issue(s):`);
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exit(1);
  }
  console.log(`Dashboard smoke test passed for ${baseUrl.href}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
