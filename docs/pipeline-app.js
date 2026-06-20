(function () {
  const data = window.PIPELINE_DASHBOARD_DATA || { meta: {}, summary: {}, projects: [], records: [], milestones: [] };
  const state = { track: "all", activeTimelineKey: "", focusedProduct: "" };
  const $ = (id) => document.getElementById(id);

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value ?? "";
  }

  function normalizeKey(value) {
    return String(value || "").replace(/\s+/g, "").toLowerCase();
  }

  function projectIdentity(item) {
    return [item?.track, item?.product, item?.company].map(normalizeKey).join("|");
  }

  function productIdentity(item) {
    return [item?.track, item?.product].map(normalizeKey).join("|");
  }

  function isCompletedProject(project) {
    const stage = String(project?.current_stage || "");
    const status = String(project?.reported_status || "");
    const explicitExpansion = /新增适应症|新增适应证|扩张|扩展|新适应|品规调整|规格调整|剂型调整/.test(`${stage} ${project?.product || ""}`);
    if (explicitExpansion) return false;
    if (/既有证照|非医美基线/.test(stage)) return true;
    if (/^(已获批|已上市)$/.test(stage)) return true;
    if (/注册证.*获批|获得.*注册证|NMPA批准上市|批准上市|正式获批/.test(status) && !/临床|入组|随访|受理|审评|注册检验|型检/.test(stage)) {
      return true;
    }
    return false;
  }

  const activeProjectsAll = data.projects.filter((project) => !isCompletedProject(project));
  const archivedProjectsAll = data.projects.filter(isCompletedProject);
  const activeProjectKeys = new Set(activeProjectsAll.map((project) => project.project_key).filter(Boolean));
  const activeProjectIdentities = new Set(activeProjectsAll.map(projectIdentity));
  const activeProjectProducts = new Set(activeProjectsAll.map(productIdentity));

  function selectedTrackLabel() {
    if (state.track === "all") return "全部材料";
    const track = (data.summary.by_track || []).find((item) => item.track === state.track);
    return track?.track_label || state.track;
  }

  function activeProjects() {
    return activeProjectsAll.filter((project) => state.track === "all" || project.track === state.track);
  }

  function archivedProjects() {
    return archivedProjectsAll.filter((project) => state.track === "all" || project.track === state.track);
  }

  function activeRecords() {
    return data.records.filter((record) => {
      if (record.frontstage_use === "hidden") return false;
      if (state.track !== "all" && record.track !== state.track) return false;
      return activeProjectIdentities.has(projectIdentity(record)) || activeProjectProducts.has(productIdentity(record));
    });
  }

  function activeMilestones() {
    return data.milestones.filter((item) => {
      if (state.track !== "all" && item.track !== state.track) return false;
      return activeProjectKeys.has(item.project_key);
    });
  }

  function gradeLabel(grade) {
    const labels = {
      A0: "官方获批/审评",
      A1: "官方受理/临床登记",
      A2: "上市公司披露",
      A3: "企业/机构原文",
      A4: "媒体/研究线索",
      A5: "线下待核验",
      A6: "传闻线索",
    };
    return labels[grade] || grade || "-";
  }

  function gradeBadgeClass(grade) {
    if (["A0", "A1", "A2", "A3"].includes(grade)) return "strong";
    if (["A4", "A5", "A6"].includes(grade)) return "warn";
    return "";
  }

  function stageBucket(project) {
    const stage = String(project?.current_stage || "");
    const status = String(project?.reported_status || "");
    const text = `${stage} ${project?.stage_chain || ""} ${status}`;
    if (/权益|管线披露|平台|资本线索|行业总体|监管路径/.test(stage)) return "scout";
    if (/注册检验|型检|检验|分类界定|主文档|原料/.test(stage)) return "testing";
    if (/受理|送达|审评|审批|上市注册推进/.test(stage) || /获得.*受理|注册申请.*受理|上市申请.*受理/.test(status)) return "review";
    if (/临床|入组|随访|I\/II|III|阶段完成/.test(text)) return "clinical";
    return "scout";
  }

  function stageBucketLabel(bucket) {
    return {
      clinical: "注册临床中",
      review: "受理/审评中",
      testing: "注册检验/型检",
      scout: "早期线索",
    }[bucket] || bucket;
  }

  function countBy(items, keyFn) {
    const counts = new Map();
    items.forEach((item) => {
      const key = keyFn(item);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }

  function extractLatestDate(text) {
    const dates = String(text || "").match(/\d{4}-\d{2}-\d{2}/g) || [];
    return dates.sort().at(-1) || "";
  }

  function addMonths(dateText, months) {
    const date = new Date(`${dateText || "2026-06-20"}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "";
    date.setMonth(date.getMonth() + months);
    return date.toISOString().slice(0, 10);
  }

  function formatHalfYear(dateText) {
    if (!dateText) return "待判断";
    const date = new Date(`${dateText}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "待判断";
    const half = date.getMonth() < 6 ? "H1" : "H2";
    return `${date.getFullYear()}${half}`;
  }

  function forecastForProject(project) {
    const today = data.meta.current_date || "2026-06-20";
    const bucket = stageBucket(project);
    const stage = `${project?.current_stage || ""} ${project?.reported_status || ""}`;
    const anchor = extractLatestDate(stage) || project.latest_source_date || (project.milestone_dates || []).at(-1) || "";
    let months = 36;
    if (bucket === "review") months = /审评|审批/.test(stage) ? 10 : 14;
    else if (bucket === "testing") months = 30;
    else if (bucket === "clinical") {
      if (/临床完成/.test(stage)) months = 16;
      else if (/随访|入组完成|阶段完成/.test(stage)) months = 22;
      else months = 30;
    } else {
      months = 42;
    }
    const rawDate = addMonths(anchor, months);
    const stale = rawDate && rawDate < today;
    const date = stale ? addMonths(today, bucket === "review" ? 8 : bucket === "clinical" ? 18 : bucket === "testing" ? 24 : 30) : rawDate;
    const confidence = ["A0", "A1", "A2", "A3"].includes(project.highest_evidence) ? "中高" : "低";
    return {
      date,
      label: `预计 ${formatHalfYear(date)}`,
      confidence,
      basis: `${stageBucketLabel(bucket)}；按${bucket === "review" ? "受理/审评" : bucket === "clinical" ? "注册临床" : bucket === "testing" ? "注册检验" : "早期线索"}样板外推${stale ? "；历史节点已过期，按当前未获批状态重估" : ""}`,
    };
  }

  function renderMeta() {
    setText("pageTitle", data.meta.title || "注册进度");
    setText("scopeNote", "仅展示未获批或仍在新增适应证/品规推进的项目；已获批上市项目转入材料市场分析，不再占用注册进展主视图。");
    setText("updatedAt", data.meta.updated_at || "-");
  }

  function renderTabs() {
    const tabs = $("trackTabs");
    if (!tabs) return;
    const activeTracks = new Set(activeProjectsAll.map((project) => project.track));
    const tracks = [{ track: "all", track_label: "总览" }, ...(data.summary.by_track || []).filter((item) => activeTracks.has(item.track))];
    tabs.innerHTML = tracks
      .map((item) => `
        <button class="track-tab ${state.track === item.track ? "active" : ""}" type="button" data-track="${escapeHtml(item.track)}">
          ${escapeHtml(item.track_label)}
        </button>
      `)
      .join("");
    tabs.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        state.track = button.dataset.track || "all";
        state.activeTimelineKey = "";
        state.focusedProduct = "";
        render();
      });
    });
  }

  function renderKpis() {
    const projects = activeProjects();
    const buckets = countBy(projects, stageBucket);
    setText("kpiClinical", buckets.get("clinical") || 0);
    setText("kpiReview", buckets.get("review") || 0);
    setText("kpiTesting", buckets.get("testing") || 0);
    setText("kpiArchived", archivedProjects().length);
  }

  function renderSourceBars() {
    const host = $("sourceBars");
    if (!host) return;
    const counts = countBy(activeRecords(), (record) => gradeLabel(record.evidence_grade));
    const rows = [...counts.entries()];
    const max = Math.max(...rows.map(([, count]) => count), 1);
    host.innerHTML = rows.length
      ? rows
          .map(([label, count]) => `
            <div class="source-bar">
              <span>${escapeHtml(label)}</span>
              <div class="bar-track"><i class="bar-fill" style="width:${Math.max(7, (count / max) * 100)}%"></i></div>
              <b>${count}</b>
            </div>
          `)
          .join("")
      : "<p>暂无来源。</p>";
  }

  function topProjects(projects, limit = 3) {
    return [...projects]
      .sort((a, b) => (forecastForProject(a).date || "9999").localeCompare(forecastForProject(b).date || "9999"))
      .slice(0, limit);
  }

  function forecastRankRows(projects, limit = 6) {
    const bucketWeight = { review: 0, clinical: 1, testing: 2, scout: 3 };
    const evidenceWeight = (grade) => (["A0", "A1", "A2", "A3"].includes(grade) ? 0 : 1);
    return projects
      .map((project) => ({
        project,
        forecast: forecastForProject(project),
        bucket: stageBucket(project),
      }))
      .sort((a, b) => {
        const windowOrder = formatHalfYear(a.forecast.date).localeCompare(formatHalfYear(b.forecast.date));
        if (windowOrder) return windowOrder;
        const stageOrder = (bucketWeight[a.bucket] ?? 9) - (bucketWeight[b.bucket] ?? 9);
        if (stageOrder) return stageOrder;
        const evidenceOrder = evidenceWeight(a.project.highest_evidence) - evidenceWeight(b.project.highest_evidence);
        if (evidenceOrder) return evidenceOrder;
        return (a.forecast.date || "9999").localeCompare(b.forecast.date || "9999");
      })
      .slice(0, limit);
  }

  function forecastRankReason(row) {
    const project = row.project;
    const stage = `${project.current_stage || ""} ${project.reported_status || ""}`;
    if (row.bucket === "review") return "已进入受理/审评窗口，排序优先于仍在临床或型检阶段的项目。";
    if (/临床完成|随访|入组完成|阶段完成/.test(stage)) return "临床后段信号明确，等待临床总结、注册申报或技术审评衔接。";
    if (row.bucket === "clinical") return "已进入注册临床，按临床执行、随访、递交注册申请的节奏外推。";
    if (row.bucket === "testing") return "仍在注册检验或前置验证，需先完成型检/质量资料后再进入临床或受理。";
    return "仍属早期线索，预测窗口保守后移。";
  }

  function renderForecastSummary(projects) {
    const host = $("forecastSummary");
    if (!host) return;
    const rows = forecastRankRows(projects);
    setText("forecastTitle", state.track === "all" ? "未来下证顺序预测" : `${selectedTrackLabel()}下证顺序预测`);
    setText("forecastLead", state.track === "all"
      ? "按所有未获批项目汇总排序，优先看受理/审评、临床后段和高等级证据。"
      : "按该材料赛道内未获批项目排序，辅助判断下一批注册节点。");
    setText(
      "forecastMethod",
      "预测不是承诺日期：以三类医疗器械/药品注册的公开路径为基线，包括注册检验或质量研究、临床试验、注册申请受理、技术审评/发补和批准；再叠加 Botox 等已获批毒麻类样板的约 T+30-42 月节奏。已进入受理/审评者前置，临床完成或随访阶段次之，早期线索和低等级证据下调置信。已获批上市项目已从本页预测池移出。"
    );
    host.innerHTML = rows.length
      ? rows
          .map((row, index) => {
            const project = row.project;
            return `
              <article class="forecast-rank-card">
                <span class="forecast-rank">${index + 1}</span>
                <div>
                  <h3>${escapeHtml(project.product)}</h3>
                  <p>${escapeHtml(project.track_label || project.track)} · ${escapeHtml(project.company || "-")}</p>
                  <p>${escapeHtml(project.current_stage || "-")}｜${escapeHtml(forecastRankReason(row))}</p>
                  <span class="badge ${row.forecast.confidence === "中高" ? "strong" : "warn"}">${escapeHtml(row.forecast.confidence)}置信 · ${escapeHtml(gradeLabel(project.highest_evidence))}</span>
                </div>
                <span class="forecast-date">${escapeHtml(row.forecast.label)}</span>
              </article>
            `;
          })
          .join("")
      : "<p>暂无可预测项目。</p>";
  }

  function renderOverview() {
    const section = $("overviewSection");
    if (!section) return;
    const projects = activeProjects();
    const buckets = countBy(projects, stageBucket);
    const byTrack = countBy(projects, (project) => project.track_label || project.track);
    const topTracks = [...byTrack.entries()].sort((a, b) => b[1] - a[1]);
    const clinicalTracks = countBy(projects.filter((project) => stageBucket(project) === "clinical"), (project) => project.track_label || project.track);
    const clinicalTrackText = [...clinicalTracks.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => `${name} ${count}`)
      .join(" / ") || "暂无";

    setText("overviewTitle", state.track === "all" ? "注册进展总览" : `${selectedTrackLabel()}进展判断`);
    setText("overviewLead", state.track === "all"
      ? `当前活跃注册项目 ${projects.length} 个，其中注册临床中 ${buckets.get("clinical") || 0} 个，受理/审评中 ${buckets.get("review") || 0} 个。`
      : `该材料赛道仍有 ${projects.length} 个项目处于注册推进或待验证阶段。`);

    const trackHost = $("trackSummaryCards");
    if (trackHost) {
      trackHost.innerHTML = topTracks
        .map(([name, count]) => {
          const trackProjects = projects.filter((project) => (project.track_label || project.track) === name);
          const trackBuckets = countBy(trackProjects, stageBucket);
          const next = topProjects(trackProjects, 1)[0];
          return `
            <article class="track-summary-card">
              <span>${escapeHtml(name)}</span>
              <strong>${count}</strong>
              <p>临床 ${trackBuckets.get("clinical") || 0} · 受理/审评 ${trackBuckets.get("review") || 0} · 型检 ${trackBuckets.get("testing") || 0}</p>
              <em>${escapeHtml(next ? `${next.product}｜${forecastForProject(next).label}` : "暂无预测")}</em>
            </article>
          `;
        })
        .join("");
    }

    const stageHost = $("stageOverview");
    if (stageHost) {
      const stageRows = ["clinical", "review", "testing", "scout"].map((key) => [stageBucketLabel(key), buckets.get(key) || 0]);
      const max = Math.max(...stageRows.map(([, count]) => count), 1);
      stageHost.innerHTML = stageRows.map(([label, count]) => `
        <div class="source-bar">
          <span>${escapeHtml(label)}</span>
          <div class="bar-track"><i class="bar-fill" style="width:${Math.max(7, (count / max) * 100)}%"></i></div>
          <b>${count}</b>
        </div>
      `).join("");
    }

    const conclusionHost = $("analysisConclusions");
    if (conclusionHost) {
      const nearTerm = topProjects(projects, 2).map((project) => `${project.product}（${forecastForProject(project).label}）`).join("；") || "暂无明确近端项目";
      conclusionHost.innerHTML = `
        <li>注册临床密度集中在：${escapeHtml(clinicalTrackText)}。</li>
        <li>近端下证观察对象：${escapeHtml(nearTerm)}。</li>
        <li>已获批/上市项目 ${archivedProjects().length} 个已移出本页主视图，避免与市场存量混算。</li>
      `;
    }
    renderForecastSummary(projects);
  }

  function benchmarkSteps() {
    return [
      ["申请/临床登记", "Botox样板 T0", "确定适应证、中心和样本量"],
      ["入组完成", "T+3-12月", "观察样本量、中心执行速度和脱落率"],
      ["临床完成/随访", "T+12-24月", "随访周期决定注册申报节奏"],
      ["递交/受理", "T+18-30月", "进入补正、技术审评和发补风险窗口"],
      ["获批/下证", "T+30-42月", "下证后转入材料市场分析"],
    ];
  }

  function renderBenchmark() {
    const host = $("benchmarkSteps");
    if (!host) return;
    host.innerHTML = benchmarkSteps().map(([stage, timing, note]) => `
      <div class="benchmark-step">
        <span>${escapeHtml(timing)}</span>
        <strong>${escapeHtml(stage)}</strong>
        <p>${escapeHtml(note)}</p>
      </div>
    `).join("");
  }

  function timelineEvents() {
    if (state.track === "all") return [];
    const projectByKey = new Map(activeProjects().map((project) => [project.project_key, project]));
    const actualEvents = activeMilestones().map((item) => {
      const project = projectByKey.get(item.project_key);
      return {
        kind: "actual",
        key: `actual-${item.id}`,
        date: item.date || "待补时间",
        product: item.product,
        material: project?.material || "",
        company: item.company,
        stage: item.stage,
        evidence_grade: item.evidence_grade,
        forecast: project ? forecastForProject(project) : null,
      };
    });
    const predictedEvents = activeProjects().map((project) => {
      const forecast = forecastForProject(project);
      return {
        kind: "forecast",
        key: `forecast-${project.project_key}`,
        date: forecast.date || "9999-12-31",
        product: project.product,
        material: project.material,
        company: project.company,
        stage: project.current_stage,
        evidence_grade: project.highest_evidence,
        forecast,
      };
    });
    return [...actualEvents, ...predictedEvents].sort((a, b) => a.date.localeCompare(b.date));
  }

  function renderTimelineDetails(event) {
    const host = $("timelineDetails");
    if (!host) return;
    if (!event) {
      host.innerHTML = "";
      return;
    }
    const forecast = event.forecast;
    host.innerHTML = `
      <article class="timeline-detail ${event.kind === "forecast" ? "forecast-detail" : ""}">
        <span class="badge ${event.kind === "forecast" ? "warn" : gradeBadgeClass(event.evidence_grade)}">${event.kind === "forecast" ? "预测节点" : gradeLabel(event.evidence_grade)}</span>
        <h3>${escapeHtml(event.product)}</h3>
        <p><strong>材料</strong> ${escapeHtml(event.material || selectedTrackLabel())}</p>
        <p><strong>企业</strong> ${escapeHtml(event.company || "-")}</p>
        <p><strong>当前阶段</strong> ${escapeHtml(event.stage || "-")}</p>
        <p><strong>项目预测</strong> ${escapeHtml(forecast ? `${forecast.label}（${forecast.confidence}置信）` : "待判断")}</p>
        <p>${escapeHtml(forecast?.basis || "")}</p>
        <button class="source-button" type="button" data-product="${escapeHtml(event.product)}">来源</button>
      </article>
    `;
    host.querySelector(".source-button")?.addEventListener("click", () => focusSourceRows(event.product));
  }

  function renderTimeline() {
    const section = $("timelineSection");
    const host = $("timelineTrack");
    if (!section || !host) return;
    const isAll = state.track === "all";
    section.classList.toggle("section-hidden", isAll);
    if (isAll) {
      host.innerHTML = "";
      renderTimelineDetails(null);
      return;
    }
    setText("timelineTitle", `${selectedTrackLabel()}时间轴`);
    setText("timelineNote", "仅展示该材料赛道未获批项目；虚线节点为按当前阶段外推的预计下证窗口。");
    const events = timelineEvents();
    if (!events.length) {
      host.innerHTML = "";
      renderTimelineDetails(null);
      return;
    }
    if (!state.activeTimelineKey || !events.some((event) => event.key === state.activeTimelineKey)) {
      state.activeTimelineKey = events[0].key;
    }
    host.innerHTML = events.map((event) => `
      <button class="timeline-node ${event.kind === "forecast" ? "projected" : ""} ${state.activeTimelineKey === event.key ? "active" : ""}" type="button" data-key="${escapeHtml(event.key)}">
        <span class="timeline-count">${event.kind === "forecast" ? "预" : "实"}</span>
        <strong>${escapeHtml(event.kind === "forecast" ? formatHalfYear(event.date) : event.date)}</strong>
        <span>${escapeHtml(event.product || "-")}</span>
        <small>${escapeHtml(event.stage || "-")}</small>
      </button>
    `).join("");
    host.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        state.activeTimelineKey = button.dataset.key || "";
        renderTimeline();
      });
    });
    renderTimelineDetails(events.find((event) => event.key === state.activeTimelineKey));
  }

  function renderProjects() {
    const body = $("projectBody");
    if (!body) return;
    const projects = activeProjects();
    setText("projectCount", `${projects.length} 个活跃项目`);
    body.innerHTML = projects
      .map((project) => {
        const forecast = forecastForProject(project);
        return `
          <tr>
            <td>
              <strong>${escapeHtml(project.product)}</strong>
              <span class="muted-line">${escapeHtml(project.material || project.track_label)}</span>
            </td>
            <td>${escapeHtml(project.company)}</td>
            <td>
              <strong>${escapeHtml(project.current_stage)}</strong>
              <span class="muted-line">${escapeHtml(stageBucketLabel(stageBucket(project)))}</span>
            </td>
            <td>
              <strong>${escapeHtml(forecast.label)}</strong>
              <span class="muted-line">${escapeHtml(forecast.basis)}</span>
            </td>
            <td>${escapeHtml(project.reported_indication || "-")}</td>
            <td>${escapeHtml(project.next_watch || "-")}</td>
            <td>
              <button class="source-button" type="button" data-product="${escapeHtml(project.product)}">来源</button>
            </td>
          </tr>
        `;
      })
      .join("");
    body.querySelectorAll(".source-button").forEach((button) => {
      button.addEventListener("click", () => focusSourceRows(button.dataset.product || ""));
    });
  }

  function safeDomId(value) {
    return normalizeKey(value).replace(/[^a-z0-9_\-\u4e00-\u9fa5]/g, "-");
  }

  function renderRecords() {
    const body = $("recordBody");
    if (!body) return;
    const records = activeRecords();
    setText("recordCount", `${records.length} 条来源`);
    body.innerHTML = records
      .map((record) => `
        <tr id="source-${safeDomId(record.lead_id || `${record.product}-${record.source_date}`)}" data-product="${escapeHtml(normalizeKey(record.product))}">
          <td>
            <a href="${escapeHtml(record.source_url || "#")}" target="_blank" rel="noreferrer">${escapeHtml(record.source_title || "来源")}</a>
            <span class="muted-line">${escapeHtml(record.source_date || "")}</span>
          </td>
          <td>
            <strong>${escapeHtml(record.product)}</strong>
            <span class="muted-line">${escapeHtml(record.company)}</span>
          </td>
          <td>
            <span class="badge ${gradeBadgeClass(record.evidence_grade)}">${escapeHtml(gradeLabel(record.evidence_grade))}</span>
            <span class="muted-line">${escapeHtml(record.stage_label || "")}</span>
          </td>
          <td>${escapeHtml(record.reported_status || "-")}</td>
          <td>${escapeHtml(record.note || "-")}</td>
        </tr>
      `)
      .join("");
    applySourceFocus();
  }

  function focusSourceRows(product) {
    state.focusedProduct = normalizeKey(product);
    applySourceFocus();
    $("sourceList")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function applySourceFocus() {
    const rows = Array.from(document.querySelectorAll("#recordBody tr"));
    rows.forEach((row) => row.classList.remove("source-highlight"));
    if (!state.focusedProduct) {
      setText("sourceFilterNote", "");
      return;
    }
    const matches = rows.filter((row) => row.dataset.product === state.focusedProduct);
    matches.forEach((row) => row.classList.add("source-highlight"));
    setText("sourceFilterNote", matches.length ? `已定位 ${matches.length} 条相关来源` : "未找到完全匹配来源，可在清单中按项目名查找。");
  }

  function render() {
    renderTabs();
    renderKpis();
    renderOverview();
    renderBenchmark();
    renderSourceBars();
    renderTimeline();
    renderProjects();
    renderRecords();
  }

  renderMeta();
  render();
})();
