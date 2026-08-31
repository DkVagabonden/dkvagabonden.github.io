# Pizza Tools

Browser-based utilities for ServiceNow development and upgrade preparation.

Published site: <https://dkvagabonden.github.io/>

## Plugin Update Desk

Plugin Update Desk compares installed ServiceNow Store applications with available application versions and records a per-version upgrade review. All imports, reviews, settings, and cached data stay in the visitor's browser. Use the JSON export to back up or transfer review work.

Open it at <https://dkvagabonden.github.io/plugin-update-site/>.

### Required imports

Use **Import** in the application to upload CSV exports from the ServiceNow instance.

| Import | Required columns |
| --- | --- |
| Installed apps | `name`, `scope`, `version`, `latest_version` |
| App versions | `name`, `scope`, `version` |

Optional version metadata columns are `publish_date`, `dependencies`, `compatibilities`, and `short_description`.

## Publish with GitHub Pages

1. Create or use the `dkvagabonden.github.io` repository.
2. Commit these files to the branch selected for GitHub Pages.
3. In repository **Settings** > **Pages**, deploy from that branch and the repository root.

The `data_dont_upload/` directory is ignored on purpose. Do not publish ServiceNow instance exports unless they have been explicitly sanitized for public release.
