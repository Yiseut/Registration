(function () {
  const data = window.SILK_DASHBOARD_DATA || {};
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
    document.title = meta.title || "丝素蛋白中国医美转化观察页";
    setText("pageTitle", meta.title || "");
    setText("pageSubtitle", meta.subtitle || "");
    setText("updatedAt", meta.updated_at || "-");
    setText("scopeText", meta.scope || "");
  }

  function renderKpis() {
    const el = $("kpis");
    if (!el) return;
    el.innerHTML = (data.kpis || []).map((item) => `
      <article>
        <span>${escapeHtml(item.label)}</span>
        <strong>${escapeHtml(item.value)}${item.unit ? `<small>${escapeHtml(item.unit)}</small>` : ""}</strong>
        <p>${escapeHtml(item.note || "")}</p>
      </article>
    `).join("");
  }

  function renderInsights() {
    const el = $("insights");
    if (!el) return;
    el.innerHTML = (data.insights || []).map((item) => `
      <article class="analysis-card">
        <span>${escapeHtml(item.eyebrow)}</span>
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.body)}</p>
      </article>
    `).join("");
  }

  function renderFunnel() {
    const el = $("funnel");
    const details = $("funnelDetails");
    const items = data.funnel || [];
    if (!el || !details) return;
    let activeId = items[0]?.id || "";

    function draw() {
      el.innerHTML = items.map((item) => `
        <button class="funnel-node ${item.id === activeId ? "active" : ""}" type="button" data-funnel-id="${escapeHtml(item.id)}" aria-pressed="${item.id === activeId ? "true" : "false"}">
          <span class="funnel-count">${escapeHtml(item.count)}</span>
          <strong>${escapeHtml(item.label)}</strong>
          <em>${escapeHtml(item.status)}</em>
        </button>
      `).join("");
      const active = items.find((item) => item.id === activeId) || items[0];
      details.innerHTML = active ? `
        <article class="detail-card">
          <span>${escapeHtml(active.status)}</span>
          <h3>${escapeHtml(active.label)}</h3>
          <p>${escapeHtml(active.detail)}</p>
        </article>
      ` : "";
      el.querySelectorAll(".funnel-node").forEach((button) => {
        button.addEventListener("click", () => {
          activeId = button.dataset.funnelId;
          draw();
        });
      });
    }

    draw();
  }

  function renderTimeline() {
    const el = $("timeline");
    if (!el) return;
    el.innerHTML = (data.timeline || []).map((item) => `
      <article class="timeline-card">
        <span>${escapeHtml(item.date)}</span>
        <h3>${escapeHtml(item.title)}</h3>
        <p><strong>${escapeHtml(item.company)}</strong></p>
        <p>${escapeHtml(item.note)}</p>
        <a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.status)}</a>
      </article>
    `).join("");
  }

  function renderSegmentTable() {
    const body = $("segmentBody");
    if (!body) return;
    body.innerHTML = (data.segments || []).map((item) => `
      <tr>
        <td><strong>${escapeHtml(item.name)}</strong></td>
        <td><span class="pill">${escapeHtml(item.maturity)}</span></td>
        <td>${escapeHtml(item.evidence)}</td>
        <td>${escapeHtml(item.implication)}</td>
      </tr>
    `).join("");
  }

  function renderWatchlist() {
    const body = $("watchBody");
    if (!body) return;
    body.innerHTML = (data.watchlist || []).map((item) => `
      <tr>
        <td><strong>${escapeHtml(item.item)}</strong></td>
        <td>${escapeHtml(item.signal)}</td>
        <td>${escapeHtml(item.stage)}</td>
        <td>${escapeHtml(item.next)}</td>
        <td>${item.url ? `<a class="source-link" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">查看</a>` : "-"}</td>
      </tr>
    `).join("");
  }

  function renderSources() {
    const el = $("sourceList");
    if (!el) return;
    el.innerHTML = (data.sources || []).map((item) => `
      <li>
        <strong>${escapeHtml(item.name)}</strong>
        <span>${escapeHtml(item.detail)}</span>
        ${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">查看来源</a>` : ""}
      </li>
    `).join("");
  }

  renderMeta();
  renderKpis();
  renderInsights();
  renderFunnel();
  renderTimeline();
  renderSegmentTable();
  renderWatchlist();
  renderSources();
})();
