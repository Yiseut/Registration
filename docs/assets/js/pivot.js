/* Custom pivot workspace for Registration Insights. */

(async function initPivot() {
  const {
    palette,
    SERIES_COLORS,
    ChartFactory,
    showRecords,
    escape,
    loadJSON,
  } = window.RI;

  const fields = [
    { id: 'track_name', label: '赛道' },
    { id: 'product_shape', label: '产品形态' },
    { id: 'origin', label: '国产/进口' },
    { id: 'position_tier', label: '定位层级' },
    { id: 'country_region', label: '国家/地区' },
    { id: 'lidocaine_signal', label: '利多卡因状态' },
    { id: 'lidocaine_candidate', label: '是否含利多卡因' },
    { id: 'material_form', label: '材料/剂型' },
    { id: 'primary_indication', label: '适应证' },
    { id: 'company', label: '注册人/集团' },
    { id: 'approval_year', label: '批准年份' },
    { id: 'verified_status', label: '核验状态' },
  ];
  const fieldMap = new Map(fields.map((field) => [field.id, field]));
  const defaultState = {
    rows: ['lidocaine_signal'],
    columns: ['position_tier'],
    filterFields: ['track_name', 'product_shape'],
    filters: {
      track_name: '透明质酸钠',
      product_shape: '交联填充类',
    },
    metric: 'records',
    scope: 'main',
    search: '',
  };
  const state = restoreStateFromUrl(defaultState);
  let allRecords = [];
  let pivotResult = null;
  let chart = null;

  try {
    allRecords = await loadRecords();
  } catch (error) {
    document.querySelector('.pivot-main').innerHTML = `<section class="card"><p class="muted">数据加载失败：${escape(error.message || error)}</p></section>`;
    return;
  }

  renderFieldPool();
  bindControls();
  render();

  async function loadRecords() {
    const manifest = await loadJSON('assets/data/manifest.json');
    const datasets = await Promise.all((manifest.tracks || []).map(async (track) => {
      const data = await loadJSON(track.data_url);
      const meta = data.track_meta || track;
      return (data.records || []).map((record) => enrichRecord(record, meta));
    }));
    return datasets.flat();
  }

  function enrichRecord(record, trackMeta) {
    const trackName = displayUiLabel(trackMeta.name || record.track_name || record.track || '未标注赛道');
    const productShapeValue = productShape(record, trackMeta.key);
    const lidocaine = lidocaineSignal(record);
    const positionTier = positionTierFor(record, trackMeta.key);
    const countryRegion = countryRegionFor(record, trackMeta.key, positionTier);
    const primaryIndication = normalizeMultiValue(record.primary_indication || record.official_indication || record.approved_indications || '未标注');
    const approvalYear = approvalYearFor(record);
    return {
      ...record,
      track_key: trackMeta.key || record.track_key || record.track,
      track_name: trackName,
      _pivot: {
        track_name: trackName,
        product_shape: productShapeValue,
        origin: record.origin || '未标注',
        position_tier: positionTier,
        country_region: countryRegion,
        lidocaine_signal: lidocaine.label,
        lidocaine_candidate: lidocaine.hasLidocaine ? '含利多卡因' : '未见利多卡因',
        material_form: displayUiLabel(record.material_form || record.material_family || '未标注'),
        primary_indication: primaryIndication,
        company: displayUiLabel(record.company || record.registrant || '未标注'),
        approval_year: approvalYear || '未标注',
        verified_status: record.verified ? '已核验' : '待核验',
      },
      tags: [
        productShapeValue,
        positionTier,
        countryRegion,
        lidocaine.hasLidocaine ? lidocaine.label : '',
      ].filter(Boolean),
    };
  }

  function renderFieldPool() {
    const pool = document.getElementById('pivot-field-pool');
    pool.innerHTML = fields.map((field) => `
      <button type="button" class="pivot-field" draggable="true" data-field-id="${escape(field.id)}">
        <span>${escape(field.label)}</span>
      </button>
    `).join('');
    pool.querySelectorAll('.pivot-field').forEach((button) => {
      button.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', button.dataset.fieldId);
        event.dataTransfer.effectAllowed = 'copy';
      });
      button.addEventListener('dblclick', () => {
        addFieldToZone(button.dataset.fieldId, 'rows');
      });
    });
  }

  function bindControls() {
    document.querySelectorAll('.pivot-zone').forEach((zone) => {
      zone.addEventListener('dragover', (event) => {
        event.preventDefault();
        zone.classList.add('drag-over');
      });
      zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
      zone.addEventListener('drop', (event) => {
        event.preventDefault();
        zone.classList.remove('drag-over');
        const fieldId = event.dataTransfer.getData('text/plain');
        addFieldToZone(fieldId, zone.dataset.zone);
      });
    });

    document.getElementById('pivot-metric').addEventListener('change', (event) => {
      state.metric = event.target.value;
      render();
    });
    document.getElementById('pivot-scope').addEventListener('change', (event) => {
      state.scope = event.target.value;
      render();
    });
    document.getElementById('pivot-search').addEventListener('input', (event) => {
      state.search = event.target.value.trim();
      render();
    });
    document.querySelectorAll('[data-preset]').forEach((button) => {
      button.addEventListener('click', () => applyPreset(button.dataset.preset));
    });
  }

  function addFieldToZone(fieldId, zone) {
    if (!fieldMap.has(fieldId)) return;
    if (zone === 'rows') {
      state.rows = unique([...state.rows, fieldId]);
    } else if (zone === 'columns') {
      state.columns = unique([...state.columns, fieldId]);
    } else if (zone === 'filters') {
      state.filterFields = unique([...state.filterFields, fieldId]);
      if (!(fieldId in state.filters)) state.filters[fieldId] = '';
    }
    render();
  }

  function removeField(fieldId, zone) {
    if (zone === 'rows') state.rows = state.rows.filter((item) => item !== fieldId);
    if (zone === 'columns') state.columns = state.columns.filter((item) => item !== fieldId);
    if (zone === 'filters') {
      state.filterFields = state.filterFields.filter((item) => item !== fieldId);
      delete state.filters[fieldId];
    }
    render();
  }

  function applyPreset(name) {
    if (name === 'ha-country') {
      Object.assign(state, {
        rows: ['lidocaine_signal'],
        columns: ['country_region'],
        filterFields: ['track_name', 'product_shape'],
        filters: { track_name: '透明质酸钠', product_shape: '交联填充类' },
        metric: 'records',
        scope: 'main',
      });
    } else if (name === 'origin-track') {
      Object.assign(state, {
        rows: ['track_name'],
        columns: ['origin'],
        filterFields: [],
        filters: {},
        metric: 'records',
        scope: 'main',
      });
    } else {
      Object.assign(state, {
        rows: ['lidocaine_signal'],
        columns: ['position_tier'],
        filterFields: ['track_name', 'product_shape'],
        filters: { track_name: '透明质酸钠', product_shape: '交联填充类' },
        metric: 'records',
        scope: 'main',
      });
    }
    document.getElementById('pivot-search').value = '';
    state.search = '';
    render();
  }

  function render() {
    document.getElementById('pivot-metric').value = state.metric;
    document.getElementById('pivot-scope').value = state.scope;
    document.getElementById('pivot-search').value = state.search || '';
    renderZone('rows', state.rows, document.getElementById('pivot-rows'));
    renderZone('columns', state.columns, document.getElementById('pivot-columns'));
    renderFilters();
    const records = filteredRecords();
    pivotResult = buildPivot(records);
    renderKpis(records, pivotResult);
    renderTable(pivotResult);
    renderChart(pivotResult);
    writeStateToUrl();
  }

  function renderZone(zone, ids, holder) {
    holder.innerHTML = ids.length
      ? ids.map((fieldId) => assignedChip(fieldId, zone)).join('')
      : '<span class="pivot-zone-placeholder">拖入变量</span>';
    holder.querySelectorAll('[data-remove-field]').forEach((button) => {
      button.addEventListener('click', () => removeField(button.dataset.removeField, button.dataset.zone));
    });
  }

  function assignedChip(fieldId, zone) {
    const field = fieldMap.get(fieldId);
    return `
      <span class="pivot-assigned-chip">
        ${escape(field?.label || fieldId)}
        <button type="button" aria-label="移除${escape(field?.label || fieldId)}" data-remove-field="${escape(fieldId)}" data-zone="${escape(zone)}">×</button>
      </span>
    `;
  }

  function renderFilters() {
    const holder = document.getElementById('pivot-filters');
    if (!state.filterFields.length) {
      holder.innerHTML = '<span class="pivot-zone-placeholder">拖入变量生成筛选器</span>';
      return;
    }
    const baseRecords = allRecords.filter((record) => state.scope === 'all' || record.main_landscape);
    holder.innerHTML = state.filterFields.map((fieldId) => {
      const field = fieldMap.get(fieldId);
      const values = sortedValues(baseRecords.map((record) => valueFor(record, fieldId)));
      const selected = state.filters[fieldId] || '';
      return `
        <label class="pivot-filter">
          <span>${escape(field?.label || fieldId)}</span>
          <select data-filter-field="${escape(fieldId)}">
            <option value="">全部</option>
            ${values.map((value) => `<option value="${escape(value)}"${value === selected ? ' selected' : ''}>${escape(value)}</option>`).join('')}
          </select>
          <button type="button" aria-label="移除筛选器" data-remove-field="${escape(fieldId)}" data-zone="filters">×</button>
        </label>
      `;
    }).join('');
    holder.querySelectorAll('[data-filter-field]').forEach((select) => {
      select.addEventListener('change', () => {
        state.filters[select.dataset.filterField] = select.value;
        render();
      });
    });
    holder.querySelectorAll('[data-remove-field]').forEach((button) => {
      button.addEventListener('click', () => removeField(button.dataset.removeField, button.dataset.zone));
    });
  }

  function filteredRecords() {
    const search = (state.search || '').toLowerCase();
    return allRecords.filter((record) => {
      if (state.scope !== 'all' && !record.main_landscape) return false;
      for (const [fieldId, value] of Object.entries(state.filters)) {
        if (value && valueFor(record, fieldId) !== value) return false;
      }
      if (search) {
        const hay = [
          record.product_name,
          record.official_product_name,
          record.company,
          record.registrant,
          record.certificate_no,
          record.primary_indication,
          ...Object.values(record._pivot || {}),
        ].join(' ').toLowerCase();
        if (!hay.includes(search)) return false;
      }
      return true;
    });
  }

  function buildPivot(records) {
    const rowFields = state.rows.length ? state.rows : ['__all'];
    const columnFields = state.columns.length ? state.columns : ['__all'];
    const rowMap = new Map();
    const colMap = new Map();
    const cellMap = new Map();
    records.forEach((record) => {
      const rowKey = comboKey(record, rowFields);
      const colKey = comboKey(record, columnFields);
      if (!rowMap.has(rowKey)) rowMap.set(rowKey, { key: rowKey, label: comboLabel(record, rowFields), records: [] });
      if (!colMap.has(colKey)) colMap.set(colKey, { key: colKey, label: comboLabel(record, columnFields), records: [] });
      rowMap.get(rowKey).records.push(record);
      colMap.get(colKey).records.push(record);
      const cellKey = `${rowKey}::${colKey}`;
      if (!cellMap.has(cellKey)) cellMap.set(cellKey, []);
      cellMap.get(cellKey).push(record);
    });
    const rows = [...rowMap.values()].sort((a, b) => metricValue(b.records) - metricValue(a.records) || a.label.localeCompare(b.label, 'zh-CN'));
    const columns = [...colMap.values()].sort((a, b) => metricValue(b.records) - metricValue(a.records) || a.label.localeCompare(b.label, 'zh-CN'));
    return { records, rows, columns, cellMap };
  }

  function renderKpis(records, result) {
    document.getElementById('pivot-kpi-records').textContent = records.length.toLocaleString();
    document.getElementById('pivot-kpi-rows').textContent = result.rows.length.toLocaleString();
    document.getElementById('pivot-kpi-cols').textContent = result.columns.length.toLocaleString();
    document.getElementById('pivot-kpi-cells').textContent = (result.rows.length * result.columns.length).toLocaleString();
  }

  function renderTable(result) {
    const table = document.getElementById('pivot-table');
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    const metricLabel = metricName();
    const rowHeader = state.rows.length ? state.rows.map((fieldId) => fieldMap.get(fieldId)?.label || fieldId).join(' / ') : '全部';
    thead.innerHTML = `
      <tr>
        <th>${escape(rowHeader)}</th>
        ${result.columns.map((column) => `<th class="num">${escape(column.label)}</th>`).join('')}
        <th class="num">合计</th>
      </tr>
    `;
    if (!result.rows.length) {
      tbody.innerHTML = `<tr><td colspan="${result.columns.length + 2}" class="muted" style="text-align:center">没有匹配记录</td></tr>`;
      return;
    }
    tbody.innerHTML = result.rows.map((row) => {
      const cells = result.columns.map((column) => {
        const cellRecords = result.cellMap.get(`${row.key}::${column.key}`) || [];
        const value = metricValue(cellRecords);
        return `<td class="num">${cellButton(value, cellRecords, `${row.label} × ${column.label}`, metricLabel)}</td>`;
      }).join('');
      return `
        <tr>
          <td><b>${escape(row.label)}</b></td>
          ${cells}
          <td class="num total-cell">${cellButton(metricValue(row.records), row.records, `${row.label} · 合计`, metricLabel)}</td>
        </tr>
      `;
    }).join('') + `
      <tr class="pivot-total-row">
        <td><b>合计</b></td>
        ${result.columns.map((column) => `<td class="num total-cell">${cellButton(metricValue(column.records), column.records, `${column.label} · 合计`, metricLabel)}</td>`).join('')}
        <td class="num total-cell">${cellButton(metricValue(result.records), result.records, '全部记录', metricLabel)}</td>
      </tr>
    `;
    tbody.querySelectorAll('[data-cell-records]').forEach((button) => {
      button.addEventListener('click', () => {
        const indexes = JSON.parse(button.dataset.cellRecords || '[]');
        const records = indexes.map((index) => result.records[index]).filter(Boolean);
        showRecords({
          title: button.dataset.title || '透视明细',
          meta: `${metricLabel} · 自定义透视`,
          records,
        });
      });
    });
  }

  function cellButton(value, records, title, metricLabel) {
    if (!value) return '<span class="muted">—</span>';
    const indexes = records.map((record) => pivotResult.records.indexOf(record)).filter((index) => index >= 0);
    return `<button type="button" class="pivot-cell-button" data-title="${escape(title)}" data-cell-records="${escape(JSON.stringify(indexes))}" title="${escape(`${title}：${value} ${metricLabel}`)}">${value.toLocaleString()}</button>`;
  }

  function renderChart(result) {
    const el = document.getElementById('pivot-chart');
    const subtitle = document.getElementById('pivot-chart-subtitle');
    subtitle.textContent = `${metricName()} · ${result.records.length} 张记录参与计算`;
    if (!result.rows.length || !result.columns.length) {
      if (chart) chart.clear();
      el.innerHTML = '<div class="muted" style="text-align:center;padding:40px">暂无可视化数据</div>';
      return;
    }
    el.innerHTML = '';
    const rows = result.rows.slice(0, 16);
    const columns = result.columns.slice(0, 10);
    const option = {
      legend: { bottom: 0, data: columns.map((column) => column.label) },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      grid: { left: 48, right: 28, top: 24, bottom: 72 },
      xAxis: {
        type: 'category',
        data: rows.map((row) => shortLabel(row.label, 12)),
        axisLabel: { interval: 0, rotate: rows.length > 8 ? 28 : 0 },
      },
      yAxis: { type: 'value', name: metricName(), splitLine: { lineStyle: { color: palette.hairline, type: 'dashed' } } },
      series: columns.map((column, index) => ({
        name: column.label,
        type: 'bar',
        stack: 'pivot',
        barMaxWidth: 28,
        itemStyle: {
          color: SERIES_COLORS[index % SERIES_COLORS.length],
          borderRadius: index === columns.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0],
        },
        data: rows.map((row) => metricValue(result.cellMap.get(`${row.key}::${column.key}`) || [])),
      })),
    };
    if (!chart) chart = ChartFactory.make(el, option);
    else chart.setOption(option, true);
  }

  function comboKey(record, fieldIds) {
    return fieldIds.map((fieldId) => valueFor(record, fieldId)).join('\u001f');
  }

  function comboLabel(record, fieldIds) {
    if (fieldIds.includes('__all')) return '全部';
    return fieldIds.map((fieldId) => valueFor(record, fieldId)).join(' / ');
  }

  function valueFor(record, fieldId) {
    if (fieldId === '__all') return '全部';
    const value = record?._pivot?.[fieldId];
    return String(value || '未标注');
  }

  function metricValue(records) {
    if (state.metric === 'companies') return unique(records.map((record) => record.company || record.registrant)).length;
    if (state.metric === 'indications') return unique(records.map((record) => valueFor(record, 'primary_indication'))).length;
    return records.length;
  }

  function metricName() {
    if (state.metric === 'companies') return '注册人/集团数';
    if (state.metric === 'indications') return '适应证数';
    return '注册证数';
  }

  function sortedValues(values) {
    return unique(values).sort((a, b) => String(a).localeCompare(String(b), 'zh-CN', { numeric: true }));
  }

  function productShape(record, trackKey) {
    if (trackKey === 'ebd') return ebdSubtype(record);
    if (trackKey === 'ha') {
      const text = `${record.material_form || ''} ${record.product_name || ''} ${record.material_family || ''}`;
      if (/复合溶液|水光|肤质|非交联HA溶液|透明质酸钠溶液/.test(text)) return '非交联水光、肤质改善类';
      return '交联填充类';
    }
    return displayUiLabel(record.material_form || record.material_family || '未标注');
  }

  function ebdSubtype(record) {
    const text = [
      record.product_name,
      record.category,
      record.track_name,
      record.material_family,
      record.material_form,
      ...(Array.isArray(record.tags) ? record.tags : []),
    ].filter(Boolean).join(' ');
    if (/射频微针|黄金微针|Electrosurgical Unit|微针治疗仪/.test(text)) return '射频微针';
    if (/Thermage|热玛吉|单极射频/.test(text)) return '单极射频';
    if (/射频塑形|吸脂术前脂肪软化/.test(text)) return '射频塑形';
    if (/聚焦超声|超声皮肤治疗/.test(text)) return '聚焦超声';
    if (/皮秒|Nd:YAG|文身祛除/.test(text)) return '皮秒激光';
    if (/射频皮肤治疗|射频设备|射频治疗仪/.test(text)) return '射频皮肤治疗';
    return displayUiLabel(record.category || record.track_name || '其他设备');
  }

  function lidocaineSignal(record) {
    const titleText = [
      record.brand,
      record.aliases,
      record.commercial_name,
      record.product_name,
      record.official_product_name,
      Array.isArray(record.tags) ? record.tags.join(' ') : record.tags,
      Array.isArray(record.product_tags) ? record.product_tags.join(' ') : record.product_tags,
    ].filter(Boolean).join(' ');
    const hasLidocaine = record.lidocaine_status === '含利多卡因' || /(利多卡因|lidocaine)/i.test(titleText);
    return {
      hasLidocaine,
      label: hasLidocaine ? '含利多卡因' : '未见利多卡因',
    };
  }

  function positionTierFor(record, trackKey) {
    const origin = record.origin || '';
    const text = recordText(record);
    if (origin === '国产') return '国产';
    if (origin === '港澳台') return '港澳台';
    if (trackKey === 'ha' && /(韩国|Korea|Korean|LG Chem|CHA Meditech|Forest Hills|Dong Bang|ACROSS|GENOSS|JETEMA|Humedix|CG Bio|YooYoung|SCL|BNC|Cutegel|HyaFilia|Dermalax|MONALISA|A-Viearchee|东方医疗|东邦医疗|吉诺斯|汇美迪斯|细基生物|柳英|捷特玛|爱思尔|亚可罗思)/i.test(text)) return '韩国进口';
    if (trackKey === 'ha' && /(AbbVie|Allergan|Juv[eé]derm|Galderma|Q-Med|Restylane|Merz|Belotero|Anteis|CROMA|Princess|Kylane|SYMATESE|PRECISE|Adoderm|Hyabell|VIVACY|Laboratoires|Fill-Med|S&V|GmbH|SA|SAS|瑞士|法国|德国|奥地利|美国|高德美|艾尔建|麦施美学|安缇思|克罗玛|基兰|希玛德|艾多德姆|菲欧曼|维瓦希)/i.test(text)) return '欧美进口';
    return origin === '进口' ? '其他进口' : (origin || '未标注');
  }

  function countryRegionFor(record, trackKey, positionTier) {
    const origin = record.origin || '';
    const text = recordText(record);
    if (origin === '国产') return '中国大陆';
    if (origin === '港澳台') return /科妍|和康|台湾/.test(text) ? '中国台湾' : '港澳台';
    if (trackKey === 'ha') {
      if (positionTier === '韩国进口') return '韩国';
      if (/Allergan|AbbVie|Juv[eé]derm|艾尔建/i.test(text)) return '美国';
      if (/Galderma|Q-Med|Restylane|高德美|科医/i.test(text)) return '瑞典/瑞士';
      if (/Merz|Anteis|麦施美学|安缇思/i.test(text)) return '德国/瑞士';
      if (/CROMA|Princess|克罗玛/i.test(text)) return '奥地利';
      if (/Kylane|基兰/i.test(text)) return '瑞士';
      if (/SYMATESE|VIVACY|Fill-Med|Laboratoires|希玛德|维瓦希|菲欧曼/i.test(text)) return '法国';
      if (/Adoderm|S&V|GmbH|艾多德姆/i.test(text)) return '德国';
    }
    return positionTier === '其他进口' ? '其他进口' : positionTier;
  }

  function recordText(record) {
    return [
      record.company,
      record.registrant,
      record.official_registrant,
      record.manufacturer_group,
      record.brand,
      record.aliases,
      record.product_name,
      record.official_product_name,
    ].filter(Boolean).join(' ');
  }

  function approvalYearFor(record) {
    if (Number(record.approval_year || 0)) return String(Number(record.approval_year));
    const dateMatch = String(record.approval_date || '').match(/20\d{2}/);
    if (dateMatch) return dateMatch[0];
    const certMatch = String(record.certificate_no || '').match(/20\d{2}/);
    return certMatch ? certMatch[0] : '';
  }

  function normalizeMultiValue(value) {
    const text = String(value || '').trim();
    if (!text) return '未标注';
    const parts = text.split(/[、,，;；|]+/).map((item) => item.trim()).filter(Boolean);
    if (!parts.length) return text;
    return parts.slice(0, 2).join('、') + (parts.length > 2 ? '等' : '');
  }

  function shortLabel(value, max) {
    const text = String(value || '');
    return text.length > max ? `${text.slice(0, max)}…` : text;
  }

  function unique(values) {
    return Array.from(new Set(values.filter((value) => value && String(value).trim())));
  }

  function displayUiLabel(value) {
    return String(value || '')
      .replaceAll('再生类', '胶原刺激剂')
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

  function restoreStateFromUrl(base) {
    const params = new URLSearchParams(location.search);
    const restored = {
      rows: parseList(params.get('rows')) || [...base.rows],
      columns: parseList(params.get('cols')) || [...base.columns],
      filterFields: [...base.filterFields],
      filters: { ...base.filters },
      metric: params.get('metric') || base.metric,
      scope: params.get('scope') || base.scope,
      search: params.get('q') || base.search,
    };
    params.forEach((value, key) => {
      if (!key.startsWith('f_')) return;
      const fieldId = key.slice(2);
      if (!fieldMap.has(fieldId)) return;
      restored.filterFields = unique([...restored.filterFields, fieldId]);
      restored.filters[fieldId] = value;
    });
    return restored;
  }

  function parseList(value) {
    if (!value) return null;
    const items = value.split(',').map((item) => item.trim()).filter((item) => fieldMap.has(item));
    return items.length ? items : null;
  }

  function writeStateToUrl() {
    const params = new URLSearchParams();
    if (state.rows.length) params.set('rows', state.rows.join(','));
    if (state.columns.length) params.set('cols', state.columns.join(','));
    if (state.metric !== defaultState.metric) params.set('metric', state.metric);
    if (state.scope !== defaultState.scope) params.set('scope', state.scope);
    if (state.search) params.set('q', state.search);
    state.filterFields.forEach((fieldId) => {
      const value = state.filters[fieldId];
      if (value) params.set(`f_${fieldId}`, value);
    });
    const next = `${location.pathname}${params.toString() ? `?${params.toString()}` : ''}${location.hash}`;
    if (next !== `${location.pathname}${location.search}${location.hash}`) {
      history.replaceState(null, '', next);
    }
  }
})();
