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

async function clickTimelineYear(page, year) {
  const clicked = await page.evaluate((targetYear) => {
    const el = document.getElementById('chart-timeline');
    const inst = window.echarts?.getInstanceByDom(el);
    if (!el || !inst) return false;
    const option = inst.getOption();
    const years = option.xAxis?.[0]?.data || [];
    const index = years.findIndex((value) => Number(value) === Number(targetYear));
    const handlers = inst._$handlers?.click || [];
    if (index < 0 || !handlers.length) return false;
    handlers.forEach((handler) => handler.h.call(handler.ctx, { dataIndex: index, seriesName: '主格局新增' }));
    return true;
  }, year);
  assert(clicked, `Could not trigger ${year} timeline drilldown`);
  await page.waitForTimeout(300);
}

async function main() {
  const overview = await fetch(urlFor('assets/data/overview.json')).then((res) => res.json());
  const manifest = await fetch(urlFor('assets/data/manifest.json')).then((res) => res.json());
  const haData = await fetch(urlFor('assets/data/tracks/ha.json')).then((res) => res.json());
  const expectedRecords = Number(overview?.kpi?.main_records || 0);
  const volbella = (haData.records || []).find((record) => record.certificate_no === '国械注进20213130109');
  const qMedLidocaineRecords = ['国械注进20213130059', '国械注进20253130284'].map((cert) => (
    (haData.records || []).find((record) => record.certificate_no === cert)
  ));
  const officialComponentLidocaineRecords = [
    '国械注进20213130059',
    '国械注进20253130284',
    '国械注准20243131967',
    '国械注准20203130295',
    '国械注准20233131478',
    '国械注准20193130257',
    '国械注准20203130569',
    '国械注准20203130096',
    '国械注进20193130565',
    '国械注准20203130568',
    '国械注准20163130861',
  ].map((cert) => (
    (haData.records || []).find((record) => record.certificate_no === cert)
  ));
  const lipScopeSkinQualityAnomalies = (haData.records || []).filter((record) => {
    const scope = [record.official_scope, record.scope_full, record.indication_description].filter(Boolean).join(' ');
    return /唇红体|唇红缘|唇粘膜|唇黏膜|唇部不对称|唇部组织容积|容积缺损/.test(scope)
      && record.primary_indication === '肤质改善';
  });
  assert(volbella?.primary_indication === '唇部', 'VOLBELLA with Lidocaine should be classified as lip indication', volbella?.primary_indication || 'missing');
  assert(volbella?.approved_indications === '唇部', 'VOLBELLA approved indications should not include skin quality', volbella?.approved_indications || 'missing');
  for (const record of qMedLidocaineRecords) {
    assert(Boolean(record?.specification), 'Q-Med/Galderma records should keep official specification text', record?.certificate_no || 'missing');
  }
  for (const record of officialComponentLidocaineRecords) {
    assert(record?.lidocaine_status === '含利多卡因', 'Official component lidocaine records should be classified as lidocaine', record?.certificate_no || 'missing');
    assert(/利多卡因|lidocaine/i.test(record?.components || ''), 'Official component lidocaine records should keep component lidocaine text', record?.certificate_no || 'missing');
  }
  assert(!lipScopeSkinQualityAnomalies.length, 'Lip-scope HA records should not be classified as skin quality', lipScopeSkinQualityAnomalies.map((record) => record.certificate_no).join(', '));

  const launchOptions = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
    : {};
  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({ deviceScaleFactor: 1 });

  const overviewPage = await openCheckedPage(context, 'index.html');
  const overviewState = await overviewPage.evaluate(() => ({
    h1: document.querySelector('h1')?.textContent?.trim() || '',
    heroText: document.querySelector('.hero')?.textContent || '',
    hasHeroMeta: document.querySelector('.hero .meta') !== null,
    recordRows: document.querySelectorAll('#table-records tbody tr').length,
    recordCount: document.querySelector('#record-count')?.textContent?.trim() || '',
    concentrationRows: document.querySelectorAll('#table-concentration tbody tr').length,
    canvasCount: document.querySelectorAll('canvas').length,
    hasLegacyDataScript: Array.from(document.scripts).some((script) => script.src.includes('codex-data.js')),
    hasMethodologyStrip: document.querySelector('.methodology-strip') !== null,
    updateText: document.querySelector('.overview-update-time')?.textContent || '',
    chinaMapMetricLabels: Array.from(document.querySelectorAll('.china-map-metrics span')).map((node) => node.textContent?.trim() || ''),
    hasChinaMapRecordMetric: document.querySelector('#china-map-records') !== null,
    kpiLabels: Array.from(document.querySelectorAll('.kpi .label')).map((node) => node.textContent?.trim() || ''),
    mainKpiDelta: document.querySelector('#kpi-main')?.closest('.kpi')?.querySelector('.delta')?.textContent?.trim() || '',
    companyKpiDelta: document.querySelector('#kpi-companies')?.closest('.kpi')?.querySelector('.delta')?.textContent?.trim() || '',
    removedKpis: ['#kpi-verified', '#kpi-inj3', '#kpi-drug', '#kpi-indications']
      .filter((selector) => document.querySelector(selector))
      .join(','),
    originCardLabel: document.querySelector('#kpi-origin-total')?.closest('.kpi')?.querySelector('.label')?.textContent?.trim() || '',
    originTotal: document.querySelector('#kpi-origin-total')?.textContent?.trim() || '',
    originBreakdown: document.querySelector('#kpi-origin-breakdown')?.textContent?.trim() || '',
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  assert(overviewState.h1.includes('市场格局'), 'Overview heading is missing');
  assert(!overviewState.heroText.includes('覆盖注射填充'), 'Overview hero descriptive copy should stay removed');
  assert(!overviewState.hasHeroMeta, 'Overview hero meta row should stay removed');
  assert(overviewState.recordRows === expectedRecords, 'Overview record rows do not match main_records', `${overviewState.recordRows} !== ${expectedRecords}`);
  assert(overviewState.recordCount === String(expectedRecords), 'Overview record count label is wrong', overviewState.recordCount);
  assert(overviewState.concentrationRows === 7, 'Concentration table should render seven rows', String(overviewState.concentrationRows));
  assert(overviewState.canvasCount >= 4, 'Overview charts did not render');
  assert(!overviewState.hasLegacyDataScript, 'Legacy codex-data.js should not be loaded on overview');
  assert(!overviewState.hasMethodologyStrip, 'Overview methodology strip should stay removed');
  assert(overviewState.updateText.includes('更新时间'), 'Overview should keep a simple update time');
  assert(/\d{4}-\d{2}-\d{2}/.test(overviewState.updateText), 'Overview update time should render a concrete date', overviewState.updateText);
  assert(!/统计口径|解读边界|覆盖范围|核心记录|不代表销量/.test(overviewState.updateText), 'Overview update line should not show backend methodology copy', overviewState.updateText);
  assert(!overviewState.hasChinaMapRecordMetric, 'China map header should not show a separate registration-count metric');
  assert(overviewState.chinaMapMetricLabels.join(',') === '城市,注册主体', 'China map header should only show city and registrant metrics', overviewState.chinaMapMetricLabels.join(','));
  assert(overviewState.kpiLabels.join(',') === '已收录注册证,注册企业 / 集团数,证照数,近 12 个月新增', 'Overview KPI cards should stay trimmed to the user-facing set', overviewState.kpiLabels.join(','));
  assert(!overviewState.mainKpiDelta, 'Main-record KPI subtitle should stay removed', overviewState.mainKpiDelta);
  assert(!overviewState.companyKpiDelta, 'Company KPI subtitle should stay removed', overviewState.companyKpiDelta);
  assert(!overviewState.removedKpis, 'Crossed-out KPI cards should stay removed', overviewState.removedKpis);
  assert(overviewState.originCardLabel === '证照数', 'Origin KPI should be labeled as certificate count', overviewState.originCardLabel);
  assert(overviewState.originTotal === String(expectedRecords), 'Origin KPI total should match main_records', overviewState.originTotal);
  assert(overviewState.originBreakdown === `国内 ${overview.kpi.domestic}张 · 进口 ${overview.kpi.imported}张 · 港澳台 ${overview.kpi.hkmt}张`, 'Origin KPI should show unitized domestic/import/HKMT counts', overviewState.originBreakdown);
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
  assert(haPositionState.positionCards[2] === 50, 'HA lidocaine card should show 50 records under the official registration scope', String(haPositionState.positionCards[2]));
  assert(haPositionState.positionCards[3] === 41, 'HA non-lidocaine card should show the remaining 41 records', String(haPositionState.positionCards[3]));
  assert(haPositionState.note.includes('不代表销量'), 'HA positioning note should include non-sales-share wording');
  assert(haPositionState.note.includes('型号规格和结构组成为准'), 'HA positioning note should explain the official registration component scope');
  assert(haPositionState.regionCharts >= 2, 'HA positioning charts did not render');
  assert(haPositionState.rows === 13, 'HA Korean lidocaine filter should show 13 rows after official component verification', String(haPositionState.rows));
  assert(haPositionState.count === '13', 'HA filtered record count label is wrong', haPositionState.count);
  assert(haPositionState.shape === '交联填充类', 'HA shape filter was not restored', haPositionState.shape);
  assert(haPositionState.position === '韩国进口', 'HA position filter was not restored', haPositionState.position);
  assert(haPositionState.lidocaine === 'yes', 'HA lidocaine filter was not restored', haPositionState.lidocaine);
  assert(haPositionState.urlPosition === '韩国进口', 'HA filter state should remain shareable in the URL', haPositionState.urlPosition);
  assert(haPositionState.koreanTags.length === 13 && haPositionState.koreanTags.every((tag) => tag === '韩国进口'), 'HA filtered rows should all be tagged 韩国进口', haPositionState.koreanTags.join(', '));
  assert(haPositionState.lidocaineTags.length === 13 && haPositionState.lidocaineTags.every((tag) => tag === '含利多卡因'), 'HA filtered rows should all carry unified lidocaine tags', haPositionState.lidocaineTags.join(', '));
  await haPositionPage.close();

  const haTimelinePage = await openCheckedPage(context, 'tracks/ha.html');
  await clickTimelineYear(haTimelinePage, 2026);
  const haTimelineDrawer = await haTimelinePage.evaluate(() => ({
    text: document.querySelector('.drawer.open')?.textContent || '',
    rows: document.querySelectorAll('.drawer.open .record-card').length,
    pendingData: window.echarts.getInstanceByDom(document.getElementById('chart-timeline'))?.getOption().series
      ?.find((series) => series.name === '待复核/底层')?.data || [],
  }));
  assert(haTimelineDrawer.pendingData.some((value) => Number(value) === 2), 'HA timeline should show two pending 2026 leads in the stacked annual bar', JSON.stringify(haTimelineDrawer.pendingData));
  assert(haTimelineDrawer.text.includes('主格局 6 张 + 待复核/底层 2 张'), 'HA 2026 drilldown should explain main vs pending counts', haTimelineDrawer.text);
  assert(haTimelineDrawer.text.includes('Humedix / 汇美迪斯'), 'HA 2026 drilldown should include the pending Humedix certificate registrant group', haTimelineDrawer.text);
  assert(haTimelineDrawer.text.includes('国械注进20263130223'), 'HA 2026 drilldown should include the pending Humedix certificate number', haTimelineDrawer.text);
  await haTimelinePage.close();

  const collagenTimelinePage = await openCheckedPage(context, 'tracks/collagen.html');
  await clickTimelineYear(collagenTimelinePage, 2026);
  const collagenTimelineDrawer = await collagenTimelinePage.evaluate(() => ({
    text: document.querySelector('.drawer.open')?.textContent || '',
    pendingData: window.echarts.getInstanceByDom(document.getElementById('chart-timeline'))?.getOption().series
      ?.find((series) => series.name === '待复核/底层')?.data || [],
  }));
  assert(collagenTimelineDrawer.pendingData.some((value) => Number(value) === 2), 'Collagen timeline should show two pending 2026 leads in the stacked annual bar', JSON.stringify(collagenTimelineDrawer.pendingData));
  assert(collagenTimelineDrawer.text.includes('主格局 3 张 + 待复核/底层 2 张'), 'Collagen 2026 drilldown should explain main vs pending counts', collagenTimelineDrawer.text);
  assert(collagenTimelineDrawer.text.includes('交联重组胶原蛋白植入剂') && collagenTimelineDrawer.text.includes('巨子生物'), 'Collagen 2026 drilldown should include the pending Giant Biogene certificate', collagenTimelineDrawer.text);
  assert(collagenTimelineDrawer.text.includes('国械注准20263131219'), 'Collagen 2026 drilldown should include the pending Giant Biogene certificate number', collagenTimelineDrawer.text);
  await collagenTimelinePage.close();

  const lepuDetailPage = await openCheckedPage(context, `tracks/ha.html?q=${encodeURIComponent('国械注准20253131324')}`);
  await lepuDetailPage.locator('#table-records tbody tr').first().click();
  await lepuDetailPage.waitForTimeout(250);
  const lepuDrawerState = await lepuDetailPage.evaluate(() => ({
    open: document.querySelector('.drawer.open') !== null,
    text: document.querySelector('.drawer.open')?.textContent || '',
    highlighted: Array.from(document.querySelectorAll('.drawer.open .evidence-mark')).map((node) => node.textContent || ''),
  }));
  assert(lepuDrawerState.open, 'Lepu HA record drawer should open from certificate search');
  assert(lepuDrawerState.text.includes('型号规格') && lepuDrawerState.text.includes('1.0ml'), 'Lepu HA drawer should show model/specification details', lepuDrawerState.text);
  assert(lepuDrawerState.text.includes('结构组成') && lepuDrawerState.text.includes('盐酸利多卡因'), 'Lepu HA drawer should show official component evidence for lidocaine', lepuDrawerState.text);
  assert(lepuDrawerState.text.includes('注册人') && lepuDrawerState.text.includes('四川兴泰普乐医疗科技有限公司'), 'Lepu HA drawer should show the official registrant', lepuDrawerState.text);
  assert(lepuDrawerState.highlighted.some((value) => value.includes('利多卡因')), 'Lepu HA drawer should highlight lidocaine evidence', lepuDrawerState.highlighted.join(', '));
  await lepuDetailPage.close();

  const pivotPage = await openCheckedPage(context, 'pivot.html');
  const pivotState = await pivotPage.evaluate(() => ({
    h1: document.querySelector('h1')?.textContent?.trim() || '',
    tableTitle: document.querySelector('#pivot-table-title')?.textContent?.trim() || '',
    records: document.querySelector('#pivot-kpi-records')?.textContent?.trim() || '',
    rowChips: Array.from(document.querySelectorAll('#pivot-rows .pivot-assigned-chip')).map((node) => node.textContent?.replace('×', '').trim() || ''),
    columnChips: Array.from(document.querySelectorAll('#pivot-columns .pivot-assigned-chip')).map((node) => node.textContent?.replace('×', '').trim() || ''),
    filters: Array.from(document.querySelectorAll('#pivot-filters select')).map((node) => node.value),
    chartCanvases: document.querySelectorAll('#pivot-chart canvas').length,
    resizers: document.querySelectorAll('.pivot-col-resizer').length,
    cellTitles: Array.from(document.querySelectorAll('.pivot-cell-button')).map((node) => node.title),
    methodologyBlocks: document.querySelectorAll('.pivot-methodology').length,
    bodyText: document.body.textContent || '',
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  assert(pivotState.h1 === '自定义透视', 'Pivot heading is missing', pivotState.h1);
  assert(pivotState.methodologyBlocks === 0, 'Pivot methodology explainer should not appear on the public page', String(pivotState.methodologyBlocks));
  assert(!pivotState.bodyText.includes('注册证名称或产品名含中文'), 'Pivot public page should not show the old lidocaine methodology copy');
  assert(pivotState.tableTitle === '透明质酸钠赛道交联填充剂市场分布图', 'Pivot table title should be generated from default filters', pivotState.tableTitle);
  assert(pivotState.records === '91', 'Pivot default scope should show 91 HA crosslinked records', pivotState.records);
  assert(pivotState.rowChips.includes('利多卡因状态'), 'Pivot default row dimension should be lidocaine status', pivotState.rowChips.join(', '));
  assert(pivotState.columnChips.includes('定位层级'), 'Pivot default column dimension should be positioning tier', pivotState.columnChips.join(', '));
  assert(pivotState.filters.includes('透明质酸钠') && pivotState.filters.includes('交联填充类'), 'Pivot default filters should target HA crosslinked fillers', pivotState.filters.join(', '));
  assert(pivotState.chartCanvases >= 1, 'Pivot chart did not render');
  assert(pivotState.resizers >= 3, 'Pivot table should expose column resize handles', String(pivotState.resizers));
  assert(pivotState.cellTitles.some((title) => title.includes('含利多卡因 × 韩国进口：13')), 'Pivot should show 13 Korean lidocaine records after official component verification', pivotState.cellTitles.join(' | '));
  assert(pivotState.overflowX <= 1, 'Pivot page has horizontal overflow', String(pivotState.overflowX));
  const firstColWidthBefore = await pivotPage.locator('#pivot-table col').first().evaluate((node) => parseFloat(node.style.width || getComputedStyle(node).width));
  const firstResizeHandleLocator = pivotPage.locator('.pivot-col-resizer').first();
  await firstResizeHandleLocator.scrollIntoViewIfNeeded();
  const firstResizeHandle = await firstResizeHandleLocator.boundingBox();
  assert(Boolean(firstResizeHandle), 'Pivot first column resize handle should be measurable');
  if (firstResizeHandle) {
    await pivotPage.mouse.move(firstResizeHandle.x + firstResizeHandle.width / 2, firstResizeHandle.y + firstResizeHandle.height / 2);
    await pivotPage.mouse.down();
    await pivotPage.mouse.move(firstResizeHandle.x + firstResizeHandle.width / 2 + 54, firstResizeHandle.y + firstResizeHandle.height / 2);
    await pivotPage.mouse.up();
    await pivotPage.waitForTimeout(150);
    const firstColWidthAfter = await pivotPage.locator('#pivot-table col').first().evaluate((node) => parseFloat(node.style.width || getComputedStyle(node).width));
    assert(firstColWidthAfter >= firstColWidthBefore + 40, 'Pivot column resize should update the first column width', `${firstColWidthBefore} -> ${firstColWidthAfter}`);
  }

  const nonCrosslinkedPivotParams = new URLSearchParams({
    f_track_name: '透明质酸钠',
    f_product_shape: '非交联水光、肤质改善类',
  });
  const nonCrosslinkedPivotPage = await openCheckedPage(context, `pivot.html?${nonCrosslinkedPivotParams.toString()}`);
  const nonCrosslinkedTitle = await nonCrosslinkedPivotPage.locator('#pivot-table-title').textContent();
  assert(nonCrosslinkedTitle?.trim() === '透明质酸钠赛道非交联水光市场分布图', 'Pivot auto title should reflect HA non-crosslinked filters', nonCrosslinkedTitle?.trim() || '');
  await nonCrosslinkedPivotPage.fill('#pivot-title-input', '含麻韩国填充剂竞争格局图');
  await nonCrosslinkedPivotPage.waitForTimeout(150);
  const customTitleState = await nonCrosslinkedPivotPage.evaluate(() => ({
    title: document.querySelector('#pivot-table-title')?.textContent?.trim() || '',
    urlTitle: new URL(location.href).searchParams.get('title') || '',
  }));
  assert(customTitleState.title === '含麻韩国填充剂竞争格局图', 'Pivot custom title should override the generated title', customTitleState.title);
  assert(customTitleState.urlTitle === '含麻韩国填充剂竞争格局图', 'Pivot custom title should be shareable in the URL', customTitleState.urlTitle);
  await nonCrosslinkedPivotPage.close();

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
  assert(lipPivotState.records === '50', 'Lip indication pivot should stay within HA lidocaine crosslinked records', lipPivotState.records);
  assert(lipPivotState.cellTitles.some((title) => title.includes('美国 × 唇部：1')), 'VOLBELLA should appear under US x lip indication', lipPivotState.cellTitles.join(' | '));
  assert(!lipPivotState.cellTitles.some((title) => title.includes('美国 × 肤质改善')), 'US x skin quality should not contain VOLBELLA', lipPivotState.cellTitles.join(' | '));
  await lipPivotPage.close();

  const qMedPivotParams = new URLSearchParams({
    rows: 'country_region',
    cols: 'lidocaine_signal',
    f_track_name: '透明质酸钠',
    f_product_shape: '交联填充类',
  });
  const qMedPivotPage = await openCheckedPage(context, `pivot.html?${qMedPivotParams.toString()}`);
  const qMedPivotState = await qMedPivotPage.evaluate(() => ({
    cellTitles: Array.from(document.querySelectorAll('.pivot-cell-button')).map((node) => node.title),
  }));
  assert(qMedPivotState.cellTitles.some((title) => title.includes('瑞典/瑞士 × 含利多卡因：5')), 'Galderma/Q-Med lidocaine records should land under Sweden/Switzerland x lidocaine', qMedPivotState.cellTitles.join(' | '));
  await qMedPivotPage.close();

  await pivotPage.evaluate(() => window.scrollTo(0, 0));
  await pivotPage.waitForTimeout(150);
  await pivotPage.locator('#pivot-field-pool [data-field-id="country_region"]').scrollIntoViewIfNeeded();
  await pivotPage.locator('#pivot-columns').scrollIntoViewIfNeeded();
  await pivotPage.locator('#pivot-field-pool [data-field-id="country_region"]').dragTo(pivotPage.locator('#pivot-columns'));
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
