/* Per-track page wiring. Reads ?track=<key> or window.TRACK_KEY. */

(async function init() {
  const {
    palette,
    SERIES_COLORS,
    ChartFactory,
    showRecords,
    escape,
    loadJSON,
    watchKpis,
    mixColor,
    crystalCssHeatVars,
    crystalEchartHeatItemStyle,
    crystalHeatLabelColor,
  } = window.RI;

  const key = (new URLSearchParams(location.search).get('track')) || window.TRACK_KEY;
  if (!key) return;

  const data = await loadJSON(`../assets/data/tracks/${key}.json`);
  const meta = data.track_meta;
  const trackDisplayName = displayUiLabel(meta.name);
  const isHaTrack = key === 'ha';
  const isCollagenTrack = key === 'collagen';
  const isEbdTrack = key === 'ebd';
  const isBotulinumTrack = key === 'botulinum';
  const SUBMENTAL_LIPOLYSIS_INDICATION = '颏下脂肪堆积（双下巴）';
  const JAW_CHIN_CONTOUR_FILLING_INDICATION = '下颌及颏部轮廓改善（填充）';
  const ebdEnergyOrder = ['射频', '超声', '激光 / IPL', '其他能量'];
  const ebdSubtypeOrder = ['射频皮肤治疗', '射频塑形', '单极射频', '射频微针', '聚焦超声', '皮秒激光', '其他设备'];
  const chartBarMaxWidth = 26;
  const chartBarRadius = [6, 6, 0, 0];
  const verticalGradient = (topColor, bottomColor) => new echarts.graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color: topColor },
    { offset: 1, color: bottomColor },
  ]);
  const TRACK_ACCENTS = {
    ha: '#58bfd7',
    botulinum: '#737ed0',
    collagen: '#dd7b8b',
    plla: '#9daaf0',
    pcl: '#e5b574',
    caha: '#b486d4',
    niche_materials: '#cf6a9d',
    ebd: '#8fa8c8',
  };
  const TRACK_ACCENT_DEEP = {
    ha: '#409fbb',
    botulinum: '#5d65b8',
    collagen: '#c25f71',
    plla: '#7d8fe0',
    pcl: '#c8944d',
    caha: '#9566b9',
    niche_materials: '#b94d84',
    ebd: '#6f8bad',
  };
  const accent = TRACK_ACCENTS[key] || meta.accent || palette.brand;
  const accentDeep = TRACK_ACCENT_DEEP[key] || palette.ink3;
  const mainBarGradient = () => verticalGradient(shade(accent, 18), accent);
  const pendingBarGradient = () => verticalGradient('#f2d8a7', '#e0b66d');
  document.title = `${trackDisplayName} · Registration Landscape`;

  // Tint the header dot to track accent
  const dot = document.querySelector('.topbar .brand .dot');
  if (dot && accent) {
    dot.style.background = `linear-gradient(135deg, ${accent} 0%, ${accentDeep} 100%)`;
    dot.style.boxShadow = `0 4px 12px ${accent}55`;
  }

  // Hero
  document.getElementById('track-name').textContent = trackDisplayName;
  const trackTagline = document.getElementById('track-tagline');
  if (trackTagline) trackTagline.remove();
  const heroAccent = document.getElementById('track-accent');
  if (heroAccent) {
    heroAccent.style.background = `linear-gradient(96deg, ${accent} 0%, ${accentDeep} 100%)`;
    heroAccent.style.color = '#fffaf5';
  }
  const heroH1 = document.getElementById('track-h1');
  if (heroH1) {
    const grad = heroH1.querySelector('.gradient');
    if (grad) {
      grad.style.background = `linear-gradient(96deg, ${accentDeep} 0%, ${accent} 100%)`;
      grad.style.backgroundClip = 'text';
      grad.style.webkitBackgroundClip = 'text';
      grad.style.color = 'transparent';
      grad.style.webkitTextFillColor = 'transparent';
    }
  }

  const landscapeRecords = data.records.filter((record) => record.main_landscape);
  const kpiRecords = landscapeRecords.length ? landscapeRecords : data.records;
  const kpiDisplayRecords = analysisRecords(kpiRecords);
  const originCounts = originAnalysisCounts(kpiRecords);

  // KPIs
  if (isBotulinumTrack) {
    const mainKpi = document.getElementById('kpi-main')?.closest('.kpi');
    const mainLabel = mainKpi?.querySelector('.label');
    const mainUnit = mainKpi?.querySelector('.unit');
    if (mainLabel) mainLabel.textContent = '核心产品';
    if (mainUnit) mainUnit.textContent = '个';
  }
  setKpi('kpi-main', kpiDisplayRecords.length || data.kpi.total);
  setKpi('kpi-companies', unique(kpiRecords.map((record) => record.company)).length || data.kpi.companies);
  setKpi('kpi-indications', unique(kpiRecords.flatMap(indicationValues)).length || data.kpi.indications);
  setKpi('kpi-forms', unique(kpiRecords.map((record) => (isHaTrack || isEbdTrack) ? productShape(record) : record.material_form)).length);
  setKpi('kpi-verified', kpiDisplayRecords.filter((record) => record.verified).length || data.kpi.verified);
  const totalDelta = document.getElementById('kpi-total')?.closest('.delta');
  if (totalDelta) totalDelta.remove();
  const verifiedDelta = document.getElementById('kpi-verified')?.closest('.delta');
  if (verifiedDelta) verifiedDelta.remove();
  document.getElementById('kpi-mix').textContent = `${originCounts.get('国产') || 0} : ${originCounts.get('进口') || 0} : ${originCounts.get('港澳台') || 0}`;
  watchKpis();

  // Company share — horizontal bar
  renderCompanyShare(data.company_share, data.long_tail_company_count);

  // Indication intensity list (one row per indication, hover shows products)
  renderIntensityList('chart-indications', data.records, 'primary_indication');

  // Origin donut (3 categories — donut is the right shape here)
  renderDonut('chart-origin', isBotulinumTrack
    ? ['国产', '进口', '港澳台'].map((name) => ({ name, value: originCounts.get(name) || 0 }))
    : data.origin_share,
  '产地结构');

  // Material intensity list
  renderIntensityList('chart-material', data.records, 'material_family');
  renderIntensityList('chart-collagen-source', data.records, 'collagen_source');
  renderEbdEnergyList('chart-ebd-energy-types', data.records);

  // Fusion modules: Claude layout, Codex analytical content.
  renderProductShapeList('chart-product-forms', data.records);
  renderMarketScopeCards(data.records);
  renderHaPositioning(data.records);

  // Timeline
  renderTimeline(data.timeline);
  renderOriginEvolution(data.records);

  // Company × indication heatmap
  renderCompanyHeatmap(buildCompanyIndicationHeatmap(data.records));

  // Product shape × indication matrix
  renderProductShapeIndicationMatrix(data.records);

  // Company capability matrix
  renderCompanyMatrixList(data.records);

  // Approval event list
  renderApprovalEvents(data.records, data.approval_events || data.approvalEvents || []);

  // Records list
  renderRecords(data.records);

  // ---- helpers ----

  function setKpi(id, to) {
    const el = document.getElementById(id);
    if (!el) return;
    el.dataset.animateTo = to;
    // watchKpis() paints final value first; animation overlays on intersect.
  }

  function botulinumProductKey(record) {
    if (!record) return '';
    return [
      record.brand,
      record.company,
      record.registrant,
      record.product_name || record.official_product_name,
    ]
      .filter(Boolean)
      .join('|')
      .toLowerCase()
      .replace(/\s+/g, '');
  }

  function botulinumProductRecords(records) {
    if (!isBotulinumTrack) return records || [];
    const groups = new Map();
    (records || []).forEach((record) => {
      const productKey = botulinumProductKey(record) || record.id || record.certificate_no;
      if (!groups.has(productKey)) groups.set(productKey, []);
      groups.get(productKey).push(record);
    });
    return [...groups.values()].map((items) => {
      const first = items[0] || {};
      const certs = unique(items.map((item) => item.certificate_no));
      const specs = unique(items.map((item) => item.specification));
      const validUntil = unique(items.map((item) => item.valid_until || item.official_valid_until));
      const approvalDates = unique(items.map((item) => item.official_approval_date || item.approval_date));
      const indications = unique(items.flatMap(indicationValues));
      const tags = unique([
        first.material_form,
        first.origin,
        items.length > 1 ? `${items.length}张批准文号` : '',
      ]);
      return {
        ...first,
        id: `botulinum-product-${botulinumProductKey(first) || first.id || first.certificate_no}`,
        certificate_no: certs.join(' / '),
        specification: specs.join('；') || first.specification,
        valid_until: validUntil.join(' / ') || first.valid_until,
        approval_date: approvalDates.join(' / ') || first.approval_date,
        approved_indications: indications.join(' / '),
        official_indication: indications.join(' / '),
        primary_indication: indications.join(' / '),
        tags,
        market_note: first.market_note || `${certs.length} 张批准文号按同一品牌产品组展示。`,
        _certificate_count: items.length,
      };
    });
  }

  function analysisRecords(records) {
    return isBotulinumTrack ? botulinumProductRecords(records) : (records || []);
  }

  function analysisCount(records) {
    return analysisRecords(records).length;
  }

  function analysisUnit() {
    return isBotulinumTrack ? '个产品' : '张证';
  }

  function originAnalysisCounts(records) {
    return countBy(analysisRecords(records), (record) => record.origin);
  }

  function indicationAnalysisCounts(records) {
    if (!isBotulinumTrack) return countBy(records.flatMap(indicationValues), (name) => name);
    const buckets = new Map();
    (records || []).forEach((record) => {
      const productKey = botulinumProductKey(record) || record.id || record.certificate_no;
      indicationValues(record).forEach((indication) => {
        if (!buckets.has(indication)) buckets.set(indication, new Set());
        buckets.get(indication).add(productKey);
      });
    });
    return new Map([...buckets.entries()].map(([name, productKeys]) => [name, productKeys.size]));
  }

  function renderCompanyShare(items, longTail) {
    const el = document.getElementById('chart-companies');
    if (!el) return;
    const chartItems = isBotulinumTrack
      ? [...groupRecords(analysisRecords(data.records.filter((record) => record.main_landscape)), (record) => record.company || '未标注厂家').entries()]
        .map(([name, records]) => ({ name, value: records.length }))
        .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'zh-CN'))
        .slice(0, 12)
      : items;
    const valueUnit = analysisUnit();
    const inst = ChartFactory.make(el, {
      grid: { left: 130, right: 36, top: 12, bottom: 18 },
      tooltip: {
        formatter: (p) => `<b>${escape(p.name)}</b><br/>${p.value} ${valueUnit} (${(p.value / sum(chartItems) * 100).toFixed(1)}%)`,
      },
      xAxis: { type: 'value', splitLine: { lineStyle: { color: palette.hairline, type: 'dashed' } } },
      yAxis: {
        type: 'category', data: chartItems.map((i) => i.name).reverse(),
        axisLabel: {
          color: palette.ink, fontSize: 12,
          formatter: (v) => v.length > 14 ? v.slice(0, 14) + '…' : v,
        },
      },
      series: [{
        type: 'bar', barMaxWidth: 22,
        data: chartItems.map((i) => ({
          value: i.value, name: i.name,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
              { offset: 0, color: shade(accent, 14) },
              { offset: 1, color: shade(accent, -10) },
            ]),
            borderRadius: [0, 6, 6, 0],
          },
        })).reverse(),
        label: {
          show: true, position: 'right', color: palette.ink2,
          fontSize: 11.5, fontWeight: 600,
        },
        animationDuration: 800, animationEasing: 'cubicOut',
      }],
    });
    inst.on('click', (p) => {
      const matches = data.records.filter((r) => r.main_landscape && r.company === p.name);
      showRecords({ title: `${p.name} · ${trackDisplayName}`, meta: '核心清单', records: displayRecords(matches) });
    });
    if (longTail > 0) {
      const tailNote = document.getElementById('long-tail-note') || document.querySelector('[data-company-tail]');
      if (tailNote) tailNote.textContent = `… 另有 ${longTail} 家长尾注册企业未进入 Top 12`;
    }
  }

  function renderIntensityList(elId, allRecords, categoryKey) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.classList.add('as-list');
    el.innerHTML = '';

    const records = allRecords.filter((r) => {
      if (!r.main_landscape) return false;
      if (categoryKey === 'primary_indication') return indicationValues(r).length > 0;
      if (categoryKey === 'collagen_source') return Boolean(collagenSourceTag(r));
      return Boolean(r[categoryKey]);
    });
    if (!records.length) {
      el.innerHTML = '<div class="muted" style="text-align:center;padding:40px">暂无该维度数据</div>';
      return;
    }

    const groups = new Map();
    records.forEach((r) => {
      const keys = categoryKey === 'primary_indication'
        ? indicationValues(r)
        : categoryKey === 'collagen_source'
          ? [collagenSourceTag(r)]
          : [r[categoryKey]];
      unique(keys).forEach((k) => {
        if (!k) return;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(r);
      });
    });
    const sorted = [...groups.entries()].sort((a, b) =>
      analysisCount(b[1]) - analysisCount(a[1])
      || String(a[0]).localeCompare(String(b[0]), 'zh-CN')
    );
    const max = analysisCount(sorted[0][1]);

    const list = document.createElement('div');
    list.className = 'intensity-list';

    sorted.forEach(([cat, recs], idx) => {
      const count = analysisCount(recs);
      const displayRecs = displayRecords(recs);
      const ratio = count / max;
      const widthPct = Math.max(8, ratio * 100);
      // Light end (low count) → soft tint of accent; high count → deep accent.
      const startColor = shade(accent, 28);
      const endColor = shade(accent, -10 - ratio * 18);
      const isLight = ratio < 0.18;  // light bars get dark text

      const row = document.createElement('div');
      row.className = 'intensity-row';
      row.innerHTML = `
        <div class="intensity-label" title="${escape(displayUiLabel(cat))}">${escape(displayUiLabel(cat))}</div>
        <div class="intensity-track">
          <div class="intensity-bar ${isLight ? 'light' : ''}"
               style="width:${widthPct}%; background: linear-gradient(90deg, ${startColor}, ${endColor}); animation-delay:${idx * 35}ms">
            ${count}
          </div>
        </div>
      `;
      attachIntensityTooltip(row, cat, displayRecs);
      row.addEventListener('click', () => {
        window.RI.showRecords({
          title: displayUiLabel(cat),
          meta: `${trackDisplayName} · ${categoryKey === 'primary_indication' ? '适应证 / 部位' : '材料家族'}`,
          records: displayRecs,
        });
      });
      list.appendChild(row);
    });
    el.appendChild(list);
  }

  // Singleton tooltip element reused across all rows.
  let _tipEl = null;
  function getTip() {
    if (_tipEl) return _tipEl;
    _tipEl = document.createElement('div');
    _tipEl.className = 'intensity-tip';
    document.body.appendChild(_tipEl);
    return _tipEl;
  }

  function attachIntensityTooltip(row, cat, recs) {
    function show() {
      const tip = getTip();
      const items = recs.slice(0, 10).map((r) => {
        const cert = r.certificate_no
          ? `<span class="t-cert">${escape(r.certificate_no)}</span>` : '';
        return `<li>
          <span class="t-co">${escape(r.company || '—')}</span>
          <span class="t-prod">${escape(r.brand || r.product_name || '—')}</span>
          ${cert}
        </li>`;
      }).join('');
      const more = recs.length > 10
        ? `<div class="t-more">… 另 ${recs.length - 10} ${isBotulinumTrack ? '个' : '条'} (点击查看全部)</div>` : '';
      tip.innerHTML = `
        <div class="t-head">
          <strong>${escape(displayUiLabel(cat))}</strong>
          <span class="t-count">${recs.length} ${analysisUnit()}</span>
        </div>
        <ul>${items}</ul>
        ${more}
      `;
      // Position next to row, flip side if it would overflow viewport
      const rect = row.getBoundingClientRect();
      tip.style.visibility = 'hidden';
      tip.classList.add('visible');
      const tipRect = tip.getBoundingClientRect();
      let left = rect.right + 12;
      if (left + tipRect.width > window.innerWidth - 12) {
        left = rect.left - tipRect.width - 12;
      }
      let top = rect.top + rect.height / 2 - tipRect.height / 2;
      top = Math.max(12, Math.min(top, window.innerHeight - tipRect.height - 12));
      tip.style.left = `${Math.max(12, left)}px`;
      tip.style.top = `${top}px`;
      tip.style.visibility = '';
    }
    function hide() { if (_tipEl) _tipEl.classList.remove('visible'); }
    row.addEventListener('mouseenter', show);
    row.addEventListener('mouseleave', hide);
  }

  function ebdText(record) {
    return [
      record?.product_name,
      record?.official_product_name,
      record?.category,
      record?.track_name,
      record?.material_family,
      record?.material_form,
      ...(Array.isArray(record?.tags) ? record.tags : []),
    ].filter(Boolean).join(' ');
  }

  function ebdEnergyType(record) {
    const text = ebdText(record);
    if (/超声|HIFU|聚焦/.test(text)) return '超声';
    if (/激光|IPL|皮秒|Nd:YAG|光子/.test(text)) return '激光 / IPL';
    if (/射频|Thermage|热玛吉|微针|黄金微针/.test(text)) return '射频';
    return '其他能量';
  }

  function ebdDeviceSubtype(record) {
    const text = ebdText(record);
    if (/射频微针|黄金微针|Electrosurgical Unit|微针治疗仪/.test(text)) return '射频微针';
    if (/Thermage|热玛吉|单极射频/.test(text)) return '单极射频';
    if (/射频塑形|吸脂术前脂肪软化/.test(text)) return '射频塑形';
    if (/聚焦超声|超声皮肤治疗/.test(text)) return '聚焦超声';
    if (/皮秒|Nd:YAG|文身祛除/.test(text)) return '皮秒激光';
    if (/射频皮肤治疗|射频设备|射频治疗仪/.test(text)) return '射频皮肤治疗';
    return displayUiLabel(record?.category || record?.track_name || '其他设备');
  }

  function ebdSubtypeLabel(record) {
    return `${ebdEnergyType(record)}｜${ebdDeviceSubtype(record)}`;
  }

  function ebdCleanMaterialLabel(record) {
    return ebdSubtypeLabel(record);
  }

  function productShape(record) {
    if (isEbdTrack) return ebdSubtypeLabel(record);
    if (!isHaTrack) return displayUiLabel(record?.material_form || record?.material_family || '未分型');
    const text = `${record?.material_form || ''} ${record?.product_name || ''} ${record?.material_family || ''}`;
    if (/复合溶液|水光|肤质|非交联HA溶液|透明质酸钠溶液/.test(text)) return '非交联水光、肤质改善类';
    return '交联填充类';
  }

  function productShapeSortValue(name) {
    if (isEbdTrack) {
      const subtype = String(name || '').split('｜').pop();
      const index = ebdSubtypeOrder.indexOf(subtype);
      return index === -1 ? 99 : index;
    }
    const order = ['交联填充类', '非交联水光、肤质改善类'];
    const index = order.indexOf(name);
    return index === -1 ? 99 : index;
  }

  function productShapeScopeLabel(name) {
    if (name === '交联填充类') return '填充';
    if (name === '非交联水光、肤质改善类') return '水光/肤质';
    return name.replace('类', '');
  }

  function productShapeGroups(source) {
    const groups = new Map();
    source.filter((record) => record.main_landscape).forEach((record) => {
      const shape = productShape(record);
      if (!groups.has(shape)) groups.set(shape, []);
      groups.get(shape).push(record);
    });
    return [...groups.entries()]
      .map(([name, records]) => ({ name, records, count: records.length }))
      .sort((a, b) => productShapeSortValue(a.name) - productShapeSortValue(b.name) || b.count - a.count);
  }

  function renderEbdEnergyList(elId, source) {
    const el = document.getElementById(elId);
    if (!el) return;
    const landscape = source.filter((record) => record.main_landscape);
    const groups = new Map();
    landscape.forEach((record) => {
      const energy = ebdEnergyType(record);
      if (!groups.has(energy)) groups.set(energy, []);
      groups.get(energy).push(record);
    });
    const rows = [...groups.entries()]
      .map(([name, records]) => ({
        name,
        records,
        count: records.length,
        subtypes: unique(records.map(ebdDeviceSubtype)),
      }))
      .sort((a, b) =>
        ebdEnergyOrder.indexOf(a.name) - ebdEnergyOrder.indexOf(b.name)
        || b.count - a.count
        || a.name.localeCompare(b.name, 'zh-CN')
      );
    if (!rows.length) {
      el.innerHTML = '<div class="muted" style="text-align:center;padding:40px">暂无能量源数据</div>';
      return;
    }
    const max = Math.max(1, ...rows.map((row) => row.count));
    el.classList.add('as-list');
    el.innerHTML = `
      <div class="product-shape-list ebd-energy-list">
        ${rows.map((row, index) => {
          const width = Math.max(8, (row.count / max) * 100);
          const detail = row.subtypes.join(' / ');
          const barStart = shade(accent, 30);
          const barEnd = shade(accent, -18);
          const payload = encodeURIComponent(JSON.stringify(displayRecords(row.records)));
          return `
            <button class="product-shape-row" type="button" data-records="${payload}" data-shape="${escape(row.name)}" style="--bar-width:${width}%;--delay:${index * 50}ms;--shape-bar-bg:linear-gradient(90deg, ${barStart}, ${barEnd});--shape-count-color:${barEnd}">
              <span class="shape-main">
                <strong>${escape(row.name)}</strong>
                <em>${escape(detail)}</em>
              </span>
              <span class="shape-count"><b>${row.count}</b><small>张</small></span>
              <span class="shape-track"><i></i></span>
            </button>
          `;
        }).join('')}
      </div>
    `;
    el.querySelectorAll('[data-records]').forEach((row) => {
      row.addEventListener('click', () => {
        const records = JSON.parse(decodeURIComponent(row.dataset.records || '[]'));
        showRecords({ title: row.dataset.shape || '能量源', meta: `${trackDisplayName} · 能量源结构`, records });
      });
    });
  }

  function renderProductShapeList(elId, source) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (key === 'plla') {
      renderPlaProductShapeList(el, source);
      return;
    }
    const groups = productShapeGroups(source);
    if (!groups.length) {
      el.innerHTML = '<div class="muted" style="text-align:center;padding:40px">暂无产品形态数据</div>';
      return;
    }
    const max = Math.max(1, ...groups.map((group) => group.count));
    el.classList.add('as-list');
    el.innerHTML = `
      <div class="product-shape-list">
        ${groups
          .map((group, index) => {
            const width = Math.max(7, (group.count / max) * 100);
            const forms = unique(group.records.map((record) => record.material_form)).slice(0, 4).map(displayUiLabel).join(' / ');
            const detail = forms && forms !== group.name ? `<em>${escape(forms)}</em>` : '';
            const barStart = shade(accent, 28);
            const barEnd = shade(accent, -12);
            return `
              <button class="product-shape-row" type="button" data-shape="${escape(group.name)}" style="--bar-width:${width}%;--delay:${index * 50}ms;--shape-bar-bg:linear-gradient(90deg, ${barStart}, ${barEnd});--shape-count-color:${barEnd}">
                <span class="shape-main">
                  <strong>${escape(group.name)}</strong>
                  ${detail}
                </span>
                <span class="shape-count">${group.count}<small>张</small></span>
                <span class="shape-track"><i></i></span>
              </button>
            `;
          })
          .join('')}
      </div>
    `;
    el.querySelectorAll('[data-shape]').forEach((row) => {
      row.addEventListener('click', () => {
        const group = groups.find((item) => item.name === row.dataset.shape);
        if (group) showRecords({ title: group.name, meta: `${trackDisplayName} · 产品形态`, records: displayRecords(group.records) });
      });
    });
  }

  function renderPlaProductShapeList(el, source) {
    const records = source.filter((record) => record.main_landscape);
    if (!records.length) {
      el.innerHTML = '<div class="muted" style="text-align:center;padding:40px">暂无产品形态数据</div>';
      return;
    }

    const familyMap = new Map();
    records.forEach((record) => {
      const family = displayUiLabel(record.material_family || '未分型');
      const form = displayUiLabel(record.material_form || family);
      if (!familyMap.has(family)) familyMap.set(family, { family, records: [], forms: new Map() });
      const familyGroup = familyMap.get(family);
      familyGroup.records.push(record);
      if (!familyGroup.forms.has(form)) familyGroup.forms.set(form, []);
      familyGroup.forms.get(form).push(record);
    });

    const familyOrder = ['PLLA', 'PDLLA'];
    const groups = [...familyMap.values()]
      .map((group) => ({
        ...group,
        forms: [...group.forms.entries()]
          .map(([name, formRecords]) => ({ name, records: formRecords }))
          .sort((a, b) => b.records.length - a.records.length || a.name.localeCompare(b.name, 'zh-CN')),
      }))
      .sort((a, b) => {
        const ai = familyOrder.indexOf(a.family);
        const bi = familyOrder.indexOf(b.family);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
          || b.records.length - a.records.length
          || a.family.localeCompare(b.family, 'zh-CN');
      });

    const max = Math.max(1, ...groups.map((group) => group.records.length));
    const barStart = shade(accent, 30);
    const barEnd = shade(accent, -12);
    el.classList.add('as-list');
    el.innerHTML = `
      <div class="pla-taxonomy-list">
        ${groups.map((group, groupIndex) => {
          const familyWidth = Math.max(8, (group.records.length / max) * 100);
          return `
            <div class="pla-taxonomy-group" style="--delay:${groupIndex * 45}ms">
              <button class="product-shape-row pla-family-row" type="button" data-family="${escape(group.family)}" style="--bar-width:${familyWidth}%;--shape-bar-bg:linear-gradient(90deg, ${barStart}, ${barEnd});--shape-count-color:${barEnd}">
                <span class="shape-main">
                  <strong>${escape(group.family)}</strong>
                  <em>${group.forms.length} 个产品形态小类</em>
                </span>
                <span class="shape-count">${group.records.length}<small>张</small></span>
                <span class="shape-track"><i></i></span>
              </button>
              <div class="pla-subshape-list">
                ${group.forms.map((form, formIndex) => {
                  const formWidth = Math.max(10, (form.records.length / group.records.length) * 100);
                  const formStart = shade(accent, 42);
                  const formEnd = shade(accent, -4);
                  return `
                    <button class="pla-subshape-row" type="button" data-family="${escape(group.family)}" data-form="${escape(form.name)}" style="--bar-width:${formWidth}%;--delay:${groupIndex * 45 + formIndex * 28}ms;--shape-bar-bg:linear-gradient(90deg, ${formStart}, ${formEnd});--shape-count-color:${formEnd}">
                      <span class="shape-main">
                        <strong>${escape(form.name)}</strong>
                      </span>
                      <span class="shape-count">${form.records.length}<small>张</small></span>
                      <span class="shape-track"><i></i></span>
                    </button>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    el.querySelectorAll('[data-family]').forEach((row) => {
      row.addEventListener('click', () => {
        const group = groups.find((item) => item.family === row.dataset.family);
        if (!group) return;
        const formName = row.dataset.form;
        const form = formName ? group.forms.find((item) => item.name === formName) : null;
        const title = form ? form.name : group.family;
        const recordsForRow = form ? form.records : group.records;
        showRecords({ title, meta: `${trackDisplayName} · 产品形态分类`, records: displayRecords(recordsForRow) });
      });
    });
  }

  function renderMarketScopeCards(source) {
    const holder = document.getElementById('ha-scope-cards');
    if (!holder) return;
    const landscape = source.filter((record) => record.main_landscape);
    const groups = productShapeGroups(landscape);
    const lidocaineRecords = landscape.filter(hasLidocaineAdvantage);
    const cards = [
      ...groups.map((group) => ({
        label: productShapeScopeLabel(group.name),
        title: group.name,
        count: group.count,
        records: group.records,
      })),
      {
        label: '核心清单',
        title: '含利多卡因',
        count: lidocaineRecords.length,
        records: lidocaineRecords,
        kind: 'advantage',
      },
    ];
    holder.innerHTML = cards
      .map(
        (card, index) => `
          <button class="ha-scope-card${card.kind === 'advantage' ? ' advantage' : ''}" type="button" data-index="${index}">
            <span>${escape(card.label)}</span>
            <strong>${escape(card.title)}</strong>
            <b>${card.count}<em>张</em></b>
          </button>
        `
      )
      .join('');
    holder.querySelectorAll('[data-index]').forEach((cardEl) => {
      cardEl.addEventListener('click', () => {
        const card = cards[Number(cardEl.dataset.index)];
        if (card) showRecords({ title: card.title, meta: `${trackDisplayName} · 市场清单`, records: displayRecords(card.records) });
      });
    });
  }

  function hasLidocaineAdvantage(record) {
    return haLidocaineSignal(record).hasLidocaine;
  }

  function haCrosslinkedFillerRecords(source) {
    if (!isHaTrack) return [];
    return source.filter((record) => record.main_landscape && productShape(record) === '交联填充类');
  }

  function haRecordText(record) {
    return [
      record?.company,
      record?.registrant,
      record?.official_registrant,
      record?.manufacturer_group,
      record?.brand,
      record?.aliases,
      record?.product_name,
      record?.official_product_name,
      Array.isArray(record?.tags) ? record.tags.join(' ') : record?.tags,
      Array.isArray(record?.product_tags) ? record.product_tags.join(' ') : record?.product_tags,
    ].filter(Boolean).join(' ');
  }

  function haPositionOrder() {
    return ['国产', '欧美进口', '韩国进口', '港澳台', '其他进口'];
  }

  function haPositionLabel(record) {
    const origin = record?.origin || '';
    const text = haRecordText(record);
    if (origin === '国产') return '国产';
    if (origin === '港澳台') return '港澳台';
    if (/(韩国|Korea|Korean|LG Chem|LG Life Sciences|YVOIRE|Y-Solution|LYV Sciences|俪维美学|爱尔集健|乐金科技|CHA Meditech|Forest Hills|Dong Bang|ACROSS|GENOSS|JETEMA|Humedix|CG Bio|YooYoung|SCL|BNC|Cutegel|HyaFilia|Dermalax|MONALISA|A-Viearchee|东方医疗|东邦医疗|吉诺斯|汇美迪斯|细基生物|柳英|捷特玛|爱思尔|亚可罗思)/i.test(text)) {
      return '韩国进口';
    }
    if (/(AbbVie|Allergan|Juv[eé]derm|Galderma|Q-Med|Restylane|Merz|Belotero|Anteis|CROMA|Princess|Kylane|SYMATESE|PRECISE|Adoderm|Hyabell|VIVACY|Laboratoires|Fill-Med|S&V|GmbH|SA|SAS|瑞士|法国|德国|奥地利|美国|高德美|艾尔建|麦施美学|安缇思|克罗玛|基兰|希玛德|艾多德姆|菲欧曼|维瓦希)/i.test(text)) {
      return '欧美进口';
    }
    return origin === '进口' ? '其他进口' : (origin || '未标注');
  }

  function haRegionLabel(record) {
    const position = haPositionLabel(record);
    if (position === '国产') return '中国大陆';
    if (position === '韩国进口') return '韩国';
    if (position === '欧美进口') return '欧美';
    if (position === '港澳台') return '中国台湾/港澳台';
    return position;
  }

  function haPositionColor(name) {
    return {
      国产: '#58bfd7',
      欧美进口: '#737ed0',
      韩国进口: '#e5b574',
      港澳台: '#cf6a9d',
      其他进口: '#9d7b7b',
      未见利多卡因: '#d8cfca',
      含利多卡因: '#58bfd7',
    }[name] || accent;
  }

  function haLidocaineSignal(record) {
    const titleText = [
      record?.brand,
      record?.aliases,
      record?.commercial_name,
      record?.product_name,
      record?.official_product_name,
      record?.specification,
      record?.components,
    ].filter(Boolean).join(' ');
    const hasLidocaine = record?.lidocaine_status === '含利多卡因' || /(利多卡因|lidocaine)/i.test(titleText);
    return {
      hasLidocaine,
      label: hasLidocaine ? '含利多卡因' : '未见利多卡因',
    };
  }

  function renderHaPositioning(source) {
    const cardsHolder = document.getElementById('ha-position-cards');
    const regionEl = document.getElementById('chart-ha-region-mix');
    const lidocaineEl = document.getElementById('chart-ha-lidocaine-breakdown');
    const noteEl = document.getElementById('ha-position-note');
    if (!cardsHolder && !regionEl && !lidocaineEl && !noteEl) return;

    const crosslinked = haCrosslinkedFillerRecords(source);
    const lidocaineRecords = crosslinked.filter((record) => haLidocaineSignal(record).hasLidocaine);
    const nonLidocaineRecords = crosslinked.filter((record) => !haLidocaineSignal(record).hasLidocaine);
    const imported = crosslinked.filter((record) => record.origin !== '国产');
    const byPosition = groupRecords(crosslinked, haPositionLabel);
    const order = haPositionOrder().filter((name) => (byPosition.get(name) || []).length);

    if (noteEl) {
      noteEl.innerHTML = `
        <b>说明</b>
        <span>核心注册证 ${source.filter((record) => record.main_landscape).length} 张，其中交联填充剂 ${crosslinked.length} 张。含利多卡因以官方注册证名称、产品名、型号规格和结构组成为准。</span>
      `;
    }

    if (cardsHolder) {
      const positionSummary = order
        .filter((name) => name !== '国产')
        .map((name) => `${name}${(byPosition.get(name) || []).length}`)
        .join(' / ');
      const cards = [
        {
          label: '核心赛道',
          title: '交联填充剂',
          count: crosslinked.length,
          sub: `从 ${source.filter((record) => record.main_landscape).length} 张核心注册证中筛出`,
          records: crosslinked,
        },
        {
          label: '进口细分',
          title: '非国产交联填充剂',
          count: imported.length,
          sub: positionSummary,
          records: imported,
        },
        {
          label: '含利多卡因',
          title: '含利多卡因',
          count: lidocaineRecords.length,
          sub: '名称、规格或结构组成出现均计入',
          records: lidocaineRecords,
          kind: 'lidocaine',
        },
        {
          label: '未含利多卡因',
          title: '未见利多卡因',
          count: nonLidocaineRecords.length,
          sub: '注册证名称/产品名未见相关字样',
          records: nonLidocaineRecords,
        },
      ];
      cardsHolder.innerHTML = cards.map((card, index) => `
        <button class="ha-position-card${card.kind ? ` ${card.kind}` : ''}" type="button" data-index="${index}">
          <span>${escape(card.label)}</span>
          <strong>${escape(card.title)}</strong>
          <b>${card.count}<em>张</em></b>
          <small>${escape(card.sub)}</small>
        </button>
      `).join('');
      cardsHolder.querySelectorAll('[data-index]').forEach((button) => {
        button.addEventListener('click', () => {
          const card = cards[Number(button.dataset.index)];
          if (card) showRecords({ title: card.title, meta: '透明质酸钠 · 交联填充剂定位', records: displayRecords(card.records) });
        });
      });
    }

    renderHaRegionMixChart(regionEl, order, byPosition);
    renderHaLidocaineBreakdownChart(lidocaineEl, order, byPosition);
  }

  function renderHaRegionMixChart(el, order, byPosition) {
    if (!el) return;
    if (!order.length) {
      el.innerHTML = '<div class="muted" style="text-align:center;padding:40px">暂无交联填充剂定位数据</div>';
      return;
    }
    const rows = order.map((name) => {
      const records = byPosition.get(name) || [];
      const lidocaineRecords = records.filter((record) => haLidocaineSignal(record).hasLidocaine);
      const nonLidocaineRecords = records.filter((record) => !haLidocaineSignal(record).hasLidocaine);
      return { name, records, lidocaineRecords, nonLidocaineRecords };
    });
    const inst = ChartFactory.make(el, {
      legend: { bottom: 0, data: ['未见利多卡因', '含利多卡因'] },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (items) => {
          const row = rows[items[0]?.dataIndex || 0];
          return `<b>${escape(row.name)}</b><br/>交联填充剂: ${row.records.length} 张<br/>含利多卡因: ${row.lidocaineRecords.length} 张<br/>未见利多卡因: ${row.nonLidocaineRecords.length} 张`;
        },
      },
      grid: { left: 60, right: 28, top: 24, bottom: 48 },
      xAxis: { type: 'category', data: rows.map((row) => row.name) },
      yAxis: { type: 'value', name: '证照数', splitLine: { lineStyle: { color: palette.hairline, type: 'dashed' } } },
      series: [
        {
          name: '未见利多卡因',
          type: 'bar',
          stack: 'lidocaine',
          barMaxWidth: chartBarMaxWidth,
          itemStyle: { color: haPositionColor('未见利多卡因') },
          data: rows.map((row) => row.nonLidocaineRecords.length),
        },
        {
          name: '含利多卡因',
          type: 'bar',
          stack: 'lidocaine',
          barMaxWidth: chartBarMaxWidth,
          itemStyle: {
            color: verticalGradient(shade(haPositionColor('含利多卡因'), 24), haPositionColor('含利多卡因')),
            borderRadius: chartBarRadius,
          },
          label: { show: true, position: 'top', color: palette.ink2, fontSize: 11, fontWeight: 700, formatter: (p) => p.value || '' },
          data: rows.map((row) => row.lidocaineRecords.length),
        },
      ],
    });
    inst.on('click', (p) => {
      const row = rows[p.dataIndex];
      const records = p.seriesName === '含利多卡因' ? row.lidocaineRecords : row.nonLidocaineRecords;
      showRecords({ title: `${row.name} · ${p.seriesName}`, meta: '透明质酸钠 · 交联填充剂定位', records: displayRecords(records) });
    });
  }

  function renderHaLidocaineBreakdownChart(el, order, byPosition) {
    if (!el) return;
    const rows = order
      .map((name) => {
        const records = byPosition.get(name) || [];
        const lidocaineRecords = records.filter((record) => haLidocaineSignal(record).hasLidocaine);
        return { name, lidocaineRecords };
      })
      .filter((row) => row.lidocaineRecords.length);
    if (!rows.length) {
      el.innerHTML = '<div class="muted" style="text-align:center;padding:40px">暂无含利多卡因交联填充剂数据</div>';
      return;
    }
    const inst = ChartFactory.make(el, {
      legend: { bottom: 0, data: ['含利多卡因'] },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (items) => {
          const row = rows[items[0]?.dataIndex || 0];
          return `<b>${escape(row.name)}</b><br/>含利多卡因: ${row.lidocaineRecords.length} 张`;
        },
      },
      grid: { left: 60, right: 28, top: 24, bottom: 48 },
      xAxis: { type: 'category', data: rows.map((row) => row.name) },
      yAxis: { type: 'value', name: '证照数', splitLine: { lineStyle: { color: palette.hairline, type: 'dashed' } } },
      series: [
        {
          name: '含利多卡因',
          type: 'bar',
          barMaxWidth: chartBarMaxWidth,
          itemStyle: {
            color: verticalGradient(shade(haPositionColor('含利多卡因'), 24), haPositionColor('含利多卡因')),
            borderRadius: chartBarRadius,
          },
          label: { show: true, position: 'top', color: palette.ink2, fontSize: 11, fontWeight: 700, formatter: (p) => p.value || '' },
          data: rows.map((row) => row.lidocaineRecords.length),
        },
      ],
    });
    inst.on('click', (p) => {
      const row = rows[p.dataIndex];
      showRecords({ title: `${row.name} · 含利多卡因`, meta: '透明质酸钠 · 含利多卡因分布', records: displayRecords(row.lidocaineRecords) });
    });
  }

  function matrixAxisLabel(label, count) {
    return `${escape(label)}<span class="matrix-axis-count">${Number(count || 0)}</span>`;
  }

  function renderProductShapeIndicationMatrix(source) {
    const holder = document.getElementById('chart-form-indication-matrix');
    if (!holder) return;
    if (isEbdTrack) {
      renderEbdDeviceIndicationMatrix(holder, source);
      return;
    }
    const landscape = source.filter((record) => record.main_landscape);
    const rows = productShapeGroups(landscape);
    const indicationCounts = indicationAnalysisCounts(landscape);
    const columns = [...indicationCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'))
      .map(([name]) => name);
    if (!rows.length || !columns.length) {
      holder.innerHTML = '<div class="muted" style="text-align:center;padding:40px">暂无足够数据形成热力图</div>';
      return;
    }
    const max = Math.max(
      1,
      ...rows.flatMap((row) => columns.map((column) =>
        analysisCount(row.records.filter((record) => indicationValues(record).includes(column)))
      ))
    );
    const compact = rows.length <= 5 && columns.length <= 4;
    const minWidth = compact ? 196 + columns.length * 230 : Math.max(760, 220 + columns.length * 116);
    const gridSizeStyle = compact ? `width:min(100%, ${minWidth}px);` : `min-width:${minWidth}px;`;
    const columnTemplate = compact
      ? `minmax(150px, 196px) repeat(${columns.length}, minmax(150px, 230px))`
      : `minmax(166px, 196px) repeat(${columns.length}, minmax(92px, 1fr))`;
    holder.innerHTML = `
      <div class="matrix-wrap">
        <div class="matrix-grid track-form-indication-grid" style="${gridSizeStyle}grid-template-columns:${columnTemplate}">
          <div class="matrix-head">产品形态</div>
          ${columns.map((column) => `<div class="matrix-head" title="${escape(indicationLabel(column))}">${matrixAxisLabel(indicationLabel(column), indicationCounts.get(column))}</div>`).join('')}
          ${rows
            .map((row) => {
              const cells = columns
                .map((column) => {
                  const matches = row.records.filter((record) => indicationValues(record).includes(column));
                  const count = analysisCount(matches);
                  const displayMatches = displayRecords(matches);
                  const payload = encodeURIComponent(JSON.stringify(displayMatches));
                  const tooltip = escape(matrixTooltipFromRecords(displayMatches));
                  return `<button type="button" class="matrix-cell" data-heat="${count ? 'active' : 'empty'}" style="${heatVars(count, max)}" data-records="${payload}" data-tooltip="${tooltip}" data-title="${escape(`${row.name} × ${indicationLabel(column)}`)}" aria-label="${escape(`${row.name} × ${indicationLabel(column)}：${count} ${analysisUnit()}`)}">${count || ''}</button>`;
                })
                .join('');
              return `<div class="matrix-term">${matrixAxisLabel(row.name, analysisCount(row.records))}</div>${cells}`;
            })
            .join('')}
        </div>
      </div>
    `;
    bindTrackMatrixInteractions(holder, '产品形态 × 适应证');
  }

  function renderEbdDeviceIndicationMatrix(holder, source) {
    const landscape = source.filter((record) => record.main_landscape);
    const rows = productShapeGroups(landscape);
    const indicationCounts = countBy(landscape.flatMap(indicationValues), (name) => name);
    const columns = [...indicationCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'))
      .map(([name]) => name);
    if (!rows.length || !columns.length) {
      holder.innerHTML = '<div class="muted" style="text-align:center;padding:40px">暂无足够数据形成热力图</div>';
      return;
    }
    const max = Math.max(
      1,
      ...rows.flatMap((row) => columns.map((column) => row.records.filter((record) => indicationValues(record).includes(column)).length))
    );
    holder.innerHTML = `
      <div class="matrix-wrap ebd-matrix-wrap">
        <div class="matrix-grid track-form-indication-grid ebd-device-indication-grid" style="grid-template-columns:minmax(168px, 220px) repeat(${columns.length}, minmax(0, 1fr))">
          <div class="matrix-head">二级设备类型</div>
          ${columns.map((column) => `<div class="matrix-head" title="${escape(indicationLabel(column))}">${matrixAxisLabel(indicationLabel(column), indicationCounts.get(column))}</div>`).join('')}
          ${rows
            .map((row) => {
              const cells = columns
                .map((column) => {
                  const matches = row.records.filter((record) => indicationValues(record).includes(column));
                  const count = matches.length;
                  const payload = encodeURIComponent(JSON.stringify(displayRecords(matches)));
                  const tooltip = escape(matrixTooltipFromRecords(matches));
                  return `<button type="button" class="matrix-cell" data-heat="${count ? 'active' : 'empty'}" style="${heatVars(count, max)}" data-records="${payload}" data-tooltip="${tooltip}" data-title="${escape(`${row.name} × ${indicationLabel(column)}`)}" aria-label="${escape(`${row.name} × ${indicationLabel(column)}：${count} 张`)}">${count || ''}</button>`;
                })
                .join('');
              return `<div class="matrix-term">${matrixAxisLabel(row.name, row.records.length)}</div>${cells}`;
            })
            .join('')}
        </div>
      </div>
    `;
    bindTrackMatrixInteractions(holder, '二级设备类型 × 适应证');
  }

  function renderCompanyMatrixList(source) {
    const holder = document.getElementById('company-matrix-list');
    if (!holder) return;
    const paint = () => {
      const rows = companyRows(source);
      rows.sort((a, b) =>
        b.shapes.length - a.shapes.length
        || analysisCount(b.records) - analysisCount(a.records)
        || b.indications.length - a.indications.length
        || a.name.localeCompare(b.name, 'zh-CN')
      );
      const max = Math.max(1, ...rows.map((row) => analysisCount(row.records)));
      holder.innerHTML = rows.map((row) => {
        const recordCount = analysisCount(row.records);
        const recordLabel = isBotulinumTrack ? '产品' : '注册证';
        const width = Math.max(6, (recordCount / max) * 100);
        const brands = unique(row.records.map((record) => record.product_name)).slice(0, 6).map(displayUiLabel).join(' / ');
        const payload = encodeURIComponent(JSON.stringify(displayRecords(row.records)));
        return `
          <button class="company-matrix-row" type="button" data-records="${payload}" data-name="${escape(row.name)}">
            <span class="company-matrix-main">
              <strong>${escape(row.name)}</strong>
              <em>${escape(brands)}</em>
              <span class="company-matrix-bar"><i style="width:${width}%"></i></span>
            </span>
            <span class="company-matrix-stat"><b>${recordCount}</b><small>${recordLabel}</small></span>
            <span class="company-matrix-stat"><b>${row.shapes.length}</b><small>产品形态</small></span>
            <span class="company-matrix-stat"><b>${row.indications.length}</b><small>适应证</small></span>
          </button>
        `;
      }).join('');
      holder.querySelectorAll('[data-records]').forEach((row) => {
        row.addEventListener('click', () => {
          const records = JSON.parse(decodeURIComponent(row.dataset.records || '[]'));
          showRecords({ title: row.dataset.name || '注册人', meta: `${trackDisplayName} · 厂家竞争力`, records });
        });
      });
    };
    paint();
  }

  function companyRows(source) {
    const groups = new Map();
    source.filter((record) => record.main_landscape).forEach((record) => {
      const company = record.company || '未标注注册人';
      if (!groups.has(company)) groups.set(company, []);
      groups.get(company).push(record);
    });
    return [...groups.entries()].map(([name, records]) => {
      const shapes = unique(records.map(productShape));
      const indications = unique(records.flatMap(indicationValues));
      return {
        name,
        records,
        shapes,
        indications,
        diversity: shapes.length * 2 + indications.length,
      };
    });
  }

  function renderApprovalEvents(source, events = []) {
    const holder = document.getElementById('approval-events-list');
    if (!holder) return;
    if (events.length) {
      const eventRows = events.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''), 'zh-CN'));
      holder.innerHTML = eventRows.slice(0, 18).map((event, idx) => {
        const date = event.date || '';
        const year = String(date).match(/20\d{2}/)?.[0] || '—';
        const title = event.brand || event.product_name || '获批事件';
        const indication = event.indication_short || event.primary_indication || '';
        const eventType = event.event_type || '获批事件';
        const payloadRecord = {
          id: `event-${idx}`,
          product_name: title,
          company: event.company || event.registrant || title,
          certificate_no: event.certificate_no || '',
          primary_indication: indication,
          approval_date: date,
          scope_full: event.scope_full || '',
          verified: true,
          tags: [eventType].filter(Boolean),
        };
        const payload = encodeURIComponent(JSON.stringify(displayRecords([payloadRecord])));
        const tags = [eventType, indication, event.region].filter(Boolean).slice(0, 3);
        return `
          <button class="event-card" type="button" data-records="${payload}" data-title="${escape(title)}">
            <span class="event-year">${escape(year)}</span>
            <span class="event-main">
              <strong>${escape(title)}</strong>
              <em>${escape(eventType)}${date ? ` · ${escape(date)}` : ''}</em>
              <small>${escape(event.certificate_no || '')}</small>
              ${event.scope_full ? `<small class="event-scope">${escape(event.scope_full)}</small>` : ''}
              <span class="event-tags">${tags.map((tag) => `<i>${escape(displayUiLabel(tag))}</i>`).join('')}</span>
            </span>
          </button>
        `;
      }).join('');
      holder.querySelectorAll('[data-records]').forEach((card) => {
        card.addEventListener('click', () => {
          const records = JSON.parse(decodeURIComponent(card.dataset.records || '[]'));
          showRecords({ title: card.dataset.title || '获批事件', meta: trackDisplayName, records });
        });
      });
      return;
    }
    const rows = source
      .filter((record) => record.main_landscape)
      .slice()
      .sort((a, b) => {
        const yearDelta = recordTimelineYear(b) - recordTimelineYear(a);
        if (yearDelta) return yearDelta;
        return String(b.approval_date || '').localeCompare(String(a.approval_date || ''), 'zh-CN');
      });
    if (!rows.length) {
      holder.innerHTML = '<div class="muted" style="text-align:center;padding:24px">暂无获批事件</div>';
      return;
    }
    holder.innerHTML = rows.slice(0, 18).map((record) => {
      const year = recordTimelineYear(record) || '—';
      const date = record.approval_date || record.valid_until || '';
      const payload = encodeURIComponent(JSON.stringify(displayRecords([record])));
      const tags = [
        record.origin,
        productShape(record),
        formatIndications(record),
      ].filter(Boolean).slice(0, 3);
      return `
        <button class="event-card" type="button" data-records="${payload}" data-title="${escape(record.product_name || '获批事件')}">
          <span class="event-year">${escape(year)}</span>
          <span class="event-main">
            <strong>${escape(record.product_name || record.brand || '未命名产品')}</strong>
            <em>${escape(record.company || record.registrant || '未标注注册人')}</em>
            <small>${escape(record.certificate_no || '')}${date ? ` · ${escape(date)}` : ''}</small>
            <span class="event-tags">${tags.map((tag) => `<i>${escape(displayUiLabel(tag))}</i>`).join('')}</span>
          </span>
        </button>
      `;
    }).join('');
    holder.querySelectorAll('[data-records]').forEach((card) => {
      card.addEventListener('click', () => {
        const records = JSON.parse(decodeURIComponent(card.dataset.records || '[]'));
        showRecords({ title: card.dataset.title || '获批事件', meta: trackDisplayName, records });
      });
    });
  }

  function originTonePalette() {
    const imported = shade(accent, -12);
    const domestic = mixColor ? mixColor(accent, '#ede0e0', 0.78) : shade(accent, 38);
    const hkmt = mixColor ? mixColor(shade(accent, -18), '#b7c4d8', 0.36) : shade(accent, -18);
    return {
      进口: {
        solid: imported,
        gradient: verticalGradient(shade(accent, 14), imported),
        label: '#fffaf5',
      },
      国产: {
        solid: domestic,
        gradient: verticalGradient(mixColor ? mixColor(accent, '#fff8f8', 0.86) : shade(accent, 48), domestic),
        label: shade(accent, -34),
      },
      港澳台: {
        solid: hkmt,
        gradient: verticalGradient(mixColor ? mixColor(accent, '#ffffff', 0.38) : shade(accent, 28), hkmt),
        label: '#fffaf5',
      },
    };
  }

  function heatVars(value, max) {
    return crystalCssHeatVars(value, max, { base: accent, fgDark: '#786868' });
  }

  function renderDonut(elId, items, title) {
    const el = document.getElementById(elId);
    if (!el || !items.length) return;
    const originPalette = originTonePalette();
    const inst = ChartFactory.make(el, {
      tooltip: {
        formatter: (p) => `<b>${escape(p.name)}</b><br/>${p.value} 张 (${p.percent.toFixed(1)}%)`,
      },
      legend: {
        bottom: 0, type: 'scroll', textStyle: { fontSize: 11.5 }, itemGap: 12,
      },
      series: [{
        type: 'pie',
        radius: ['52%', '78%'],
        center: ['50%', '46%'],
        data: items.map((item) => ({
          ...item,
          itemStyle: {
            color: originPalette[item.name]?.solid || shade(accent, -4),
            borderColor: palette.surface,
            borderWidth: 3,
            borderRadius: 6,
          },
        })),
        itemStyle: { borderColor: palette.surface, borderWidth: 3, borderRadius: 6 },
        label: { show: false },
        labelLine: { show: false },
        emphasis: {
          scaleSize: 6,
          itemStyle: { shadowBlur: 18, shadowColor: 'rgba(120,104,104,0.13)' },
          label: { show: true, position: 'center', formatter: (p) => `{n|${p.name}}\n{v|${p.value}}\n{p|${p.percent.toFixed(1)}%}`,
                   rich: {
                     n: { fontSize: 13, color: palette.ink3, padding: [0, 0, 6, 0] },
                     v: { fontSize: 28, fontWeight: 600, color: palette.ink },
                     p: { fontSize: 12, color: palette.ink3, padding: [4, 0, 0, 0] },
                   } },
        },
        animationType: 'scale', animationDuration: 700, animationEasing: 'cubicOut',
      }],
    });
    inst.on('click', (p) => {
      let key = title.includes('适应证') ? 'primary_indication'
              : title.includes('产地') ? 'origin'
              : 'material_family';
      const matches = data.records.filter((r) => r.main_landscape && (
        key === 'primary_indication' ? indicationValues(r).includes(p.name) : r[key] === p.name
      ));
      showRecords({ title: `${displayUiLabel(p.name)}`, meta: `${trackDisplayName} · ${title}`, records: displayRecords(matches) });
    });
  }

  function renderTimeline(t) {
    const yearly = timelineRows(t);
    if (!yearly.length) {
      document.querySelector('#chart-timeline').innerHTML = '<div class="muted" style="text-align:center;padding:40px">暂无时间维度数据</div>';
      return;
    }
    const years = yearly.map((row) => row.year);
    const annual = yearly.map((row) => row.count);
    const pendingAnnual = yearly.map((row) => row.pending || 0);
    const totalAnnual = yearly.map((row) => row.count + (row.pending || 0));
    const cum = yearly.map((row) => row.cumulative);
    const annualMax = Math.max(1, ...totalAnnual);
    const inst = ChartFactory.make(document.getElementById('chart-timeline'), {
      legend: { bottom: 0, data: ['核心新增', '待复核/底层', '累计获批'] },
      tooltip: {
        trigger: 'axis',
        formatter: (items) => {
          const index = items[0]?.dataIndex ?? 0;
          const row = yearly[index];
          const pendingLine = row.pending ? `<br/>待复核/底层: ${row.pending} 张` : '';
          return `<b>${row.year}</b><br/>核心新增: ${row.count} 张${pendingLine}<br/>当年合计: ${row.count + (row.pending || 0)} 张<br/>核心累计: ${row.cumulative} 张`;
        },
      },
      grid: { left: 44, right: 44, top: 30, bottom: 54 },
      xAxis: { type: 'category', data: years, boundaryGap: true },
      yAxis: [
        { type: 'value', name: '当年新增', max: Math.ceil(annualMax / 5) * 5, splitLine: { lineStyle: { color: palette.hairline, type: 'dashed' } } },
        { type: 'value', name: '累计', splitLine: { show: false } },
      ],
      series: [
        {
          name: '核心新增', type: 'bar', stack: 'annual', barMaxWidth: chartBarMaxWidth,
          itemStyle: {
            color: mainBarGradient(),
            borderRadius: (params) => (pendingAnnual[params.dataIndex] ? [0, 0, 0, 0] : chartBarRadius),
          },
          label: {
            show: true,
            position: 'top',
            color: palette.ink2,
            fontSize: 11,
            fontWeight: 600,
            formatter: (params) => (pendingAnnual[params.dataIndex] ? '' : params.value),
          },
          data: annual,
        },
        {
          name: '待复核/底层', type: 'bar', stack: 'annual', barMaxWidth: chartBarMaxWidth,
          itemStyle: {
            color: pendingBarGradient(),
            borderRadius: chartBarRadius,
          },
          label: {
            show: true,
            position: 'top',
            color: palette.ink2,
            fontSize: 11,
            fontWeight: 600,
            formatter: (params) => (params.value ? totalAnnual[params.dataIndex] : ''),
          },
          data: pendingAnnual,
        },
        {
          name: '累计获批', type: 'line', yAxisIndex: 1,
          smooth: 0.3, showSymbol: true, symbolSize: 6,
          lineStyle: { width: 2.5, color: shade(accent, -22) },
          areaStyle: { opacity: 0.06, color: accent },
          label: { show: true, position: 'top', color: shade(accent, -22), fontSize: 11, fontWeight: 600 },
          data: cum,
        },
      ],
    });
    inst.on('click', (p) => {
      const year = years[p.dataIndex];
      const mainMatches = recordsForTimelineYear(data.records, year, { mainOnly: true });
      const pendingMatches = recordsForTimelineYear(data.records, year, { pendingOnly: true });
      const matches = [...mainMatches, ...pendingMatches];
      const meta = pendingMatches.length
        ? `${trackDisplayName} · 核心清单 ${mainMatches.length} 张 + 待复核 ${pendingMatches.length} 张`
        : `${trackDisplayName} · 核心清单`;
      showRecords({ title: `${year} 年新增`, meta, records: displayRecords(matches) });
    });
  }

  function renderOriginEvolution(source) {
    const el = document.getElementById('chart-origin-evolution');
    if (!el) return;
    const yearly = timelineRows(data.timeline);
    if (!yearly.length) {
      el.innerHTML = '<div class="muted" style="text-align:center;padding:40px">暂无来源演变数据</div>';
      return;
    }
    const years = yearly.map((row) => row.year);
    const origins = ['进口', '国产', '港澳台'].filter((origin) => yearly.some((row) => row[origin] > 0));
    const originPalette = originTonePalette();
    const originLabelColors = Object.fromEntries(origins.map((origin) => [origin, originPalette[origin]?.label || '#fffaf5']));
    const originGradients = Object.fromEntries(origins.map((origin) => [origin, originPalette[origin]?.gradient || mainBarGradient()]));
    const outsideLabelSeries = origins.map((origin, originIndex) => ({
      name: `${origin}小值标签`,
      type: 'scatter',
      silent: true,
      symbolSize: 0,
      tooltip: { show: false },
      data: yearly
        .map((row, index) => {
          const value = row[origin] || 0;
          if (!value || value >= 3) return null;
          const stackedTop = origins.slice(0, originIndex + 1).reduce((sum, key) => sum + (row[key] || 0), 0);
          return {
            value: [index, stackedTop],
            labelValue: value,
          };
        })
        .filter(Boolean),
      label: {
        show: true,
        position: 'top',
        distance: 3,
        color: shade(accent, -28),
        fontSize: 11,
        fontWeight: 700,
        formatter: (p) => p.data.labelValue,
      },
    }));
    const inst = ChartFactory.make(el, {
      legend: { bottom: 0, data: origins },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (items) => {
          const index = items[0]?.dataIndex ?? 0;
          const row = yearly[index];
          const lines = origins.map((origin) => `${origin}: ${row[origin] || 0} 张`).join('<br/>');
          return `<b>${row.year}</b><br/>${lines}<br/>合计: ${row.count} 张`;
        },
      },
      grid: { left: 44, right: 44, top: 30, bottom: 48 },
      xAxis: { type: 'category', data: years, boundaryGap: true },
      yAxis: { type: 'value', name: '证照数', splitLine: { lineStyle: { color: palette.hairline, type: 'dashed' } } },
      series: [
        ...origins.map((origin, index) => ({
          name: origin,
          type: 'bar',
          stack: 'origin',
          barMaxWidth: chartBarMaxWidth,
          data: yearly.map((row) => {
            const value = row[origin] || 0;
            const hasUpperSegment = origins.slice(index + 1).some((key) => row[key] > 0);
            return {
              value,
              itemStyle: {
                borderRadius: value && !hasUpperSegment ? chartBarRadius : [0, 0, 0, 0],
                borderColor: 'transparent',
                borderWidth: 0,
              },
            };
          }),
          itemStyle: {
            color: originGradients[origin],
            borderColor: 'transparent',
            borderWidth: 0,
          },
          emphasis: { itemStyle: { borderColor: 'transparent', borderWidth: 0 } },
          label: {
            show: true,
            position: 'inside',
            color: originLabelColors[origin],
            fontSize: 11,
            fontWeight: 700,
            formatter: (p) => (p.value && p.value >= 3 ? p.value : ''),
          },
        })),
        ...outsideLabelSeries,
      ],
    });
    inst.on('click', (p) => {
      const year = years[p.dataIndex];
      const matches = recordsForTimelineYear(source, year).filter((record) => record.origin === p.seriesName);
      showRecords({ title: `${year} 年${p.seriesName}`, meta: `${trackDisplayName} · 国产 vs 进口演变`, records: displayRecords(matches) });
    });
  }

  function timelineRows(t) {
    if (isHaTrack && Array.isArray(data.benchmark?.yearly)) {
      return data.benchmark.yearly.map((row) => ({
        year: Number(row.year),
        count: Number(row.count || 0),
        pending: data.records.filter((record) => !record.main_landscape && recordTimelineYear(record) === Number(row.year)).length,
        cumulative: Number(row.cumulative || 0),
        进口: Number(row['进口'] || 0),
        国产: Number(row['国产'] || 0),
      }));
    }
    const years = Array.isArray(t?.years) ? t.years : [];
    const values = Array.isArray(t?.values) ? t.values : [];
    const originByYear = new Map();
    const pendingByYear = new Map();
    data.records
      .forEach((record) => {
        const year = recordTimelineYear(record);
        if (!year) return;
        if (record.main_landscape) {
          if (!originByYear.has(year)) originByYear.set(year, { 国产: 0, 进口: 0, 港澳台: 0 });
          const bucket = originByYear.get(year);
          const origin = record.origin || '国产';
          if (origin in bucket) bucket[origin] += 1;
        } else {
          pendingByYear.set(year, (pendingByYear.get(year) || 0) + 1);
        }
      });
    let cumulative = 0;
    return years.map((year, index) => {
      const count = Number(values[index] || 0);
      cumulative += count;
      const origins = originByYear.get(Number(year)) || {};
      return {
        year: Number(year),
        count,
        pending: Number(pendingByYear.get(Number(year)) || 0),
        cumulative,
        进口: Number(origins['进口'] || 0),
        国产: Number(origins['国产'] || 0),
        港澳台: Number(origins['港澳台'] || 0),
      };
    });
  }

  function recordsForTimelineYear(source, year, options = {}) {
    return source.filter((record) => {
      if (recordTimelineYear(record) !== Number(year)) return false;
      if (options.pendingOnly) return !record.main_landscape;
      if (options.mainOnly !== false) return record.main_landscape;
      return true;
    });
  }

  function recordTimelineYear(record) {
    if (!isHaTrack && Number(record?.approval_year || 0)) return Number(record.approval_year);
    if (!isHaTrack && record?.approval_date) {
      const approvalYearMatch = String(record.approval_date).match(/20\d{2}/);
      if (approvalYearMatch) return Number(approvalYearMatch[0]);
    }
    return certificateYear(record);
  }

  function certificateYear(record) {
    const certificateYearMatch = String(record?.certificate_no || '').match(/20\d{2}/);
    return certificateYearMatch ? Number(certificateYearMatch[0]) : Number(record?.approval_year || 0);
  }

  function renderCompanyHeatmap(hm) {
    const el = document.getElementById('chart-co-in');
    if (!el) return;
    if (isEbdTrack) {
      renderEbdCompanyEnergyHeatmap(el);
      return;
    }
    if (!hm.companies.length || !hm.indications.length) {
      el.innerHTML = '<div class="muted" style="text-align:center;padding:40px">数据不足</div>';
      return;
    }
    const max = Math.max(...hm.companies.flatMap((company) =>
      hm.indications.map((indication) => analysisCount(companyIndicationMatches(company, indication)))
    ), 1);
    const companyTotals = new Map(hm.companies.map((company) => [
      company,
      isBotulinumTrack
        ? analysisCount(data.records.filter((record) => record.main_landscape && (record.company || '未标注厂家') === company))
        : unique(data.records
          .filter((record) => record.main_landscape && (record.company || '未标注厂家') === company)
          .flatMap(indicationValues)
        ).length,
    ]));
    const indicationTotals = indicationAnalysisCounts(data.records.filter((record) => record.main_landscape));
    const compact = hm.companies.length <= 6 && hm.indications.length <= 4;
    const minWidth = compact ? 210 + hm.indications.length * 240 : Math.max(900, 220 + hm.indications.length * 130);
    const gridSizeStyle = compact ? `width:min(100%, ${minWidth}px);` : `min-width:${minWidth}px;`;
    const columnTemplate = compact
      ? `minmax(160px, 210px) repeat(${hm.indications.length}, minmax(160px, 240px))`
      : `minmax(182px, 220px) repeat(${hm.indications.length}, minmax(108px, 1fr))`;
    const body = hm.companies.map((company) => {
      const cells = hm.indications.map((indication) => {
        const matches = companyIndicationMatches(company, indication);
        const count = analysisCount(matches);
        const displayMatches = displayRecords(matches);
        const payload = encodeURIComponent(JSON.stringify(displayMatches));
        return `<button type="button" class="matrix-cell" data-heat="${count ? 'active' : 'empty'}" style="${heatVars(count, max)}" data-records="${payload}" data-tooltip="${escape(matrixTooltipFromRecords(displayMatches))}" data-title="${escape(`${company} × ${indicationLabel(indication)}`)}" aria-label="${escape(`${company} × ${indicationLabel(indication)}：${count} ${analysisUnit()}`)}">${count || ''}</button>`;
      }).join('');
      return `<div class="matrix-term" title="${escape(company)}">${matrixAxisLabel(company, companyTotals.get(company))}</div>${cells}`;
    }).join('');
    el.classList.remove('chart', 'chart-xl', 'chart-tall');
    el.innerHTML = `
      <div class="matrix-wrap">
        <div class="matrix-grid track-company-indication-grid" style="${gridSizeStyle}grid-template-columns:${columnTemplate}">
          <div class="matrix-head">厂家</div>
          ${hm.indications.map((indication) => `<div class="matrix-head" title="${escape(indicationLabel(indication))}">${matrixAxisLabel(indicationLabel(indication), indicationTotals.get(indication))}</div>`).join('')}
          ${body}
        </div>
      </div>
    `;
    bindTrackMatrixInteractions(el, '厂家和适应症卡位');
  }

  function renderEbdCompanyEnergyHeatmap(el) {
    const landscape = data.records.filter((record) => record.main_landscape);
    const energyCounts = countBy(landscape.map(ebdEnergyType), (name) => name);
    const energyTypes = [...energyCounts.entries()]
      .sort((a, b) =>
        ebdEnergyOrder.indexOf(a[0]) - ebdEnergyOrder.indexOf(b[0])
        || b[1] - a[1]
        || a[0].localeCompare(b[0], 'zh-CN')
      )
      .map(([name]) => name);
    const companyGroups = new Map();
    landscape.forEach((record) => {
      const company = record.company || '未标注厂家';
      if (!companyGroups.has(company)) companyGroups.set(company, []);
      companyGroups.get(company).push(record);
    });
    const rows = [...companyGroups.entries()]
      .map(([company, records]) => ({
        company,
        records,
        energyTypes: unique(records.map(ebdEnergyType)),
        subtypes: unique(records.map(ebdDeviceSubtype)),
      }))
      .sort((a, b) =>
        b.energyTypes.length - a.energyTypes.length
        || b.subtypes.length - a.subtypes.length
        || b.records.length - a.records.length
        || a.company.localeCompare(b.company, 'zh-CN')
      );
    if (!rows.length || !energyTypes.length) {
      el.innerHTML = '<div class="muted" style="text-align:center;padding:40px">数据不足</div>';
      return;
    }
    const max = Math.max(
      1,
      ...rows.flatMap((row) => energyTypes.map((energy) => row.records.filter((record) => ebdEnergyType(record) === energy).length))
    );
    el.classList.remove('chart', 'chart-xl', 'chart-tall');
    el.innerHTML = `
      <div class="matrix-wrap ebd-matrix-wrap">
        <div class="matrix-grid track-company-indication-grid ebd-company-energy-grid" style="grid-template-columns:minmax(198px, 260px) repeat(${energyTypes.length}, minmax(118px, 1fr))">
          <div class="matrix-head">厂家</div>
          ${energyTypes.map((energy) => `<div class="matrix-head" title="${escape(energy)}">${matrixAxisLabel(energy, energyCounts.get(energy))}</div>`).join('')}
          ${rows.map((row) => {
            const cells = energyTypes.map((energy) => {
              const matches = row.records.filter((record) => ebdEnergyType(record) === energy);
              const count = matches.length;
              const payload = encodeURIComponent(JSON.stringify(displayRecords(matches)));
              const tooltip = escape(matrixTooltipFromRecords(matches));
              return `<button type="button" class="matrix-cell" data-heat="${count ? 'active' : 'empty'}" style="${heatVars(count, max)}" data-records="${payload}" data-tooltip="${tooltip}" data-title="${escape(`${row.company} × ${energy}`)}" aria-label="${escape(`${row.company} × ${energy}：${count} 张`)}">${count || ''}</button>`;
            }).join('');
            return `<div class="matrix-term" title="${escape(row.company)}">${matrixAxisLabel(row.company, row.energyTypes.length)}</div>${cells}`;
          }).join('')}
        </div>
      </div>
    `;
    bindTrackMatrixInteractions(el, '厂家 × 能量类型布局');
  }

  function renderRecords(records) {
    const tbody = document.querySelector('#table-records tbody');
    const filterOrigin = document.getElementById('filter-origin');
    const filterHaShape = document.getElementById('filter-ha-shape');
    const filterHaPosition = document.getElementById('filter-ha-position');
    const filterLidocaine = document.getElementById('filter-lidocaine');
    const filterVerified = document.getElementById('filter-verified');
    const search = document.getElementById('search');
    if (!tbody) return;
    restoreRecordFiltersFromUrl();

    function paint() {
      const fo = filterOrigin?.value || '';
      const fshape = filterHaShape?.value || '';
      const fposition = filterHaPosition?.value || '';
      const flidocaine = filterLidocaine?.value || '';
      const fv = filterVerified?.value || '';
      const rawSearch = (search?.value || '').trim();
      const fs = rawSearch.toLowerCase();
      updateRecordFilterUrl({ fo, fshape, fposition, flidocaine, fv, search: rawSearch });
      const filtered = records.filter((r) => {
        if (!r.main_landscape) return false;
        if (fo && r.origin !== fo) return false;
        if (isHaTrack && fshape && productShape(r) !== fshape) return false;
        if (isHaTrack && fposition && haPositionLabel(r) !== fposition) return false;
        if (isHaTrack && flidocaine && !matchesHaLidocaineFilter(r, flidocaine)) return false;
        if (fv === 'verified' && !r.verified) return false;
        if (fv === 'pending' && r.verified) return false;
        if (fs) {
          const lidocaineSignal = haLidocaineSignal(r);
          const hay = [
            r.brand,
            r.product_name,
            r.official_product_name,
            r.commercial_name,
            r.company,
            r.registrant,
            r.certificate_no,
            formatIndications(r),
            r.scope_full,
            r.news_title,
            r.market_note,
            ...(r.feature_tags || []),
            r.indication_description,
            r.components,
            r.specification,
            isHaTrack ? productShape(r) : '',
            isHaTrack ? haPositionLabel(r) : '',
            isHaTrack ? haRegionLabel(r) : '',
            isHaTrack ? lidocaineSignal.label : '',
          ].join(' ').toLowerCase();
          if (!hay.includes(fs)) return false;
        }
        return true;
      });
      const countEl = document.getElementById('records-count');
      if (countEl) countEl.textContent = filtered.length;
      tbody.innerHTML = filtered.slice(0, 80).map((r) => (
        isCollagenTrack ? renderCollagenRecordRow(r) : renderDefaultRecordRow(r)
      )).join('');
      tbody.querySelectorAll('tr').forEach((tr) => {
        tr.addEventListener('click', () => {
          const r = records.find((x) => x.id === tr.dataset.id);
          if (r) showRecords({ title: r.product_name || '产品详情', meta: r.certificate_no || '', records: displayRecords([r]) });
        });
      });
      if (filtered.length > 80) {
        const note = document.createElement('tr');
        note.innerHTML = `<td colspan="10" class="muted" style="text-align:center">仅显示前 80 条,共 ${filtered.length} 条匹配</td>`;
        tbody.appendChild(note);
      }
    }

    function restoreRecordFiltersFromUrl() {
      const params = new URLSearchParams(location.search);
      setControlValue(filterOrigin, params.get('origin'));
      setControlValue(filterHaShape, params.get('shape'));
      setControlValue(filterHaPosition, params.get('position'));
      setControlValue(filterLidocaine, params.get('lidocaine'));
      setControlValue(filterVerified, params.get('verified'));
      if (search && params.has('q')) search.value = params.get('q') || '';
    }

    function setControlValue(control, value) {
      if (!control || value === null) return;
      const option = Array.from(control.options || []).find((item) => item.value === value);
      if (option) control.value = value;
    }

    function updateRecordFilterUrl(values) {
      const params = new URLSearchParams(location.search);
      setParam(params, 'origin', values.fo);
      setParam(params, 'shape', values.fshape);
      setParam(params, 'position', values.fposition);
      setParam(params, 'lidocaine', values.flidocaine);
      setParam(params, 'verified', values.fv);
      setParam(params, 'q', values.search);
      const next = `${location.pathname}${params.toString() ? `?${params.toString()}` : ''}${location.hash}`;
      if (next !== `${location.pathname}${location.search}${location.hash}`) {
        history.replaceState(null, '', next);
      }
    }

    function setParam(params, key, value) {
      if (value) params.set(key, value);
      else params.delete(key);
    }

    function recordSpecification(record) {
      return record.specification || '—';
    }

    function recordValidUntil(record) {
      const value = record.valid_until || record.official_valid_until || '';
      if (!value) return '—';
      // Estimated expiry: we have a valid_until but no official_valid_until
      // (e.g. domestic drugs whose NMPA page does not publish 有效期截止日).
      // Render it slightly lighter with a small "推算" marker.
      if (record.valid_until && !record.official_valid_until) {
        return `<span style="color:var(--ink-3)" title="按批准日 + 5 年法定有效期推算；境内药品 NMPA 详情页未公示有效期截止日">${escape(value)}<span style="margin-left:4px;font-size:10px;color:var(--ink-mute)">推算</span></span>`;
      }
      return escape(value);
    }

    function matchesHaLidocaineFilter(record, filterValue) {
      const signal = haLidocaineSignal(record);
      if (filterValue === 'yes') return signal.hasLidocaine;
      if (filterValue === 'no') return !signal.hasLidocaine;
      return true;
    }

    function renderDefaultRecordRow(r) {
      const materialLabel = isEbdTrack
        ? ebdCleanMaterialLabel(r)
        : displayUiLabel(r.material_form || r.material_family || '');
      return `
        <tr data-id="${escape(r.id)}">
          <td>${escape(productBrandLabel(r))}</td>
          <td>
            <b>${escape(r.product_name || '—')}</b>
            <div class="muted" style="font-size:11.5px">${escape(materialLabel)}</div>
            ${isHaTrack ? renderHaRecordTags(r) : ''}
          </td>
          <td>${escape(r.company)}</td>
          <td><span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px">${escape(r.certificate_no || '—')}</span></td>
          <td><div class="table-spec-cell">${escape(recordSpecification(r))}</div></td>
          <td>${escape(r.origin || '—')}</td>
          <td>${escape(formatIndications(r))}</td>
          <td>${escape(r.approval_date || '—')}</td>
          <td>${recordValidUntil(r)}</td>
          <td>${verificationBadge(r)}</td>
        </tr>
      `;
    }

    function renderHaRecordTags(record) {
      const signal = haLidocaineSignal(record);
      const lidocaineTag = signal.hasLidocaine
        ? `<span class="tag lidocaine-tag yes">${escape(signal.label)}</span>`
        : '';
      return `
        <div class="table-tag-row">
          <span class="tag product-shape-tag">${escape(productShape(record))}</span>
          ${lidocaineTag}
        </div>
      `;
    }

    function renderCollagenRecordRow(r) {
      const source = collagenSourceTag(r);
      const sourceClass = source === '类人源' ? 'human' : 'animal';
      const scope = r.scope_full || r.indication_description || r.components || '';
      const primary = formatIndications(r);
      const scopeLine = scope && scope !== primary
        ? `<div class="muted table-detail-line">${escape(scope)}</div>` : '';
      return `
        <tr data-id="${escape(r.id)}">
          <td>${escape(productBrandLabel(r))}</td>
          <td>
            <b>${escape(r.product_name || r.brand || '—')}</b>
            <div class="muted" style="font-size:11.5px">${escape(displayUiLabel(r.material_form || r.material_family || ''))}</div>
            <div class="table-tag-row"><span class="tag source-tag ${sourceClass}">${escape(source)}</span></div>
          </td>
          <td>
            <b>${escape(r.company || '—')}</b>
            <div class="muted" style="font-size:11.5px">${escape(r.registrant || '')}</div>
          </td>
          <td><span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px">${escape(r.certificate_no || '—')}</span></td>
          <td><div class="table-spec-cell">${escape(recordSpecification(r))}</div></td>
          <td>${escape(r.origin || '—')}</td>
          <td>
            ${escape(primary)}
            ${scopeLine}
          </td>
          <td>${escape(r.approval_date || '—')}</td>
          <td>${recordValidUntil(r)}</td>
          <td>${verificationBadge(r)}</td>
        </tr>
      `;
    }

    [filterOrigin, filterHaShape, filterHaPosition, filterLidocaine, filterVerified, search]
      .filter(Boolean)
      .forEach((el) => {
        el.addEventListener('input', paint);
        el.addEventListener('change', paint);
      });
    paint();
  }

  function buildCompanyIndicationHeatmap(source) {
    const landscape = source.filter((r) => r.main_landscape);
    const companyStats = new Map();
    landscape.forEach((record) => {
      const company = record.company || '未标注厂家';
      if (!companyStats.has(company)) {
        companyStats.set(company, { company, records: [], indications: new Set(), segments: new Set() });
      }
      const row = companyStats.get(company);
      row.records.push(record);
      indicationValues(record).forEach((item) => row.indications.add(item));
      row.segments.add(productShape(record));
    });
    const companies = [...companyStats.values()]
      .sort((a, b) =>
        b.indications.size - a.indications.size
        || b.segments.size - a.segments.size
        || analysisCount(b.records) - analysisCount(a.records)
        || a.company.localeCompare(b.company, 'zh-CN')
      )
      .map((row) => row.company);
    const indicationCounts = indicationAnalysisCounts(landscape);
    const indications = [...indicationCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'))
      .map(([name]) => name);
    return { companies, indications };
  }

  function companyIndicationMatches(company, indication) {
    return data.records.filter((record) =>
      record.main_landscape
      && (record.company || '未标注厂家') === company
      && indicationValues(record).includes(indication)
    );
  }

  function matrixTooltipFromRecords(records) {
    if (!records?.length) return '';
    const labels = unique(records.map((record) => {
      const product = displayUiLabel(record.brand || record.product_name || record.official_product_name || record.certificate_no || '未标注产品');
      const company = displayUiLabel(record.company || record.registrant || '未标注厂家');
      return `${product} / ${company}`;
    }));
    const shown = labels.slice(0, 8);
    if (labels.length > shown.length) shown.push(`另 ${labels.length - shown.length} 条`);
    return JSON.stringify(shown.map((label) => ({ label })));
  }

  function bindTrackMatrixInteractions(root, meta) {
    const tooltipNode = matrixTooltipNode();
    root.querySelectorAll('button.matrix-cell[data-records]').forEach((cell) => {
      const showTip = (event) => {
        const html = tooltipHtml(cell.dataset.tooltip || '');
        if (!html) return;
        tooltipNode.innerHTML = html;
        tooltipNode.classList.add('visible');
        positionMatrixTooltip(tooltipNode, event.clientX, event.clientY);
      };
      const hideTip = () => tooltipNode.classList.remove('visible');
      cell.addEventListener('mouseenter', showTip);
      cell.addEventListener('mousemove', (event) => {
        if (tooltipNode.classList.contains('visible')) positionMatrixTooltip(tooltipNode, event.clientX, event.clientY);
      });
      cell.addEventListener('mouseleave', hideTip);
      cell.addEventListener('focus', () => {
        const html = tooltipHtml(cell.dataset.tooltip || '');
        if (!html) return;
        const rect = cell.getBoundingClientRect();
        tooltipNode.innerHTML = html;
        tooltipNode.classList.add('visible');
        positionMatrixTooltip(tooltipNode, rect.left + rect.width / 2, rect.bottom);
      });
      cell.addEventListener('blur', hideTip);
      cell.addEventListener('click', () => {
        hideTip();
        const records = JSON.parse(decodeURIComponent(cell.dataset.records || '[]'));
        if (records.length) showRecords({ title: cell.dataset.title || '热力图记录', meta, records });
      });
    });
  }

  function matrixTooltipNode() {
    let node = document.querySelector('.matrix-tooltip');
    if (!node) {
      node = document.createElement('div');
      node.className = 'matrix-tooltip';
      node.setAttribute('role', 'tooltip');
      document.body.appendChild(node);
    }
    return node;
  }

  function tooltipHtml(raw) {
    if (!raw) return '';
    let items = [];
    try {
      items = JSON.parse(raw);
    } catch (error) {
      items = String(raw).split('\n').filter(Boolean).map((label) => ({ label }));
    }
    if (!Array.isArray(items) || !items.length) return '';
    const rows = items.slice(0, 8)
      .map((item) => `<li><i></i><span>${escape(item.label || item)}</span></li>`)
      .join('');
    return `<ul class="tooltip-list tooltip-coral">${rows}</ul>`;
  }

  function positionMatrixTooltip(node, x, y) {
    const margin = 14;
    const rect = node.getBoundingClientRect();
    const left = Math.min(Math.max(x + 14, margin), Math.max(window.innerWidth - rect.width - margin, margin));
    const top = Math.min(Math.max(y + 14, margin), Math.max(window.innerHeight - rect.height - margin, margin));
    node.style.left = `${left}px`;
    node.style.top = `${top}px`;
  }

  function isSubmentalLipolysisRecord(record) {
    const text = [
      record?.track,
      record?.track_name,
      record?.category,
      record?.material_family,
      record?.materialFamily,
      record?.brand,
      record?.product_name,
      record?.productName,
      record?.certificate_no,
      record?.certificateNo,
      record?.primary_indication,
      record?.primaryIndication,
      record?.approved_indications,
      record?.approvedIndications,
      record?.official_indication,
      record?.officialIndication,
      record?.official_scope,
      record?.officialScope,
      record?.scope_full,
      record?.scopeFull,
    ].filter(Boolean).join(' ');
    return /(raw_lipolysis_injection|去氧胆酸|溶脂|H20254519)/.test(text)
      && /(颏下脂肪|双下巴|H20254519)/.test(text);
  }

  function isJawChinContourFillingRecord(record) {
    if (!record || isSubmentalLipolysisRecord(record)) return false;
    const text = [
      record?.track,
      record?.track_name,
      record?.category,
      record?.material_family,
      record?.materialFamily,
      record?.material_form,
      record?.materialForm,
      record?.product_name,
      record?.productName,
      record?.primary_indication,
      record?.primaryIndication,
      record?.approved_indications,
      record?.approvedIndications,
      record?.official_indication,
      record?.officialIndication,
      record?.indication_description,
      record?.indicationDescription,
      record?.official_scope,
      record?.officialScope,
      record?.scope_full,
      record?.scopeFull,
    ].filter(Boolean).join(' ');
    const compact = text.replace(/\s+/g, '');
    if (/(皮肤松弛|热效应|脂肪堆积|双下巴)/.test(compact)) return false;
    return /(下颌|下颏|颏部)/.test(compact) && /(填充|后缩|轮廓|骨膜|皮下组织)/.test(compact);
  }

  function indicationValues(record) {
    if (isSubmentalLipolysisRecord(record)) return [SUBMENTAL_LIPOLYSIS_INDICATION];
    const values = [
      ...normalizeIndicationValues(record?.approved_indications || record?.approvedIndications || '', record),
      ...(Array.isArray(record?.indications) ? record.indications.flatMap((value) => normalizeIndicationValues(value, record)) : []),
      ...normalizeIndicationValues(record?.official_indication || record?.officialIndication || '', record),
      ...normalizeIndicationValues(record?.primary_indication || record?.primaryIndication || '', record),
    ];
    return unique(values);
  }

  function formatIndications(record) {
    const values = indicationValues(record).map(indicationLabel);
    return values.length ? values.join('、') : (record?.primary_indication || '—');
  }

  function collagenSourceTag(record) {
    const text = `${record?.collagen_source || ''} ${record?.material_family || ''} ${record?.material_form || ''} ${record?.product_name || ''}`;
    if (/重组|类人源|人源化/.test(text)) return '类人源';
    if (/动物源|胶原蛋白植入剂|医用胶原蛋白植入剂|面部胶原蛋白植入剂/.test(text)) return '动物源';
    return '';
  }

  function productBrandLabel(record) {
    const label = displayUiLabel(record?.brand || record?.commercial_name || '');
    if (!label || isRegistrationNameEcho(label, record)) return '';
    if (isHaTrack) return haDisplayBrandLabel(label);
    return label;
  }

  function isRegistrationNameEcho(label, record) {
    const normalized = normalizeBrandCompare(label);
    const candidates = [
      record?.product_name,
      record?.official_product_name,
      record?.commercial_name,
    ].map(normalizeBrandCompare).filter(Boolean);
    return candidates.includes(normalized);
  }

  function normalizeBrandCompare(value) {
    return displayUiLabel(value || '')
      .replace(/[（）()，,、;；:：\s·\-_/／]/g, '')
      .toLowerCase();
  }

  function haDisplayBrandLabel(label) {
    if (!isHaGenericRegistrationName(label)) return label;
    const start = label.search(/乔雅登|Juv[eé]derm|Juvederm|Belotero|Restylane|YVOIRE|Princess|Formaderm|Dermalax|Dermax|MONALISA|A-Viearchee|HyaFilia|Cutegel|MaiLi|STYLAGE|Elravie|e\.p\.t\.q\.|amalian|Artfiller|PREF2F|Kylane|VIVACY|VOLBELLA|VOLUMA|VOLIFT|VOLUX/i);
    if (start < 0) return '';
    return cleanupHaBrandLabel(label.slice(start));
  }

  function isHaGenericRegistrationName(label) {
    return /透明质酸|Sodium Hyaluronate|hyaluronic acid/i.test(label)
      && /注射用|医用|凝胶|溶液|Gel|Filler|Syringe|Implants/i.test(label);
  }

  function cleanupHaBrandLabel(label) {
    const cleaned = label
      .replace(/\([^)]*组织修复用生物材料[^)]*\)/g, '')
      .replace(/（[^）]*组织修复用生物材料[^）]*）/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (/^(Cross-?linked|Modified|Pre-filled|Soft Tissue Implants|Dermal Implants|Sodium Hyaluronate|Hyaluronic acid)/i.test(cleaned)) {
      return '';
    }
    return cleaned;
  }

  function verificationBadge(record) {
    const statusText = record?.official_verification_status || record?.officialVerificationStatus || '';
    const sourceText = record?.official_source || record?.officialSource || '';
    const title = escape([statusText, sourceText].filter(Boolean).join(' · ') || (record?.verified ? '已通过 NMPA 核验' : '尚未通过 NMPA 核验，需复核'));
    return record?.verified
      ? `<span class="verify-badge ok" title="${title}"><span class="ico">✓</span>已核验</span>`
      : `<span class="verify-badge pending" title="${title}"><span class="ico">⌛</span>待核验</span>`;
  }

  function displayRecords(records) {
    return analysisRecords(records).map((record) => {
      const mapped = { ...record, primary_indication: formatIndications(record) };
      if (isHaTrack) {
        const signal = haLidocaineSignal(record);
        mapped.material_family = displayUiLabel(record.material_family || '透明质酸钠');
        mapped.material_form = productShape(record);
        mapped.tags = [
          productShape(record),
          haPositionLabel(record),
          haRegionLabel(record),
          signal.hasLidocaine ? signal.label : '',
        ].filter(Boolean);
      }
      if (isCollagenTrack) {
        mapped.tags = [collagenSourceTag(record)];
        mapped.hide_origin_tag = true;
      }
      if (isEbdTrack) {
        mapped.material_family = ebdCleanMaterialLabel(record);
        mapped.material_form = ebdDeviceSubtype(record);
        mapped.tags = [ebdEnergyType(record), ebdDeviceSubtype(record)].filter(Boolean);
      }
      if (isBotulinumTrack) {
        mapped.material_family = displayUiLabel(record.material_family || '肉毒毒素');
        mapped.material_form = displayUiLabel(record.material_form || '');
        mapped.tags = [
          record.material_form,
          record.origin,
          record._certificate_count > 1 ? `${record._certificate_count}张批准文号` : '',
        ].filter(Boolean);
      }
      return mapped;
    });
  }

  function normalizeIndicationValues(value, record) {
    return String(value || '')
      .split(/[、,，;；|]+/)
      .flatMap((token) => splitIndicationToken(token, record))
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function splitIndicationToken(value, record) {
    const text = String(value || '').trim();
    if (!text) return [];
    const compact = text.replace(/\s+/g, '').replace(/[()]/g, (char) => (char === '(' ? '（' : '）')).replace(/／/g, '/');
    if ((compact.includes('颏下脂肪堆积') && compact.includes('双下巴')) || compact === SUBMENTAL_LIPOLYSIS_INDICATION) {
      return [SUBMENTAL_LIPOLYSIS_INDICATION];
    }
    const jawChinTokens = new Set(['下颌部', '下颌', '下颏', '颏部', '下颏/下颌部', '下颌/下颏', '面部软组织/轮廓', JAW_CHIN_CONTOUR_FILLING_INDICATION]);
    if (jawChinTokens.has(compact) && (!record || isJawChinContourFillingRecord(record))) {
      return [JAW_CHIN_CONTOUR_FILLING_INDICATION];
    }
    const combined = {
      '颏下脂肪堆积/双下巴': '颏下脂肪堆积（双下巴）',
      '双下巴/颏下脂肪堆积': '颏下脂肪堆积（双下巴）',
      '中面部容量/轮廓': '中面部容量/轮廓',
      '痤疮/术后': '痤疮/术后',
      '疼痛缓解/非医美核心': '疼痛缓解/非医美核心',
      '二类边界/历史证照': '二类边界/历史证照',
    };
    if (combined[compact]) return [combined[compact]];
    const explicitSplits = {
      '鼻唇沟/隆鼻': ['鼻唇沟', '隆鼻'],
      '中下面部/颏下/颈部皮肤松弛': ['中下面部', '颏下', '颈部皮肤松弛'],
    };
    if (explicitSplits[compact]) return explicitSplits[compact];
    if (/[\/／]/.test(text)) return text.split(/[\/／]/).flatMap((part) => splitIndicationToken(part, record));
    const jawChinToken = /(下颌|下颏|颏部)/.test(compact) && /(填充|后缩|轮廓|骨膜|皮下组织)/.test(compact);
    if (jawChinToken && (!record || isJawChinContourFillingRecord(record))) {
      return [JAW_CHIN_CONTOUR_FILLING_INDICATION];
    }
    if (/\s+[\/／]\s+/.test(text)) return text.split(/\s+[\/／]\s+/);
    return [text];
  }

  function indicationLabel(value) {
    if (value === '颞部') return '颞部/颞区';
    return value;
  }

  function countBy(items, getKey) {
    const groups = new Map();
    items.forEach((item) => {
      const key = getKey(item);
      if (!key) return;
      groups.set(key, (groups.get(key) || 0) + 1);
    });
    return groups;
  }

  function groupRecords(items, getKey) {
    const groups = new Map();
    items.forEach((item) => {
      const key = getKey(item);
      if (!key) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    return groups;
  }

  function unique(values) {
    return Array.from(new Set(values.filter((value) => value && String(value).trim())));
  }
})();

function displayUiLabel(value) {
  return String(value || '')
    .replaceAll('再生类', '胶原刺激剂')
    .replace(/希玛德股份有限公司\s*SYMATESE SAS/g, '思奥美 / SYMATESE SAS')
    .replace(/希玛德股份有限公司SYMATESE SAS/g, '思奥美 / SYMATESE SAS')
    .replace(/西马\s*Xeomin/gi, '思奥美 Xeomin')
    .replace(/西马/g, '思奥美')
    .replace(/HA\s*\/\s*透明质酸钠/g, '透明质酸钠')
    .replace(/透明质酸钠\s*\/\s*玻尿酸/g, '透明质酸钠')
    .replace(/玻尿酸\s*\/\s*透明质酸钠/g, '透明质酸钠')
    .replace(/^玻尿酸$/g, '透明质酸钠')
    .replace(/童颜针\s*\/\s*PLLA/g, 'PLA')
    .replace(/少女针\s*\/\s*PCL/g, 'PCL')
    .replace(/羟基磷酸钙\s*\/\s*CaHA/g, 'CaHA/微晶瓷')
    .replace(/肉毒素/g, '肉毒毒素')
    .replace(/EBD 设备类/g, 'EBD 设备');
}

// HSL shade helper
function shade(hex, amt) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const f = (c) => {
    const v = Math.max(0, Math.min(255, Math.round(c + amt * 2.55)));
    return v.toString(16).padStart(2, '0');
  };
  return '#' + f(r) + f(g) + f(b);
}
function sum(arr) { return arr.reduce((a, x) => a + (x.value || 0), 0); }
