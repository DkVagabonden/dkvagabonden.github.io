(() => {
  "use strict";

  const REVIEW_COLLECTIONS_KEY = "platform-upgrade-plugin-review-collections-v2";
  const TARGET_COLLECTIONS_KEY = "platform-upgrade-plugin-target-collections-v2";
  const HISTORY_LABELS_KEY = "platform-upgrade-plugin-history-labels-v1";
  const HISTORY_DB_NAME = "platform-upgrade-desk-data";
  const HISTORY_STORE_NAME = "datasets";
  const HISTORY_RECORD_PREFIX = "pluginHistory:";
  const ACTIVE_HISTORY_KEY = "platform-upgrade-plugin-active-history-v1";
  const PAGE_SIZE = 30;
  const labels = {
    recommendation: { unassessed: "Not assessed", must: "Must update", should: "Should update", can: "Can update", do_not: "Do not update" },
    impact: { unassessed: "Not assessed", low: "Low", medium: "Medium", high: "High" },
    decision: { review: "Not reviewed", ready: "Ready", hold: "On hold", blocker: "Show stopper" }
  };
  const elements = Object.fromEntries([
    "pluginsWorkspacePanel", "pluginHistoryStatus", "pluginHistoryInput", "pluginHistoryLabel", "importPluginHistory", "exportPluginHistory", "savedPluginHistory", "loadSavedPluginHistory", "forgetSavedPluginHistory", "pluginHistoryCount", "pluginUpgradedCount", "pluginReviewedCount", "pluginReviewedDetail", "pluginNewerCount",
    "pluginSearch", "pluginDispositionFilter", "pluginLatestFilter", "pluginReviewFilter", "pluginSort", "resetPluginFilters", "pluginHistoryError", "pluginHistoryRows", "pluginHistoryEmpty", "pluginHistoryPagination", "pluginHistoryResultCount", "pluginHistoryPageStatus",
    "pluginDrawerBackdrop", "pluginReviewDrawer", "pluginReviewTitle", "pluginReviewHistory", "closePluginReview", "pluginReviewForm", "pluginFromVersion", "pluginToVersion", "pluginDispositionBadge", "pluginReviewVersion", "pluginLatestVersion", "pluginArchive", "pluginVersionStatus", "pluginTargetVersion", "pluginTargetStatus", "pluginRecommendation", "pluginImpact", "pluginDecision", "pluginReviewOwner", "pluginReviewNotes", "pluginReviewAction", "pluginTeamRequired", "pluginRelatedNotes", "pluginRelatedPrbStatus", "pluginRelatedPrbs", "clearPluginReview"
  ].map(id => [id, document.getElementById(id)]));
  const state = {
    records: [], filtered: [], products: [], problemProducts: new Map(), problemsReady: false, reviewsByDataset: readObject(REVIEW_COLLECTIONS_KEY), targetsByDataset: readObject(TARGET_COLLECTIONS_KEY), labelsByDataset: readObject(HISTORY_LABELS_KEY),
    reviews: {}, targets: {}, datasetId: "", datasetLabel: "", fileName: "", page: 1, loaded: false, restorePromise: null, savedLocally: false, activeKey: "", activeVersion: "", bodyOverflow: ""
  };

  function readObject(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    } catch { return {}; }
  }

  function saveObject(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { elements.pluginHistoryStatus.textContent = "Browser storage is full; export the review plan to keep changes."; return false; }
  }

  function removeObjectEntry(key, entryKey) {
    const stored = localStorage.getItem(key);
    if (!stored) return;
    const collection = JSON.parse(stored);
    if (!collection || typeof collection !== "object" || Array.isArray(collection)) throw new Error("Saved review data could not be verified for removal.");
    delete collection[entryKey];
    localStorage.setItem(key, JSON.stringify(collection));
    const verification = JSON.parse(localStorage.getItem(key) || "{}");
    if (Object.hasOwn(verification, entryKey)) throw new Error("Saved review data could not be removed.");
  }

  function openHistoryDatabase() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error("Browser storage is unavailable.")); return; }
      const request = indexedDB.open(HISTORY_DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(HISTORY_STORE_NAME)) request.result.createObjectStore(HISTORY_STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("Could not open browser storage."));
    });
  }

  async function historyStoreRequest(mode, callback) {
    const database = await openHistoryDatabase();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(HISTORY_STORE_NAME, mode);
      const request = callback(transaction.objectStore(HISTORY_STORE_NAME));
      transaction.oncomplete = () => { database.close(); resolve(request?.result); };
      transaction.onerror = () => { database.close(); reject(transaction.error || new Error("Browser storage request failed.")); };
      transaction.onabort = () => { database.close(); reject(transaction.error || new Error("Browser storage request was canceled.")); };
    });
  }

  function historyStorageKey(datasetId) { return `${HISTORY_RECORD_PREFIX}${datasetId}`; }

  function getActiveHistoryId() {
    try { return localStorage.getItem(ACTIVE_HISTORY_KEY) || ""; }
    catch { return ""; }
  }

  function setActiveHistoryId(datasetId) {
    try { localStorage.setItem(ACTIVE_HISTORY_KEY, datasetId); return true; }
    catch { return false; }
  }

  function clearActiveHistoryId() {
    try { localStorage.removeItem(ACTIVE_HISTORY_KEY); }
    catch { /* A stale pointer is ignored when its saved dataset is absent. */ }
  }

  function saveHistoryDataset(datasetId, dataset) {
    return historyStoreRequest("readwrite", store => store.put({ kind: "plugin-history", datasetId, ...dataset, savedAt: new Date().toISOString() }, historyStorageKey(datasetId)));
  }

  function readHistoryDataset(datasetId) {
    return historyStoreRequest("readonly", store => store.get(historyStorageKey(datasetId)));
  }

  async function listHistoryDatasets() {
    const datasets = await historyStoreRequest("readonly", store => store.getAll());
    return (datasets || []).filter(dataset => dataset?.kind === "plugin-history").sort((left, right) => right.savedAt.localeCompare(left.savedAt));
  }

  function deleteHistoryDataset(datasetId) {
    return historyStoreRequest("readwrite", store => store.delete(historyStorageKey(datasetId)));
  }

  function persistCurrentReviewData() {
    if (!state.datasetId || !state.savedLocally) return false;
    state.reviewsByDataset[state.datasetId] = state.reviews;
    state.targetsByDataset[state.datasetId] = state.targets;
    state.labelsByDataset[state.datasetId] = state.datasetLabel;
    saveObject(REVIEW_COLLECTIONS_KEY, state.reviewsByDataset);
    saveObject(TARGET_COLLECTIONS_KEY, state.targetsByDataset);
    return [
      saveObject(REVIEW_COLLECTIONS_KEY, state.reviewsByDataset),
      saveObject(TARGET_COLLECTIONS_KEY, state.targetsByDataset),
      saveObject(HISTORY_LABELS_KEY, state.labelsByDataset)
    ].every(Boolean);
  }

  async function fingerprint(text) {
    if (globalThis.crypto?.subtle) {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
    }
    let hash = 0xcbf29ce484222325n;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= BigInt(text.charCodeAt(index));
      hash = BigInt.asUintN(64, hash * 0x100000001b3n);
    }
    return hash.toString(16).padStart(16, "0");
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function clean(value) {
    const text = String(value ?? "").trim().replace(/^'+/, "").trim();
    return /^(undefined|null|n\/a)$/i.test(text) ? "" : text;
  }

  function normalizeName(value) { return clean(value).toLocaleLowerCase().replace(/[^a-z0-9]/g, ""); }

  function parseCsv(text) {
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
    const required = ["application.name", "from_version", "to_version", "application.latest_version", "disposition", "upgrade_history"];
    if (!required.every(header => headers.includes(header))) throw new Error("History CSV is missing one or more expected columns.");
    const records = rows.map(cells => Object.fromEntries(headers.map((header, index) => [header, (cells[index] || "").trim()])))
      .filter(row => clean(row["application.name"]))
      .map(row => {
        const name = clean(row["application.name"]);
        const fromVersion = clean(row.from_version);
        const toVersion = clean(row.to_version);
        const latestVersion = clean(row["application.latest_version"]);
        const archive = clean(row.upgrade_history);
        const disposition = clean(row.disposition);
        const key = `${normalizeName(name)}::${archive}::${fromVersion}::${toVersion}::${latestVersion}::${disposition}`;
        const requiredVersions = toVersion ? [toVersion] : [];
        const optionalVersions = latestVersion && latestVersion !== toVersion ? [latestVersion] : [];
        const candidates = [...new Set([...requiredVersions, ...optionalVersions])];
        return { key, name, fromVersion, toVersion, latestVersion, disposition, archive, requiredVersions, optionalVersions, candidates };
      });
    const unique = new Map(records.map(record => [record.key, record]));
    if (!unique.size) throw new Error("The CSV contains no application history rows.");
    return [...unique.values()];
  }

  function compareVersions(left, right) {
    const leftParts = String(left || "").split(/[.+-]/);
    const rightParts = String(right || "").split(/[.+-]/);
    for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
      const a = leftParts[index] || "0";
      const b = rightParts[index] || "0";
      const an = /^\d+$/.test(a) ? Number(a) : null;
      const bn = /^\d+$/.test(b) ? Number(b) : null;
      if (an !== null && bn !== null && an !== bn) return an - bn;
      if (a !== b) return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
    }
    return 0;
  }

  function hasNewerLatest(record) {
    return Boolean(record.toVersion && record.latestVersion && compareVersions(record.latestVersion, record.toVersion) > 0);
  }

  function reviewKey(record, version) { return `${record.key}::${version}`; }

  function reviewFor(record, version) {
    return { recommendation: "unassessed", impact: "unassessed", decision: "review", owner: "", notes: "", action: "", teamRequired: false, updatedAt: "", ...(state.reviews[reviewKey(record, version)] || {}) };
  }

  function reviewsFor(record) { return record.candidates.map(version => reviewFor(record, version)); }

  function requiredReviews(record) { return record.requiredVersions.map(version => reviewFor(record, version)); }

  function isComplete(record) { return record.requiredVersions.length > 0 && requiredReviews(record).every(review => review.decision !== "review"); }

  function summaryReview(record) {
    const priority = { must: 0, do_not: 1, should: 2, unassessed: 3, can: 4 };
    const reviews = record.requiredVersions.length ? requiredReviews(record) : record.candidates.length ? reviewsFor(record) : [reviewFor(record, record.toVersion || record.latestVersion)];
    return reviews.sort((left, right) => priority[left.recommendation] - priority[right.recommendation])[0];
  }

  function exactNotes(record) {
    const key = normalizeName(record.name);
    return state.products.filter(product => normalizeName(product.name) === key);
  }

  function exactProblemFixes(record) { return state.problemProducts.get(normalizeName(record.name)) || []; }

  function renderRelatedPrbs(record) {
    const fixes = exactProblemFixes(record);
    elements.pluginRelatedPrbStatus.textContent = state.problemsReady
      ? fixes.length ? `${fixes.length} PRBs match this product name exactly.` : "No exact PRB product match. Search the Problem fixes tab if the product is named differently there."
      : "Loading the bundled PRB index.";
    elements.pluginRelatedPrbs.innerHTML = fixes.length
      ? fixes.slice(0, 30).map(fix => `<li><button class="plugin-prb-open" type="button" data-plugin-prb="${escapeHtml(fix.prb)}">${escapeHtml(fix.prb)} · ${escapeHtml(fix.family)} · ${escapeHtml(fix.patch)}</button></li>`).join("")
      : '<li class="empty-linked-note">No exact PRB product match.</li>';
    if (fixes.length > 30) {
      const more = document.createElement("li");
      more.className = "empty-linked-note";
      more.textContent = `Showing the first 30 of ${fixes.length} matching PRBs.`;
      elements.pluginRelatedPrbs.append(more);
    }
  }

  function activateHistory(datasetId, dataset, savedLocally = true) {
    state.records = dataset.records;
    state.datasetId = datasetId;
    state.datasetLabel = dataset.datasetLabel;
    state.fileName = dataset.fileName;
    state.savedLocally = savedLocally;
    state.reviews = state.reviewsByDataset[datasetId] || {};
    state.targets = state.targetsByDataset[datasetId] || {};
    if (savedLocally) {
      state.labelsByDataset[datasetId] = dataset.datasetLabel;
      saveObject(HISTORY_LABELS_KEY, state.labelsByDataset);
    }
    state.page = 1;
    state.loaded = true;
    elements.pluginHistoryLabel.value = dataset.datasetLabel;
    elements.importPluginHistory.disabled = !dataset.datasetLabel.trim();
    elements.forgetSavedPluginHistory.disabled = !savedLocally;
    window.dispatchEvent(new CustomEvent("platform-problem-fixes-request"));
    window.dispatchEvent(new CustomEvent("platform-plugin-history-ready", {
      detail: { apps: dataset.records.map(record => ({ name: record.name, archive: record.archive })) }
    }));
    elements.pluginHistoryCount.textContent = dataset.records.length.toLocaleString();
    elements.pluginUpgradedCount.textContent = dataset.records.filter(record => record.disposition.toLowerCase() === "upgraded").length.toLocaleString();
    elements.pluginHistoryStatus.textContent = `${dataset.records.length.toLocaleString()} rows · ${dataset.datasetLabel} · ${dataset.fileName} (${savedLocally ? "saved on this device" : "this session only; could not save"})`;
    elements.exportPluginHistory.disabled = false;
    render();
  }

  async function refreshSavedHistoryOptions(selectedId = "") {
    const datasets = await listHistoryDatasets();
    const options = ['<option value="">Select saved history</option>', ...datasets.map(dataset => {
      const date = new Date(dataset.savedAt).toLocaleDateString();
      const label = `${dataset.datasetLabel} · ${dataset.fileName} · ${date}`;
      return `<option value="${escapeHtml(dataset.datasetId)}">${escapeHtml(label)}</option>`;
    })];
    elements.savedPluginHistory.innerHTML = options.join("");
    elements.savedPluginHistory.value = datasets.some(dataset => dataset.datasetId === selectedId) ? selectedId : "";
    elements.loadSavedPluginHistory.disabled = !elements.savedPluginHistory.value;
    elements.forgetSavedPluginHistory.disabled = !elements.savedPluginHistory.value;
    return datasets;
  }

  async function restoreSavedHistory() {
    const datasets = await listHistoryDatasets();
    const activeId = getActiveHistoryId();
    const dataset = datasets.find(item => item.datasetId === activeId) || datasets[0];
    await refreshSavedHistoryOptions(dataset?.datasetId || "");
    if (!dataset) {
      if (activeId) clearActiveHistoryId();
      renderEmptyHistory();
      return;
    }
    setActiveHistoryId(dataset.datasetId);
    activateHistory(dataset.datasetId, dataset);
  }

  async function loadSelectedSavedHistory() {
    const datasetId = elements.savedPluginHistory.value;
    if (!datasetId) return;
    try {
      const dataset = await readHistoryDataset(datasetId);
      if (!dataset?.records?.length) throw new Error("That saved history is no longer available.");
      const activeSelectionSaved = setActiveHistoryId(datasetId);
      activateHistory(datasetId, dataset);
      await refreshSavedHistoryOptions(datasetId);
      elements.pluginHistoryError.hidden = true;
      if (!activeSelectionSaved) {
        elements.pluginHistoryStatus.textContent = `${dataset.records.length.toLocaleString()} rows · ${dataset.datasetLabel} · ${dataset.fileName} (saved on this device)`;
        elements.pluginHistoryError.textContent = "This history loaded, but the browser could not remember it as the active selection. Choose it again after reopening.";
        elements.pluginHistoryError.hidden = false;
      }
    } catch (error) {
      elements.pluginHistoryStatus.textContent = "Could not load the selected saved history.";
      elements.pluginHistoryError.textContent = error.message || "Browser storage is unavailable.";
      elements.pluginHistoryError.hidden = false;
    }
  }

  function resetHistoryState() {
    if (state.activeKey) closeReview();
    state.records = [];
    state.filtered = [];
    state.reviews = {};
    state.targets = {};
    state.datasetId = "";
    state.datasetLabel = "";
    state.fileName = "";
    state.loaded = false;
    state.savedLocally = false;
    elements.pluginHistoryLabel.value = "";
    elements.importPluginHistory.disabled = true;
    elements.pluginSearch.value = "";
    renderEmptyHistory();
  }

  async function forgetSelectedSavedHistory() {
    const datasetId = elements.savedPluginHistory.value;
    if (!datasetId) return;
    try {
      const dataset = await readHistoryDataset(datasetId);
      const label = dataset?.datasetLabel || "this saved history";
      if (!window.confirm(`Remove ${label} and its local review decisions from this browser?`)) return;
      removeObjectEntry(REVIEW_COLLECTIONS_KEY, datasetId);
      removeObjectEntry(TARGET_COLLECTIONS_KEY, datasetId);
      removeObjectEntry(HISTORY_LABELS_KEY, datasetId);
      await deleteHistoryDataset(datasetId);
      delete state.reviewsByDataset[datasetId];
      delete state.targetsByDataset[datasetId];
      delete state.labelsByDataset[datasetId];
      const activeId = getActiveHistoryId();
      const remaining = await listHistoryDatasets();
      let switchedDataset = null;
      let activeSelectionSaved = true;
      if (activeId === datasetId || state.datasetId === datasetId) {
        if (remaining.length) {
          switchedDataset = remaining[0];
          activeSelectionSaved = setActiveHistoryId(switchedDataset.datasetId);
          await refreshSavedHistoryOptions(remaining[0].datasetId);
          activateHistory(remaining[0].datasetId, remaining[0]);
        } else {
          clearActiveHistoryId();
          await refreshSavedHistoryOptions();
          resetHistoryState();
        }
      } else {
        await refreshSavedHistoryOptions(state.datasetId);
      }
      if (switchedDataset && !activeSelectionSaved) {
        elements.pluginHistoryStatus.textContent = `Removed ${label}; loaded ${switchedDataset.datasetLabel}, saved on this device.`;
        elements.pluginHistoryError.textContent = "The remaining history loaded, but the browser could not remember it as the active selection. Choose it again after reopening.";
        elements.pluginHistoryError.hidden = false;
      } else {
        elements.pluginHistoryStatus.textContent = `Removed ${label} and its local review decisions from this browser.`;
      }
    } catch (error) {
      elements.pluginHistoryStatus.textContent = "Could not remove the saved history.";
      elements.pluginHistoryError.textContent = error.message || "Browser storage is unavailable.";
      elements.pluginHistoryError.hidden = false;
    }
  }

  async function importHistory(file) {
    if (!file) return;
    const datasetLabel = elements.pluginHistoryLabel.value.trim();
    if (!datasetLabel) {
      elements.pluginHistoryStatus.textContent = "Enter an instance or upgrade name before importing its history.";
      elements.pluginHistoryLabel.focus();
      elements.pluginHistoryInput.value = "";
      return;
    }
    elements.importPluginHistory.disabled = true;
    elements.pluginHistoryError.hidden = true;
    elements.pluginHistoryStatus.textContent = `Reading ${file.name} locally`;
    try {
      const text = await file.text();
      const records = parseCsv(text);
      if (state.loaded && !window.confirm("Replace the history currently loaded in this browser? Saved reviews for each history file remain separated locally.")) return;
      const datasetId = await fingerprint(`${normalizeName(datasetLabel)}\n${text}`);
      const dataset = { records, datasetLabel, fileName: file.name };
      let savedLocally = false;
      let storageError = null;
      try {
        await saveHistoryDataset(datasetId, dataset);
        savedLocally = true;
      } catch (error) { storageError = error; }
      if (savedLocally) {
        if (!setActiveHistoryId(datasetId)) {
          storageError ||= new Error("The history was saved, but the active selection could not be updated.");
          clearActiveHistoryId();
        }
      }
      activateHistory(datasetId, dataset, savedLocally);
      try { await refreshSavedHistoryOptions(datasetId); }
      catch (error) { storageError ||= error; }
      if (storageError) {
        elements.pluginHistoryError.textContent = `History loaded for this session, but could not be saved in this browser: ${storageError.message || "browser storage unavailable"}`;
        elements.pluginHistoryError.hidden = false;
      }
    } catch (error) {
      elements.pluginHistoryStatus.textContent = "Could not import upgrade history";
      elements.pluginHistoryError.textContent = error.message || "Could not read this CSV.";
      elements.pluginHistoryError.hidden = false;
    } finally {
      elements.importPluginHistory.disabled = false;
      elements.pluginHistoryInput.value = "";
    }
  }

  function loadHistory() {
    if (state.loaded) { render(); return Promise.resolve(); }
    if (state.restorePromise) return state.restorePromise;
    elements.pluginHistoryStatus.textContent = "Restoring history saved in this browser…";
    state.restorePromise = restoreSavedHistory()
      .catch(error => {
        renderEmptyHistory();
        elements.pluginHistoryStatus.textContent = "Could not restore saved history from this browser.";
        elements.pluginHistoryError.textContent = error.message || "Browser storage is unavailable.";
        elements.pluginHistoryError.hidden = false;
      })
      .finally(() => { state.restorePromise = null; });
    return state.restorePromise;
  }

  function renderEmptyHistory() {
    elements.pluginHistoryStatus.textContent = "No history loaded. Import your own sys_upgrade_app_version_history CSV; the most recently used history is saved in this browser only.";
    elements.pluginHistoryCount.textContent = "--";
    elements.pluginUpgradedCount.textContent = "--";
    elements.pluginNewerCount.textContent = "--";
    elements.pluginReviewedCount.textContent = "0%";
    elements.pluginReviewedDetail.textContent = "no history loaded";
    elements.pluginHistoryRows.innerHTML = "";
    elements.pluginHistoryEmpty.hidden = false;
    elements.pluginHistoryEmpty.querySelector("strong").textContent = "Import your instance upgrade history";
    elements.pluginHistoryEmpty.querySelector("span").textContent = "Choose your sys_upgrade_app_version_history CSV. It is read locally and never uploaded.";
    elements.pluginHistoryResultCount.textContent = "No history loaded";
    elements.pluginHistoryPageStatus.textContent = "No file sent to a server";
    elements.exportPluginHistory.disabled = true;
    elements.forgetSavedPluginHistory.disabled = true;
  }

  function render() {
    if (!state.loaded) return;
    const query = elements.pluginSearch.value.trim().toLocaleLowerCase();
    const disposition = elements.pluginDispositionFilter.value;
    const latestFilter = elements.pluginLatestFilter.value;
    const reviewFilter = elements.pluginReviewFilter.value;
    const filtered = state.records.filter(record => {
      const searchText = `${record.name} ${record.fromVersion} ${record.toVersion} ${record.latestVersion} ${record.disposition} ${record.archive}`.toLocaleLowerCase();
      const reviews = reviewsFor(record);
      return (!query || searchText.includes(query))
        && (disposition === "all" || record.disposition === disposition)
        && (latestFilter === "all" || latestFilter === "newer" && hasNewerLatest(record) || latestFilter === "current" && !hasNewerLatest(record))
        && (reviewFilter === "all" || reviewFilter === "unreviewed" && record.requiredVersions.length > 0 && !isComplete(record) || reviewFilter === "complete" && isComplete(record) || reviewFilter === "blocker" && reviews.some(review => review.decision === "blocker") || reviewFilter === "team" && reviews.some(review => review.teamRequired));
    });
    const recommendationOrder = { must: 0, do_not: 1, should: 2, unassessed: 3, can: 4 };
    const decisionOrder = { blocker: 0, hold: 1, review: 2, ready: 3 };
    filtered.sort((left, right) => {
      if (elements.pluginSort.value === "name") return left.name.localeCompare(right.name);
      if (elements.pluginSort.value === "latest") return compareVersions(right.latestVersion, left.latestVersion) || left.name.localeCompare(right.name);
      return Number(hasNewerLatest(right)) - Number(hasNewerLatest(left)) || Number(!isComplete(left)) - Number(!isComplete(right)) || recommendationOrder[summaryReview(left).recommendation] - recommendationOrder[summaryReview(right).recommendation] || left.name.localeCompare(right.name);
    });
    state.filtered = filtered;
    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    state.page = Math.min(state.page, pageCount);
    const visible = filtered.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
    elements.pluginHistoryRows.innerHTML = visible.map(record => {
      const index = state.records.indexOf(record);
      const review = summaryReview(record);
      const notes = exactNotes(record);
      const note = notes[0];
      const latestState = hasNewerLatest(record) ? '<span class="plugin-latest-badge newer">Optional newer</span>' : '<span class="plugin-latest-badge">At latest</span>';
      const decision = record.candidates.length ? `<span class="app-review-pill ${escapeHtml(review.decision)}">${escapeHtml(labels.decision[review.decision] || labels.decision.review)}</span>` : '<span class="not-applicable">No version</span>';
      return `<tr>
        <td><button class="plugin-name-button" type="button" data-plugin-review="${index}">${escapeHtml(record.name)}</button>${note ? `<button class="plugin-note-match" type="button" data-plugin-note="${escapeHtml(note.slug)}">Release note: ${escapeHtml(note.name)}</button>` : ""}</td>
        <td class="app-version-cell">${escapeHtml(record.fromVersion || "Not previously installed")}</td>
        <td class="app-version-cell">${escapeHtml(record.toVersion || "Unknown")}</td>
        <td class="app-version-cell">${escapeHtml(record.latestVersion || "Unknown")}<small class="app-match-note">${latestState}</small></td>
        <td><span class="app-state-pill ${record.disposition.toLowerCase() === "upgraded" ? "update" : ""}">${escapeHtml(record.disposition)}</span><small class="app-match-note">${escapeHtml(record.archive)}</small></td>
        <td>${decision}</td>
      </tr>`;
    }).join("");
    elements.pluginHistoryEmpty.hidden = visible.length > 0;
    elements.pluginHistoryResultCount.textContent = `${filtered.length.toLocaleString()} of ${state.records.length.toLocaleString()} plugins`;
    elements.pluginHistoryPageStatus.textContent = filtered.length ? `Showing ${visible.length} on page ${state.page} of ${pageCount}` : "No matching plugins";
    renderPagination(pageCount);
    renderMetrics();
  }

  function renderMetrics() {
    const candidates = state.records.reduce((count, record) => count + record.requiredVersions.length, 0);
    const reviewed = state.records.reduce((count, record) => count + requiredReviews(record).filter(review => review.decision !== "review").length, 0);
    elements.pluginReviewedCount.textContent = `${candidates ? Math.round(reviewed / candidates * 100) : 0}%`;
    elements.pluginReviewedDetail.textContent = candidates ? `${reviewed} of ${candidates} version decisions` : "no version decisions yet";
    elements.pluginNewerCount.textContent = state.records.filter(hasNewerLatest).length.toLocaleString();
  }

  function renderPagination(pageCount) {
    if (pageCount <= 1) { elements.pluginHistoryPagination.innerHTML = ""; return; }
    const pages = [...new Set([1, state.page - 1, state.page, state.page + 1, pageCount])].filter(page => page >= 1 && page <= pageCount).sort((left, right) => left - right);
    let previous = 0;
    const buttons = pages.map(page => {
      const gap = page - previous > 1 ? '<span aria-hidden="true">…</span>' : "";
      previous = page;
      return `${gap}<button type="button" data-plugin-page="${page}" class="${page === state.page ? "active" : ""}" aria-label="Page ${page}" ${page === state.page ? 'aria-current="page"' : ""}>${page}</button>`;
    }).join("");
    elements.pluginHistoryPagination.innerHTML = `<button type="button" data-plugin-page="${state.page - 1}" aria-label="Previous page" ${state.page === 1 ? "disabled" : ""}>‹</button>${buttons}<button type="button" data-plugin-page="${state.page + 1}" aria-label="Next page" ${state.page === pageCount ? "disabled" : ""}>›</button>`;
  }

  function openReview(record) {
    state.activeKey = record.key;
    elements.pluginReviewTitle.textContent = record.name;
    elements.pluginReviewHistory.textContent = record.archive;
    elements.pluginFromVersion.textContent = record.fromVersion || "Not previously installed";
    elements.pluginToVersion.textContent = record.toVersion || "Unknown";
    elements.pluginLatestVersion.textContent = record.latestVersion || "Unknown";
    elements.pluginArchive.textContent = record.archive;
    elements.pluginDispositionBadge.textContent = record.disposition;
    elements.pluginDispositionBadge.className = `match-badge${hasNewerLatest(record) ? " ambiguous" : ""}`;
    elements.pluginVersionStatus.textContent = hasNewerLatest(record) ? `Review ${record.toVersion} as the recorded archive version. ${record.latestVersion} is a newer optional Store version and does not block this upgrade review.` : "The recorded archive version matches the latest reported version.";
    const options = record.candidates.map(version => `<option value="${escapeHtml(version)}">${escapeHtml(version)}${record.requiredVersions.includes(version) ? " · required archive version" : " · optional latest version"}</option>`).join("");
    elements.pluginReviewVersion.innerHTML = options;
    elements.pluginTargetVersion.innerHTML = `<option value="">Not selected</option>${options}`;
    state.activeVersion = record.candidates[0] || "";
    loadReview(record);
    renderRelatedNotes(record);
    renderRelatedPrbs(record);
    renderRelatedPrbs(record);
    elements.pluginDrawerBackdrop.hidden = false;
    elements.pluginReviewDrawer.classList.add("open");
    elements.pluginReviewDrawer.setAttribute("aria-hidden", "false");
    state.bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    elements.closePluginReview.focus();
  }

  function loadReview(record) {
    state.activeVersion = elements.pluginReviewVersion.value || state.activeVersion;
    const review = reviewFor(record, state.activeVersion);
    elements.pluginRecommendation.value = review.recommendation;
    elements.pluginImpact.value = review.impact;
    elements.pluginDecision.value = review.decision;
    elements.pluginReviewOwner.value = review.owner;
    elements.pluginReviewNotes.value = review.notes;
    elements.pluginReviewAction.value = review.action;
    elements.pluginTeamRequired.checked = Boolean(review.teamRequired);
    updateTarget(record);
  }

  function updateTarget(record) {
    const remaining = record.requiredVersions.filter(version => reviewFor(record, version).decision === "review").length;
    const target = record.candidates.includes(state.targets[record.key]) ? state.targets[record.key] : "";
    const targetIsNewer = Boolean(record.toVersion && target && compareVersions(target, record.toVersion) > 0);
    elements.pluginTargetVersion.value = target;
    elements.pluginTargetVersion.disabled = !record.requiredVersions.length || remaining > 0;
    elements.pluginTargetStatus.closest(".target-version-field").classList.toggle("warning", targetIsNewer);
    elements.pluginTargetStatus.textContent = !record.requiredVersions.length
      ? "No target version is listed in the history export."
      : remaining
        ? `${remaining} required archive ${remaining === 1 ? "version decision" : "version decisions"} remaining before selecting a target.`
        : target
          ? targetIsNewer
            ? `Caution: ${target} is later than the archive-recorded version (${record.toVersion}); assess it as a separate optional update.`
            : `Target selected: ${target}${record.optionalVersions.length ? ` · ${record.latestVersion} remains optional` : ""}`
          : `Required archive version reviewed. Select the target${record.optionalVersions.length ? `; ${record.latestVersion} is optional` : ""}.`;
  }

  function closeReview() {
    elements.pluginReviewDrawer.classList.remove("open");
    elements.pluginReviewDrawer.setAttribute("aria-hidden", "true");
    elements.pluginDrawerBackdrop.hidden = true;
    document.body.style.overflow = state.bodyOverflow;
    state.activeKey = "";
    state.activeVersion = "";
  }

  function saveReview(event) {
    event.preventDefault();
    const record = state.records.find(item => item.key === state.activeKey);
    if (!record || !state.activeVersion) return;
    state.reviews[reviewKey(record, state.activeVersion)] = {
      recommendation: elements.pluginRecommendation.value,
      impact: elements.pluginImpact.value,
      decision: elements.pluginDecision.value,
      owner: elements.pluginReviewOwner.value.trim(),
      notes: elements.pluginReviewNotes.value.trim(),
      action: elements.pluginReviewAction.value.trim(),
      teamRequired: elements.pluginTeamRequired.checked,
      updatedAt: new Date().toISOString()
    };
    const persisted = persistCurrentReviewData();
    updateTarget(record);
    render();
    showPluginToast(persisted ? "Plugin review saved on this device." : state.savedLocally ? "Plugin review kept for this session; browser storage could not save it." : "Plugin review kept for this session only.");
  }

  function clearReview() {
    const record = state.records.find(item => item.key === state.activeKey);
    if (!record || !state.activeVersion || !window.confirm(`Clear the review for ${record.name} ${state.activeVersion}?`)) return;
    delete state.reviews[reviewKey(record, state.activeVersion)];
    const persisted = persistCurrentReviewData();
    loadReview(record);
    render();
    showPluginToast(persisted ? "Plugin review cleared on this device." : state.savedLocally ? "Review cleared for this session; browser storage could not save the change." : "Review cleared for this session only.");
  }

  function renderRelatedNotes(record) {
    const key = normalizeName(record.name);
    const notes = state.products.filter(product => normalizeName(product.name) === key);
    elements.pluginRelatedNotes.innerHTML = notes.length
      ? notes.map(note => `<li><button class="linked-note-open" type="button" data-plugin-note="${escapeHtml(note.slug)}">${escapeHtml(note.name)}</button></li>`).join("")
      : '<li class="empty-linked-note">No exact note-title match; browse All areas or use a manual relevance decision.</li>';
  }

  function renderRelatedPrbs(record) {
    const fixes = exactProblemFixes(record);
    elements.pluginRelatedPrbStatus.textContent = state.problemsReady
      ? fixes.length ? `${fixes.length} PRBs match this product name exactly.` : "No exact PRB product match. Search the Problem fixes tab if the product is named differently there."
      : "Loading the bundled PRB index.";
    elements.pluginRelatedPrbs.innerHTML = fixes.length
      ? fixes.slice(0, 30).map(fix => `<li><button class="plugin-prb-open" type="button" data-plugin-prb="${escapeHtml(fix.prb)}">${escapeHtml(fix.prb)} · ${escapeHtml(fix.family)} · ${escapeHtml(fix.patch)}</button></li>`).join("")
      : '<li class="empty-linked-note">No exact PRB product match.</li>';
    if (fixes.length > 30) {
      const more = document.createElement("li");
      more.className = "empty-linked-note";
      more.textContent = `Showing the first 30 of ${fixes.length} matching PRBs.`;
      elements.pluginRelatedPrbs.append(more);
    }
  }

  function showPluginToast(message) {
    let toast = document.getElementById("appToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "appToast"; toast.className = "app-toast"; toast.setAttribute("role", "status");
      document.body.append(toast);
    }
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(showPluginToast.timer);
    showPluginToast.timer = setTimeout(() => { toast.hidden = true; }, 2800);
  }

  async function exportHistory() {
    if (!state.records.length) return;
    const headers = ["application.name", "from_version", "to_version", "application.latest_version", "disposition", "upgrade_history"];
    const quote = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [headers.map(quote).join(","), ...state.filtered.map(record => [record.name, record.fromVersion, record.toVersion, record.latestVersion, record.disposition, record.archive].map(quote).join(","))].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = "plugin-upgrade-history.csv"; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function bindEvents() {
    elements.pluginSearch.addEventListener("input", () => { state.page = 1; render(); });
    [elements.pluginDispositionFilter, elements.pluginLatestFilter, elements.pluginReviewFilter, elements.pluginSort].forEach(control => control.addEventListener("change", () => { state.page = 1; render(); }));
    elements.resetPluginFilters.addEventListener("click", () => {
      elements.pluginSearch.value = ""; elements.pluginDispositionFilter.value = "all"; elements.pluginLatestFilter.value = "all"; elements.pluginReviewFilter.value = "all"; elements.pluginSort.value = "priority"; state.page = 1; render();
    });
    elements.pluginHistoryRows.addEventListener("click", event => {
      const note = event.target.closest("[data-plugin-note]");
      const review = event.target.closest("[data-plugin-review]");
      if (note) {
        document.querySelector("#notesWorkspaceTab").click();
        window.dispatchEvent(new CustomEvent("platform-note-open", { detail: { slug: note.dataset.pluginNote } }));
      } else if (review) openReview(state.records[Number(review.dataset.pluginReview)]);
    });
    elements.pluginRelatedNotes.addEventListener("click", event => {
      const note = event.target.closest("[data-plugin-note]");
      if (note) {
        closeReview();
        document.querySelector("#notesWorkspaceTab").click();
        window.dispatchEvent(new CustomEvent("platform-note-open", { detail: { slug: note.dataset.pluginNote } }));
      }
    });
    elements.pluginRelatedPrbs.addEventListener("click", event => {
      const button = event.target.closest("[data-plugin-prb]");
      if (!button) return;
      const prb = button.dataset.pluginPrb;
      closeReview();
      document.querySelector("#problemFixesWorkspaceTab").click();
      window.dispatchEvent(new CustomEvent("platform-prb-open", { detail: { prb } }));
    });
    elements.pluginRelatedPrbs.addEventListener("click", event => {
      const button = event.target.closest("[data-plugin-prb]");
      if (!button) return;
      closeReview();
      document.querySelector("#problemFixesWorkspaceTab").click();
      window.dispatchEvent(new CustomEvent("platform-prb-open", { detail: { prb: button.dataset.pluginPrb } }));
    });
    elements.pluginHistoryPagination.addEventListener("click", event => {
      const button = event.target.closest("button[data-plugin-page]");
      if (!button || button.disabled) return;
      state.page = Number(button.dataset.pluginPage);
      render();
    });
    elements.closePluginReview.addEventListener("click", closeReview);
    elements.pluginDrawerBackdrop.addEventListener("click", closeReview);
    elements.pluginReviewForm.addEventListener("submit", saveReview);
    elements.pluginReviewVersion.addEventListener("change", () => {
      const record = state.records.find(item => item.key === state.activeKey);
      if (record) loadReview(record);
    });
    elements.pluginTargetVersion.addEventListener("change", () => {
      const record = state.records.find(item => item.key === state.activeKey);
      if (!record) return;
      const remaining = record.requiredVersions.filter(version => reviewFor(record, version).decision === "review").length;
      if (remaining) { elements.pluginTargetVersion.value = state.targets[record.key] || ""; showPluginToast("Complete the recorded archive version decision before selecting a target."); return; }
      if (elements.pluginTargetVersion.value) state.targets[record.key] = elements.pluginTargetVersion.value;
      else delete state.targets[record.key];
      persistCurrentReviewData();
      updateTarget(record); render();
    });
    elements.clearPluginReview.addEventListener("click", clearReview);
    elements.pluginReviewDrawer.addEventListener("keydown", event => {
      if (event.key === "Escape") { closeReview(); return; }
      if (event.key !== "Tab") return;
      const focusable = [...elements.pluginReviewDrawer.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')].filter(node => node.offsetParent !== null);
      if (!focusable.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
    });
    window.addEventListener("platform-problem-fixes-open", loadHistory);
    window.addEventListener("platform-catalog-ready", event => {
      state.products = Array.isArray(event.detail?.products) ? event.detail.products : [];
      if (state.records.length) render();
      if (state.activeKey) {
        const record = state.records.find(item => item.key === state.activeKey);
        if (record) renderRelatedNotes(record);
      }
    });
    window.addEventListener("platform-problem-fixes-ready", event => {
      state.problemProducts = new Map((event.detail?.products || []).map(item => [normalizeName(item.product), item.records || []]));
      state.problemsReady = true;
      const record = state.records.find(item => item.key === state.activeKey);
      if (record) renderRelatedPrbs(record);
    });
    window.addEventListener("platform-problem-fixes-ready", event => {
      state.problemProducts = new Map((event.detail?.products || []).map(item => [normalizeName(item.product), item.records || []]));
      state.problemsReady = true;
      const record = state.records.find(item => item.key === state.activeKey);
      if (record) renderRelatedPrbs(record);
    });
    window.addEventListener("platform-plugin-review-restore", event => {
      if (event.detail?.reviewCollections && typeof event.detail.reviewCollections === "object") state.reviewsByDataset = event.detail.reviewCollections;
      if (event.detail?.targetCollections && typeof event.detail.targetCollections === "object") state.targetsByDataset = event.detail.targetCollections;
      if (event.detail?.labels && typeof event.detail.labels === "object") state.labelsByDataset = event.detail.labels;
      saveObject(REVIEW_COLLECTIONS_KEY, state.reviewsByDataset);
      saveObject(TARGET_COLLECTIONS_KEY, state.targetsByDataset);
      saveObject(HISTORY_LABELS_KEY, state.labelsByDataset);
      if (state.datasetId) {
        state.reviews = state.reviewsByDataset[state.datasetId] || {};
        state.targets = state.targetsByDataset[state.datasetId] || {};
        state.datasetLabel = state.labelsByDataset[state.datasetId] || state.datasetLabel;
      }
      render();
      if (state.activeKey) {
        const record = state.records.find(item => item.key === state.activeKey);
        if (record) loadReview(record);
      }
    });
    elements.importPluginHistory.disabled = !elements.pluginHistoryLabel.value.trim();
    elements.savedPluginHistory.addEventListener("change", () => {
      const selected = Boolean(elements.savedPluginHistory.value);
      elements.loadSavedPluginHistory.disabled = !selected;
      elements.forgetSavedPluginHistory.disabled = !selected;
    });
    elements.loadSavedPluginHistory.addEventListener("click", loadSelectedSavedHistory);
    elements.forgetSavedPluginHistory.addEventListener("click", forgetSelectedSavedHistory);
    elements.importPluginHistory.addEventListener("click", () => {
      if (!elements.pluginHistoryLabel.value.trim()) {
        elements.pluginHistoryStatus.textContent = "Enter an instance or upgrade name before choosing a history file.";
        elements.pluginHistoryLabel.focus();
        return;
      }
      elements.pluginHistoryInput.click();
    });
    elements.pluginHistoryLabel.addEventListener("input", () => {
      elements.importPluginHistory.disabled = !elements.pluginHistoryLabel.value.trim();
      if (elements.pluginHistoryLabel.value.trim() && !state.loaded) elements.pluginHistoryStatus.textContent = "Choose the matching history CSV. It will be saved in this browser only.";
    });
    elements.pluginHistoryInput.addEventListener("change", event => importHistory(event.target.files?.[0]));
    document.getElementById("exportPluginHistory").addEventListener("click", exportHistory);
  }

  bindEvents();
  window.addEventListener("platform-plugin-history-open", loadHistory);
  window.addEventListener("platform-plugin-history-close", () => { if (state.activeKey) closeReview(); });
  window.dispatchEvent(new CustomEvent("platform-catalog-request"));
  if (!elements.pluginsWorkspacePanel.hidden) loadHistory();
})();