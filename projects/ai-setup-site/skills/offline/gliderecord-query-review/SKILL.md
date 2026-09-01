---
name: gliderecord-query-review
description: "Use when: reviewing or improving ServiceNow GlideRecord and GlideAggregate queries from pasted code or local files. Does not require MCP or instance access."
compatibility: "GitHub Copilot in Visual Studio Code and Antigravity IDE. Does not require MCP or instance access."
---

# GlideRecord Query Review

Review queries from the supplied code and describe only risks that can be established without inspecting a live ServiceNow instance.

## Install This Skill

- **Visual Studio Code + GitHub Copilot:** copy this complete folder to `.github/skills/gliderecord-query-review/`.
- **Antigravity IDE:** copy this complete folder to `.agents/skills/gliderecord-query-review/`.

The skill analyzes supplied code only. It does not query ServiceNow or require an MCP server.

## Required Checks

1. Confirm the script is server-side. GlideRecord is not valid in Client Scripts.
2. Confirm `query()` occurs before a `while (gr.next())` loop.
3. Verify every query has selective conditions appropriate to the stated use case.
4. Flag filter variables that might be `null`, empty, or `undefined` before `addQuery()`.
5. Flag unbounded reads on tables likely to be large. Recommend `setLimit()` for exploratory, diagnostic, and bounded-use cases.
6. Use GlideAggregate for counts instead of `getRowCount()` when only a count is needed.
7. Use `getValue()` or `getDisplayValue()` when storing a value from a loop.
8. Flag `get()` calls that use ambiguous display values or unvalidated input.
9. Check that insert, update, and delete operations have an explicit business justification and error path.

## Suggestions

- Prefer `addEncodedQuery()` when it improves readability for a stable, documented filter.
- Prefer narrow field access and avoid large result-object accumulation.
- Use `setWorkflow(false)` or `autoSysFields(false)` only when the user has supplied a clear requirement and understands the platform impact.
- Recommend a test on a representative non-production dataset before approving a write query.

## Review Output

For each finding, provide the query fragment, the concern, and a corrected pattern. Clearly label performance recommendations that depend on unknown table volume or indexes as assumptions.
