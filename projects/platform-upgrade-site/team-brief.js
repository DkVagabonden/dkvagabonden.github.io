(() => {
  "use strict";

  const STORAGE_KEY = "platform-upgrade-team-brief-v1";
  const elements = Object.fromEntries([
    "teamBriefOpen", "teamBriefCount", "teamBriefDialog", "closeTeamBrief", "copyTeamBrief", "clearTeamBrief", "teamBriefStatus", "teamBriefItems", "teamBriefText"
  ].map(id => [id, document.getElementById(id)]));

  function readItems() {
    try {
      const items = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Array.isArray(items) ? items.filter(item => item && typeof item.id === "string" && typeof item.title === "string") : [];
    } catch { return []; }
  }

  const state = { items: readItems() };

  function safeUrl(value) {
    return /^https:\/\//i.test(String(value || "")) ? String(value) : "";
  }

  function itemId(kind, slug, title) {
    return `${kind}::${slug}::${String(title || "").trim().toLocaleLowerCase()}`;
  }

  function normalizedItem(input) {
    const kind = input.kind === "feature" ? "feature" : "area";
    const slug = String(input.slug || "").trim();
    const title = String(input.title || "").trim();
    if (!slug || !title) return null;
    return {
      id: itemId(kind, slug, title),
      kind,
      slug,
      title,
      product: String(input.product || "").trim(),
      summary: String(input.summary || "").replace(/\s+/g, " ").trim().slice(0, 1200),
      url: safeUrl(input.url),
      addedAt: input.addedAt || new Date().toISOString()
    };
  }

  function saveItems() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
      return true;
    } catch {
      elements.teamBriefStatus.textContent = "Browser storage is full. Remove a few items or copy the brief now.";
      return false;
    }
  }

  function briefMarkdown() {
    if (!state.items.length) return "# Zurich-to-Brazil team review\n\nNo release-note items have been saved yet.";
    const entries = state.items.map(item => {
      const url = item.url || `${location.origin}${location.pathname}#brazil/${encodeURIComponent(item.slug)}`;
      const title = item.title.replace(/([\\\[\]])/g, "\\$1");
      const area = item.product ? ` (${item.product})` : "";
      const summary = item.summary ? `\n  - ${item.summary}` : "";
      return `- [${title}](${url})${area}${summary}`;
    });
    return `# Zurich-to-Brazil team review\n\nPlease review these release-note items for our instance:\n\n${entries.join("\n")}`;
  }

  function button(text, className, attributes = {}) {
    const node = document.createElement("button");
    node.type = "button";
    node.className = className;
    node.textContent = text;
    Object.entries(attributes).forEach(([key, value]) => { node.dataset[key] = value; });
    return node;
  }

  function render() {
    elements.teamBriefCount.textContent = String(state.items.length);
    elements.teamBriefText.value = briefMarkdown();
    elements.teamBriefItems.replaceChildren();
    if (!state.items.length) {
      const empty = document.createElement("li");
      empty.className = "team-brief-empty";
      empty.textContent = "Nothing saved yet. Add a release-note area or an individual feature from the reader.";
      elements.teamBriefItems.append(empty);
    }
    for (const item of state.items) {
      const entry = document.createElement("li");
      entry.className = "team-brief-item";
      const title = document.createElement("strong");
      title.textContent = item.title;
      const area = document.createElement("small");
      area.textContent = `${item.kind === "feature" ? "Feature" : "Release-note area"}${item.product ? ` · ${item.product}` : ""}`;
      entry.append(title, area);
      if (item.summary) {
        const summary = document.createElement("p");
        summary.textContent = item.summary;
        entry.append(summary);
      }
      if (item.url) {
        const source = document.createElement("a");
        source.href = item.url;
        source.target = "_blank";
        source.rel = "noopener noreferrer";
        source.textContent = "ServiceNow source ↗";
        entry.append(source);
      }
      const actions = document.createElement("div");
      actions.className = "team-brief-item-actions";
      actions.append(
        button("Open note", "team-brief-open", { teamBriefOpen: item.slug }),
        button("Remove", "team-brief-remove", { teamBriefRemove: item.id })
      );
      entry.append(actions);
      elements.teamBriefItems.append(entry);
    }
    const saved = new Set(state.items.map(item => item.id));
    document.querySelectorAll("[data-team-brief-add]").forEach(control => {
      const id = itemId(control.dataset.teamBriefAdd, control.dataset.noteSlug, control.dataset.briefTitle);
      const isSaved = saved.has(id);
      control.disabled = isSaved;
      control.textContent = isSaved ? "Added to team brief" : control.dataset.teamBriefAdd === "feature" ? "Save feature for team" : "Save area for team";
    });
  }

  function addItem(input) {
    const item = normalizedItem(input);
    if (!item) return;
    if (!state.items.some(existing => existing.id === item.id)) {
      state.items = [...state.items, item];
      saveItems();
    }
    render();
    elements.teamBriefStatus.textContent = "Saved to this browser's team brief.";
  }

  async function copyBrief() {
    const text = briefMarkdown();
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard is unavailable.");
      await navigator.clipboard.writeText(text);
      elements.teamBriefStatus.textContent = `Copied ${state.items.length} ${state.items.length === 1 ? "item" : "items"} as Markdown.`;
    } catch {
      elements.teamBriefText.focus();
      elements.teamBriefText.select();
      const copied = document.execCommand?.("copy");
      elements.teamBriefStatus.textContent = copied
        ? `Copied ${state.items.length} ${state.items.length === 1 ? "item" : "items"} as Markdown.`
        : "Brief selected. Copy it with Ctrl+C or Command+C.";
    }
  }

  function clearBrief() {
    if (!state.items.length) return;
    if (!window.confirm("Remove every item from the team brief?")) return;
    state.items = [];
    saveItems();
    elements.teamBriefStatus.textContent = "Team brief cleared.";
    render();
  }

  document.addEventListener("click", event => {
    const add = event.target.closest("[data-team-brief-add]");
    const open = event.target.closest("[data-team-brief-open]");
    const remove = event.target.closest("[data-team-brief-remove]");
    if (add) {
      const product = document.querySelector(`[data-product="${CSS.escape(add.dataset.noteSlug)}"]`);
      addItem({
        kind: add.dataset.teamBriefAdd,
        slug: add.dataset.noteSlug,
        title: add.dataset.briefTitle,
        product: document.querySelector("#currentProductMetric")?.textContent || product?.textContent || "",
        summary: add.dataset.briefSummary,
        url: add.dataset.briefUrl
      });
    } else if (open) {
      elements.teamBriefDialog.close();
      window.dispatchEvent(new CustomEvent("platform-note-open", { detail: { slug: open.dataset.teamBriefOpen } }));
    } else if (remove) {
      state.items = state.items.filter(item => item.id !== remove.dataset.teamBriefRemove);
      saveItems();
      elements.teamBriefStatus.textContent = "Item removed from the brief.";
      render();
    }
  });

  elements.teamBriefOpen.addEventListener("click", () => {
    render();
    elements.teamBriefDialog.showModal();
  });
  elements.closeTeamBrief.addEventListener("click", () => elements.teamBriefDialog.close());
  elements.copyTeamBrief.addEventListener("click", copyBrief);
  elements.clearTeamBrief.addEventListener("click", clearBrief);
  elements.teamBriefDialog.addEventListener("click", event => {
    if (event.target === elements.teamBriefDialog) elements.teamBriefDialog.close();
  });
  window.addEventListener("platform-team-brief-restore", event => {
    if (!Array.isArray(event.detail?.items)) return;
    state.items = event.detail.items.map(normalizedItem).filter(Boolean);
    saveItems();
    render();
    elements.teamBriefStatus.textContent = `Restored ${state.items.length} brief items.`;
  });

  render();
})();