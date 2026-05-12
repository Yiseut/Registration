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
  const chartBarMaxWidth = 26;
  const chartBarRadius = [6, 6, 0, 0];
  const verticalGradient = (topColor, bottomColor) => new echarts.graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color: topColor },
    { offset: 1, color: bottomColor },
  ]);
  const accent = meta.accent || palette.brand;
  const mainBarGradient = () => verticalGradient(shade(accent, 18), accent);
  document.title = `${trackDisplayName} · Registration Landscape`;

  // Tint the header dot to track accent
  const dot = document.querySelector('.topbar .brand .dot');
  if (dot && meta.accent) {
    dot.style.background = `linear-gradient(135deg, ${meta.accent} 0%, ${shade(meta.accent, -18)} 100%)`;
    dot.style.boxShadow = `0 4px 12px ${meta.accent}55`;
  }

  // Hero
  document.getElementById('track-name').textContent = trackDisplayName;
  const trackTagline = document.getElementById('track-tagline');
  if (trackTagline) trackTagline.remove();
  const heroAccent = document.getElementById('track-accent');
  if (heroAccent) {
    heroAccent.style.background = `linear-gradient(96deg, ${meta.accent} 0%, ${shade(meta.accent, -22)} 100%)`;
    heroAccent.style.color = '#fffaf5';
  }
  const heroH1 = document.getElementById('track-h1');
  if (heroH1) {
    const grad = heroH1.querySelector('.gradient');
    if (grad) {
      grad.style.background = `linear-gradient(96deg, ${shade(meta.accent, -16)} 0%, ${meta.accent} 100%)`;
      grad.style.backgroundClip = 'text';
      grad.style.webkitBackgroundClip = 'text';
      grad.style.color = 'transparent';
      grad.style.webkitTextFillColor = 'transparent';
    }
  }

  const landscapeRecords = data.records.filter((record) => record.main_landscape);
  const kpiRecords = landscapeRecords.length ? landscapeRecords : data.records;
  const originCounts = countBy(kpiRecords, (record) => record.origin);

  // KPIs
  setKpi('kpi-main', kpiRecords.length || data.kpi.total);
  setKpi('kpi-companies', unique(kpiRecords.map((record) => record.company)).length || data.kpi.companies);
  setKpi('kpi-indications', unique(kpiRecords.flatMap(indicationValues)).length || data.kpi.indications);
  setKpi('kpi-forms', unique(kpiRecords.map((record) => isHaTrack ? productShape(record) : record.material_form)).length);
  setKpi('kpi-verified', kpiRecords.filter((record) => record.verified).length || data.kpi.verified);
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
  renderDonut('chart-origin', data.origin_share, '产地结构');

  // Material intensity list
  renderIntensityList('chart-material', data.records, 'material_family');
  renderIntensityList('chart-collagen-source', data.records, 'collagen_source');

  // Fusion modules: Claude layout, Codex analytical content.
  renderProductShapeList('chart-product-forms', data.records);
  renderMarketScopeCards(data.records);

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

  function renderCompanyShare(items, longTail) {
    const el = document.getElementById('chart-companies');
    if (!el) return;
    const inst = ChartFactory.make(el, {
      grid: { left: 130, right: 36, top: 12, bottom: 18 },
      tooltip: {
        formatter: (p) => `<b>${escape(p.name)}</b><br/>${p.value} 张证 (${(p.value / sum(items) * 100).toFixed(1)}%)`,
      },
      xAxis: { type: 'value', splitLine: { lineStyle: { color: palette.hairline, type: 'dashed' } } },
      yAxis: {
        type: 'category', data: items.map((i) => i.name).reverse(),
        axisLabel: {
          color: palette.ink, fontSize: 12,
          formatter: (v) => v.length > 14 ? v.slice(0, 14) + '…' : v,
        },
      },
      series: [{
        type: 'bar', barMaxWidth: 22,
        data: items.map((i, idx) => ({
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
      showRecords({ title: `${p.name} · ${trackDisplayName}`, meta: '主格局口径', records: displayRecords(matches) });
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
    const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
    const max = sorted[0][1].length;

    const list = document.createElement('div');
    list.className = 'intensity-list';

    sorted.forEach(([cat, recs], idx) => {
      const ratio = recs.length / max;
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
            ${recs.length}
          </div>
        </div>
      `;
      attachIntensityTooltip(row, cat, recs);
      row.addEventListener('click', () => {
        window.RI.showRecords({
          title: displayUiLabel(cat),
          meta: `${trackDisplayName} · ${categoryKey === 'primary_indication' ? '适应证 / 部位' : '材料家族'}`,
          records: displayRecords(recs),
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
          <span class="t-prod">${escape(r.product_name || '—')}</span>
          ${cert}
        </li>`;
      }).join('');
      const more = recs.length > 10
        ? `<div class="t-more">… 另 ${recs.length - 10} 条 (点击查看全部)</div>` : '';
      tip.innerHTML = `
        <div class="t-head">
          <strong>${escape(displayUiLabel(cat))}</strong>
          <span class="t-count">${recs.length} 张证</span>
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

  function productShape(record) {
    if (!isHaTrack) return displayUiLabel(record?.material_form || record?.material_family || '未分型');
    const text = `${record?.material_form || ''} ${record?.product_name || ''} ${record?.material_family || ''}`;
    if (/复合溶液|水光|肤质|非交联HA溶液|透明质酸钠溶液/.test(text)) return '非交联水光、肤质改善类';
    return '交联填充类';
  }

  function productShapeSortValue(name) {
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

  function renderProductShapeList(elId, source) {
    const el = document.getElementById(elId);
    if (!el) return;
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
        label: '优势差异',
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
        if (card) showRecords({ title: card.title, meta: `${trackDisplayName} · 市场口径`, records: displayRecords(card.records) });
      });
    });
  }

  function hasLidocaineAdvantage(record) {
    const tags = Array.isArray(record?.tags) ? record.tags.join(' ') : '';
    return /含利多卡因/.test(`${tags} ${record?.material_form || ''} ${record?.product_name || ''}`);
  }

  function matrixAxisLabel(label, count) {
    return `${escape(label)}<span class="matrix-axis-count">${Number(count || 0)}</span>`;
  }

  function renderProductShapeIndicationMatrix(source) {
    const holder = document.getElementById('chart-form-indication-matrix');
    if (!holder) return;
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
    const minWidth = 220 + columns.length * 116;
    holder.innerHTML = `
      <div class="matrix-wrap">
        <div class="matrix-grid track-form-indication-grid" style="min-width:${minWidth}px;grid-template-columns:minmax(166px, 196px) repeat(${columns.length}, minmax(92px, 1fr))">
          <div class="matrix-head">产品形态</div>
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
    bindTrackMatrixInteractions(holder, '产品形态 × 适应证');
  }

  function renderCompanyMatrixList(source) {
    const holder = document.getElementById('company-matrix-list');
    if (!holder) return;
    const paint = () => {
      const rows = companyRows(source);
      rows.sort((a, b) =>
        b.shapes.length - a.shapes.length
        || b.records.length - a.records.length
        || b.indications.length - a.indications.length
        || a.name.localeCompare(b.name, 'zh-CN')
      );
      const max = Math.max(1, ...rows.map((row) => row.records.length));
      holder.innerHTML = rows.map((row) => {
        const width = Math.max(6, (row.records.length / max) * 100);
        const brands = unique(row.records.map((record) => record.product_name)).slice(0, 6).map(displayUiLabel).join(' / ');
        const payload = encodeURIComponent(JSON.stringify(displayRecords(row.records)));
        return `
          <button class="company-matrix-row" type="button" data-records="${payload}" data-name="${escape(row.name)}">
            <span class="company-matrix-main">
              <strong>${escape(row.name)}</strong>
              <em>${escape(brands)}</em>
              <span class="company-matrix-bar"><i style="width:${width}%"></i></span>
            </span>
            <span class="company-matrix-stat"><b>${row.records.length}</b><small>注册证</small></span>
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
    const domestic = mixColor ? mixColor(accent, '#fbdec7', 0.78) : shade(accent, 38);
    const hkmt = mixColor ? mixColor(shade(accent, -34), '#6E6A65', 0.36) : shade(accent, -34);
    return {
      进口: {
        solid: imported,
        gradient: verticalGradient(shade(accent, 14), imported),
        label: '#fffaf5',
      },
      国产: {
        solid: domestic,
        gradient: verticalGradient(mixColor ? mixColor(accent, '#fff8ef', 0.86) : shade(accent, 48), domestic),
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
    return crystalCssHeatVars(value, max, { base: accent, fgDark: '#231812' });
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
          itemStyle: { shadowBlur: 18, shadowColor: 'rgba(28,22,18,0.15)' },
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
    const cum = yearly.map((row) => row.cumulative);
    const annualMax = Math.max(1, ...annual);
    const inst = ChartFactory.make(document.getElementById('chart-timeline'), {
      legend: { show: false },
      tooltip: {
        trigger: 'axis',
        formatter: (items) => {
          const index = items[0]?.dataIndex ?? 0;
          const row = yearly[index];
          return `<b>${row.year}</b><br/>当年新增: ${row.count} 张<br/>累计获批: ${row.cumulative} 张`;
        },
      },
      grid: { left: 44, right: 44, top: 30, bottom: 32 },
      xAxis: { type: 'category', data: years, boundaryGap: true },
      yAxis: [
        { type: 'value', name: '当年新增', max: Math.ceil(annualMax / 5) * 5, splitLine: { lineStyle: { color: palette.hairline, type: 'dashed' } } },
        { type: 'value', name: '累计', splitLine: { show: false } },
      ],
      series: [
        {
          name: '当年新增', type: 'bar', barMaxWidth: chartBarMaxWidth,
          itemStyle: {
            color: mainBarGradient(),
            borderRadius: chartBarRadius,
          },
          label: { show: true, position: 'top', color: palette.ink2, fontSize: 11, fontWeight: 600 },
          data: annual,
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
      const matches = recordsForTimelineYear(data.records, year);
      showRecords({ title: `${year} 年新增`, meta: trackDisplayName, records: displayRecords(matches) });
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
        cumulative: Number(row.cumulative || 0),
        进口: Number(row['进口'] || 0),
        国产: Number(row['国产'] || 0),
      }));
    }
    const years = Array.isArray(t?.years) ? t.years : [];
    const values = Array.isArray(t?.values) ? t.values : [];
    const originByYear = new Map();
    data.records
      .filter((record) => record.main_landscape)
      .forEach((record) => {
        const year = recordTimelineYear(record);
        if (!year) return;
        if (!originByYear.has(year)) originByYear.set(year, { 国产: 0, 进口: 0, 港澳台: 0 });
        const bucket = originByYear.get(year);
        const origin = record.origin || '国产';
        if (origin in bucket) bucket[origin] += 1;
      });
    let cumulative = 0;
    return years.map((year, index) => {
      const count = Number(values[index] || 0);
      cumulative += count;
      const origins = originByYear.get(Number(year)) || {};
      return {
        year: Number(year),
        count,
        cumulative,
        进口: Number(origins['进口'] || 0),
        国产: Number(origins['国产'] || 0),
        港澳台: Number(origins['港澳台'] || 0),
      };
    });
  }

  function recordsForTimelineYear(source, year) {
    return source.filter((record) => record.main_landscape && recordTimelineYear(record) === Number(year));
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
    if (!hm.companies.length || !hm.indications.length) {
      el.innerHTML = '<div class="muted" style="text-align:center;padding:40px">数据不足</div>';
      return;
    }
    const max = Math.max(...hm.companies.flatMap((company) =>
      hm.indications.map((indication) => companyIndicationMatches(company, indication).length)
    ), 1);
    const companyTotals = new Map(hm.companies.map((company) => [
      company,
      data.records.filter((record) => record.main_landscape && (record.company || '未标注厂家') === company).length,
    ]));
    const indicationTotals = new Map(hm.indications.map((indication) => [
      indication,
      data.records.filter((record) => record.main_landscape && indicationValues(record).includes(indication)).length,
    ]));
    const minWidth = Math.max(1120, 220 + hm.indications.length * 120);
    const body = hm.companies.map((company) => {
      const cells = hm.indications.map((indication) => {
        const matches = companyIndicationMatches(company, indication);
        const count = matches.length;
        const payload = encodeURIComponent(JSON.stringify(displayRecords(matches)));
        return `<button type="button" class="matrix-cell" data-heat="${count ? 'active' : 'empty'}" style="${heatVars(count, max)}" data-records="${payload}" data-tooltip="${escape(matrixTooltipFromRecords(matches))}" data-title="${escape(`${company} × ${indicationLabel(indication)}`)}" aria-label="${escape(`${company} × ${indicationLabel(indication)}：${count} 张`)}">${count || ''}</button>`;
      }).join('');
      return `<div class="matrix-term" title="${escape(company)}">${matrixAxisLabel(company, companyTotals.get(company))}</div>${cells}`;
    }).join('');
    el.classList.remove('chart', 'chart-xl');
    el.innerHTML = `
      <div class="matrix-wrap">
        <div class="matrix-grid track-company-indication-grid" style="min-width:${minWidth}px;grid-template-columns:minmax(182px, 220px) repeat(${hm.indications.length}, minmax(108px, 1fr))">
          <div class="matrix-head">厂家</div>
          ${hm.indications.map((indication) => `<div class="matrix-head" title="${escape(indicationLabel(indication))}">${matrixAxisLabel(indicationLabel(indication), indicationTotals.get(indication))}</div>`).join('')}
          ${body}
        </div>
      </div>
    `;
    bindTrackMatrixInteractions(el, '厂家和适应症卡位');
  }

  function renderRecords(records) {
    const tbody = document.querySelector('#table-records tbody');
    const filterOrigin = document.getElementById('filter-origin');
    const filterVerified = document.getElementById('filter-verified');
    const search = document.getElementById('search');
    if (!tbody) return;

    function paint() {
      const fo = filterOrigin?.value || '';
      const fv = filterVerified?.value || '';
      const fs = (search?.value || '').trim().toLowerCase();
      const filtered = records.filter((r) => {
        if (!r.main_landscape) return false;
        if (fo && r.origin !== fo) return false;
        if (fv === 'verified' && !r.verified) return false;
        if (fv === 'pending' && r.verified) return false;
        if (fs) {
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
        note.innerHTML = `<td colspan="7" class="muted" style="text-align:center">仅显示前 80 条,共 ${filtered.length} 条匹配</td>`;
        tbody.appendChild(note);
      }
    }

    function renderDefaultRecordRow(r) {
      return `
        <tr data-id="${escape(r.id)}">
          <td>${escape(productBrandLabel(r))}</td>
          <td>
            <b>${escape(r.product_name || '—')}</b>
            <div class="muted" style="font-size:11.5px">${escape(displayUiLabel(r.material_form || r.material_family || ''))}</div>
            ${isHaTrack ? `<div class="table-tag-row"><span class="tag product-shape-tag">${escape(productShape(r))}</span></div>` : ''}
          </td>
          <td>${escape(r.company)}</td>
          <td><span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px">${escape(r.certificate_no || '—')}</span></td>
          <td>${escape(r.origin || '—')}</td>
          <td>${escape(formatIndications(r))}</td>
          <td>${escape(r.approval_date || '—')}</td>
          <td>${verificationBadge(r)}</td>
        </tr>
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
          <td>${escape(r.origin || '—')}</td>
          <td>
            ${escape(primary)}
            ${scopeLine}
          </td>
          <td>
            <span>${escape(r.approval_date || '—')}</span>
            ${r.valid_until ? `<div class="muted" style="font-size:11.5px">有效至 ${escape(r.valid_until)}</div>` : ''}
          </td>
          <td>${verificationBadge(r)}</td>
        </tr>
      `;
    }

    [filterOrigin, filterVerified, search]
      .filter(Boolean)
      .forEach((el) => el.addEventListener('input', paint));
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
        || b.records.length - a.records.length
        || a.company.localeCompare(b.company, 'zh-CN')
      )
      .map((row) => row.company);
    const indicationCounts = countBy(landscape.flatMap(indicationValues), (name) => name);
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

  function indicationValues(record) {
    const values = [
      ...normalizeIndicationValues(record?.approved_indications || record?.approvedIndications || ''),
      ...(Array.isArray(record?.indications) ? record.indications.flatMap(normalizeIndicationValues) : []),
      ...normalizeIndicationValues(record?.official_indication || record?.officialIndication || ''),
      ...normalizeIndicationValues(record?.primary_indication || record?.primaryIndication || ''),
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
    return displayUiLabel(record?.brand || record?.commercial_name || record?.aliases || '');
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
    return records.map((record) => {
      const mapped = { ...record, primary_indication: formatIndications(record) };
      if (isCollagenTrack) {
        mapped.tags = [collagenSourceTag(record)];
        mapped.hide_origin_tag = true;
      }
      return mapped;
    });
  }

  function normalizeIndicationValues(value) {
    return String(value || '')
      .split(/[、,，;；|]+/)
      .flatMap(splitIndicationToken)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function splitIndicationToken(value) {
    const text = String(value || '').trim();
    if (!text) return [];
    const compact = text.replace(/\s+/g, '');
    const combined = {
      '颏下脂肪堆积/双下巴': '颏下脂肪堆积（双下巴）',
      '双下巴/颏下脂肪堆积': '颏下脂肪堆积（双下巴）',
      '下颏/下颌部': '下颏/下颌部',
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
    .replace(/羟基磷酸钙\s*\/\s*CaHA/g, 'CaHA')
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
