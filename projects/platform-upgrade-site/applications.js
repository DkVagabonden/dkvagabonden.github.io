(() => {
  "use strict";

  const DB_NAME = "platform-upgrade-desk-data";
  const STORE_NAME = "datasets";
  const REVIEW_KEY = "platform-upgrade-app-reviews-v1";
  const TARGET_KEY = "platform-upgrade-app-targets-v1";
  const NOTE_LINK_KEY = "platform-upgrade-app-note-links-v1";
  const VIEW_KEY = "platform-upgrade-active-view-v1";
  const PAGE_SIZE = 30;
  const labels = {
    recommendation: { unassessed: "Not assessed", must: "Must update", should: "Should update", can: "Can update", do_not: "Do not update" },
    impact: { unassessed: "Not assessed", low: "Low", medium: "Medium", high: "High" },
    decision: { review: "Not reviewed", ready: "Ready", hold: "On hold", blocker: "Show stopper" }
  };
  const state = {
    installedRecords: [], versionRecords: [], duplicateRows: 0, apps: [], filteredApps: [],
    versionsByScope: new Map(), versionsByName: new Map(), products: [],
    reviews: readLocalObject(REVIEW_KEY), targets: readLocalObject(TARGET_KEY), noteLinks: readLocalObject(NOTE_LINK_KEY),
    activeScope: "", activeVersion: "", page: 1, restoreToken: 0, overflowBeforeDrawer: ""
  };
  const ids = [
    "notesWorkspaceTab", "applicationsWorkspaceTab", "problemFixesWorkspaceTab", "notesWorkspacePanel", "applicationsWorkspacePanel", "problemFixesWorkspacePanel",
    "appInventoryInput", "appVersionsInput", "appPlanInput", "importAppInventory", "importAppVersions", "importAppPlan", "exportAppPlan", "exportInstalledApps", "exportVersionCatalog",
    "applicationSourceStatus", "applicationMatchStatus", "appTotalCount", "appUpdateCount", "appReviewedCount", "appReviewedDetail", "appUnmatchedCount",
    "applicationSearch", "applicationStatusFilter", "applicationReviewFilter", "applicationSort", "applicationRows", "applicationEmptyState", "applicationResultCount", "applicationPageStatus", "applicationPagination",
    "appDrawerBackdrop", "applicationDrawer", "applicationDrawerTitle", "applicationDrawerScope", "closeApplicationDrawer", "applicationReviewForm",
    "drawerAppInstalledVersion", "drawerAppVersionCount", "drawerAppMatchBadge", "appReviewVersion", "appVersionMetadata", "appVersionPublishDate", "appVersionDependencies", "appVersionCompatibility", "appVersionDescription",
    "appTargetVersion", "appTargetStatus", "appRecommendation", "appImpact", "appDecision", "appReviewOwner", "appReviewNotes", "appReviewAction", "appTeamRequired", "clearApplicationReview",
    "linkPlatformNote", "linkPlatformNoteButton", "linkedPlatformNotes"
  ];
  const elements = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));

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
      .map(record => ({ ...record, name: cleanName(record.name), scope: (record.scope || "").trim(), version: provided(record.version) }));
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
    state.installedRecords.forEach(record => {
      const key = nameKey(record.name);
      installedNameCounts.set(key, (installedNameCounts.get(key) || 0) + 1);
    });
    state.apps = state.installedRecords.map(record => {
      const key = nameKey(record.name);
      const scopedRecords = state.versionsByScope.get(record.scope);
      const namedRecords = state.versionsByName.get(key);
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
      const candidates = new Map(matchedRecords
        .filter(item => compareVersions(item.version, record.version) > 0)
        .map(item => [item.version, item]));
      const latest = provided(record.latest_version);
      if (latest && compareVersions(latest, record.version) > 0 && !candidates.has(latest)) {
        candidates.set(latest, { name: record.name, scope: record.scope, version: latest, short_description: record.short_description, compatibilities: record.compatibilities, _source: "sys_store_app latest_version" });
      }
      if (matchStatus === "unmatched" && latest) {
        matchStatus = "store";
        matchMethod = "latest_version";
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
    const reviews = app.versions.length ? candidateReviews(app) : [reviewFor(app.scope, app.version)];
    const priority = { must: 0, do_not: 1, should: 2, unassessed: 3, can: 4 };
    return reviews.sort((left, right) => priority[left.recommendation] - priority[right.recommendation])[0];
  }

  function matchLabel(app) {
    if (app.matchStatus === "matched") return app.matchMethod === "scope" ? "Exact scope match" : "Legacy name match";
    if (app.matchStatus === "ambiguous") return "Ambiguous name";
    if (app.matchStatus === "store") return "Store latest version";
    return state.versionRecords.length ? "No catalog match" : "Version catalog not loaded";
  }

  function renderApplications() {
    const query = elements.applicationSearch.value.trim().toLocaleLowerCase();
    const status = elements.applicationStatusFilter.value;
    const reviewState = elements.applicationReviewFilter.value;
    const filtered = state.apps.filter(app => {
      const searchable = `${app.name} ${app.scope} ${app.short_description || ""}`.toLocaleLowerCase();
      const hasUpdates = hasUpdateSignal(app);
      const isCurrent = ["matched", "store"].includes(app.matchStatus) && !hasUpdates;
      const reviews = candidateReviews(app);
      return (!query || searchable.includes(query))
        && (status === "all" || status === "update" && hasUpdates || status === "current" && isCurrent || status === "unmatched" && app.matchStatus === "unmatched" || status === "ambiguous" && app.matchStatus === "ambiguous")
        && (reviewState === "all" || reviewState === "unreviewed" && hasUpdates && !reviewComplete(app) || reviewState === "complete" && reviewComplete(app) || reviewState === "blocker" && reviews.some(item => item.decision === "blocker") || reviewState === "team" && reviews.some(item => item.teamRequired));
    });
    const recommendationOrder = { must: 0, do_not: 1, should: 2, unassessed: 3, can: 4 };
    const decisionOrder = { blocker: 0, hold: 1, review: 2, ready: 3 };
    filtered.sort((left, right) => {
      if (elements.applicationSort.value === "name") return left.name.localeCompare(right.name);
      if (elements.applicationSort.value === "updates") return right.versions.length - left.versions.length || left.name.localeCompare(right.name);
      if (elements.applicationSort.value === "decision") return decisionOrder[summaryReview(left).decision] - decisionOrder[summaryReview(right).decision] || left.name.localeCompare(right.name);
      return Number(hasUpdateSignal(right)) - Number(hasUpdateSignal(left))
        || Number(!reviewComplete(left)) - Number(!reviewComplete(right))
        || recommendationOrder[summaryReview(left).recommendation] - recommendationOrder[summaryReview(right).recommendation]
        || left.name.localeCompare(right.name);
    });
    state.filteredApps = filtered;
    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    state.page = Math.min(state.page, pageCount);
    const visible = filtered.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
    elements.applicationRows.innerHTML = visible.map(renderApplicationRow).join("");
    elements.applicationEmptyState.hidden = visible.length > 0;
    const emptyTitle = elements.applicationEmptyState.querySelector("strong");
    const emptyDescription = elements.applicationEmptyState.querySelector("span");
    if (!state.apps.length) {
      emptyTitle.textContent = "Import an instance export to build your upgrade list";
      emptyDescription.innerHTML = 'Upload <code>sys_store_app</code> for installed applications and <code>sys_app_version</code> for available versions. Both files stay in this browser.';
    } else if (!filtered.length) {
      emptyTitle.textContent = "No applications match these filters";
      emptyDescription.textContent = "Adjust the search or filters to see more of this inventory.";
    }
    elements.applicationResultCount.textContent = `${filtered.length.toLocaleString()} of ${state.apps.length.toLocaleString()} applications`;
    elements.applicationPageStatus.textContent = filtered.length ? `Showing ${visible.length} on page ${state.page} of ${pageCount}` : "No matching applications";
    renderPagination(pageCount);
    renderMetrics();
    renderSourceStatus();
  }

  function renderApplicationRow(app) {
    const summary = summaryReview(app);
    const updateSignal = hasUpdateSignal(app);
    const matchClass = app.matchStatus === "ambiguous" ? "ambiguous" : app.matchStatus === "unmatched" ? "unmatched" : updateSignal ? "update" : "";
    const latest = app.versions[0]?.version || app.latest_version || "";
    const versionText = app.versions.length
      ? `${app.versions.length} newer ${app.versions.length === 1 ? "version" : "versions"}${latest ? ` · latest ${latest}` : ""}`
      : isTrue(app.update_available) ? "Update flagged · target unavailable" : ["matched", "store"].includes(app.matchStatus) ? "No newer version" : "Not matched";
    const pill = (type, text) => `<span class="app-review-pill ${escapeHtml(type)}">${escapeHtml(text)}</span>`;
    const autoUpdate = isTrue(app.auto_update) ? '<span class="app-inline-status">Auto-update</span>' : "";
    const updateFlag = isTrue(app.update_available) ? '<span class="app-inline-status update-flag">Update flagged</span>' : "";
    return `<tr>
      <td><div class="app-name-cell"><strong>${escapeHtml(app.name)}</strong><small>${escapeHtml(app.scope)}</small><span class="app-inline-statuses">${autoUpdate}${updateFlag}</span></div></td>
      <td class="app-version-cell">${escapeHtml(app.version || "Unknown")}</td>
      <td><span class="app-state-pill ${matchClass}">${escapeHtml(versionText)}</span><small class="app-match-note">${escapeHtml(matchLabel(app))}</small></td>
      <td>${app.versions.length ? pill(summary.recommendation, labels.recommendation[summary.recommendation] || labels.recommendation.unassessed) : '<span class="not-applicable">Not reviewed</span>'}</td>
      <td>${app.versions.length ? pill(summary.impact, labels.impact[summary.impact] || labels.impact.unassessed) : '<span class="not-applicable">—</span>'}</td>
      <td>${app.versions.length ? pill(summary.decision, labels.decision[summary.decision] || labels.decision.review) : '<span class="not-applicable">—</span>'}</td>
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
  }

  function renderSourceStatus() {
    const indicator = document.querySelector(".source-indicator");
    if (!state.installedRecords.length) {
      elements.applicationSourceStatus.innerHTML = 'Import the instance\'s <code>sys_store_app</code> export to begin.';
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
      const storeLatest = state.apps.filter(app => app.matchStatus === "store").length;
      const uncertain = state.apps.filter(app => ["unmatched", "ambiguous"].includes(app.matchStatus)).length;
      elements.applicationMatchStatus.textContent = `${scoped} scope history · ${storeLatest} Store latest · ${named} legacy name · ${uncertain} need mapping`;
      if (uncertain) indicator.className = "source-indicator warning";
    }
  }

  function setWorkspace(name) {
    const notes = name === "notes";
    const applications = name === "applications";
    const problems = name === "problems";
    elements.notesWorkspacePanel.hidden = !notes;
    elements.applicationsWorkspacePanel.hidden = !applications;
    elements.problemFixesWorkspacePanel.hidden = !problems;
    elements.notesWorkspaceTab.classList.toggle("active", notes);
    elements.applicationsWorkspaceTab.classList.toggle("active", applications);
    elements.problemFixesWorkspaceTab.classList.toggle("active", problems);
    elements.notesWorkspaceTab.setAttribute("aria-selected", String(notes));
    elements.applicationsWorkspaceTab.setAttribute("aria-selected", String(applications));
    elements.problemFixesWorkspaceTab.setAttribute("aria-selected", String(problems));
    try { localStorage.setItem(VIEW_KEY, name); } catch { /* The selected view remains usable without storage. */ }
    if (!applications && state.activeScope) closeDrawer();
    if (problems) window.dispatchEvent(new CustomEvent("platform-problem-fixes-open"));
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
    elements.appDrawerBackdrop.hidden = false;
    elements.applicationDrawer.classList.add("open");
    elements.applicationDrawer.setAttribute("aria-hidden", "false");
    state.overflowBeforeDrawer = document.body.style.overflow;
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
    elements.applicationDrawer.classList.remove("open");
    elements.applicationDrawer.setAttribute("aria-hidden", "true");
    elements.appDrawerBackdrop.hidden = true;
    document.body.style.overflow = state.overflowBeforeDrawer;
    state.activeScope = "";
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
    writeLocalObject(REVIEW_KEY, state.reviews);
    const app = state.apps.find(record => record.scope === state.activeScope);
    if (app) updateTargetControl(app);
    renderApplications();
    showToast("Application review saved in this browser.");
  }

  function clearReview() {
    if (!state.activeScope || !state.activeVersion || !window.confirm(`Clear the review for version ${state.activeVersion}?`)) return;
    delete state.reviews[reviewKey(state.activeScope, state.activeVersion)];
    writeLocalObject(REVIEW_KEY, state.reviews);
    const app = state.apps.find(record => record.scope === state.activeScope);
    if (app) loadActiveReview(app);
    renderApplications();
    showToast("Version review cleared.");
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

  function saveNoteLinks() { writeLocalObject(NOTE_LINK_KEY, state.noteLinks); }

  function linkSelectedNote() {
    if (!state.activeScope || !elements.linkPlatformNote.value) return;
    const slug = elements.linkPlatformNote.value;
    const links = Array.isArray(state.noteLinks[state.activeScope]) ? state.noteLinks[state.activeScope] : [];
    if (!links.includes(slug)) state.noteLinks[state.activeScope] = [...links, slug];
    saveNoteLinks();
    window.dispatchEvent(new CustomEvent("platform-note-relevance-update", { detail: { slug, status: "relevant" } }));
    renderLinkedNotes();
    elements.linkPlatformNote.value = "";
    showToast("Release note linked to this application.");
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
      if (/^[=+\-@]/.test(text)) text = `'${text}`;
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

  function exportPlan() {
    const payload = {
      format: "platform-upgrade-plan", formatVersion: 1, exportedAt: new Date().toISOString(),
      applicationCount: state.apps.length, installedScopes: state.apps.map(app => app.scope),
      reviews: state.reviews, selectedTargets: state.targets, applicationNotes: state.noteLinks, noteRelevance: readNoteRelevance(), teamBrief: readTeamBrief()
    };
    downloadFile(JSON.stringify(payload, null, 2), "application/json", `platform-upgrade-plan-${new Date().toISOString().slice(0, 10)}.json`);
    showToast("Review plan exported.");
  }

  async function importPlan(file) {
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      if (backup.format !== "platform-upgrade-plan" || !backup.reviews || typeof backup.reviews !== "object" || Array.isArray(backup.reviews)) throw new Error("This file is not a Platform Upgrade Desk review plan.");
      const hasWork = Object.keys(state.reviews).length || Object.keys(state.targets).length || Object.keys(state.noteLinks).length;
      if (hasWork && !window.confirm("Replace the application reviews, targets, and note links currently saved in this browser?")) return;
      state.reviews = backup.reviews;
      state.targets = backup.selectedTargets && typeof backup.selectedTargets === "object" && !Array.isArray(backup.selectedTargets) ? backup.selectedTargets : {};
      state.noteLinks = backup.applicationNotes && typeof backup.applicationNotes === "object" && !Array.isArray(backup.applicationNotes) ? backup.applicationNotes : {};
      if (backup.noteRelevance && typeof backup.noteRelevance === "object" && !Array.isArray(backup.noteRelevance)) {
        try { localStorage.setItem("platform-upgrade-note-relevance-v1", JSON.stringify(backup.noteRelevance)); } catch { /* The imported choices remain available until this tab closes. */ }
        window.dispatchEvent(new CustomEvent("platform-note-relevance-restore", { detail: { values: backup.noteRelevance } }));
      }
      if (Array.isArray(backup.teamBrief)) window.dispatchEvent(new CustomEvent("platform-team-brief-restore", { detail: { items: backup.teamBrief } }));
      writeLocalObject(REVIEW_KEY, state.reviews);
      writeLocalObject(TARGET_KEY, state.targets);
      saveNoteLinks();
      renderApplications();
      if (state.activeScope) {
        const app = state.apps.find(record => record.scope === state.activeScope);
        if (app) { loadActiveReview(app); updateTargetControl(app); renderLinkedNotes(); }
      }
      showToast("Review plan restored.");
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
      try { await saveDataset("installedApps", imported.records, { duplicateRows: imported.duplicateRows }); } catch { showToast("Apps loaded, but browser caching is unavailable."); }
      showToast(`Loaded ${imported.records.length.toLocaleString()} unique scopes${imported.duplicateRows ? `; consolidated ${imported.duplicateRows} duplicate rows` : ""}.`);
    } catch (error) { showToast(error.message || "Could not import installed apps."); }
    finally { elements.appInventoryInput.value = ""; }
  }

  async function importVersionCatalog(file) {
    if (!file) return;
    try {
      if (state.versionRecords.length && !window.confirm("Replace the version catalog currently loaded in this browser?")) return;
      state.versionRecords = parseVersionsCsv(await file.text());
      buildApplications();
      try { await saveDataset("appVersions", state.versionRecords); } catch { showToast("Catalog loaded, but browser caching is unavailable."); }
      const matched = state.apps.filter(app => app.matchStatus === "matched").length;
      const uncertain = state.apps.filter(app => ["unmatched", "ambiguous"].includes(app.matchStatus)).length;
      showToast(`Loaded ${state.versionRecords.length.toLocaleString()} versions; ${matched} apps matched, ${uncertain} need mapping.`);
    } catch (error) { showToast(error.message || "Could not import the version catalog."); }
    finally { elements.appVersionsInput.value = ""; }
  }

  async function restoreDatasets() {
    const token = ++state.restoreToken;
    try {
      const [installed, versions] = await Promise.all([loadDataset("installedApps"), loadDataset("appVersions")]);
      if (token !== state.restoreToken || state.installedRecords.length || state.versionRecords.length) return;
      state.installedRecords = Array.isArray(installed) ? installed : Array.isArray(installed?.records) ? installed.records : [];
      state.duplicateRows = Number(installed?.duplicateRows) || 0;
      state.versionRecords = Array.isArray(versions) ? versions : Array.isArray(versions?.records) ? versions.records : [];
      buildApplications();
      if (state.installedRecords.length || state.versionRecords.length) showToast("Saved application imports restored from this browser.");
    } catch {
      elements.applicationSourceStatus.textContent = "Imports remain local to this tab; browser storage is unavailable.";
    }
  }

  function bindEvents() {
    elements.notesWorkspaceTab.addEventListener("click", () => setWorkspace("notes"));
    elements.applicationsWorkspaceTab.addEventListener("click", () => setWorkspace("applications"));
    elements.problemFixesWorkspaceTab.addEventListener("click", () => setWorkspace("problems"));
    document.querySelector(".workspace-tabs").addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const tabs = [elements.notesWorkspaceTab, elements.applicationsWorkspaceTab, elements.problemFixesWorkspaceTab];
      const index = tabs.indexOf(document.activeElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
      tabs[next].focus();
      tabs[next].click();
    });
    elements.importAppInventory.addEventListener("click", () => elements.appInventoryInput.click());
    elements.importAppVersions.addEventListener("click", () => elements.appVersionsInput.click());
    elements.importAppPlan.addEventListener("click", () => elements.appPlanInput.click());
    elements.exportAppPlan.addEventListener("click", exportPlan);
    elements.exportInstalledApps.addEventListener("click", () => exportCsv(state.installedRecords, "sys_store_app.csv"));
    elements.exportVersionCatalog.addEventListener("click", () => exportCsv(state.versionRecords, "sys_app_version.csv"));
    elements.appInventoryInput.addEventListener("change", event => importInventory(event.target.files[0]));
    elements.appVersionsInput.addEventListener("change", event => importVersionCatalog(event.target.files[0]));
    elements.appPlanInput.addEventListener("change", event => importPlan(event.target.files[0]));
    elements.applicationSearch.addEventListener("input", () => { state.page = 1; renderApplications(); });
    [elements.applicationStatusFilter, elements.applicationReviewFilter, elements.applicationSort].forEach(control => control.addEventListener("change", () => { state.page = 1; renderApplications(); }));
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
    elements.appDrawerBackdrop.addEventListener("click", closeDrawer);
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
    elements.applicationDrawer.addEventListener("keydown", event => {
      if (event.key === "Escape") { closeDrawer(); return; }
      if (event.key !== "Tab") return;
      const focusable = [...elements.applicationDrawer.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href]')].filter(node => node.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
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
    const initialView = noteRoute ? "notes" : location.hash === "#applications" ? "applications" : location.hash === "#problems" ? "problems" : localStorage.getItem(VIEW_KEY) || "notes";
    setWorkspace(["notes", "applications", "problems"].includes(initialView) ? initialView : "notes");
  } catch { setWorkspace("notes"); }
  restoreDatasets();
})();