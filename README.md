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

The Markdown corpus is bundled at `projects/platform-upgrade-site/delta-zurich-brazil/`, so no visitor upload is required. Both direct local opening and GitHub Pages use the same project-relative folder path.

When adding a release-note file, include its link in the local `index.md` manifest and combined intro so the static browser can discover and preload it.

In **Release notes**, mark each area as **Not reviewed**, **Relevant to us**, or **Not relevant**, then filter the catalog by that choice. **Matches installed apps** suggests areas whose title exactly matches an imported application's name or title. Suggestions remain unreviewed until a person confirms relevance, and unmatched platform notes stay available under **All areas**. Use **Save for team** on an individual feature or **Save area for team** for a whole topic to collect a reading list. **Team brief** copies the selected items, summaries, and source links as Markdown. Relevance decisions and the brief are included in the application review-plan backup.

Open it at <https://dkvagabonden.github.io/projects/platform-upgrade-site/>.

### Application review imports

Use **Applications** to import CSV files exported from the instance being reviewed. `sys_store_app` requires `name`, `scope`, and `version`; the expanded export also supplies fields such as `latest_version`, `update_available`, `auto_update`, `compatibilities`, and `sys_updated_on`. `sys_app_version` requires `name` and `version`; when `scope` is present, it is the exact version-history join key. Older scope-less exports use an exact normalized name match only when that name identifies one installed scope. Ambiguous or missing matches remain visible instead of being guessed. When history does not include a newer release, `sys_store_app.latest_version` supplies the target candidate.

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