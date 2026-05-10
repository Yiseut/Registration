/* Shared utilities, ECharts theme, and drawer logic. */

const palette = {
  brand: '#D97757',
  brandDeep: '#C15F3C',
  brandGlow: '#F4B393',
  brandSoft: '#F8E3D5',
  ink: '#1F1B17',
  ink3: '#6E6760',
  inkMute: '#9D958C',
  hairline: 'rgba(34,28,22,0.08)',
  bg: '#FAF9F5',
  surface: '#FFFFFF',
  rose: '#B95E6E', plum: '#8B5A6B', gold: '#B5915A',
  sage: '#8B9D7F', ocean: '#5B7B9A', slate: '#6E6A65', clay: '#C58B5C',
};

// Ordered palette used for series colors
const SERIES_COLORS = [
  '#D97757', '#5B7B9A', '#B5915A', '#8B9D7F',
  '#8B5A6B', '#C15F3C', '#6E6A65', '#B95E6E',
  '#C58B5C', '#7B8B7E', '#9C7F8F', '#A8866B',
];

const echartsTheme = {
  color: SERIES_COLORS,
  backgroundColor: 'transparent',
  textStyle: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Helvetica Neue", "Microsoft Yahei", sans-serif',
    color: palette.ink,
  },
  title: { textStyle: { color: palette.ink, fontWeight: 600 }, subtextStyle: { color: palette.ink3 } },
  legend: { textStyle: { color: palette.ink3 }, itemWidth: 14, itemHeight: 8, icon: 'roundRect' },
  tooltip: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderColor: palette.hairline,
    borderWidth: 1,
    textStyle: { color: palette.ink, fontSize: 12.5 },
    extraCssText: 'box-shadow: 0 12px 32px rgba(28,22,18,0.12); border-radius: 12px; padding: 10px 14px;',
  },
  grid: { left: 36, right: 24, top: 36, bottom: 28, containLabel: true },
  categoryAxis: {
    axisLine: { lineStyle: { color: palette.hairline } },
    axisTick: { show: false },
    axisLabel: { color: palette.ink3, fontSize: 11.5 },
    splitLine: { show: false },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: palette.ink3, fontSize: 11.5 },
    splitLine: { lineStyle: { color: palette.hairline, type: 'dashed' } },
  },
};

if (typeof echarts !== 'undefined') {
  echarts.registerTheme('claude', echartsTheme);
}

const ChartFactory = (() => {
  const instances = [];
  function make(el, opt) {
    if (!el) return null;
    const inst = echarts.init(el, 'claude', { renderer: 'canvas' });
    inst.setOption(opt);
    instances.push(inst);
    return inst;
  }
  window.addEventListener('resize', () => instances.forEach((i) => i.resize()));
  return { make, instances };
})();

// ---------- Number animation ----------

