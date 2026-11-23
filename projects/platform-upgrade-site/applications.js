(() => {
  "use strict";

  const DB_NAME = "platform-upgrade-desk-data";
  const STORE_NAME = "datasets";
  const BRAZIL_STORE_CACHE_KEY = "brazilStoreApps";
  const REVIEW_KEY = "platform-upgrade-app-reviews-v1";
  const TARGET_KEY = "platform-upgrade-app-targets-v1";
  const NOTE_LINK_KEY = "platform-upgrade-app-note-links-v1";
  const VIEW_KEY = "platform-upgrade-active-view-v1";
  const UPGRADE_VIEW_KEY = "platform-upgrade-subview-v1";
  const PAGE_SIZE = 30;
  const labels = {
    recommendation: { unassessed: "Not assessed", must: "Must update", should: "Should update", can: "Can update", do_not: "Do not update" },
    impact: { unassessed: "Not assessed", low: "Low", medium: "Medium", high: "High" },
    decision: { review: "Not reviewed", ready: "Ready", hold: "On hold", blocker: "Show stopper" }
  };
  const state = {
    installedRecords: [], versionRecords: [], brazilStoreRecords: [], duplicateRows: 0, brazilStoreDuplicateRows: 0, apps: [], filteredApps: [],
    versionsByScope: new Map(), versionsByName: new Map(), products: [],
    reviews: readLocalObject(REVIEW_KEY), targets: readLocalObject(TARGET_KEY), noteLinks: readLocalObject(NOTE_LINK_KEY),
    activeScope: "", activeVersion: "", page: 1, restoreToken: 0, overflowBeforeDrawer: "", pluginReleaseTitle: "Application changes"
  };
  const ids = [
    "notesWorkspaceTab", "upgradePlanWorkspaceTab", "problemFixesWorkspaceTab", "notesWorkspacePanel", "upgradePlanWorkspacePanel", "applicationsModeTab", "pluginsModeTab", "applicationsWorkspacePanel", "pluginsWorkspacePanel", "problemFixesWorkspacePanel", "pageTitle", "releaseOverviewLink",
    "appInventoryInput", "appVersionsInput", "brazilStoreInput", "appPlanInput", "importAppInventory", "importAppVersions", "importBrazilStore", "importAppPlan", "exportAppPlan", "exportInstalledApps", "exportVersionCatalog", "exportBrazilStore",
    "applicationSourceStatus", "applicationMatchStatus", "brazilStoreCatalogStatus", "appTotalCount", "appUpdateCount", "appReviewedCount", "appReviewedDetail", "appUnmatchedCount", "appBrazilCatalogAdds", "brazilCatalogAdditionsPanel", "brazilCatalogAdditionsCount", "brazilCatalogAdditionRows",
    "applicationSearch", "applicationStatusFilter", "applicationReviewFilter", "applicationSort", "applicationRows", "applicationEmptyState", "applicationResultCount", "applicationPageStatus", "applicationPagination",
    "applicationDrawer", "applicationDrawerTitle", "applicationDrawerScope", "closeApplicationDrawer", "applicationReviewForm",
    "drawerAppInstalledVersion", "drawerAppVersionCount", "drawerAppMatchBadge", "appReviewVersion", "appVersionMetadata", "appVersionPublishDate", "appVersionDependencies", "appVersionCompatibility", "appVersionSource", "appVersionDescription",
    "appTargetVersion", "appTargetStatus", "appRecommendation", "appImpact", "appDecision", "appReviewOwner", "appReviewNotes", "appReviewAction", "appTeamRequired", "clearApplicationReview",
    "linkPlatformNote", "linkPlatformNoteButton", "linkedPlatformNotes"
  ];
  const elements = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
  const releaseNoteHeading = elements.pageTitle.innerHTML;
  const reviewFilters = window.PlatformReviewFilters;
  let applicationFilters = null;

  function updatePageHeading() {
    if (!elements.notesWorkspacePanel.hidden) {
      elements.pageTitle.innerHTML = releaseNoteHeading;
      elements.releaseOverviewLink.hidden = false;
    } else {
      elements.pageTitle.textContent = !elements.problemFixesWorkspacePanel.hidden ? "Problem fixes"
        : !elements.pluginsWorkspacePanel.hidden ? state.pluginReleaseTitle : "Application changes";
      elements.releaseOverviewLink.hidden = true;
    }
  }

  function readLocalObject(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value && !Array.isArray(value) && typeof value === "object" ? value : {};
    } catch {
      return {};
    }
  }

  function writeLocalObject(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      showToast("Browser storage is unavailable. Export your review plan to keep your work.");
      return false;
    }
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function cleanName(value) {
    return String(value || "").replace(/^\uFEFF/, "").trim().replace(/^'+/, "").trim();
  }

  function provided(value) {
    const text = String(value ?? "").trim();
    return /^(undefined|null|none|n\/a|\[\])$/i.test(text) ? "" : text;
  }

  function nameKey(value) {
    return cleanName(value).replace(/\s+/g, " ").toLocaleLowerCase();
  }

  function isTrue(value) { return ["true", "1", "yes"].includes(String(value || "").trim().toLowerCase()); }

  function hasUpdateSignal(app) { return app.versions.length > 0 || isTrue(app.update_available); }

  function parseCsvRows(source) {
    const text = String(source || "").replace(/^\uFEFF/, "");
    const rows = [];
    let row = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (character === '"') {
        if (quoted && text[index + 1] === '"') { value += '"'; index += 1; }
        else quoted = !quoted;
      } else if (character === "," && !quoted) {
        row.push(value); value = "";
      } else if ((character === "\n" || character === "\r") && !quoted) {
        if (character === "\r" && text[index + 1] === "\n") index += 1;
        row.push(value);
        if (row.some(cell => cell.trim())) rows.push(row);
        row = []; value = "";
      } else value += character;
    }
    row.push(value);
    if (row.some(cell => cell.trim())) rows.push(row);
    const headers = (rows.shift() || []).map(header => header.trim().toLowerCase());
    return rows.map(cells => Object.fromEntries(headers.map((header, index) => [header, (cells[index] || "").trim()])));
  }

  function parseInstalledCsv(text) {
    const records = parseCsvRows(text);
    const headers = Object.keys(records[0] || {});
    if (!["name", "scope", "version"].every(header => headers.includes(header))) {
      throw new Error("Installed apps CSV needs name, scope, and version columns.");
    }
    const unique = new Map();
    let duplicateRows = 0;
    for (const row of records) {
      const scope = row.scope.trim();
      if (!scope) continue;
      const normalized = { ...row, name: cleanName(row.name), scope, version: row.version.trim() };
      const existing = unique.get(scope);
      if (existing) {
        duplicateRows += 1;
        const toTimestamp = value => {
          const match = String(value || "").match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?/);
          if (!match) return Date.parse(value) || 0;
          return Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]), Number(match[4] || 0), Number(match[5] || 0), Number(match[6] || 0));
        };
        if (toTimestamp(normalized.sys_updated_on) >= toTimestamp(existing.sys_updated_on)) unique.set(scope, normalized);
      } else unique.set(scope, normalized);
    }
    if (!unique.size) throw new Error("No application records with a scope were found.");
    return { records: [...unique.values()], duplicateRows };
  }

  function parseVersionsCsv(text) {
    const records = parseCsvRows(text);
    const headers = Object.keys(records[0] || {});
    if (!["name", "version"].every(header => headers.includes(header))) {
      throw new Error("App version CSV needs name and version columns. Scope is optional.");
    }
    const versions = records
      .filter(record => cleanName(record.name) && provided(record.version))
      .map(record => ({ ...record, name: cleanName(record.name), scope: (record.scope || "").trim(), version: provided(record.version), _source: "Imported sys_app_version" }));
    if (!versions.length) throw new Error("No application versions were found.");
    return versions;
  }

  function compareVersions(left, right) {
    const leftParts = String(left || "").split(/[.+-]/);
    const rightParts = String(right || "").split(/[.+-]/);
    const length = Math.max(leftParts.length, rightParts.length);
    for (let index = 0; index < length; index += 1) {
      const leftPart = leftParts[index] || "0";
      const rightPart = rightParts[index] || "0";
      const leftNumber = /^\d+$/.test(leftPart) ? Number(leftPart) : null;
      const rightNumber = /^\d+$/.test(rightPart) ? Number(rightPart) : null;
      if (leftNumber !== null && rightNumber !== null && leftNumber !== rightNumber) return leftNumber - rightNumber;
      if (leftPart !== rightPart) return leftPart.localeCompare(rightPart, undefined, { numeric: true, sensitivity: "base" });
    }
    return 0;
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error("IndexedDB is unavailable.")); return; }
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function loadDataset(key) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
      transaction.oncomplete = () => database.close();
      transaction.onerror = () => database.close();
    });
  }

  async function saveDataset(key, records, metadata = {}) {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put({ records, ...metadata, savedAt: new Date().toISOString() }, key);
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => { database.close(); reject(transaction.error); };
    });
  }

  function buildIndexes() {
    state.versionsByScope = new Map();
    state.versionsByName = new Map();
    for (const record of state.versionRecords) {
      if (record.scope) {
        if (!state.versionsByScope.has(record.scope)) state.versionsByScope.set(record.scope, new Map());
        state.versionsByScope.get(record.scope).set(record.version, record);
      } else {
        const key = nameKey(record.name);
        if (!state.versionsByName.has(key)) state.versionsByName.set(key, new Map());
        state.versionsByName.get(key).set(record.version, record);
      }
    }
  }

  function buildApplications() {
    buildIndexes();
    const installedNameCounts = new Map();
    const brazilStoreByScope = new Map();
    const brazilStoreByName = new Map();
    for (const record of state.brazilStoreRecords) {
      if (record.scope) brazilStoreByScope.set(record.scope, record);
      const key = nameKey(record.name);
      if (!brazilStoreByName.has(key)) brazilStoreByName.set(key, []);
      brazilStoreByName.get(key).push(record);
    }
    state.installedRecords.forEach(record => {
      const key = nameKey(record.name);
      installedNameCounts.set(key, (installedNameCounts.get(key) || 0) + 1);
    });
    state.apps = state.installedRecords.map(record => {
      const key = nameKey(record.name);
      const scopedRecords = state.versionsByScope.get(record.scope);
      const namedRecords = state.versionsByName.get(key);
      const brazilStoreScopeRecord = brazilStoreByScope.get(record.scope);
      const brazilStoreNameRecord = installedNameCounts.get(key) === 1 && brazilStoreByName.get(key)?.length === 1 ? brazilStoreByName.get(key)[0] : null;
      const brazilStoreRecord = brazilStoreScopeRecord || brazilStoreNameRecord;
      let matchStatus = "unmatched";
      let matchMethod = "";
      let matchedRecords = [];
      if (scopedRecords?.size) {
        matchStatus = "matched";
        matchMethod = "scope";
        matchedRecords = [...scopedRecords.values()];
      } else if (namedRecords?.size && installedNameCounts.get(key) > 1) {
        matchStatus = "ambiguous";
        matchMethod = "name";
      } else if (namedRecords?.size) {
        matchStatus = "matched";
        matchMethod = "name";
        matchedRecords = [...namedRecords.values()];
      }
      if (matchStatus === "unmatched" && brazilStoreRecord) {
        matchStatus = "matched";
        matchMethod = brazilStoreScopeRecord ? "brazil-store-scope" : "brazil-store-name";
      }
      const candidates = new Map(matchedRecords
        .filter(item => compareVersions(item.version, record.version) > 0)
        .map(item => [item.version, item]));
      const candidateSources = [
        [brazilStoreRecord?.version, "Imported sys_store_app version"],
        [brazilStoreRecord?.latest_version, "Imported sys_store_app latest_version"]
      ];
      for (const [candidateValue, source] of candidateSources) {
        const candidate = provided(candidateValue);
        if (candidate && compareVersions(candidate, record.version) > 0 && !candidates.has(candidate)) {
          candidates.set(candidate, {
            name: record.name,
            scope: record.scope,
            version: candidate,
            short_description: brazilStoreRecord?.short_description || record.short_description,
            compatibilities: brazilStoreRecord?.compatibilities || record.compatibilities,
            _source: source
          });
        }
      }
      return {
        ...record,
        nameKey: key,
        matchStatus,
        matchMethod,
        versions: [...candidates.values()].sort((left, right) => compareVersions(right.version, left.version))
      };
    });
    state.page = 1;
    renderApplications();
    window.dispatchEvent(new CustomEvent("platform-installed-apps-ready", {
      detail: { apps: state.apps.map(({ name, title, scope }) => ({ name, title, scope })) }
    }));
  }

  function reviewKey(scope, version) { return `${scope}::${version}`; }

  function reviewFor(scope, version) {
    return {
      recommendation: "unassessed", impact: "unassessed", decision: "review", owner: "", notes: "", action: "", teamRequired: false, updatedAt: "",
      ...(state.reviews[reviewKey(scope, version)] || {})
    };
  }

  function candidateReviews(app) {
    return app.versions.map(record => reviewFor(app.scope, record.version));
  }

  function reviewComplete(app) {
    return app.versions.length > 0 && candidateReviews(app).every(review => review.decision !== "review");
  }

  function summaryReview(app) {
    const versions = app.versions.length ? app.versions.map(record => record.version) : [app.version];
    const reviews = versions.map(version => ({ ...reviewFor(app.scope, version), version }));
    return reviewFilters.selectAssessment(reviews, state.targets[app.scope], compareVersions);
  }

  function applicationDescriptor(app) {
    const prefix = `${app.scope}::`;
    const versions = new Set([app.version, ...app.versions.map(record => record.version), ...Object.keys(state.reviews).filter(key => key.startsWith(prefix)).map(key => key.slice(prefix.length))]);
    const reviews = [...versions].filter(Boolean).map(version => ({ ...reviewFor(app.scope, version), version }));
    const editedAt = reviews.map(review => review.updatedAt).filter(Boolean).sort((left, right) => (Date.parse(right) || 0) - (Date.parse(left) || 0))[0] || "";
    return {
      id: app.scope, name: app.name, item: app, type: Object.hasOwn(reviewFilters.labels.type, app.plugin_type) ? app.plugin_type : "unknown",
      updateStatus: hasUpdateSignal(app) ? "update" : app.matchStatus === "matched" ? "current" : "unknown",
      searchText: `${app.name} ${app.scope} ${app.short_description || ""} ${[...versions].join(" ")}`,
      summary: summaryReview(app), reviews, editedAt, versionCount: app.versions.length
    };
  }

  function matchLabel(app) {
    if (app.matchStatus === "matched") return app.matchMethod === "scope" ? "Exact scope match" : app.matchMethod === "brazil-store-scope" ? "Exact Store catalog scope" : app.matchMethod === "brazil-store-name" ? "Unique Store catalog name" : "Legacy name match";
    if (app.matchStatus === "ambiguous") return "Ambiguous name";
    return state.versionRecords.length ? "No catalog match" : "Version catalog not loaded";
  }

  function renderApplications() {
    const status = elements.applicationStatusFilter.value;
    const reviewState = elements.applicationReviewFilter.value;
    const descriptors = state.apps.map(applicationDescriptor).filter(row => {
      const app = row.item;
      const hasUpdates = hasUpdateSignal(app);
      return (status === "all" || status === "update" && hasUpdates || status === "current" && row.updateStatus === "current" || app.matchStatus === status)
        && (reviewState === "all" || reviewState === "unreviewed" && hasUpdates && !reviewComplete(app) || reviewState === "complete" && reviewComplete(app) || reviewState === "blocker" && row.reviews.some(review => review.decision === "blocker") || reviewState === "team" && row.reviews.some(review => review.teamRequired));
    });
    const filters = applicationFilters?.read() || { query: elements.applicationSearch.value };
    const filtered = (applicationFilters ? applicationFilters.apply(descriptors) : reviewFilters.sort(descriptors.filter(row => reviewFilters.matches(row, filters)), elements.applicationSort.value)).map(row => row.item);
    applicationFilters?.update(descriptors);
    state.filteredApps = filtered;
    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    state.page = Math.min(state.page, pageCount);
    const visible = filtered.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
    elements.applicationRows.innerHTML = visible.map(renderApplicationRow).join("");
    elements.applicationEmptyState.hidden = visible.length > 0;
    const emptyTitle = elements.applicationEmptyState.querySelector("strong");
    const emptyDescription = elements.applicationEmptyState.querySelector("span");
    if (!state.apps.length) {
      emptyTitle.textContent = "Import your installed baseline to build the change list";
      emptyDescription.innerHTML = 'Import installed <code>sys_store_app</code> records first. Then import <code>sys_app_version</code> for candidates. A separate Store <code>sys_store_app</code> catalog is optional and never replaces the baseline.';
    } else if (!filtered.length) {
      emptyTitle.textContent = "No applications match these filters";
      emptyDescription.textContent = "Adjust the search or filters to see more of this inventory.";
    }
    const clearFilters = elements.applicationEmptyState.querySelector("[data-review-empty-reset]");
    if (clearFilters) clearFilters.hidden = !state.apps.length;
    elements.applicationResultCount.textContent = `${filtered.length.toLocaleString()} of ${state.apps.length.toLocaleString()} applications`;
    elements.applicationPageStatus.textContent = filtered.length ? `Showing ${visible.length} on page ${state.page} of ${pageCount}` : "No matching applications";
    renderPagination(pageCount);
    renderMetrics();
    renderSourceStatus();
    renderBrazilCatalogAdditions();
  }

  function renderApplicationRow(app) {
    const descriptor = applicationDescriptor(app);
    const summary = descriptor.summary;
    const updateSignal = hasUpdateSignal(app);
    const matchClass = app.matchStatus === "ambiguous" ? "ambiguous" : app.matchStatus === "unmatched" ? "unmatched" : updateSignal ? "update" : "";
    const latest = app.versions[0]?.version || "";
    const versionText = app.versions.length
      ? `${app.versions.length} newer ${app.versions.length === 1 ? "version" : "versions"}${latest ? ` · latest ${latest}` : ""}`
      : isTrue(app.update_available) ? "Update flagged · target unavailable" : app.matchStatus === "matched" ? "No newer version" : "Not matched";
    const pill = (type, text) => `<span class="app-review-pill ${escapeHtml(type)}">${escapeHtml(text)}</span>`;
    const autoUpdate = isTrue(app.auto_update) ? '<span class="app-inline-status">Auto-update</span>' : "";
    const updateFlag = isTrue(app.update_available) ? '<span class="app-inline-status update-flag">Update flagged</span>' : "";
    const team = descriptor.reviews.some(review => review.teamRequired) ? '<span class="review-team-badge">Team review</span>' : "";
    const warnings = descriptor.reviews.filter(review => review.version !== summary.version && (["blocker", "hold"].includes(review.decision) || review.recommendation === "do_not")).map(review => review.version);
    const warning = warnings.length ? `<small class="review-warning">Other version warning: ${escapeHtml(warnings.join(", "))}</small>` : "";
    const matched = reviewFilters.matchedVersions(descriptor, applicationFilters?.read() || {});
    const match = matched.length ? `<small class="app-match-note">Matched reviews: ${escapeHtml(matched.join(", "))}</small>` : "";
    const context = summary.version ? `${state.targets[app.scope] === summary.version ? "Target" : summary.assessed ? "Assessed" : "Version"} ${summary.version}` : "No version";
    return `<tr>
      <td><div class="app-name-cell"><strong>${escapeHtml(app.name)}</strong><small>${escapeHtml(app.scope)}</small><span class="app-inline-statuses">${autoUpdate}${updateFlag}</span>${team}${warning}${match}</div></td>
      <td class="app-version-cell" data-label="Installed">${escapeHtml(app.version || "Unknown")}</td>
      <td data-label="Catalog candidates"><span class="app-state-pill ${matchClass}">${escapeHtml(versionText)}</span><small class="app-match-note">${escapeHtml(matchLabel(app))}</small></td>
      <td data-label="Recommendation">${pill(summary.recommendation, labels.recommendation[summary.recommendation] || labels.recommendation.unassessed)}<small class="app-match-note">${escapeHtml(context)}</small></td>
      <td data-label="Impact">${pill(summary.impact, labels.impact[summary.impact] || labels.impact.unassessed)}</td>
      <td data-label="Decision">${pill(summary.decision, labels.decision[summary.decision] || labels.decision.review)}${summary.owner ? `<small class="app-match-note">${escapeHtml(summary.owner)}</small>` : ""}</td>
      <td><button class="open-app-review" type="button" data-app-scope="${escapeHtml(app.scope)}" aria-label="Review ${escapeHtml(app.name)}">›</button></td>
    </tr>`;
  }

  function renderPagination(pageCount) {
    if (pageCount <= 1) { elements.applicationPagination.innerHTML = ""; return; }
    const pages = [...new Set([1, state.page - 1, state.page, state.page + 1, pageCount])].filter(page => page >= 1 && page <= pageCount).sort((a, b) => a - b);
    let previous = 0;
    const buttons = pages.map(page => {
      const gap = page - previous > 1 ? '<span aria-hidden="true">…</span>' : "";
      previous = page;
      return `${gap}<button type="button" data-page="${page}" class="${page === state.page ? "active" : ""}" aria-label="Page ${page}" ${page === state.page ? 'aria-current="page"' : ""}>${page}</button>`;
    }).join("");
    elements.applicationPagination.innerHTML = `<button type="button" data-page="${state.page - 1}" aria-label="Previous page" ${state.page === 1 ? "disabled" : ""}>‹</button>${buttons}<button type="button" data-page="${state.page + 1}" aria-label="Next page" ${state.page === pageCount ? "disabled" : ""}>›</button>`;
  }

  function renderMetrics() {
    const updateApps = state.apps.filter(hasUpdateSignal);
    const totalVersions = updateApps.reduce((count, app) => count + app.versions.length, 0);
    const reviewedVersions = updateApps.reduce((count, app) => count + candidateReviews(app).filter(review => review.decision !== "review").length, 0);
    const uncertain = state.apps.filter(app => ["unmatched", "ambiguous"].includes(app.matchStatus)).length;
    elements.appTotalCount.textContent = state.apps.length.toLocaleString();
    elements.appUpdateCount.textContent = updateApps.length.toLocaleString();
    elements.appReviewedCount.textContent = `${totalVersions ? Math.round(reviewedVersions / totalVersions * 100) : 0}%`;
    elements.appReviewedDetail.textContent = totalVersions ? `${reviewedVersions} of ${totalVersions} version decisions` : "no update candidates yet";
    elements.appUnmatchedCount.textContent = uncertain.toLocaleString();
    elements.appBrazilCatalogAdds.textContent = countBrazilCatalogAdditions().toLocaleString();
  }

  function countBrazilCatalogAdditions() {
    return brazilCatalogAdditions().length;
  }

  function brazilCatalogAdditions() {
    if (!state.installedRecords.length || !state.brazilStoreRecords.length) return [];
    const baselineScopes = new Set(state.installedRecords.map(record => record.scope).filter(Boolean));
    const baselineNameCounts = new Map();
    state.installedRecords.forEach(record => {
      const key = nameKey(record.name);
      baselineNameCounts.set(key, (baselineNameCounts.get(key) || 0) + 1);
    });
    return state.brazilStoreRecords.filter(record => {
      if (record.scope && baselineScopes.has(record.scope)) return false;
      const key = nameKey(record.name);
      return Boolean(key) && !baselineNameCounts.has(key);
    }).sort((left, right) => left.name.localeCompare(right.name));
  }

  function renderBrazilCatalogAdditions() {
    const additions = brazilCatalogAdditions();
    elements.brazilCatalogAdditionsPanel.hidden = !state.installedRecords.length || !state.brazilStoreRecords.length;
    elements.brazilCatalogAdditionsCount.textContent = additions.length.toLocaleString();
    if (!elements.brazilCatalogAdditionsPanel.hidden) {
      const visible = additions.slice(0, 100);
      elements.brazilCatalogAdditionRows.innerHTML = visible.length
        ? visible.map(record => `<li><span><strong>${escapeHtml(record.name)}</strong><small>${escapeHtml(record.scope || "No scope")}</small></span><span>Catalog ${escapeHtml(record.version || "Version unknown")}${provided(record.latest_version) ? ` · latest ${escapeHtml(record.latest_version)}` : ""}</span></li>`).join("")
        : '<li class="empty-linked-note">No clearly new exact-scope or exact-name records. Ambiguous names are not counted as additions.</li>';
      if (additions.length > visible.length) {
        const more = document.createElement("li");
        more.className = "empty-linked-note";
        more.textContent = `Showing 100 of ${additions.length.toLocaleString()} catalog-only records.`;
        elements.brazilCatalogAdditionRows.append(more);
      }
    }
  }

  function renderSourceStatus() {
    const indicator = document.querySelector(".source-indicator");
    if (!state.installedRecords.length) {
      elements.applicationSourceStatus.innerHTML = 'No installed baseline loaded. Import <code>sys_store_app</code> first.';
      indicator.className = "source-indicator";
    } else {
      const loaded = `${state.installedRecords.length.toLocaleString()} unique app scopes loaded in this browser`;
      elements.applicationSourceStatus.textContent = state.duplicateRows ? `${loaded} · ${state.duplicateRows} duplicate scope rows consolidated` : loaded;
      indicator.className = "source-indicator ready";
    }
    if (!state.versionRecords.length) elements.applicationMatchStatus.textContent = "Version catalog not loaded";
    else {
      const scoped = state.apps.filter(app => app.matchStatus === "matched" && app.matchMethod === "scope").length;
      const named = state.apps.filter(app => app.matchStatus === "matched" && app.matchMethod === "name").length;
      const uncertain = state.apps.filter(app => ["unmatched", "ambiguous"].includes(app.matchStatus)).length;
      const brazilStoreScopes = state.apps.filter(app => app.matchMethod === "brazil-store-scope").length;
      elements.applicationMatchStatus.textContent = `${scoped} version catalog scopes · ${brazilStoreScopes} Store catalog scopes · ${named} legacy names · ${uncertain} need mapping`;
      if (uncertain) indicator.className = "source-indicator warning";
    }
    elements.brazilStoreCatalogStatus.textContent = state.brazilStoreRecords.length
      ? `${state.brazilStoreRecords.length.toLocaleString()} Store catalog rows loaded · Installed baseline unchanged · ${countBrazilCatalogAdditions().toLocaleString()} exact-name/scope catalog additions`
      : "Store catalog not loaded. Import it separately; this will not replace your installed baseline.";
  }

  function setWorkspace(name) {
    const notes = name === "notes";
    const upgradePlan = name === "upgrade-plan";
    const problems = name === "problems";
    elements.notesWorkspacePanel.hidden = !notes;
    elements.upgradePlanWorkspacePanel.hidden = !upgradePlan;
    elements.problemFixesWorkspacePanel.hidden = !problems;
    elements.notesWorkspaceTab.classList.toggle("active", notes);
    elements.upgradePlanWorkspaceTab.classList.toggle("active", upgradePlan);
    elements.problemFixesWorkspaceTab.classList.toggle("active", problems);
    elements.notesWorkspaceTab.setAttribute("aria-selected", String(notes));
    elements.upgradePlanWorkspaceTab.setAttribute("aria-selected", String(upgradePlan));
    elements.problemFixesWorkspaceTab.setAttribute("aria-selected", String(problems));
    try { localStorage.setItem(VIEW_KEY, name); } catch { /* The selected view remains usable without storage. */ }
    if (!upgradePlan && state.activeScope) closeDrawer();
    if (!upgradePlan) window.dispatchEvent(new CustomEvent("platform-plugin-history-close"));
    if (notes && /^#(?:applications|plugins|problems)$/.test(location.hash)) history.replaceState(null, "", `${location.pathname}${location.search}`);
    else if (problems && location.hash !== "#problems") location.hash = "#problems";
    if (upgradePlan) {
      const subview = location.hash === "#plugins" ? "plugins" : location.hash === "#applications" ? "applications" : localStorage.getItem(UPGRADE_VIEW_KEY) || "applications";
      setUpgradeView(subview === "plugins" ? "plugins" : "applications");
    }
    if (problems) window.dispatchEvent(new CustomEvent("platform-problem-fixes-open"));
    updatePageHeading();
  }

  function setUpgradeView(name) {
    const plugins = name === "plugins";
    elements.applicationsWorkspacePanel.hidden = plugins;
    elements.pluginsWorkspacePanel.hidden = !plugins;
    elements.applicationsModeTab.classList.toggle("active", !plugins);
    elements.pluginsModeTab.classList.toggle("active", plugins);
    elements.applicationsModeTab.setAttribute("aria-selected", String(!plugins));
    elements.pluginsModeTab.setAttribute("aria-selected", String(plugins));
    try { localStorage.setItem(UPGRADE_VIEW_KEY, plugins ? "plugins" : "applications"); } catch { /* The chosen upgrade view remains active without storage. */ }
    if (plugins) window.dispatchEvent(new CustomEvent("platform-plugin-history-open"));
    else window.dispatchEvent(new CustomEvent("platform-plugin-history-close"));
    if (plugins && state.activeScope) closeDrawer();
    if (!/^#(?:applications|plugins)$/.test(location.hash)) location.hash = plugins ? "#plugins" : "#applications";
    updatePageHeading();
  }

  function showToast(message) {
    let toast = document.getElementById("appToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "appToast";
      toast.className = "app-toast";
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => { toast.hidden = true; }, 3000);
  }

  function openDrawer(scope) {
    const app = state.apps.find(record => record.scope === scope);
    if (!app) return;
    state.activeScope = scope;
    elements.applicationDrawerTitle.textContent = app.name;
    elements.applicationDrawerScope.textContent = app.scope;
    elements.drawerAppInstalledVersion.textContent = app.version || "Unknown";
    elements.drawerAppVersionCount.textContent = app.versions.length.toLocaleString();
    elements.drawerAppMatchBadge.textContent = matchLabel(app);
    elements.drawerAppMatchBadge.className = `match-badge${app.matchStatus === "ambiguous" ? " ambiguous" : ["unmatched", "store"].includes(app.matchStatus) ? " unmatched" : ""}`;
    const choices = app.versions.length ? app.versions : [{ version: app.version, name: app.name }];
    elements.appReviewVersion.innerHTML = choices.map((record, index) => `<option value="${escapeHtml(record.version)}">${escapeHtml(record.version || "Installed version")}${app.versions.length && index === 0 ? " · newest" : ""}</option>`).join("");
    state.activeVersion = choices[0]?.version || "";
    loadActiveReview(app);
    elements.appTargetVersion.innerHTML = `<option value="">Not selected</option>${app.versions.map(record => `<option value="${escapeHtml(record.version)}">${escapeHtml(record.version)}</option>`).join("")}`;
    updateTargetControl(app);
    renderNoteChoices();
    renderLinkedNotes();
    elements.applicationDrawer.inert = false;
    elements.applicationDrawer.setAttribute("aria-hidden", "false");
    state.overflowBeforeDrawer = document.body.style.overflow;
    elements.applicationDrawer.showModal();
    elements.applicationDrawer.classList.add("open");
    document.body.style.overflow = "hidden";
    elements.closeApplicationDrawer.focus();
  }

  function loadActiveReview(app) {
    state.activeVersion = elements.appReviewVersion.value || state.activeVersion;
    const review = reviewFor(app.scope, state.activeVersion);
    const version = app.versions.find(record => record.version === state.activeVersion);
    elements.appVersionMetadata.hidden = !version;
    elements.appVersionPublishDate.textContent = provided(version?.publish_date) || "Not provided";
    elements.appVersionDependencies.textContent = provided(version?.dependencies) || "Not provided";
    elements.appVersionCompatibility.textContent = provided(version?.compatibilities) || provided(app.compatibilities) || "Not provided";
    elements.appVersionSource.textContent = version?._source || "Installed record";
    elements.appVersionDescription.textContent = provided(version?.key_features) || provided(version?.short_description) || provided(app.short_description);
    elements.appRecommendation.value = review.recommendation;
    elements.appImpact.value = review.impact;
    elements.appDecision.value = review.decision;
    elements.appReviewOwner.value = review.owner;
    elements.appReviewNotes.value = review.notes || provided(version?.release_notes);
    elements.appReviewAction.value = review.action;
    elements.appTeamRequired.checked = Boolean(review.teamRequired);
  }

  function updateTargetControl(app) {
    const remaining = app.versions.filter(record => reviewFor(app.scope, record.version).decision === "review").length;
    const selected = app.versions.some(record => record.version === state.targets[app.scope]) ? state.targets[app.scope] : "";
    elements.appTargetVersion.value = selected;
    elements.appTargetVersion.disabled = !app.versions.length || remaining > 0;
    elements.appTargetStatus.textContent = !app.versions.length
      ? "No newer version is available in the imported catalog."
      : remaining
        ? `${remaining} version ${remaining === 1 ? "decision" : "decisions"} remaining before a target can be selected.`
        : selected
          ? `Update target selected: ${selected}`
          : "All candidate versions reviewed. Select the version you plan to install.";
  }

  function closeDrawer() {
    if (!elements.applicationDrawer.open) return;
    const scope = state.activeScope;
    elements.applicationDrawer.close();
    elements.applicationDrawer.classList.remove("open");
    elements.applicationDrawer.setAttribute("aria-hidden", "true");
    elements.applicationDrawer.inert = true;
    document.body.style.overflow = state.overflowBeforeDrawer;
    state.activeScope = "";
    const button = [...elements.applicationRows.querySelectorAll("[data-app-scope]")].find(node => node.dataset.appScope === scope);
    if (button) button.focus();
    else applicationFilters?.focusFilter();
    state.activeVersion = "";
  }

  function saveActiveReview(event) {
    event.preventDefault();
    if (!state.activeScope || !state.activeVersion) return;
    state.reviews[reviewKey(state.activeScope, state.activeVersion)] = {
      recommendation: elements.appRecommendation.value,
      impact: elements.appImpact.value,
      decision: elements.appDecision.value,
      owner: elements.appReviewOwner.value.trim(),
      notes: elements.appReviewNotes.value.trim(),
      action: elements.appReviewAction.value.trim(),
      teamRequired: elements.appTeamRequired.checked,
      updatedAt: new Date().toISOString()
    };
    const persisted = writeLocalObject(REVIEW_KEY, state.reviews);
    const app = state.apps.find(record => record.scope === state.activeScope);
    if (app) updateTargetControl(app);
    renderApplications();
    showToast(persisted ? "Application review saved in this browser." : "Review kept for this session only. Export your review plan to keep your work.");
  }

  function clearReview() {
    if (!state.activeScope || !state.activeVersion || !window.confirm(`Clear the review for version ${state.activeVersion}?`)) return;
    delete state.reviews[reviewKey(state.activeScope, state.activeVersion)];
    const persisted = writeLocalObject(REVIEW_KEY, state.reviews);
    const app = state.apps.find(record => record.scope === state.activeScope);
    if (app) { loadActiveReview(app); updateTargetControl(app); }
    renderApplications();
    showToast(persisted ? "Version review cleared." : "Review cleared for this session only; browser storage could not save the change.");
  }

  function renderNoteChoices() {
    const selected = elements.linkPlatformNote.value;
    elements.linkPlatformNote.innerHTML = `<option value="">${state.products.length ? "Choose a release note" : "Release catalog loading"}</option>${state.products.map(product => `<option value="${escapeHtml(product.slug)}">${escapeHtml(product.name)}</option>`).join("")}`;
    if (state.products.some(product => product.slug === selected)) elements.linkPlatformNote.value = selected;
    elements.linkPlatformNote.disabled = !state.products.length;
    elements.linkPlatformNoteButton.disabled = !state.products.length;
  }

  function renderLinkedNotes() {
    const links = Array.isArray(state.noteLinks[state.activeScope]) ? state.noteLinks[state.activeScope] : [];
    const products = new Map(state.products.map(product => [product.slug, product]));
    const notes = links.map(slug => products.get(slug)).filter(Boolean);
    elements.linkedPlatformNotes.innerHTML = notes.length
      ? notes.map(product => `<li><button class="linked-note-open" type="button" data-note-slug="${escapeHtml(product.slug)}">${escapeHtml(product.name)}</button><button class="unlink-note" type="button" data-unlink-slug="${escapeHtml(product.slug)}" aria-label="Unlink ${escapeHtml(product.name)}">Remove</button></li>`).join("")
      : '<li class="empty-linked-note">No notes linked yet.</li>';
  }

  function saveNoteLinks() { return writeLocalObject(NOTE_LINK_KEY, state.noteLinks); }

  function linkSelectedNote() {
    if (!state.activeScope || !elements.linkPlatformNote.value) return;
    const slug = elements.linkPlatformNote.value;
    const links = Array.isArray(state.noteLinks[state.activeScope]) ? state.noteLinks[state.activeScope] : [];
    if (!links.includes(slug)) state.noteLinks[state.activeScope] = [...links, slug];
    const persisted = saveNoteLinks();
    window.dispatchEvent(new CustomEvent("platform-note-relevance-update", { detail: { slug, status: "relevant" } }));
    renderLinkedNotes();
    elements.linkPlatformNote.value = "";
    showToast(persisted ? "Release note linked to this application." : "Note linked for this session only; browser storage could not save the link.");
  }

  function openLinkedNote(slug) {
    closeDrawer();
    setWorkspace("notes");
    window.dispatchEvent(new CustomEvent("platform-note-open", { detail: { slug } }));
  }

  function downloadFile(content, type, filename) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportCsv(records, filename) {
    if (!records.length) { showToast("There is no imported data to export."); return; }
    const headers = [...new Set(records.flatMap(record => Object.keys(record)))];
    const encode = value => {
      let text = String(value ?? "");
      if (/^[\s\u0000-\u001f]*[=+\-@]|^[\u0000-\u001f]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const csv = [headers.map(encode).join(","), ...records.map(record => headers.map(header => encode(record[header])).join(","))].join("\r\n");
    downloadFile(csv, "text/csv;charset=utf-8", filename);
  }

  function readNoteRelevance() {
    try {
      const value = JSON.parse(localStorage.getItem("platform-upgrade-note-relevance-v1"));
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch { return {}; }
  }

  function readTeamBrief() {
    try {
      const value = JSON.parse(localStorage.getItem("platform-upgrade-team-brief-v1"));
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }

  async function exportPlan() {
    try {
      const detail = {};
      window.dispatchEvent(new CustomEvent("platform-plugin-workspace-backup", { detail }));
      const pluginWorkspaces = detail.promise ? await detail.promise : [];
      const payload = {
        format: "platform-upgrade-plan", formatVersion: 1, exportedAt: new Date().toISOString(),
        applicationCount: state.apps.length, installedScopes: state.apps.map(app => app.scope),
        reviews: state.reviews, selectedTargets: state.targets, applicationNotes: state.noteLinks, noteRelevance: readNoteRelevance(), teamBrief: readTeamBrief(),
        pluginReviews: readLocalObject("platform-upgrade-plugin-review-collections-v2"), pluginTargets: readLocalObject("platform-upgrade-plugin-target-collections-v2"), pluginHistoryLabels: readLocalObject("platform-upgrade-plugin-history-labels-v1"), pluginWorkspaces
      };
      downloadFile(JSON.stringify(payload, null, 2), "application/json", `platform-upgrade-plan-${new Date().toISOString().slice(0, 10)}.json`);
      showToast("Review plan exported.");
    } catch (error) { showToast(error.message || "Could not export the complete review plan."); }
  }

  async function importPlan(file) {
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      if (backup.format !== "platform-upgrade-plan" || !backup.reviews || typeof backup.reviews !== "object" || Array.isArray(backup.reviews)) throw new Error("This file is not a Platform Upgrade Desk review plan.");
      if (backup.pluginWorkspaces !== undefined) {
        if (!Array.isArray(backup.pluginWorkspaces)) throw new Error("The plan contains invalid plugin workspaces.");
        backup.pluginWorkspaces = backup.pluginWorkspaces.map(workspace => window.PlatformPluginHistory.validateWorkspace(workspace));
      }
      const workspaceDetail = {};
      window.dispatchEvent(new CustomEvent("platform-plugin-workspace-backup", { detail: workspaceDetail }));
      const currentWorkspaces = workspaceDetail.promise ? await workspaceDetail.promise : [];
      const hasWork = Object.keys(state.reviews).length || Object.keys(state.targets).length || Object.keys(state.noteLinks).length
        || Object.keys(readNoteRelevance()).length || readTeamBrief().length || currentWorkspaces.length
        || ["platform-upgrade-plugin-review-collections-v2", "platform-upgrade-plugin-target-collections-v2", "platform-upgrade-plugin-history-labels-v1"].some(key => Object.keys(readLocalObject(key)).length);
      if (hasWork && !window.confirm("Replace the application and plugin reviews, targets, note links, relevance choices, team brief, history labels, and backed-up workspace timelines with this plan? Unrelated workspaces and saved CSV files will not be removed.")) return;
      let persisted = true;
      state.reviews = backup.reviews;
      state.targets = backup.selectedTargets && typeof backup.selectedTargets === "object" && !Array.isArray(backup.selectedTargets) ? backup.selectedTargets : {};
      state.noteLinks = backup.applicationNotes && typeof backup.applicationNotes === "object" && !Array.isArray(backup.applicationNotes) ? backup.applicationNotes : {};
      if (backup.noteRelevance && typeof backup.noteRelevance === "object" && !Array.isArray(backup.noteRelevance)) {
        const detail = { values: backup.noteRelevance, persisted: true };
        window.dispatchEvent(new CustomEvent("platform-note-relevance-restore", { detail }));
        persisted = detail.persisted && persisted;
      }
      if (Array.isArray(backup.teamBrief)) {
        const detail = { items: backup.teamBrief, persisted: true };
        window.dispatchEvent(new CustomEvent("platform-team-brief-restore", { detail }));
        persisted = detail.persisted && persisted;
      }
      const pluginDetail = {
        reviewCollections: backup.pluginReviews && typeof backup.pluginReviews === "object" && !Array.isArray(backup.pluginReviews) ? backup.pluginReviews : {},
        targetCollections: backup.pluginTargets && typeof backup.pluginTargets === "object" && !Array.isArray(backup.pluginTargets) ? backup.pluginTargets : {},
        labels: backup.pluginHistoryLabels && typeof backup.pluginHistoryLabels === "object" && !Array.isArray(backup.pluginHistoryLabels) ? backup.pluginHistoryLabels : {},
        persisted: true
      };
      window.dispatchEvent(new CustomEvent("platform-plugin-review-restore", { detail: pluginDetail }));
      if (backup.pluginWorkspaces) {
        const detail = { workspaces: backup.pluginWorkspaces, confirmReplace: false };
        window.dispatchEvent(new CustomEvent("platform-plugin-workspace-restore", { detail }));
        if (detail.promise) persisted = await detail.promise && persisted;
      }
      const applicationSaves = [writeLocalObject(REVIEW_KEY, state.reviews), writeLocalObject(TARGET_KEY, state.targets), saveNoteLinks()];
      persisted = applicationSaves.every(Boolean) && pluginDetail.persisted && persisted;
      renderApplications();
      if (state.activeScope) {
        const app = state.apps.find(record => record.scope === state.activeScope);
        if (app) { loadActiveReview(app); updateTargetControl(app); renderLinkedNotes(); }
      }
      showToast(persisted ? "Review plan restored." : "Plan loaded, but some changes are session-only because browser storage could not save them. Keep this tab open.");
    } catch (error) {
      showToast(error.message || "Could not import this review plan.");
    } finally { elements.appPlanInput.value = ""; }
  }

  async function importInventory(file) {
    if (!file) return;
    try {
      if (state.installedRecords.length && !window.confirm("Replace the installed-app inventory currently loaded in this browser?")) return;
      const imported = parseInstalledCsv(await file.text());
      state.installedRecords = imported.records;
      state.duplicateRows = imported.duplicateRows;
      buildApplications();
      const storageWarning = await saveDataset("installedApps", imported.records, { duplicateRows: imported.duplicateRows }).then(() => "", () => " This session only; browser caching is unavailable.");
      showToast(`Loaded ${imported.records.length.toLocaleString()} unique scopes${imported.duplicateRows ? `; consolidated ${imported.duplicateRows} duplicate rows` : ""}.${storageWarning}`);
    } catch (error) { showToast(error.message || "Could not import installed apps."); }
    finally { elements.appInventoryInput.value = ""; }
  }

  async function importBrazilStoreCatalog(file) {
    if (!file) return;
    try {
      if (state.brazilStoreRecords.length && !window.confirm("Replace the Store catalog currently loaded? The installed baseline will not change.")) return;
      const imported = parseInstalledCsv(await file.text());
      const hasActiveField = Object.hasOwn(imported.records[0] || {}, "active");
      state.brazilStoreRecords = hasActiveField ? imported.records.filter(record => isTrue(record.active)) : imported.records;
      state.brazilStoreDuplicateRows = imported.duplicateRows;
      buildApplications();
      const storageWarning = await saveDataset(BRAZIL_STORE_CACHE_KEY, state.brazilStoreRecords, { duplicateRows: imported.duplicateRows }).then(() => "", () => " This session only; browser caching is unavailable.");
      showToast(`Loaded ${state.brazilStoreRecords.length.toLocaleString()} Store catalog records; installed baseline unchanged.${storageWarning}`);
    } catch (error) {
      showToast(error.message || "Could not import the Store catalog.");
    } finally { elements.brazilStoreInput.value = ""; }
  }

  async function importVersionCatalog(file) {
    if (!file) return;
    try {
      if (state.versionRecords.length && !window.confirm("Replace the version catalog currently loaded in this browser?")) return;
      state.versionRecords = parseVersionsCsv(await file.text());
      buildApplications();
      const storageWarning = await saveDataset("appVersions", state.versionRecords).then(() => "", () => " This session only; browser caching is unavailable.");
      const matched = state.apps.filter(app => app.matchStatus === "matched").length;
      const uncertain = state.apps.filter(app => ["unmatched", "ambiguous"].includes(app.matchStatus)).length;
      showToast(`Loaded ${state.versionRecords.length.toLocaleString()} versions; ${matched} apps matched, ${uncertain} need mapping.${storageWarning}`);
    } catch (error) { showToast(error.message || "Could not import the version catalog."); }
    finally { elements.appVersionsInput.value = ""; }
  }

  async function restoreDatasets() {
    const token = ++state.restoreToken;
    try {
      const [installed, versions, brazilStore] = await Promise.all([loadDataset("installedApps"), loadDataset("appVersions"), loadDataset(BRAZIL_STORE_CACHE_KEY)]);
      if (token !== state.restoreToken || state.installedRecords.length || state.versionRecords.length || state.brazilStoreRecords.length) return;
      state.installedRecords = Array.isArray(installed) ? installed : Array.isArray(installed?.records) ? installed.records : [];
      state.duplicateRows = Number(installed?.duplicateRows) || 0;
      state.versionRecords = Array.isArray(versions) ? versions : Array.isArray(versions?.records) ? versions.records : [];
      state.brazilStoreRecords = Array.isArray(brazilStore) ? brazilStore : Array.isArray(brazilStore?.records) ? brazilStore.records : [];
      state.brazilStoreDuplicateRows = Number(brazilStore?.duplicateRows) || 0;
      buildApplications();
      if (state.installedRecords.length || state.versionRecords.length || state.brazilStoreRecords.length) showToast("Saved app catalogs restored from this browser.");
    } catch {
      elements.applicationSourceStatus.textContent = "Imports remain local to this tab; browser storage is unavailable.";
    }
  }

  function bindEvents() {
    window.addEventListener("platform-plugin-release-context", event => {
      if (typeof event.detail?.title === "string") state.pluginReleaseTitle = event.detail.title;
      updatePageHeading();
    });
    elements.notesWorkspaceTab.addEventListener("click", () => setWorkspace("notes"));
    elements.upgradePlanWorkspaceTab.addEventListener("click", () => setWorkspace("upgrade-plan"));
    elements.problemFixesWorkspaceTab.addEventListener("click", () => setWorkspace("problems"));
    document.querySelector(".workspace-tabs").addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const tabs = [elements.notesWorkspaceTab, elements.upgradePlanWorkspaceTab, elements.problemFixesWorkspaceTab];
      const index = tabs.indexOf(document.activeElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
      tabs[next].focus();
      tabs[next].click();
    });
    elements.applicationsModeTab.addEventListener("click", () => setUpgradeView("applications"));
    elements.pluginsModeTab.addEventListener("click", () => setUpgradeView("plugins"));
    document.querySelector(".upgrade-plan-tabs").addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const tabs = [elements.applicationsModeTab, elements.pluginsModeTab];
      const index = tabs.indexOf(document.activeElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : (index + (event.key === "ArrowRight" ? 1 : 1)) % tabs.length;
      tabs[next].focus();
      tabs[next].click();
    });
    elements.importAppInventory.addEventListener("click", () => elements.appInventoryInput.click());
    elements.importAppVersions.addEventListener("click", () => elements.appVersionsInput.click());
    elements.importBrazilStore.addEventListener("click", () => elements.brazilStoreInput.click());
    elements.importAppPlan.addEventListener("click", () => elements.appPlanInput.click());
    elements.exportAppPlan.addEventListener("click", exportPlan);
    elements.exportInstalledApps.addEventListener("click", () => exportCsv(state.installedRecords, "sys_store_app.csv"));
    elements.exportVersionCatalog.addEventListener("click", () => exportCsv(state.versionRecords, "sys_app_version.csv"));
    elements.exportBrazilStore.addEventListener("click", () => exportCsv(state.brazilStoreRecords, "store-app-catalog.csv"));
    elements.appInventoryInput.addEventListener("change", event => importInventory(event.target.files[0]));
    elements.appVersionsInput.addEventListener("change", event => importVersionCatalog(event.target.files[0]));
    elements.brazilStoreInput.addEventListener("change", event => importBrazilStoreCatalog(event.target.files[0]));
    elements.appPlanInput.addEventListener("change", event => importPlan(event.target.files[0]));
    applicationFilters = reviewFilters.createWorkbench({
      rootId: "applicationWorkbench", searchId: "applicationSearch", sortId: "applicationSort", resetId: "resetApplicationFilters",
      extras: [{ id: "applicationStatusFilter", label: "Catalog match", defaultValue: "all" }, { id: "applicationReviewFilter", label: "Progress", defaultValue: "all" }],
      onChange: () => { state.page = 1; renderApplications(); }
    });
    elements.applicationRows.addEventListener("click", event => {
      const button = event.target.closest("[data-app-scope]");
      if (button) openDrawer(button.dataset.appScope);
    });
    elements.applicationPagination.addEventListener("click", event => {
      const button = event.target.closest("button[data-page]");
      if (!button || button.disabled) return;
      state.page = Number(button.dataset.page);
      renderApplications();
      elements.applicationsWorkspacePanel.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    elements.closeApplicationDrawer.addEventListener("click", closeDrawer);
    elements.applicationDrawer.addEventListener("click", event => {
      if (event.target === elements.applicationDrawer) closeDrawer();
    });
    elements.applicationDrawer.addEventListener("cancel", event => { event.preventDefault(); closeDrawer(); });
    elements.applicationDrawer.addEventListener("keydown", event => {
      if (event.key === "Escape") { event.preventDefault(); closeDrawer(); return; }
      if (event.key !== "Tab") return;
      const focusable = [...elements.applicationDrawer.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href]')].filter(node => node.offsetParent !== null);
      if (!focusable.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
    });
    elements.applicationReviewForm.addEventListener("submit", saveActiveReview);
    elements.appReviewVersion.addEventListener("change", () => {
      const app = state.apps.find(record => record.scope === state.activeScope);
      if (app) loadActiveReview(app);
    });
    elements.appTargetVersion.addEventListener("change", () => {
      const app = state.apps.find(record => record.scope === state.activeScope);
      if (!app) return;
      const remaining = app.versions.filter(record => reviewFor(app.scope, record.version).decision === "review").length;
      if (remaining) { elements.appTargetVersion.value = state.targets[app.scope] || ""; showToast("Complete all candidate version decisions before selecting a target."); return; }
      if (elements.appTargetVersion.value) state.targets[app.scope] = elements.appTargetVersion.value;
      else delete state.targets[app.scope];
      writeLocalObject(TARGET_KEY, state.targets);
      updateTargetControl(app);
      renderApplications();
    });
    elements.clearApplicationReview.addEventListener("click", clearReview);
    elements.linkPlatformNoteButton.addEventListener("click", linkSelectedNote);
    elements.linkedPlatformNotes.addEventListener("click", event => {
      const open = event.target.closest("[data-note-slug]");
      const remove = event.target.closest("[data-unlink-slug]");
      if (open) openLinkedNote(open.dataset.noteSlug);
      if (remove && state.activeScope) {
        state.noteLinks[state.activeScope] = (state.noteLinks[state.activeScope] || []).filter(slug => slug !== remove.dataset.unlinkSlug);
        saveNoteLinks();
        renderLinkedNotes();
      }
    });
    document.querySelector(".application-menu").addEventListener("toggle", event => {
      if (event.currentTarget.open) document.querySelectorAll(".application-menu[open]").forEach(menu => { if (menu !== event.currentTarget) menu.open = false; });
    });
    document.querySelector(".application-menu-panel").addEventListener("click", event => {
      if (event.target.closest("button")) document.querySelector(".application-menu").open = false;
    });
    window.addEventListener("platform-catalog-ready", event => {
      state.products = Array.isArray(event.detail?.products) ? event.detail.products : [];
      renderNoteChoices();
      if (state.activeScope) renderLinkedNotes();
    });
  }

  bindEvents();
  renderApplications();
  renderNoteChoices();
  try {
    const noteRoute = /^#(?:brazil|delta)\//.test(location.hash);
    const initialView = noteRoute || !location.hash ? "notes" : ["#applications", "#plugins"].includes(location.hash) ? "upgrade-plan" : location.hash === "#problems" ? "problems" : "notes";
    if (initialView === "upgrade-plan") setUpgradeView(location.hash === "#plugins" ? "plugins" : "applications");
    setWorkspace(initialView);
  } catch { setWorkspace("notes"); }
  restoreDatasets();
})();