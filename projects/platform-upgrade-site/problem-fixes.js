(() => {
  "use strict";

  const DATA_URL = "./prbs-z12.00-b00.00.csv";
  const PAGE_SIZE = 40;
  const elements = Object.fromEntries([
    "problemFixesWorkspacePanel", "problemDataStatus", "problemTotalCount", "problemProductCount", "problemFamilyCount", "problemSearch", "problemFamilyFilter", "problemTypeFilter", "problemSort", "resetProblemFilters", "problemError", "problemRows", "problemEmpty", "problemPagination", "problemResultCount", "problemPageStatus", "problemDetailDialog", "problemDetailTitle", "problemDetailProduct", "problemDetailFamily", "problemDetailPatch", "problemDetailType", "problemDetailDescription", "closeProblemDetail"
  ].map(id => [id, document.getElementById(id)]));
  const state = { records: [], filtered: [], loaded: false, loading: null, page: 1 };

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function parseCsvRows(text) {
    const source = String(text || "").replace(/^\uFEFF/, "");
    const rows = [];
    let row = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index < source.length; index += 1) {
      const character = source[index];
      if (character === '"') {
        if (quoted && source[index + 1] === '"') { value += '"'; index += 1; }
        else quoted = !quoted;
      } else if (character === "," && !quoted) {
        row.push(value); value = "";
      } else if ((character === "\n" || character === "\r") && !quoted) {
        if (character === "\r" && source[index + 1] === "\n") index += 1;
        row.push(value);
        if (row.some(cell => cell.trim())) rows.push(row);
        row = []; value = "";
      } else value += character;
    }
    row.push(value);
    if (row.some(cell => cell.trim())) rows.push(row);
    const headers = (rows.shift() || []).map(header => header.trim().toLowerCase());
    if (!headers.length) throw new Error("The problem-fix CSV is empty.");
    return rows.map(cells => Object.fromEntries(headers.map((header, index) => [header, (cells[index] || "").trim()])));
  }

  function populateFilter(select, values, label) {
    select.innerHTML = `<option value="all">All ${label}</option>${values.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("")}`;
  }

  function productKey(value) { return String(value || "").toLocaleLowerCase().replace(/[^a-z0-9]/g, ""); }

  function publishProblemIndex() {
    const grouped = new Map();
    for (const record of state.records) {
      const key = productKey(record.product);
      if (!key) continue;
      if (!grouped.has(key)) grouped.set(key, { product: record.product, records: [] });
      grouped.get(key).records.push({ prb: record.prb, family: record.family, patch: record.patch, type: record["prb type"] });
    }
    window.dispatchEvent(new CustomEvent("platform-problem-fixes-ready", { detail: { products: [...grouped.values()] } }));
  }

  async function loadProblemFixes() {
    if (state.loaded) { publishProblemIndex(); return; }
    if (state.loading) return state.loading;
    state.loading = (async () => {
      elements.problemDataStatus.textContent = "Loading bundled problem fixes";
      elements.problemError.hidden = true;
      try {
        const response = await fetch(DATA_URL);
        if (!response.ok) throw new Error(`Could not load the bundled PRB file (${response.status}).`);
        const records = parseCsvRows(await response.text());
        const required = ["family", "product", "patch", "prb", "prb type", "description"];
        if (!required.every(field => Object.hasOwn(records[0] || {}, field))) {
          throw new Error("The problem-fix CSV must contain Family, Product, Patch, PRB, PRB type, and Description columns.");
        }
        state.records = records.filter(record => record.prb || record.product);
        state.loaded = true;
        publishProblemIndex();
        const families = [...new Set(state.records.map(record => record.family).filter(Boolean))].sort((left, right) => left.localeCompare(right));
        const products = new Set(state.records.map(record => record.product).filter(Boolean));
        const types = [...new Set(state.records.map(record => record["prb type"]).filter(Boolean))].sort((left, right) => left.localeCompare(right));
        populateFilter(elements.problemFamilyFilter, families, "families");
        populateFilter(elements.problemTypeFilter, types, "types");
        elements.problemTotalCount.textContent = state.records.length.toLocaleString();
        elements.problemProductCount.textContent = products.size.toLocaleString();
        elements.problemFamilyCount.textContent = families.length.toLocaleString();
        elements.problemDataStatus.textContent = `${state.records.length.toLocaleString()} problem fixes loaded from bundled CSV`;
        render();
      } catch (error) {
        elements.problemDataStatus.textContent = "Problem-fix data unavailable";
        elements.problemError.textContent = `${error.message} Confirm prbs-z12.00-b00.00.csv is deployed beside the Platform Upgrade Desk files.`;
        elements.problemError.hidden = false;
        elements.problemRows.innerHTML = "";
        elements.problemEmpty.hidden = true;
      } finally {
        state.loading = null;
      }
    })();
    return state.loading;
  }

  function render() {
    const query = elements.problemSearch.value.trim().toLocaleLowerCase();
    const family = elements.problemFamilyFilter.value;
    const type = elements.problemTypeFilter.value;
    const filtered = state.records.filter(record => {
      const searchText = `${record.prb} ${record.product} ${record.patch} ${record.family} ${record["prb type"]} ${record.description}`.toLocaleLowerCase();
      return (!query || searchText.includes(query)) && (family === "all" || record.family === family) && (type === "all" || record["prb type"] === type);
    });
    if (elements.problemSort.value === "product") filtered.sort((left, right) => left.product.localeCompare(right.product) || left.prb.localeCompare(right.prb, undefined, { numeric: true }));
    else if (elements.problemSort.value === "prb") filtered.sort((left, right) => left.prb.localeCompare(right.prb, undefined, { numeric: true }));
    else filtered.sort((left, right) => left.family.localeCompare(right.family) || left.product.localeCompare(right.product) || left.prb.localeCompare(right.prb, undefined, { numeric: true }));
    state.filtered = filtered;
    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    state.page = Math.min(state.page, pageCount);
    const visible = filtered.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
    elements.problemRows.innerHTML = visible.map(record => {
      const index = state.records.indexOf(record);
      const summary = record.description.replace(/\s+/g, " ").trim();
      const teaser = summary.length > 190 ? `${summary.slice(0, 187)}...` : summary;
      return `<tr><td><button class="problem-id" type="button" data-problem-index="${index}">${escapeHtml(record.prb || "—")}</button></td><td class="problem-product">${escapeHtml(record.product || "—")}</td><td><span class="problem-family">${escapeHtml(record.family || "—")}</span><small class="problem-patch">${escapeHtml(record.patch || "")}</small></td><td><span class="problem-type">${escapeHtml(record["prb type"] || "—")}</span></td><td class="problem-summary">${escapeHtml(teaser || "No description provided")}</td></tr>`;
    }).join("");
    elements.problemEmpty.hidden = visible.length > 0;
    elements.problemResultCount.textContent = `${filtered.length.toLocaleString()} of ${state.records.length.toLocaleString()} problem fixes`;
    elements.problemPageStatus.textContent = filtered.length ? `Showing ${visible.length} on page ${state.page} of ${pageCount}` : "No matching fixes";
    renderPagination(pageCount);
  }

  function renderPagination(pageCount) {
    if (pageCount <= 1) { elements.problemPagination.innerHTML = ""; return; }
    const pages = [...new Set([1, state.page - 1, state.page, state.page + 1, pageCount])].filter(page => page >= 1 && page <= pageCount).sort((left, right) => left - right);
    let previous = 0;
    const buttons = pages.map(page => {
      const gap = page - previous > 1 ? '<span aria-hidden="true">…</span>' : "";
      previous = page;
      return `${gap}<button type="button" data-problem-page="${page}" class="${page === state.page ? "active" : ""}" aria-label="Page ${page}" ${page === state.page ? 'aria-current="page"' : ""}>${page}</button>`;
    }).join("");
    elements.problemPagination.innerHTML = `<button type="button" data-problem-page="${state.page - 1}" aria-label="Previous page" ${state.page === 1 ? "disabled" : ""}>‹</button>${buttons}<button type="button" data-problem-page="${state.page + 1}" aria-label="Next page" ${state.page === pageCount ? "disabled" : ""}>›</button>`;
  }

  function openProblem(index) {
    const record = state.records[index];
    if (!record) return;
    elements.problemDetailTitle.textContent = record.prb || "Problem details";
    elements.problemDetailProduct.textContent = record.product;
    elements.problemDetailFamily.textContent = record.family;
    elements.problemDetailPatch.textContent = record.patch;
    elements.problemDetailType.textContent = record["prb type"];
    elements.problemDetailDescription.textContent = record.description;
    elements.problemDetailDialog.showModal();
  }

  async function openRequestedProblem(prb) {
    await loadProblemFixes();
    if (!state.loaded) return;
    const record = state.records.find(item => item.prb === String(prb || "").trim());
    if (!record) {
      elements.problemError.textContent = `Problem ${prb} was not found in the bundled PRB file.`;
      elements.problemError.hidden = false;
      return;
    }
    elements.problemSearch.value = record.prb;
    elements.problemFamilyFilter.value = "all";
    elements.problemTypeFilter.value = "all";
    state.page = 1;
    render();
    openProblem(state.records.indexOf(record));
  }

  elements.problemSearch.addEventListener("input", () => { state.page = 1; render(); });
  [elements.problemFamilyFilter, elements.problemTypeFilter, elements.problemSort].forEach(control => control.addEventListener("change", () => { state.page = 1; render(); }));
  elements.resetProblemFilters.addEventListener("click", () => {
    elements.problemSearch.value = "";
    elements.problemFamilyFilter.value = "all";
    elements.problemTypeFilter.value = "all";
    elements.problemSort.value = "family";
    state.page = 1;
    render();
  });
  elements.problemRows.addEventListener("click", event => {
    const button = event.target.closest("[data-problem-index]");
    if (button) openProblem(Number(button.dataset.problemIndex));
  });
  elements.problemPagination.addEventListener("click", event => {
    const button = event.target.closest("button[data-problem-page]");
    if (!button || button.disabled) return;
    state.page = Number(button.dataset.problemPage);
    render();
    elements.problemFixesWorkspacePanel.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  elements.closeProblemDetail.addEventListener("click", () => elements.problemDetailDialog.close());
  elements.problemDetailDialog.addEventListener("click", event => {
    if (event.target === elements.problemDetailDialog) elements.problemDetailDialog.close();
  });
  window.addEventListener("platform-problem-fixes-open", loadProblemFixes);
  window.addEventListener("platform-problem-fixes-request", loadProblemFixes);
  window.addEventListener("platform-prb-open", event => openRequestedProblem(event.detail?.prb));
  if (!elements.problemFixesWorkspacePanel.hidden) loadProblemFixes();
})();