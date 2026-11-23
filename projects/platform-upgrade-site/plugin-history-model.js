(() => {
  "use strict";

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function nameKey(value) { return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, ""); }
  function versionKey(pluginKey, version) { return `${pluginKey}::${version}`; }

  function archiveRelease(archive) {
    const filename = String(archive || "").trim().split(/[\\/]/).pop();
    const match = filename.match(/^glide-([a-z]+(?:-[a-z]+)*)-\d{2}-\d{2}-\d{4}(.*)$/i);
    if (!match) return null;
    const family = match[1].toLowerCase();
    const names = { washingtondc: "Washington DC", newyork: "New York", sandiego: "San Diego" };
    const familyName = names[family] || family.split("-").map(word => word[0].toUpperCase() + word.slice(1)).join(" ");
    const patchMatch = match[2].match(/(?:^|__)patch(\d+)([a-z0-9]*)(?=[._-]|$)/i);
    const patch = patchMatch ? Number(patchMatch[1]) : null;
    const variant = patchMatch?.[2]?.toLowerCase() || "";
    const hotfixMatch = match[2].match(/(?:^|[_-])hotfix(\d+)(?=[._-]|$)/i);
    const hotfix = hotfixMatch ? Number(hotfixMatch[1]) : null;
    const label = `${familyName}${patch === null ? " (patch not specified)" : ` Patch ${patch}`}${variant ? ` ${variant}` : ""}${hotfix === null ? "" : ` Hotfix ${hotfix}`}`;
    return { family, familyName, patch, variant, hotfix, label };
  }

  function releaseSummary(records) {
    const grouped = new Map();
    let unknownCount = 0;
    for (const record of records) {
      const sources = record.releaseRecords || [{ archive: record.archive, recordedAt: record.recordedAt }];
      const counted = new Set();
      let recognized = false;
      let unrecognized = false;
      for (const source of sources) {
        const release = archiveRelease(source.archive);
        if (!release) { unrecognized = true; continue; }
        recognized = true;
        const key = `${release.family}::${release.patch}::${release.variant}::${release.hotfix}`;
        if (!grouped.has(key)) grouped.set(key, { ...release, count: 0, recordedAt: "", archives: [] });
        const entry = grouped.get(key);
        if (!counted.has(key)) { entry.count += 1; counted.add(key); }
        if (!entry.archives.includes(source.archive)) entry.archives.push(source.archive);
        const timestamp = Date.parse(source.recordedAt || "");
        if (Number.isFinite(timestamp) && (!entry.recordedAt || timestamp > Date.parse(entry.recordedAt))) entry.recordedAt = source.recordedAt;
      }
      if (!recognized || unrecognized) unknownCount += 1;
    }
    const releases = [...grouped.values()].sort((left, right) => (Date.parse(right.recordedAt) || 0) - (Date.parse(left.recordedAt) || 0) || left.label.localeCompare(right.label));
    const latestTime = releases.length ? Date.parse(releases[0].recordedAt) : NaN;
    const latest = !unknownCount && releases.every(release => release.recordedAt) && Number.isFinite(latestTime)
      && releases.filter(release => Date.parse(release.recordedAt) === latestTime).length === 1 ? releases[0] : null;
    return { releases, latest, unknownCount };
  }

  function normalizedReview(review) {
    const text = field => typeof review[field] === "string" ? review[field] : "";
    return {
      recommendation: ["unassessed", "must", "should", "can", "do_not"].includes(review.recommendation) ? review.recommendation : "unassessed",
      impact: ["unassessed", "low", "medium", "high"].includes(review.impact) ? review.impact : "unassessed",
      decision: ["review", "ready", "hold", "blocker"].includes(review.decision) ? review.decision : "review",
      owner: text("owner"), notes: text("notes"), action: text("action"), teamRequired: review.teamRequired === true, updatedAt: text("updatedAt")
    };
  }

  function validateWorkspace(input) {
    const object = value => value && typeof value === "object" && !Array.isArray(value);
    if (!object(input) || input.kind !== "plugin-workspace" || input.schemaVersion !== 1 || typeof input.datasetId !== "string"
      || !input.datasetId || typeof input.datasetLabel !== "string" || !Array.isArray(input.snapshots) || !Array.isArray(input.events)
      || !object(input.reviews) || !object(input.targets)) throw new Error("This file contains an invalid plugin workspace.");
    for (const snapshot of input.snapshots) {
      if (!object(snapshot) || typeof snapshot.datasetId !== "string" || typeof snapshot.fileName !== "string"
        || !Number.isFinite(Date.parse(snapshot.importedAt)) || !Array.isArray(snapshot.records)) throw new Error("A workspace CSV snapshot is invalid.");
      for (const record of snapshot.records) {
        if (!object(record) || !["key", "name", "fromVersion", "toVersion", "latestVersion", "disposition", "archive"].every(field => typeof record[field] === "string")
          || !["requiredVersions", "optionalVersions", "candidates"].every(field => Array.isArray(record[field]) && record[field].every(value => typeof value === "string"))) {
          throw new Error("A workspace contains an invalid plugin record.");
        }
      }
    }
    for (const event of input.events) {
      if (!object(event) || typeof event.pluginKey !== "string" || typeof event.type !== "string" || !Number.isFinite(Date.parse(event.at))) throw new Error("A workspace activity record is invalid.");
    }
    const result = clone(input);
    result.reviews = Object.fromEntries(Object.entries(result.reviews).filter(([, review]) => object(review)).map(([key, review]) => [key, normalizedReview(review)]));
    result.targets = Object.fromEntries(Object.entries(result.targets).filter(([, value]) => typeof value === "string"));
    return result;
  }

  function createWorkspace(datasetId, datasetLabel, at) {
    return { kind: "plugin-workspace", schemaVersion: 1, datasetId, datasetLabel, fileName: "0 CSV histories", createdAt: at, snapshots: [], reviews: {}, targets: {}, events: [] };
  }

  function workspaceRecords(workspace, releaseLabel = "") {
    const groups = new Map();
    for (const snapshot of workspace.snapshots) {
      const current = new Map();
      for (const record of snapshot.records) {
        if (releaseLabel && archiveRelease(record.archive)?.label !== releaseLabel) continue;
        const key = nameKey(record.name);
        if (!current.has(key)) current.set(key, []);
        current.get(key).push(record);
      }
      for (const [key, records] of current) {
        const previous = groups.get(key);
        const requiredVersions = [...new Set(records.flatMap(record => record.requiredVersions))];
        const optionalVersions = [...new Set(records.flatMap(record => record.optionalVersions))].filter(version => !requiredVersions.includes(version));
        const candidates = [...new Set([...requiredVersions, ...optionalVersions, ...(previous?.candidates || [])])];
        const unique = field => [...new Set(records.map(record => record[field]).filter(Boolean))];
        groups.set(key, {
          ...records[0], key, requiredVersions, optionalVersions, candidates,
          fromVersion: unique("fromVersion").length === 1 ? unique("fromVersion")[0] : "",
          toVersion: requiredVersions.length === 1 ? requiredVersions[0] : "",
          latestVersion: unique("latestVersion").length === 1 ? unique("latestVersion")[0] : "",
          archive: unique("archive").join("; "),
          releaseRecords: records.map(record => ({ archive: record.archive, recordedAt: record.recordedAt || "" })),
          disposition: unique("disposition").join("; "),
          currentCandidates: [...new Set([...requiredVersions, ...optionalVersions])],
          historicalVersions: candidates.filter(version => !requiredVersions.includes(version) && !optionalVersions.includes(version)),
          ambiguous: records.length > 1 || Boolean(previous?.ambiguous),
          snapshotCount: (previous?.snapshotCount || 0) + 1,
          lastSnapshotId: snapshot.datasetId,
          lastFileName: snapshot.fileName,
          lastSeenAt: snapshot.importedAt
        });
      }
    }
    return [...groups.values()];
  }

  function appendReviewChange(result, pluginKey, version, review, at, source) {
    const key = versionKey(pluginKey, version);
    const before = result.reviews[key] || null;
    const after = review ? normalizedReview(review) : null;
    if (JSON.stringify(before) === JSON.stringify(after)) return result;
    if (after) result.reviews[key] = after;
    else delete result.reviews[key];
    result.events.push({ type: after ? "review" : "clear-review", pluginKey, version, at, source, before, after });
    return result;
  }

  function recordReview(workspace, pluginKey, version, review, at, source = "manual") {
    return appendReviewChange(clone(workspace), pluginKey, version, review, at, source);
  }

  function appendTargetChange(result, pluginKey, target, at, source) {
    const before = result.targets[pluginKey] || "";
    const after = target || "";
    if (before === after) return result;
    if (after) result.targets[pluginKey] = after;
    else delete result.targets[pluginKey];
    result.events.push({ type: "target", pluginKey, at, source, before, after });
    return result;
  }

  function recordTarget(workspace, pluginKey, target, at, source = "manual") {
    return appendTargetChange(clone(workspace), pluginKey, target, at, source);
  }

  function appendSnapshot(workspace, snapshot, legacyReviews = {}, legacyTargets = {}, at = new Date().toISOString()) {
    const signature = records => JSON.stringify(records.map(record => record.key).sort());
    if (workspace.snapshots.some(item => item.datasetId === snapshot.datasetId || signature(item.records) === signature(snapshot.records))) {
      return { workspace: clone(workspace), duplicate: true, added: 0, changed: 0 };
    }
    let result = clone(workspace);
    const previous = new Map(workspaceRecords(workspace).map(record => [record.key, record]));
    result.snapshots.push({ datasetId: snapshot.datasetId, datasetLabel: snapshot.datasetLabel, fileName: snapshot.fileName, importedAt: at,
      observedAt: snapshot.observedAt || snapshot.savedAt || at, records: clone(snapshot.records) });
    result.snapshots.sort((left, right) => Date.parse(left.observedAt || left.importedAt) - Date.parse(right.observedAt || right.importedAt));
    result.fileName = `${result.snapshots.length} CSV ${result.snapshots.length === 1 ? "history" : "histories"}`;
    const snapshotKeys = new Set(snapshot.records.map(record => nameKey(record.name)));
    const current = workspaceRecords(result).filter(record => snapshotKeys.has(record.key));
    let added = 0;
    let changed = 0;
    for (const record of current) {
      const before = previous.get(record.key);
      if (!before) added += 1;
      const versionChanged = Boolean(before && JSON.stringify(before.requiredVersions) !== JSON.stringify(record.requiredVersions));
      if (versionChanged) changed += 1;
      result.events.push({ type: "import", pluginKey: record.key, at, snapshotId: snapshot.datasetId, fileName: snapshot.fileName,
        before: before ? before.requiredVersions : [], after: [...new Set(snapshot.records.filter(item => nameKey(item.name) === record.key).flatMap(item => item.requiredVersions))] });
      const selected = result.targets[record.key];
      if (selected && (versionChanged || !record.currentCandidates.includes(selected))) {
        appendTargetChange(result, record.key, "", at, "new-snapshot");
      }
    }
    const importedReviews = snapshot.records.flatMap(record => record.candidates.map(version => ({ record, version, review: legacyReviews[`${record.key}::${version}`] })))
      .filter(item => item.review && typeof item.review === "object" && !Array.isArray(item.review))
      .sort((left, right) => String(left.review.updatedAt || "").localeCompare(String(right.review.updatedAt || "")));
    for (const { record, version, review } of importedReviews) {
      const pluginKey = nameKey(record.name);
      const existing = result.reviews[versionKey(pluginKey, version)];
      const newer = !existing || String(review.updatedAt || "") >= String(existing.updatedAt || "");
      if (newer) appendReviewChange(result, pluginKey, version, review, at, "saved-history");
      else result.events.push({ type: "historical-review", pluginKey, version, at, source: "saved-history", before: null, after: clone(review) });
    }
    for (const record of current) {
      if (record.ambiguous || record.requiredVersions.length !== 1) continue;
      const version = record.requiredVersions[0];
      if (Object.hasOwn(result.reviews, versionKey(record.key, version))) continue;
      const older = result.snapshots.filter(item => item.datasetId !== record.lastSnapshotId && Date.parse(item.observedAt || item.importedAt)
        <= Date.parse(result.snapshots.find(item => item.datasetId === record.lastSnapshotId).observedAt || record.lastSeenAt))
        .flatMap(item => item.records.filter(itemRecord => nameKey(itemRecord.name) === record.key)).reverse();
      const previousRecord = older.find(item => item.toVersion !== version && result.reviews[versionKey(record.key, item.toVersion)]);
      if (previousRecord) {
        const previousReview = result.reviews[versionKey(record.key, previousRecord.toVersion)];
        appendReviewChange(result, record.key, version, { ...previousReview, decision: "review", updatedAt: "" }, at, "previous-version-preparation");
      }
    }
    for (const record of snapshot.records) {
      const target = legacyTargets[record.key];
      const pluginKey = nameKey(record.name);
      const active = current.find(item => item.key === pluginKey);
      if (target && active?.lastSnapshotId === snapshot.datasetId && active.currentCandidates.includes(target)) appendTargetChange(result, pluginKey, target, at, "saved-history");
      else if (target) result.events.push({ type: "historical-target", pluginKey, at, source: "saved-history", before: "", after: target });
    }
    return { workspace: result, duplicate: false, added, changed };
  }

  window.PlatformPluginHistory = { createWorkspace, workspaceRecords, appendSnapshot, recordReview, recordTarget, versionKey, validateWorkspace, archiveRelease, releaseSummary };
})();