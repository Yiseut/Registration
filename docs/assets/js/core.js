/* Shared utilities, ECharts theme, and drawer logic. */

const palette = {
  brand: '#166B65',
  brandDeep: '#0F5A55',
  brandGlow: '#7BC9C1',
  brandSoft: '#E2F1EF',
  ink: '#1F1B17',
  ink3: '#6E6760',
  inkMute: '#9D958C',
  hairline: 'rgba(34,28,22,0.08)',
  bg: '#FAF9F5',
  surface: '#FFFFFF',
  rose: '#A93D35', plum: '#8F5E56', gold: '#8A5D20',
  sage: '#356E64', ocean: '#3D6F99', slate: '#7A6458', clay: '#A85135',
};

// Ordered palette used for series colors
const SERIES_COLORS = [
  '#1F8A82', '#A85135', '#3D6F99', '#8A5D20',
  '#8F5E56', '#356E64', '#7A6458', '#2E7A51',
  '#A93D35', '#6D584F', '#9B7467', '#496E92',
];

const echartsTheme = {
  color: SERIES_COLORS,
  backgroundColor: 'transparent',
  textStyle: {
    fontFamily: '"Source Han Sans SC", "思源黑体", "Alibaba PuHuiTi", "阿里巴巴普惠体", "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", Arial, sans-serif',
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
  echarts.registerTheme('registration', echartsTheme);
}

const ChartFactory = (() => {
  const instances = [];
  function make(el, opt) {
    if (!el) return null;
    const inst = echarts.init(el, 'registration', { renderer: 'canvas' });
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

function heatHue(base) {
  const normalized = String(base || '').trim().toUpperCase();
  const hues = {
    '#1F8A82': 178,
    '#166B65': 178,
    '#3D6F99': 205,
    '#8A5D20': 36,
    '#A85135': 16,
    '#8F5E56': 8,
    '#4E8577': 166,
    '#356E64': 166,
    '#2E7A51': 144,
    '#A93D35': 4,
  };
  return hues[normalized] || 178;
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
  const high = heat >= 0.72;
  const highProgress = high ? (heat - 0.72) / 0.28 : 0;
  const hue = heatHue(base);
  const lightness = high
    ? Math.round(32 - highProgress * 6)
    : Math.round(98 - heat * 20);
  const saturation = high
    ? Math.round(44 + highProgress * 6)
    : Math.round(18 + heat * 20);
  const borderLightness = high ? Math.max(20, lightness - 7) : Math.max(44, lightness - 14);
  const fg = high ? '#F8FEFD' : fgDark;
  const shadow = (0.08 + heat * 0.18).toFixed(3);
  return [
    `--heat-bg:hsl(${hue} ${saturation}% ${lightness}%)`,
    `--heat-border:hsl(${hue} ${saturation}% ${borderLightness}%)`,
    `--heat-fg:${fg}`,
    `--heat-shadow:hsla(${hue}, ${saturation}%, ${Math.max(18, lightness - 12)}%, ${shadow})`,
  ].join(';') + ';';
}

function crystalEchartHeatItemStyle(value, max, base = palette.brand) {
  const heat = heatRatio(value, max);
  const hue = heatHue(base);
  const high = heat >= 0.72;
  const highProgress = high ? (heat - 0.72) / 0.28 : 0;
  const lightness = high ? Math.round(32 - highProgress * 6) : Math.round(98 - heat * 20);
  const saturation = high ? Math.round(44 + highProgress * 6) : Math.round(18 + heat * 20);
  const colorStop = `hsl(${hue} ${saturation}% ${lightness}%)`;
  const color = typeof echarts !== 'undefined'
    ? new echarts.graphic.LinearGradient(0, 0, 1, 1, [
      { offset: 0, color: `hsl(${hue} ${Math.max(14, saturation - 8)}% ${Math.min(98, lightness + 10)}%)` },
      { offset: 0.52, color: colorStop },
      { offset: 1, color: `hsl(${hue} ${saturation}% ${Math.max(22, lightness - 8)}%)` },
    ])
    : colorStop;
  return {
    color,
    borderColor: 'rgba(255,255,255,0.72)',
    borderWidth: 2,
    borderRadius: 7,
    shadowBlur: 14,
    shadowColor: `hsla(${hue}, ${saturation}%, ${Math.max(18, lightness - 12)}%, ${(0.10 + heat * 0.18).toFixed(3)})`,
    shadowOffsetY: 4,
  };
}

function crystalHeatLabelColor(value, max, dark = palette.ink) {
  return heatRatio(value, max) >= 0.72 ? '#F8FEFD' : dark;
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
