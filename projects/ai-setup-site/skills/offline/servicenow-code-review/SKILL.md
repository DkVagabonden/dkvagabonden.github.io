---
name: servicenow-code-review
description: "Use when: reviewing ServiceNow Business Rules, Client Scripts, Script Includes, Scheduled Jobs, UI Actions, or Scripted REST APIs from local files or pasted code. Does not require MCP or instance access."
compatibility: "GitHub Copilot in Visual Studio Code and Antigravity IDE. Does not require MCP or instance access."
---

# ServiceNow Code Review

Review ServiceNow code using the supplied files and context only. Do not claim to have inspected an instance, a table schema, roles, properties, or records unless the user provides that information.

## Install This Skill

- **Visual Studio Code + GitHub Copilot:** copy this complete folder to `.github/skills/servicenow-code-review/`.
- **Antigravity IDE:** copy this complete folder to `.agents/skills/servicenow-code-review/`.

The skill folder contains guidance only. It does not configure an MCP server or grant access to a ServiceNow instance.

## Review Order

1. Identify the script type, execution context, target table, and scope from the code or user context.
2. Check correctness and platform API usage before style recommendations.
3. Check security, performance, maintainability, and upgrade safety.
4. Report findings ordered by severity with the affected file and line when available.
5. State test coverage gaps and assumptions separately from confirmed findings.

## Server-Side Checks

- Do not permit `current.update()` in a before Business Rule.
- Confirm GlideRecord calls have selective conditions and call `query()` before `next()`.
- Flag `getRowCount()` on potentially large result sets; prefer GlideAggregate for counts.
- Use `getValue()` when retaining field values inside loops.
- Flag hardcoded sys_ids, credentials, endpoints, or environment-specific values.
- Require clear error handling and useful `gs.info`, `gs.warn`, or `gs.error` prefixes where logging is appropriate.
- Check cross-scope calls, Script Include access, and client-callable assumptions when evidence is available.

## Client-Side Checks

- Prefer UI Policies for simple visibility, mandatory, and read-only behavior.
- Do not use GlideRecord or direct DOM manipulation in Client Scripts.
- Require asynchronous GlideAjax and callbacks for server calls.
- Guard onChange scripts against initial form load and unchanged values.
- Flag broad global Client Scripts unless their scope is explicitly justified.

## Review Output

Use this structure:

1. Findings: severity, location, risk, and recommended correction.
2. Test gaps: scenarios that should be verified.
3. Assumptions: instance-specific facts that were not available.
