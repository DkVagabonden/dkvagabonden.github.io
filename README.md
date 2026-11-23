# Pizza Projects

A collection of static, browser-based projects for ServiceNow development, upgrade preparation, and MCP documentation.

Published site: <https://dkvagabonden.github.io/>

## Projects

| Project | Purpose | Published path |
| --- | --- | --- |
| Plugin Update Desk | Compare installed applications with available versions and record upgrade reviews. | [`/projects/plugin-update-site/`](https://dkvagabonden.github.io/projects/plugin-update-site/) |
| Platform Upgrade Desk | Review installed app versions, capture upgrade decisions, and browse family-release notes. | [`/projects/platform-upgrade-site/`](https://dkvagabonden.github.io/projects/platform-upgrade-site/) |
| AI Setup Desk | Browse and download ServiceNow rules and skills for supported AI workspaces. | [`/projects/ai-setup-site/`](https://dkvagabonden.github.io/projects/ai-setup-site/) |
| ServiceNow MCP Desk | Learn MCP architecture and browse documented ServiceNow tool patterns. | [`/projects/mcp-site/`](https://dkvagabonden.github.io/projects/mcp-site/) |

All projects run entirely in the browser. The repository has no backend, build step, npm dependency, or executable MCP server.

## Project structure
-+
Every project keeps its primary static files at the project root:

```text
projects/<project-name>/
	index.html
	styles.css
	app.js
```

Additional HTML pages and content folders are allowed when the project needs them. For example, AI Setup Desk keeps its rules and skills in content folders, while ServiceNow MCP Desk keeps catalog definitions in `tool-library/`. All projects remain static HTML, CSS, and browser JavaScript with no build step.

Shared styles and images remain at the repository root:

```text
assets/
shared.css
styles.css
```

## Releases

Run `node ship` to create a publish-only snapshot in `release/<label>/` (the label defaults to a timestamp, e.g. `2026-11-23_1005`; pass your own with `node ship v1.2`). Add `--open` to open the folder in Explorer afterwards, or run `node ship --list` to see earlier releases. It copies the site files and leaves out `data/` (instance exports), `tests/`, `previews/`, `.vscode/`, and `.gitignore`. Upload the contents of one release folder to the GitHub Pages repository. The `release/` folder is git-ignored, so older versions stay on the laptop only.

## Plugin Update Desk

Plugin Update Desk compares installed ServiceNow Store applications with available application versions and records a per-version upgrade review. All imports, reviews, settings, and cached data stay in the visitor's browser. Use the JSON export to back up or transfer review work.

Open it at <https://dkvagabonden.github.io/projects/plugin-update-site/>.

### Required imports

Use **Import** in the application to upload CSV exports from the ServiceNow instance.

| Import | Required columns |
| --- | --- |
| Installed apps | `name`, `scope`, `version`, `latest_version` |
| App versions | `name`, `scope`, `version` |

Optional version metadata columns are `publish_date`, `dependencies`, `compatibilities`, and `short_description`.

## Platform Upgrade Desk

Platform Upgrade Desk combines an application-upgrade review with the Zurich-to-Brazil release-note reader. The catalog and notes come from the bundled files in `projects/platform-upgrade-site/delta-zurich-brazil/`. At startup the reader loads `index.md` and `rn-combined-intro.md`, then preloads the notes in that manifest with bounded concurrency. Locally it reads raw `.md`; GitHub Pages/Jekyll publishes those same files as `.html`, so the reader falls back to the rendered Pages output when the `.md` URL is unavailable. Search covers the loaded corpus. Platform-wide notes remain browseable whether or not an application inventory contains a corresponding Store app. Users can explicitly link release notes to an application, with those links saved locally.

The top-level navigation is **Release notes**, **Application changes**, and **Problem fixes**. **Application changes** groups **Baseline & Store catalog** with **Recorded plugin changes**. Application and plugin comparisons can use exports for any ServiceNow release; the bundled release-note corpus remains specifically Zurich to Brazil and is not an automatically updated patch-note feed.

The Markdown corpus is bundled at `projects/platform-upgrade-site/delta-zurich-brazil/`, so no visitor upload is required. Both direct local opening and GitHub Pages use the same project-relative folder path.

When adding a release-note file, include its link in the local `index.md` manifest and combined intro so the static browser can discover and preload it.

In **Release notes**, mark each area as **Not reviewed**, **Relevant to us**, or **Not relevant**, then filter the catalog by that choice. **Matches tracked apps** suggests areas whose title exactly matches a name in installed-app data or upgrade history. Suggestions remain unreviewed until a person confirms relevance, and unmatched platform notes stay available under **All areas**. Use **Save for team** on an individual feature or **Save area for team** for a whole topic to collect a reading list. **Team brief** copies the selected items, summaries, and source links as Markdown. Relevance decisions and the brief are included in the review-plan backup.

The **Plugins** workspace asks each customer to name an upgrade workspace and import their own `sys_upgrade_app_version_history.csv` files; no customer history is bundled with the public site. Workspaces, their CSV snapshots, and review activity are saved in this browser's IndexedDB so they restore after browser or PC restarts; they are never uploaded or synced to the site. The **Workspace** menu displays the active workspace name and contains switching, creation, and saved-CSV actions. **Delete workspace** removes the active workspace and its snapshots and activity, with confirmation; it never deletes a different item merely selected in a dialog. Existing per-file reviews remain available and can be added to a growing workspace. The workflow provides per-version recommendation, impact, decision, owner, notes, team validation, candidate target selection, filtering, pagination, and filtered CSV export. The history export contains `application.name`, `from_version`, `to_version`, `application.latest_version`, disposition, and archive, but no scope or plugin ID. Plugin-to-note and plugin-to-PRB suggestions therefore use exact normalized product-name matches only; a missing match does not mean a plugin has no related notes or fixes, so search manually. The PRB detail shows its family and patch, which teams should check against their upgrade path. Complete plugin workspaces are included in the shared plan backup.

Open it at <https://dkvagabonden.github.io/projects/platform-upgrade-site/>.

### Growing plugin workspaces

Use **Workspace > New workspace** to name a separate instance or upgrade plan, then **Add history CSVs** to import one or several files. With no active workspace, **Add history CSVs** asks for a name first. Later imports add snapshots to the same workspace. The main list accumulates every plugin seen, with its latest known state; a plugin absent from a newer CSV stays in the list. **Workspace > Switch workspace** shows saved workspaces and switches only after **Open workspace** is confirmed. Existing per-file histories remain available under **Workspace > Add saved CSV**; select a CSV and confirm **Add to workspace** to append its snapshot and preparation. Cancelling either dialog leaves the active workspace unchanged. Workspace names are shown as identity, not as an editable rename field.

Expand **CSV snapshots** to inspect earlier imports. Open a plugin and expand **History and activity** for its imports, review revisions, clears, and target changes, including before/after values and timestamps. Reviews remain editable; they are not locked as protected entries. **Version to review** includes historical versions as well as current candidates. New required versions inherit preparation and assessment but reopen the decision and clear the old target; the old version's decisions stay in history. Older saved CSVs use their original saved date so adding them later does not replace a newer snapshot's current state. Reimporting an identical snapshot does not duplicate it.

The export has no stable plugin identifier, so matching uses normalized names. Multiple records with the same name are flagged for individual version review rather than silently treated as a unique identity. This is a local working history, not an authenticated or tamper-proof audit log.

**Backup & export > Download workspace backup** produces JSON containing the CSV snapshots and complete review activity; **Restore workspace backup** restores that file, confirming before replacing an existing workspace. **Export filtered rows** produces a CSV of the current table data, not a backup of reviews or history. The shared review-plan backup also includes complete plugin workspaces. Restoring a backup of an existing workspace replaces that workspace's snapshots and timeline with the backup; unrelated workspaces remain. Workspace data uses IndexedDB rather than putting the growing timeline in localStorage. If saving fails, changes remain in the tab and **Retry save** appears beside the save status; download a workspace backup before closing or switching away.

All data stays under the same site address in the same browser; localhost and the published site have separate browser storage. No CSV data is uploaded or synced.

### Recorded family and patch context

The plugin importer recognizes release names from `upgrade_history` archive filenames, for example `glide-brazil-08-25-2026__patch2-10-22-2026_11-03-2026_2245.zip` identifies **Brazil Patch 2**. Patch suffixes and explicit hotfixes are retained, such as **Zurich Patch 12 w41** and **Zurich Patch 11 Hotfix 2**. A base-family archive without an explicit patch marker is shown as **patch not specified**, not assumed to be Patch 0. Unrecognizable archives remain accessible under **All recorded releases**.

Optional `sys_created_on` and `sys_updated_on` values are retained for ordering recorded archive history. A mixed export lists its distinct recorded releases and identifies the latest dated archive only when the evidence is unambiguous. The **Recorded release** filter scopes the plugin's displayed from/to versions to that archive release. Selecting a release changes the application-change heading; returning to Release notes still identifies the separate bundled Zurich-to-Brazil source.

This identifies recorded archive metadata, not an authoritative current installed platform patch. Application version numbers, compatibility lists, and archive row dates do not prove a completed platform upgrade. Verify the instance's own platform-build details when its currently installed family/patch is needed.

**Requires team review** and **Team validation plan** remain per-version review fields. They are saved in plugin workspace reviews and before/after activity, included in workspace/review-plan backups, and available through the **Team review** filter. The standalone design preview now also includes these fields for individual and bulk assessments and its example JSON export; as a prototype, it still keeps data in memory rather than using the live workspace storage.

Local instance-export files under `projects/platform-upgrade-site/data/` are ignored by Git. Do not deploy that folder to GitHub Pages. Ignore rules do not remove files already tracked or published; remove any such customer exports from the repository/deployment separately.

### Application and plugin review filters

**Baseline & Store catalog** and **Recorded plugin changes** share multi-select update-status, recommendation, impact, and decision filters, plus plugin type, team-review, notes, and validation-plan filters. Selections within a checkbox group combine with OR; different groups combine with AND. Facet counts retain the other active filters, while the summary metrics stay independent of the filtered result list. Review filters do not silently restrict the list to updates, so current apps with team work or notes remain visible.

**Displayed assessment** is the default review match: an assessed selected target, otherwise the newest assessed version. **Any version** matches the relevant version reviews without replacing that displayed assessment; matching versions and older blocker, hold, or Do not update warnings remain visible. The plugin **Recorded release** selection scopes both candidate reviews and ownership filters, preventing another patch's work from leaking into the selected release. **Reset** clears view filters and sorting, not the recorded release, active workspace, or saved reviews. On narrow screens the filters collapse above the results; removable selections stay visible.

For recorded plugins, **Needs update** includes a recorded upgrade or installation as well as a newer optional Store candidate. It is a review signal, not proof that the instance currently needs an installation. **Optional newer** appears only when the Store latest exceeds the recorded target; missing version evidence remains **Unknown availability**. Plugin type stays **Not recorded** without explicit supported metadata; the filter does not infer lifecycle or relationships from names.

### Regression checks

Run the Platform Upgrade Desk regression checks with Node.js 18 or newer; no package installation is required:

```powershell
node --test projects/platform-upgrade-site/tests/regressions.test.cjs
```

These cover review-plan replacement protection, relevance validation, storage-failure feedback, spreadsheet-safe CSV export, legacy carry-forward, cumulative snapshots, review revisions, older-history insertion, workspace backup validation, shared filter/count/sort contracts, assessment summaries, and release-scoped version matching. Check keyboard focus, Escape/backdrop dismissal, filtered exports, backup restoration, history inspection, and responsive layout in a browser after UI changes.

### Application review imports

Import sources for the same instance/change context: (1) installed `sys_store_app` as the baseline, (2) `sys_app_version` for version candidates, and (3) optionally a separate Store `sys_store_app` catalog. The third file never replaces the installed baseline; catalog-only entries are shown separately and are not treated as installed or required. Baseline and Store catalog files require `name`, `scope`, and `version`; `latest_version` and `active` are used when present. `sys_app_version` requires `name` and `version`; when `scope` is present, it is the exact version-history join key. Scope-less version exports use an exact normalized name match only when that name identifies one installed scope. Ambiguous or missing matches remain visible instead of being guessed. The existing browser cache keys are retained for backward compatibility even though the visible import labels are now release-neutral.

Reviews are recorded per candidate version. A target version becomes selectable after all candidate versions have a decision. Imports are cached in the current browser; reviews, targets, and application-to-note links stay in local browser storage. Use **Plan** to import or export a review-plan JSON backup, or export the imported CSVs. The site does not connect to an instance or upload these files. Do not commit instance exports to this repository or publish them as static site assets; visitors to a static site can retrieve any files deployed with it.

## AI Setup Desk

AI Setup Desk is a searchable ServiceNow guidance library. It documents setup for Visual Studio Code with GitHub Copilot and Antigravity IDE, then lets developers browse, read, copy, select, and download the rules and skill packages they need. The selected model does not change the workspace guidance layout.

Open it at <https://dkvagabonden.github.io/projects/ai-setup-site/>.

The source library lives in `projects/ai-setup-site/rules/` and `projects/ai-setup-site/skills/`. Copilot downloads convert selected rules to `.github/instructions/*.instructions.md`, while Antigravity downloads place them unchanged in `.agents/rules/`. Both keep selected skills as complete packages in their respective skills directory.

AI Setup Desk is a browser-based guidance library. The first-party `projects/ai-setup-site/skills/offline/` collection works from local code and exported files without a ServiceNow MCP server. It includes ServiceNow code review, GlideRecord query review, and Update Set preflight skills. ServiceNow MCP Desk documents MCP concepts and tool patterns. JSZip is loaded in the browser from cdnjs for ZIP downloads.

## ServiceNow MCP Desk

ServiceNow MCP Desk is a static, safety-first documentation site for understanding MCP architecture and browsing a searchable catalog of ServiceNow MCP tool patterns.

The MCP tool library separates developer tools from user-friendly tools. Developer tools use explicit, policy-protected inputs for controlled configuration work, while user-friendly tools turn bounded plain-language questions into explainable, read-only ServiceNow requests.

Open it at <https://dkvagabonden.github.io/projects/mcp-site/>.

The site does not host or run an MCP server, receive credentials, connect to ServiceNow, or provide executable server packages. Its browser JavaScript only loads public JSON definitions and renders search and filtering controls.

MCP tool entries are maintained as data rather than hard-coded in the page. `projects/mcp-site/tool-library/definitions/` contains one public JSON catalog record per documented tool. Add each definition filename to `projects/mcp-site/tool-library/definitions/index.json`. See [the MCP tool catalog README](projects/mcp-site/tool-library/README.md) for the required fields and safety expectations.

## Static-site behavior

The projects use browser APIs such as `fetch`, `localStorage`, IndexedDB, FileReader, Blob, and object URLs. AI Setup Desk loads JSZip 3.10.1 from cdnjs through a standard `<script>` tag so selected guidance can be downloaded as a ZIP archive.

No ServiceNow credentials or instance exports belong in this repository. Plugin Update Desk processes user-selected files locally in the visitor's browser.