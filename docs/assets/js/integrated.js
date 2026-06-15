/* Integrated overview page wiring. */

(async function initIntegratedDashboard() {
  const { palette, SERIES_COLORS, showRecords, escape, loadJSON, watchKpis, crystalCssHeatVars } = window.RI;
  const cloudData = await loadJSON('assets/data/overview.json');
  const chinaMapData = await loadJSON('assets/data/china_enterprise_map.json');
  const manifest = await loadJSON('assets/data/manifest.json');
  const cloudTrackPayloads = await Promise.all(
    manifest.tracks.map((track) => loadJSON(`assets/data/tracks/${track.key}.json`))
  );
  const SEGMENTS = [
    { code: 'ha', name: '透明质酸钠', fullName: '透明质酸钠', color: '#9ecfe3', soft: '#e1f2f8', deep: '#7fb8d2', href: 'tracks/ha.html' },
    { code: 'botulinum', name: '肉毒毒素', fullName: '肉毒毒素', color: '#a7abd8', soft: '#e3e5f6', deep: '#858cc6', href: 'tracks/botulinum.html' },
    { code: 'collagen', name: '胶原蛋白', fullName: '胶原蛋白', color: '#d7a5ad', soft: '#f1dfe2', deep: '#be8791', href: 'tracks/collagen.html' },
    { code: 'plla', name: 'PLA', fullName: 'PLA', color: '#b9c2ee', soft: '#e8ebfb', deep: '#96a3dc', href: 'tracks/plla.html' },
    { code: 'pcl', name: 'PCL', fullName: 'PCL', color: '#ead7c9', soft: '#f7eee8', deep: '#d8bda9', href: 'tracks/pcl.html' },
    { code: 'caha', name: 'CaHA', fullName: 'CaHA', color: '#c4b4d7', soft: '#eee6f4', deep: '#aa95c3', href: 'tracks/caha.html' },
    { code: 'niche_materials', name: '小众材料', fullName: '小众材料', color: '#d9a0b1', soft: '#f2dce3', deep: '#c68198', href: 'tracks/niche_materials.html' },
    { code: 'ebd', name: 'EBD 设备', fullName: 'EBD 设备', color: '#b7c4d8', soft: '#e7edf5', deep: '#92a3bb', href: 'tracks/ebd.html' },
  ];
  const SEGMENT_BY_CODE = Object.fromEntries(SEGMENTS.map((segment) => [segment.code, segment]));
  const MATERIAL_SEGMENTS = SEGMENTS.filter((segment) => segment.code !== 'ebd');
  const EBD_TRACKS = new Set(['raw_rf', 'raw_thermage_rf', 'raw_ultrasound', 'raw_microneedle', 'rf', 'ultrasound', 'laser_ipl', 'body_contouring_device']);
  const NICHE_MATERIAL_TRACKS = new Set(['raw_pmma', 'raw_agarose', 'raw_lipolysis_injection', 'raw_ecm', 'raw_silk', 'silk_protein']);
  const SUBMENTAL_LIPOLYSIS_INDICATION = '颏下脂肪堆积（双下巴）';
  const JAW_CHIN_CONTOUR_FILLING_INDICATION = '下颌及颏部轮廓改善（填充）';
  const cloudRecords = cloudTrackPayloads.flatMap((payload) => payload.records || []).filter(includeCloudInLandscape);
  const cloudMaterialRecords = cloudRecords.filter((record) => !isDeviceRecord(record));
  const legacyData = window.REGISTRATION_OVERVIEW_DATA || { records: [], pipelineSignals: [] };
  const allRecords = legacyData.records || [];
  const records = allRecords.filter(includeInLandscape);
  const HEAT_THEMES = {
    coral: { base: '#9ecfe3', hue: 200, saturation: 34, lightHigh: 96, lightLow: 72, fg: '#786868' },
    ocean: { base: '#a7abd8', hue: 235, saturation: 32, lightHigh: 96, lightLow: 72, fg: '#786868' },
    sage: { base: '#d7a5ad', hue: 350, saturation: 34, lightHigh: 96, lightLow: 73, fg: '#786868' },
    plum: { base: '#b9c2ee', hue: 228, saturation: 34, lightHigh: 96, lightLow: 74, fg: '#786868' },
  };

  const state = {
    trendGrain: 'month',
    segment: 'all',
    company: 'all',
    classKey: 'all',
    origin: 'all',
    query: '',
  };

  const chartInstances = new Set();
  window.addEventListener('resize', () => {
    chartInstances.forEach((chart) => {
      if (!chart.isDisposed()) chart.resize();
    });
  });

  renderMeta();
  renderKpis();
  renderChinaEnterpriseMap(chinaMapData);
  renderSegments();
  renderTrend();
  renderInjectableStructure();
  renderActivityRows();
  renderManufacturerMatrix();
  renderOpportunityMatrix();
  renderExpiry(cloudData.cert_expiry);
  renderOriginEvolution(cloudData.origin_evolution);
  initRecordFilters();
  renderRecordsTable();
  watchKpis();

  document.querySelectorAll('[data-trend-grain]').forEach((button) => {
    button.addEventListener('click', () => {
      state.trendGrain = button.dataset.trendGrain || 'month';
      document.querySelectorAll('[data-trend-grain]').forEach((item) => {
        item.classList.toggle('active', item === button);
      });
      renderTrend();
    });
  });

  function makeChart(el, option) {
    if (!el || typeof echarts === 'undefined') return null;
    const previous = echarts.getInstanceByDom(el);
    if (previous) {
      chartInstances.delete(previous);
      previous.dispose();
    }
    const chart = echarts.init(el, 'registration', { renderer: 'canvas' });
    chart.setOption(option);
    chartInstances.add(chart);
    return chart;
  }

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

  function crystalLinear(color, direction = 'vertical', softness = 0) {
    const axis = direction === 'horizontal' ? [0, 0, 1, 0] : [0, 0, 0, 1];
    const light = mixColor(color, '#fff8f8', 0.52 + softness);
    const mid = mixColor(color, '#ffffff', 0.08 + softness * 0.3);
    const deep = mixColor(color, '#786868', 0.16);
    return new echarts.graphic.LinearGradient(...axis, [
      { offset: 0, color: light },
      { offset: 0.42, color: mid },
      { offset: 1, color: deep },
    ]);
  }

  function crystalRadial(color) {
    return new echarts.graphic.RadialGradient(0.32, 0.28, 0.88, [
      { offset: 0, color: mixColor(color, '#fffafa', 0.68) },
      { offset: 0.52, color: mixColor(color, '#ffffff', 0.10) },
      { offset: 1, color: mixColor(color, '#786868', 0.14) },
    ]);
  }

  function crystalBarStyle(color, radius = 0) {
    return {
      color: crystalLinear(color),
      borderRadius: radius,
      borderColor: 'rgba(255, 255, 255, 0.55)',
      borderWidth: 0.8,
      shadowBlur: 12,
      shadowColor: colorAlpha(color, 0.26),
      shadowOffsetY: 4,
    };
  }

  function renderMeta() {
    setText('meta-generated', (cloudData.generated_at || '').slice(0, 10) || '—');
    setText('meta-records', records.length);
  }

  function renderKpis() {
    const kpi = cloudData.kpi || {};
    setKpi('kpi-main', kpi.main_records);
    setKpi('kpi-companies', kpi.companies);
    setKpi('kpi-verified', kpi.verified_share, { decimals: 1, suffix: '%' });
    setText('kpi-mix', `${kpi.domestic ?? '—'} : ${kpi.imported ?? '—'} : ${kpi.hkmt ?? '—'}`);
    setKpi('kpi-inj3', kpi.injectable_class3);
    setText('kpi-inj3-breakdown', kpi.injectable_class3_breakdown || '—');
    setKpi('kpi-drug', kpi.injectable_drug);
    setText('kpi-drug-breakdown', kpi.injectable_drug_breakdown || '—');
    setKpi('kpi-indications', unique(records.flatMap(indicationValues)).length || kpi.indications);
    setText('kpi-indications-breakdown', kpi.indication_breakdown || '—');
    setKpi('kpi-recent', kpi.recent_12mo);
    setText('kpi-recent-share', kpi.recent_12mo_share ?? '—');
    setText('kpi-recent-breakdown', formatRecentBreakdown(kpi.recent_12mo_breakdown));
  }

  function renderChinaEnterpriseMap(mapData) {
    const holder = document.getElementById('china-enterprise-map');
    const rankRoot = document.getElementById('china-city-rank-list');
    const rankTitle = document.getElementById('china-city-rank-title');
    const rankMoreButton = document.getElementById('china-city-rank-more');
    const cities = (mapData?.cities || [])
      .filter((city) => Number.isFinite(Number(city.lat)) && Number.isFinite(Number(city.lng)));
    const metrics = mapData?.metrics || {};
    setText('china-map-cities', metrics.mapped_cities ?? cities.length);
    setText('china-map-companies', metrics.mapped_companies ?? cities.reduce((sum, city) => sum + Number(city.companies || 0), 0));
    setText('china-map-records', metrics.mapped_records ?? cities.reduce((sum, city) => sum + Number(city.registrations || 0), 0));
    renderChinaMapLegend();

    if (!holder) return;
    if (!cities.length || typeof L === 'undefined') {
      holder.innerHTML = '<div class="china-map-empty">地图数据待生成</div>';
      return;
    }

    const map = L.map(holder, {
      center: mapLatLng(35.4, 103.8),
      zoom: 4,
      minZoom: 3,
      maxZoom: 8,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      zoomControl: false,
      scrollWheelZoom: true,
      wheelDebounceTime: 50,
      wheelPxPerZoomLevel: 90,
      attributionControl: true,
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=7&x={x}&y={y}&z={z}', {
      subdomains: ['1', '2', '3', '4'],
      maxZoom: 10,
      attribution: '&copy; 高德地图',
    }).addTo(map);

    const activeMetricDefault = 'companies';
    const maxByMetric = {
      companies: Math.max(...cities.map((city) => cityMetricValue(city, 'companies')), 1),
      registrations: Math.max(...cities.map((city) => cityMetricValue(city, 'registrations')), 1),
    };
    const markerByCity = new Map();
    const cityByName = new Map(cities.map((city) => [city.city, city]));
    const bounds = L.latLngBounds([]);
    let activeMetric = activeMetricDefault;
    let rankExpanded = false;
    let pendingPopupTimer = null;
    let pendingPopupMoveHandler = null;

    cities.forEach((city) => {
      const color = cityTrackColor(city.leading_track);
      const radius = cityRadius(city, activeMetricDefault, maxByMetric);
      const latLng = cityMapLatLng(city);
      const marker = L.circleMarker(latLng, {
        radius,
        color: '#fffaf3',
        weight: 1.6,
        fillColor: color,
        fillOpacity: 0.76,
        opacity: 1,
        className: 'china-city-marker',
      }).addTo(map);
      const hitMarker = L.circleMarker(latLng, {
        radius: cityHitRadius(radius),
        color: 'transparent',
        weight: 0,
        fillColor: '#000',
        fillOpacity: 0.01,
        opacity: 0.01,
        className: 'china-city-hit-marker',
      }).addTo(map);
      bindCityMarker(marker, city, activeMetricDefault, true);
      bindCityMarker(hitMarker, city, activeMetricDefault, false);
      marker.on('click', () => openCityPopup(city.city));
      hitMarker.on('click', () => openCityPopup(city.city));
      markerByCity.set(city.city, { marker, hitMarker });
      bounds.extend(latLng);
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.18), { maxZoom: 5.25, animate: false });
      if (window.innerWidth >= 900 && map.getZoom() < 4) {
        map.setZoom(4, { animate: false });
      }
    }
    setTimeout(() => map.invalidateSize(), 0);
    window.addEventListener('resize', () => map.invalidateSize());

    function clearPendingPopup() {
      if (pendingPopupMoveHandler) {
        map.off('moveend', pendingPopupMoveHandler);
        pendingPopupMoveHandler = null;
      }
      if (pendingPopupTimer) {
        clearTimeout(pendingPopupTimer);
        pendingPopupTimer = null;
      }
    }

    function openCityPopup(cityName, focusMap = false) {
      const cityMarker = markerByCity.get(cityName);
      if (!cityMarker) return;
      const latLng = cityMarker.marker.getLatLng();
      const showPopup = () => {
        clearPendingPopup();
        map.closePopup();
        cityMarker.marker.bringToFront();
        cityMarker.hitMarker.bringToFront();
        cityMarker.marker.openPopup();
      };
      clearPendingPopup();
      map.closePopup();
      if (!focusMap) {
        showPopup();
        return;
      }
      pendingPopupMoveHandler = showPopup;
      map.once('moveend', pendingPopupMoveHandler);
      map.setView(latLng, Math.max(map.getZoom(), 6), { animate: true });
      pendingPopupTimer = setTimeout(showPopup, 900);
    }

    function renderRank(metric) {
      if (!rankRoot) return;
      const rankedCities = [...cities].sort((a, b) => (
        cityMetricValue(b, metric) - cityMetricValue(a, metric)
        || Number(b.registrations || 0) - Number(a.registrations || 0)
        || String(a.city).localeCompare(String(b.city), 'zh-Hans-CN')
      ));
      const visibleCities = rankExpanded ? rankedCities : rankedCities.slice(0, 8);
      if (rankTitle) rankTitle.textContent = rankExpanded ? '城市集群排名' : '城市集群 Top 8';
      if (rankMoreButton) {
        rankMoreButton.classList.toggle('active', rankExpanded);
        rankMoreButton.setAttribute('aria-label', rankExpanded ? '收起城市排名' : '查看全部城市排名');
        rankMoreButton.setAttribute('title', rankExpanded ? '收起城市排名' : '查看全部城市排名');
      }
      rankRoot.innerHTML = visibleCities.map((city, index) => `
        <button type="button" class="china-rank-row" data-city="${escape(city.city)}">
          <span class="rank-index">${index + 1}</span>
          <span class="rank-city">
            <b>${escape(city.city)}</b>
            <em>${escape(city.province || '')}</em>
          </span>
          <span class="rank-count">
            <b>${cityMetricValue(city, metric).toLocaleString()}</b>
            <em>${escape(mapMetricUnit(metric))}</em>
          </span>
        </button>
      `).join('');
      rankRoot.querySelectorAll('.china-rank-row').forEach((row) => {
        row.addEventListener('click', () => {
          openCityPopup(row.dataset.city, true);
        });
      });
    }

    function updateMapMetric(metric) {
      activeMetric = metric === 'registrations' ? 'registrations' : 'companies';
      document.querySelectorAll('[data-map-metric]').forEach((button) => {
        button.classList.toggle('active', button.dataset.mapMetric === activeMetric);
      });
      markerByCity.forEach((cityMarker, cityName) => {
        const city = cityByName.get(cityName);
        if (!city) return;
        const radius = cityRadius(city, activeMetric, maxByMetric);
        cityMarker.marker.setRadius(radius);
        cityMarker.hitMarker.setRadius(cityHitRadius(radius));
        cityMarker.marker.setTooltipContent(cityTooltipText(city, activeMetric));
        cityMarker.hitMarker.setTooltipContent(cityTooltipText(city, activeMetric));
      });
      renderRank(activeMetric);
    }

    document.querySelectorAll('[data-map-metric]').forEach((button) => {
      button.addEventListener('click', () => updateMapMetric(button.dataset.mapMetric));
    });
    rankMoreButton?.addEventListener('click', () => {
      rankExpanded = !rankExpanded;
      renderRank(activeMetric);
    });
    updateMapMetric(activeMetricDefault);
  }

  function cityMapLatLng(city) {
    return mapLatLng(Number(city.lat), Number(city.lng));
  }

  function mapLatLng(lat, lng) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [lat, lng];
    if (lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271) return [lat, lng];
    const a = 6378245.0;
    const ee = 0.00669342162296594323;
    const dLat = transformChinaLat(lng - 105.0, lat - 35.0);
    const dLng = transformChinaLng(lng - 105.0, lat - 35.0);
    const radLat = lat / 180.0 * Math.PI;
    let magic = Math.sin(radLat);
    magic = 1 - ee * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    const mgLat = lat + (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * Math.PI);
    const mgLng = lng + (dLng * 180.0) / (a / sqrtMagic * Math.cos(radLat) * Math.PI);
    return [mgLat, mgLng];
  }

  function transformChinaLat(x, y) {
    let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
    ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin(y / 3.0 * Math.PI)) * 2.0 / 3.0;
    ret += (160.0 * Math.sin(y / 12.0 * Math.PI) + 320 * Math.sin(y * Math.PI / 30.0)) * 2.0 / 3.0;
    return ret;
  }

  function transformChinaLng(x, y) {
    let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
    ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
    ret += (20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin(x / 3.0 * Math.PI)) * 2.0 / 3.0;
    ret += (150.0 * Math.sin(x / 12.0 * Math.PI) + 300.0 * Math.sin(x / 30.0 * Math.PI)) * 2.0 / 3.0;
    return ret;
  }

  function renderChinaMapLegend() {
    const legend = document.getElementById('china-map-legend');
    if (!legend) return;
    legend.innerHTML = SEGMENTS.map((segment) => `
      <span><i style="--legend-color:${segment.color}"></i>${escape(segment.name)}</span>
    `).join('');
  }

  function cityMetricValue(city, metric) {
    return Number(metric === 'registrations' ? city.registrations : city.companies) || 0;
  }

  function mapMetricLabel(metric) {
    return metric === 'registrations' ? '注册证数' : '企业数';
  }

  function mapMetricUnit(metric) {
    return metric === 'registrations' ? '张' : '家';
  }

  function bindCityMarker(marker, city, metric, withPopup = true) {
    marker
      .bindTooltip(cityTooltipText(city, metric), {
        direction: 'top',
        opacity: 0.95,
      });
    if (!withPopup) return;
    marker.bindPopup(cityPopupHtml(city), {
      closeButton: false,
      maxWidth: 300,
      className: 'china-map-popup-shell',
    });
  }

  function cityRadius(city, metric, maxByMetric) {
    const value = cityMetricValue(city, metric);
    const max = Math.max(maxByMetric[metric] || 1, 1);
    return Math.max(4.5, Math.min(11, 4 + Math.sqrt(value / max) * 7));
  }

  function cityHitRadius(radius) {
    return Math.max(14, radius + 7);
  }

  function cityTooltipText(city, metric) {
    return `${city.city} · ${Number(city.companies || 0).toLocaleString()} 家企业 / ${Number(city.registrations || 0).toLocaleString()} 张注册证`;
  }

  function cityPopupHtml(city) {
    const companyRows = (city.companies_sample || []).slice(0, 5).map((company) => `
      <li>
        <span>${escape(company.name || '未公开')}</span>
        <b>${Number(company.records || 0).toLocaleString()}</b>
      </li>
    `).join('');
    const trackRows = (city.tracks || []).slice(0, 4).map((track) => `
      <span>${escape(track.name)} ${Number(track.records || 0).toLocaleString()}</span>
    `).join('');
    return `
      <div class="china-map-popup">
        <div class="popup-title">${escape(city.city)} · ${escape(city.province || '')}</div>
        <div class="popup-meta">${Number(city.companies || 0).toLocaleString()} 家注册主体 · ${Number(city.registrations || 0).toLocaleString()} 张注册证</div>
        <div class="popup-tags">${trackRows}</div>
        <ul>${companyRows || '<li><span>暂无企业样本</span><b>—</b></li>'}</ul>
      </div>
    `;
  }

  function cityTrackColor(trackName) {
    const label = String(trackName || '');
    if (/玻尿酸|透明质酸/.test(label)) return SEGMENT_BY_CODE.ha.color;
    if (/肉毒/.test(label)) return SEGMENT_BY_CODE.botulinum.color;
    if (/胶原蛋白/.test(label)) return SEGMENT_BY_CODE.collagen.color;
    if (/胶原刺激剂|PLA/.test(label)) return SEGMENT_BY_CODE.plla.color;
    if (/PCL/.test(label)) return SEGMENT_BY_CODE.pcl.color;
    if (/CaHA|羟基磷酸钙/.test(label)) return SEGMENT_BY_CODE.caha.color;
    if (/EBD|设备|光电/.test(label)) return SEGMENT_BY_CODE.ebd.color;
    const segment = SEGMENTS.find((item) => item.name === trackName || item.fullName === trackName);
    return segment?.color || '#a7abd8';
  }

  function renderSegments() {
    const grid = document.getElementById('segments-grid');
    if (!grid) return;
    grid.innerHTML = '';
    SEGMENTS.forEach((seg) => {
      const stats = segmentCardStats(seg.code);
      const card = document.createElement(seg.href ? 'a' : 'button');
      if (seg.href) {
        card.href = seg.href;
      } else {
        card.type = 'button';
        card.addEventListener('click', () => {
          const source = records.filter((record) => record.certificateNo && cardSegment(record) === seg.code);
          showRecords({ title: seg.fullName, meta: '注册记录', records: source.map(toDrawerRecord) });
        });
      }
      card.className = 'segment-card';
      card.style.setProperty('--accent', seg.color);
      card.style.setProperty('--accent-soft', seg.soft || seg.color);
      card.innerHTML = `
        <div class="name" style="color:${seg.deep || seg.color}">${escape(seg.fullName)}</div>
        <div class="stats">
          <div><div class="v">${stats.registrations}</div><div class="l">注册数</div></div>
          <div><div class="v">${stats.companies}</div><div class="l">注册企业</div></div>
          <div><div class="v">${stats.indications}</div><div class="l">适应证</div></div>
        </div>
        <div class="muted" style="font-size:12px">最新获批时间：${escape(stats.latestLabel)}</div>
        ${seg.href ? '<div class="arrow">→</div>' : ''}
      `;
      grid.appendChild(card);
    });
  }

  function segmentCardStats(code) {
    const source = records.filter((record) => record.certificateNo && cardSegment(record) === code);
    const latestDate = source
      .map((record) => record.approvalDate || '')
      .filter(Boolean)
      .sort()
      .at(-1);
    return {
      registrations: source.length,
      companies: unique(source.map((record) => manufacturerGroup(record).key)).length,
      indications: unique(source.flatMap(indicationValues)).length,
      latestLabel: formatYearMonth(latestDate),
    };
  }

  function renderTrend() {
    const source = records.filter((record) => record.board !== 'device');
    const grain = state.trendGrain === 'year' ? 'year' : 'month';
    const periodRows = buildTrendPeriods(source, grain);
    const trendSegments = MATERIAL_SEGMENTS;

    const segmentSeries = trendSegments
      .map((segment) => ({
        name: segment.name,
        code: segment.code,
        color: segment.color,
        data: periodRows.map((period) => source.filter((record) => {
          const date = approvalParts(record);
          return date && trendPeriodKey(date, grain) === period.key && trendSegment(record) === segment.code;
        }).length),
      }))
      .filter((item) => item.data.some(Boolean));
    const topSeriesIdx = periodRows.map((_, periodIndex) => {
      for (let i = segmentSeries.length - 1; i >= 0; i -= 1) {
        if (segmentSeries[i].data[periodIndex] > 0) return i;
      }
      return -1;
    });
    const series = segmentSeries.map((segment, seriesIndex) => ({
      name: segment.name,
      code: segment.code,
      type: 'bar',
      stack: 'approval',
      barMaxWidth: 28,
      emphasis: { focus: 'series' },
      itemStyle: { color: segment.color },
      data: segment.data.map((value, periodIndex) => ({
        value,
        itemStyle: crystalBarStyle(segment.color, topSeriesIdx[periodIndex] === seriesIndex ? [6, 6, 0, 0] : 0),
      })),
    }));

    const chart = makeChart(document.getElementById('chart-trend'), {
      color: segmentSeries.map((segment) => segment.color),
      legend: { bottom: 0, type: 'scroll' },
      grid: { left: 36, right: 24, top: 30, bottom: 50, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (items) => {
          const period = periodRows[items[0]?.dataIndex];
          const active = items.filter((item) => Number(item.value) > 0);
          const lines = active.map((item) => {
            const matched = segmentSeries.find((segment) => segment.name === item.seriesName);
            const color = escape(String(matched?.color || '#a7abd8'));
            return `<span class="echart-tip-dot" style="background:${color}"></span>${escape(item.seriesName)}：${item.value} 条`;
          }).join('<br/>');
          const total = active.reduce((sum, item) => sum + Number(item.value || 0), 0);
          return `<b>${escape(period?.fullLabel || '')}</b><br/>新增 ${total} 条${lines ? `<br/>${lines}` : ''}`;
        },
      },
      xAxis: {
        type: 'category',
        data: periodRows.map((period) => period.label),
        axisLabel: { rotate: grain === 'month' ? 32 : 0, fontSize: 11 },
      },
      yAxis: { type: 'value', name: '新增证数' },
      series,
    });
    if (chart) {
      chart.on('click', (point) => {
        const period = periodRows[point.dataIndex];
        const segment = trendSegments.find((item) => item.name === point.seriesName);
        const matches = source.filter((record) => {
          const date = approvalParts(record);
          return date && trendPeriodKey(date, grain) === period.key && trendSegment(record) === segment?.code;
        });
        showRecords({
          title: `${period.fullLabel} · ${segment?.name || point.seriesName}`,
          meta: '注册准入趋势',
          records: matches.map(toDrawerRecord),
        });
      });
    }
  }

  function renderInjectableStructure() {
    const source = records.filter((record) => record.board !== 'device');
    const rows = [
      ...MATERIAL_SEGMENTS,
    ].map((segment) => ({
      ...segment,
      value: source.filter((record) => trendSegment(record) === segment.code).length,
    })).filter((row) => row.value);

    const legendHolder = document.getElementById('injectable-structure-legend');
    if (legendHolder) {
      const total = rows.reduce((sum, row) => sum + row.value, 0);
      legendHolder.innerHTML = rows.map((row) => `
        <span>
          <i style="--note-color:${escape(row.color)}"></i>
          <span><b>${escape(row.name)}</b><em>${row.value} 张 · ${percent(row.value, total)}%</em></span>
        </span>
      `).join('');
    }

    const chart = makeChart(document.getElementById('chart-injectable-structure'), {
      tooltip: { show: false },
      legend: { show: false },
      series: [{
        type: 'pie',
        radius: ['50%', '78%'],
        center: ['50%', '50%'],
        data: rows.map((row) => ({
          name: row.name,
          value: row.value,
          itemStyle: {
            color: crystalRadial(row.color),
            borderColor: 'transparent',
            borderWidth: 0,
            shadowBlur: 14,
            shadowColor: colorAlpha(row.color, 0.24),
            shadowOffsetY: 4,
          },
          code: row.code,
        })),
        itemStyle: { borderColor: 'transparent', borderWidth: 0, borderRadius: 0 },
        label: { show: false },
        labelLine: { show: false },
        emphasis: {
          scaleSize: 6,
          label: {
            show: true,
            position: 'center',
            formatter: (point) => `{n|${displayUiLabel(point.name)}}\n{v|${point.value}}\n{p|${point.percent.toFixed(1)}%}`,
            rich: {
              n: { fontSize: 13, color: palette.ink3, padding: [0, 0, 6, 0], fontWeight: 400 },
              v: { fontSize: 30, fontWeight: 650, color: palette.ink },
              p: { fontSize: 12, color: palette.ink3, padding: [4, 0, 0, 0], fontWeight: 400 },
            },
          },
        },
      }],
    });
    if (chart) {
      chart.on('click', (point) => {
        const row = rows.find((item) => item.name === point.name);
        const matches = source.filter((record) => trendSegment(record) === row?.code);
        showRecords({ title: row?.name || point.name, meta: '注射剂市场结构', records: matches.map(toDrawerRecord) });
      });
    }
  }

  function renderActivityRows() {
    const holder = document.getElementById('activity-rows');
    if (!holder) return;
    const activityColors = {
      cumulative: '#9ecfe3',
      cumulativeSoft: '#e1f2f8',
      recent: '#a7abd8',
      recentSoft: '#e3e5f6',
    };
    const activitySource = records.filter((record) => record.board !== 'device');
    const rows = [
      ...MATERIAL_SEGMENTS,
    ].map((segment) => {
      const source = activitySource.filter((record) => {
        const segmentCode = trendSegment(record);
        return segmentCode === segment.code;
      });
      const recent = source.filter((record) => Number(record.approvalYear) >= 2025).length;
      return { ...segment, count: source.length, recent };
    }).filter((row) => row.count);
    const max = Math.max(...rows.map((row) => row.count), 1);
    const pct = (value) => (value ? Math.min(100, Math.max(3, Math.round((value / max) * 1000) / 10)) : 0);
    const barWidth = (value) => (value ? `${pct(value)}%` : '0%');

    holder.innerHTML = `
      <div class="activity-chart">
        ${rows.map((row) => `
          <button class="activity-row" type="button" data-activity-segment="${escape(row.code)}" style="--activity:${activityColors.cumulative};--activity-soft:${activityColors.cumulativeSoft};--activity-recent:${activityColors.recent};--activity-recent-soft:${activityColors.recentSoft}">
            <span class="activity-label">${escape(row.fullName || row.name)}</span>
            <span class="activity-bars" aria-label="累计记录 ${row.count}，近两年新增 ${row.recent}">
              <span class="activity-line activity-line-merged">
                <i style="width:${barWidth(row.count)}"></i>
                ${row.recent ? `<b style="width:${barWidth(row.recent)}"></b>` : ''}
              </span>
              <span class="activity-count">${row.recent}/${row.count}</span>
            </span>
          </button>
        `).join('')}
      </div>
      <div class="matrix-legend">
        <span><i style="background:${activityColors.cumulative}"></i>累计记录</span>
        <span><i style="background:${activityColors.recent}"></i>近两年新增</span>
      </div>
    `;
    holder.querySelectorAll('[data-activity-segment]').forEach((button) => {
      button.addEventListener('click', () => {
        state.segment = button.dataset.activitySegment || 'all';
        syncFilters();
        renderRecordsTable();
        document.getElementById('table-records')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  function renderManufacturerMatrix() {
    const holder = document.getElementById('manufacturer-matrix');
    if (!holder) return;
    const rows = manufacturerRows(records);
    const materialRows = [...rows].sort(sortManufacturerMaterialRows);
    const indicationRows = [...rows].sort(sortManufacturerIndicationRows);
    const materialColumns = manufacturerMaterialColumns(records);
    const indicationColumns = indicationColumnsAll(records);
    const materialMax = Math.max(...materialRows.flatMap((row) => materialColumns.map((column) =>
      row.owned.filter((record) => heatSegment(record) === column.key).length
    )), 1);
    const indicationMax = Math.max(...indicationRows.flatMap((row) => indicationColumns.map((column) =>
      row.owned.filter((record) => indicationValues(record).includes(column.key)).length
    )), 1);

    holder.innerHTML = [
      renderManufacturerHeatmap({
        title: '厂家 × 材料布局',
        rows: materialRows,
        columns: materialColumns,
        kind: 'segment',
        max: materialMax,
      }),
      renderManufacturerHeatmap({
        title: '厂家 × 适应证布局',
        rows: indicationRows,
        columns: indicationColumns,
        kind: 'indication',
        max: indicationMax,
      }),
    ].join('');
    bindMatrixInteractions(holder, '厂家竞争力矩阵');
    holder.querySelectorAll('[data-company-open]').forEach((button) => {
      button.addEventListener('click', () => {
        const row = rows.find((item) => item.key === button.dataset.companyOpen);
        if (!row) return;
        showRecords({ title: row.name, meta: '厂家全部注册记录', records: row.owned.map(toDrawerRecord) });
      });
    });
  }

  function renderManufacturerHeatmap({ title, subtitle = '', rows, columns, kind, max }) {
    const minColumn = kind === 'indication' ? 70 : 88;
    const leftColumn = kind === 'indication' ? 138 : 150;
    const minWidth = Math.max(kind === 'indication' ? 980 : 720, leftColumn + columns.length * minColumn);
    const trackTemplate = kind === 'indication'
      ? `minmax(${leftColumn}px, ${leftColumn + 20}px) repeat(${columns.length}, minmax(${minColumn}px, ${minColumn + 18}px))`
      : `minmax(${leftColumn}px, ${leftColumn + 24}px) repeat(${columns.length}, minmax(${minColumn}px, 1fr))`;
    const heads = [
      '<div class="manufacturer-heat-head">厂家</div>',
      ...columns.map((column) => `<div class="manufacturer-heat-head" title="${escape(displayUiLabel(column.name))}">${escape(displayUiLabel(column.name))}</div>`),
    ].join('');
    const body = rows.map((row) => {
      const cells = columns.map((column) => {
        const source = kind === 'segment'
          ? row.owned.filter((record) => heatSegment(record) === column.key)
          : row.owned.filter((record) => indicationValues(record).includes(column.key));
        return renderMatrixCell({
          value: source.length,
          max,
          className: 'manufacturer-heat-cell',
          tooltip: tooltipFromRecords(source),
          label: source.length || '',
          onClickRecords: source.map(toDrawerRecord),
          theme: kind === 'segment' ? 'ocean' : 'sage',
        });
      }).join('');
      return `
        <button class="manufacturer-heat-name" type="button" data-company-open="${escape(row.key)}">
          <strong title="${escape(row.name)}">${escape(row.name)}</strong>
          <span>${row.count}证 · ${row.indications}适应证 · ${row.segments}赛道</span>
        </button>
        ${cells}
      `;
    }).join('');
    return `
      <section class="manufacturer-heatmap-section">
        <div class="manufacturer-heatmap-title">
          <div>
            <h4>${escape(title)}</h4>
            ${subtitle ? `<p>${escape(subtitle)}</p>` : ''}
          </div>
          <span>${rows.length} 家厂家</span>
        </div>
        <div class="manufacturer-heatmap-scroll">
          <div class="manufacturer-heatmap-grid manufacturer-heatmap-grid-${escape(kind)}" style="min-width:${minWidth}px;grid-template-columns:${trackTemplate}">
            ${heads}${body}
          </div>
        </div>
        ${heatLegend(kind === 'segment' ? 'ocean' : 'sage')}
      </section>
    `;
  }

  function renderOpportunityMatrix() {
    const holder = document.getElementById('opportunity-matrix');
    if (!holder) return;
    const source = records.filter((record) => record.board !== 'device');
    const columns = sortColumnsByRecordCount([
      ...MATERIAL_SEGMENTS.map((segment) => ({ key: segment.code, name: segment.name })),
    ], source, (record) => trendSegment(record));
    const rows = indicationColumnsAll(source);
    const max = Math.max(...rows.flatMap((row) => columns.map((column) =>
      source.filter((record) => indicationValues(record).includes(row.key) && trendSegment(record) === column.key).length
    )), 1);
    const heads = ['<div class="matrix-head">适应证</div>']
      .concat(columns.map((column) => `<div class="matrix-head">${escape(displayUiLabel(column.name))}</div>`))
      .join('');
    const body = rows.map((row) => {
      const cells = columns.map((column) => {
        const matches = source.filter((record) => indicationValues(record).includes(row.key) && trendSegment(record) === column.key);
        return renderMatrixCell({
          value: matches.length,
          max,
          tooltip: tooltipFromRecords(matches),
          label: matches.length || '',
          onClickRecords: matches.map(toDrawerRecord),
          theme: 'plum',
        });
      }).join('');
      return `<div class="matrix-term">${escape(indicationLabel(row.key))}</div>${cells}`;
    }).join('');
    const minWidth = Math.max(820, 126 + columns.length * 92);
    holder.innerHTML = `
      <div class="matrix-grid matrix-grid-opportunity" style="min-width:${minWidth}px;grid-template-columns:minmax(118px, 142px) repeat(${columns.length}, minmax(86px, 1fr))">
        ${heads}${body}
      </div>
      ${heatLegend('plum')}
    `;
    bindMatrixInteractions(holder, '适应证 × 赛道机会矩阵');
  }

  function renderExpiry(ex) {
    if (!ex) return;
    const visibleExpirySeries = ex.series
      .filter((item) => item.data.some((value) => Number(value) > 0))
      .map((item, index) => ({
        ...item,
        label: SEGMENT_BY_CODE[item.key]?.fullName || displayUiLabel(item.name),
        color: SEGMENT_BY_CODE[item.key]?.color || SERIES_COLORS[index % SERIES_COLORS.length] || '#a7abd8',
      }));
    const topSeriesIdx = ex.quarters.map((_, qi) => {
      for (let i = visibleExpirySeries.length - 1; i >= 0; i -= 1) {
        if (visibleExpirySeries[i].data[qi] > 0) return i;
      }
      return -1;
    });
    const series = visibleExpirySeries.map((s, i) => {
      const color = s.color || SERIES_COLORS[i % SERIES_COLORS.length] || SEGMENTS[i % SEGMENTS.length]?.color || '#a7abd8';
      return {
        name: s.label,
        type: 'bar',
        stack: 'expiry',
        barMaxWidth: 28,
        itemStyle: { color },
        data: s.data.map((v, qi) => ({
          value: v,
          itemStyle: crystalBarStyle(color, topSeriesIdx[qi] === i ? [6, 6, 0, 0] : 0),
        })),
        emphasis: { focus: 'series' },
      };
    });
    const chart = makeChart(document.getElementById('chart-expiry'), {
      color: visibleExpirySeries.map((seriesItem) => seriesItem.color),
      legend: { bottom: 0, type: 'scroll' },
      grid: { left: 36, right: 24, top: 30, bottom: 50, containLabel: true },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (items) => {
          const active = items.filter((item) => Number(item.value) > 0);
          if (!active.length) return '';
          const quarterRaw = ex.quarters[items[0]?.dataIndex] || '';
          const quarter = escape(quarterRaw);
          const lines = active.map((item) => {
            const matched = visibleExpirySeries.find((row) => row.label === item.seriesName);
            const color = matched?.color || '#a7abd8';
            const details = expiryRecordsForQuarter(quarterRaw, matched)
              .map((record) => {
                const company = manufacturerDisplayName(record) || record.company || record.registrant || '未标注厂家';
                const material = displayUiLabel(record.materialFamily || record.trackName || matched?.label || '');
                return `${company} · ${material}`;
              });
            const detailText = compactList(details.slice(0, Number(item.value || 0)), 3);
            return `
              <div class="expiry-tip-item">
                <div class="expiry-tip-main">
                  <span class="echart-tip-dot" style="background:${escape(color)}"></span>
                  <b>${escape(item.seriesName)}</b>
                  <strong>${item.value}</strong>
                </div>
                ${detailText ? `<div class="expiry-tip-detail">${escape(detailText)}</div>` : ''}
              </div>
            `;
          }).join('');
          return `<div class="expiry-tip"><b>${quarter}</b>${lines}</div>`;
        },
      },
      xAxis: { type: 'category', data: ex.quarters, axisLabel: { fontSize: 11 } },
      yAxis: { type: 'value', name: '到期证数' },
      series,
    });
    if (chart) {
      chart.on('click', (point) => {
        const quarter = ex.quarters[point.dataIndex];
        const seriesRow = visibleExpirySeries.find((row) => row.label === point.seriesName);
        const matches = expiryRecordsForQuarter(quarter, seriesRow).map(toDrawerRecord);
        showRecords({ title: `${quarter} · ${point.seriesName}`, meta: '即将到期', records: matches });
      });
    }
  }

  function expiryRecordsForQuarter(quarter, seriesRow) {
    if (!quarter || !seriesRow?.key) return [];
    return records.filter((record) =>
      validUntilQuarter(record) === quarter && heatSegment(record) === seriesRow.key
    );
  }

  function validUntilQuarter(record) {
    const raw = String(record.validUntil || record.valid_until || '');
    const match = raw.match(/^(\d{4})-(\d{1,2})/);
    if (!match) return '';
    return `${match[1]}Q${Math.ceil(Number(match[2]) / 3)}`;
  }

  function compactList(values, limit = 3) {
    const uniqueValues = unique((values || []).map((value) => String(value || '').trim()).filter(Boolean));
    if (!uniqueValues.length) return '';
    const shown = uniqueValues.slice(0, limit);
    const more = uniqueValues.length - shown.length;
    return `${shown.join('、')}${more > 0 ? `，另 ${more} 条` : ''}`;
  }

  function renderOriginEvolution(ev) {
    const quarterly = buildOriginQuarterEvolution(records);
    if (!quarterly.labels.length && (!ev || !ev.years?.length)) return;
    const labels = quarterly.labels.length ? quarterly.labels : ev.years;
    const sourceSeries = quarterly.series.length ? quarterly.series : ev.series;
    const originColors = ['#9ecfe3', '#d9a0b1', '#ead7c9'];
    const series = sourceSeries
      .filter((s) => s.data.some((v) => v > 0))
      .map((s, index) => {
        const color = originColors[index % originColors.length];
        return {
          name: s.name,
          type: 'line',
          smooth: 0.4,
          showSymbol: true,
          symbolSize: 7,
          lineStyle: {
            width: 3,
            color: crystalLinear(color, 'horizontal'),
            shadowBlur: 10,
            shadowColor: colorAlpha(color, 0.26),
            shadowOffsetY: 3,
          },
          itemStyle: {
            color: crystalRadial(color),
            borderColor: '#fffaf6',
            borderWidth: 2,
            shadowBlur: 8,
            shadowColor: colorAlpha(color, 0.28),
          },
          areaStyle: {
            opacity: 1,
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: colorAlpha(color, 0.16) },
              { offset: 1, color: colorAlpha(color, 0.02) },
            ]),
          },
          emphasis: { focus: 'series' },
          data: s.data,
        };
      });
    makeChart(document.getElementById('chart-origin'), {
      color: originColors,
      legend: { bottom: 0 },
      grid: { left: 32, right: 18, top: 30, bottom: 48, containLabel: true },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: labels, boundaryGap: false, axisLabel: { hideOverlap: true, fontSize: 11 } },
      yAxis: { type: 'value', name: '当季获批数' },
      series,
    });
  }

  function buildOriginQuarterEvolution(source) {
    const originSeries = [
      { key: 'domestic', name: '国产' },
      { key: 'imported', name: '进口' },
      { key: 'hkmt', name: '港澳台' },
    ];
    const buckets = new Map();
    const indexes = [];
    source.forEach((record) => {
      const origin = originKey(record);
      if (!originSeries.some((item) => item.key === origin)) return;
      const date = approvalParts(record);
      if (!date || date.year < 2020) return;
      const quarter = Math.ceil(date.month / 3);
      const index = date.year * 4 + quarter - 1;
      indexes.push(index);
      buckets.set(`${index}:${origin}`, (buckets.get(`${index}:${origin}`) || 0) + 1);
    });
    if (!indexes.length) return { labels: [], series: [] };
    const start = 2020 * 4;
    const end = Math.max(...indexes);
    const periods = range(start, end).map((index) => ({
      index,
      label: `${Math.floor(index / 4)}Q${(index % 4) + 1}`,
    }));
    return {
      labels: periods.map((period) => period.label),
      series: originSeries.map((origin) => ({
        name: origin.name,
        data: periods.map((period) => buckets.get(`${period.index}:${origin.key}`) || 0),
      })),
    };
  }

  function renderConcentration(concentration, tracksMeta) {
    const tbody = document.querySelector('#table-concentration tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    ['ha', 'collagen', 'plla', 'pcl', 'caha', 'botulinum', 'ebd'].forEach((key) => {
      const row = concentration?.[key];
      const meta = tracksMeta.find((track) => track.key === key);
      if (!row || !meta) return;
      const structure = describeStructure(row);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><b style="color:${meta.accent}">${escape(displayUiLabel(meta.name))}</b></td>
        <td class="num">${row.total_certs}</td>
        <td class="num">${row.company_count}</td>
        <td class="num">${row.cr4}</td>
        <td class="num">${row.cr8}</td>
        <td class="num">${row.hhi}</td>
        <td>${structure.tag}<div class="market-structure-note">${structure.note}</div></td>
      `;
      tr.addEventListener('click', () => { window.location = meta.url; });
      tbody.appendChild(tr);
    });
  }

  function initRecordFilters() {
    fillSelect('filter-segment', [
      ['all', '全部赛道'],
      ...SEGMENTS.map((segment) => [segment.code, segment.fullName]),
    ]);
    fillSelect('filter-company', [
      ['all', '全部厂家'],
      ...manufacturerRows(records).map((row) => [row.key, row.name]),
    ]);
    fillSelect('filter-class', [
      ['all', '全部监管'],
      ['class3', '三类器械'],
      ['drug', '药品批准'],
      ['other', '其他'],
    ]);
    fillSelect('filter-origin', [
      ['all', '全部产地'],
      ['domestic', '国产'],
      ['imported', '进口'],
      ['hkmt', '港澳台'],
      ['unknown', '未标注'],
    ]);

    [
      ['filter-segment', 'segment'],
      ['filter-company', 'company'],
      ['filter-class', 'classKey'],
      ['filter-origin', 'origin'],
    ].forEach(([id, key]) => {
      const node = document.getElementById(id);
      if (!node) return;
      node.addEventListener('change', () => {
        state[key] = node.value || 'all';
        renderRecordsTable();
      });
    });
    document.getElementById('filter-query')?.addEventListener('input', (event) => {
      state.query = event.target.value || '';
      renderRecordsTable();
    });
    document.getElementById('reset-filters')?.addEventListener('click', () => {
      state.segment = 'all';
      state.company = 'all';
      state.classKey = 'all';
      state.origin = 'all';
      state.query = '';
      syncFilters();
      renderRecordsTable();
    });
  }

  function renderRecordsTable() {
    const tbody = document.querySelector('#table-records tbody');
    if (!tbody) return;
    const source = filteredRecords();
    setText('record-count', source.length);
    tbody.innerHTML = source.map((record, index) => `
      <tr data-record-index="${index}">
        <td class="nowrap">${escape(record.certificateNo || '—')}</td>
        <td><b>${escape(productLabel(record))}</b><div class="muted" style="font-size:11.5px">${escape(displayUiLabel(record.materialFamily || record.trackName || ''))}</div></td>
        <td>${escape(manufacturerDisplayName(record))}</td>
        <td>${escape(segmentDisplayName(heatSegment(record)))}</td>
        <td>${escape(classLabel(classKey(record)))}</td>
        <td>${escape(record.origin || '未标注')}</td>
        <td class="nowrap">${escape(record.approvalDate || '')}</td>
        <td>${escape(formatRecordIndications(record))}</td>
      </tr>
    `).join('');
    tbody.querySelectorAll('tr').forEach((row) => {
      row.addEventListener('click', (event) => {
        if (event.target.closest('a')) return;
        const record = source[Number(row.dataset.recordIndex)];
        if (record) showRecords({ title: productLabel(record), meta: '注册官方信息', records: [toDrawerRecord(record)] });
      });
    });
  }

  function renderMatrixCell({ value, max, tooltip, label, onClickRecords, className = 'matrix-cell', theme = 'coral' }) {
    const heat = matrixHeat(value, max);
    const attrs = [
      `class="${className}"`,
      `data-heat="${heat.tier}"`,
      `data-tooltip="${escape(tooltip || '')}"`,
      `data-tooltip-theme="${escape(theme)}"`,
      `style="${heatmapCellStyle(value, max, theme)}"`,
    ].join(' ');
    if (!value) return `<span ${attrs}></span>`;
    const payload = encodeURIComponent(JSON.stringify(onClickRecords || []));
    return `<button type="button" ${attrs} data-records="${payload}">${escape(label)}</button>`;
  }

  function bindMatrixInteractions(root, meta) {
    const tooltipNode = matrixTooltipNode();
    root.querySelectorAll('button.matrix-cell,button.manufacturer-heat-cell').forEach((cell) => {
      const showTip = (event) => {
        const html = tooltipHtml(cell.dataset.tooltip || '', cell.dataset.tooltipTheme || 'coral');
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
        const html = tooltipHtml(cell.dataset.tooltip || '', cell.dataset.tooltipTheme || 'coral');
        if (!html) return;
        const rect = cell.getBoundingClientRect();
        tooltipNode.innerHTML = html;
        tooltipNode.classList.add('visible');
        positionMatrixTooltip(tooltipNode, rect.left + rect.width / 2, rect.bottom);
      });
      cell.addEventListener('blur', hideTip);
      cell.addEventListener('click', () => {
        hideTip();
        let payload = [];
        try {
          payload = JSON.parse(decodeURIComponent(cell.dataset.records || '[]'));
        } catch (error) {
          payload = [];
        }
        showRecords({ title: cell.getAttribute('aria-label') || '热力格记录', meta, records: payload });
      });
    });
  }

  function heatLegend(theme = 'coral') {
    return '';
  }

  function matrixHeat(value, max) {
    if (!value) return { tier: 'empty', heat: 0 };
    const heat = Math.log1p(value) / Math.log1p(Math.max(max, 1));
    if (heat >= 0.82) return { tier: 'peak', heat };
    if (heat >= 0.58) return { tier: 'hot', heat };
    if (heat >= 0.42) return { tier: 'warm', heat };
    if (heat >= 0.24) return { tier: 'mid', heat };
    return { tier: 'low', heat };
  }

  function heatColor(heat, theme = 'coral') {
    const config = HEAT_THEMES[theme] || HEAT_THEMES.coral;
    const lightness = Math.round(config.lightHigh - heat * (config.lightHigh - config.lightLow));
    const saturation = Math.round(config.saturation + heat * 8);
    return `hsl(${config.hue} ${saturation}% ${lightness}%)`;
  }

  function heatmapCellStyle(value, max, theme = 'coral') {
    const config = HEAT_THEMES[theme] || HEAT_THEMES.coral;
    return crystalCssHeatVars(value, max, { base: config.base, fgDark: config.fg });
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

  function tooltipHtml(raw, theme = 'coral') {
    if (!raw) return '';
    let items = [];
    try {
      items = JSON.parse(raw);
    } catch (error) {
      items = String(raw).split('\n').filter(Boolean).map((label) => ({ label }));
    }
    if (!Array.isArray(items) || !items.length) return '';
    const rows = items
      .slice(0, 7)
      .map((item) => `<li><i></i><span>${escape(item.label || item)}</span></li>`)
      .join('');
    return `<ul class="tooltip-list tooltip-${escape(theme)}">${rows}</ul>`;
  }

  function positionMatrixTooltip(node, x, y) {
    const margin = 14;
    const rect = node.getBoundingClientRect();
    const left = Math.min(Math.max(x + 14, margin), Math.max(window.innerWidth - rect.width - margin, margin));
    const top = Math.min(Math.max(y + 14, margin), Math.max(window.innerHeight - rect.height - margin, margin));
    node.style.left = `${left}px`;
    node.style.top = `${top}px`;
  }

  function buildTrendPeriods(source, grain) {
    const dates = source.map(approvalParts).filter(Boolean);
    if (!dates.length) return [];
    if (grain === 'year') {
      const minYear = Math.max(2020, Math.min(...dates.map((date) => date.year)));
      const maxYear = Math.max(minYear, Math.max(...dates.map((date) => date.year), 2026));
      return range(minYear, maxYear).map((year) => ({
        key: String(year),
        label: String(year),
        fullLabel: `${year}年`,
      }));
    }
    const indexes = dates.map((date) => date.year * 12 + date.month - 1);
    const latest = Math.max(...indexes);
    const earliest = Math.max(Math.min(...indexes), latest - 23);
    return range(earliest, latest).map((index) => {
      const year = Math.floor(index / 12);
      const month = (index % 12) + 1;
      return {
        key: `${year}-${String(month).padStart(2, '0')}`,
        label: `'${String(year).slice(2)}.${String(month).padStart(2, '0')}`,
        fullLabel: `${year}年${month}月`,
      };
    });
  }

  function approvalParts(record) {
    const raw = String(record.approvalDate || record.approval_date || '');
    const match = raw.match(/(\d{4})\D+(\d{1,2})/);
    const year = Number(match?.[1] || record.approvalYear || record.approval_year || 0);
    const month = Number(match?.[2] || 1);
    if (!year) return null;
    return { year, month: Math.min(Math.max(month || 1, 1), 12) };
  }

  function trendPeriodKey(date, grain) {
    return grain === 'month' ? `${date.year}-${String(date.month).padStart(2, '0')}` : String(date.year);
  }

  function trendSegment(record) {
    const segment = heatSegment(record);
    return SEGMENT_BY_CODE[segment] && segment !== 'ebd' ? segment : 'other';
  }

  function heatSegment(record) {
    const raw = (record.strategicSegment || '').trim();
    if (SEGMENT_BY_CODE[raw]) return raw;
    const track = (record.track || '').trim();
    if (SEGMENT_BY_CODE[track]) return track;
    if (EBD_TRACKS.has(track) || record.board === 'device') return 'ebd';
    if (NICHE_MATERIAL_TRACKS.has(track)) return 'niche_materials';
    return 'other';
  }

  function cardSegment(record) {
    return heatSegment(record);
  }

  function manufacturerRows(source) {
    const groups = new Map();
    source.forEach((record) => {
      const group = manufacturerGroup(record);
      if (!groups.has(group.key)) groups.set(group.key, { key: group.key, name: group.name, owned: [] });
      groups.get(group.key).owned.push(record);
    });
    return [...groups.values()].map((row) => ({
      ...row,
      count: row.owned.length,
      indications: unique(row.owned.flatMap(indicationValues)).length,
      symptoms: unique(row.owned.flatMap(symptomValues)).length,
      segments: unique(row.owned.map(heatSegment)).length,
    }));
  }

  function sortManufacturerMaterialRows(a, b) {
    return b.segments - a.segments
      || b.indications - a.indications
      || b.symptoms - a.symptoms
      || b.count - a.count
      || a.name.localeCompare(b.name, 'zh-CN');
  }

  function sortManufacturerIndicationRows(a, b) {
    return b.indications - a.indications
      || b.segments - a.segments
      || b.count - a.count
      || a.name.localeCompare(b.name, 'zh-CN');
  }

  function manufacturerMaterialColumns(source) {
    const columns = MATERIAL_SEGMENTS.map((segment) => ({ key: segment.code, name: segment.name }));
    return sortColumnsByRecordCount(columns, source, (record) => heatSegment(record));
  }

  function indicationColumnsAll(source) {
    return Object.entries(countBy(source.flatMap(indicationValues), (value) => value))
      .map(([name, count]) => ({ key: name, name: indicationLabel(name), count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));
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
    const source = record?.approvedIndications || record?.approved_indications || record?.primaryIndication || record?.primary_indication || '';
    const values = normalizeIndicationValues(source, record);
    if (values.length) return unique(values);
    return record?.primaryIndication || record?.primary_indication ? [record.primaryIndication || record.primary_indication] : [];
  }

  function symptomValues(record) {
    return normalizeIndicationValues(record?.primaryIndication || record?.primary_indication || '', record);
  }

  function formatRecordIndications(record) {
    const values = indicationValues(record).map(indicationLabel);
    return values.length ? values.join('、') : (record?.primaryIndication || '');
  }

  function cloudIndicationValues(record) {
    const primary = record?.primary_indication || record?.primaryIndication || '';
    if (/[\/／]/.test(String(primary || ''))) {
      const primaryValues = normalizeIndicationValues(primary, record);
      if (primaryValues.length) return unique(primaryValues);
    }
    const listed = Array.isArray(record?.indications)
      ? record.indications.flatMap((value) => normalizeIndicationValues(value, record))
      : [];
    if (listed.length) return unique(listed);
    return normalizeIndicationValues(primary, record);
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

  function sortedHeatmapAxis(items, totalAt) {
    return items.map((name, index) => ({ name, index, total: totalAt(index) }))
      .sort((a, b) => b.total - a.total || String(a.name).localeCompare(String(b.name), 'zh-CN'));
  }

  function sortColumnsByRecordCount(columns, source, keyOf) {
    return columns.map((column, rank) => ({
      ...column,
      rank,
      count: source.filter((record) => keyOf(record) === column.key).length,
    })).filter((column) => column.count > 0)
      .sort((a, b) => b.count - a.count || a.rank - b.rank || a.name.localeCompare(b.name, 'zh-CN'));
  }

  function tooltipFromRecords(source) {
    if (!source?.length) return '';
    const sorted = [...source].sort((a, b) => approvalScore(b) - approvalScore(a));
    const groups = new Map();
    sorted.forEach((record) => {
      const label = conciseRecordLabel(record);
      const key = normalize(label);
      if (!key) return;
      const group = groups.get(key) || { label, count: 0, score: 0 };
      group.count += 1;
      group.score = Math.max(group.score, approvalScore(record));
      groups.set(key, group);
    });
    const labels = [...groups.values()]
      .sort((a, b) => b.score - a.score || b.count - a.count || a.label.localeCompare(b.label, 'zh-CN'))
      .map((group) => ({ label: group.count > 1 ? `${group.label}（${group.count}张）` : group.label }));
    const shown = labels.slice(0, 6);
    if (labels.length > shown.length) {
      shown.push({ label: `另 ${labels.length - shown.length} 家厂家` });
    }
    return JSON.stringify(shown);
  }

  function conciseRecordLabel(record) {
    const company = displayUiLabel([
      manufacturerDisplayName(record || {}),
      record?.manufacturerGroupName,
      record?.companyShort,
      record?.company,
      record?.registrant,
      record?.registrant_name,
      record?.registrantName,
    ].find((value) => value && String(value).trim()) || '');
    const brand = displayUiLabel([
      record?.brandName,
      record?.brand_name,
      record?.brand,
    ].find((value) => value && String(value).trim()) || '');
    const cleanBrand = brand && !isProductDescriptor(brand) && normalize(brand) !== normalize(company) ? brand : '';
    if (cleanBrand && company) return `${cleanBrand} / ${company}`;
    return company || cleanBrand || '未标注厂家';
  }

  function isProductDescriptor(value) {
    return /注射|凝胶|填充剂|透明质酸|交联|利多卡因|溶液|FILLER|LIDOCAINE|CUTEGEL|HYABELL|PRECISE-HA/i.test(String(value || ''));
  }

  function filteredRecords() {
    const query = normalize(state.query);
    return records.filter((record) => {
      const matchesSegment = state.segment === 'all' || heatSegment(record) === state.segment;
      const matchesCompany = state.company === 'all' || manufacturerGroup(record).key === state.company;
      const matchesClass = state.classKey === 'all' || classKey(record) === state.classKey;
      const matchesOrigin = state.origin === 'all' || originKey(record) === state.origin;
      const haystack = normalize([
        record.certificateNo,
        record.brand,
        record.productName,
        record.registrant,
        record.companyShort,
        record.manufacturerGroupName,
        manufacturerDisplayName(record),
        record.trackName,
        record.primaryIndication,
        record.approvedIndications,
        record.specification,
      ].join(' '));
      return matchesSegment && matchesCompany && matchesClass && matchesOrigin && (!query || haystack.includes(query));
    });
  }

  function syncFilters() {
    setSelectValue('filter-segment', state.segment);
    setSelectValue('filter-company', state.company);
    setSelectValue('filter-class', state.classKey);
    setSelectValue('filter-origin', state.origin);
    const query = document.getElementById('filter-query');
    if (query) query.value = state.query;
  }

  function fillSelect(id, pairs) {
    const node = document.getElementById(id);
    if (!node) return;
    node.innerHTML = pairs.map(([value, label]) => `<option value="${escape(value)}">${escape(label)}</option>`).join('');
  }

  function setSelectValue(id, value) {
    const node = document.getElementById(id);
    if (node) node.value = value;
  }

  function setKpi(id, value, opts = {}) {
    const el = document.getElementById(id);
    if (!el) return;
    el.dataset.animateTo = Number(value || 0);
    if (opts.decimals != null) el.dataset.decimals = opts.decimals;
    if (opts.suffix) el.dataset.suffix = opts.suffix;
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function formatRecentBreakdown(value) {
    if (!value) return '—';
    const parts = String(value)
      .split(/\s*\/\s*/)
      .map((item) => {
        const match = item.trim().match(/^(.+?)(\d+)$/);
        if (!match) return item.trim();
        return `${match[1].trim()} ${match[2]} 个`;
      })
      .filter(Boolean);
    return parts.length ? parts.join('，') : value;
  }

  function includeInLandscape(record) {
    if (!record || !record.certificateNo) return false;
    if (record.isClass2 || classKey(record) === 'class2') return false;
    if (record.mainLandscapeIncluded) return record.mainLandscapeIncluded === '是';
    if (isBoundaryRecord(record)) return false;
    return record.isClass3 || record.isDrug || classKey(record) === 'other';
  }

  function includeCloudInLandscape(record) {
    if (!record) return false;
    if (record.main_landscape === false) return false;
    if (isDeviceRecord(record)) return false;
    const text = [
      record.record_type,
      record.recordType,
      record.regulatory_class,
      record.regulatoryClass,
      record.device_type,
      record.deviceType,
      record.market_scope,
      record.marketScope,
      Array.isArray(record.tags) ? record.tags.join(' ') : record.tags,
    ].join(' ');
    return !/二类|省级二类|历史边界/.test(text);
  }

  function isDeviceRecord(record) {
    const track = String(record?.track || record?.track_key || record?.trackKey || record?.strategicSegment || '').trim();
    return record?.board === 'device' || track === 'ebd' || EBD_TRACKS.has(track);
  }

  function isBoundaryRecord(record) {
    const text = [
      record.marketScope,
      record.boundaryReason,
      record.dataStatus,
      record.productTags,
      record.scopeFull,
      record.indicationDescription,
    ].join(' ');
    return /边界|擦边|非适应证|未直接写入面部医美|骨缺损|软组织修复/.test(text);
  }

  function classKey(record) {
    if (record.isDrug) return 'drug';
    if (record.isClass3) return 'class3';
    if (record.isClass2) return 'class2';
    return 'other';
  }

  function classLabel(key) {
    return {
      class3: '三类器械',
      class2: '二类器械',
      drug: '药品批准',
      other: '其他',
    }[key] || key;
  }

  function originKey(record) {
    if (record.origin === '国产' || record.isDomestic) return 'domestic';
    if (record.origin === '进口' || record.isImported) return 'imported';
    if (record.origin === '港澳台') return 'hkmt';
    return 'unknown';
  }

  function manufacturerGroup(record) {
    if (record.manufacturerGroupKey || record.manufacturerGroupName) {
      return {
        key: record.manufacturerGroupKey || normalize(record.manufacturerGroupName).replace(/\s+/g, ' '),
        name: displayUiLabel(record.manufacturerGroupName || manufacturerName(record).trim() || '未标注厂家'),
      };
    }
    const raw = manufacturerName(record).trim();
    return { key: normalize(raw).replace(/\s+/g, ' ') || 'unknown', name: displayUiLabel(raw || '未标注厂家') };
  }

  function manufacturerName(record) {
    return record.companyShort || record.company || record.registrant || record.registrant_name || '';
  }

  function manufacturerDisplayName(record) {
    return manufacturerGroup(record).name;
  }

  function productLabel(record) {
    return record.brand || record.productName || record.officialProductName || record.product_name || record.official_product_name || '未命名产品';
  }

  function segmentDisplayName(code) {
    if (SEGMENT_BY_CODE[code]) return SEGMENT_BY_CODE[code].name;
    if (code === 'other') return '其他材料';
    return code || '未标注';
  }

  function sanitizeUiText(value) {
    return String(value || '').replaceAll('再生类', '胶原刺激剂');
  }

  function displayUiLabel(value) {
    return sanitizeUiText(value)
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

  function toDrawerRecord(record) {
    if ('certificate_no' in record || 'product_name' in record) return record;
    return {
      id: record.id,
      product_name: productLabel(record),
      company: manufacturerDisplayName(record),
      registrant: record.registrant,
      certificate_no: record.certificateNo,
      origin: record.origin,
      material_family: displayUiLabel(record.materialFamily || record.trackName),
      material_form: sanitizeUiText(record.materialForm),
      primary_indication: formatRecordIndications(record),
      approval_date: record.approvalDate,
      valid_until: record.validUntil,
      commercial_name: record.commercialName,
      market_note: record.marketClaim,
      news_account: record.newsAccount,
      news_title: record.newsTitle,
      news_url: record.newsUrl,
      feature_tags: record.featureTags,
      scope_full: record.scopeFull || record.indicationDescription,
      verified: record.officialStatus === 'verified' || /已官方核验|NMPA/.test(record.officialVerificationStatus || ''),
      tags: [
        record.regulatoryClass,
        sanitizeUiText(record.productTags),
        record.lidocaineStatus && !/未见/.test(record.lidocaineStatus) ? record.lidocaineStatus : '',
      ].filter(Boolean),
    };
  }

  function formatYearMonth(value) {
    if (!value) return '暂无获批日期';
    const match = String(value).match(/(\d{4})\D+(\d{1,2})/);
    if (!match) return value;
    return `${match[1]}年${Number(match[2])}月`;
  }

  function approvalScore(record) {
    const raw = record.approvalDate || record.approval_date || '';
    const match = String(raw).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
    if (!match) return Number(record.approvalYear || record.approval_year || 0) * 10000;
    return Number(match[1]) * 10000 + Number(match[2]) * 100 + Number(match[3]);
  }

  function describeStructure(row) {
    const total = Number(row?.total_certs || 0);
    const companies = Number(row?.company_count || 0);
    const cr4 = Number(row?.cr4 || 0);
    const top = Number(row?.top?.[0]?.certs || 0);
    const topShare = Number(row?.top?.[0]?.share || 0);
    if (total <= 2) {
      return { tag: '<span class="tag">样本较小</span>', note: `${companies}家 / ${total}证，暂不作集中度判断` };
    }
    if (total <= 8 && top <= 2) {
      return { tag: '<span class="tag">小样本均衡</span>', note: `${companies}家 / ${total}证，最高单家${top}证` };
    }
    if (cr4 < 40) {
      return { tag: '<span class="tag pos">高度分散</span>', note: `CR4 ${cr4}%，头部占比低` };
    }
    if (topShare <= 20 && companies >= 8) {
      return { tag: '<span class="tag">相对均衡</span>', note: `最高单家${top}证，未见单一企业主导` };
    }
    if (cr4 >= 65 && topShare >= 35 && total >= 10) {
      return { tag: '<span class="tag warn">头部明显</span>', note: `CR4 ${cr4}%，最高单家${top}证` };
    }
    return { tag: '<span class="tag">相对均衡</span>', note: `CR4 ${cr4}%，头部差距有限` };
  }

  function countBy(items, getKey) {
    return items.reduce((acc, item) => {
      const key = getKey(item);
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  function byCountDesc(entries) {
    return entries.sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'zh-CN'));
  }

  function unique(values) {
    return Array.from(new Set(values.filter((value) => value && String(value).trim())));
  }

  function percent(value, total) {
    return total ? Math.round((value / total) * 100) : 0;
  }

  function normalize(value) {
    return String(value || '').toLowerCase().trim();
  }

  function range(start, end) {
    return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
  }
})().catch((error) => {
  console.error(error);
  const shell = document.querySelector('.integrated-shell');
  if (shell) {
    const box = document.createElement('section');
    box.className = 'card';
    box.style.marginTop = '24px';
    box.innerHTML = `<div class="card-title"><h3>页面初始化失败</h3></div><p class="muted">${String(error.message || error)}</p>`;
    shell.prepend(box);
  }
});
