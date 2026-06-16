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
  const haData = await fetch(urlFor('assets/data/tracks/ha.json')).then((res) => res.json());
  const expectedRecords = Number(overview?.kpi?.main_records || 0);
  const volbella = (haData.records || []).find((record) => record.certificate_no === '国械注进20213130109');
  const lipScopeSkinQualityAnomalies = (haData.records || []).filter((record) => {
    const scope = [record.official_scope, record.scope_full, record.indication_description].filter(Boolean).join(' ');
    return /唇红体|唇红缘|唇粘膜|唇黏膜|唇部不对称|唇部组织容积|容积缺损/.test(scope)
      && record.primary_indication === '肤质改善';
  });
  assert(volbella?.primary_indication === '唇部', 'VOLBELLA with Lidocaine should be classified as lip indication', volbella?.primary_indication || 'missing');
  assert(volbella?.approved_indications === '唇部', 'VOLBELLA approved indications should not include skin quality', volbella?.approved_indications || 'missing');
  assert(!lipScopeSkinQualityAnomalies.length, 'Lip-scope HA records should not be classified as skin quality', lipScopeSkinQualityAnomalies.map((record) => record.certificate_no).join(', '));

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

  const haPositionUrl = `tracks/ha.html?shape=${encodeURIComponent('交联填充类')}&position=${encodeURIComponent('韩国进口')}&lidocaine=yes`;
  const haPositionPage = await openCheckedPage(context, haPositionUrl);
  const haPositionState = await haPositionPage.evaluate(() => ({
    positionCards: Array.from(document.querySelectorAll('.ha-position-card b')).map((node) => Number((node.textContent || '').replace(/\D/g, ''))),
    note: document.querySelector('#ha-position-note')?.textContent || '',
    regionCharts: document.querySelectorAll('#chart-ha-region-mix canvas, #chart-ha-lidocaine-breakdown canvas').length,
    rows: document.querySelectorAll('#table-records tbody tr').length,
    count: document.querySelector('#records-count')?.textContent?.trim() || '',
    shape: document.querySelector('#filter-ha-shape')?.value || '',
    position: document.querySelector('#filter-ha-position')?.value || '',
    lidocaine: document.querySelector('#filter-lidocaine')?.value || '',
    koreanTags: Array.from(document.querySelectorAll('#table-records tbody .ha-position-tag')).map((node) => node.textContent?.trim() || ''),
    lidocaineTags: Array.from(document.querySelectorAll('#table-records tbody .lidocaine-tag')).map((node) => node.textContent?.trim() || ''),
    urlPosition: new URL(location.href).searchParams.get('position') || '',
  }));
  assert(haPositionState.positionCards[0] === 91, 'HA crosslinked filler card should use the 91-record scope', String(haPositionState.positionCards[0]));
  assert(haPositionState.positionCards[2] === 24, 'HA lidocaine card should show 24 records under the unified official-title scope', String(haPositionState.positionCards[2]));
  assert(haPositionState.positionCards[3] === 67, 'HA non-lidocaine card should show the remaining 67 records', String(haPositionState.positionCards[3]));
  assert(haPositionState.note.includes('不代表销量'), 'HA positioning note should include non-sales-share wording');
  assert(haPositionState.note.includes('英文“Lidocaine”均计入'), 'HA positioning note should explain the unified Lidocaine scope');
  assert(haPositionState.regionCharts >= 2, 'HA positioning charts did not render');
  assert(haPositionState.rows === 8, 'HA Korean lidocaine filter should show eight rows after LG/LYV verification', String(haPositionState.rows));
  assert(haPositionState.count === '8', 'HA filtered record count label is wrong', haPositionState.count);
  assert(haPositionState.shape === '交联填充类', 'HA shape filter was not restored', haPositionState.shape);
  assert(haPositionState.position === '韩国进口', 'HA position filter was not restored', haPositionState.position);
  assert(haPositionState.lidocaine === 'yes', 'HA lidocaine filter was not restored', haPositionState.lidocaine);
  assert(haPositionState.urlPosition === '韩国进口', 'HA filter state should remain shareable in the URL', haPositionState.urlPosition);
  assert(haPositionState.koreanTags.length === 8 && haPositionState.koreanTags.every((tag) => tag === '韩国进口'), 'HA filtered rows should all be tagged 韩国进口', haPositionState.koreanTags.join(', '));
  assert(haPositionState.lidocaineTags.length === 8 && haPositionState.lidocaineTags.every((tag) => tag === '含利多卡因'), 'HA filtered rows should all carry unified lidocaine tags', haPositionState.lidocaineTags.join(', '));
  await haPositionPage.close();

  const pivotPage = await openCheckedPage(context, 'pivot.html');
  const pivotState = await pivotPage.evaluate(() => ({
    h1: document.querySelector('h1')?.textContent?.trim() || '',
    records: document.querySelector('#pivot-kpi-records')?.textContent?.trim() || '',
    rowChips: Array.from(document.querySelectorAll('#pivot-rows .pivot-assigned-chip')).map((node) => node.textContent?.replace('×', '').trim() || ''),
    columnChips: Array.from(document.querySelectorAll('#pivot-columns .pivot-assigned-chip')).map((node) => node.textContent?.replace('×', '').trim() || ''),
    filters: Array.from(document.querySelectorAll('#pivot-filters select')).map((node) => node.value),
    chartCanvases: document.querySelectorAll('#pivot-chart canvas').length,
    cellTitles: Array.from(document.querySelectorAll('.pivot-cell-button')).map((node) => node.title),
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  assert(pivotState.h1 === '自定义透视', 'Pivot heading is missing', pivotState.h1);
  assert(pivotState.records === '91', 'Pivot default scope should show 91 HA crosslinked records', pivotState.records);
  assert(pivotState.rowChips.includes('利多卡因状态'), 'Pivot default row dimension should be lidocaine status', pivotState.rowChips.join(', '));
  assert(pivotState.columnChips.includes('定位层级'), 'Pivot default column dimension should be positioning tier', pivotState.columnChips.join(', '));
  assert(pivotState.filters.includes('透明质酸钠') && pivotState.filters.includes('交联填充类'), 'Pivot default filters should target HA crosslinked fillers', pivotState.filters.join(', '));
  assert(pivotState.chartCanvases >= 1, 'Pivot chart did not render');
  assert(pivotState.cellTitles.some((title) => title.includes('含利多卡因 × 韩国进口：8')), 'Pivot should show eight Korean lidocaine records after LG/LYV verification', pivotState.cellTitles.join(' | '));
  assert(pivotState.overflowX <= 1, 'Pivot page has horizontal overflow', String(pivotState.overflowX));

  const lipPivotParams = new URLSearchParams({
    rows: 'country_region',
    cols: 'primary_indication',
    f_track_name: '透明质酸钠',
    f_product_shape: '交联填充类',
    f_lidocaine_signal: '含利多卡因',
  });
  const lipPivotPage = await openCheckedPage(context, `pivot.html?${lipPivotParams.toString()}`);
  const lipPivotState = await lipPivotPage.evaluate(() => ({
    records: document.querySelector('#pivot-kpi-records')?.textContent?.trim() || '',
    cellTitles: Array.from(document.querySelectorAll('.pivot-cell-button')).map((node) => node.title),
  }));
  assert(lipPivotState.records === '24', 'Lip indication pivot should stay within HA lidocaine crosslinked records', lipPivotState.records);
  assert(lipPivotState.cellTitles.some((title) => title.includes('美国 × 唇部：1')), 'VOLBELLA should appear under US x lip indication', lipPivotState.cellTitles.join(' | '));
  assert(!lipPivotState.cellTitles.some((title) => title.includes('美国 × 肤质改善')), 'US x skin quality should not contain VOLBELLA', lipPivotState.cellTitles.join(' | '));
  await lipPivotPage.close();

  await pivotPage.locator('[data-field-id="country_region"]').dragTo(pivotPage.locator('[data-zone="columns"] .pivot-zone-drop'));
  await pivotPage.waitForTimeout(500);
  const pivotDragState = await pivotPage.evaluate(() => ({
    columnChips: Array.from(document.querySelectorAll('#pivot-columns .pivot-assigned-chip')).map((node) => node.textContent?.replace('×', '').trim() || ''),
    urlCols: new URL(location.href).searchParams.get('cols') || '',
  }));
  assert(pivotDragState.columnChips.includes('国家/地区'), 'Dragging country/region into columns should add the dimension', pivotDragState.columnChips.join(', '));
  assert(pivotDragState.urlCols.includes('country_region'), 'Pivot drag state should be shareable in the URL', pivotDragState.urlCols);
  await pivotPage.close();

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
