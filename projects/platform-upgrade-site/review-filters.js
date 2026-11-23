(() => {
  "use strict";

  const labels = {
    recommendation: { must: "Must update", should: "Should update", can: "Can update", do_not: "Do not update", unassessed: "Not assessed" },
    impact: { high: "High", medium: "Medium", low: "Low", unassessed: "Not assessed" },
    decision: { review: "Not reviewed", ready: "Ready", hold: "On hold", blocker: "Show stopper" },
    updateStatus: { update: "Needs update", current: "Up to date", unknown: "Unknown availability" },
    type: { standalone: "Standalone", integrated: "Integrated", deprecated: "Deprecated", replaced: "Replaced", parent: "Parent plugin", unknown: "Not recorded" }
  };
  const recommendationOrder = { must: 0, do_not: 1, should: 2, can: 3, unassessed: 4 };
  const impactOrder = { high: 0, medium: 1, low: 2, unassessed: 3 };
  const decisionOrder = { blocker: 0, hold: 1, review: 2, ready: 3 };
  const defaultReview = { recommendation: "unassessed", impact: "unassessed", decision: "review", owner: "", notes: "", action: "", teamRequired: false, updatedAt: "", version: "" };

  function reviewsFor(row) {
    return row.reviews?.length ? row.reviews : [{ ...defaultReview }];
  }

  function hasAssessment(review) {
    return Boolean(review && ((review.recommendation && review.recommendation !== "unassessed") || (review.impact && review.impact !== "unassessed")));
  }

  function selectAssessment(reviews, target = "", compare = (left, right) => String(left).localeCompare(String(right), undefined, { numeric: true })) {
    const ordered = [...reviews].sort((left, right) => compare(right.version, left.version));
    const selected = ordered.find(review => review.version === target && hasAssessment(review))
      || ordered.find(hasAssessment) || ordered[0] || defaultReview;
    return { ...defaultReview, ...selected, assessed: hasAssessment(selected) };
  }

  function reviewMatches(reviews, filters) {
    return ["recommendation", "impact", "decision"].every(group => !filters[group]?.length
      || reviews.some(review => filters[group].includes(review[group] || defaultReview[group])));
  }

  function matches(row, filters = {}) {
    const query = String(filters.query || "").trim().toLocaleLowerCase();
    const reviews = reviewsFor(row);
    const selected = filters.reviewScope === "any" ? reviews : [row.summary || reviews[0]];
    return (!query || String(row.searchText || row.name || "").toLocaleLowerCase().includes(query))
      && (!filters.updateStatus?.length || filters.updateStatus.includes(row.updateStatus))
      && (!filters.type || filters.type === "all" || filters.type === (row.type || "unknown"))
      && reviewMatches(selected, filters)
      && (!filters.teamOnly || reviews.some(review => review.teamRequired === true))
      && (!filters.notesOnly || reviews.some(review => typeof review.notes === "string" && review.notes.trim()))
      && (!filters.validationOnly || reviews.some(review => typeof review.action === "string" && review.action.trim()));
  }

  function count(rows, filters, group, value) {
    return rows.filter(row => matches(row, { ...filters, [group]: value })).length;
  }

  function riskRank(row) {
    const reviews = reviewsFor(row);
    if (reviews.some(review => review.decision === "blocker" || review.recommendation === "do_not")) return 0;
    if (reviews.some(review => review.decision === "hold")) return 1;
    return row.updateStatus === "update" ? 2 : row.updateStatus === "unknown" ? 3 : 4;
  }

  function sort(rows, mode = "priority") {
    return [...rows].sort((left, right) => {
      const first = left.summary || defaultReview;
      const second = right.summary || defaultReview;
      const name = String(left.name).localeCompare(String(right.name));
      if (mode === "name") return name;
      if (mode === "recommendation") return (recommendationOrder[first.recommendation] ?? 4) - (recommendationOrder[second.recommendation] ?? 4) || name;
      if (mode === "decision") return (decisionOrder[first.decision] ?? 2) - (decisionOrder[second.decision] ?? 2) || name;
      if (mode === "updated") return (Date.parse(right.editedAt) || 0) - (Date.parse(left.editedAt) || 0) || name;
      if (mode === "versions") return (right.versionCount || 0) - (left.versionCount || 0) || name;
      if (mode === "latest") return String(right.latestVersion || "").localeCompare(String(left.latestVersion || ""), undefined, { numeric: true }) || name;
      return riskRank(left) - riskRank(right)
        || (recommendationOrder[first.recommendation] ?? 4) - (recommendationOrder[second.recommendation] ?? 4)
        || (impactOrder[first.impact] ?? 3) - (impactOrder[second.impact] ?? 3) || name;
    });
  }

  function matchedVersions(row, filters) {
    if (filters.reviewScope !== "any" || reviewMatches([row.summary || defaultReview], filters)) return [];
    return [...new Set(reviewsFor(row).filter(review => ["recommendation", "impact", "decision"]
      .some(group => filters[group]?.includes(review[group]))).map(review => review.version).filter(Boolean))];
  }

  function createWorkbench(options) {
    const root = document.getElementById(options.rootId);
    const find = selector => root.querySelector(selector);
    const search = document.getElementById(options.searchId);
    const sortControl = document.getElementById(options.sortId);
    const resetControl = document.getElementById(options.resetId);
    const controls = find("[data-review-controls]");
    const toggle = find("[data-review-toggle]");
    const scope = find("[data-review-scope]");
    const type = find("[data-review-type]");
    const facetHost = find("[data-review-facets]");
    const ownershipHost = find("[data-review-ownership]");
    const activeHost = find("[data-review-active]");
    const media = window.matchMedia("(max-width: 900px)");
    const groups = ["updateStatus", "recommendation", "impact", "decision"];
    const titles = { updateStatus: "Update status", recommendation: "Recommendation", impact: "Impact", decision: "Decision" };
    const flags = { teamOnly: "Team review required", notesOnly: "Has review notes", validationOnly: "Has validation plan" };
    const extras = (options.extras || []).map(extra => ({ ...extra, element: document.getElementById(extra.id) }));
    const inputs = new Map();
    const countNodes = [];
    const flagInputs = {};
    let expanded = false;

    function textNode(tag, text, className = "") {
      const node = document.createElement(tag);
      node.textContent = text;
      if (className) node.className = className;
      return node;
    }

    for (const group of groups) {
      const fieldset = document.createElement("fieldset");
      fieldset.append(textNode("legend", titles[group]));
      for (const [value, label] of Object.entries(labels[group])) {
        const row = document.createElement("label");
        row.className = "review-facet-option";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.name = `${options.rootId}-${group}`;
        input.value = value;
        input.dataset.reviewGroup = group;
        inputs.set(`${group}:${value}`, input);
        const dot = document.createElement("span");
        dot.className = `review-filter-dot ${value}`;
        dot.setAttribute("aria-hidden", "true");
        const tally = textNode("span", "0", "review-facet-count");
        row.append(input, dot, textNode("span", label, "review-facet-label"), tally);
        fieldset.append(row);
        countNodes.push({ group, value, node: tally });
      }
      facetHost.append(fieldset);
    }

    for (const [key, label] of Object.entries(flags)) {
      const row = document.createElement("label");
      row.className = "review-facet-option";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.dataset.reviewFlag = key;
      flagInputs[key] = input;
      const tally = textNode("span", "0", "review-facet-count");
      row.append(input, textNode("span", label, "review-facet-label"), tally);
      ownershipHost.append(row);
      countNodes.push({ group: key, value: true, node: tally });
    }

    for (const [value, label] of Object.entries(labels.type)) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      type.append(option);
    }

    function read() {
      const result = { query: search.value.trim(), type: type.value, reviewScope: scope.value };
      for (const group of groups) result[group] = [...inputs.values()].filter(input => input.dataset.reviewGroup === group && input.checked).map(input => input.value);
      for (const [key, input] of Object.entries(flagInputs)) result[key] = input.checked;
      return result;
    }

    function tokens() {
      const filters = read();
      const result = [];
      if (filters.query) result.push({ group: "query", value: filters.query, label: `Search: ${filters.query}` });
      for (const group of groups) for (const value of filters[group]) result.push({ group, value, label: `${titles[group]}: ${labels[group][value]}` });
      for (const [group, label] of Object.entries(flags)) if (filters[group]) result.push({ group, value: "true", label });
      if (filters.type !== "all") result.push({ group: "type", value: filters.type, label: `Type: ${labels.type[filters.type]}` });
      if (filters.reviewScope !== "displayed") result.push({ group: "reviewScope", value: filters.reviewScope, label: "Review match: any version" });
      for (const extra of extras) if (extra.element.value !== extra.defaultValue && extra.element.value) {
        result.push({ group: extra.id, value: extra.element.value, label: `${extra.label}: ${extra.element.selectedOptions[0]?.textContent || extra.element.value}` });
      }
      return result;
    }

    function focusFilter() {
      (media.matches ? toggle : search).focus();
    }

    function syncPanel() {
      controls.hidden = media.matches && !expanded;
      toggle.setAttribute("aria-expanded", String(!controls.hidden));
    }

    function apply(rows) {
      const filters = read();
      return sort(rows.filter(row => matches(row, filters)), sortControl.value);
    }

    function update(rows) {
      const filters = read();
      const selected = tokens();
      const buttons = [...activeHost.querySelectorAll("button")];
      const focusedIndex = buttons.indexOf(document.activeElement);
      const resetFocused = document.activeElement === resetControl;
      for (const node of root.querySelectorAll("[data-review-active-count]")) node.textContent = String(selected.length);
      resetControl.disabled = !selected.length && sortControl.value === "priority";
      if (resetFocused && resetControl.disabled) focusFilter();
      for (const entry of countNodes) entry.node.textContent = String(count(rows, filters, entry.group, groups.includes(entry.group) ? [entry.value] : entry.value));
      for (const option of type.options) option.textContent = `${labels.type[option.value] || "All types"} (${count(rows, filters, "type", option.value)})`;
      activeHost.hidden = !selected.length;
      activeHost.replaceChildren();
      for (const token of selected) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "review-filter-chip";
        button.dataset.filterGroup = token.group;
        button.dataset.filterValue = token.value;
        button.setAttribute("aria-label", `Remove ${token.label} filter`);
        const close = textNode("span", "\u00d7");
        close.setAttribute("aria-hidden", "true");
        button.append(textNode("span", token.label), close);
        activeHost.append(button);
      }
      if (focusedIndex >= 0) {
        const next = activeHost.querySelectorAll("button")[Math.min(focusedIndex, selected.length - 1)];
        if (next) next.focus();
        else focusFilter();
      }
      syncPanel();
    }

    function reset() {
      search.value = "";
      type.value = "all";
      scope.value = "displayed";
      sortControl.value = "priority";
      for (const input of inputs.values()) input.checked = false;
      for (const input of Object.values(flagInputs)) input.checked = false;
      for (const extra of extras) extra.element.value = extra.defaultValue;
      options.onChange();
      focusFilter();
    }

    search.addEventListener("input", options.onChange);
    for (const node of [facetHost, ownershipHost, type, scope, sortControl, ...extras.map(extra => extra.element)]) node.addEventListener("change", options.onChange);
    resetControl.addEventListener("click", reset);
    find("[data-review-empty-reset]")?.addEventListener("click", reset);
    toggle.addEventListener("click", () => { expanded = !expanded; syncPanel(); });
    media.addEventListener("change", syncPanel);
    activeHost.addEventListener("click", event => {
      const button = event.target.closest("[data-filter-group]");
      if (!button) return;
      const group = button.dataset.filterGroup;
      if (groups.includes(group)) inputs.get(`${group}:${button.dataset.filterValue}`).checked = false;
      else if (flagInputs[group]) flagInputs[group].checked = false;
      else if (group === "query") search.value = "";
      else if (group === "type") type.value = "all";
      else if (group === "reviewScope") scope.value = "displayed";
      else { const extra = extras.find(entry => entry.id === group); if (extra) extra.element.value = extra.defaultValue; }
      options.onChange();
    });
    syncPanel();
    return { read, apply, update, reset, focusFilter };
  }

  window.PlatformReviewFilters = { labels, hasAssessment, selectAssessment, reviewMatches, matches, count, sort, matchedVersions, createWorkbench };
})();