(() => {
  "use strict";

  /**
   * @typedef {Object} PluginRecord
   * @property {string} name
   * @property {string} scope
   * @property {string} version
   * @property {string} [latest_version]
   * @property {string} [short_description]
   * @property {string} [source]
   */

  /**
   * @typedef {Object} VersionRecord
   * @property {string} name
   * @property {string} scope
   * @property {string} version
   * @property {string} [publish_date]
   * @property {string} [dependencies]
   * @property {string} [compatibilities]
   * @property {string} [short_description]
   */

  /**
   * @typedef {Object} Review
   * @property {string} recommendation
   * @property {string} impact
   * @property {string} decision
   * @property {string} owner
   * @property {string} notes
   * @property {string} action
   * @property {boolean} teamRequired
   * @property {string} updatedAt
   */

  const STORAGE_KEY = "plugin-update-desk-reviews-v1";
  const SELECTION_STORAGE_KEY = "plugin-update-desk-selections-v1";
  const SETTINGS_STORAGE_KEY = "plugin-update-desk-settings-v1";
  const DATASET_DB_NAME = "plugin-update-desk-data";
  const DATASET_STORE_NAME = "datasets";
  const DEFAULT_FAMILY_RELEASES = ["Zurich", "Australia", "Brazil"];
  const PAGE_SIZE = 30;
  const labels = {
    impact: { unassessed: "Not assessed", low: "Low", medium: "Medium", high: "High" },
    decision: { review: "Not reviewed", ready: "Ready", hold: "On hold", blocker: "Show stopper" },
    recommendation: { unassessed: "Not assessed", must: "Must update", should: "Should update", can: "Can update", do_not: "Do not update" }
  };

  const state = {
    plugins: [],
    installedRecords: [],
    versionRecords: [],
    versionsByScope: new Map(),
    reviews: loadReviews(),
    selectedVersions: loadSelections(),
    familyReleases: loadFamilyReleases(),
    filtered: [],
    page: 1,
    activeSource: null,
    activeVersion: null
  };

  const elements = Object.fromEntries([
    "csvInput", "importButton", "versionsInput", "importVersionsButton", "reviewInput", "importReviewButton", "exportInstalledButton", "exportVersionsButton", "exportButton", "clearInstalledCacheButton", "clearVersionsCacheButton", "clearReviewCacheButton", "helpButton", "settingsButton", "saveStatus", "searchInput", "clearFilters", "teamOnly", "notesOnly",
    "sortSelect", "inventoryTitle", "pluginRows", "emptyState", "emptyStateTitle", "emptyStateDescription", "currentPageCount", "resultCount", "pagination", "totalCount", "updateCount", "readyCount",
    "progressText", "progressBar", "drawerBackdrop", "reviewDrawer", "closeDrawer", "drawerTitle", "drawerSource", "drawerInstalledVersion", "drawerVersionCount", "drawerUpdateStatus",
    "reviewForm", "selectedUpdateVersionField", "selectionStatus", "targetVersionField", "versionMetadata", "versionPublishDate", "versionDependencies", "familyAvailability", "versionDescription", "recommendationField", "impactField", "decisionField", "ownerField", "notesField", "actionField", "teamField", "clearReview", "settingsDialog", "settingsForm", "closeSettings", "familyReleaseList", "addFamilyRelease", "resetFamilyReleases", "settingsError", "helpDialog", "closeHelp", "toast"
  ].map(id => [id, document.getElementById(id)]));

  /** Saves a browser-local value and reports when browser storage is unavailable. @param {string} key Storage key. @param {unknown} value Value to persist. @returns {boolean} Whether the value was saved. */
  function saveLocalValue(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      elements.saveStatus.textContent = "Local storage unavailable";
      return false;
    }
  }

  /**
   * Loads persisted version reviews from local storage.
   *
   * @returns {Record<string, Review>} Saved reviews, or an empty collection when unavailable.
   */
  function loadReviews() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  /**
   * Loads persisted update-version selections from local storage.
   *
   * @returns {Record<string, string>} Selected version keyed by plugin scope.
   */
  function loadSelections() {
    try {
      return JSON.parse(localStorage.getItem(SELECTION_STORAGE_KEY)) || {};
    } catch {
      return {};
    }
  }

  /**
   * Loads configured ServiceNow family releases, falling back to the defaults.
   *
   * @returns {string[]} Family-release names.
   */
  function loadFamilyReleases() {
    try {
      const settings = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY));
      return Array.isArray(settings?.familyReleases) && settings.familyReleases.length
        ? settings.familyReleases
        : [...DEFAULT_FAMILY_RELEASES];
    } catch {
      return [...DEFAULT_FAMILY_RELEASES];
    }
  }

  /** Saves the current family-release settings and updates the visible save state. */
  function saveFamilyReleases() {
    if (saveLocalValue(SETTINGS_STORAGE_KEY, { familyReleases: state.familyReleases })) elements.saveStatus.textContent = "Saved locally";
  }

  /**
   * Opens the IndexedDB database used to cache imported datasets.
   *
   * @returns {Promise<IDBDatabase>} The ready dataset database.
   */
  function openDatasetDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATASET_DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(DATASET_STORE_NAME)) request.result.createObjectStore(DATASET_STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Reads a cached import dataset.
   *
   * @param {string} key Cache key for the dataset.
   * @returns {Promise<PluginRecord[] | VersionRecord[] | null>} Cached records, if present.
   */
  async function loadCachedDataset(key) {
    const database = await openDatasetDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(DATASET_STORE_NAME, "readonly");
      const request = transaction.objectStore(DATASET_STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result?.records || null);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => database.close();
    });
  }

  /**
   * Caches imported records for future visits.
   *
   * @param {string} key Cache key for the dataset.
   * @param {PluginRecord[] | VersionRecord[]} records Imported records to persist.
   * @returns {Promise<void>}
   */
  async function saveCachedDataset(key, records) {
    const database = await openDatasetDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(DATASET_STORE_NAME, "readwrite");
      transaction.objectStore(DATASET_STORE_NAME).put({ records, savedAt: new Date().toISOString() }, key);
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error);
      };
    });
  }

  /**
   * Removes a cached import dataset.
   *
   * @param {string} key Cache key for the dataset.
   * @returns {Promise<void>}
   */
  async function deleteCachedDataset(key) {
    const database = await openDatasetDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(DATASET_STORE_NAME, "readwrite");
      transaction.objectStore(DATASET_STORE_NAME).delete(key);
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error);
      };
    });
  }

  /**
   * Parses RFC 4180-style CSV text, including quoted commas and escaped quotes.
   *
   * @param {string} text CSV source text.
   * @returns {Record<string, string>[]} Rows keyed by normalized column header.
   */
  function parseCsvRows(text) {
    const rows = [];
    let row = [];
    let value = "";
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (character === '"') {
        if (quoted && text[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (character === "," && !quoted) {
        row.push(value);
        value = "";
      } else if ((character === "\n" || character === "\r") && !quoted) {
        if (character === "\r" && text[index + 1] === "\n") index += 1;
        row.push(value);
        if (row.some(cell => cell.trim())) rows.push(row);
        row = [];
        value = "";
      } else {
        value += character;
      }
    }
    row.push(value);
    if (row.some(cell => cell.trim())) rows.push(row);

    const headers = rows.shift()?.map(header => header.trim().toLowerCase()) || [];
    return rows.map(cells => Object.fromEntries(headers.map((header, index) => [header, (cells[index] || "").trim()])));
  }

  /**
   * Validates and normalizes an installed-app export.
   *
   * @param {string} text Installed-app CSV source text.
   * @returns {PluginRecord[]} Normalized installed plugin records.
   * @throws {Error} When required CSV columns are missing.
   */
  function parseStoreCsv(text) {
    const records = parseCsvRows(text);
    const headers = Object.keys(records[0] || {});
    const required = ["name", "scope", "version", "latest_version"];
    if (!required.every(header => headers.includes(header))) {
      throw new Error("CSV must contain name, scope, version, and latest_version columns.");
    }

    return records
      .filter(plugin => plugin.scope)
      .map(plugin => ({ ...plugin, name: plugin.name.replace(/^'/, ""), source: plugin.scope }));
  }

  /**
   * Validates and normalizes an app-version export.
   *
   * @param {string} text App-version CSV source text.
   * @returns {VersionRecord[]} Normalized available-version records.
   * @throws {Error} When required CSV columns are missing.
   */
  function parseVersionCsv(text) {
    const records = parseCsvRows(text);
    const headers = Object.keys(records[0] || {});
    if (!["name", "scope", "version"].every(header => headers.includes(header))) {
      throw new Error("CSV must contain name, scope, and version columns.");
    }
    return records.filter(record => record.scope && record.version).map(record => ({ ...record, name: record.name.replace(/^'/, "") }));
  }

  /**
   * Compares dotted or hyphenated version strings in ascending order.
   *
   * @param {string} left First version.
   * @param {string} right Second version.
   * @returns {number} A negative, zero, or positive comparison result.
   */
  function compareVersions(left, right) {
    const leftParts = String(left).split(/[.-]/);
    const rightParts = String(right).split(/[.-]/);
    const length = Math.max(leftParts.length, rightParts.length);
    for (let index = 0; index < length; index += 1) {
      const leftPart = leftParts[index] || "0";
      const rightPart = rightParts[index] || "0";
      const leftNumber = /^\d+$/.test(leftPart) ? Number(leftPart) : null;
      const rightNumber = /^\d+$/.test(rightPart) ? Number(rightPart) : null;
      if (leftNumber !== null && rightNumber !== null && leftNumber !== rightNumber) return leftNumber - rightNumber;
      if (leftPart !== rightPart) return leftPart.localeCompare(rightPart, undefined, { numeric: true });
    }
    return 0;
  }

  /**
   * Returns the newer available versions for an installed plugin.
   *
   * @param {PluginRecord} plugin Installed plugin.
   * @returns {VersionRecord[]} Available versions, newest first.
   */
  function availableVersions(plugin) {
    return state.versionsByScope.get(plugin.scope) || [];
  }

  /**
   * Determines whether an installed plugin has a newer available version.
   *
   * @param {PluginRecord} plugin Installed plugin.
   * @returns {boolean} Whether the plugin has an update candidate.
   */
  function needsUpdate(plugin) {
    return availableVersions(plugin).length > 0;
  }

  /**
   * Creates the storage key for a plugin-version review.
   *
   * @param {string} source Plugin scope.
   * @param {string} version Reviewed version.
   * @returns {string} Stable review key.
   */
  function reviewKey(source, version) {
    return `${source}::${version}`;
  }

  /**
   * Gets a version review, including a compatible legacy scope-level review.
   *
   * @param {string} source Plugin scope.
   * @param {string} version Reviewed version.
   * @returns {Review} Saved or default review state.
   */
  function reviewFor(source, version) {
    const versions = state.versionsByScope.get(source) || [];
    const legacyApplies = !versions.length || versions[0].version === version;
    const saved = state.reviews[reviewKey(source, version)] || (legacyApplies ? state.reviews[source] : null);
    return { recommendation: "unassessed", impact: "unassessed", decision: "review", owner: "", notes: "", action: "", teamRequired: false, updatedAt: "", ...saved };
  }

  /**
   * Collects reviews for every available version of a plugin.
   *
   * @param {PluginRecord} plugin Installed plugin.
   * @returns {Review[]} Version reviews.
   */
  function reviewsFor(plugin) {
    const versions = availableVersions(plugin);
    return versions.length ? versions.map(record => reviewFor(plugin.source, record.version)) : [reviewFor(plugin.source, plugin.version)];
  }

  /**
   * Selects the highest-priority review for table-level display.
   *
   * @param {PluginRecord} plugin Installed plugin.
   * @returns {Review} Summary review.
   */
  function summaryReview(plugin) {
    const recommendationOrder = { must: 0, do_not: 1, should: 2, unassessed: 3, can: 4 };
    return reviewsFor(plugin).sort((left, right) => recommendationOrder[left.recommendation] - recommendationOrder[right.recommendation])[0];
  }

  /**
   * Counts available versions that still need a decision.
   *
   * @param {PluginRecord} plugin Installed plugin.
   * @returns {number} Pending version-review count.
   */
  function remainingReviewCount(plugin) {
    return availableVersions(plugin).filter(record => reviewFor(plugin.source, record.version).decision === "review").length;
  }

  /** Saves reviews to local storage and updates the visible save state. */
  function saveReviews() {
    if (saveLocalValue(STORAGE_KEY, state.reviews)) elements.saveStatus.textContent = "Saved locally";
  }

  /** Saves update-version selections to local storage and updates the visible save state. */
  function saveSelections() {
    if (saveLocalValue(SELECTION_STORAGE_KEY, state.selectedVersions)) elements.saveStatus.textContent = "Saved locally";
  }

  /**
   * Escapes text before interpolating it into generated markup.
   *
   * @param {unknown} value Value to encode.
   * @returns {string} HTML-safe text.
   */
  function escapeHtml(value) {
    const node = document.createElement("div");
    node.textContent = String(value || "");
    return node.innerHTML;
  }

  /**
   * Returns values for selected checkbox filters in a named input group.
   *
   * @param {string} name Checkbox group name.
   * @returns {string[]} Selected values.
   */
  function selectedValues(name) {
    return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(input => input.value);
  }

  /** Filters, sorts, paginates, and renders the current plugin inventory. */
  function applyFilters() {
    const query = elements.searchInput.value.trim().toLowerCase();
    const impacts = selectedValues("impact");
    const decisions = selectedValues("decision");
    const updateStatuses = selectedValues("updateStatus");
    const recommendations = selectedValues("recommendation");

    state.filtered = state.plugins.filter(plugin => {
      const reviews = reviewsFor(plugin);
      const updateStatus = needsUpdate(plugin) ? "update" : "current";
      const hasReviewFilters = recommendations.length || impacts.length || decisions.length || elements.teamOnly.checked || elements.notesOnly.checked;
      const searchable = `${plugin.name} ${plugin.scope} ${plugin.short_description}`.toLowerCase();
      return (!query || searchable.includes(query))
        && (!updateStatuses.length || updateStatuses.includes(updateStatus))
        && (!hasReviewFilters || needsUpdate(plugin))
        && (!recommendations.length || needsUpdate(plugin) && reviews.some(review => recommendations.includes(review.recommendation)))
        && (!impacts.length || reviews.some(review => impacts.includes(review.impact)))
        && (!decisions.length || reviews.some(review => decisions.includes(review.decision)))
        && (!elements.teamOnly.checked || reviews.some(review => review.teamRequired))
        && (!elements.notesOnly.checked || reviews.some(review => review.notes.trim()));
    });

    const impactOrder = { high: 0, medium: 1, low: 2, unassessed: 3 };
    const decisionOrder = { blocker: 0, hold: 1, review: 2, ready: 3 };
    const recommendationOrder = { must: 0, do_not: 1, should: 2, unassessed: 3, can: 4 };
    state.filtered.sort((left, right) => {
      const leftReview = summaryReview(left);
      const rightReview = summaryReview(right);
      if (elements.sortSelect.value === "name") return left.name.localeCompare(right.name);
      if (elements.sortSelect.value === "recommendation") return recommendationOrder[leftReview.recommendation] - recommendationOrder[rightReview.recommendation] || left.name.localeCompare(right.name);
      if (elements.sortSelect.value === "decision") return decisionOrder[leftReview.decision] - decisionOrder[rightReview.decision] || left.name.localeCompare(right.name);
      if (elements.sortSelect.value === "updated") return (rightReview.updatedAt || "").localeCompare(leftReview.updatedAt || "") || left.name.localeCompare(right.name);
      return Number(needsUpdate(right)) - Number(needsUpdate(left)) || recommendationOrder[leftReview.recommendation] - recommendationOrder[rightReview.recommendation] || impactOrder[leftReview.impact] - impactOrder[rightReview.impact] || decisionOrder[leftReview.decision] - decisionOrder[rightReview.decision] || left.name.localeCompare(right.name);
    });

    const pageCount = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
    state.page = Math.min(state.page, pageCount);
    renderTable();
  }

  /** Renders the current page of filtered plugin inventory rows and summary values. */
  function renderTable() {
    const start = (state.page - 1) * PAGE_SIZE;
    const plugins = state.filtered.slice(start, start + PAGE_SIZE);
    elements.pluginRows.innerHTML = plugins.map(plugin => {
      const versions = availableVersions(plugin);
      const versionReviews = reviewsFor(plugin);
      const remainingReviews = versions.length ? versionReviews.filter(item => item.decision === "review").length : 0;
      const review = summaryReview(plugin);
      return `<tr data-source="${escapeHtml(plugin.source)}" data-reviewable="${versions.length > 0}">
        <td><span class="plugin-name">${escapeHtml(plugin.name)}</span><span class="plugin-id">${escapeHtml(plugin.source)}</span></td>
        <td><span class="version-value">${escapeHtml(plugin.version || "Unknown")}</span></td>
        <td>${versions.length ? `<span class="version-count">${versions.length} ${versions.length === 1 ? "version" : "versions"}</span><span class="update-label ${remainingReviews ? "update" : "current"}">${remainingReviews ? `${remainingReviews} pending` : "All versions reviewed"}</span>` : `<span class="update-label current">Up to date</span>`}</td>
        <td>${versions.length ? `<span class="pill recommendation-${review.recommendation}">${labels.recommendation[review.recommendation]}</span>` : `<span class="not-applicable">Not applicable</span>`}</td>
        <td>${versions.length ? `<span class="pill ${review.impact}">${labels.impact[review.impact]}</span>` : `<span class="not-applicable">Not applicable</span>`}</td>
        <td>${versions.length ? `<span class="pill ${review.decision}">${labels.decision[review.decision]}</span>` : `<span class="not-applicable">Not applicable</span>`}</td>
        <td>${versions.length ? `<span class="${review.owner ? "" : "owner-empty"}">${escapeHtml(review.owner || "Unassigned")}</span>` : `<span class="not-applicable">Not applicable</span>`}</td>
        <td><button class="row-open" type="button" aria-label="${versions.length ? `Review ${escapeHtml(plugin.name)}` : `${escapeHtml(plugin.name)} is up to date`}" ${versions.length ? "" : "disabled"}>›</button></td>
      </tr>`;
    }).join("");

    const hasInventory = state.plugins.length > 0;
    elements.emptyState.hidden = state.filtered.length !== 0;
    elements.emptyStateTitle.textContent = hasInventory ? "No plugins match these filters" : "Import plugin exports to begin";
    elements.emptyStateDescription.textContent = hasInventory
      ? "Reset filters or import a different instance export."
      : "Use Import to add installed apps and app versions from your ServiceNow instance.";
    elements.currentPageCount.textContent = `Showing ${plugins.length.toLocaleString()} ${plugins.length === 1 ? "row" : "rows"}`;
    elements.resultCount.textContent = `${state.filtered.length.toLocaleString()} of ${state.plugins.length.toLocaleString()} plugins`;
    renderPagination();
    renderMetrics();
  }

  /** Renders pagination controls for the filtered plugin inventory. */
  function renderPagination() {
    const pageCount = Math.max(1, Math.ceil(state.filtered.length / PAGE_SIZE));
    if (pageCount === 1) {
      elements.pagination.innerHTML = "";
      return;
    }
    const pages = [...new Set([1, state.page - 1, state.page, state.page + 1, pageCount])].filter(page => page >= 1 && page <= pageCount).sort((a, b) => a - b);
    let previous = 0;
    const pageButtons = pages.map(page => {
      const gap = page - previous > 1 ? "<span>…</span>" : "";
      previous = page;
      return `${gap}<button type="button" data-page="${page}" class="${page === state.page ? "active" : ""}" aria-label="Page ${page}">${page}</button>`;
    }).join("");
    elements.pagination.innerHTML = `<button type="button" data-page="${state.page - 1}" ${state.page === 1 ? "disabled" : ""} aria-label="Previous page">‹</button>${pageButtons}<button type="button" data-page="${state.page + 1}" ${state.page === pageCount ? "disabled" : ""} aria-label="Next page">›</button>`;
  }

  /** Recalculates and renders installed, update, ready, and progress metrics. */
  function renderMetrics() {
    const updatePlugins = state.plugins.filter(needsUpdate);
    const pendingPlugins = updatePlugins.filter(plugin => remainingReviewCount(plugin) > 0);
    const completed = updatePlugins.length - pendingPlugins.length;
    const percent = updatePlugins.length ? Math.round(completed / updatePlugins.length * 100) : 0;
    elements.totalCount.textContent = state.plugins.length.toLocaleString();
    elements.updateCount.textContent = updatePlugins.length.toLocaleString();
    elements.readyCount.textContent = updatePlugins.filter(plugin => state.selectedVersions[plugin.source]).length.toLocaleString();
    elements.progressText.textContent = `${percent}%`;
    elements.progressBar.style.width = `${percent}%`;
  }

  /**
   * Opens the review drawer for a plugin that has available updates.
   *
   * @param {string} source Plugin scope.
   * @returns {void}
   */
  function openDrawer(source) {
    const plugin = state.plugins.find(item => item.source === source);
    if (!plugin || !needsUpdate(plugin)) return;
    const versions = availableVersions(plugin);
    state.activeSource = source;
    elements.drawerTitle.textContent = plugin.name;
    elements.drawerSource.textContent = plugin.source;
    elements.drawerInstalledVersion.textContent = plugin.version || "Unknown";
    elements.drawerVersionCount.textContent = versions.length.toLocaleString();
    elements.drawerUpdateStatus.textContent = versions.length ? "Updates available" : "Up to date";
    elements.drawerUpdateStatus.className = `pill ${needsUpdate(plugin) ? "update" : "current"}`;
    const choices = versions.length ? versions : [{ version: plugin.version, short_description: plugin.short_description }];
    elements.selectedUpdateVersionField.innerHTML = `<option value="">Not selected</option>${versions.map(record => `<option value="${escapeHtml(record.version)}">${escapeHtml(record.version)}</option>`).join("")}`;
    refreshSelectionControl(plugin);
    elements.targetVersionField.innerHTML = choices.map(record => `<option value="${escapeHtml(record.version)}">${escapeHtml(record.version)}${versions.length ? "" : " (installed)"}</option>`).join("");
    elements.targetVersionField.disabled = !versions.length;
    state.activeVersion = choices[0].version;
    loadActiveVersion();
    elements.drawerBackdrop.hidden = false;
    elements.reviewDrawer.classList.add("open");
    elements.reviewDrawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    elements.closeDrawer.focus();
  }

  /** Loads the selected version's metadata and review into the open drawer. */
  function loadActiveVersion() {
    const plugin = state.plugins.find(item => item.source === state.activeSource);
    if (!plugin) return;
    state.activeVersion = elements.targetVersionField.value;
    const versionRecord = availableVersions(plugin).find(record => record.version === state.activeVersion);
    const review = reviewFor(plugin.source, state.activeVersion);
    elements.versionMetadata.hidden = !versionRecord;
    elements.versionPublishDate.textContent = versionRecord?.publish_date || "Unknown";
    elements.versionDependencies.textContent = versionRecord?.dependencies || "None listed";
    const compatibleFamilies = new Set((versionRecord?.compatibilities || "").split(";").map(family => family.trim().toLowerCase()).filter(Boolean));
    elements.familyAvailability.innerHTML = state.familyReleases.map(family => `<span class="family-badge ${compatibleFamilies.has(family.toLowerCase()) ? "available" : ""}">${escapeHtml(family)}</span>`).join("");
    elements.versionDescription.textContent = versionRecord?.short_description || "";
    elements.recommendationField.value = versionRecord ? review.recommendation : "unassessed";
    elements.recommendationField.disabled = !versionRecord;
    elements.impactField.value = review.impact;
    elements.decisionField.value = review.decision;
    elements.ownerField.value = review.owner;
    elements.notesField.value = review.notes;
    elements.actionField.value = review.action;
    elements.teamField.checked = review.teamRequired;
  }

  /**
   * Updates target-version selection availability and explanatory status.
   *
   * @param {PluginRecord} plugin Active installed plugin.
   * @returns {void}
   */
  function refreshSelectionControl(plugin) {
    const versions = availableVersions(plugin);
    const remaining = remainingReviewCount(plugin);
    const selected = versions.some(record => record.version === state.selectedVersions[plugin.source]) ? state.selectedVersions[plugin.source] : "";
    elements.selectedUpdateVersionField.value = selected;
    elements.selectedUpdateVersionField.disabled = !versions.length;
    [...elements.selectedUpdateVersionField.options].forEach(option => {
      option.disabled = Boolean(option.value && remaining > 0);
    });
    elements.selectionStatus.textContent = !versions.length
      ? "No update target available"
      : remaining
        ? `${remaining} ${remaining === 1 ? "version decision" : "version decisions"} remaining`
        : selected
          ? `Target selected: ${selected}`
          : "All versions reviewed; select an update target";
  }

  /** Saves the selected update target after all version decisions are complete. */
  function saveSelectedVersion() {
    if (!state.activeSource || elements.selectedUpdateVersionField.disabled) return;
    const version = elements.selectedUpdateVersionField.value;
    const plugin = state.plugins.find(item => item.source === state.activeSource);
    if (plugin && version && remainingReviewCount(plugin)) {
      refreshSelectionControl(plugin);
      showToast("Complete all version decisions before selecting a target");
      return;
    }
    if (version) state.selectedVersions[state.activeSource] = version;
    else delete state.selectedVersions[state.activeSource];
    saveSelections();
    if (plugin) refreshSelectionControl(plugin);
    showToast(version ? `Update target ${version} selected` : "Update target cleared");
  }

  /** Closes the review drawer and resets the active plugin state. */
  function closeDrawer() {
    elements.reviewDrawer.classList.remove("open");
    elements.reviewDrawer.setAttribute("aria-hidden", "true");
    elements.drawerBackdrop.hidden = true;
    document.body.style.overflow = "";
    state.activeSource = null;
    state.activeVersion = null;
  }

  /**
   * Persists the active version review and refreshes the inventory.
   *
   * @param {SubmitEvent} event Review-form submission event.
   * @returns {void}
   */
  function saveActiveReview(event) {
    event.preventDefault();
    if (!state.activeSource || !state.activeVersion) return;
    state.reviews[reviewKey(state.activeSource, state.activeVersion)] = {
      recommendation: elements.recommendationField.value,
      impact: elements.impactField.value,
      decision: elements.decisionField.value,
      owner: elements.ownerField.value.trim(),
      notes: elements.notesField.value.trim(),
      action: elements.actionField.value.trim(),
      teamRequired: elements.teamField.checked,
      updatedAt: new Date().toISOString()
    };
    saveReviews();
    showToast("Plugin review saved");
    applyFilters();
    closeDrawer();
  }

  /** Removes the active version review after user confirmation. */
  function clearActiveReview() {
    if (!state.activeSource || !state.activeVersion || !window.confirm(`Clear the review for version ${state.activeVersion}?`)) return;
    delete state.reviews[reviewKey(state.activeSource, state.activeVersion)];
    saveReviews();
    showToast("Review cleared");
    applyFilters();
    closeDrawer();
  }

  /**
   * Loads installed plugins into application state and rebuilds available versions.
   *
   * @param {PluginRecord[]} plugins Installed plugin records.
   * @param {string} [message] Success message to display.
   * @returns {void}
   */
  function loadInventory(plugins, message) {
    state.installedRecords = plugins;
    const unique = new Map(plugins.map(plugin => [plugin.source, plugin]));
    state.plugins = [...unique.values()];
    rebuildVersionIndex();
    state.page = 1;
    applyFilters();
    showToast(message || `Loaded ${state.plugins.length.toLocaleString()} plugins`);
  }

  /**
   * Loads available-version records into application state.
   *
   * @param {VersionRecord[]} records Available-version records.
   * @param {string} [message] Success message to display.
   * @returns {void}
   */
  function loadVersions(records, message) {
    state.versionRecords = records;
    rebuildVersionIndex();
    state.page = 1;
    applyFilters();
    const matchedCount = [...state.versionsByScope.values()].reduce((total, versions) => total + versions.length, 0);
    showToast(message || `Matched ${matchedCount.toLocaleString()} available versions`);
  }

  /** Rebuilds the scope-indexed list of versions newer than each installed plugin. */
  function rebuildVersionIndex() {
    const installedByScope = new Map(state.plugins.map(plugin => [plugin.scope, plugin]));
    const byScope = new Map();
    state.versionRecords.forEach(record => {
      const plugin = installedByScope.get(record.scope);
      if (!plugin || compareVersions(record.version, plugin.version) <= 0) return;
      if (!byScope.has(record.scope)) byScope.set(record.scope, new Map());
      byScope.get(record.scope).set(record.version, record);
    });
    state.versionsByScope = new Map([...byScope].map(([scope, versions]) => [
      scope,
      [...versions.values()].sort((left, right) => compareVersions(right.version, left.version))
    ]));
  }

  /**
   * Imports and caches an installed-app CSV selected by the user.
   *
   * @param {File | undefined} file Selected CSV file.
   * @returns {void}
   */
  function importInventory(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const plugins = parseStoreCsv(reader.result);
        loadInventory(plugins, `Imported ${plugins.length.toLocaleString()} installed app records`);
        await saveCachedDataset("installedApps", plugins);
        showToast("Installed apps saved for future visits");
      } catch (error) {
        showToast(error.message || "Could not import this inventory");
      }
      elements.csvInput.value = "";
    };
    reader.readAsText(file);
  }

  /**
   * Imports and caches an app-version CSV selected by the user.
   *
   * @param {File | undefined} file Selected CSV file.
   * @returns {void}
   */
  function importVersions(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const versions = parseVersionCsv(reader.result);
        loadVersions(versions);
        await saveCachedDataset("appVersions", versions);
        showToast("App versions saved for future visits");
      } catch (error) {
        showToast(error.message || "Could not import these versions");
      }
      elements.versionsInput.value = "";
    };
    reader.readAsText(file);
  }

  /**
   * Restores a JSON review backup selected by the user.
   *
   * @param {File | undefined} file Selected JSON backup.
   * @returns {void}
   */
  function importReviews(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const backup = JSON.parse(reader.result);
        if (!backup.reviews || Array.isArray(backup.reviews) || typeof backup.reviews !== "object") {
          throw new Error("This is not a valid review backup.");
        }
        const entries = Object.entries(backup.reviews);
        if (!entries.every(([source, review]) => source && review && !Array.isArray(review) && typeof review === "object")) {
          throw new Error("The review backup contains invalid entries.");
        }
        if ((Object.keys(state.reviews).length || Object.keys(state.selectedVersions).length) && !window.confirm("Replace the reviews and update targets currently saved in this browser?")) return;
        state.reviews = backup.reviews;
        state.selectedVersions = backup.selectedVersions && !Array.isArray(backup.selectedVersions) && typeof backup.selectedVersions === "object" ? backup.selectedVersions : {};
        if (Array.isArray(backup.settings?.familyReleases) && backup.settings.familyReleases.length) {
          state.familyReleases = backup.settings.familyReleases;
          saveFamilyReleases();
        }
        saveReviews();
        saveSelections();
        state.page = 1;
        applyFilters();
        showToast(`Restored ${entries.length.toLocaleString()} ${entries.length === 1 ? "review" : "reviews"}`);
      } catch (error) {
        showToast(error.message || "Could not import this review backup");
      } finally {
        elements.reviewInput.value = "";
      }
    };
    reader.readAsText(file);
  }

  /** Closes every open import, export, and cache action menu. */
  function closeActionMenus() {
    document.querySelectorAll(".action-menu[open]").forEach(menu => { menu.open = false; });
  }

  /**
   * Adds an editable family-release row to the settings dialog.
   *
   * @param {string} [value] Initial family-release name.
   * @returns {void}
   */
  function addFamilyReleaseRow(value = "") {
    const row = document.createElement("div");
    row.className = "family-release-row";
    row.innerHTML = `<input type="text" value="${escapeHtml(value)}" aria-label="Family release name" placeholder="For example: Brazil"><button type="button" aria-label="Remove ${escapeHtml(value || "family release")}">&times;</button>`;
    elements.familyReleaseList.appendChild(row);
    if (!value) row.querySelector("input").focus();
  }

  /**
   * Renders family-release settings and clears a prior validation error.
   *
   * @param {string[]} [releases] Family releases to render.
   * @returns {void}
   */
  function renderFamilyReleaseSettings(releases = state.familyReleases) {
    elements.familyReleaseList.innerHTML = "";
    releases.forEach(addFamilyReleaseRow);
    elements.settingsError.hidden = true;
    elements.settingsError.textContent = "";
  }

  /** Opens the family-release settings dialog. */
  function openSettings() {
    closeActionMenus();
    renderFamilyReleaseSettings();
    elements.settingsDialog.showModal();
  }

  /** Closes the family-release settings dialog. */
  function closeSettings() {
    elements.settingsDialog.close();
  }

  /** Opens the Plugin Update Desk instructions dialog. */
  function openHelp() {
    closeActionMenus();
    elements.helpDialog.showModal();
  }

  /** Closes the Plugin Update Desk instructions dialog. */
  function closeHelp() {
    elements.helpDialog.close();
  }

  /**
   * Validates and saves the configured family releases.
   *
   * @param {SubmitEvent} event Settings-form submission event.
   * @returns {void}
   */
  function saveSettings(event) {
    event.preventDefault();
    const releases = [...elements.familyReleaseList.querySelectorAll("input")].map(input => input.value.trim()).filter(Boolean);
    const normalized = releases.map(release => release.toLowerCase());
    if (!releases.length) {
      elements.settingsError.textContent = "Add at least one family release.";
      elements.settingsError.hidden = false;
      return;
    }
    if (new Set(normalized).size !== normalized.length) {
      elements.settingsError.textContent = "Family release names must be unique.";
      elements.settingsError.hidden = false;
      return;
    }
    state.familyReleases = releases;
    saveFamilyReleases();
    if (state.activeSource) loadActiveVersion();
    closeSettings();
    showToast("Settings saved");
  }

  /**
   * Serializes records as formula-safe CSV text.
   *
   * @param {Record<string, unknown>[]} records Records to export.
   * @returns {string} CSV text.
   */
  function serializeCsv(records) {
    if (!records.length) return "";
    const headers = Object.keys(records[0]);
    const encode = value => {
      let text = String(value ?? "");
      if (/^[=+\-@]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    return [headers.map(encode).join(","), ...records.map(record => headers.map(header => encode(record[header])).join(","))].join("\r\n");
  }

  /**
   * Triggers a browser download for generated content.
   *
   * @param {string} content File contents.
   * @param {string} type MIME type.
   * @param {string} filename Download filename.
   * @returns {void}
   */
  function downloadFile(content, type, filename) {
    const blob = new Blob([content], { type });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  /**
   * Exports a dataset when it contains records.
   *
   * @param {Record<string, unknown>[]} records Dataset records.
   * @param {string} filename Download filename.
   * @param {string} label Display label.
   * @returns {void}
   */
  function exportDataset(records, filename, label) {
    closeActionMenus();
    if (!records.length) {
      showToast(`No ${label.toLowerCase()} to export`);
      return;
    }
    downloadFile(serializeCsv(records), "text/csv;charset=utf-8", filename);
    showToast(`${label} exported`);
  }

  /** Exports reviews, update targets, and family settings as a JSON backup. */
  function exportReviews() {
    closeActionMenus();
    const reviewedSources = Object.keys(state.reviews);
    const payload = {
      exportedAt: new Date().toISOString(),
      pluginCount: state.plugins.length,
      reviewedCount: reviewedSources.length,
      reviews: state.reviews,
      selectedVersions: state.selectedVersions,
      settings: { familyReleases: state.familyReleases }
    };
    downloadFile(JSON.stringify(payload, null, 2), "application/json", `plugin-review-${new Date().toISOString().slice(0, 10)}.json`);
    showToast("Review backup exported");
  }

  /**
   * Clears a persisted import dataset after user confirmation.
   *
   * @param {string} key Cache key for the dataset.
   * @param {string} label Display label.
   * @returns {Promise<void>}
   */
  async function clearDatasetCache(key, label) {
    closeActionMenus();
    if (!window.confirm(`Clear the saved ${label.toLowerCase()} import? The current page will remain loaded.`)) return;
    try {
      await deleteCachedDataset(key);
      showToast(`${label} cache cleared`);
    } catch {
      showToast(`Could not clear ${label.toLowerCase()} cache`);
    }
  }

  /** Clears persisted reviews and selected update targets after confirmation. */
  function clearReviewCache() {
    closeActionMenus();
    if (!window.confirm("Clear all saved reviews and selected update targets?")) return;
    state.reviews = {};
    state.selectedVersions = {};
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SELECTION_STORAGE_KEY);
    if (state.activeSource) closeDrawer();
    state.page = 1;
    applyFilters();
    showToast("Review cache cleared");
  }

  /** Restores the inventory filter controls to their default values. */
  function clearFilters() {
    elements.searchInput.value = "";
    document.querySelectorAll('.filters input[type="checkbox"]').forEach(input => { input.checked = false; });
    elements.sortSelect.value = "priority";
    state.page = 1;
    applyFilters();
  }

  let toastTimer;
  /**
   * Displays a temporary status notification.
   *
   * @param {string} message Status message.
   * @returns {void}
   */
  function showToast(message) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("show");
    toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2600);
  }

  elements.importButton.addEventListener("click", () => { closeActionMenus(); elements.csvInput.click(); });
  elements.csvInput.addEventListener("change", event => importInventory(event.target.files[0]));
  elements.importVersionsButton.addEventListener("click", () => { closeActionMenus(); elements.versionsInput.click(); });
  elements.versionsInput.addEventListener("change", event => importVersions(event.target.files[0]));
  elements.importReviewButton.addEventListener("click", () => { closeActionMenus(); elements.reviewInput.click(); });
  elements.reviewInput.addEventListener("change", event => importReviews(event.target.files[0]));
  elements.exportInstalledButton.addEventListener("click", () => exportDataset(state.installedRecords, "sys_store_app.csv", "Installed apps"));
  elements.exportVersionsButton.addEventListener("click", () => exportDataset(state.versionRecords, "sys_app_version.csv", "App versions"));
  elements.exportButton.addEventListener("click", exportReviews);
  elements.clearInstalledCacheButton.addEventListener("click", () => clearDatasetCache("installedApps", "Installed apps"));
  elements.clearVersionsCacheButton.addEventListener("click", () => clearDatasetCache("appVersions", "App versions"));
  elements.clearReviewCacheButton.addEventListener("click", clearReviewCache);
  elements.helpButton.addEventListener("click", openHelp);
  elements.settingsButton.addEventListener("click", openSettings);
  elements.closeHelp.addEventListener("click", closeHelp);
  elements.closeSettings.addEventListener("click", closeSettings);
  elements.settingsForm.addEventListener("submit", saveSettings);
  elements.addFamilyRelease.addEventListener("click", () => addFamilyReleaseRow());
  elements.resetFamilyReleases.addEventListener("click", () => renderFamilyReleaseSettings(DEFAULT_FAMILY_RELEASES));
  elements.familyReleaseList.addEventListener("click", event => {
    const removeButton = event.target.closest("button");
    if (removeButton) removeButton.closest(".family-release-row").remove();
  });
  elements.settingsDialog.addEventListener("click", event => {
    if (event.target === elements.settingsDialog) closeSettings();
  });
  elements.helpDialog.addEventListener("click", event => {
    if (event.target === elements.helpDialog) closeHelp();
  });
  document.querySelectorAll(".action-menu").forEach(menu => menu.addEventListener("toggle", () => {
    if (menu.open) document.querySelectorAll(".action-menu[open]").forEach(other => { if (other !== menu) other.open = false; });
  }));
  document.addEventListener("click", event => { if (!event.target.closest(".action-menu")) closeActionMenus(); });
  elements.searchInput.addEventListener("input", () => { state.page = 1; applyFilters(); });
  elements.sortSelect.addEventListener("change", () => { state.page = 1; applyFilters(); });
  document.querySelectorAll('.filters input[type="checkbox"]').forEach(input => input.addEventListener("change", () => { state.page = 1; applyFilters(); }));
  elements.clearFilters.addEventListener("click", clearFilters);
  elements.pluginRows.addEventListener("click", event => {
    const row = event.target.closest("tr[data-source]");
    if (row?.dataset.reviewable === "true") openDrawer(row.dataset.source);
  });
  elements.pagination.addEventListener("click", event => {
    const button = event.target.closest("button[data-page]");
    if (!button || button.disabled) return;
    state.page = Number(button.dataset.page);
    renderTable();
    elements.inventoryTitle.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  elements.reviewForm.addEventListener("submit", saveActiveReview);
  elements.selectedUpdateVersionField.addEventListener("change", saveSelectedVersion);
  elements.targetVersionField.addEventListener("change", loadActiveVersion);
  elements.clearReview.addEventListener("click", clearActiveReview);
  elements.closeDrawer.addEventListener("click", closeDrawer);
  elements.drawerBackdrop.addEventListener("click", closeDrawer);
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    closeActionMenus();
    if (elements.helpDialog.open) closeHelp();
    if (elements.settingsDialog.open) closeSettings();
    if (state.activeSource) closeDrawer();
  });

  applyFilters();
})();
