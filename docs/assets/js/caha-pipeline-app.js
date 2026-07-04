(function () {
  const data = window.CAHA_PIPELINE_DATA || { meta: {}, projects: [], records: [] };
  const meta = data.meta || {};
  const projects = Array.isArray(data.projects) ? data.projects : [];
  const records = Array.isArray(data.records) ? data.records : [];
  const milestones = Array.isArray(data.milestones) ? data.milestones : [];

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

  function displayValue(value, suffix = "") {
    if (value === 0) return `0${suffix}`;
    if (value === "" || value === null || value === undefined) return "-";
    return `${value}${suffix}`;
  }

  function uniq(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function countBy(list, key) {
    return list.reduce((acc, item) => {
      const value = typeof key === "function" ? key(item) : item[key];
      if (!value) return acc;
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
  }

  function sumNumeric(list, key) {
    return list.reduce((sum, item) => {
      const value = Number(item[key]);
      return Number.isFinite(value) ? sum + value : sum;
    }, 0);
  }

  function categoryClass(category) {
    if (category === "已获批") return "strong";
    if (category === "Ongoing") return "mid";
    return "";
  }

  function renderMeta() {
    setText("pageTitle", meta.title || "中国 CaHA 临床注册进度");
    setText("pageSubtitle", meta.subtitle || "");
    setText("updatedAt", meta.updated_at || "-");
  }

  function getDomesticProjects() {
    return projects.filter((project) => project.market === "中国国内");
  }

  function getOverseasProjects() {
    return projects.filter((project) => project.market === "海外参考");
  }

  function renderKpis() {
    const domestic = getDomesticProjects();
    const overseas = getOverseasProjects();
    const clinicalRecords = records.filter((record) => record.evidence_type === "临床登记").length;
    const knownChinaCenters = sumNumeric(domestic, "center_count");
    const ongoing = domestic.filter((project) => project.category === "Ongoing").length;

    setText("kpiChinaProjects", domestic.length);
    setText("kpiChinaOngoing", ongoing);
    setText("kpiOverseasProjects", overseas.length);
    setText("kpiClinicalRecords", clinicalRecords);
    setText("kpiKnownCenters", knownChinaCenters);
  }

  function getDomesticMilestones() {
    return milestones.filter((item) => item.market === "中国国内");
  }

  function timelineGroupKey(item) {
    return item.date || item.date_label || "待补时间";
  }

  function timelineSortValue(item) {
    return item.sort_date || item.date || "9999-12-31";
  }

  function groupTimelineMilestones() {
    const groups = new Map();
    getDomesticMilestones()
      .slice()
      .sort((a, b) => timelineSortValue(a).localeCompare(timelineSortValue(b)))
      .forEach((item) => {
        const key = timelineGroupKey(item);
        if (!groups.has(key)) {
          groups.set(key, {
            key,
            label: item.date_label || item.date || "待补时间",
            sort: timelineSortValue(item),
            items: [],
          });
        }
        groups.get(key).items.push(item);
      });
    return [...groups.values()];
  }

  function renderTimelineDetails(activeKey, groups) {
    const el = $("timelineDetails");
    if (!el) return;
    const group = groups.find((item) => item.key === activeKey) || groups[0];
    if (!group) {
      el.innerHTML = "";
      return;
    }
    el.innerHTML = group.items
      .map((item) => `
        <article class="timeline-detail-card">
          <span>${escapeHtml(item.stage || item.status || "-")}</span>
          <h3>${escapeHtml(item.product || "-")}</h3>
          <p><strong>企业</strong> ${escapeHtml(item.company_group || "-")}</p>
          <p><strong>状态</strong> ${escapeHtml(item.status || "-")}</p>
          <p><strong>方向</strong> ${escapeHtml(item.indication_site || "-")}</p>
          <p>${escapeHtml(item.summary || "")}</p>
          ${item.source_code ? `<span>${escapeHtml(item.source_code)}</span>` : ""}
        </article>
      `)
      .join("");
  }

  function renderTimeline() {
    const el = $("timelineChart");
    if (!el) return;
    const groups = groupTimelineMilestones();
    if (!groups.length) {
      el.innerHTML = "";
      renderTimelineDetails("", groups);
      return;
    }
    let activeKey = groups.find((group) => group.items.some((item) => item.id === "milestone-harmonyca-start"))?.key || groups[0].key;

    function draw() {
      el.innerHTML = groups
        .map((group) => {
          const products = uniq(group.items.map((item) => item.product));
          const productLabel = products.length > 2 ? `${products.slice(0, 2).join(" / ")}等${products.length}项` : products.join(" / ");
          return `
            <button class="timeline-node ${group.key === activeKey ? "active" : ""}" type="button" data-timeline-key="${escapeHtml(group.key)}" aria-pressed="${group.key === activeKey ? "true" : "false"}">
              <span class="timeline-count">${group.items.length}</span>
              <strong>${escapeHtml(group.label)}</strong>
              <span>${escapeHtml(productLabel || "-")}</span>
            </button>
          `;
        })
        .join("");
      renderTimelineDetails(activeKey, groups);
      el.querySelectorAll(".timeline-node").forEach((button) => {
        button.addEventListener("click", () => {
          activeKey = button.dataset.timelineKey;
          draw();
        });
      });
    }

    draw();
  }

  function renderIndicationMatrix() {
    const el = $("indicationMatrix");
    if (!el) return;
    const rows = [
      ["中国国内", getDomesticProjects()],
      ["海外参考", getOverseasProjects()],
    ];
    el.innerHTML = rows
      .map(([label, list]) => {
        const indications = uniq(list.map((project) => project.indication_site));
        const tags = indications.map((item) => `<span>${escapeHtml(item)}</span>`).join("");
        return `
          <div class="matrix-row">
            <span>${escapeHtml(label)}</span>
            <div class="matrix-tags">${tags || "<span>-</span>"}</div>
          </div>
        `;
      })
      .join("");
  }

  function renderProjectTable(bodyId, countId, list, tailLabel) {
    const body = $(bodyId);
    if (!body) return;
    setText(countId, `${list.length} 个项目`);
    body.innerHTML = list
      .map((project) => `
        <tr>
          <td class="product-cell">
            <strong>${escapeHtml(project.product)}</strong>
            <span>${escapeHtml(project.company_group || project.company)}</span>
            <span>${escapeHtml(project.product_type || "")}</span>
          </td>
          <td><span class="pill ${categoryClass(project.category)}">${escapeHtml(project.category)}</span></td>
          <td>
            <strong>${escapeHtml(project.indication_site || "-")}</strong>
            <span class="muted-cell">${escapeHtml(project.indication || "")}</span>
          </td>
          <td>
            <strong>${escapeHtml(project.progress_stage || "-")}</strong>
            <span class="muted-cell">${escapeHtml(project.progress_status || "")}</span>
          </td>
          <td class="numeric-cell">${escapeHtml(displayValue(project.center_count, project.center_count ? " 家" : ""))}</td>
          <td class="numeric-cell">${escapeHtml(displayValue(project.planned_enrollment, project.planned_enrollment ? " 例" : ""))}</td>
          <td class="numeric-cell">${escapeHtml(displayValue(project.actual_enrollment, project.actual_enrollment && !String(project.actual_enrollment).includes("近") ? " 例" : ""))}</td>
          <td class="numeric-cell">${escapeHtml(displayValue(project.fas_count))}</td>
          <td class="numeric-cell">${escapeHtml(displayValue(project.pps_count))}</td>
          <td class="numeric-cell">${escapeHtml(displayValue(project.ss_count))}</td>
          <td>${escapeHtml(project.center_fas_detail || "-")}</td>
          <td>
            <strong>${escapeHtml(project.highest_evidence || "-")}</strong>
            <span class="muted-cell">${escapeHtml(displayValue(project.evidence_count, project.evidence_count ? " 条" : ""))}</span>
          </td>
          <td>${escapeHtml(project[tailLabel] || project.next_watch || "-")}</td>
        </tr>
      `)
      .join("");
  }

  function renderEvidenceTable() {
    const body = $("evidenceBody");
    if (!body) return;
    setText("evidenceCount", `${records.length} 条记录`);
    body.innerHTML = records
      .map((record) => `
        <tr>
          <td>${escapeHtml(record.market || "-")}</td>
          <td class="product-cell">
            <strong>${escapeHtml(record.product)}</strong>
            <span>${escapeHtml(record.company || "")}</span>
          </td>
          <td>${escapeHtml(record.evidence_type || "-")}</td>
          <td>${escapeHtml(record.source_code || "-")}</td>
          <td>${escapeHtml(record.status || "-")}</td>
          <td>${escapeHtml(record.phase || "-")}</td>
          <td class="numeric-cell">${escapeHtml(displayValue(record.center_count, record.center_count ? " 家" : ""))}</td>
          <td class="numeric-cell">${escapeHtml(displayValue(record.planned_enrollment, record.planned_enrollment ? " 例" : ""))}</td>
          <td class="numeric-cell">${escapeHtml(displayValue(record.actual_enrollment, record.actual_enrollment && !String(record.actual_enrollment).includes("近") ? " 例" : ""))}</td>
          <td class="numeric-cell">${escapeHtml(displayValue(record.fas_count))}</td>
          <td class="numeric-cell">${escapeHtml(displayValue(record.pps_count))}</td>
          <td class="numeric-cell">${escapeHtml(displayValue(record.ss_count))}</td>
          <td>${escapeHtml(record.center_fas_detail || "-")}</td>
          <td><span class="muted-cell">${escapeHtml(record.note || "-")}</span></td>
        </tr>
      `)
      .join("");
  }

  renderMeta();
  renderKpis();
  renderTimeline();
  renderIndicationMatrix();
  renderProjectTable("chinaProjectBody", "chinaProjectCount", getDomesticProjects(), "next_watch");
  renderProjectTable("overseasProjectBody", "overseasProjectCount", getOverseasProjects(), "next_watch");
  renderEvidenceTable();
})();
