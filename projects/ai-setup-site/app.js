(() => {
  "use strict";

  const workspaces = {
    copilot: {
      name: "Visual Studio Code + GitHub Copilot",
      label: "VS Code + GitHub Copilot",
      description: "Copilot uses instructions for persistent repository guidance and skills for deeper, task-specific ServiceNow workflows.",
      tree: ".github/\n  copilot-instructions.md\n  instructions/\n    <selected-rule>.instructions.md\n  skills/\n    <selected-skill>/\n      SKILL.md",
      rulePath: ".github/instructions",
      skillPath: ".github/skills",
      steps: ["Add a short copilot-instructions.md for repository-wide behavior.", "Copy selected rules as .instructions.md files with Copilot frontmatter.", "Copy selected skill folders unchanged into .github/skills.", "Use Copilot Chat in VS Code for the matching ServiceNow task."]
    },
    antigravity: {
      name: "Antigravity IDE",
      label: "Antigravity IDE",
      description: "Antigravity reads persistent ServiceNow rules and task-specific skill packages from the workspace. The model selected inside Antigravity does not change this layout.",
      tree: ".agents/\n  rules/\n    <selected-rule>.md\n  skills/\n    <selected-skill>/\n      SKILL.md",
      rulePath: ".agents/rules",
      skillPath: ".agents/skills",
      steps: ["Copy selected rule files unchanged into .agents/rules.", "Copy selected skill folders unchanged into .agents/skills.", "Preserve each skill's SKILL.md, references, scripts, and assets.", "Start Antigravity from the workspace and select any available model for the task."]
    }
  };

  const ruleMetadata = {
    "code-documentation.md": { area: "Workspace standards", tasks: ["build", "review"] },
    "multi-project-rules.md": { area: "Workspace standards", tasks: ["build"] },
    "project-isolation.md": { area: "Workspace standards", tasks: ["build"] },
    "servicenow-best-practices.md": { area: "Development", tasks: ["build", "review", "deploy"] },
    "sn-business-rules.md": { area: "Development", tasks: ["build", "review", "deploy"] },
    "sn-client-scripting.md": { area: "Development", tasks: ["build", "review"] },
    "sn-gliderecord.md": { area: "Development", tasks: ["build", "review"] }
  };

  const state = { manifest: null, items: [], filtered: [], active: null, selected: new Set(), workspace: "copilot", type: "all" };
  const elements = Object.fromEntries(["setupStatus", "workspaceTitle", "workspaceDescription", "workspaceTree", "workspaceSteps", "searchInput", "typeFilters", "addOfflineStarter", "libraryCount", "guidanceList", "guidanceDetail", "selectionSummary", "downloadSelection", "clearSelection", "statusMessage"].map(id => [id, document.getElementById(id)]));

  /** Escapes source text before inserting it into generated markup. @param {unknown} value Source value. @returns {string} HTML-safe text. */
  function escapeHtml(value) {
    const node = document.createElement("div");
    node.textContent = String(value || "");
    return node.innerHTML;
  }

  /** Converts a filename or directory into a readable title. @param {string} value Source name. @returns {string} Readable title. */
  function titleFrom(value) {
    return value.replace(/\.md$/, "").split("/").pop().replace(/[-_]/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
  }

  /** Returns the current workspace configuration. @returns {typeof workspaces[string]} Workspace configuration. */
  function workspace() {
    return workspaces[state.workspace];
  }

  /** Builds Copilot YAML frontmatter around a source rule. @param {string} itemName Rule name. @param {string} content Rule content. @returns {string} Copilot instruction content. */
  function toCopilotInstruction(itemName, content) {
    return `---\ndescription: "ServiceNow ${titleFrom(itemName)} guidance."\napplyTo: "**/*"\n---\n\n${content}`;
  }

  /** Returns catalog metadata for an offline skill directory. @param {string} directory Skill directory from the manifest. @returns {{area: string, tasks: string[]}} Catalog metadata. */
  function metadataForSkill(directory) {
    const offlineTasks = { "offline/servicenow-code-review": ["review"], "offline/gliderecord-query-review": ["review"], "offline/update-set-preflight": ["review", "deploy"] };
    return {
      area: "Offline guidance",
      tasks: offlineTasks[directory] || ["review"]
    };
  }

  /** Loads the static rule and skill inventory. @returns {Promise<void>} */
  async function loadLibrary() {
    if (location.protocol === "file:") {
      throw new Error("Open this library through GitHub Pages or a local web server. Browsers cannot load the rules and skills when this page is opened directly from a file.");
    }
    const response = await fetch("reference-manifest.json");
    if (!response.ok) throw new Error("Could not load the guidance library.");
    state.manifest = await response.json();
    const rules = state.manifest.rules.map(filename => ({ id: `rule:${filename}`, type: "rule", name: titleFrom(filename), path: `rules/${filename}`, source: filename, ...(ruleMetadata[filename] || { area: "Workspace standards", tasks: ["review"] }) }));
    const skills = Object.entries(state.manifest.skills)
      .filter(([, files]) => files.includes("SKILL.md"))
      .map(([directory]) => {
        return { id: `skill:${directory}`, type: "skill", name: titleFrom(directory), path: `skills/${directory}/SKILL.md`, source: directory, ...metadataForSkill(directory) };
      });
    state.items = [...rules, ...skills].sort((left, right) => left.name.localeCompare(right.name));
    applyFilters();
  }

  /** Filters and renders the searchable library list. */
  function applyFilters() {
    const query = elements.searchInput.value.trim().toLowerCase();
    state.filtered = state.items.filter(item => (!query || `${item.name} ${item.path} ${item.area} ${item.tasks.join(" ")}`.toLowerCase().includes(query)) && (state.type === "all" || item.type === state.type));
    elements.libraryCount.textContent = `${state.filtered.length} ${state.filtered.length === 1 ? "item" : "items"}`;
    elements.guidanceList.innerHTML = state.filtered.length
      ? state.filtered.map(item => `<button class="guidance-item ${state.active?.id === item.id ? "active" : ""}" type="button" data-id="${escapeHtml(item.id)}"><strong>${escapeHtml(item.name)}</strong><small><span class="type-tag ${item.type}">${item.type}</span>${escapeHtml(titleFrom(item.area))}</small></button>`).join("")
      : "<p class=\"empty-copy\">No guidance matches your search.</p>";
  }

  /** Updates the displayed guidance type. @param {string} value Selected type. */
  function setCatalogFilter(value) {
    state.type = value;
    elements.typeFilters.querySelectorAll("button").forEach(button => {
      const selected = button.dataset.type === value;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    applyFilters();
  }

  /** Displays a rule or skill and fetches its published Markdown. @param {string} itemId Guidance item ID. @returns {Promise<void>} */
  async function openItem(itemId) {
    const item = state.items.find(candidate => candidate.id === itemId);
    if (!item) return;
    state.active = item;
    applyFilters();
    elements.guidanceDetail.innerHTML = "<p class=\"empty-copy\">Loading guidance...</p>";
    try {
      const content = await fetchItemContent(item);
      elements.guidanceDetail.innerHTML = `<span class="type-tag ${item.type}">${item.type}</span><h3>${escapeHtml(item.name)}</h3><p class="detail-meta">${escapeHtml(item.path)}</p><div class="detail-actions"><button class="button secondary" type="button" data-action="copy">Copy content</button><button class="button secondary" type="button" data-action="select">${state.selected.has(item.id) ? "Remove from selection" : "Add to selection"}</button><button class="button secondary" type="button" data-action="download">Download item</button></div><pre class="document-preview">${escapeHtml(content)}</pre>`;
    } catch (error) {
      elements.guidanceDetail.innerHTML = `<p class="empty-copy">${escapeHtml(error.message || "Could not load this guidance.")}</p>`;
    }
  }

  /** Renders provider-specific workspace instructions. */
  function renderWorkspace() {
    const selected = workspace();
    elements.setupStatus.textContent = selected.label;
    elements.workspaceTitle.textContent = selected.name;
    elements.workspaceDescription.textContent = selected.description;
    elements.workspaceTree.textContent = selected.tree;
    elements.workspaceSteps.innerHTML = selected.steps.map(step => `<li>${escapeHtml(step)}</li>`).join("");
  }

  /** Updates the selected-guidance summary and archive controls. */
  function renderSelection() {
    const count = state.selected.size;
    elements.selectionSummary.textContent = count ? `${count} ${count === 1 ? "item" : "items"} will be packaged for ${workspace().label}.` : "No items selected.";
    elements.downloadSelection.disabled = count === 0;
    elements.clearSelection.disabled = count === 0;
  }

  /** Adds the core rules and first-party offline skills to the download selection. */
  function addOfflineStarter() {
    state.items.filter(item => item.type === "rule" || item.source.startsWith("offline/")).forEach(item => state.selected.add(item.id));
    renderSelection();
    elements.statusMessage.textContent = "Offline starter pack added to your selection.";
  }

  /** Copies text with a visible status result. @param {string} text Text to copy. @returns {Promise<void>} */
  async function copyText(text) {
    await navigator.clipboard.writeText(text);
    elements.statusMessage.textContent = "Guidance copied.";
  }

  /** Fetches content for a library item. @param {object} item Guidance item. @returns {Promise<string>} Source content. */
  async function fetchItemContent(item) {
    const response = await fetch(item.path);
    if (!response.ok) throw new Error(`Could not load ${item.path}`);
    return response.text();
  }

  /** Adds a skill package and every manifest-listed support file to an archive. @param {JSZip} archive ZIP archive. @param {object} item Skill item. @returns {Promise<void>} */
  async function addSkillToArchive(archive, item) {
    const directories = Object.entries(state.manifest.skills).filter(([directory]) => directory === item.source || directory.startsWith(`${item.source}/`));
    await Promise.all(directories.flatMap(([directory, files]) => files.map(async filename => {
      const path = `skills/${directory}/${filename}`;
      const response = await fetch(path);
      if (!response.ok) throw new Error(`Could not load ${path}`);
      archive.file(`${workspace().skillPath}/${directory}/${filename}`, await response.text());
    })));
  }

  /** Downloads selected guidance in the current workspace format. @returns {Promise<void>} */
  async function downloadSelection() {
    if (!window.JSZip) throw new Error("The archive library did not load.");
    const items = state.items.filter(item => state.selected.has(item.id));
    const archive = new window.JSZip();
    elements.downloadSelection.disabled = true;
    elements.statusMessage.textContent = "Building selected guidance ZIP...";
    try {
      for (const item of items) {
        if (item.type === "skill") {
          await addSkillToArchive(archive, item);
        } else {
          const content = await fetchItemContent(item);
          const path = state.workspace === "copilot" ? `${workspace().rulePath}/${item.source.replace(/\.md$/, ".instructions.md")}` : `${workspace().rulePath}/${item.source}`;
          archive.file(path, state.workspace === "copilot" ? toCopilotInstruction(item.source, content) : content);
        }
      }
      archive.file("README.txt", `Generated by AI Setup Desk\nWorkspace: ${workspace().name}\nSelected items:\n${items.map(item => `- ${item.name}`).join("\n")}\n`);
      const blob = await archive.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${state.workspace}-servicenow-guidance.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
      elements.statusMessage.textContent = "Selected guidance ZIP downloaded.";
    } finally {
      renderSelection();
    }
  }

  document.querySelectorAll('input[name="workspace"]').forEach(input => input.addEventListener("change", event => {
    state.workspace = event.target.value;
    renderWorkspace();
    renderSelection();
  }));
  elements.searchInput.addEventListener("input", applyFilters);
  elements.typeFilters.addEventListener("click", event => {
    const button = event.target.closest("button[data-type]");
    if (button) setCatalogFilter(button.dataset.type);
  });
  elements.addOfflineStarter.addEventListener("click", addOfflineStarter);
  elements.guidanceList.addEventListener("click", event => {
    const button = event.target.closest("button[data-id]");
    if (button) openItem(button.dataset.id);
  });
  elements.guidanceDetail.addEventListener("click", event => {
    const action = event.target.closest("button[data-action]")?.dataset.action;
    if (!action || !state.active) return;
    if (action === "copy") fetchItemContent(state.active).then(copyText).catch(error => { elements.statusMessage.textContent = error.message; });
    else if (action === "select") {
      state.selected.has(state.active.id) ? state.selected.delete(state.active.id) : state.selected.add(state.active.id);
      renderSelection();
      openItem(state.active.id);
    } else if (action === "download") {
      state.selected.add(state.active.id);
      renderSelection();
      downloadSelection().catch(error => { elements.statusMessage.textContent = error.message; });
    }
  });
  elements.downloadSelection.addEventListener("click", () => downloadSelection().catch(error => { elements.statusMessage.textContent = error.message; }));
  elements.clearSelection.addEventListener("click", () => {
    state.selected.clear();
    renderSelection();
    if (state.active) openItem(state.active.id);
  });

  renderWorkspace();
  renderSelection();
  loadLibrary().catch(error => {
    elements.libraryCount.textContent = "Library unavailable";
    elements.guidanceList.innerHTML = `<p class="empty-copy">${escapeHtml(error.message)}</p>`;
  });
})();
