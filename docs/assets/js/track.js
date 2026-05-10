/* Per-track page wiring. Reads ?track=<key> or window.TRACK_KEY. */

(async function init() {
  const { palette, SERIES_COLORS, ChartFactory, showRecords, escape, loadJSON, watchKpis } = window.RI;

  const key = (new URLSearchParams(location.search).get('track')) || window.TRACK_KEY;
  if (!key) return;

  const data = await loadJSON(`../assets/data/tracks/${key}.json`);
  const meta = data.track_meta;
  document.title = `${meta.name} · Registration Insights`;

  // Tint the header dot to track accent
  const dot = document.querySelector('.topbar .brand .dot');
  if (dot && meta.accent) {
    dot.style.background = `linear-gradient(135deg, ${meta.accent} 0%, ${shade(meta.accent, -18)} 100%)`;
    dot.style.boxShadow = `0 4px 12px ${meta.accent}55`;
  }

  // Hero
  document.getElementById('track-name').textContent = meta.name;
  document.getElementById('track-tagline').textContent = meta.tagline;
  const heroAccent = document.getElementById('track-accent');
  if (heroAccent) heroAccent.style.background =
    `linear-gradient(96deg, ${meta.accent} 0%, ${shade(meta.accent, -22)} 100%)`;
  const heroH1 = document.getElementById('track-h1');
  if (heroH1) {
    const grad = heroH1.querySelector('.gradient');
    if (grad) grad.style.background =
      `linear-gradient(96deg, ${shade(meta.accent, -16)} 0%, ${meta.accent} 100%)`;
  }

  // KPIs
  setKpi('kpi-main', data.kpi.main);
  setKpi('kpi-companies', data.kpi.companies);
  setKpi('kpi-indications', data.kpi.indications);
  setKpi('kpi-verified', data.kpi.verified);
  document.getElementById('kpi-total').textContent = data.kpi.total;
  document.getElementById('kpi-mix').textContent = `${data.kpi.domestic} : ${data.kpi.imported} : ${data.kpi.hkmt}`;
  watchKpis();

  // Company share — horizontal bar
  renderCompanyShare(data.company_share, data.long_tail_company_count);

  // Indication donut
  renderDonut('chart-indications', data.indication_share, '适应症 / 部位');

  // Origin donut
  renderDonut('chart-origin', data.origin_share, '来源结构');

  // Material donut
  renderDonut('chart-material', data.material_share, '材料结构');

  // Timeline
  renderTimeline(data.timeline);

  // Company × indication heatmap
  renderCompanyHeatmap(data.company_indication_heatmap);

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
    const inst = ChartFactory.make(document.getElementById('chart-companies'), {
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
              { offset: 0, color: shade(meta.accent, 14) },
              { offset: 1, color: shade(meta.accent, -10) },
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
      showRecords({ title: `${p.name} · ${meta.name}`, meta: '主格局口径', records: matches });
    });
    if (longTail > 0) {
      document.getElementById('long-tail-note').textContent = `… 另有 ${longTail} 家长尾注册人未进入 Top 12`;
    }
  }

  function renderDonut(elId, items, title) {
    const el = document.getElementById(elId);
    if (!el || !items.length) return;
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
        data: items,
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
      let key = title.includes('适应症') ? 'primary_indication'
              : title.includes('来源') ? 'origin'
              : 'material_family';
      const matches = data.records.filter((r) => r.main_landscape && r[key] === p.name);
      showRecords({ title: `${p.name}`, meta: `${meta.name} · ${title}`, records: matches });
    });
  }

  function renderTimeline(t) {
    if (!t.years.length) {
      document.querySelector('#chart-timeline').innerHTML = '<div class="muted" style="text-align:center;padding:40px">暂无时间维度数据</div>';
      return;
    }
    const cum = []; let acc = 0;
    t.values.forEach((v) => { acc += v; cum.push(acc); });
    const inst = ChartFactory.make(document.getElementById('chart-timeline'), {
      legend: { bottom: 0 },
      tooltip: { trigger: 'axis' },
      grid: { left: 38, right: 38, top: 24, bottom: 44 },
      xAxis: { type: 'category', data: t.years, boundaryGap: false },
      yAxis: [
        { type: 'value', name: '当年新增', splitLine: { lineStyle: { color: palette.hairline, type: 'dashed' } } },
        { type: 'value', name: '累计', splitLine: { show: false } },
      ],
      series: [
        {
          name: '当年新增', type: 'bar', barMaxWidth: 26,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: shade(meta.accent, 18) },
              { offset: 1, color: meta.accent },
            ]),
            borderRadius: [6, 6, 0, 0],
          },
          data: t.values,
        },
        {
          name: '累计获批', type: 'line', yAxisIndex: 1,
          smooth: 0.3, showSymbol: true, symbolSize: 6,
          lineStyle: { width: 2.5, color: shade(meta.accent, -22) },
          areaStyle: { opacity: 0.06, color: meta.accent },
          data: cum,
        },
      ],
    });
    inst.on('click', (p) => {
      const year = t.years[p.dataIndex];
      const matches = data.records.filter((r) => r.main_landscape && r.approval_year === year);
      showRecords({ title: `${year} 年新增`, meta: meta.name, records: matches });
    });
  }

  function renderCompanyHeatmap(hm) {
    if (!hm.companies.length || !hm.indications.length) {
      document.getElementById('chart-co-in').innerHTML = '<div class="muted" style="text-align:center;padding:40px">数据不足</div>';
      return;
    }
    let maxV = 0; hm.cells.forEach((c) => { if (c[2] > maxV) maxV = c[2]; });
    const inst = ChartFactory.make(document.getElementById('chart-co-in'), {
      grid: { left: 130, right: 60, top: 30, bottom: 70 },
      tooltip: {
        position: 'top',
        formatter: (p) => `<b>${escape(hm.companies[p.value[1]])}</b><br/>${escape(hm.indications[p.value[0]])} · ${p.value[2]} 张`,
      },
      xAxis: {
        type: 'category', data: hm.indications,
        axisLabel: { rotate: 28, fontSize: 11, color: palette.ink3 },
        splitLine: { show: false }, axisLine: { show: false }, axisTick: { show: false },
      },
      yAxis: {
        type: 'category', data: hm.companies,
        axisLabel: {
          color: palette.ink, fontSize: 12,
          formatter: (v) => v.length > 14 ? v.slice(0, 14) + '…' : v,
        },
        splitLine: { show: false }, axisLine: { show: false }, axisTick: { show: false },
      },
      visualMap: {
        min: 0, max: Math.max(maxV, 1), show: false,
        inRange: { color: ['#F4F2EA', shade(meta.accent, 35), meta.accent, shade(meta.accent, -25)] },
      },
      series: [{
        type: 'heatmap', data: hm.cells,
        label: { show: true, color: palette.ink, fontSize: 11, fontWeight: 600,
                 formatter: (p) => p.value[2] || '' },
        itemStyle: { borderColor: palette.bg, borderWidth: 2, borderRadius: 5 },
        emphasis: { itemStyle: { shadowBlur: 12, shadowColor: 'rgba(28,22,18,0.15)' } },
        animationDuration: 800,
      }],
    });
    inst.on('click', (p) => {
      const comp = hm.companies[p.value[1]];
      const ind = hm.indications[p.value[0]];
      const matches = data.records.filter((r) => r.main_landscape && r.company === comp && r.primary_indication === ind);
      showRecords({ title: `${comp} → ${ind}`, meta: meta.name, records: matches });
    });
  }

  function renderRecords(records) {
    const tbody = document.querySelector('#table-records tbody');
    const filterOrigin = document.getElementById('filter-origin');
    const filterVerified = document.getElementById('filter-verified');
    const search = document.getElementById('search');

    function paint() {
      const fo = filterOrigin.value;
      const fv = filterVerified.value;
      const fs = (search.value || '').trim().toLowerCase();
      const filtered = records.filter((r) => {
        if (!r.main_landscape) return false;
        if (fo && r.origin !== fo) return false;
        if (fv === 'verified' && !r.verified) return false;
        if (fv === 'pending' && r.verified) return false;
        if (fs) {
          const hay = `${r.product_name} ${r.company} ${r.certificate_no} ${r.primary_indication}`.toLowerCase();
          if (!hay.includes(fs)) return false;
        }
        return true;
      });
      document.getElementById('records-count').textContent = filtered.length;
      tbody.innerHTML = filtered.slice(0, 80).map((r) => `
        <tr data-id="${escape(r.id)}">
          <td><b>${escape(r.product_name || '—')}</b><div class="muted" style="font-size:11.5px">${escape(r.material_family || '')}</div></td>
          <td>${escape(r.company)}</td>
          <td><span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px">${escape(r.certificate_no || '—')}</span></td>
          <td>${escape(r.origin || '—')}</td>
          <td>${escape(r.primary_indication || '—')}</td>
          <td>${escape(r.approval_date || '—')}</td>
          <td>${r.verified
            ? '<span class="verify-badge ok" title="已通过 NMPA 国家政务平台核验"><span class="ico">✓</span>NMPA</span>'
            : '<span class="verify-badge pending" title="尚未通过 NMPA 核验,需复核"><span class="ico">⌛</span>待核</span>'}</td>
        </tr>
      `).join('');
      tbody.querySelectorAll('tr').forEach((tr) => {
        tr.addEventListener('click', () => {
          const r = records.find((x) => x.id === tr.dataset.id);
          if (r) showRecords({ title: r.product_name || '产品详情', meta: r.certificate_no || '', records: [r] });
        });
      });
      if (filtered.length > 80) {
        const note = document.createElement('tr');
        note.innerHTML = `<td colspan="7" class="muted" style="text-align:center">仅显示前 80 条,共 ${filtered.length} 条匹配</td>`;
        tbody.appendChild(note);
      }
    }
    [filterOrigin, filterVerified, search].forEach((el) => el.addEventListener('input', paint));
    paint();
  }
})();

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
