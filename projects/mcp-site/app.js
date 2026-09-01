(() => {
  "use strict";

  const state = { tools: [], level: "all", audience: "all" };
  const elements = Object.fromEntries(["toolSearch", "toolCount", "toolList", "statusMessage"].map(id => [id, document.getElementById(id)]));

  /** Escapes untrusted tool metadata before rendering it as markup. @param {string} value Text to encode. @returns {string} HTML-safe text. */
  function escapeHtml(value) {
    const node = document.createElement("div");
    node.textContent = String(value || "");
    return node.innerHTML;
  }

  /** Renders the selected MCP tool results. */
  function renderTools() {
    const query = elements.toolSearch.value.trim().toLowerCase();
    const matches = state.tools.filter(tool => (state.level === "all" || tool.level === state.level) && (state.audience === "all" || tool.audience === state.audience) && (!query || `${tool.name} ${tool.description} ${tool.area}`.toLowerCase().includes(query)));
    elements.toolCount.textContent = `${matches.length} ${matches.length === 1 ? "tool" : "tools"}`;
    elements.toolList.innerHTML = matches.map(tool => `<article class="explorer-tool-card"><div class="tool-tags"><span class="level-tag ${escapeHtml(tool.level)}">${tool.level === "read" ? "Read-only first" : "Controlled write"}</span><span class="audience-tag ${escapeHtml(tool.audience)}">${tool.audience === "user" ? "User-friendly" : "Developer"}</span></div><h3>${escapeHtml(tool.name)}</h3><p>${escapeHtml(tool.description)}</p><dl><dt>Before implementation</dt><dd>${escapeHtml(tool.requires)}</dd></dl></article>`).join("") || "<p class=\"empty-copy\">No MCP tools match these filters.</p>";
  }

  /** Loads the public tool definitions listed in the manifest. @returns {Promise<void>} */
  async function loadTools() {
    const manifestResponse = await fetch("tool-library/definitions/index.json");
    if (!manifestResponse.ok) throw new Error("Could not load the MCP tool manifest.");
    const manifest = await manifestResponse.json();
    if (!Array.isArray(manifest)) throw new Error("The MCP tool manifest must be an array.");
    state.tools = await Promise.all(manifest.map(async filename => {
      const response = await fetch(`tool-library/definitions/${filename}`);
      if (!response.ok) throw new Error(`Could not load tool-library/definitions/${filename}`);
      return response.json();
    }));
    renderTools();
  }

  /** Selects a tool filter value. @param {"level" | "audience"} filter Filter name. @param {string} value Active filter value. */
  function selectFilter(filter, value) {
    state[filter] = value;
    document.querySelectorAll(`button[data-${filter}]`).forEach(button => {
      const selected = button.dataset[filter] === value;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    renderTools();
  }

  elements.toolSearch.addEventListener("input", renderTools);
  document.querySelectorAll("button[data-level]").forEach(button => button.addEventListener("click", () => selectFilter("level", button.dataset.level)));
  document.querySelectorAll("button[data-audience]").forEach(button => button.addEventListener("click", () => selectFilter("audience", button.dataset.audience)));
  loadTools().catch(error => { elements.toolCount.textContent = "Library unavailable"; elements.statusMessage.textContent = error.message || "Could not load MCP tools."; });
})();