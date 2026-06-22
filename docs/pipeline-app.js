(function () {
  const data = window.PIPELINE_DASHBOARD_DATA || { meta: {}, summary: {}, projects: [], records: [], milestones: [] };
  const state = { track: "all", activeTimelineKey: "", focusedProduct: "", focusedRecordIds: [], stageFilter: "" };
  const $ = (id) => document.getElementById(id);
  const charts = {};
  const RI = window.RI || {};
  const chartPalette = RI.palette || {};

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

  function canonicalProductName(value) {
    return normalizeKey(value)
      .replace(/ecm/g, "细胞外基质")
      .replace(/脱细胞外基质/g, "细胞外基质")
      .replace(/脱细胞基质/g, "细胞外基质")
      .replace(/^注射用/, "")
      .replace(/[()（）/／、·\-_\s+＋&＆]/g, "");
  }

  function canonicalProductGroup(project) {
    const product = canonicalProductName(project?.product);
    const company = canonicalCompanyKey(project);
    if (project?.track === "caha" && /cgbio华瑭大昌/.test(company) && /(facetem|caha填充物|羟基磷灰石填充物|上市许可合作)/.test(product)) {
      return "facetem";
    }
    if (project?.track === "caha" && /merz/.test(company) && /(radiesse|瑞德喜|芮得怡|微晶瓷|羟基磷酸钙微球面部填充剂)/.test(product)) {
      return "radiesse";
    }
    if (project?.track === "caha" && /摩漾/.test(company) && /(aphranel|优法兰|羟基磷酸钙微球面部填充剂)/.test(product)) {
      return "aphranel";
    }
    if (project?.track === "caha" && /abbvieallergan/.test(company) && /harmonyca/.test(product)) {
      return "harmonyca";
    }
    if (project?.track === "caha" && /昊海生科/.test(company) && /(caha|羟基磷灰石)/.test(product)) {
      return "昊海生科caha产品";
    }
    if (project?.track === "ecm" && /白衣缘生物/.test(company) && /(sis|细胞外基质|脱细胞基质|植入剂|填充产品)/.test(product)) {
      return "白衣缘ecm植入剂";
    }
    if (project?.track === "ecm" && /圣至润合/.test(company) && /细胞外基质生物凝胶/.test(product) && !/第二款/.test(product)) {
      return "圣至润合首款ecm生物凝胶";
    }
    if (project?.track === "pdrn" && /透明质酸钠pdrn复合溶液/.test(product)) {
      return "透明质酸钠pdrn复合溶液";
    }
    return product;
  }

  function primaryCompanyKey(value) {
    return normalizeKey(String(value || "").split(/[\/／、;；]/)[0])
      .replace(/[()（）]/g, "");
  }

  function companyAliasKey(value, track) {
    const company = normalizeKey(value).replace(/[()（）]/g, "");
    if (track === "caha" && /(cgbio|华瑭|htdk)/.test(company)) return "cgbio华瑭大昌";
    if (track === "caha" && /(merz|麦施|梅尔茨)/.test(company)) return "merz";
    if (track === "caha" && /(abbvie|allergan|艾尔建)/.test(company)) return "abbvieallergan";
    if (track === "caha" && /昊海/.test(company)) return "昊海生科";
    return primaryCompanyKey(value);
  }

  function canonicalCompanyKey(project) {
    const company = normalizeKey(project?.company).replace(/[()（）]/g, "");
    const product = canonicalProductName(project?.product);
    if (project?.track === "pdrn" && /透明质酸钠pdrn复合溶液/.test(product) && /吴中|丽徕/.test(company)) {
      return "吴中美学北京丽徕";
    }
    return companyAliasKey(project?.company, project?.track);
  }

  function projectGroupKey(project) {
    return [project?.track, canonicalCompanyKey(project), canonicalProductGroup(project)].join("|");
  }

  function projectIdentity(item) {
    return [item?.track, item?.product, item?.company].map(normalizeKey).join("|");
  }

  function productIdentity(item) {
    return [item?.track, item?.product].map(normalizeKey).join("|");
  }

  function isExpansionProject(project) {
    return /新增适应症|新增适应证|扩张|扩展|新适应|品规调整|规格调整|剂型调整/.test(
      `${project?.current_stage || ""} ${project?.product || ""} ${project?.reported_status || ""}`
    );
  }

  function hasCompletedStatus(project) {
    const stage = String(project?.current_stage || "");
    const status = String(project?.reported_status || "");
    if (isExpansionProject(project)) return false;
    if (/既有证照|非医美基线/.test(stage)) return true;
    if (/^(已获批|已上市)$/.test(stage)) return true;
    if (/注册证.*获批|获得.*注册证|NMPA批准上市|批准上市|正式获批/.test(status) && !/临床|入组|随访|受理|审评|注册检验|型检/.test(stage)) {
      return true;
    }
    return false;
  }

  const completedProjectGroups = new Set(data.projects.filter(hasCompletedStatus).map(projectGroupKey));

  function isCompletedProject(project) {
    if (hasCompletedStatus(project)) return true;
    return !isExpansionProject(project) && completedProjectGroups.has(projectGroupKey(project));
  }

  function isContextProject(project) {
    const company = String(project?.company || "").trim();
    const text = `${project?.product || ""} ${project?.current_stage || ""} ${project?.stage_chain || ""}`;
    if (company === "行业总体") return true;
    if (company === "未披露" && /分类界定|监管路径|注册路径|主文档|标准研究|原料/.test(text)) return true;
    return project?.frontstage_ready === false && /行业|监管路径|注册路径|主文档|标准研究/.test(`${company} ${text}`);
  }

  function displayCompany(item) {
    const company = String(item?.company || "").trim();
    if (company === "行业总体") return "赛道背景 / 不对应单一企业";
    if (company === "未披露") return "主体未披露 / 暂不归入企业产品";
    return company || "-";
  }

  function progressRank(project) {
    const text = `${project?.current_stage || ""} ${project?.stage_chain || ""} ${project?.reported_status || ""}`;
    if (/已获批|已上市|批准上市|注册证.*获批/.test(text)) return 5;
    if (/受理|送达|审评|审批|递交|上市注册推进/.test(text)) return 4;
    if (/临床完成|入组完成|阶段完成|随访|临床后段/.test(text)) return 3;
    if (/临床|入组/.test(text)) return 2;
    if (/注册检验|型检|检验|分类界定|主文档|原料/.test(text)) return 1;
    return 0;
  }

  function evidenceRank(grade) {
    const value = Number(String(grade || "").replace(/^A/i, ""));
    return Number.isFinite(value) ? value : 99;
  }

  function latestDateOf(project) {
    return project?.latest_source_date || (project?.milestone_dates || []).slice().sort().at(-1) || "";
  }

  function mergeGradeCounts(projects) {
    return projects.reduce((counts, project) => {
      Object.entries(project.grade_counts || {}).forEach(([grade, count]) => {
        counts[grade] = (counts[grade] || 0) + Number(count || 0);
      });
      return counts;
    }, {});
  }

  function uniqueSorted(values) {
    return [...new Set(values.filter(Boolean))].sort();
  }

  function bestEvidence(projects) {
    return [...projects].sort((a, b) => evidenceRank(a.highest_evidence) - evidenceRank(b.highest_evidence))[0] || projects[0];
  }

  function longestValue(projects, field) {
    return projects
      .map((project) => project[field])
      .filter(Boolean)
      .sort((a, b) => String(b).length - String(a).length)[0] || "";
  }

  function consolidateProjectGroup(projects) {
    if (projects.length === 1) {
      return { ...projects[0], _source_project_keys: [projects[0].project_key] };
    }
    const latest = [...projects].sort((a, b) => latestDateOf(b).localeCompare(latestDateOf(a)))[0];
    const best = bestEvidence(projects);
    const progressLead = [...projects].sort((a, b) => {
      const stageOrder = progressRank(b) - progressRank(a);
      if (stageOrder) return stageOrder;
      const evidenceOrder = evidenceRank(a.highest_evidence) - evidenceRank(b.highest_evidence);
      if (evidenceOrder) return evidenceOrder;
      return latestDateOf(b).localeCompare(latestDateOf(a));
    })[0] || latest;
    const stageChain = [];
    [...projects]
      .sort((a, b) => latestDateOf(a).localeCompare(latestDateOf(b)))
      .forEach((project) => {
        String(project.stage_chain || project.current_stage || "")
          .split(/\s*→\s*/)
          .filter(Boolean)
          .forEach((stage) => {
            if (!stageChain.includes(stage)) stageChain.push(stage);
          });
      });
    const recordIds = uniqueSorted(projects.flatMap((project) => project.records || []));
    const milestoneDates = uniqueSorted(projects.flatMap((project) => project.milestone_dates || []));
    const sourceLanes = uniqueSorted(projects.flatMap((project) => project.source_lanes || []));
    return {
      ...latest,
      project_key: best.project_key,
      product: best.product || longestValue(projects, "product") || latest.product,
      company: longestValue(projects, "company") || latest.company,
      current_stage: progressLead.current_stage || latest.current_stage,
      stage_chain: stageChain.join(" → "),
      highest_evidence: best.highest_evidence,
      highest_evidence_label: best.highest_evidence_label,
      evidence_count: recordIds.length || projects.reduce((sum, project) => sum + Number(project.evidence_count || 0), 0),
      public_evidence_count: projects.reduce((sum, project) => sum + Number(project.public_evidence_count || 0), 0),
      verified_source_count: projects.reduce((sum, project) => sum + Number(project.verified_source_count || 0), 0),
      conflict_count: projects.reduce((sum, project) => sum + Number(project.conflict_count || 0), 0),
      hidden_lead_count: projects.reduce((sum, project) => sum + Number(project.hidden_lead_count || 0), 0),
      source_lanes: sourceLanes,
      grade_counts: mergeGradeCounts(projects),
      latest_source_date: latestDateOf(latest),
      milestone_dates: milestoneDates,
      reported_status: progressLead.reported_status || latest.reported_status,
      reported_indication: progressLead.reported_indication || latest.reported_indication,
      reported_center_or_pi: progressLead.reported_center_or_pi || latest.reported_center_or_pi,
      next_watch: progressLead.next_watch || latest.next_watch,
      records: recordIds,
      _source_project_keys: projects.map((project) => project.project_key).filter(Boolean),
      _merged_count: projects.length,
    };
  }

  function consolidateProjects(projects) {
    const groups = new Map();
    projects.forEach((project) => {
      const key = projectGroupKey(project);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(project);
    });
    return [...groups.values()].map(consolidateProjectGroup);
  }

  const contextProjectsAll = data.projects.filter((project) => !isCompletedProject(project) && isContextProject(project));
  const activeProjectsAll = consolidateProjects(data.projects.filter((project) => !isCompletedProject(project) && !isContextProject(project)));
  const archivedProjectsAll = data.projects.filter(isCompletedProject);
  const activeProjectKeys = new Set(activeProjectsAll.flatMap((project) => project._source_project_keys || [project.project_key]).filter(Boolean));
  const activeProjectIdentities = new Set(activeProjectsAll.map(projectIdentity));
  const activeProjectProducts = new Set(activeProjectsAll.map(productIdentity));
  const activeRecordIds = new Set(activeProjectsAll.flatMap((project) => project.records || []));
  const contextRecordIds = new Set(contextProjectsAll.flatMap((project) => project.records || []));

  function selectedTrackLabel() {
    if (state.track === "all") return "全部材料";
    if (state.track === "pdrn_pn") return "PDRN/PN";
    const track = (data.summary.by_track || []).find((item) => trackGroup(item.track) === state.track);
    return track?.track_label || state.track;
  }

  function trackGroupLabel(group) {
    if (group === "all") return "总览";
    if (group === "pdrn_pn") return "PDRN/PN";
    const track = (data.summary.by_track || []).find((item) => trackGroup(item.track) === group);
    return track?.track_label || group;
  }

  function trackGroup(track) {
    return ["pdrn", "pn"].includes(track) ? "pdrn_pn" : track;
  }

  function inSelectedTrack(item) {
    return state.track === "all" || trackGroup(item?.track) === state.track;
  }

  function activeProjects() {
    return activeProjectsAll.filter(inSelectedTrack);
  }

  function visibleProjects() {
    const projects = activeProjects();
    return state.stageFilter ? projects.filter((project) => stageBucket(project) === state.stageFilter) : projects;
  }

  function selectTrack(track) {
    state.track = track || "all";
    state.activeTimelineKey = "";
    state.focusedProduct = "";
    state.focusedRecordIds = [];
    state.stageFilter = "";
    render();
  }

  function selectStageFilter(bucket) {
    state.stageFilter = state.stageFilter === bucket ? "" : bucket;
    renderProjects();
    renderKpis();
    $("projectTableSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function archivedProjects() {
    return archivedProjectsAll.filter(inSelectedTrack);
  }

  function contextProjects() {
    return contextProjectsAll
      .filter(inSelectedTrack)
      .sort((a, b) => latestDateOf(b).localeCompare(latestDateOf(a)));
  }

  function activeRecords() {
    return data.records.filter((record) => {
      if (record.frontstage_use === "hidden") return false;
      if (!inSelectedTrack(record)) return false;
      if (activeRecordIds.has(record.lead_id)) return true;
      if (contextRecordIds.has(record.lead_id)) return true;
      return activeProjectIdentities.has(projectIdentity(record)) || activeProjectProducts.has(productIdentity(record));
    });
  }

  function activeMilestones() {
    return data.milestones.filter((item) => {
      if (!inSelectedTrack(item)) return false;
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
    if (project?.forecast_label_override) {
      return {
        date: project.forecast_date_override || "",
        label: project.forecast_label_override,
        confidence: project.forecast_confidence || "低",
        basis: project.forecast_basis_override || "公司口径；待官方信息核验",
      };
    }
    const today = data.meta.current_date || "2026-06-20";
    const bucket = stageBucket(project);
    const stage = `${project?.current_stage || ""} ${project?.reported_status || ""}`;
    const anchor = extractLatestDate(stage) || project.latest_source_date || (project.milestone_dates || []).at(-1) || "";
    const isDrug = project?.track === "botulinum";
    let months = isDrug ? 38 : 34;
    if (bucket === "review") months = isDrug ? 14 : 12;
    else if (bucket === "testing") months = isDrug ? 30 : 28;
    else if (bucket === "clinical") {
      if (/临床完成/.test(stage)) months = isDrug ? 18 : 16;
      else if (/随访|入组完成|阶段完成/.test(stage)) months = isDrug ? 24 : 22;
      else months = isDrug ? 34 : 30;
    } else {
      months = isDrug ? 44 : 42;
    }
    const rawDate = addMonths(anchor, months);
    const stale = rawDate && rawDate < today;
    const date = stale ? addMonths(today, bucket === "review" ? 8 : bucket === "clinical" ? 18 : bucket === "testing" ? 24 : 30) : rawDate;
    const confidence = ["A0", "A1", "A2", "A3"].includes(project.highest_evidence) ? "中高" : "低";
    const model = isDrug ? "药品样板" : "三类器械样板";
    return {
      date,
      label: `预计 ${formatHalfYear(date)}`,
      confidence,
      basis: `${stageBucketLabel(bucket)}；参考${model}和官方审评时间${stale ? "；按最新状态重新估算" : ""}`,
    };
  }

  function renderMeta() {
    setText("pageTitle", data.meta.title || "注册进度");
    setText("updatedAt", data.meta.updated_at || "-");
  }

  function renderTabs() {
    const tabs = $("trackTabs");
    if (!tabs) return;
    const activeTracks = new Set([...activeProjectsAll, ...contextProjectsAll].map((project) => trackGroup(project.track)));
    const seen = new Set();
    const materialTabs = (data.summary.by_track || []).reduce((items, item) => {
      const group = trackGroup(item.track);
      if (!activeTracks.has(group) || seen.has(group)) return items;
      seen.add(group);
      items.push({
        track: group,
        track_label: group === "pdrn_pn" ? "PDRN/PN" : item.track_label,
      });
      return items;
    }, []);
    const tracks = [{ track: "all", track_label: "总览" }, ...materialTabs];
    tabs.innerHTML = tracks
      .map((item) => `
        <button class="track-tab ${state.track === item.track ? "active" : ""}" type="button" data-track="${escapeHtml(item.track)}">
          ${escapeHtml(item.track_label)}
        </button>
      `)
      .join("");
    tabs.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => selectTrack(button.dataset.track || "all"));
    });
  }

  function renderKpis() {
    const projects = activeProjects();
    const buckets = countBy(projects, stageBucket);
    setText("kpiClinical", buckets.get("clinical") || 0);
    setText("kpiReview", buckets.get("review") || 0);
    setText("kpiTesting", buckets.get("testing") || 0);
    setText("kpiScout", buckets.get("scout") || 0);
    document.querySelectorAll("[data-stage-filter]").forEach((card) => {
      const bucket = card.dataset.stageFilter || "";
      const count = buckets.get(bucket) || 0;
      card.classList.toggle("active", state.stageFilter === bucket);
      card.disabled = count === 0;
      card.setAttribute("aria-pressed", String(state.stageFilter === bucket));
    });
  }

  function bindMetricCards() {
    document.querySelectorAll("[data-stage-filter]").forEach((card) => {
      card.addEventListener("click", () => selectStageFilter(card.dataset.stageFilter || ""));
    });
  }

  function renderSourceBars() {
    const host = $("sourceBars");
    if (!host) return;
    const counts = countBy(activeRecords(), (record) => gradeLabel(record.evidence_grade));
    const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    host.innerHTML = rows.length
      ? rows
          .map(([label, count]) => `<div class="source-line"><span>${escapeHtml(label)}</span><b>${count}</b></div>`)
          .join("")
      : "<p class='muted' style='font-size:12.5px'>暂无来源。</p>";
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
    const model = project.track === "botulinum" ? "药品样板" : "三类器械样板";
    if (row.bucket === "review") return `已进入受理或审评，排位靠前。`;
    if (/临床完成|随访|入组完成|阶段完成/.test(stage)) return `临床进度较明确，重点看后续申报。`;
    if (row.bucket === "clinical") return `已进入注册临床，继续观察入组、随访和申报节奏。`;
    if (row.bucket === "testing") return `仍在检验或前置验证，需要等待下一步进展。`;
    return "仍属早期线索，时间判断更保守。";
  }

  function renderForecastSummary(projects) {
    const host = $("forecastSummary");
    if (!host) return;
    const rows = forecastRankRows(projects);
    const panel = document.querySelector(".forecast-panel");
    if (panel) {
      panel.classList.toggle("compact", state.track !== "all" && rows.length > 0);
    }
    setText("forecastTitle", state.track === "all" ? "未来下证顺序预测" : `${selectedTrackLabel()}下证顺序预测`);
    setText("forecastLead", state.track === "all"
      ? "汇总所有在推进项目，观察可能的获批顺序。"
      : "观察该材料赛道内可能的获批顺序。");
    setText(
      "forecastMethod",
      "预测仅作顺序参考，实际获批时间以官方信息为准。"
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
                  <p>${escapeHtml(project.track_label || project.track)} · ${escapeHtml(displayCompany(project))}</p>
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
    const byTrack = countBy(projects, (project) => trackGroup(project.track));
    const topTracks = [...byTrack.entries()].sort((a, b) => b[1] - a[1]);

    setText("overviewTitle", state.track === "all" ? "注册进展总览" : `${selectedTrackLabel()}进展判断`);
    setText("overviewLead", state.track === "all"
      ? `当前有 ${projects.length} 个项目仍在推进，其中注册临床中 ${buckets.get("clinical") || 0} 个，受理/审评中 ${buckets.get("review") || 0} 个。`
      : `该材料赛道仍有 ${projects.length} 个项目在推进。`);

    const trackHost = $("trackSummaryCards");
    if (trackHost) {
      trackHost.innerHTML = topTracks
        .map(([name, count]) => {
          const trackProjects = projects.filter((project) => trackGroup(project.track) === name);
          const trackBuckets = countBy(trackProjects, stageBucket);
          const label = trackGroupLabel(name);
          return `
            <button class="track-summary-card ${state.track === name ? "active" : ""}" type="button" data-summary-track="${escapeHtml(name)}" aria-label="查看${escapeHtml(label)}注册进展">
              <span>${escapeHtml(label)}</span>
              <strong>${count}</strong>
              <p>临床 ${trackBuckets.get("clinical") || 0} · 受理/审评 ${trackBuckets.get("review") || 0} · 型检 ${trackBuckets.get("testing") || 0}</p>
            </button>
          `;
        })
        .join("");
      trackHost.querySelectorAll("[data-summary-track]").forEach((card) => {
        card.addEventListener("click", () => selectTrack(card.dataset.summaryTrack || "all"));
      });
    }

    renderForecastSummary(projects);
  }

  function forecastBasisCards() {
    return [
      {
        type: "毒麻类药品",
        title: "芮妥欣 / 重组A型肉毒毒素",
        body: "药品路径受临床、生产体系和药审节奏共同影响，周期通常较长。芮妥欣于2026-03-25获批，批准文号国药准字S20260019。",
        link: "https://epaper.stcn.com/pic/202603/28/018874c2df02934d52986c38465aaf9d.pdf",
        linkText: "上市公司公告",
        rangeLabel: "36-60个月",
        minMonths: 36,
        maxMonths: 60,
        rangeNote: "从关键临床到获批的保守长周期参照。",
      },
      {
        type: "首证类器械",
        title: "优法兰 Aphranel / CaHA",
        body: "国内首张CaHA面部填充注册证，2025-02-17获批，证号国械注准20253130390。无同类材料先例时，通常需要留出更宽的审评和补充资料空间。",
        link: "https://www.cmde.org.cn/directory/web/cmde/images/1740709639133081872.pdf",
        linkText: "CMDE审评报告",
        rangeLabel: "30-54个月",
        minMonths: 30,
        maxMonths: 54,
        rangeNote: "适合参考国内尚无先例的新材料赛道。",
      },
      {
        type: "跟进型材料",
        title: "Ellansé-M / 伊妍仕恒耀",
        body: "同类PCL材料已有上市先例后，后续型号或适应证可参考更成熟的行业路径。2023-05完成中国临床全部入组，2025-01获注册受理，2026-04-23获批。",
        link: "https://www.nmpa.gov.cn/zwfw/sdxx/sdxxylqx/qxpjfb/20260423153223162.html",
        linkText: "NMPA送达信息",
        rangeLabel: "18-36个月",
        minMonths: 18,
        maxMonths: 36,
        rangeNote: "适合参考已有首款产品后的跟进型材料。",
      },
    ];
  }

  function renderForecastBasis() {
    const host = $("forecastBasisCards");
    if (!host) return;
    const cards = forecastBasisCards();
    host.innerHTML = cards.map((card) => `
      <article class="basis-card">
        <span>${escapeHtml(card.type)}</span>
        <strong>${escapeHtml(card.title)}</strong>
        <p>${escapeHtml(card.body)}</p>
        <a href="${escapeHtml(card.link)}" target="_blank" rel="noreferrer">${escapeHtml(card.linkText)}</a>
      </article>
    `).join("");
  }

  function cycleStages() {
    // Full registration journey, marking which steps carry an official statutory
    // limit and which are product-specific / variable. Sources: NMPA 器械首次注册办事
    // 指南 + CMDE; clinical & testing durations are not statutory.
    return [
      { stage: "注册临床试验", kind: "可变", duration: "约 1–3 年", note: "时长随产品、适应证与入组随访进度而定，非法定时限。" },
      { stage: "注册检验 / 型检", kind: "可变", duration: "数月（含排队）", note: "送检与排队时间不固定，非法定时限。" },
      { stage: "受理 → 技术审评", kind: "法定", duration: "约 60 工作日", note: "CMDE 技术审评法定时限；2024 年三类首次注册实际平均约 99 个工作日。发补会暂停时钟，企业最长可用 1 年补正。" },
      { stage: "质量体系核查", kind: "法定", duration: "30 工作日", note: "注册质量管理体系现场核查。" },
      { stage: "行政审批 + 制证", kind: "法定", duration: "20 工作日", note: "受理部门据审评结论作出决定并制证。" },
    ];
  }

  function troubledCases() {
    return [
      {
        name: "Ultherapy 超声刀 / Merz",
        track: "EBD · 聚焦超声",
        status: "至今未获 NMPA 注册",
        body: "长期未取得大陆三类注册，目前仅依托海南博鳌乐城先行区特许政策使用；属典型停滞案例，提示高风险设备类审评的不确定性。",
        link: "https://zhuanlan.zhihu.com/p/572691113",
        linkText: "Merz 中国背景",
      },
      {
        name: "Radiesse 瑞德喜 / Merz",
        track: "CaHA",
        status: "国际 2006 → 中国 2025 获批",
        body: "全球 2006 年获 FDA，中国直到 2023 年才启动注册临床、2025-03 获批（国械注进20253130124），落地节奏明显滞后于国际。",
        link: "https://bydrug.pharmcube.com/news/detail/641ea03ddf9bd3bd5f27072aaf2a3aef",
        linkText: "CMDE 审评报告",
      },
    ];
  }

  function renderBenchmark() {
    renderForecastBasis();
    renderTroubledCases();
    const host = $("benchmarkSteps");
    if (host) {
      host.innerHTML = `
        <p class="cycle-summary">受理后法定环节合计约 <b>5–6 个月</b>（理论），实务常 <b>8–12 个月</b>、复杂品种逾一年；临床试验与注册检验本身没有官方法定时间表，所以上方的预测以“关键临床 → 受理 → 获批”的实测案例为锚点。</p>
        <div class="cycle-stages">
          ${cycleStages().map((s) => `
            <div class="cycle-stage">
              <div class="cycle-stage-head">
                <strong>${escapeHtml(s.stage)}</strong>
                <span class="stage-tag ${s.kind === "法定" ? "legal" : "variable"}">${escapeHtml(s.kind)}</span>
              </div>
              <b class="cycle-stage-dur">${escapeHtml(s.duration)}</b>
              <p>${escapeHtml(s.note)}</p>
            </div>
          `).join("")}
        </div>
      `;
    }
  }

  function renderTroubledCases() {
    const host = $("troubledCases");
    if (!host) return;
    host.innerHTML = troubledCases().map((c) => `
      <article class="troubled-card">
        <div class="troubled-head">
          <strong>${escapeHtml(c.name)}</strong>
          <span class="badge warn">${escapeHtml(c.status)}</span>
        </div>
        <span class="muted-line">${escapeHtml(c.track)}</span>
        <p>${escapeHtml(c.body)}</p>
        <a href="${escapeHtml(c.link)}" target="_blank" rel="noreferrer">${escapeHtml(c.linkText)}</a>
      </article>
    `).join("");
  }

  function timelineEvents() {
    if (state.track === "all") return [];
    const projectByKey = new Map();
    activeProjects().forEach((project) => {
      (project._source_project_keys || [project.project_key]).forEach((key) => projectByKey.set(key, project));
    });
    const actualGroups = new Map();
    activeMilestones().forEach((item) => {
      const project = projectByKey.get(item.project_key);
      const key = project?.project_key || item.project_key;
      if (!actualGroups.has(key)) actualGroups.set(key, { project, items: [] });
      actualGroups.get(key).items.push(item);
    });
    const actualEvents = [...actualGroups.entries()].map(([key, group]) => {
      const project = group.project;
      const latestItem = [...group.items].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))[0] || group.items[0];
      const bestItem = [...group.items].sort((a, b) => evidenceRank(a.evidence_grade) - evidenceRank(b.evidence_grade))[0] || latestItem;
      return {
        kind: "actual",
        key: `actual-${key}`,
        project_key: key,
        record_ids: project?.records || [],
        date: latestItem.date || "待补时间",
        product: project?.product || latestItem.product,
        material: project?.material || "",
        company: project?.company || latestItem.company,
        stage: project?.current_stage || latestItem.stage,
        evidence_grade: project?.highest_evidence || bestItem.evidence_grade,
        forecast: project ? forecastForProject(project) : null,
      };
    });
    const predictedEvents = activeProjects().map((project) => {
      const forecast = forecastForProject(project);
      return {
        kind: "forecast",
        key: `forecast-${project.project_key}`,
        project_key: project.project_key,
        record_ids: project.records || [],
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
        <p><strong>企业</strong> ${escapeHtml(displayCompany(event))}</p>
        <p><strong>当前阶段</strong> ${escapeHtml(event.stage || "-")}</p>
        <p><strong>项目预测</strong> ${escapeHtml(forecast ? `${forecast.label}（${forecast.confidence}置信）` : "待判断")}</p>
        <p>${escapeHtml(forecast?.basis || "")}</p>
        <button class="source-button" type="button" data-product="${escapeHtml(event.product)}" data-records="${escapeHtml((event.record_ids || []).join("|"))}">来源</button>
      </article>
    `;
    host.querySelector(".source-button")?.addEventListener("click", () => focusSourceRows(event.product, event.record_ids || []));
  }

  function renderTimeline() {
    const section = $("timelineSection");
    const sourceSection = $("sourceQualitySection");
    const host = $("timelineTrack");
    if (!section || !host) return;
    const isAll = state.track === "all";
    section.classList.toggle("section-hidden", isAll);
    if (sourceSection) sourceSection.classList.toggle("section-hidden", isAll);
    if (isAll) {
      host.innerHTML = "";
      renderTimelineDetails(null);
      return;
    }
    setText("timelineTitle", `${selectedTrackLabel()}时间轴`);
    setText("timelineNote", "虚线节点为预计下证窗口。");
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
    const projects = visibleProjects();
    setText("projectCount", state.stageFilter
      ? `${stageBucketLabel(state.stageFilter)} ${projects.length} 个项目`
      : `${projects.length} 个项目`);
    setText("projectFilterNote", state.stageFilter ? `已筛选：${stageBucketLabel(state.stageFilter)}` : "");
    body.innerHTML = projects
      .map((project) => {
        const forecast = forecastForProject(project);
        return `
          <tr>
            <td>
              <strong>${escapeHtml(project.product)}</strong>
              <span class="muted-line">${escapeHtml(project.material || project.track_label)}</span>
            </td>
            <td>${escapeHtml(displayCompany(project))}</td>
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
              <button class="source-button" type="button" data-product="${escapeHtml(project.product)}" data-records="${escapeHtml((project.records || []).join("|"))}">来源</button>
            </td>
          </tr>
        `;
      })
      .join("") || `
        <tr>
          <td colspan="7">当前筛选下暂无项目。</td>
        </tr>
      `;
    body.querySelectorAll(".source-button").forEach((button) => {
      button.addEventListener("click", () => focusSourceRows(button.dataset.product || "", (button.dataset.records || "").split("|").filter(Boolean)));
    });
  }

  function safeDomId(value) {
    return normalizeKey(value).replace(/[^a-z0-9_\-\u4e00-\u9fa5]/g, "-");
  }

  function renderContext() {
    const section = $("contextSection");
    const host = $("contextList");
    if (!section || !host) return;
    const items = contextProjects();
    section.classList.toggle("section-hidden", !items.length);
    setText("contextCount", `${items.length} 条背景`);
    host.innerHTML = items
      .map((project) => `
        <article class="context-card">
          <div>
            <span class="badge warn">${escapeHtml(displayCompany(project))}</span>
            <strong>${escapeHtml(project.product)}</strong>
            <p>${escapeHtml(project.reported_status || "-")}</p>
            <span class="muted-line">${escapeHtml(project.current_stage || "-")} · ${escapeHtml(project.latest_source_date || "待补日期")}</span>
          </div>
          <button class="source-button" type="button" data-product="${escapeHtml(project.product)}" data-records="${escapeHtml((project.records || []).join("|"))}">来源</button>
        </article>
      `)
      .join("");
    host.querySelectorAll(".source-button").forEach((button) => {
      button.addEventListener("click", () => focusSourceRows(button.dataset.product || "", (button.dataset.records || "").split("|").filter(Boolean)));
    });
  }

  function renderRecords() {
    const body = $("recordBody");
    if (!body) return;
    const records = activeRecords();
    setText("recordCount", `${records.length} 条来源`);
    body.innerHTML = records
      .map((record) => `
        <tr id="source-${safeDomId(record.lead_id || `${record.product}-${record.source_date}`)}" data-product="${escapeHtml(normalizeKey(record.product))}" data-lead-id="${escapeHtml(record.lead_id || "")}">
          <td>
            <a href="${escapeHtml(record.source_url || "#")}" target="_blank" rel="noreferrer">${escapeHtml(record.source_title || "来源")}</a>
            <span class="muted-line">${escapeHtml(record.source_date || "")}</span>
          </td>
          <td>
            <strong>${escapeHtml(record.product)}</strong>
            <span class="muted-line">${escapeHtml(displayCompany(record))}</span>
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

  function focusSourceRows(product, recordIds = []) {
    state.focusedProduct = normalizeKey(product);
    state.focusedRecordIds = recordIds;
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
    const focusedIds = new Set(state.focusedRecordIds || []);
    const matches = rows.filter((row) => row.dataset.product === state.focusedProduct || focusedIds.has(row.dataset.leadId || ""));
    matches.forEach((row) => row.classList.add("source-highlight"));
    setText("sourceFilterNote", matches.length ? `找到 ${matches.length} 条来源` : "未找到匹配来源。");
  }

  const STAGE_BUCKETS = [
    ["clinical", "注册临床中"],
    ["review", "受理/审评"],
    ["testing", "注册检验/型检"],
    ["scout", "早期线索"],
  ];

  function getChart(id) {
    const el = $(id);
    if (!el || typeof echarts === "undefined") return null;
    if (!charts[id]) charts[id] = echarts.init(el, "registration", { renderer: "canvas" });
    return charts[id];
  }

  const TOOLTIP_CSS = "max-width:340px; padding:11px 14px; border-radius:12px; box-shadow:0 12px 32px rgba(120,104,104,0.12);";

  function tooltipProductList(items, limit = 10) {
    if (!items.length) return "";
    const lines = items
      .slice(0, limit)
      .map((it) => `<div style="font-size:12px;line-height:1.55;color:#786868;white-space:normal">· ${escapeHtml(displayCompany(it))} · ${escapeHtml(it.product)}</div>`)
      .join("");
    const more = items.length > limit
      ? `<div style="font-size:11.5px;color:#9d7b7b;margin-top:4px">…另 ${items.length - limit} 个</div>`
      : "";
    return lines + more;
  }

  function trackGroupsAll() {
    const groups = new Map();
    activeProjectsAll.forEach((project) => {
      const group = trackGroup(project.track);
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(project);
    });
    return [...groups.entries()]
      .map(([group, items]) => ({ group, label: trackGroupLabel(group), items, total: items.length }))
      .sort((a, b) => a.total - b.total);
  }

  function renderTrackStageChart() {
    const chart = getChart("chartTrackStage");
    if (!chart) return;
    const rows = trackGroupsAll();
    const yLabels = rows.map((row) => row.label);
    const data = [];
    const cellProjects = {};
    let maxV = 1;
    rows.forEach((row, yi) => {
      STAGE_BUCKETS.forEach(([key], xi) => {
        const items = row.items.filter((project) => stageBucket(project) === key);
        cellProjects[`${xi}_${yi}`] = items;
        if (items.length > maxV) maxV = items.length;
        data.push([xi, yi, items.length]);
      });
    });
    chart.setOption({
      grid: { left: 8, right: 16, top: 8, bottom: 26, containLabel: true },
      tooltip: {
        position: "top",
        extraCssText: TOOLTIP_CSS,
        formatter: (p) => {
          const items = cellProjects[`${p.value[0]}_${p.value[1]}`] || [];
          const head = `<div style="font-weight:600;color:#786868${items.length ? ";margin-bottom:6px" : ""}">${escapeHtml(yLabels[p.value[1]])} · ${STAGE_BUCKETS[p.value[0]][1]} · ${items.length} 个</div>`;
          return items.length ? head + tooltipProductList(items) : head;
        },
      },
      xAxis: { type: "category", data: STAGE_BUCKETS.map((b) => b[1]), splitArea: { show: false }, axisLabel: { fontSize: 11.5, interval: 0 } },
      yAxis: { type: "category", data: yLabels, splitArea: { show: false } },
      visualMap: { min: 0, max: maxV, show: false, inRange: { color: ["#e7ece6", "#90a090"] } },
      series: [{
        type: "heatmap",
        data,
        label: { show: true, color: "#786868", fontSize: 12, fontWeight: 600, formatter: (p) => (p.value[2] ? p.value[2] : "") },
        itemStyle: { borderColor: "rgba(255,255,255,0.72)", borderWidth: 3, borderRadius: 6 },
        emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "rgba(120,104,104,0.22)" } },
      }],
    }, true);
  }

  function renderEvidenceChart() {
    const chart = getChart("chartEvidence");
    if (!chart) return;
    const rows = trackGroupsAll();
    const yLabels = rows.map((row) => row.label);
    const strong = rows.map((row) => row.items.filter((p) => ["A0", "A1", "A2", "A3"].includes(p.highest_evidence)).length);
    const watch = rows.map((row, i) => row.total - strong[i]);
    chart.setOption({
      grid: { left: 8, right: 22, top: 34, bottom: 6, containLabel: true },
      legend: { top: 2, data: ["强证据 A0–A3", "待核验 A4–A6"] },
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      xAxis: { type: "value", minInterval: 1 },
      yAxis: { type: "category", data: yLabels },
      series: [
        { name: "强证据 A0–A3", type: "bar", stack: "g", data: strong, color: "#8898a0", barWidth: "58%", itemStyle: { borderRadius: [4, 0, 0, 4] } },
        { name: "待核验 A4–A6", type: "bar", stack: "g", data: watch, color: "#c09090", itemStyle: { borderRadius: [0, 4, 4, 0] } },
      ],
    }, true);
  }

  function renderForecastTimeline() {
    const host = $("forecastTimeline");
    if (!host) return;
    const projects = activeProjects();
    const byWindow = new Map();
    projects.forEach((project) => {
      const window = formatHalfYear(forecastForProject(project).date);
      if (!byWindow.has(window)) byWindow.set(window, []);
      byWindow.get(window).push(project);
    });
    const windows = [...byWindow.keys()].sort((a, b) => {
      if (a === "待判断") return 1;
      if (b === "待判断") return -1;
      return a.localeCompare(b);
    });
    setText("forecastWindowSub", state.track === "all" ? "全部在研项目" : selectedTrackLabel());
    if (!windows.length) {
      host.innerHTML = "<p class='muted' style='font-size:12.5px'>暂无可预测项目。</p>";
      return;
    }
    const max = Math.max(...windows.map((w) => byWindow.get(w).length), 1);
    host.innerHTML = `<div class="forecast-tl-track">${windows.map((w) => {
      const n = byWindow.get(w).length;
      const size = Math.round(40 + (n / max) * 16); // 40–56px by count
      const pending = w === "待判断" ? " pending" : "";
      return `<button class="ftl-node" type="button" data-win="${escapeHtml(w)}" aria-label="${escapeHtml(w)} 预计下证 ${n} 个">
        <div class="ftl-dot-wrap"><span class="ftl-dot${pending}" style="width:${size}px;height:${size}px">${n}</span></div>
        <span class="ftl-win">${escapeHtml(w)}</span>
      </button>`;
    }).join("")}</div><div class="ftl-detail" id="forecastDetail"></div>`;

    const detail = $("forecastDetail");
    const showDetail = (w) => {
      const items = byWindow.get(w) || [];
      host.querySelectorAll(".ftl-node").forEach((node) => node.classList.toggle("active", node.dataset.win === w));
      detail.innerHTML = `<div class="ftl-detail-head"><strong>${escapeHtml(w)}</strong><span>预计下证 ${items.length} 个</span></div>`
        + `<div class="ftl-detail-list">${items.map((it) => `
            <div class="ftl-detail-item">
              <strong>${escapeHtml(displayCompany(it))}</strong>
              <span>${escapeHtml(it.product)}</span>
              <em>${escapeHtml(it.current_stage || "")}${it.track_label ? ` · ${escapeHtml(it.track_label)}` : ""}</em>
            </div>`).join("")}</div>`;
      detail.classList.add("open");
    };
    host.querySelectorAll(".ftl-node").forEach((node) => node.addEventListener("click", () => showDetail(node.dataset.win)));
    showDetail(windows[0]);
  }

  function render() {
    renderTabs();
    // The track x stage heatmap, evidence-strength bar and the overview summary
    // card are all-material overviews; on a single-track view the four KPI cards
    // and the forecast panel already cover the same ground, so hide them.
    const isAll = state.track === "all";
    $("trackStageCard")?.classList.toggle("section-hidden", !isAll);
    $("evidenceCard")?.classList.toggle("section-hidden", !isAll);
    $("overviewCard")?.classList.toggle("section-hidden", !isAll);
    // Full-cycle/benchmark and troubled-case sections are general reference;
    // keep them on the overview only, hide on single-track views.
    $("cycleSectionHead")?.classList.toggle("section-hidden", !isAll);
    $("cycleCard")?.classList.toggle("section-hidden", !isAll);
    $("troubledSectionHead")?.classList.toggle("section-hidden", !isAll);
    $("troubledSection")?.classList.toggle("section-hidden", !isAll);
    // On a single track the forecast-window chart shares its row with the
    // compact 来源质量 panel, so narrow it to span-8 (span-12 on the overview).
    const fwCard = $("forecastWindowCard");
    if (fwCard) {
      fwCard.classList.toggle("span-12", isAll);
      fwCard.classList.toggle("span-8", !isAll);
    }
    if (isAll) {
      renderTrackStageChart();
      renderEvidenceChart();
      charts.chartTrackStage && charts.chartTrackStage.resize();
      charts.chartEvidence && charts.chartEvidence.resize();
    }
    renderForecastTimeline();
    renderKpis();
    renderOverview();
    renderBenchmark();
    renderSourceBars();
    renderTimeline();
    renderProjects();
    renderContext();
    renderRecords();
  }

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      Object.values(charts).forEach((chart) => chart && chart.resize());
    }, 160);
  });

  renderMeta();
  bindMetricCards();
  render();
})();
