# ServiceNow MCP Tool Catalog

This folder supplies public metadata for the static ServiceNow MCP Desk catalog.

## Catalog structure

`definitions/` contains website catalog metadata. It tells ServiceNow MCP Desk what to display and does not run in an MCP server.

This repository intentionally contains no executable MCP packages, server code, runtime dependencies, or credentials. Tool entries are documentation for planning and evaluation only.

`definitions/index.json` controls the MCP tools that ServiceNow MCP Desk displays. Add the filename for each tool JSON file to that array.

Create one JSON file per documented tool in `definitions/`. For example, add `get-table-schema.json` to `definitions/index.json` and create `definitions/get-table-schema.json`.

```json
{
  "name": "Get table schema",
  "level": "read",
  "audience": "developer",
  "area": "Foundation",
  "description": "A documented pattern for returning approved field metadata for one allowed ServiceNow table.",
  "requires": "A real implementation would need a table allow-list, field filtering, independent tests, and authenticated ServiceNow access outside this website."
}
```

## Required fields

- `name`: concise display name
- `level`: `read` or `write`
- `audience`: `developer` or `user`
- `area`: user-facing functional category
- `description`: what the documented pattern could do
- `requires`: safeguards a separate implementation would require

## Publishing a catalog entry

1. Add a JSON definition under `definitions/`.
2. Add its filename to `definitions/index.json`.
3. Open `tools.html` through an HTTP server and confirm the entry appears.
4. Verify search and the safety and audience filters include the entry correctly.

Use `read` for bounded, read-only patterns. Use `write` only when the catalog entry clearly documents required policy guards, audit logging, tests, and rollback behavior for a separate implementation.

Do not add JavaScript handlers, credentials, SDK dependencies, package manifests, or installation instructions here. ServiceNow MCP Desk documents tool patterns; it does not provide or execute an MCP server.