function animateNumber(el, to, { duration = 900, suffix = '', decimals = 0 } = {}) {
  if (!el) return;
  const from = to * 0.4;
  const start = performance.now();
  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    const v = from + (to - from) * eased;
    el.textContent = decimals > 0 ? v.toFixed(decimals) + suffix : Math.round(v).toLocaleString() + suffix;
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ---------- Drawer ----------

const Drawer = (() => {
  let backdrop, drawerEl, titleEl, metaEl, bodyEl;
  function ensure() {
    if (drawerEl) return;
    backdrop = document.createElement('div');
    backdrop.className = 'drawer-backdrop';
    drawerEl = document.createElement('aside');
    drawerEl.className = 'drawer';
    drawerEl.innerHTML = `
      <header>
        <div>
          <h2 data-drawer-title>详情</h2>
          <div class="meta" data-drawer-meta></div>
        </div>
        <button class="close" data-drawer-close aria-label="关闭">×</button>
      </header>
      <div class="body" data-drawer-body></div>
    `;
    document.body.appendChild(backdrop);
    document.body.appendChild(drawerEl);
    titleEl = drawerEl.querySelector('[data-drawer-title]');
    metaEl = drawerEl.querySelector('[data-drawer-meta]');
    bodyEl = drawerEl.querySelector('[data-drawer-body]');
    backdrop.addEventListener('click', close);
    drawerEl.querySelector('[data-drawer-close]').addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  }
  function open({ title, meta = '', html = '' }) {
    ensure();
    titleEl.textContent = title;
    metaEl.textContent = meta;
    bodyEl.innerHTML = html;
    requestAnimationFrame(() => {
      backdrop.classList.add('open');
      drawerEl.classList.add('open');
    });
  }
  function close() {
    if (!drawerEl) return;
    backdrop.classList.remove('open');
    drawerEl.classList.remove('open');
  }
  return { open, close };
})();

// ---------- Record card renderer ----------

function renderRecordCard(r) {
  const tags = (r.tags || []).slice(0, 3).map((t) => `<span class="tag">${escape(t)}</span>`).join('');
  const verifiedTag = r.verified
    ? '<span class="tag pos">已核验</span>'
    : '<span class="tag warn">待核验</span>';
  const originTag = r.origin ? `<span class="tag">${escape(r.origin)}</span>` : '';
  const url = r.source_url
    ? `<a href="${escape(r.source_url)}" target="_blank" rel="noopener">来源 ↗</a>`
    : '';
  return `
    <div class="record-card">
      <div class="head">
        <div>
          <div class="name">${escape(r.product_name || r.official_product_name || '未命名产品')}</div>
          <div class="cert">${escape(r.certificate_no || '—')}</div>
        </div>
        <div class="cluster">${verifiedTag}${originTag}</div>
      </div>
      <div class="row"><b>注册人</b> ${escape(r.company || '—')}</div>
      ${r.primary_indication ? `<div class="row"><b>适应症</b> ${escape(r.primary_indication)}</div>` : ''}
      ${r.material_family ? `<div class="row"><b>材料</b> ${escape(r.material_family)} · ${escape(r.material_form || '')}</div>` : ''}
      <div class="row">
        ${r.approval_date ? `<span><b>批准</b> ${escape(r.approval_date)}</span>` : ''}
        ${r.valid_until ? `<span><b>到期</b> ${escape(r.valid_until)}</span>` : ''}
      </div>
      ${tags ? `<div class="cluster" style="margin-top:8px">${tags}</div>` : ''}
      ${url ? `<div class="row" style="margin-top:8px">${url}</div>` : ''}
    </div>
  `;
}

function escape(str) {
  return String(str ?? '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

// ---------- Drilldown helper ----------

function showRecords({ title, meta, records }) {
  if (!records || !records.length) {
    Drawer.open({ title, meta, html: '<p class="muted">没有匹配的注册记录。</p>' });
    return;
  }
  const html = records.map(renderRecordCard).join('');
  Drawer.open({ title, meta: `${meta} · 共 ${records.length} 条`, html });
}

// ---------- Data loader ----------

async function loadJSON(path) {
  const res = await fetch(path, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

// ---------- Intersection-triggered KPI animation ----------

function watchKpis(root = document) {
  // Render final values directly. Count-up animation looked good in real
  // browsers but fought every paint pipeline (headless screenshots, reduced
  // motion, slow scroll-into-view). The chart entrance animations and hover
  // effects carry plenty of visual interest on their own.
  root.querySelectorAll('[data-animate-to]').forEach((el) => {
    const to = Number(el.dataset.animateTo);
    const decimals = Number(el.dataset.decimals || 0);
    const suffix = el.dataset.suffix || '';
    el.textContent = decimals > 0 ? to.toFixed(decimals) + suffix : to.toLocaleString() + suffix;
  });
}

window.RI = { palette, SERIES_COLORS, ChartFactory, Drawer, showRecords,
              renderRecordCard, escape, loadJSON, watchKpis, animateNumber };
