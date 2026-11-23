(() => {
  "use strict";

  const REVIEW_COLLECTIONS_KEY = "platform-upgrade-plugin-review-collections-v2";
  const TARGET_COLLECTIONS_KEY = "platform-upgrade-plugin-target-collections-v2";
  const HISTORY_LABELS_KEY = "platform-upgrade-plugin-history-labels-v1";
  const HISTORY_DB_NAME = "platform-upgrade-desk-data";
  const HISTORY_STORE_NAME = "datasets";
  const HISTORY_RECORD_PREFIX = "pluginHistory:";
  const ACTIVE_HISTORY_KEY = "platform-upgrade-plugin-active-history-v1";
  const historyModel = window.PlatformPluginHistory;
  const reviewFilters = window.PlatformReviewFilters;
  let pluginFilters = null;
  const PAGE_SIZE = 30;
  const labels = {
    recommendation: { unassessed: "Not assessed", must: "Must update", should: "Should update", can: "Can update", do_not: "Do not update" },
    impact: { unassessed: "Not assessed", low: "Low", medium: "Medium", high: "High" },
    decision: { review: "Not reviewed", ready: "Ready", hold: "On hold", blocker: "Show stopper" }
  };
  const elements = Object.fromEntries([
    "pluginsWorkspacePanel", "pluginHistoryStatus", "pluginHistoryInput", "pluginHistoryLabel", "importPluginHistory", "exportPluginHistory", "savedPluginHistory", "loadSavedPluginHistory", "forgetSavedPluginHistory", "pluginHistoryCount", "pluginUpgradedCount", "pluginReviewedCount", "pluginReviewedDetail", "pluginNewerCount",
    "pluginSearch", "pluginDispositionFilter", "pluginReviewFilter", "pluginSort", "pluginReleaseFilter", "pluginReleaseStatus", "resetPluginFilters", "pluginHistoryError", "pluginHistoryRows", "pluginHistoryEmpty", "pluginHistoryPagination", "pluginHistoryResultCount", "pluginHistoryPageStatus",
    "carryPluginReviews", "pluginCarryDialog", "closePluginCarry", "cancelPluginCarry", "pluginCarrySource", "pluginCarryDestination", "pluginCarryStatus", "pluginCarryError", "pluginCarrySelectAll", "pluginCarryTableWrap", "pluginCarryRows", "pluginCarrySourceOnly", "pluginCarrySourceOnlyCount", "pluginCarrySourceOnlyRows", "pluginCarrySelection", "applyPluginCarry",
    "newPluginWorkspace", "retryPluginWorkspace", "exportPluginWorkspace", "importPluginWorkspace", "pluginWorkspaceInput", "pluginWorkspaceHistory", "pluginWorkspaceSnapshotCount", "pluginWorkspaceSnapshots", "pluginReviewTimeline", "pluginReviewTimelineRows", "pluginReviewTimelineMore",
    "pluginHistoryActions", "pluginWorkspaceMenu", "pluginBackupMenu", "pluginWorkspaceName", "switchPluginWorkspace", "pluginWorkspaceDialog", "pluginWorkspaceDialogTitle", "pluginWorkspaceForm", "pluginWorkspaceNameField", "pluginWorkspaceSavedField", "pluginWorkspaceSavedLabel", "pluginWorkspaceDialogStatus", "pluginWorkspaceDialogError", "closePluginWorkspaceDialog", "cancelPluginWorkspaceDialog",
    "pluginReviewDrawer", "pluginReviewTitle", "pluginReviewHistory", "closePluginReview", "pluginReviewForm", "pluginFromVersion", "pluginToVersion", "pluginDispositionBadge", "pluginReviewVersion", "pluginLatestVersion", "pluginArchive", "pluginVersionStatus", "pluginTargetVersion", "pluginTargetStatus", "pluginRecommendation", "pluginImpact", "pluginDecision", "pluginReviewOwner", "pluginReviewNotes", "pluginReviewAction", "pluginTeamRequired", "pluginRelatedNotes", "pluginRelatedPrbStatus", "pluginRelatedPrbs", "clearPluginReview"
  ].map(id => [id, document.getElementById(id)]));
  const state = {
    records: [], filtered: [], products: [], problemProducts: new Map(), problemsReady: false, reviewsByDataset: readObject(REVIEW_COLLECTIONS_KEY), targetsByDataset: readObject(TARGET_COLLECTIONS_KEY), labelsByDataset: readObject(HISTORY_LABELS_KEY),
    reviews: {}, targets: {}, datasetId: "", datasetLabel: "", fileName: "", page: 1, loaded: false, restorePromise: null, savedLocally: false, activeKey: "", activeVersion: "", bodyOverflow: "",
    carry: { token: 0, destinationId: "", source: null, sources: [], plan: null, selected: new Set(), pending: null, busy: false },
    workspace: null, workspaceDirty: false, sourceDataset: null, timelineLimit: 20, savedDatasets: [],
    workspaceDialog: { mode: "", token: 0, busy: false, returnFocus: null, addAfterCreate: false }
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
    return (datasets || []).filter(dataset => ["plugin-history", "plugin-workspace"].includes(dataset?.kind)).sort((left, right) => right.savedAt.localeCompare(left.savedAt));
  }

  function deleteHistoryDataset(datasetId) {
    return historyStoreRequest("readwrite", store => store.delete(historyStorageKey(datasetId)));
  }

  function persistCurrentReviewData() {
    if (state.workspace) return persistWorkspace();
    if (!state.datasetId || !state.savedLocally) return false;
    state.reviewsByDataset[state.datasetId] = state.reviews;
    state.targetsByDataset[state.datasetId] = state.targets;
    state.labelsByDataset[state.datasetId] = state.datasetLabel;
    return [
      saveObject(REVIEW_COLLECTIONS_KEY, state.reviewsByDataset),
      saveObject(TARGET_COLLECTIONS_KEY, state.targetsByDataset),
      saveObject(HISTORY_LABELS_KEY, state.labelsByDataset)
    ].every(Boolean);
  }

  async function persistWorkspace() {
    const workspace = state.workspace;
    if (!workspace) return false;
    try {
      await saveHistoryDataset(workspace.datasetId, workspace);
      if (state.workspace === workspace) {
        state.savedLocally = true;
        state.workspaceDirty = false;
        elements.retryPluginWorkspace.hidden = true;
        elements.pluginHistoryError.hidden = true;
        elements.pluginHistoryStatus.textContent = `${state.records.length.toLocaleString()} plugins · ${workspace.datasetLabel} · ${workspace.fileName} (saved on this device)`;
        setActiveHistoryId(workspace.datasetId);
        if (!state.savedDatasets.some(dataset => dataset.datasetId === workspace.datasetId)) {
          try { await refreshSavedHistoryOptions(workspace.datasetId); }
          catch { elements.pluginHistoryStatus.textContent = "Workspace saved, but the saved-history selector could not be refreshed."; }
        }
      }
      return true;
    } catch (error) {
      if (state.workspace?.datasetId !== workspace.datasetId) return false;
      state.workspaceDirty = true;
      elements.retryPluginWorkspace.hidden = false;
      elements.pluginHistoryStatus.textContent = "Workspace changes are session-only; not saved on this device.";
      elements.pluginHistoryError.textContent = `Workspace changes are session-only. ${error.message || "Browser storage is unavailable."}`;
      elements.pluginHistoryError.hidden = false;
      return false;
    }
  }

  function useWorkspace(workspace) {
    const activeRecord = state.records.find(record => record.key === state.activeKey);
    state.workspace = workspace;
    state.workspaceDirty = true;
    state.datasetId = workspace.datasetId;
    state.datasetLabel = workspace.datasetLabel;
    state.fileName = workspace.fileName;
    state.records = historyModel.workspaceRecords(workspace);
    if (activeRecord) state.activeKey = normalizeName(activeRecord.name);
    state.reviews = workspace.reviews;
    state.targets = workspace.targets;
    elements.exportPluginWorkspace.disabled = false;
    updateWorkspaceActions();
    renderWorkspaceHistory();
  }

  async function workspaceForCurrentHistory(label = state.datasetLabel) {
    if (state.workspace) return state.workspace;
    const datasetId = `workspace:${await fingerprint(`${label}\n${Date.now()}\n${Math.random()}`)}`;
    let workspace = historyModel.createWorkspace(datasetId, label, new Date().toISOString());
    if (state.sourceDataset?.records?.length) {
      workspace = historyModel.appendSnapshot(workspace, { ...state.sourceDataset, datasetId: state.datasetId }, state.reviews, state.targets,
        state.sourceDataset.savedAt || new Date().toISOString()).workspace;
    }
    return workspace;
  }

  async function addSnapshotToCurrentWorkspace(snapshot, label = state.datasetLabel) {
    const workspace = await workspaceForCurrentHistory(label);
    const result = historyModel.appendSnapshot(workspace, snapshot, state.reviewsByDataset[snapshot.datasetId] || {}, state.targetsByDataset[snapshot.datasetId] || {});
    useWorkspace(result.workspace);
    const persisted = await persistWorkspace();
    activateHistory(result.workspace.datasetId, result.workspace, persisted);
    try { await refreshSavedHistoryOptions(result.workspace.datasetId); } catch { elements.retryPluginWorkspace.hidden = false; }
    elements.pluginHistoryStatus.textContent = result.duplicate
      ? "This CSV snapshot is already in the workspace; no duplicate was added."
      : `${snapshot.fileName} added: ${result.added} new plugins, ${result.changed} changed recorded versions. ${persisted ? "Workspace saved on this device." : "Session only; not saved."}`;
    return result;
  }

  async function addSelectedSavedHistory() {
    const datasetId = elements.savedPluginHistory.value;
    if (!datasetId || datasetId === state.datasetId) return false;
    try {
      const dataset = await readHistoryDataset(datasetId);
      if (dataset?.kind !== "plugin-history" || !dataset.records?.length) throw new Error("Choose a saved CSV history, not another workspace.");
      await addSnapshotToCurrentWorkspace(dataset);
      return true;
    } catch (error) {
      elements.pluginHistoryError.textContent = error.message || "Could not add that history.";
      elements.pluginHistoryError.hidden = false;
      return false;
    }
  }

  function updateWorkspaceActions() {
    elements.pluginWorkspaceName.textContent = state.datasetLabel || "None selected";
    elements.pluginWorkspaceName.title = state.datasetLabel || "No workspace selected";
    elements.forgetSavedPluginHistory.disabled = !state.loaded || !state.savedLocally;
    elements.forgetSavedPluginHistory.textContent = state.sourceDataset ? "Delete saved CSV..." : "Delete workspace...";
    elements.carryPluginReviews.disabled = !state.loaded;
    elements.exportPluginWorkspace.disabled = !state.workspace;
  }

  function savedChoicesForMode(datasets, mode) {
    const kind = mode === "add" ? "plugin-history" : "plugin-workspace";
    return datasets.filter(dataset => dataset.kind === kind && (mode !== "add" || dataset.datasetId !== state.datasetId));
  }

  function updateWorkspaceDialogAction() {
    const dialog = state.workspaceDialog;
    const selected = state.savedDatasets.find(dataset => dataset.datasetId === elements.savedPluginHistory.value);
    const validSelection = selected && selected.kind === (dialog.mode === "add" ? "plugin-history" : "plugin-workspace")
      && selected.datasetId !== state.datasetId;
    elements.loadSavedPluginHistory.disabled = dialog.busy || (dialog.mode === "new" ? !elements.pluginHistoryLabel.value.trim() : !validSelection);
    elements.pluginHistoryLabel.disabled = dialog.busy;
    elements.savedPluginHistory.disabled = dialog.busy || !savedChoicesForMode(state.savedDatasets, dialog.mode).length;
    elements.closePluginWorkspaceDialog.disabled = dialog.busy;
    elements.cancelPluginWorkspaceDialog.disabled = dialog.busy;
  }

  function closeWorkspaceDialog() {
    const dialog = state.workspaceDialog;
    if (dialog.busy) return;
    dialog.token += 1;
    dialog.mode = "";
    if (elements.pluginWorkspaceDialog.open) elements.pluginWorkspaceDialog.close();
    elements.pluginHistoryLabel.value = state.datasetLabel;
    dialog.returnFocus?.focus();
    dialog.returnFocus = null;
  }

  async function openWorkspaceDialog(mode, addAfterCreate = false) {
    const dialog = state.workspaceDialog;
    if (dialog.busy) return;
    const token = ++dialog.token;
    dialog.mode = mode;
    dialog.addAfterCreate = addAfterCreate;
    dialog.returnFocus = elements.pluginWorkspaceMenu.open ? elements.pluginWorkspaceMenu.querySelector("summary") : document.activeElement;
    elements.pluginWorkspaceDialogTitle.textContent = mode === "new" ? "New workspace" : mode === "add" ? "Add saved CSV" : "Switch workspace";
    elements.loadSavedPluginHistory.textContent = mode === "new" ? "Create workspace" : mode === "add" ? "Add to workspace" : "Open workspace";
    elements.pluginWorkspaceNameField.hidden = mode !== "new";
    elements.pluginWorkspaceSavedField.hidden = mode === "new";
    elements.pluginWorkspaceSavedLabel.textContent = mode === "add" ? "Saved CSV" : "Saved workspace";
    elements.pluginHistoryLabel.required = mode === "new";
    elements.pluginHistoryLabel.value = mode === "new" ? "" : state.datasetLabel;
    elements.pluginWorkspaceDialogError.hidden = true;
    elements.pluginWorkspaceDialogStatus.textContent = mode === "new" ? "" : "Loading saved items";
    elements.loadSavedPluginHistory.disabled = true;
    elements.pluginWorkspaceDialog.showModal();
    if (mode === "new") { updateWorkspaceDialogAction(); elements.pluginHistoryLabel.focus(); return; }
    try {
      await refreshSavedHistoryOptions(state.datasetId);
      if (token !== dialog.token || !elements.pluginWorkspaceDialog.open) return;
      const choices = savedChoicesForMode(state.savedDatasets, mode);
      elements.pluginWorkspaceDialogStatus.textContent = choices.length
        ? mode === "add" ? `Destination: ${state.datasetLabel}` : ""
        : mode === "add" ? "No saved CSV files on this device." : "No saved workspaces on this device.";
      elements.savedPluginHistory.focus();
    } catch (error) {
      if (token !== dialog.token) return;
      elements.pluginWorkspaceDialogError.textContent = error.message || "Could not read saved items.";
      elements.pluginWorkspaceDialogError.hidden = false;
    }
  }

  async function submitWorkspaceDialog(event) {
    event.preventDefault();
    const dialog = state.workspaceDialog;
    if (dialog.busy || elements.loadSavedPluginHistory.disabled) return;
    const mode = dialog.mode;
    if (mode === "new" && state.workspaceDirty && !window.confirm("Some workspace changes are session-only. Download a workspace backup before starting another. Continue anyway?")) return;
    dialog.busy = true;
    updateWorkspaceDialogAction();
    elements.pluginWorkspaceDialogError.hidden = true;
    let completed = false;
    try {
      if (mode === "new") {
        const label = elements.pluginHistoryLabel.value.trim();
        const datasetId = `workspace:${await fingerprint(`${label}\n${Date.now()}\n${Math.random()}`)}`;
        const workspace = historyModel.createWorkspace(datasetId, label, new Date().toISOString());
        useWorkspace(workspace);
        const persisted = await persistWorkspace();
        activateHistory(datasetId, workspace, persisted);
        try { await refreshSavedHistoryOptions(datasetId); } catch { elements.retryPluginWorkspace.hidden = false; }
        completed = true;
      } else {
        completed = mode === "add" ? await addSelectedSavedHistory() : await loadSelectedSavedHistory();
      }
      if (!completed && !elements.pluginHistoryError.hidden) {
        elements.pluginWorkspaceDialogError.textContent = elements.pluginHistoryError.textContent;
        elements.pluginWorkspaceDialogError.hidden = false;
      }
    } catch (error) {
      elements.pluginWorkspaceDialogError.textContent = error.message || "Could not complete the workspace action.";
      elements.pluginWorkspaceDialogError.hidden = false;
    } finally {
      dialog.busy = false;
      updateWorkspaceDialogAction();
    }
    if (completed) {
      const addFiles = mode === "new" && dialog.addAfterCreate;
      closeWorkspaceDialog();
      if (addFiles) elements.pluginHistoryInput.click();
    }
  }

  function closeWorkspaceMenus(returnFocus = false) {
    for (const menu of [elements.pluginWorkspaceMenu, elements.pluginBackupMenu]) {
      if (!menu.open) continue;
      menu.open = false;
      if (returnFocus) menu.querySelector("summary").focus();
    }
  }

  function renderWorkspaceHistory() {
    const snapshots = state.workspace?.snapshots || [];
    elements.pluginWorkspaceHistory.hidden = !snapshots.length;
    elements.pluginWorkspaceSnapshotCount.textContent = String(snapshots.length);
    elements.pluginWorkspaceSnapshots.innerHTML = [...snapshots].reverse().map((snapshot, index) => {
      const releases = historyModel?.releaseSummary(snapshot.records).releases.map(release => release.label) || [];
      return `<li><details data-workspace-snapshot="${snapshots.length - index - 1}"><summary><strong>${escapeHtml(snapshot.fileName)}</strong> · ${snapshot.records.length} ${snapshot.records.length === 1 ? "record" : "records"}</summary>${releases.length ? `<p>Recorded releases: ${escapeHtml(releases.join("; "))}</p>` : ""}<p>Snapshot ${escapeHtml(new Date(snapshot.observedAt || snapshot.importedAt).toLocaleString())} · Added ${escapeHtml(new Date(snapshot.importedAt).toLocaleString())}</p><div class="plugin-snapshot-preview"></div></details></li>`;
    }).join("");
  }

  function renderReviewTimeline(record) {
    const events = (state.workspace?.events || []).filter(event => event.pluginKey === record.key).reverse();
    elements.pluginReviewTimeline.hidden = !events.length;
    const names = { import: "CSV snapshot added", review: "Review saved", "clear-review": "Review cleared", target: "Target changed", "historical-review": "Earlier saved review", "historical-target": "Earlier selected target" };
    elements.pluginReviewTimelineRows.innerHTML = events.slice(0, state.timelineLimit).map(event => {
      const fieldNames = { recommendation: "Recommendation", impact: "Impact", decision: "Decision", owner: "Owner", notes: "Notes", action: "Validation plan", teamRequired: "Team review", updatedAt: "Reviewed at" };
      const review = value => value && typeof value === "object" && !Array.isArray(value)
        ? Object.entries(value).map(([field, content]) => `${fieldNames[field] || field}: ${labels[field]?.[content] || (typeof content === "boolean" ? content ? "Yes" : "No" : typeof content === "object" ? JSON.stringify(content) : content)}`).join("\n")
        : Array.isArray(value) ? value.join(", ") || "None" : value || "None";
      return `<li><details><summary><strong>${escapeHtml(names[event.type] || "History")}${event.version ? ` · ${escapeHtml(event.version)}` : ""}</strong><time>${escapeHtml(new Date(event.at).toLocaleString())}</time></summary>${event.fileName ? `<p>${escapeHtml(event.fileName)}</p>` : ""}${event.source ? `<p>${escapeHtml(event.source === "previous-version-preparation" ? "Preparation from the previous required version; decision reopened" : event.source)}</p>` : ""}<div class="plugin-revision-values"><div><strong>Before</strong><pre>${escapeHtml(review(event.before))}</pre></div><div><strong>After</strong><pre>${escapeHtml(review(event.after))}</pre></div></div></details></li>`;
    }).join("");
    elements.pluginReviewTimelineMore.hidden = events.length <= state.timelineLimit;
  }

  function showSnapshotPreview(event) {
    const details = event.target;
    if (!details.open || !details.matches("[data-workspace-snapshot]")) return;
    const snapshot = state.workspace?.snapshots[Number(details.dataset.workspaceSnapshot)];
    const preview = details.querySelector(".plugin-snapshot-preview");
    if (!snapshot || !preview || preview.childElementCount) return;
    preview.innerHTML = `<div class="plugin-snapshot-table-wrap"><table><thead><tr><th>Plugin / app</th><th>From</th><th>To</th><th>Latest</th><th>Event / archive</th></tr></thead><tbody>${snapshot.records.map(record => `<tr><td>${escapeHtml(record.name)}</td><td>${escapeHtml(record.fromVersion)}</td><td>${escapeHtml(record.toVersion)}</td><td>${escapeHtml(record.latestVersion)}</td><td>${escapeHtml(record.disposition)} · ${escapeHtml(record.archive)}</td></tr>`).join("")}</tbody></table></div>`;
  }

  function exportWorkspace() {
    if (!state.workspace) return;
    const blob = new Blob([JSON.stringify({ format: "platform-plugin-workspace", formatVersion: 1, workspace: state.workspace }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "plugin-workspace-history.json";
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function workspaceBackups() {
    const datasets = await listHistoryDatasets();
    const workspaces = new Map(datasets.filter(dataset => dataset.kind === "plugin-workspace").map(dataset => [dataset.datasetId, dataset]));
    if (state.workspace) workspaces.set(state.workspace.datasetId, state.workspace);
    return [...workspaces.values()];
  }

  async function restoreWorkspaceBackups(incoming, confirmReplace = true) {
    const workspaces = incoming.map(workspace => historyModel.validateWorkspace(workspace));
    for (const workspace of workspaces) {
      const existing = await readHistoryDataset(workspace.datasetId);
      if (existing && confirmReplace && !window.confirm(`Restore ${workspace.datasetLabel} from this backup? This replaces that workspace's current snapshots and activity history.`)) return false;
    }
    for (const workspace of workspaces) await saveHistoryDataset(workspace.datasetId, workspace);
    if (workspaces.length) {
      const active = workspaces.find(workspace => workspace.datasetId === state.datasetId) || workspaces[0];
      setActiveHistoryId(active.datasetId);
      activateHistory(active.datasetId, active);
      await refreshSavedHistoryOptions(active.datasetId);
    }
    return true;
  }

  async function importWorkspaceBackup(file) {
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      const workspaces = backup.format === "platform-plugin-workspace" ? [backup.workspace]
        : backup.format === "platform-upgrade-plan" && Array.isArray(backup.pluginWorkspaces) ? backup.pluginWorkspaces : null;
      if (!workspaces) throw new Error("Choose an exported plugin workspace or a review plan containing workspaces.");
      if (await restoreWorkspaceBackups(workspaces)) showPluginToast("Workspace snapshots and review history restored.");
    } catch (error) {
      elements.pluginHistoryError.textContent = error.message || "Could not restore the workspace.";
      elements.pluginHistoryError.hidden = false;
    } finally { elements.pluginWorkspaceInput.value = ""; }
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

  function historyRecordedAt(value) {
    const text = clean(value);
    const local = text.match(/^(\d{2})-(\d{2})-(\d{4})[ T](\d{2}):(\d{2}):(\d{2})$/);
    if (local) {
      const [, day, month, year, hour, minute, second] = local;
      const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)));
      if (date.getUTCDate() !== Number(day) || date.getUTCMonth() + 1 !== Number(month) || date.getUTCFullYear() !== Number(year)
        || date.getUTCHours() !== Number(hour) || date.getUTCMinutes() !== Number(minute) || date.getUTCSeconds() !== Number(second)) return "";
      return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
    }
    return /^\d{4}-\d{2}-\d{2}T/.test(text) && Number.isFinite(Date.parse(text)) ? text : "";
  }

  function refreshReleaseContext(reset = false) {
    if (!historyModel?.releaseSummary) return;
    const selected = reset ? "all" : elements.pluginReleaseFilter.value;
    const allRecords = state.workspace ? historyModel.workspaceRecords(state.workspace) : state.sourceDataset?.records || state.records;
    const summary = historyModel.releaseSummary(allRecords);
    elements.pluginReleaseFilter.innerHTML = '<option value="all">All recorded releases</option>' + summary.releases.map(release =>
      `<option value="${escapeHtml(release.label)}">${escapeHtml(release.label)} · ${release.count}</option>`).join("");
    elements.pluginReleaseFilter.value = summary.releases.some(release => release.label === selected) ? selected : "all";
    elements.pluginReleaseFilter.disabled = !summary.releases.length;
    elements.pluginReleaseStatus.hidden = !state.loaded;
    elements.pluginReleaseStatus.textContent = summary.latest
      ? `Latest dated archive: ${summary.latest.label} · ${summary.releases.length} recorded ${summary.releases.length === 1 ? "release" : "releases"}. Archive metadata does not verify the instance's current installed patch.`
      : summary.releases.length ? `${summary.releases.length} recorded ${summary.releases.length === 1 ? "release" : "releases"}${summary.unknownCount ? ` · ${summary.unknownCount} records without recognizable archive metadata` : ""}. Latest installed patch cannot be inferred reliably.`
        : "No recognizable release metadata in these archives. Do not infer the platform patch from application version numbers.";
    const title = elements.pluginReleaseFilter.value !== "all" ? elements.pluginReleaseFilter.value
      : summary.latest?.label || (summary.releases.length === 1 && !summary.unknownCount ? summary.releases[0].label : "Recorded application changes");
    window.dispatchEvent(new CustomEvent("platform-plugin-release-context", { detail: { title: state.loaded ? title : "Application changes" } }));
  }

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
        const recordedAt = historyRecordedAt(row.sys_created_on) || historyRecordedAt(row.sys_updated_on);
        return { key, name, fromVersion, toVersion, latestVersion, disposition, archive, requiredVersions, optionalVersions, candidates, recordedAt };
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

  function copyCarryForwardReview(review, resetDecision = false) {
    if (!review || typeof review !== "object" || Array.isArray(review)) return null;
    return {
      recommendation: Object.hasOwn(labels.recommendation, review.recommendation) ? review.recommendation : "unassessed",
      impact: Object.hasOwn(labels.impact, review.impact) ? review.impact : "unassessed",
      decision: !resetDecision && Object.hasOwn(labels.decision, review.decision) ? review.decision : "review",
      owner: typeof review.owner === "string" ? review.owner : "",
      notes: typeof review.notes === "string" ? review.notes : "",
      action: typeof review.action === "string" ? review.action : "",
      teamRequired: Boolean(review.teamRequired),
      updatedAt: !resetDecision && typeof review.updatedAt === "string" ? review.updatedAt : ""
    };
  }

  function buildCarryForwardPlan(sourceRecords, sourceReviews, sourceTargets, destinationRecords, destinationReviews, destinationTargets) {
    const sourcesByName = new Map();
    const destinationCounts = new Map();
    for (const record of sourceRecords) {
      const name = normalizeName(record.name);
      if (!sourcesByName.has(name)) sourcesByName.set(name, []);
      sourcesByName.get(name).push(record);
    }
    for (const record of destinationRecords) {
      const name = normalizeName(record.name);
      destinationCounts.set(name, (destinationCounts.get(name) || 0) + 1);
    }
    const rows = destinationRecords.map(record => {
      const name = normalizeName(record.name);
      const matches = sourcesByName.get(name) || [];
      const row = { record, source: null, status: "unmatched", reviews: {}, target: "", protectedReviews: 0, targetProtected: false };
      if (!name || matches.length > 1 || destinationCounts.get(name) > 1) return { ...row, status: "ambiguous" };
      if (!matches.length) return row;
      row.source = matches[0];
      const requiredChanged = Boolean(record.toVersion && record.toVersion !== row.source.toVersion);
      for (const version of record.candidates) {
        const key = reviewKey(record, version);
        if (Object.hasOwn(destinationReviews, key)) { row.protectedReviews += 1; continue; }
        const resetDecision = requiredChanged && version === record.toVersion;
        const sourceVersion = resetDecision ? row.source.toVersion : version;
        if (!sourceVersion || !row.source.candidates.includes(sourceVersion)) continue;
        const review = copyCarryForwardReview(sourceReviews[reviewKey(row.source, sourceVersion)], resetDecision);
        if (review) row.reviews[key] = review;
      }
      row.targetProtected = Object.hasOwn(destinationTargets, record.key);
      const sourceTarget = sourceTargets[row.source.key];
      const requiredReviewed = record.requiredVersions.length > 0 && record.requiredVersions.every(version => {
        const review = destinationReviews[reviewKey(record, version)] || row.reviews[reviewKey(record, version)];
        return review && ["ready", "hold", "blocker"].includes(review.decision);
      });
      if (!requiredChanged && record.toVersion && !row.targetProtected && requiredReviewed
        && row.source.candidates.includes(sourceTarget) && record.candidates.includes(sourceTarget)) row.target = sourceTarget;
      row.status = Object.keys(row.reviews).length || row.target ? requiredChanged ? "changed" : "unchanged"
        : row.protectedReviews || row.targetProtected ? "protected" : "empty";
      return row;
    });
    return { rows, sourceOnly: sourceRecords.filter(record => !destinationCounts.has(normalizeName(record.name))) };
  }

  function applyCarryForwardRows(rows, selected, existingReviews, existingTargets) {
    const reviews = { ...existingReviews };
    const targets = { ...existingTargets };
    let pluginCount = 0;
    let reviewCount = 0;
    let targetCount = 0;
    for (const row of rows) {
      if (!selected.has(row.record.key)) continue;
      let changed = false;
      for (const [key, review] of Object.entries(row.reviews)) {
        if (Object.hasOwn(reviews, key)) continue;
        reviews[key] = { ...review };
        reviewCount += 1;
        changed = true;
      }
      const requiredReviewed = row.record.requiredVersions.length > 0 && row.record.requiredVersions.every(version =>
        ["ready", "hold", "blocker"].includes(reviews[reviewKey(row.record, version)]?.decision));
      if (row.target && requiredReviewed && !Object.hasOwn(targets, row.record.key)) {
        targets[row.record.key] = row.target;
        targetCount += 1;
        changed = true;
      }
      if (changed) pluginCount += 1;
    }
    return { reviews, targets, pluginCount, reviewCount, targetCount };
  }

  function closeCarryForward() {
    state.carry.token += 1;
    state.carry.busy = false;
    if (elements.pluginCarryDialog.open) elements.pluginCarryDialog.close();
  }

  function resetCarryForward() {
    closeCarryForward();
    state.carry.source = null;
    state.carry.plan = null;
    state.carry.pending = null;
    state.carry.selected.clear();
  }

  function currentCarryForwardPlan(source) {
    return buildCarryForwardPlan(source.records, state.reviewsByDataset[source.datasetId] || {}, state.targetsByDataset[source.datasetId] || {}, state.records, state.reviews, state.targets);
  }

  function updateCarryForwardSelection() {
    const carry = state.carry;
    const rows = carry.plan?.rows || [];
    const eligible = rows.filter(row => Object.keys(row.reviews).length || row.target);
    const selected = eligible.filter(row => carry.selected.has(row.record.key));
    const locked = carry.busy || Boolean(carry.pending);
    elements.pluginCarrySource.disabled = locked || !carry.sources.length;
    elements.pluginCarrySelectAll.disabled = locked || !eligible.length;
    elements.pluginCarrySelectAll.checked = eligible.length > 0 && selected.length === eligible.length;
    elements.pluginCarrySelectAll.indeterminate = selected.length > 0 && selected.length < eligible.length;
    elements.applyPluginCarry.disabled = carry.busy || (!carry.pending && !selected.length);
    elements.applyPluginCarry.textContent = carry.pending ? "Retry save" : `Carry forward (${selected.length})`;
    elements.cancelPluginCarry.textContent = carry.pending ? "Close" : "Cancel";
    elements.pluginCarrySelection.textContent = carry.pending ? "Changes applied for this session only" : `${selected.length} of ${eligible.length} transferable plugins selected`;
    for (const checkbox of elements.pluginCarryRows.querySelectorAll("[data-plugin-carry-index]")) {
      const row = rows[Number(checkbox.dataset.pluginCarryIndex)];
      if (!row) continue;
      checkbox.checked = carry.selected.has(row.record.key);
      checkbox.disabled = locked || !(Object.keys(row.reviews).length || row.target);
    }
  }

  function renderCarryForwardPreview() {
    updateCarryForwardSelection();
    const carry = state.carry;
    const rows = carry.plan?.rows || [];
    const locked = carry.busy || Boolean(carry.pending);
    elements.pluginCarryTableWrap.hidden = !rows.length;
    const statusLabels = { unchanged: "Unchanged version", changed: "New recorded version", protected: "Existing work kept", ambiguous: "Ambiguous name", unmatched: "No source match", empty: "No saved preparation" };
    const versions = record => record
      ? `<strong>${escapeHtml(record.toVersion || "No recorded version")}</strong><small>From ${escapeHtml(record.fromVersion || "Not installed")}</small><small>Latest ${escapeHtml(record.latestVersion || "Unknown")}</small><small>${escapeHtml(record.disposition)} · ${escapeHtml(record.archive)}</small>`
      : "Not uniquely matched";
    elements.pluginCarryRows.innerHTML = rows.map((row, index) => {
      const available = Object.keys(row.reviews).length;
      const selectable = available > 0 || Boolean(row.target);
      return `<tr><td><label class="plugin-carry-choice"><input type="checkbox" data-plugin-carry-index="${index}" ${carry.selected.has(row.record.key) ? "checked" : ""} ${locked || !selectable ? "disabled" : ""}><span>${escapeHtml(row.record.name)}</span></label></td><td>${versions(row.source)}</td><td>${versions(row.record)}</td><td><strong class="plugin-carry-state ${row.status}">${statusLabels[row.status]}</strong>${available ? `<small>${available} version ${available === 1 ? "review" : "reviews"}</small>` : ""}${row.status === "changed" ? "<small>Required decision: Not reviewed</small>" : ""}${row.protectedReviews ? `<small>${row.protectedReviews} existing ${row.protectedReviews === 1 ? "review" : "reviews"} protected</small>` : ""}${row.source ? `<small>${row.targetProtected ? "Existing target kept" : row.target ? `Target: ${escapeHtml(row.target)}` : "No target transfer"}</small>` : ""}</td></tr>`;
    }).join("");
    const sourceOnly = carry.plan?.sourceOnly || [];
    elements.pluginCarrySourceOnly.hidden = !sourceOnly.length;
    elements.pluginCarrySourceOnlyCount.textContent = String(sourceOnly.length);
    elements.pluginCarrySourceOnlyRows.innerHTML = sourceOnly.map(record => `<li>${escapeHtml(record.name)} <span>${escapeHtml(record.toVersion)}</span></li>`).join("");
  }

  async function previewCarryForward() {
    const carry = state.carry;
    if (carry.pending) return;
    const token = ++carry.token;
    const sourceId = elements.pluginCarrySource.value;
    carry.source = null;
    carry.plan = null;
    carry.selected.clear();
    carry.busy = Boolean(sourceId);
    elements.pluginCarryError.hidden = true;
    elements.pluginCarryStatus.textContent = sourceId ? "Loading source history" : "Source history not selected";
    renderCarryForwardPreview();
    if (!sourceId) return;
    try {
      const source = await readHistoryDataset(sourceId);
      if (token !== carry.token || carry.destinationId !== state.datasetId) return;
      if (sourceId === state.datasetId || !source?.records?.length) throw new Error("The selected source history is no longer available.");
      carry.source = source;
      carry.plan = currentCarryForwardPlan(source);
      carry.selected = new Set(carry.plan.rows.filter(row => Object.keys(row.reviews).length || row.target).map(row => row.record.key));
      const counts = Object.fromEntries(["unchanged", "changed", "protected", "ambiguous", "unmatched", "empty"].map(status => [status, carry.plan.rows.filter(row => row.status === status).length]));
      elements.pluginCarryStatus.textContent = `${counts.unchanged} unchanged, ${counts.changed} changed, ${counts.protected} protected, ${counts.ambiguous} ambiguous, ${counts.unmatched} unmatched, ${counts.empty} without saved preparation`;
    } catch (error) {
      if (token !== carry.token) return;
      elements.pluginCarryStatus.textContent = "Preview unavailable";
      elements.pluginCarryError.textContent = error.message || "Could not read the source history.";
      elements.pluginCarryError.hidden = false;
    } finally {
      if (token === carry.token) { carry.busy = false; renderCarryForwardPreview(); }
    }
  }

  async function openCarryForward() {
    if (!state.loaded || !state.savedLocally) return;
    const carry = state.carry;
    if (carry.pending && carry.destinationId === state.datasetId) { elements.pluginCarryDialog.showModal(); return; }
    resetCarryForward();
    const token = ++carry.token;
    carry.destinationId = state.datasetId;
    carry.sources = [];
    carry.busy = true;
    elements.pluginCarryDestination.textContent = `${state.datasetLabel} · ${state.fileName}`;
    elements.pluginCarrySource.innerHTML = '<option value="">Loading saved histories</option>';
    elements.pluginCarryStatus.textContent = "Loading saved histories";
    elements.pluginCarryError.hidden = true;
    renderCarryForwardPreview();
    elements.pluginCarryDialog.showModal();
    try {
      const datasets = await listHistoryDatasets();
      if (token !== carry.token || carry.destinationId !== state.datasetId) return;
      carry.sources = datasets.filter(dataset => dataset.datasetId !== state.datasetId && dataset.records?.length);
      elements.pluginCarrySource.innerHTML = '<option value="">Select source history</option>' + carry.sources.map(dataset => `<option value="${escapeHtml(dataset.datasetId)}">${escapeHtml(dataset.datasetLabel)} · ${escapeHtml(dataset.fileName)}</option>`).join("");
      elements.pluginCarryStatus.textContent = carry.sources.length ? "Source history not selected" : "No other saved histories on this device";
      carry.busy = false;
      renderCarryForwardPreview();
      if (carry.sources.length === 1) { elements.pluginCarrySource.value = carry.sources[0].datasetId; await previewCarryForward(); }
    } catch (error) {
      if (token !== carry.token) return;
      carry.busy = false;
      elements.pluginCarryStatus.textContent = "Saved histories unavailable";
      elements.pluginCarryError.textContent = error.message || "Browser storage is unavailable.";
      elements.pluginCarryError.hidden = false;
      renderCarryForwardPreview();
    }
  }

  function saveCarryForwardResult() {
    const carry = state.carry;
    const result = carry.pending;
    if (!result || carry.destinationId !== state.datasetId) return;
    carry.busy = false;
    if (persistCurrentReviewData()) {
      const message = `Carried ${result.reviewCount} version reviews and ${result.targetCount} targets across ${result.pluginCount} plugins into ${state.datasetLabel}; saved on this device.`;
      carry.pending = null;
      closeCarryForward();
      elements.pluginHistoryError.hidden = true;
      elements.pluginHistoryStatus.textContent = message;
      showPluginToast(message);
    } else {
      const message = "Carry-forward changes are kept for this session only; browser storage could not save them.";
      elements.pluginCarryStatus.textContent = message;
      elements.pluginHistoryStatus.textContent = message;
      elements.pluginCarryError.textContent = "Not saved on this device. The source history is unchanged.";
      elements.pluginCarryError.hidden = false;
      renderCarryForwardPreview();
    }
  }

  async function applyCarryForward() {
    const carry = state.carry;
    if (carry.busy || carry.destinationId !== state.datasetId || !state.savedLocally) return;
    if (carry.pending) { saveCarryForwardResult(); return; }
    if (!carry.source || !carry.selected.size) return;
    const token = ++carry.token;
    const selected = new Set(carry.selected);
    carry.busy = true;
    elements.pluginCarryError.hidden = true;
    renderCarryForwardPreview();
    try {
      const source = await readHistoryDataset(carry.source.datasetId);
      if (token !== carry.token || carry.destinationId !== state.datasetId) return;
      if (!source?.records?.length) throw new Error("The source history is no longer available.");
      carry.plan = currentCarryForwardPlan(source);
      const result = applyCarryForwardRows(carry.plan.rows, selected, state.reviews, state.targets);
      if (!result.pluginCount) {
        carry.selected.clear();
        elements.pluginCarryStatus.textContent = "No transferable changes remain; existing reviews and targets were kept.";
        return;
      }
      state.reviews = result.reviews;
      state.targets = result.targets;
      carry.pending = result;
      render();
      saveCarryForwardResult();
    } catch (error) {
      if (token !== carry.token) return;
      elements.pluginCarryError.textContent = error.message || "Could not carry forward the selected reviews.";
      elements.pluginCarryError.hidden = false;
    } finally {
      if (token === carry.token) { carry.busy = false; renderCarryForwardPreview(); }
    }
  }

  function reviewFor(record, version) {
    const key = state.workspace ? `${normalizeName(record.name)}::${version}` : reviewKey(record, version);
    return { recommendation: "unassessed", impact: "unassessed", decision: "review", owner: "", notes: "", action: "", teamRequired: false, updatedAt: "", ...(state.reviews[key] || {}) };
  }

  function reviewsFor(record) { return record.candidates.map(version => reviewFor(record, version)); }

  function requiredReviews(record) { return record.requiredVersions.map(version => reviewFor(record, version)); }

  function isComplete(record) { return record.requiredVersions.length > 0 && requiredReviews(record).every(review => review.decision !== "review"); }

  function summaryReview(record) {
    const versions = record.candidates.length ? record.candidates : [record.toVersion || record.latestVersion];
    const reviews = versions.filter(Boolean).map(version => ({ ...reviewFor(record, version), version }));
    const key = state.workspace ? normalizeName(record.name) : record.key;
    const target = (record.currentCandidates || record.candidates).includes(state.targets[key]) ? state.targets[key] : "";
    return reviewFilters.selectAssessment(reviews, target, compareVersions);
  }

  function pluginDescriptor(record) {
    const key = state.workspace ? normalizeName(record.name) : record.key;
    const versions = new Set(record.candidates);
    const reviews = [...versions].filter(Boolean).map(version => ({ ...reviewFor(record, version), version }));
    const timestamps = reviews.map(review => review.updatedAt).concat((state.workspace?.events || [])
      .filter(event => event.pluginKey === key && ["review", "clear-review", "target"].includes(event.type)).map(event => event.at));
    const currentVersions = record.currentCandidates || record.candidates;
    const recordedUpdate = record.fromVersion && currentVersions.some(version => compareVersions(version, record.fromVersion) > 0);
    const recordedInstall = !record.fromVersion && record.toVersion && record.disposition?.toLowerCase() === "installed";
    return {
      id: record.key, name: record.name, item: record, type: "unknown",
      updateStatus: recordedUpdate || recordedInstall || hasNewerLatest(record) ? "update"
        : record.fromVersion && currentVersions.length ? "current" : "unknown",
      searchText: `${record.name} ${record.fromVersion} ${record.toVersion} ${record.latestVersion} ${record.disposition} ${record.archive} ${[...versions].join(" ")}`,
      summary: summaryReview(record), reviews, latestVersion: record.latestVersion,
      editedAt: timestamps.filter(Boolean).sort((left, right) => (Date.parse(right) || 0) - (Date.parse(left) || 0))[0] || ""
    };
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
    resetCarryForward();
    const changedDataset = state.datasetId !== datasetId;
    state.workspace = dataset.kind === "plugin-workspace" ? dataset : null;
    state.workspaceDirty = Boolean(state.workspace && !savedLocally);
    state.sourceDataset = state.workspace ? null : dataset;
    state.records = state.workspace ? historyModel.workspaceRecords(state.workspace) : dataset.records;
    state.datasetId = datasetId;
    state.datasetLabel = dataset.datasetLabel;
    state.fileName = dataset.fileName;
    state.savedLocally = savedLocally;
    state.reviews = state.workspace?.reviews || state.reviewsByDataset[datasetId] || {};
    state.targets = state.workspace?.targets || state.targetsByDataset[datasetId] || {};
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
      detail: { apps: state.records.map(record => ({ name: record.name, archive: record.archive })) }
    }));
    elements.pluginHistoryCount.textContent = state.records.length.toLocaleString();
    elements.pluginUpgradedCount.textContent = state.records.filter(record => record.disposition.toLowerCase() === "upgraded").length.toLocaleString();
    elements.pluginHistoryStatus.textContent = `${state.records.length.toLocaleString()} plugins · ${dataset.datasetLabel} · ${dataset.fileName} (${savedLocally ? "saved on this device" : "this session only; could not save"})`;
    elements.exportPluginHistory.disabled = false;
    elements.exportPluginWorkspace.disabled = !state.workspace;
    elements.retryPluginWorkspace.hidden = !state.workspace || savedLocally;
    elements.carryPluginReviews.disabled = true;
    updateWorkspaceActions();
    refreshReleaseContext(changedDataset);
    if (!state.records.length) {
      elements.pluginHistoryEmpty.querySelector("strong").textContent = "No plugin records yet";
      elements.pluginHistoryEmpty.querySelector("span").textContent = "0 CSV snapshots";
    }
    renderWorkspaceHistory();
    render();
  }

  async function refreshSavedHistoryOptions(selectedId = "") {
    const datasets = await listHistoryDatasets();
    state.savedDatasets = datasets;
    const mode = state.workspaceDialog.mode;
    const choices = savedChoicesForMode(datasets, mode);
    const options = [`<option value="">${mode === "add" ? "Select saved CSV" : "Select workspace"}</option>`, ...choices.map(dataset => {
      const date = new Date(dataset.savedAt).toLocaleDateString();
      const label = `${dataset.datasetLabel} · ${dataset.fileName} · ${date}`;
      return `<option value="${escapeHtml(dataset.datasetId)}" data-kind="${dataset.kind}">${escapeHtml(label)}${dataset.datasetId === state.datasetId ? " (current)" : ""}</option>`;
    })];
    elements.savedPluginHistory.innerHTML = options.join("");
    elements.savedPluginHistory.value = choices.some(dataset => dataset.datasetId === selectedId) ? selectedId : "";
    updateWorkspaceDialogAction();
    updateWorkspaceActions();
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
    if (!datasetId || datasetId === state.datasetId) return false;
    if (state.workspaceDirty && !window.confirm("Some workspace changes are session-only. Download a workspace backup before switching to avoid losing them. Switch anyway?")) return false;
    try {
      const dataset = await readHistoryDataset(datasetId);
      if (!dataset || (dataset.kind !== "plugin-workspace" && !dataset.records?.length)) throw new Error("That saved history is no longer available.");
      if (state.workspaceDialog.mode === "switch" && dataset.kind !== "plugin-workspace") throw new Error("Choose a workspace, not a saved CSV.");
      const activeSelectionSaved = setActiveHistoryId(datasetId);
      activateHistory(datasetId, dataset);
      await refreshSavedHistoryOptions(datasetId);
      elements.pluginHistoryError.hidden = true;
      if (!activeSelectionSaved) {
        elements.pluginHistoryStatus.textContent = `${state.records.length.toLocaleString()} plugins · ${dataset.datasetLabel} · ${dataset.fileName} (saved on this device)`;
        elements.pluginHistoryError.textContent = "This history loaded, but the browser could not remember it as the active selection. Choose it again after reopening.";
        elements.pluginHistoryError.hidden = false;
      }
      return true;
    } catch (error) {
      elements.pluginHistoryStatus.textContent = "Could not load the selected saved history.";
      elements.pluginHistoryError.textContent = error.message || "Browser storage is unavailable.";
      elements.pluginHistoryError.hidden = false;
      return false;
    }
  }

  function resetHistoryState() {
    resetCarryForward();
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
    state.workspace = null;
    state.workspaceDirty = false;
    state.sourceDataset = null;
    elements.pluginHistoryLabel.value = "";
    elements.importPluginHistory.disabled = true;
    elements.pluginSearch.value = "";
    elements.exportPluginWorkspace.disabled = true;
    elements.retryPluginWorkspace.hidden = true;
    renderWorkspaceHistory();
    renderEmptyHistory();
  }

  async function forgetSelectedSavedHistory() {
    const datasetId = state.datasetId;
    if (!datasetId) return;
    try {
      const dataset = await readHistoryDataset(datasetId);
      const label = dataset?.datasetLabel || "this saved history";
      const unsavedWarning = state.workspaceDirty ? " Unsaved changes in this workspace will also be lost." : "";
      if (!window.confirm(`Delete ${label}${dataset?.kind === "plugin-workspace" ? ", all its CSV snapshots, and its review timeline" : " and its local review decisions"} from this browser?${unsavedWarning}`)) return;
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
      return false;
    }
    elements.importPluginHistory.disabled = true;
    elements.pluginHistoryError.hidden = true;
    elements.pluginHistoryStatus.textContent = `Reading ${file.name} locally`;
    try {
      const text = await file.text();
      const records = parseCsv(text);
      const datasetId = await fingerprint(text);
      await addSnapshotToCurrentWorkspace({ datasetId, records, datasetLabel, fileName: file.name }, datasetLabel);
      return true;
    } catch (error) {
      elements.pluginHistoryStatus.textContent = "Could not import upgrade history";
      elements.pluginHistoryError.textContent = error.message || "Could not read this CSV.";
      elements.pluginHistoryError.hidden = false;
      return false;
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
    const clearFilters = elements.pluginHistoryEmpty.querySelector("[data-review-empty-reset]");
    if (clearFilters) clearFilters.hidden = true;
    pluginFilters?.update([]);
    elements.pluginHistoryResultCount.textContent = "No history loaded";
    elements.pluginHistoryPageStatus.textContent = "No file sent to a server";
    elements.exportPluginHistory.disabled = true;
    elements.carryPluginReviews.disabled = true;
    elements.exportPluginWorkspace.disabled = true;
    elements.pluginWorkspaceHistory.hidden = true;
    elements.pluginReleaseStatus.hidden = true;
    refreshReleaseContext(true);
    elements.forgetSavedPluginHistory.disabled = true;
    elements.importPluginHistory.disabled = false;
    updateWorkspaceActions();
  }

  function render() {
    if (!state.loaded) { pluginFilters?.update([]); return; }
    const releaseLabel = elements.pluginReleaseFilter.value && elements.pluginReleaseFilter.value !== "all" ? elements.pluginReleaseFilter.value : "";
    if (state.workspace && historyModel) state.records = historyModel.workspaceRecords(state.workspace, releaseLabel);
    else if (state.sourceDataset) state.records = state.sourceDataset.records.filter(record => !releaseLabel || historyModel?.archiveRelease(record.archive)?.label === releaseLabel);
    const disposition = elements.pluginDispositionFilter.value;
    const reviewFilter = elements.pluginReviewFilter.value;
    const descriptors = state.records.map(pluginDescriptor).filter(row => {
      const record = row.item;
      return (disposition === "all" || record.disposition === disposition)
        && (reviewFilter === "all" || reviewFilter === "unreviewed" && record.requiredVersions.length > 0 && !isComplete(record) || reviewFilter === "complete" && isComplete(record) || reviewFilter === "blocker" && row.reviews.some(review => review.decision === "blocker") || reviewFilter === "team" && row.reviews.some(review => review.teamRequired));
    });
    const filters = pluginFilters?.read() || { query: elements.pluginSearch.value };
    const filtered = (pluginFilters ? pluginFilters.apply(descriptors) : reviewFilters.sort(descriptors.filter(row => reviewFilters.matches(row, filters)), elements.pluginSort.value)).map(row => row.item);
    pluginFilters?.update(descriptors);
    state.filtered = filtered;
    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    state.page = Math.min(state.page, pageCount);
    const visible = filtered.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);
    elements.pluginHistoryRows.innerHTML = visible.map(record => {
      const index = state.records.indexOf(record);
      const descriptor = pluginDescriptor(record);
      const review = descriptor.summary;
      const notes = exactNotes(record);
      const note = notes[0];
      const latestState = hasNewerLatest(record) ? '<span class="plugin-latest-badge newer">Optional newer</span>' : `<span class="plugin-latest-badge">${record.latestVersion ? "No newer listed" : "Availability unknown"}</span>`;
      const pill = group => `<span class="app-review-pill ${escapeHtml(review[group])}">${escapeHtml(labels[group][review[group]] || labels[group][group === "decision" ? "review" : "unassessed"])}</span>`;
      const recordKey = state.workspace ? normalizeName(record.name) : record.key;
      const assessmentContext = review.version ? `${state.targets[recordKey] === review.version ? "Target" : review.assessed ? "Assessed" : "Version"} ${review.version}` : "No version";
      const assessment = `<div class="review-assessment-pills">${pill("recommendation")}${pill("impact")}${pill("decision")}</div><small class="app-match-note">${escapeHtml(assessmentContext)}</small>${review.owner ? `<small class="app-match-note">${escapeHtml(review.owner)}</small>` : ""}`;
      const team = descriptor.reviews.some(item => item.teamRequired) ? '<span class="review-team-badge">Team review</span>' : "";
      const warnings = descriptor.reviews.filter(item => item.version !== review.version && (["blocker", "hold"].includes(item.decision) || item.recommendation === "do_not")).map(item => item.version);
      const warning = warnings.length ? `<small class="review-warning">Other version warning: ${escapeHtml(warnings.join(", "))}</small>` : "";
      const matched = reviewFilters.matchedVersions(descriptor, filters);
      const match = matched.length ? `<small class="app-match-note">Matched reviews: ${escapeHtml(matched.join(", "))}</small>` : "";
      return `<tr>
        <td><button class="plugin-name-button" type="button" data-plugin-review="${index}">${escapeHtml(record.name)}</button>${note ? `<button class="plugin-note-match" type="button" data-plugin-note="${escapeHtml(note.slug)}">Release note: ${escapeHtml(note.name)}</button>` : ""}${team}${warning}${match}</td>
        <td class="app-version-cell" data-label="From">${escapeHtml(record.fromVersion || "Not previously installed")}</td>
        <td class="app-version-cell" data-label="To">${escapeHtml(record.toVersion || "Unknown")}</td>
        <td class="app-version-cell" data-label="Latest">${escapeHtml(record.latestVersion || "Unknown")}<small class="app-match-note">${latestState}</small></td>
        <td data-label="Upgrade event"><span class="app-state-pill ${record.disposition.toLowerCase() === "upgraded" ? "update" : ""}">${escapeHtml(record.disposition)}</span>${historyModel?.releaseSummary([record]).releases.map(release => `<small class="app-match-note">${escapeHtml(release.label)}</small>`).join("") || ""}<small class="app-match-note">${escapeHtml(record.archive)}</small></td>
        <td data-label="Assessment">${assessment}</td>
      </tr>`;
    }).join("");
    elements.pluginHistoryEmpty.hidden = visible.length > 0;
    elements.pluginHistoryEmpty.querySelector("strong").textContent = "No plugin records match";
    elements.pluginHistoryEmpty.querySelector("span").textContent = "Change the search or filters to see more records.";
    const clearFilters = elements.pluginHistoryEmpty.querySelector("[data-review-empty-reset]");
    if (clearFilters) clearFilters.hidden = !state.records.length;
    elements.pluginHistoryResultCount.textContent = `${filtered.length.toLocaleString()} of ${state.records.length.toLocaleString()} plugins`;
    elements.pluginHistoryPageStatus.textContent = filtered.length ? `Showing ${visible.length} on page ${state.page} of ${pageCount}` : "No matching plugins";
    renderPagination(pageCount);
    renderMetrics();
  }

  function renderMetrics() {
    elements.pluginHistoryCount.textContent = state.records.length.toLocaleString();
    elements.pluginUpgradedCount.textContent = state.records.filter(record => record.disposition.toLowerCase() === "upgraded").length.toLocaleString();
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
    elements.pluginVersionStatus.textContent = hasNewerLatest(record) ? `Review ${record.toVersion} as the recorded archive version. ${record.latestVersion} is a newer optional Store version and does not block this upgrade review.`
      : record.toVersion && record.latestVersion ? "No newer version is listed in this archive." : "Latest-version availability is not provided in this archive.";
    if (record.ambiguous) elements.pluginVersionStatus.textContent = "Multiple history records share this application name. Review the recorded versions individually; the export contains no unique plugin ID.";
    const options = record.candidates.map(version => `<option value="${escapeHtml(version)}">${escapeHtml(version)}${record.requiredVersions.includes(version) ? " · required archive version" : record.historicalVersions?.includes(version) ? " · historical version" : " · optional latest version"}</option>`).join("");
    elements.pluginReviewVersion.innerHTML = options;
    elements.pluginTargetVersion.innerHTML = `<option value="">Not selected</option>${(record.currentCandidates || record.candidates).map(version => `<option value="${escapeHtml(version)}">${escapeHtml(version)}</option>`).join("")}`;
    state.activeVersion = record.candidates[0] || "";
    loadReview(record);
    state.timelineLimit = 20;
    renderReviewTimeline(record);
    renderRelatedNotes(record);
    renderRelatedPrbs(record);
    renderRelatedPrbs(record);
    elements.pluginReviewDrawer.inert = false;
    elements.pluginReviewDrawer.setAttribute("aria-hidden", "false");
    state.bodyOverflow = document.body.style.overflow;
    elements.pluginReviewDrawer.showModal();
    elements.pluginReviewDrawer.classList.add("open");
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
    const recordKey = state.workspace ? normalizeName(record.name) : record.key;
    const target = (record.currentCandidates || record.candidates).includes(state.targets[recordKey]) ? state.targets[recordKey] : "";
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
    if (!elements.pluginReviewDrawer.open) return;
    const index = state.records.findIndex(record => record.key === state.activeKey);
    elements.pluginReviewDrawer.close();
    elements.pluginReviewDrawer.classList.remove("open");
    elements.pluginReviewDrawer.setAttribute("aria-hidden", "true");
    elements.pluginReviewDrawer.inert = true;
    document.body.style.overflow = state.bodyOverflow;
    const button = [...elements.pluginHistoryRows.querySelectorAll("[data-plugin-review]")].find(node => Number(node.dataset.pluginReview) === index);
    if (button) button.focus();
    else pluginFilters?.focusFilter();
    state.activeKey = "";
    state.activeVersion = "";
  }

  async function saveReview(event) {
    event.preventDefault();
    const record = state.records.find(item => item.key === state.activeKey);
    if (!record || !state.activeVersion) return;
    const review = {
      recommendation: elements.pluginRecommendation.value,
      impact: elements.pluginImpact.value,
      decision: elements.pluginDecision.value,
      owner: elements.pluginReviewOwner.value.trim(),
      notes: elements.pluginReviewNotes.value.trim(),
      action: elements.pluginReviewAction.value.trim(),
      teamRequired: elements.pluginTeamRequired.checked,
      updatedAt: new Date().toISOString()
    };
    if (!state.workspace) useWorkspace(await workspaceForCurrentHistory());
    useWorkspace(historyModel.recordReview(state.workspace, normalizeName(record.name), state.activeVersion, review, review.updatedAt));
    const persisted = await persistCurrentReviewData();
    updateTarget(record);
    render();
    renderReviewTimeline({ ...record, key: normalizeName(record.name) });
    showPluginToast(persisted ? "Plugin review saved on this device." : state.savedLocally ? "Plugin review kept for this session; browser storage could not save it." : "Plugin review kept for this session only.");
  }

  async function clearReview() {
    const record = state.records.find(item => item.key === state.activeKey);
    if (!record || !state.activeVersion || !window.confirm(`Clear the review for ${record.name} ${state.activeVersion}?`)) return;
    if (!state.workspace) useWorkspace(await workspaceForCurrentHistory());
    useWorkspace(historyModel.recordReview(state.workspace, normalizeName(record.name), state.activeVersion, null, new Date().toISOString()));
    const persisted = await persistCurrentReviewData();
    loadReview(record);
    render();
    renderReviewTimeline({ ...record, key: normalizeName(record.name) });
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
    const quote = value => {
      let text = String(value ?? "");
      if (/^[\s\u0000-\u001f]*[=+\-@]|^[\u0000-\u001f]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };
    const csv = [headers.map(quote).join(","), ...state.filtered.map(record => [record.name, record.fromVersion, record.toVersion, record.latestVersion, record.disposition, record.archive].map(quote).join(","))].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = "plugin-upgrade-history.csv"; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function bindEvents() {
    elements.pluginReleaseFilter.addEventListener("change", () => { refreshReleaseContext(); state.page = 1; render(); });
    elements.carryPluginReviews.addEventListener("click", () => openWorkspaceDialog("add"));
    elements.newPluginWorkspace.addEventListener("click", () => openWorkspaceDialog("new"));
    elements.switchPluginWorkspace.addEventListener("click", () => openWorkspaceDialog("switch"));
    elements.pluginWorkspaceForm.addEventListener("submit", submitWorkspaceDialog);
    elements.closePluginWorkspaceDialog.addEventListener("click", closeWorkspaceDialog);
    elements.cancelPluginWorkspaceDialog.addEventListener("click", closeWorkspaceDialog);
    elements.pluginWorkspaceDialog.addEventListener("click", event => {
      if (event.target === elements.pluginWorkspaceDialog) closeWorkspaceDialog();
    });
    elements.pluginWorkspaceDialog.addEventListener("cancel", event => { event.preventDefault(); closeWorkspaceDialog(); });
    elements.pluginWorkspaceDialog.addEventListener("keydown", event => {
      if (event.key === "Escape") { event.preventDefault(); closeWorkspaceDialog(); return; }
      if (event.key !== "Tab") return;
      const focusable = [...elements.pluginWorkspaceDialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled)')].filter(node => node.offsetParent !== null);
      if (!focusable.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
    });
    for (const menu of [elements.pluginWorkspaceMenu, elements.pluginBackupMenu]) {
      menu.addEventListener("toggle", () => {
        if (!menu.open) return;
        for (const other of [elements.pluginWorkspaceMenu, elements.pluginBackupMenu]) if (other !== menu) other.open = false;
      });
      menu.addEventListener("keydown", event => {
        if (event.key === "Escape" && menu.open) { event.preventDefault(); closeWorkspaceMenus(true); }
      });
    }
    elements.pluginHistoryActions.addEventListener("click", event => {
      if (event.target.closest(".plugin-toolbar-panel button")) closeWorkspaceMenus();
    });
    document.addEventListener("click", event => {
      for (const menu of [elements.pluginWorkspaceMenu, elements.pluginBackupMenu]) if (!menu.contains(event.target)) menu.open = false;
    });
    elements.retryPluginWorkspace.addEventListener("click", async () => {
      if (await persistWorkspace()) { elements.pluginHistoryStatus.textContent = "Workspace saved on this device."; showPluginToast("Workspace saved on this device."); await refreshSavedHistoryOptions(state.datasetId); }
    });
    elements.exportPluginWorkspace.addEventListener("click", exportWorkspace);
    elements.pluginWorkspaceSnapshots.addEventListener("toggle", showSnapshotPreview, true);
    elements.importPluginWorkspace.addEventListener("click", () => elements.pluginWorkspaceInput.click());
    elements.pluginWorkspaceInput.addEventListener("change", event => importWorkspaceBackup(event.target.files?.[0]));
    elements.pluginReviewTimelineMore.addEventListener("click", () => {
      const record = state.records.find(item => item.key === state.activeKey);
      if (record) { state.timelineLimit += 20; renderReviewTimeline(record); }
    });
    elements.pluginCarrySource.addEventListener("change", previewCarryForward);
    elements.applyPluginCarry.addEventListener("click", applyCarryForward);
    elements.closePluginCarry.addEventListener("click", closeCarryForward);
    elements.cancelPluginCarry.addEventListener("click", closeCarryForward);
    elements.pluginCarrySelectAll.addEventListener("change", () => {
      if (state.carry.busy || state.carry.pending) return;
      state.carry.selected = new Set(elements.pluginCarrySelectAll.checked
        ? (state.carry.plan?.rows || []).filter(row => Object.keys(row.reviews).length || row.target).map(row => row.record.key) : []);
      updateCarryForwardSelection();
    });
    elements.pluginCarryRows.addEventListener("change", event => {
      const checkbox = event.target.closest("[data-plugin-carry-index]");
      if (!checkbox || state.carry.busy || state.carry.pending) return;
      const row = state.carry.plan?.rows[Number(checkbox.dataset.pluginCarryIndex)];
      if (!row) return;
      if (checkbox.checked) state.carry.selected.add(row.record.key);
      else state.carry.selected.delete(row.record.key);
      updateCarryForwardSelection();
    });
    elements.pluginCarryDialog.addEventListener("click", event => {
      if (event.target === elements.pluginCarryDialog) closeCarryForward();
    });
    elements.pluginCarryDialog.addEventListener("cancel", event => { event.preventDefault(); closeCarryForward(); });
    elements.pluginCarryDialog.addEventListener("keydown", event => {
      if (event.key === "Escape") { event.preventDefault(); closeCarryForward(); return; }
      if (event.key !== "Tab") return;
      const focusable = [...elements.pluginCarryDialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled)')].filter(node => node.offsetParent !== null);
      if (!focusable.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
    });
    pluginFilters = reviewFilters.createWorkbench({
      rootId: "pluginWorkbench", searchId: "pluginSearch", sortId: "pluginSort", resetId: "resetPluginFilters",
      extras: [{ id: "pluginDispositionFilter", label: "History", defaultValue: "all" }, { id: "pluginReviewFilter", label: "Progress", defaultValue: "all" }],
      onChange: () => { state.page = 1; render(); }
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
    elements.pluginReviewDrawer.addEventListener("click", event => {
      if (event.target === elements.pluginReviewDrawer) closeReview();
    });
    elements.pluginReviewDrawer.addEventListener("cancel", event => { event.preventDefault(); closeReview(); });
    elements.pluginReviewDrawer.addEventListener("keydown", event => {
      if (event.key === "Escape") { event.preventDefault(); closeReview(); return; }
      if (event.key !== "Tab") return;
      const focusable = [...elements.pluginReviewDrawer.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href]')].filter(node => node.offsetParent !== null);
      if (!focusable.length) return;
      if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
    });
    elements.pluginReviewForm.addEventListener("submit", saveReview);
    elements.pluginReviewVersion.addEventListener("change", () => {
      const record = state.records.find(item => item.key === state.activeKey);
      if (record) loadReview(record);
    });
    elements.pluginTargetVersion.addEventListener("change", async () => {
      const record = state.records.find(item => item.key === state.activeKey);
      if (!record) return;
      const remaining = record.requiredVersions.filter(version => reviewFor(record, version).decision === "review").length;
      if (remaining) { elements.pluginTargetVersion.value = state.targets[record.key] || ""; showPluginToast("Complete the recorded archive version decision before selecting a target."); return; }
      if (!state.workspace) useWorkspace(await workspaceForCurrentHistory());
      useWorkspace(historyModel.recordTarget(state.workspace, normalizeName(record.name), elements.pluginTargetVersion.value, new Date().toISOString()));
      const persisted = await persistCurrentReviewData();
      updateTarget(record); render();
      renderReviewTimeline({ ...record, key: normalizeName(record.name) });
      if (!persisted) showPluginToast("Target change kept for this session only; browser storage could not save it.");
    });
    elements.clearPluginReview.addEventListener("click", clearReview);
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
      resetCarryForward();
      if (event.detail?.reviewCollections && typeof event.detail.reviewCollections === "object") state.reviewsByDataset = event.detail.reviewCollections;
      if (event.detail?.targetCollections && typeof event.detail.targetCollections === "object") state.targetsByDataset = event.detail.targetCollections;
      if (event.detail?.labels && typeof event.detail.labels === "object") state.labelsByDataset = event.detail.labels;
      const saves = [saveObject(REVIEW_COLLECTIONS_KEY, state.reviewsByDataset), saveObject(TARGET_COLLECTIONS_KEY, state.targetsByDataset), saveObject(HISTORY_LABELS_KEY, state.labelsByDataset)];
      event.detail.persisted = saves.every(Boolean);
      if (state.datasetId && !state.workspace) {
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
    window.addEventListener("platform-plugin-workspace-backup", event => { event.detail.promise = workspaceBackups(); });
    window.addEventListener("platform-plugin-workspace-restore", event => {
      event.detail.promise = restoreWorkspaceBackups(event.detail.workspaces, event.detail.confirmReplace !== false);
    });
    elements.importPluginHistory.disabled = false;
    elements.savedPluginHistory.addEventListener("change", updateWorkspaceDialogAction);
    elements.forgetSavedPluginHistory.addEventListener("click", forgetSelectedSavedHistory);
    elements.importPluginHistory.addEventListener("click", () => {
      if (!state.loaded) openWorkspaceDialog("new", true);
      else elements.pluginHistoryInput.click();
    });
    elements.pluginHistoryLabel.addEventListener("input", () => {
      updateWorkspaceDialogAction();
    });
    elements.pluginHistoryInput.addEventListener("change", async event => {
      const failures = [];
      for (const file of Array.from(event.target.files || [])) {
        if (await importHistory(file) === false) failures.push(file.name);
      }
      if (failures.length) {
        elements.pluginHistoryError.textContent = `Could not import: ${failures.join(", ")}. Successfully read files were kept in the workspace.`;
        elements.pluginHistoryError.hidden = false;
      }
    });
    document.getElementById("exportPluginHistory").addEventListener("click", exportHistory);
  }

  bindEvents();
  window.addEventListener("platform-plugin-history-open", loadHistory);
  window.addEventListener("platform-plugin-history-close", () => { if (state.activeKey) closeReview(); closeCarryForward(); });
  window.dispatchEvent(new CustomEvent("platform-catalog-request"));
  if (!elements.pluginsWorkspacePanel.hidden) loadHistory();
})();