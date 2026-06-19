(function () {
  const data = window.PIPELINE_DASHBOARD_DATA || { meta: {}, summary: {}, projects: [], records: [], milestones: [] };
  const state = { track: "all", activeTimelineKey: "" };
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

  function visibleProjects() {
    return data.projects.filter((project) => state.track === "all" || project.track === state.track);
  }

  function visibleRecords() {
    return data.records.filter((record) => record.frontstage_use !== "hidden" && (state.track === "all" || record.track === state.track));
  }

  function visibleMilestones() {
    return data.milestones.filter((item) => state.track === "all" || item.track === state.track);
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

  function renderMeta() {
    setText("pageTitle", data.meta.title || "新材料注册进度");
    setText("scopeNote", data.meta.scope_note || "");
    setText("updatedAt", data.meta.updated_at || "-");
  }

  function renderTabs() {
    const tabs = $("trackTabs");
    if (!tabs) return;
    const tracks = [{ track: "all", track_label: "全部" }, ...(data.summary.by_track || [])];
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
        render();
      });
    });
  }

  function renderKpis() {
    const projects = visibleProjects();
    const records = visibleRecords();
    setText("kpiProjects", projects.length);
    setText("kpiReady", projects.filter((item) => item.frontstage_ready).length);
    setText("kpiRecords", records.length);
    setText("kpiHidden", data.records.filter((record) => record.frontstage_use === "hidden" && (state.track === "all" || record.track === state.track)).length);
  }

  function renderSourceBars() {
    const host = $("sourceBars");
    if (!host) return;
    const counts = {};
    visibleRecords().forEach((record) => {
      const label = gradeLabel(record.evidence_grade);
      counts[label] = (counts[label] || 0) + 1;
    });
    const rows = Object.entries(counts);
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

  function timelineGroups() {
    const groups = new Map();
    visibleMilestones().forEach((item) => {
      const key = item.date || "待补时间";
      if (!groups.has(key)) groups.set(key, { key, date: key, items: [] });
      groups.get(key).items.push(item);
    });
    return [...groups.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  function renderTimelineDetails(group) {
    const host = $("timelineDetails");
    if (!host) return;
    if (!group) {
      host.innerHTML = "";
      return;
    }
    host.innerHTML = group.items
      .map((item) => `
        <article class="timeline-detail">
          <span class="badge ${gradeBadgeClass(item.evidence_grade)}">${escapeHtml(gradeLabel(item.evidence_grade))}</span>
          <h3>${escapeHtml(item.product)}</h3>
          <p><strong>企业</strong> ${escapeHtml(item.company || "-")}</p>
          <p><strong>阶段</strong> ${escapeHtml(item.stage || "-")}</p>
          <p>${escapeHtml(item.status || "")}</p>
          ${item.source_url ? `<a href="${escapeHtml(item.source_url)}" target="_blank" rel="noreferrer">${escapeHtml(item.source_title || "查看来源")}</a>` : ""}
        </article>
      `)
      .join("");
  }

  function renderTimeline() {
    const host = $("timelineTrack");
    if (!host) return;
    const groups = timelineGroups();
    if (!groups.length) {
      host.innerHTML = "";
      renderTimelineDetails(null);
      return;
    }
    if (!state.activeTimelineKey || !groups.some((group) => group.key === state.activeTimelineKey)) {
      state.activeTimelineKey = groups[0].key;
    }
    host.innerHTML = groups
      .map((group) => {
        const label = group.items.length > 1 ? `${group.items[0].product}等${group.items.length}项` : group.items[0].product;
        return `
          <button class="timeline-node ${state.activeTimelineKey === group.key ? "active" : ""}" type="button" data-key="${escapeHtml(group.key)}">
            <span class="timeline-count">${group.items.length}</span>
            <strong>${escapeHtml(group.date)}</strong>
            <span>${escapeHtml(label || "-")}</span>
          </button>
        `;
      })
      .join("");
    host.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => {
        state.activeTimelineKey = button.dataset.key || "";
        renderTimeline();
      });
    });
    renderTimelineDetails(groups.find((group) => group.key === state.activeTimelineKey));
  }

  function renderProjects() {
    const body = $("projectBody");
    if (!body) return;
    const projects = visibleProjects();
    setText("projectCount", `${projects.length} 个项目`);
    body.innerHTML = projects
      .map((project) => `
        <tr>
          <td>
            <strong>${escapeHtml(project.product)}</strong>
            <span class="muted-line">${escapeHtml(project.company)}</span>
          </td>
          <td>${escapeHtml(project.track_label)}</td>
          <td>
            <strong>${escapeHtml(project.current_stage)}</strong>
            <span class="muted-line">${escapeHtml(project.stage_chain || "")}</span>
          </td>
          <td>
            <span class="badge ${gradeBadgeClass(project.highest_evidence)}">${escapeHtml(gradeLabel(project.highest_evidence))}</span>
            <span class="muted-line">${escapeHtml(project.evidence_count)} 条来源</span>
          </td>
          <td>${escapeHtml(project.reported_indication || "-")}</td>
          <td>${escapeHtml(project.reported_center_or_pi || "-")}</td>
          <td>${escapeHtml(project.next_watch || "-")}</td>
        </tr>
      `)
      .join("");
  }

  function renderRecords() {
    const body = $("recordBody");
    if (!body) return;
    const records = visibleRecords();
    setText("recordCount", `${records.length} 条来源`);
    body.innerHTML = records
      .map((record) => `
        <tr>
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
  }

  function render() {
    renderTabs();
    renderKpis();
    renderSourceBars();
    renderTimeline();
    renderProjects();
    renderRecords();
  }

  renderMeta();
  render();
})();
