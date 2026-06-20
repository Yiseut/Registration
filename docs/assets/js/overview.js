/* Overview page wiring. */

(async function init() {
  const {
    palette,
    SERIES_COLORS,
    ChartFactory,
    showRecords,
    escape,
    loadJSON,
    watchKpis,
    crystalEchartHeatItemStyle,
    crystalHeatLabelColor,
  } = window.RI;

  const data = await loadJSON('assets/data/overview.json');
  const tracks = (await loadJSON('assets/data/manifest.json')).tracks;

  // ---- Hero meta ----
  setText('meta-generated', data.generated_at.slice(0, 10));
  setText('meta-records', data.kpi.total_records);

  // ---- KPIs ----
  const kpi = data.kpi;
  setKpi('kpi-companies', kpi.companies);
  setText('kpi-origin-total', kpi.main_records ?? '—');
  setText('kpi-origin-breakdown', `国内 ${kpi.domestic ?? '—'}张 · 进口 ${kpi.imported ?? '—'}张 · 港澳台 ${kpi.hkmt ?? '—'}张`);
  setKpi('kpi-recent', kpi.recent_12mo);
  setText('kpi-recent-share', kpi.recent_12mo_share);
  setText('kpi-recent-breakdown', kpi.recent_12mo_breakdown);

  watchKpis();

  // ---- Segment cards ----
  const grid = document.getElementById('segments-grid');
  data.segments.forEach((seg, i) => {
    const a = document.createElement('a');
    a.href = `tracks/${seg.key}.html`;
    a.className = 'segment-card';
    a.style.setProperty('--accent', seg.accent);
    a.innerHTML = `
      <div class="name" style="color:${seg.accent}">${escape(seg.name)}</div>
      <div class="tagline">${escape(seg.tagline)}</div>
      <div class="stats">
        <div><div class="v">${seg.main_records}</div><div class="l">核心证</div></div>
        <div><div class="v">${seg.companies}</div><div class="l">注册人</div></div>
        <div><div class="v">${seg.verified}</div><div class="l">已核验</div></div>
      </div>
      <div class="muted" style="font-size:12px">头部 · ${escape(seg.leading_company)}${seg.latest_year ? ` · 最新 ${seg.latest_year}` : ''}</div>
      <div class="arrow">→</div>
    `;
    grid.appendChild(a);
  });

  // ---- Portfolio matrix (heatmap-style) ----
  renderPortfolio(data.portfolio_matrix);

  // ---- Indication × material heatmap ----
  renderIndicationHeatmap(data.indication_heatmap);

  // ---- Cert expiry stack ----
  renderExpiry(data.cert_expiry);

  // ---- Origin evolution ----
  renderOriginEvolution(data.origin_evolution);

  // ---- Concentration table ----
  renderConcentration(data.concentration, tracks);

  // -----------------------------------------------------------------------

  function setKpi(id, to, opts = {}) {
    const el = document.getElementById(id);
    if (!el) return;
    el.dataset.animateTo = to;
    if (opts.decimals != null) el.dataset.decimals = opts.decimals;
    if (opts.suffix) el.dataset.suffix = opts.suffix;
    // do NOT reset textContent — watchKpis() paints the final value first as fallback.
  }

  function renderPortfolio(pm) {
    const segments = pm.segments;
    const rows = pm.rows;
    const cells = [];
    let maxV = 0;
    rows.forEach((row, y) => {
      segments.forEach((seg, x) => {
        const v = row.by_segment[seg] || 0;
        if (v > 0) cells.push([x, y, v]);
        if (v > maxV) maxV = v;
      });
    });
    const callout = document.getElementById('portfolio-callout');
    const fullStack = rows.filter((r) => r.segments_covered >= 3);
    const top = fullStack[0];
    if (top) {
      callout.innerHTML = `<b>${escape(top.company)}</b> 是目前覆盖最广的集团：跨 ${top.segments_covered} 个战略板块共 ${top.total} 张核心证。
        多赛道集团总数 ${fullStack.length} 家,其余 ${rows.length - fullStack.length} 家集中在 1–2 个板块。`;
    }

    const inst = ChartFactory.make(document.getElementById('chart-portfolio'), {
      grid: { left: 160, right: 80, top: 30, bottom: 24 },
      tooltip: {
        position: 'top',
        formatter: (p) => {
          const seg = segments[p.value[0]];
          const row = rows[p.value[1]];
          return `<b>${escape(row.company)}</b><br/>${escape(seg)} · ${p.value[2]} 张证<br/><span style="color:${palette.inkMute}">总 ${row.total} 张 · 覆盖 ${row.segments_covered} 板块</span>`;
        },
      },
      xAxis: {
        type: 'category', data: segments, position: 'top',
        axisLabel: { interval: 0, fontSize: 11.5, color: palette.ink3 },
        splitLine: { show: false }, axisLine: { show: false }, axisTick: { show: false },
      },
      yAxis: {
        type: 'category', data: rows.map((r) => r.company), inverse: true,
        axisLabel: {
          color: palette.ink, fontSize: 12,
          formatter: (v) => v.length > 16 ? v.slice(0, 16) + '…' : v,
        },
        splitLine: { show: false }, axisLine: { show: false }, axisTick: { show: false },
      },
      series: [{
        type: 'heatmap',
        data: cells.map((cell) => ({
          value: cell,
          itemStyle: crystalEchartHeatItemStyle(cell[2], maxV, palette.brand),
        })),
        label: {
          show: true, color: (p) => crystalHeatLabelColor(p.value[2], maxV, palette.ink), fontSize: 11.5, fontWeight: 600,
          formatter: (p) => p.value[2] || '',
        },
        itemStyle: { borderRadius: 7 },
        emphasis: {
          itemStyle: {
            shadowBlur: 24,
            shadowColor: 'rgba(120,104,104,0.16)',
            borderColor: 'rgba(255,255,255,0.92)',
            borderWidth: 2,
          },
        },
        animationDuration: 900,
        animationEasing: 'cubicOut',
      }],
    });
    inst.on('click', (p) => {
      const seg = segments[p.value[0]];
      const row = rows[p.value[1]];
      drilldownPortfolio(row.company, seg);
    });
  }

  async function drilldownPortfolio(company, segment) {
    // load each track until we find matching records
    const matches = [];
    for (const t of tracks) {
      const tj = await loadJSON(`assets/data/tracks/${t.key}.json`);
      tj.records.forEach((r) => {
        if (r.main_landscape && r.company === company && r.strategic === segment) {
          matches.push(r);
        }
      });
    }
    showRecords({ title: `${company} · ${segment}`, meta: '核心清单', records: matches });
  }

  function renderIndicationHeatmap(hm) {
    let maxV = 0;
    hm.cells.forEach((c) => { if (c[2] > maxV) maxV = c[2]; });
    const inst = ChartFactory.make(document.getElementById('chart-heatmap'), {
      grid: { left: 110, right: 60, top: 36, bottom: 80 },
      tooltip: {
        position: 'top',
        formatter: (p) => {
          const ind = hm.indications[p.value[0]];
          const mat = hm.materials[p.value[1]];
          return `<b>${escape(mat)}</b> × ${escape(ind)}<br/>${p.value[2]} 张证`;
        },
      },
      xAxis: {
        type: 'category', data: hm.indications,
        axisLabel: { rotate: 32, fontSize: 11.5, color: palette.ink3 },
        splitLine: { show: false }, axisLine: { show: false }, axisTick: { show: false },
      },
      yAxis: {
        type: 'category', data: hm.materials,
        axisLabel: { color: palette.ink, fontSize: 12 },
        splitLine: { show: false }, axisLine: { show: false }, axisTick: { show: false },
      },
      series: [{
        type: 'heatmap',
        data: hm.cells.map((cell) => ({
          value: cell,
          itemStyle: crystalEchartHeatItemStyle(cell[2], maxV, palette.brand),
        })),
        label: {
          show: true, color: (p) => crystalHeatLabelColor(p.value[2], maxV, palette.ink), fontSize: 11, fontWeight: 600,
          formatter: (p) => p.value[2],
        },
        itemStyle: { borderRadius: 7 },
        emphasis: {
          itemStyle: {
            shadowBlur: 24,
            shadowColor: 'rgba(120,104,104,0.16)',
            borderColor: 'rgba(255,255,255,0.92)',
            borderWidth: 2,
          },
        },
        animationDuration: 900,
      }],
    });
    inst.on('click', async (p) => {
      const ind = hm.indications[p.value[0]];
      const mat = hm.materials[p.value[1]];
      const matches = [];
      for (const t of tracks) {
        const tj = await loadJSON(`assets/data/tracks/${t.key}.json`);
        tj.records.forEach((r) => {
          if (r.main_landscape && r.material_family === mat && r.primary_indication === ind) matches.push(r);
        });
      }
    showRecords({ title: `${mat} → ${ind}`, meta: '核心清单 · 注射类', records: matches });
    });
  }

  function renderExpiry(ex) {
    // Determine the topmost non-zero series for each quarter so we can round
    // only that segment per bar — fixes the mix of flat / rounded tops when
    // stacking depth varies by quarter.
    const topSeriesIdx = ex.quarters.map((_, qi) => {
      for (let i = ex.series.length - 1; i >= 0; i--) {
        if (ex.series[i].data[qi] > 0) return i;
      }
      return -1;
    });
    const series = ex.series.map((s, i) => ({
      name: s.name,
      type: 'bar',
      stack: 'expiry',
      barMaxWidth: 28,
      data: s.data.map((v, qi) => ({
        value: v,
        itemStyle: { borderRadius: topSeriesIdx[qi] === i ? [6, 6, 0, 0] : 0 },
      })),
      emphasis: { focus: 'series' },
    }));
    const inst = ChartFactory.make(document.getElementById('chart-expiry'), {
      legend: { bottom: 0, type: 'scroll' },
      grid: { left: 36, right: 24, top: 30, bottom: 50 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'category', data: ex.quarters, axisLabel: { fontSize: 11 } },
      yAxis: { type: 'value', name: '到期证数' },
      series,
    });
    inst.on('click', (p) => {
      const quarter = ex.quarters[p.dataIndex];
      const trackName = p.seriesName;
      const matches = ex.upcoming_top.filter((r) => {
        const d = r.valid_until;
        const m = /^(\d{4})-(\d{2})/.exec(d);
        if (!m) return false;
        const q = `${m[1]}Q${Math.ceil(Number(m[2]) / 3)}`;
        return q === quarter && r.track_name && r.track_name.includes(trackName.split(' ')[0]);
      });
      showRecords({ title: `${quarter} · ${trackName}`, meta: '即将到期', records: matches });
    });
  }

  function renderOriginEvolution(ev) {
    if (!ev.years.length) return;
    const series = ev.series
      .filter((s) => s.data.some((v) => v > 0))
      .map((s) => ({
        name: s.name,
        type: 'line',
        smooth: 0.4,
        showSymbol: true, symbolSize: 7,
        lineStyle: { width: 2.5 },
        areaStyle: { opacity: 0.10 },
        emphasis: { focus: 'series' },
        data: s.data,
      }));
    ChartFactory.make(document.getElementById('chart-origin'), {
      legend: { bottom: 0 },
      grid: { left: 32, right: 16, top: 30, bottom: 44 },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: ev.years, boundaryGap: false },
      yAxis: { type: 'value', name: '当年获批数' },
      series,
    });
  }

  function renderConcentration(c, tracksMeta) {
    const tbody = document.querySelector('#table-concentration tbody');
    tbody.innerHTML = '';
    const order = ['ha', 'collagen', 'plla', 'pcl', 'caha', 'botulinum', 'ebd'];
    order.forEach((tk) => {
      const row = c[tk];
      if (!row) return;
      const meta = tracksMeta.find((t) => t.key === tk);
      const structure = describeStructure(row.hhi, row.cr4);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><b style="color:${meta.accent}">${escape(meta.name)}</b><div class="muted" style="font-size:11.5px;margin-top:2px">头部 · ${escape(row.top[0]?.company || '—')}</div></td>
        <td class="num">${row.total_certs}</td>
        <td class="num">${row.company_count}</td>
        <td class="num">${row.cr4}</td>
        <td class="num">${row.cr8}</td>
        <td class="num">${row.hhi}</td>
        <td>${structure.tag}<div class="muted" style="font-size:11.5px;margin-top:4px">${structure.note}</div></td>
      `;
      tr.addEventListener('click', () => { window.location = meta.url; });
      tbody.appendChild(tr);
    });
  }

  function describeStructure(hhi, cr4) {
    if (hhi >= 2500) return { tag: '<span class="tag neg">高度集中</span>', note: 'HHI≥2500,寡头格局' };
    if (hhi >= 1500) return { tag: '<span class="tag warn">中度集中</span>', note: '少数玩家主导' };
    if (cr4 < 40) return { tag: '<span class="tag pos">高度分散</span>', note: 'CR4<40%,多玩家分蛋糕' };
    return { tag: '<span class="tag">中性结构</span>', note: '中游集中度' };
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }
})();
