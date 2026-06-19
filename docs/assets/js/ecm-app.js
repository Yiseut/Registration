(function () {
  const data = window.ECM_DASHBOARD_DATA || {};
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

  function renderMeta() {
    const meta = data.meta || {};
    document.title = meta.title || "ECM 细胞外基质中国观察页";
    setText("pageTitle", meta.title || "");
    setText("pageSubtitle", meta.subtitle || "");
    setText("updatedAt", meta.updated_at || "-");
    setText("scopeText", meta.scope || "");
  }

  function renderKpis() {
    const el = $("kpis");
    if (!el) return;
    el.innerHTML = (data.kpis || [])
      .map((item) => `
        <article>
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}${item.unit ? `<small>${escapeHtml(item.unit)}</small>` : ""}</strong>
          <p>${escapeHtml(item.note || "")}</p>
        </article>
      `)
      .join("");
  }

  function renderInsights() {
    const el = $("insights");
    if (!el) return;
    el.innerHTML = (data.insights || [])
      .map((item) => `
        <article class="analysis-card">
          <span>${escapeHtml(item.eyebrow)}</span>
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.body)}</p>
        </article>
      `)
      .join("");
  }

  function renderStageDetails(activeId) {
    const details = $("stageDetails");
    const stages = data.stages || [];
    if (!details) return;
    const active = stages.find((item) => item.id === activeId) || stages[0];
    if (!active) {
      details.innerHTML = "";
      return;
    }
    details.innerHTML = `
      <article class="stage-detail-card">
        <span>${escapeHtml(active.status)}</span>
        <h3>${escapeHtml(active.label)}</h3>
        <p>${escapeHtml(active.detail)}</p>
      </article>
    `;
  }

  function renderStages() {
    const el = $("stageTimeline");
    const stages = data.stages || [];
    if (!el) return;
    let activeId = stages[0]?.id || "";

    function draw() {
      el.innerHTML = stages
        .map((item) => `
          <button class="stage-node ${item.id === activeId ? "active" : ""}" type="button" data-stage-id="${escapeHtml(item.id)}" aria-pressed="${item.id === activeId ? "true" : "false"}">
            <span class="stage-count">${escapeHtml(item.count)}</span>
            <strong>${escapeHtml(item.label)}</strong>
            <em>${escapeHtml(item.status)}</em>
          </button>
        `)
        .join("");
      renderStageDetails(activeId);
      el.querySelectorAll(".stage-node").forEach((button) => {
        button.addEventListener("click", () => {
          activeId = button.dataset.stageId;
          draw();
        });
      });
    }

    draw();
  }

  function renderBoundaryTable() {
    const body = $("boundaryBody");
    if (!body) return;
    body.innerHTML = (data.boundaries || [])
      .map((item) => `
        <tr>
          <td><strong>${escapeHtml(item.term)}</strong></td>
          <td>${escapeHtml(item.role)}</td>
          <td><span class="pill ${item.status === "排除归类" ? "muted" : ""}">${escapeHtml(item.status)}</span></td>
          <td>${escapeHtml(item.rule)}</td>
        </tr>
      `)
      .join("");
  }

  function renderWatchlist() {
    const body = $("watchBody");
    if (!body) return;
    body.innerHTML = (data.watchlist || [])
      .map((item) => `
        <tr>
          <td><strong>${escapeHtml(item.signal)}</strong></td>
          <td>${escapeHtml(item.source)}</td>
          <td>${escapeHtml(item.judgment)}</td>
          <td>${escapeHtml(item.next)}</td>
          <td>${item.url ? `<a class="source-link" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">查看</a>` : "-"}</td>
        </tr>
      `)
      .join("");
  }

  function renderSources() {
    const el = $("sourceList");
    if (!el) return;
    el.innerHTML = (data.sources || [])
      .map((item) => `
        <li>
          <strong>${escapeHtml(item.name)}</strong>
          <span>${escapeHtml(item.detail)}</span>
        </li>
      `)
      .join("");
  }

  renderMeta();
  renderKpis();
  renderInsights();
  renderStages();
  renderBoundaryTable();
  renderWatchlist();
  renderSources();
})();
