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

// ---------- Shared crystalline heatmap language ----------

function hexToRgb(color) {
  const raw = String(color || '').trim().replace('#', '');
  if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(raw)) return null;
  const full = raw.length === 3 ? raw.split('').map((char) => char + char).join('') : raw;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function mixColor(color, target = '#ffffff', amount = 0.35) {
  const rgb = hexToRgb(color);
  const targetRgb = hexToRgb(target);
  if (!rgb || !targetRgb) return color;
  const clamp = (value) => Math.max(0, Math.min(255, Math.round(value)));
  return `rgb(${clamp(rgb.r + (targetRgb.r - rgb.r) * amount)}, ${clamp(rgb.g + (targetRgb.g - rgb.g) * amount)}, ${clamp(rgb.b + (targetRgb.b - rgb.b) * amount)})`;
}

function colorAlpha(color, alpha) {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function heatRatio(value, max) {
  if (!value) return 0;
  return Math.log1p(Number(value) || 0) / Math.log1p(Math.max(Number(max) || 1, 1));
}

function crystalCssHeatVars(value, max, { base = palette.brand, fgDark = palette.ink } = {}) {
  if (!value) {
    return [
      '--heat-bg:transparent',
      '--heat-border:transparent',
      '--heat-fg:transparent',
      '--heat-shadow:transparent',
    ].join(';') + ';';
  }
  const heat = heatRatio(value, max);
  const top = mixColor(base, '#fff8ef', Math.max(0.40, 0.76 - heat * 0.22));
  const mid = mixColor(base, '#ffffff', Math.max(0.16, 0.46 - heat * 0.20));
  const deep = mixColor(base, '#4a2418', Math.min(0.22, 0.08 + heat * 0.10));
  const fg = heat > 0.60 ? '#fffaf5' : fgDark;
  const shadow = (0.10 + heat * 0.24).toFixed(3);
  return [
    `--heat-bg:linear-gradient(150deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.16) 34%, rgba(255,255,255,0) 52%), linear-gradient(135deg, ${top} 0%, ${mid} 46%, ${deep} 100%)`,
    `--heat-border:${colorAlpha(mixColor(base, '#fffaf5', 0.28), 0.56)}`,
    `--heat-fg:${fg}`,
    `--heat-shadow:${colorAlpha(base, shadow)}`,
  ].join(';') + ';';
}

function crystalEchartHeatItemStyle(value, max, base = palette.brand) {
  const heat = heatRatio(value, max);
  const top = mixColor(base, '#fff8ef', Math.max(0.40, 0.76 - heat * 0.22));
  const mid = mixColor(base, '#ffffff', Math.max(0.16, 0.46 - heat * 0.20));
  const deep = mixColor(base, '#4a2418', Math.min(0.22, 0.08 + heat * 0.10));
  const color = typeof echarts !== 'undefined'
    ? new echarts.graphic.LinearGradient(0, 0, 1, 1, [
      { offset: 0, color: top },
      { offset: 0.42, color: mid },
      { offset: 1, color: deep },
    ])
    : deep;
  return {
    color,
    borderColor: 'rgba(255,255,255,0.72)',
    borderWidth: 2,
    borderRadius: 7,
    shadowBlur: 14,
    shadowColor: colorAlpha(base, (0.12 + heat * 0.24).toFixed(3)),
    shadowOffsetY: 4,
  };
}

function crystalHeatLabelColor(value, max, dark = palette.ink) {
  return heatRatio(value, max) > 0.60 ? '#fffaf5' : dark;
}

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
  const featureTags = (r.feature_tags || []).slice(0, 4).map((t) => `<span class="tag">${escape(t)}</span>`).join('');
  const newsSource = r.news_title
    ? `<div class="row"><b>资讯来源</b> ${r.news_url ? `<a href="${escape(r.news_url)}" target="_blank" rel="noreferrer">${escape(r.news_title)}</a>` : escape(r.news_title)}${r.news_account ? ` · ${escape(r.news_account)}` : ''}</div>`
    : '';
  const verifiedTag = r.verified
    ? '<span class="verify-badge ok" title="已通过 NMPA 国家政务平台核验"><span class="ico">✓</span>NMPA</span>'
    : '<span class="verify-badge pending" title="尚未通过 NMPA 核验,需复核"><span class="ico">⌛</span>待核</span>';
  const originTag = (!r.hide_origin_tag && r.origin) ? `<span class="tag">${escape(r.origin)}</span>` : '';
  return `
    <div class="record-card">
      <div class="head">
        <div>
          <div class="name">${escape(r.product_name || r.official_product_name || '未命名产品')}</div>
          <div class="cert">${escape(r.certificate_no || '—')}</div>
        </div>
        <div class="cluster">${verifiedTag}${originTag}</div>
      </div>
      <div class="row"><b>注册企业</b> ${escape(r.company || '—')}</div>
      ${r.primary_indication ? `<div class="row"><b>适应证</b> ${escape(r.primary_indication)}</div>` : ''}
      ${r.material_family ? `<div class="row"><b>材料</b> ${escape(r.material_family)} · ${escape(r.material_form || '')}</div>` : ''}
      ${r.scope_full ? `<div class="row"><b>说明</b> ${escape(r.scope_full)}</div>` : ''}
      ${r.commercial_name ? `<div class="row"><b>市场名</b> ${escape(r.commercial_name)}</div>` : ''}
      ${r.market_note ? `<div class="row"><b>资讯要点</b> ${escape(r.market_note)}</div>` : ''}
      ${featureTags ? `<div class="cluster" style="margin-top:8px">${featureTags}</div>` : ''}
      ${newsSource}
      <div class="row">
        ${r.approval_date ? `<span><b>批准</b> ${escape(r.approval_date)}</span>` : ''}
        ${r.valid_until ? `<span><b>到期</b> ${escape(r.valid_until)}</span>` : ''}
      </div>
      ${tags ? `<div class="cluster" style="margin-top:8px">${tags}</div>` : ''}
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
              renderRecordCard, escape, loadJSON, watchKpis, animateNumber,
              mixColor, colorAlpha, crystalCssHeatVars,
              crystalEchartHeatItemStyle, crystalHeatLabelColor };
