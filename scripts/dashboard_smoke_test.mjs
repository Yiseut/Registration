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
    handlers.forEach((handler) => handler.h.call(handler.ctx, { dataIndex: index, seriesName: '核心新增' }));
    return true;
  }, year);
  assert(clicked, `Could not trigger ${year} timeline drilldown`);
  await page.waitForTimeout(300);
}

async function main() {
  const overview = await fetch(urlFor('assets/data/overview.json')).then((res) => res.json());
  const manifest = await fetch(urlFor('assets/data/manifest.json')).then((res) => res.json());
  const haData = await fetch(urlFor('assets/data/tracks/ha.json')).then((res) => res.json());
  const pllaData = await fetch(urlFor('assets/data/tracks/plla.json')).then((res) => res.json());
  const botulinumData = await fetch(urlFor('assets/data/tracks/botulinum.json')).then((res) => res.json());
  const cahaTrackMeta = (manifest.tracks || []).find((track) => track.key === 'caha');
  const expectedRecords = Number(overview?.kpi?.main_records || 0);
  const volbella = (haData.records || []).find((record) => record.certificate_no === '国械注进20213130109');
  const qMedLidocaineRecords = ['国械注进20213130059', '国械注进20253130284'].map((cert) => (
    (haData.records || []).find((record) => record.certificate_no === cert)
  ));
  const haiyameiBrandRecords = new Map(['国械注准20243131969', '国械注准20253130898', '国械注准20253131239', '国械注准20263130671'].map((cert) => (
    [cert, (haData.records || []).find((record) => record.certificate_no === cert)]
  )));
  const weimuPllaRecord = (pllaData.records || []).find((record) => record.certificate_no === '国械注准20263130608');
  const jingyuPllaRecord = (pllaData.records || []).find((record) => record.certificate_no === '国械注准20263130522');
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
  const missingHaiyameiCerts = Array.from(haiyameiBrandRecords)
    .filter(([, record]) => !record)
    .map(([cert]) => cert);
  assert(!missingHaiyameiCerts.length, 'Haiyamei records should stay in the HA dataset', missingHaiyameiCerts.join(', '));
  for (const record of Array.from(haiyameiBrandRecords.values()).filter(Boolean)) {
    assert(record.company === '海雅美' || /海雅美/.test(record.registrant || ''), 'Haiyamei records should preserve the company grouping', `${record.certificate_no || 'missing'}:${record.company || record.registrant || 'missing'}`);
  }
  assert(haiyameiBrandRecords.get('国械注准20243131969')?.primary_indication === '下颌及颏部轮廓改善（填充）', 'Haiyamei jaw product should keep the jaw/chin indication', haiyameiBrandRecords.get('国械注准20243131969')?.primary_indication || 'missing');
  assert(haiyameiBrandRecords.get('国械注准20253130898')?.primary_indication === '肤质改善', 'Haiyamei skin-quality product should keep the skin-quality indication', haiyameiBrandRecords.get('国械注准20253130898')?.primary_indication || 'missing');
  assert(haiyameiBrandRecords.get('国械注准20253131239')?.primary_indication === '颈部', 'Haiyamei neck product should keep the neck indication', haiyameiBrandRecords.get('国械注准20253131239')?.primary_indication || 'missing');
  assert(/瑅派/.test(`${haiyameiBrandRecords.get('国械注准20263130671')?.brand || ''} ${haiyameiBrandRecords.get('国械注准20263130671')?.aliases || ''}`), 'Haiyamei hand product should retain the Tipai commercial signal', haiyameiBrandRecords.get('国械注准20263130671')?.brand || 'missing');
  assert(weimuPllaRecord?.brand === '臻好迷', 'Weimu PLLA record should be included with the Zhenhaomi brand', weimuPllaRecord?.brand || 'missing');
  assert(weimuPllaRecord?.registrant === '上海玮沐医疗科技有限公司', 'Weimu PLLA record should keep the official registrant', weimuPllaRecord?.registrant || 'missing');
  assert(jingyuPllaRecord?.brand === '时凝萃', 'Jingyu Yimei PLLA record should be included with the Shining Trace brand', jingyuPllaRecord?.brand || 'missing');
  assert(jingyuPllaRecord?.registrant === '北京京宇一美生物科技有限责任公司', 'Jingyu Yimei PLLA record should keep the official registrant', jingyuPllaRecord?.registrant || 'missing');
  for (const record of officialComponentLidocaineRecords) {
    assert(record?.lidocaine_status === '含利多卡因', 'Official component lidocaine records should be classified as lidocaine', record?.certificate_no || 'missing');
    assert(/利多卡因|lidocaine/i.test(record?.components || ''), 'Official component lidocaine records should keep component lidocaine text', record?.certificate_no || 'missing');
  }
  assert(!lipScopeSkinQualityAnomalies.length, 'Lip-scope HA records should not be classified as skin quality', lipScopeSkinQualityAnomalies.map((record) => record.certificate_no).join(', '));
  const botoxCerts = ['国药准字SJ20171003', '国药准字SJ20171004', '国药准字SJ20171005'];
  const botoxRecords = botoxCerts.map((cert) => (botulinumData.records || []).find((record) => record.certificate_no === cert));
  const letybo50Record = (botulinumData.records || []).find((record) => record.certificate_no === '国药准字SJ20210004');
  assert(botoxRecords.every(Boolean), 'BOTOX should keep the three approval numbers separated by specification', botoxRecords.map((record) => record?.certificate_no || 'missing').join(', '));
  assert(botoxRecords.every((record) => record?.valid_until === '2027-06-13'), 'BOTOX records should keep current certificate expiry dates', botoxRecords.map((record) => `${record?.certificate_no || 'missing'}:${record?.valid_until || 'missing'}`).join(', '));
  assert(botoxRecords.some((record) => /50单位\/支/.test(record?.specification || '') && /3支\/盒/.test(record?.specification || '')), 'BOTOX should keep the 50-unit multi-pack specification evidence');
  assert(botoxRecords.some((record) => /100单位\/支/.test(record?.specification || '')), 'BOTOX should keep the 100-unit specification evidence');
  assert(/Hugel|乐提葆/i.test(`${letybo50Record?.registrant || ''} ${letybo50Record?.brand || ''}`), 'SJ20210004 should belong to Hugel/Letybo, not BOTOX', `${letybo50Record?.registrant || 'missing'} ${letybo50Record?.brand || ''}`);
  assert(cahaTrackMeta?.name === 'CaHA/微晶瓷', 'CaHA track should use microcrystalline porcelain as the generic material label', cahaTrackMeta?.name || 'missing');

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
    companyKpiDelta: document.querySelector('#kpi-companies')?.closest('.kpi')?.querySelector('.delta')?.textContent?.trim() || '',
    removedKpis: ['#kpi-main', '#kpi-verified', '#kpi-inj3', '#kpi-drug', '#kpi-indications']
      .filter((selector) => document.querySelector(selector))
      .join(','),
    originCardLabel: document.querySelector('#kpi-origin-total')?.closest('.kpi')?.querySelector('.label')?.textContent?.trim() || '',
    originTotal: document.querySelector('#kpi-origin-total')?.textContent?.trim() || '',
    originBreakdown: document.querySelector('#kpi-origin-breakdown')?.textContent?.trim() || '',
    hasGlobalSearchCard: document.querySelector('.global-search-card') !== null,
    hasNavSearch: document.querySelector('#nav-root .global-nav-search #global-search-input') !== null,
    hasGlobalSearchClear: document.querySelector('#global-search-clear') !== null,
    globalSearchPlaceholder: document.querySelector('#global-search-input')?.getAttribute('placeholder') || '',
    globalSearchVisibleText: document.querySelector('.global-nav-search')?.textContent?.replace(/\s+/g, '').trim() || '',
    globalSearchWidth: Math.round(document.querySelector('.global-nav-search')?.getBoundingClientRect().width || 0),
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
  assert(!/统计口径|解读边界|覆盖范围|主格局|不代表销量/.test(overviewState.updateText), 'Overview update line should not show backend methodology copy', overviewState.updateText);
  assert(!overviewState.hasChinaMapRecordMetric, 'China map header should not show a separate registration-count metric');
  assert(overviewState.chinaMapMetricLabels.join(',') === '城市,注册主体', 'China map header should only show city and registrant metrics', overviewState.chinaMapMetricLabels.join(','));
  assert(overviewState.kpiLabels.join(',') === '注册企业 / 集团数,证照数,近 12 个月新增', 'Overview KPI cards should stay trimmed to the user-facing set', overviewState.kpiLabels.join(','));
  assert(!overviewState.companyKpiDelta, 'Company KPI subtitle should stay removed', overviewState.companyKpiDelta);
  assert(!overviewState.removedKpis, 'Crossed-out or retired KPI cards should stay removed', overviewState.removedKpis);
  assert(overviewState.originCardLabel === '证照数', 'Origin KPI should be labeled as certificate count', overviewState.originCardLabel);
  assert(overviewState.originTotal === String(expectedRecords), 'Origin KPI total should match main_records', overviewState.originTotal);
  assert(overviewState.originBreakdown === `国内 ${overview.kpi.domestic}张 · 进口 ${overview.kpi.imported}张 · 港澳台 ${overview.kpi.hkmt}张`, 'Origin KPI should show unitized domestic/import/HKMT counts', overviewState.originBreakdown);
  assert(!overviewState.hasGlobalSearchCard, 'Overview should not render the large body-level global search card');
  assert(overviewState.hasNavSearch, 'Global search should live inside the top navigation');
  assert(!overviewState.hasGlobalSearchClear, 'Global search should not show a separate clear button');
  assert(!overviewState.globalSearchPlaceholder && !overviewState.globalSearchVisibleText, 'Nav search should not show visible prompt copy', JSON.stringify(overviewState));
  assert(overviewState.globalSearchWidth > 90 && overviewState.globalSearchWidth <= 170, 'Nav search should stay compact', String(overviewState.globalSearchWidth));
  assert(overviewState.overflowX <= 1, 'Overview has horizontal overflow', String(overviewState.overflowX));

  await overviewPage.fill('#global-search-input', '海雅美');
  await overviewPage.waitForSelector('.global-search-result');
  const globalSearchState = await overviewPage.evaluate(() => ({
    resultText: document.querySelector('#global-search-results')?.textContent?.replace(/\s+/g, ' ').trim() || '',
    firstHref: document.querySelector('.global-search-result a')?.getAttribute('href') || '',
    inputValue: document.querySelector('#global-search-input')?.value || '',
    filterValue: document.querySelector('#filter-query')?.value || '',
    visible: document.querySelector('#global-search-results')?.classList.contains('visible') || false,
  }));
  assert(globalSearchState.visible, 'Global search results should appear after typing a company name', JSON.stringify(globalSearchState));
  assert(/海雅美/.test(globalSearchState.resultText) && /透明质酸钠/.test(globalSearchState.resultText), 'Global search should route Haiyamei to the HA product line', globalSearchState.resultText);
  assert(globalSearchState.firstHref.includes('tracks/ha.html') && decodeURIComponent(globalSearchState.firstHref).includes('海雅美'), 'Global search track link should preserve the query for the material page', globalSearchState.firstHref);
  assert(globalSearchState.inputValue === '海雅美' && globalSearchState.filterValue === '海雅美', 'Global search should stay synced with the official-record search field', JSON.stringify(globalSearchState));

  await overviewPage.locator('.global-search-result [data-global-action="filter"]').first().click();
  await overviewPage.waitForTimeout(350);
  const globalSearchFilterState = await overviewPage.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('#table-records tbody tr')).map((row) => row.textContent?.replace(/\s+/g, ' ').trim() || '');
    const params = new URL(location.href).searchParams;
    return {
      rows,
      count: document.querySelector('#record-count')?.textContent?.trim() || '',
      segment: document.querySelector('#filter-segment')?.value || '',
      company: document.querySelector('#filter-company')?.value || '',
      q: params.get('q') || '',
      urlSegment: params.get('segment') || '',
    };
  });
  assert(globalSearchFilterState.segment === 'ha' && globalSearchFilterState.urlSegment === 'ha', 'Global search filter action should switch the official table to the matching material segment', JSON.stringify(globalSearchFilterState));
  assert(globalSearchFilterState.rows.length > 0 && globalSearchFilterState.rows.every((row) => /海雅美/.test(row)), 'Global search filter action should show only matching company rows', JSON.stringify(globalSearchFilterState));
  assert(globalSearchFilterState.q === '海雅美', 'Global search filter action should keep the query in the URL', JSON.stringify(globalSearchFilterState));

  await overviewPage.selectOption('#filter-origin', 'hkmt');
  await overviewPage.waitForTimeout(250);
  assert(new URL(overviewPage.url()).searchParams.get('origin') === 'hkmt', 'Origin filter did not update the URL');
  await overviewPage.close();

  for (const path of ['tracks/ha.html', 'tracks/botulinum.html', 'tracks/caha.html']) {
    const trackPage = await openCheckedPage(context, path);
    const trackCompanyLayout = await trackPage.evaluate(() => ({
      bodyText: document.body.textContent || '',
      hasCompanyChart: document.querySelector('#chart-companies') !== null,
      hasOriginDonut: document.querySelector('#chart-origin') !== null,
      companySection: Array.from(document.querySelectorAll('.section-head')).find((node) => /注册主体格局/.test(node.textContent || ''))?.textContent?.replace(/\s+/g, ' ').trim() || '',
    }));
    assert(trackCompanyLayout.hasCompanyChart, `${path} should render the unified company/registrant landscape chart`);
    assert(trackCompanyLayout.companySection.includes('注册主体格局'), `${path} should use the neutral registrant-landscape heading`, trackCompanyLayout.companySection);
    assert(!trackCompanyLayout.bodyText.includes('厂家竞争力'), `${path} should not present certificate counts as manufacturer competitiveness`);
    assert(!trackCompanyLayout.hasOriginDonut, `${path} should not mix origin share into the registrant-landscape card`);
    await trackPage.close();
  }

  const pipelinePage = await openCheckedPage(context, 'pipeline.html');
  const pipelineOverview = await pipelinePage.evaluate(() => ({
    h1: document.querySelector('h1')?.textContent?.trim() || '',
    hasScopeNote: document.querySelector('#scopeNote') !== null,
    globalNavText: document.querySelector('#nav-root')?.textContent || '',
    globalNavLinks: Array.from(document.querySelectorAll('#nav-root a')).map((node) => ({
      text: node.textContent?.trim() || '',
      href: node.getAttribute('href') || '',
    })),
    hasScopeBackLink: document.querySelector('.scope-card .back-link') !== null,
    scopeCardText: document.querySelector('.scope-card')?.textContent || '',
    metricLabels: Array.from(document.querySelectorAll('.metric-card span:first-child')).map((node) => node.textContent?.trim() || ''),
    hasStageOverview: document.querySelector('#stageOverview') !== null,
    hasArchivedKpi: document.querySelector('#kpiArchived') !== null,
    timelineHidden: document.querySelector('#timelineSection')?.classList.contains('section-hidden') || false,
    summaryCards: document.querySelectorAll('#trackSummaryCards .track-summary-card').length,
    summaryText: document.querySelector('#trackSummaryCards')?.textContent || '',
    summaryForecastHighlights: document.querySelectorAll('#trackSummaryCards .track-summary-card em').length,
    hasAnalysisCard: document.querySelector('#analysisConclusions') !== null,
    forecastCards: document.querySelectorAll('#forecastSummary .forecast-rank-card').length,
    forecastMethod: document.querySelector('#forecastMethod')?.textContent || '',
    hasForecastMethodCard: document.querySelector('.forecast-method') !== null,
    forecastSummaryColumns: getComputedStyle(document.querySelector('.forecast-summary')).gridTemplateColumns,
    basisCards: Array.from(document.querySelectorAll('#forecastBasisCards .basis-card')).map((node) => node.textContent?.replace(/\s+/g, ' ').trim() || ''),
    cycleStages: Array.from(document.querySelectorAll('#benchmarkSteps .cycle-stage')).map((node) => node.textContent?.replace(/\s+/g, ' ').trim() || ''),
    troubledCases: Array.from(document.querySelectorAll('#troubledCases .troubled-card')).map((node) => node.textContent?.replace(/\s+/g, ' ').trim() || ''),
    kpis: ['#kpiClinical', '#kpiReview', '#kpiTesting', '#kpiScout'].map((selector) => Number(document.querySelector(selector)?.textContent || 0)),
    projectText: document.querySelector('#projectBody')?.textContent || '',
    ecmImplantRows: Array.from(document.querySelectorAll('#projectBody tr')).filter((row) => /脱细胞基质植入剂/.test(row.textContent || '')).length,
    ecmShengzhirunheGelRows: Array.from(document.querySelectorAll('#projectBody tr')).filter((row) => {
      const text = row.textContent || '';
      return /圣至润合/.test(text) && /注射用(细胞外基质|ECM)生物凝胶/.test(text) && !/第二款/.test(text);
    }).length,
    ecmSisRows: Array.from(document.querySelectorAll('#projectBody tr')).filter((row) => /SIS-ECM医美填充产品/.test(row.textContent || '')).length,
    contextCards: document.querySelectorAll('#contextList .context-card').length,
    contextText: document.querySelector('#contextList')?.textContent || '',
    hasStandalonePnTab: document.querySelector('[data-track="pn"]') !== null,
    hasPdrnPnTab: document.querySelector('[data-track="pdrn_pn"]') !== null,
    bodyText: document.body.textContent || '',
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  assert(pipelineOverview.h1 === '注册进度', 'Pipeline page should use a clean user-facing heading', pipelineOverview.h1);
  assert(!pipelineOverview.hasScopeNote && !/关注仍在推进的注册项目|已获批产品单独看市场表现/.test(pipelineOverview.bodyText), 'Pipeline hero should not render a redundant scope sentence', pipelineOverview.bodyText);
  assert(['总览', '透明质酸钠', 'PCL', '自定义透视', '注册进度'].every((label) => pipelineOverview.globalNavText.includes(label)), 'Pipeline global navigation should render the shared dashboard topbar menu', pipelineOverview.globalNavText);
  assert(pipelineOverview.globalNavLinks.some((link) => link.text === 'PCL' && link.href.includes('tracks/pcl.html')), 'Pipeline global navigation should link directly to PCL', JSON.stringify(pipelineOverview.globalNavLinks));
  assert(pipelineOverview.globalNavLinks.some((link) => link.text === '总览' && link.href.includes('index.html')), 'Pipeline global navigation should keep an overview link back to the homepage', JSON.stringify(pipelineOverview.globalNavLinks));
  assert(!pipelineOverview.hasScopeBackLink, 'Pipeline update area should not keep the old right-side back link');
  assert(/最近更新|\d{4}-\d{2}-\d{2}/.test(pipelineOverview.scopeCardText), 'Pipeline update area should keep the last-updated timestamp', pipelineOverview.scopeCardText);
  assert(!/更新节奏|每月完整刷新|事件触发补充|季度复盘校准|主数据定期同步/.test(pipelineOverview.bodyText), 'Pipeline dashboard should not expose backend update workflow language', pipelineOverview.bodyText);
  assert(pipelineOverview.metricLabels.join(',') === '注册临床中,受理/审评中,注册检验/型检,早期线索', 'Pipeline KPI strip should show the four non-duplicated progress buckets', pipelineOverview.metricLabels.join(','));
  assert(!pipelineOverview.hasArchivedKpi, 'Pipeline should not show an approved/listed KPI without a time window');
  assert(!pipelineOverview.hasStageOverview && !/阶段分布|查看项目集中在哪些环节/.test(pipelineOverview.bodyText), 'Pipeline should not duplicate KPI buckets in a separate stage distribution card', pipelineOverview.bodyText);
  assert(pipelineOverview.timelineHidden, 'Pipeline overview should not show the all-material timeline');
  assert(pipelineOverview.summaryCards >= 3, 'Pipeline overview should show material summary cards', String(pipelineOverview.summaryCards));
  assert(pipelineOverview.summaryForecastHighlights === 0 && !/预计|暂无预测/.test(pipelineOverview.summaryText), 'Pipeline material summary cards should not repeat forecast project details', pipelineOverview.summaryText);
  assert(!pipelineOverview.hasAnalysisCard && !/分析结论|提炼最需要关注的变化/.test(pipelineOverview.bodyText), 'Pipeline overview should not render a duplicated analysis conclusion card', pipelineOverview.bodyText);
  assert(pipelineOverview.forecastCards >= 5, 'Pipeline overview should show a ranked summary forecast list', String(pipelineOverview.forecastCards));
  assert(/顺序参考|官方信息/.test(pipelineOverview.forecastMethod), 'Pipeline forecast note should stay concise and user-facing', pipelineOverview.forecastMethod);
  assert(!pipelineOverview.hasForecastMethodCard, 'Pipeline should not render a separate forecast-method card');
  assert(!pipelineOverview.forecastSummaryColumns || pipelineOverview.forecastSummaryColumns === 'none', 'Pipeline forecast ranking should not reserve a second column for methodology copy', pipelineOverview.forecastSummaryColumns);
  assert(pipelineOverview.basisCards.length === 3, 'Pipeline should render three full-cycle forecast basis cards', String(pipelineOverview.basisCards.length));
  assert(pipelineOverview.basisCards.some((text) => /Ellansé-M|跟进型材料|2026-04-23/.test(text)), 'Pipeline basis should include the approved follow-on device benchmark', pipelineOverview.basisCards.join(' | '));
  assert(pipelineOverview.basisCards.some((text) => /优法兰|首证类器械|国械注准20253130390/.test(text)), 'Pipeline basis should include a first-certificate device benchmark', pipelineOverview.basisCards.join(' | '));
  assert(pipelineOverview.basisCards.some((text) => /芮妥欣|国药准字S20260019/.test(text)), 'Pipeline basis should include the approved drug benchmark', pipelineOverview.basisCards.join(' | '));
  assert(pipelineOverview.cycleStages.length === 6, 'Pipeline should render the six full-cycle registration stages', String(pipelineOverview.cycleStages.length));
  assert(pipelineOverview.cycleStages.join(' | ').includes('临床前研究') && pipelineOverview.cycleStages.join(' | ').includes('注册临床试验') && pipelineOverview.cycleStages.join(' | ').includes('技术审评'), 'Pipeline cycle should cover the complete preclinical-to-review journey', pipelineOverview.cycleStages.join(' | '));
  assert(/Base Case|42–54|3.5–4.5 年/.test(pipelineOverview.bodyText), 'Pipeline cycle should default to the Base Case planning range', pipelineOverview.bodyText);
  await pipelinePage.locator('[data-cycle-scenario="worst"]').click();
  await pipelinePage.waitForTimeout(150);
  const worstCycle = await pipelinePage.locator('#cycleCard').textContent();
  assert(/Worst Case|66–90|5.5–7.5 年/.test(worstCycle || ''), 'Pipeline cycle should switch to the Worst Case range', worstCycle || '');
  assert(pipelineOverview.troubledCases.some((text) => /Ultherapy|超声刀/.test(text)) && pipelineOverview.troubledCases.some((text) => /Radiesse|瑞德喜/.test(text)), 'Pipeline should show troubled/stalled registration cases', pipelineOverview.troubledCases.join(' | '));
  assert(pipelineOverview.kpis[0] > 0 && pipelineOverview.kpis[1] > 0 && pipelineOverview.kpis[3] >= 0, 'Pipeline KPIs should show active pre-approval progress only', pipelineOverview.kpis.join(','));
  assert(!/HUTOX|芮妥欣\/注射用重组|RADIESSE芮得怡|Radiesse\/瑞德喜|Ellansé-M|山东采采医疗科技有限公司|渼颜空间生物科技/.test(pipelineOverview.projectText), 'Approved/listed products should stay out of the active pipeline project table');
  assert(pipelineOverview.ecmImplantRows === 1, 'Baiyiyuan ECM implant should be merged into one active project row', String(pipelineOverview.ecmImplantRows));
  assert(pipelineOverview.ecmShengzhirunheGelRows === 1, 'Shengzhirunhe ECM gel aliases should be merged into one active project row', String(pipelineOverview.ecmShengzhirunheGelRows));
  assert(pipelineOverview.ecmSisRows === 0, 'SIS-ECM media wording should verify the Baiyiyuan ECM implant instead of becoming a separate project row', String(pipelineOverview.ecmSisRows));
  assert(!/行业总体|PDRN\/PN主文档与标准研究|PDRN&PN再生材料注册路径/.test(pipelineOverview.projectText), 'Industry context should not render as active forecast projects', pipelineOverview.projectText);
  assert(pipelineOverview.contextCards >= 3, 'Pipeline overview should render industry/regulatory context cards separately', String(pipelineOverview.contextCards));
  assert(/赛道背景 \/ 不对应单一企业/.test(pipelineOverview.contextText), 'Context cards should explain non-company industry sources', pipelineOverview.contextText);
  assert(pipelineOverview.hasPdrnPnTab && !pipelineOverview.hasStandalonePnTab, 'Pipeline should combine PN and PDRN into one tab instead of showing an empty PN tab');
  assert(!pipelineOverview.bodyText.includes('来源覆盖'), 'Pipeline public page should not expose source-coverage backend wording');
  assert(pipelineOverview.overflowX <= 1, 'Pipeline overview has horizontal overflow', String(pipelineOverview.overflowX));

  await pipelinePage.locator('#trackSummaryCards .track-summary-card[data-summary-track="caha"]').click();
  await pipelinePage.waitForTimeout(300);
  const pipelineSummaryNav = await pipelinePage.evaluate(() => ({
    activeTab: document.querySelector('.track-tab.active')?.textContent?.trim() || '',
    overviewTitle: document.querySelector('#overviewTitle')?.textContent?.trim() || '',
    projectText: document.querySelector('#projectBody')?.textContent || '',
  }));
  assert(pipelineSummaryNav.activeTab.includes('CaHA'), 'Clicking a summary card should activate the matching material tab', JSON.stringify(pipelineSummaryNav));
  assert(pipelineSummaryNav.activeTab.includes('微晶瓷'), 'Pipeline CaHA tab should display the microcrystalline porcelain generic label', JSON.stringify(pipelineSummaryNav));
  assert(pipelineSummaryNav.overviewTitle.includes('CaHA'), 'Clicking a summary card should refresh the overview section for that material', JSON.stringify(pipelineSummaryNav));
  assert(!/Radiesse|RADIESSE|瑞德喜|芮得怡/.test(pipelineSummaryNav.projectText), 'Summary-card navigation should keep approved Radiesse out of the CaHA project table', pipelineSummaryNav.projectText);

  await pipelinePage.locator('.metric-card[data-stage-filter="review"]').click();
  await pipelinePage.waitForTimeout(300);
  const pipelineReviewFilter = await pipelinePage.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('#projectBody tr')).map((row) => row.textContent?.replace(/\s+/g, ' ').trim() || '');
    return {
      countText: document.querySelector('#projectCount')?.textContent?.trim() || '',
      note: document.querySelector('#projectFilterNote')?.textContent?.trim() || '',
      active: document.querySelector('.metric-card[data-stage-filter="review"]')?.classList.contains('active') || false,
      expected: Number(document.querySelector('#kpiReview')?.textContent || 0),
      rows,
    };
  });
  assert(pipelineReviewFilter.active && /受理\/审评中/.test(pipelineReviewFilter.countText), 'Clicking the review KPI should filter the project table to review-stage rows', JSON.stringify(pipelineReviewFilter));
  assert(pipelineReviewFilter.rows.length === pipelineReviewFilter.expected && pipelineReviewFilter.rows.every((text) => /受理\/审评中/.test(text)), 'Review KPI filter should show only review-stage products', JSON.stringify(pipelineReviewFilter));

  await pipelinePage.locator('.metric-card[data-stage-filter="clinical"]').click();
  await pipelinePage.waitForTimeout(300);
  const pipelineClinicalFilter = await pipelinePage.evaluate(() => {
    const rows = Array.from(document.querySelectorAll('#projectBody tr')).map((row) => row.textContent?.replace(/\s+/g, ' ').trim() || '');
    const expected = Number(document.querySelector('#kpiClinical')?.textContent || 0);
    return {
      countText: document.querySelector('#projectCount')?.textContent?.trim() || '',
      note: document.querySelector('#projectFilterNote')?.textContent?.trim() || '',
      active: document.querySelector('.metric-card[data-stage-filter="clinical"]')?.classList.contains('active') || false,
      expected,
      rows,
    };
  });
  assert(pipelineClinicalFilter.active && /注册临床中/.test(pipelineClinicalFilter.countText), 'Clicking the clinical KPI should filter the project table to clinical-stage rows', JSON.stringify(pipelineClinicalFilter));
  assert(pipelineClinicalFilter.rows.length === pipelineClinicalFilter.expected && pipelineClinicalFilter.rows.every((text) => /注册临床中/.test(text)), 'Clinical KPI filter should show the products behind the clinical count', JSON.stringify(pipelineClinicalFilter));

  await pipelinePage.locator('[data-track="silk"]').click();
  await pipelinePage.waitForTimeout(300);
  const pipelineSilk = await pipelinePage.evaluate(() => ({
    activeTab: document.querySelector('.track-tab.active')?.textContent?.trim() || '',
    clinical: document.querySelector('#kpiClinical')?.textContent?.trim() || '',
    timelineHidden: document.querySelector('#timelineSection')?.classList.contains('section-hidden') || false,
    timelineTitle: document.querySelector('#timelineTitle')?.textContent?.trim() || '',
    nodes: document.querySelectorAll('#timelineTrack .timeline-node').length,
    projectedNodes: document.querySelectorAll('#timelineTrack .timeline-node.projected').length,
    detailText: document.querySelector('#timelineDetails')?.textContent || '',
    forecastTitle: document.querySelector('#forecastTitle')?.textContent?.trim() || '',
    forecastCards: document.querySelectorAll('#forecastSummary .forecast-rank-card').length,
    hasSourceButton: document.querySelector('#timelineDetails .source-button') !== null,
    projectRows: document.querySelectorAll('#projectBody tr').length,
    sourceRows: document.querySelectorAll('#recordBody tr').length,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  assert(pipelineSilk.activeTab.includes('丝素蛋白'), 'Silk tab should become active', pipelineSilk.activeTab);
  assert(pipelineSilk.clinical === '2', 'Silk should show two verified active clinical projects', pipelineSilk.clinical);
  assert(!pipelineSilk.timelineHidden, 'Material tabs should show a material-specific timeline');
  assert(pipelineSilk.timelineTitle.includes('丝素蛋白'), 'Silk timeline title should name the material track', pipelineSilk.timelineTitle);
  assert(pipelineSilk.nodes > 0 && pipelineSilk.projectedNodes > 0, 'Silk timeline should include actual and projected nodes', `${pipelineSilk.nodes}/${pipelineSilk.projectedNodes}`);
  assert(pipelineSilk.forecastTitle.includes('丝素蛋白') && pipelineSilk.forecastCards === 2, 'Silk view should show a track-specific forecast ranking for verified active projects', `${pipelineSilk.forecastTitle} / ${pipelineSilk.forecastCards}`);
  assert(pipelineSilk.detailText.includes('项目预测') && !/界面新闻|动脉网/.test(pipelineSilk.detailText), 'Timeline point details should stay concise and not duplicate media source copy', pipelineSilk.detailText);
  assert(pipelineSilk.hasSourceButton, 'Timeline point should expose a source jump button');
  assert(pipelineSilk.projectRows === 2, 'Silk active table should exclude unverified A4 leads', String(pipelineSilk.projectRows));
  assert(pipelineSilk.sourceRows >= 3, 'Silk source list should render related source rows', String(pipelineSilk.sourceRows));
  assert(pipelineSilk.overflowX <= 1, 'Pipeline silk view has horizontal overflow', String(pipelineSilk.overflowX));
  await pipelinePage.locator('#timelineDetails .source-button').first().click();
  await pipelinePage.waitForTimeout(300);
  const pipelineSourceNote = await pipelinePage.locator('#sourceFilterNote').textContent();
  assert(/找到|未找到/.test(pipelineSourceNote || ''), 'Pipeline source jump should update the source list note', pipelineSourceNote || '');

  await pipelinePage.locator('[data-track="pcl"]').click();
  await pipelinePage.waitForTimeout(300);
  const pipelinePcl = await pipelinePage.evaluate(() => ({
    projectText: document.querySelector('#projectBody')?.textContent || '',
    forecastText: document.querySelector('#forecastSummary')?.textContent || '',
    hasArchivedKpi: document.querySelector('#kpiArchived') !== null,
    rows: document.querySelectorAll('#projectBody tr').length,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  assert(/西安臻研|重组Ⅲ型人源化胶原蛋白/.test(pipelinePcl.projectText), 'PCL view should include the official Xi’an Zhenyan PCL-composite clinical project', pipelinePcl.projectText);
  assert(!/Ellansé-M|山东采采医疗科技有限公司|渼颜空间生物科技/.test(pipelinePcl.projectText), 'Approved PCL products should not stay in the active PCL project table', pipelinePcl.projectText);
  assert(!/Ellansé-M|山东采采医疗科技有限公司|渼颜空间生物科技/.test(pipelinePcl.forecastText), 'Approved PCL products should not rank in the active PCL forecast list', pipelinePcl.forecastText);
  assert(!pipelinePcl.hasArchivedKpi, 'PCL view should not show an archived/approved KPI');
  assert(pipelinePcl.rows >= 3, 'PCL view should keep multiple active projects', String(pipelinePcl.rows));
  assert(pipelinePcl.overflowX <= 1, 'Pipeline PCL view has horizontal overflow', String(pipelinePcl.overflowX));

  await pipelinePage.locator('[data-track="plla"]').click();
  await pipelinePage.waitForTimeout(300);
  const pipelinePlla = await pipelinePage.evaluate(() => ({
    projectText: document.querySelector('#projectBody')?.textContent || '',
    sourceText: document.querySelector('#recordBody')?.textContent || '',
    rows: document.querySelectorAll('#projectBody tr').length,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  assert(/金华艾普瑞生物科技有限公司/.test(pipelinePlla.projectText) && /聚乳酸面部填充剂/.test(pipelinePlla.projectText), 'PLLA/PLA view should include the newly crawled Apre ChiCTR clinical project', pipelinePlla.projectText);
  assert(/pipe_plla_apre_chictr2600120937/.test(pipelinePlla.sourceText), 'PLLA/PLA record list should keep the Apre project record id without exposing the source title', pipelinePlla.sourceText);
  assert(pipelinePlla.rows >= 5, 'PLLA/PLA active table should include the added clinical project', String(pipelinePlla.rows));
  assert(pipelinePlla.overflowX <= 1, 'Pipeline PLLA/PLA view has horizontal overflow', String(pipelinePlla.overflowX));

  await pipelinePage.locator('[data-track="caha"]').click();
  await pipelinePage.waitForTimeout(300);
  const pipelineCaha = await pipelinePage.evaluate(() => {
    const rowTexts = Array.from(document.querySelectorAll('#projectBody tr')).map((row) => row.textContent?.replace(/\s+/g, ' ').trim() || '');
    const forecastTexts = Array.from(document.querySelectorAll('#forecastSummary .forecast-rank-card')).map((row) => row.textContent?.replace(/\s+/g, ' ').trim() || '');
    const timelineTexts = Array.from(document.querySelectorAll('#timelineTrack .timeline-node')).map((row) => row.textContent?.replace(/\s+/g, ' ').trim() || '');
    const sourceText = document.querySelector('#recordBody')?.textContent || '';
    const count = (rows, pattern) => rows.filter((text) => pattern.test(text)).length;
    return {
      rows: rowTexts.length,
      cgbioProjectRows: count(rowTexts, /CGBio|华瑭/),
      cgbioForecastRows: count(forecastTexts, /CGBio|华瑭/),
      harmonyProjectRows: count(rowTexts, /HArmonyCa/i),
      haohaiProjectRows: count(rowTexts, /昊海生科/),
      hasRadiesseProject: rowTexts.some((text) => /Radiesse|RADIESSE|瑞德喜|芮得怡/.test(text)),
      hasRadiesseForecast: forecastTexts.some((text) => /Radiesse|RADIESSE|瑞德喜|芮得怡/.test(text)),
      hasRadiesseTimeline: timelineTexts.some((text) => /Radiesse|RADIESSE|瑞德喜|芮得怡/.test(text)),
      hasRadiesseSource: /Radiesse|RADIESSE|瑞德喜|芮得怡/.test(sourceText),
      hasGenericCgbioProject: rowTexts.some((text) => /CaHA填充物中国上市许可合作/.test(text)),
      hasGenericCgbioForecast: forecastTexts.some((text) => /CaHA填充物中国上市许可合作/.test(text)),
      hasGenericCgbioTimeline: timelineTexts.some((text) => /CaHA填充物中国上市许可合作/.test(text)),
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  assert(pipelineCaha.cgbioProjectRows === 1 && pipelineCaha.cgbioForecastRows === 1, 'CGBio/Huatang FACETEM sources should merge into one CaHA project', JSON.stringify(pipelineCaha));
  assert(!pipelineCaha.hasGenericCgbioProject && !pipelineCaha.hasGenericCgbioForecast && !pipelineCaha.hasGenericCgbioTimeline, 'Generic CGBio/Huatang cooperation wording should verify FACETEM instead of rendering separately', JSON.stringify(pipelineCaha));
  assert(pipelineCaha.harmonyProjectRows === 1, 'HArmonyCa sources should merge into one CaHA project row', JSON.stringify(pipelineCaha));
  assert(pipelineCaha.haohaiProjectRows === 1, 'Haohai CaHA generic and product-series sources should merge into one project row', JSON.stringify(pipelineCaha));
  assert(!pipelineCaha.hasRadiesseProject && !pipelineCaha.hasRadiesseForecast && !pipelineCaha.hasRadiesseTimeline && !pipelineCaha.hasRadiesseSource, 'Approved Radiesse/RADIESSE CaHA records should be excluded from active registration progress', JSON.stringify(pipelineCaha));
  assert(pipelineCaha.overflowX <= 1, 'Pipeline CaHA view has horizontal overflow', String(pipelineCaha.overflowX));

  await pipelinePage.locator('[data-track="pdrn_pn"]').click();
  await pipelinePage.waitForTimeout(300);
  const pipelinePdrn = await pipelinePage.evaluate(() => ({
    activeTab: document.querySelector('.track-tab.active')?.textContent?.trim() || '',
    projectText: document.querySelector('#projectBody')?.textContent || '',
    contextText: document.querySelector('#contextList')?.textContent || '',
    contextCards: document.querySelectorAll('#contextList .context-card').length,
    wuzhongRows: Array.from(document.querySelectorAll('#projectBody tr')).filter((row) => {
      const text = row.textContent || '';
      return /吴中美学|江苏吴中|北京丽徕/.test(text) && /PDRN复合溶液/.test(text);
    }).length,
    forecastCompact: document.querySelector('.forecast-panel')?.classList.contains('compact') || false,
    timelineHidden: document.querySelector('#timelineSection')?.classList.contains('section-hidden') || false,
    sourceQualityHidden: document.querySelector('#sourceQualitySection')?.classList.contains('section-hidden') || false,
    timelineBeforeBasis: (() => {
      const timeline = document.querySelector('#timelineSection');
      const basis = document.querySelector('#forecastBasisCards')?.closest('.panel');
      return Boolean(timeline && basis && (timeline.compareDocumentPosition(basis) & Node.DOCUMENT_POSITION_FOLLOWING));
    })(),
    sourceRightOfBasis: (() => {
      const basis = document.querySelector('#forecastBasisCards')?.closest('.panel');
      const source = document.querySelector('#sourceQualitySection');
      if (!basis || !source) return false;
      const basisRect = basis.getBoundingClientRect();
      const sourceRect = source.getBoundingClientRect();
      return sourceRect.left >= basisRect.right - 2;
    })(),
    forecastCardRightOfTimeline: (() => {
      const timeline = document.querySelector('#timelineSection');
      const card = document.querySelector('#forecastSummary .forecast-rank-card');
      if (!timeline || !card) return false;
      const timelineRect = timeline.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      return cardRect.left >= timelineRect.right - 2;
    })(),
    sourceRows: document.querySelectorAll('#recordBody tr').length,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  assert(pipelinePdrn.activeTab.includes('PDRN/PN'), 'Combined PDRN/PN tab should become active', pipelinePdrn.activeTab);
  assert(pipelinePdrn.wuzhongRows === 1, 'WuZhong/Liylai PDRN sources should merge into one product row', String(pipelinePdrn.wuzhongRows));
  assert(/临床进行中|入组完成/.test(pipelinePdrn.projectText), 'Merged WuZhong PDRN row should keep the latest substantive clinical progress', pipelinePdrn.projectText);
  assert(!/行业总体|PDRN\/PN主文档与标准研究|PDRN&PN再生材料注册路径/.test(pipelinePdrn.projectText), 'PDRN industry context should not render as active projects', pipelinePdrn.projectText);
  assert(pipelinePdrn.contextCards >= 5, 'Combined PDRN/PN view should show classification/regulatory context separately', String(pipelinePdrn.contextCards));
  assert(/赛道背景 \/ 不对应单一企业/.test(pipelinePdrn.contextText) && /主体未披露 \/ 暂不归入企业产品/.test(pipelinePdrn.contextText), 'PDRN context should label industry and undisclosed-subject sources clearly', pipelinePdrn.contextText);
  assert(/注射用多聚核苷酸凝胶/.test(pipelinePdrn.contextText), 'Combined PDRN/PN tab should retain PN regulatory context', pipelinePdrn.contextText);
  assert(pipelinePdrn.forecastCompact && !pipelinePdrn.timelineHidden && !pipelinePdrn.sourceQualityHidden, 'PDRN forecast should pair the timeline with the right-aligned approval window card', JSON.stringify(pipelinePdrn));
  assert(pipelinePdrn.timelineBeforeBasis, 'PDRN timeline should appear before forecast basis and cycle ranges', JSON.stringify(pipelinePdrn));
  assert(pipelinePdrn.sourceRightOfBasis, 'PDRN source quality card should sit to the right of forecast basis on desktop', JSON.stringify(pipelinePdrn));
  assert(pipelinePdrn.forecastCardRightOfTimeline, 'PDRN approval window card should sit to the right of the timeline on desktop', JSON.stringify(pipelinePdrn));
  assert(pipelinePdrn.sourceRows >= 6, 'PDRN/PN source list should keep product evidence and both PN/PDRN context sources', String(pipelinePdrn.sourceRows));
  assert(pipelinePdrn.overflowX <= 1, 'Pipeline PDRN view has horizontal overflow', String(pipelinePdrn.overflowX));

  await pipelinePage.locator('[data-track="ecm"]').click();
  await pipelinePage.waitForTimeout(250);
  const pipelineEcm = await pipelinePage.evaluate(() => {
    const projectText = document.querySelector('#projectBody')?.textContent || '';
    const rows = Array.from(document.querySelectorAll('#projectBody tr')).map((row) => row.textContent || '');
    return {
      projectText,
      baiyiyuanRows: rows.filter((text) => /白衣缘生物|康哲美丽/.test(text) && /脱细胞基质植入剂/.test(text)).length,
      baiyiyuanHasLatestStage: rows.some((text) => /白衣缘生物|康哲美丽/.test(text) && /脱细胞基质植入剂/.test(text) && /受理\/送达/.test(text)),
    };
  });
  assert(pipelineEcm.baiyiyuanRows === 1 && pipelineEcm.baiyiyuanHasLatestStage, 'Baiyiyuan ECM sources should merge into one latest-stage project row', JSON.stringify(pipelineEcm));
  assert(!/华清智美|SIS-ECM医美填充产品|平台\/资本线索/.test(pipelineEcm.projectText), 'ECM platform/media context should not render as active projects', pipelineEcm.projectText);

  await pipelinePage.locator('[data-track="silk"]').click();
  await pipelinePage.waitForTimeout(250);
  const pipelineSilkActiveText = await pipelinePage.evaluate(() => document.querySelector('#projectBody')?.textContent || '');
  assert(/VenuSilk|南京思元/.test(pipelineSilkActiveText), 'Silk active projects should keep verified clinical/company-source projects', pipelineSilkActiveText);
  assert(!/星月生物|复向医疗/.test(pipelineSilkActiveText), 'Silk A4/unverified leads should stay out of active project rows', pipelineSilkActiveText);

  await pipelinePage.locator('[data-track="collagen"]').click();
  await pipelinePage.waitForTimeout(250);
  const pipelineCollagen = await pipelinePage.evaluate(() => document.querySelector('#projectBody')?.textContent || '');
  assert(!/科媄氏|巨子生物|奇璞生物|创健医疗|已获批/.test(pipelineCollagen), 'Collagen active progress should exclude product-line notes and approved products', pipelineCollagen);

  await pipelinePage.locator('[data-track="botulinum"]').click();
  await pipelinePage.waitForTimeout(250);
  const pipelineBotulinum = await pipelinePage.evaluate(() => document.querySelector('#projectBody')?.textContent || '');
  assert(/DJ-01|DN001/.test(pipelineBotulinum), 'Botulinum active progress should retain clinical-stage tox projects', pipelineBotulinum);
  assert(!/HUTOX|芮妥欣|已获批/.test(pipelineBotulinum), 'Approved botulinum products should not remain in active registration progress', pipelineBotulinum);
  await pipelinePage.close();

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
  assert(filteredState.cert === '国药准字SJ20200016', 'Dysport certificate should use the corrected approval number', filteredState.cert);
  assert(filteredState.query === 'Dysport', 'Query parameter was not restored into the search input', filteredState.query);
  assert(filteredState.segment === 'botulinum', 'Segment parameter was not restored', filteredState.segment);
  assert(filteredState.origin === 'imported', 'Origin parameter was not restored', filteredState.origin);
  assert(filteredState.activeGrain === 'year', 'Trend grain parameter was not restored', filteredState.activeGrain);
  assert(filteredState.activeMap === 'registrations', 'Map metric parameter was not restored', filteredState.activeMap);
  await filteredPage.locator('#table-records tbody tr').first().click();
  await filteredPage.waitForTimeout(250);
  assert(await filteredPage.locator('.drawer.open').count() === 1, 'Record drawer did not open from filtered table');
  await filteredPage.close();

  const botulinumPage = await openCheckedPage(context, 'tracks/botulinum.html');
  const botulinumState = await botulinumPage.evaluate(() => {
    const cells = Array.from(document.querySelectorAll('#chart-co-in .matrix-cell')).map((cell) => {
      let records = [];
      try {
        records = JSON.parse(decodeURIComponent(cell.dataset.records || '[]'));
      } catch {
        records = [];
      }
      return {
        title: cell.dataset.title || '',
        text: cell.textContent?.trim() || '',
        records,
      };
    });
    const abbvieForehead = cells.find((cell) => /艾尔建|AbbVie/.test(cell.title) && /额纹/.test(cell.title));
    return {
      mainLabel: document.querySelector('#kpi-main')?.closest('.kpi')?.querySelector('.label')?.textContent?.trim() || '',
      mainValue: document.querySelector('#kpi-main')?.textContent?.trim() || '',
      mainUnit: document.querySelector('#kpi-main')?.closest('.kpi')?.querySelector('.unit')?.textContent?.trim() || '',
      mix: document.querySelector('#kpi-mix')?.textContent?.trim() || '',
      tableCount: document.querySelector('#records-count')?.textContent?.trim() || '',
      tableHeaders: Array.from(document.querySelectorAll('#table-records thead th')).map((node) => node.textContent?.trim() || ''),
      botoxRows: Array.from(document.querySelectorAll('#table-records tbody tr'))
        .filter((row) => /保妥适|Botox/i.test(row.textContent || ''))
        .map((row) => Array.from(row.cells).map((cell) => cell.textContent?.trim() || '')),
      abbvieForehead,
    };
  });
  assert(botulinumState.mainLabel === '核心产品', 'Botulinum main KPI should use product-group wording', botulinumState.mainLabel);
  assert(botulinumState.mainValue === '8' && botulinumState.mainUnit === '个', 'Botulinum main KPI should count eight product groups', `${botulinumState.mainValue}${botulinumState.mainUnit}`);
  assert(botulinumState.mix === '2 : 6 : 0', 'Botulinum origin mix should count product groups, not certificate rows', botulinumState.mix);
  assert(botulinumState.tableCount === '12', 'Botulinum detail table should include BOTOX certificate variants as separate registration rows', botulinumState.tableCount);
  assert(botulinumState.tableHeaders.join(',') === '品牌,产品 / 材料,注册人,证号,规格,产地,适应证,批准日,截止日,NMPA 核验状态', 'Botulinum table headers should expose specification and expiry date columns', botulinumState.tableHeaders.join(','));
  assert(botulinumState.botoxRows.length === 3 && botulinumState.botoxRows.every((row) => row.length === 10), 'BOTOX rows should render as ten-column registration rows', JSON.stringify(botulinumState.botoxRows));
  assert(botulinumState.botoxRows.some((row) => row.join(' ').includes('国药准字SJ20171004') && row.join(' ').includes('3支/盒') && row.join(' ').includes('2027-06-13')), 'BOTOX SJ20171004 row should expose package specification and expiry date', JSON.stringify(botulinumState.botoxRows));
  assert(botulinumState.abbvieForehead?.text === '1', 'AbbVie x forehead wrinkle matrix should show one BOTOX product group', botulinumState.abbvieForehead?.text || 'missing');
  assert(botulinumState.abbvieForehead?.records?.length === 1, 'AbbVie x forehead wrinkle drilldown should aggregate BOTOX certificates into one card', String(botulinumState.abbvieForehead?.records?.length || 0));
  const botoxMatrixRecord = botulinumState.abbvieForehead?.records?.[0] || {};
  assert(botoxCerts.every((cert) => String(botoxMatrixRecord.certificate_no || '').includes(cert)), 'BOTOX aggregated card should retain all approval numbers while grouping by product', botoxMatrixRecord.certificate_no || '');
  assert(/50单位\/支/.test(botoxMatrixRecord.specification || '') && /3支\/盒/.test(botoxMatrixRecord.specification || '') && /100单位\/支/.test(botoxMatrixRecord.specification || ''), 'BOTOX aggregated card should retain 50U, multi-pack, and 100U specifications', botoxMatrixRecord.specification || '');
  await botulinumPage.close();

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
    positionTags: Array.from(document.querySelectorAll('#table-records tbody .ha-position-tag')).map((node) => node.textContent?.trim() || ''),
    brandCells: Array.from(document.querySelectorAll('#table-records tbody tr td:first-child')).map((node) => node.textContent?.trim() || ''),
    lidocaineTags: Array.from(document.querySelectorAll('#table-records tbody .lidocaine-tag')).map((node) => node.textContent?.trim() || ''),
    urlPosition: new URL(location.href).searchParams.get('position') || '',
  }));
  const expectedHaCrosslinkedRecords = haPositionState.positionCards[0];
  const expectedHaLidocaineRecords = haPositionState.positionCards[2];
  const expectedHaNonLidocaineRecords = haPositionState.positionCards[3];
  assert(expectedHaCrosslinkedRecords > 0, 'HA crosslinked filler card should show a positive official-registration scope', String(expectedHaCrosslinkedRecords));
  assert(expectedHaLidocaineRecords > 0, 'HA lidocaine card should show a positive official-registration scope', String(expectedHaLidocaineRecords));
  assert(expectedHaNonLidocaineRecords > 0, 'HA non-lidocaine card should show a positive official-registration scope', String(expectedHaNonLidocaineRecords));
  assert(expectedHaLidocaineRecords + expectedHaNonLidocaineRecords === expectedHaCrosslinkedRecords, 'HA lidocaine split should add up to the crosslinked filler scope', haPositionState.positionCards.join(', '));
  assert(!/口径|主格局|不代表销量|商业份额/.test(haPositionState.note), 'HA positioning note should avoid backend or caveat copy', haPositionState.note);
  assert(haPositionState.note.includes('型号规格和结构组成为准'), 'HA positioning note should explain the official registration component scope');
  assert(haPositionState.regionCharts >= 2, 'HA positioning charts did not render');
  assert(haPositionState.rows === 14, 'HA Korean lidocaine filter should show 14 rows after official component verification', String(haPositionState.rows));
  assert(haPositionState.count === '14', 'HA filtered record count label is wrong', haPositionState.count);
  assert(haPositionState.shape === '交联填充类', 'HA shape filter was not restored', haPositionState.shape);
  assert(haPositionState.position === '韩国进口', 'HA position filter was not restored', haPositionState.position);
  assert(haPositionState.lidocaine === 'yes', 'HA lidocaine filter was not restored', haPositionState.lidocaine);
  assert(haPositionState.urlPosition === '韩国进口', 'HA filter state should remain shareable in the URL', haPositionState.urlPosition);
  assert(haPositionState.positionTags.length === 0, 'HA table rows should not duplicate origin/position inside product-material tags', haPositionState.positionTags.join(', '));
  assert(haPositionState.brandCells.every((text) => !/注射用|透明质酸钠|凝胶|溶液/.test(text)), 'HA brand cells should not echo generic registration product names', haPositionState.brandCells.join(', '));
  assert(haPositionState.lidocaineTags.length === 14 && haPositionState.lidocaineTags.every((tag) => tag === '含利多卡因'), 'HA filtered rows should all carry unified lidocaine tags', haPositionState.lidocaineTags.join(', '));
  await haPositionPage.close();

  const haTimelinePage = await openCheckedPage(context, 'tracks/ha.html');
  await clickTimelineYear(haTimelinePage, 2026);
  const haTimelineDrawer = await haTimelinePage.evaluate(() => ({
    text: document.querySelector('.drawer.open')?.textContent || '',
    rows: document.querySelectorAll('.drawer.open .record-card').length,
    pendingData: window.echarts.getInstanceByDom(document.getElementById('chart-timeline'))?.getOption().series
      ?.find((series) => series.name === '待复核/底层')?.data || [],
  }));
  assert(haTimelineDrawer.pendingData.some((value) => Number(value) >= 1), 'HA timeline should show pending leads in the stacked annual bar', JSON.stringify(haTimelineDrawer.pendingData));
  assert(haTimelineDrawer.text.includes('核心清单'), 'HA 2026 drilldown should explain the core registration list', haTimelineDrawer.text);
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
  const collagenHasPendingTimeline = collagenTimelineDrawer.pendingData.some((value) => Number(value) >= 1);
  if (collagenHasPendingTimeline) {
    assert(/核心清单 \d+ 张 \+ 待复核 \d+ 张/.test(collagenTimelineDrawer.text), 'Collagen 2026 drilldown should explain main vs pending counts when pending rows exist', collagenTimelineDrawer.text);
  } else {
    assert(collagenTimelineDrawer.text.includes('核心清单') && !collagenTimelineDrawer.text.includes('待复核'), 'Collagen 2026 drilldown should stay on the core-list wording when no pending rows exist', collagenTimelineDrawer.text);
  }
  assert(collagenTimelineDrawer.text.includes('交联重组胶原蛋白植入剂') && collagenTimelineDrawer.text.includes('巨子生物'), 'Collagen 2026 drilldown should include the Giant Biogene certificate', collagenTimelineDrawer.text);
  assert(collagenTimelineDrawer.text.includes('国械注准20263131219'), 'Collagen 2026 drilldown should include the Giant Biogene certificate number', collagenTimelineDrawer.text);
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
  assert(pivotState.records === String(expectedHaCrosslinkedRecords), 'Pivot default scope should match HA crosslinked records', `${pivotState.records} !== ${expectedHaCrosslinkedRecords}`);
  assert(pivotState.rowChips.includes('利多卡因状态'), 'Pivot default row dimension should be lidocaine status', pivotState.rowChips.join(', '));
  assert(pivotState.columnChips.includes('定位层级'), 'Pivot default column dimension should be positioning tier', pivotState.columnChips.join(', '));
  assert(pivotState.filters.includes('透明质酸钠') && pivotState.filters.includes('交联填充类'), 'Pivot default filters should target HA crosslinked fillers', pivotState.filters.join(', '));
  assert(pivotState.chartCanvases >= 1, 'Pivot chart did not render');
  assert(pivotState.resizers >= 3, 'Pivot table should expose column resize handles', String(pivotState.resizers));
  assert(pivotState.cellTitles.some((title) => title.includes('含利多卡因 × 韩国进口：14')), 'Pivot should show 14 Korean lidocaine records after official component verification', pivotState.cellTitles.join(' | '));
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
  assert(lipPivotState.records === String(expectedHaLidocaineRecords), 'Lip indication pivot should stay within HA lidocaine crosslinked records', `${lipPivotState.records} !== ${expectedHaLidocaineRecords}`);
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
