---
name: update-set-preflight
description: "Use when: reviewing an exported ServiceNow Update Set XML, CSV, manifest, or supplied change list before deployment. Does not require MCP or instance access."
compatibility: "GitHub Copilot in Visual Studio Code and Antigravity IDE. Does not require MCP or instance access."
---

# Update Set Preflight

Perform a deployment-readiness review from exported Update Set material and user-provided context. Do not claim the set is complete, conflict-free, or safe to commit without evidence from the target instance.

## Install This Skill

- **Visual Studio Code + GitHub Copilot:** copy this complete folder to `.github/skills/update-set-preflight/`.
- **Antigravity IDE:** copy this complete folder to `.agents/skills/update-set-preflight/`.

The skill reviews supplied exports and change lists. It does not preview, commit, or inspect a target instance.

## Inventory Review

1. List the records by type and identify the affected application scope.
2. Highlight Business Rules, Client Scripts, Script Includes, ACLs, UI Policies, UI Actions, Flow Designer artifacts, system properties, and data records.
3. Flag deletes, deactivated records, and changes to shared/global artifacts for explicit review.
4. Identify likely dependencies that might not be captured, including tables, fields, roles, groups, properties, integrations, and application plugins.

## Risk Review

- Check server-side scripts for recursion, broad GlideRecord queries, and before-rule updates.
- Check client scripts for synchronous calls, direct DOM access, and unguarded onChange behavior.
- Check ACL changes for possible access expansion or unintended denials.
- Check properties and integration settings for environment-specific values, credentials, URLs, and sys_ids.
- Check update ordering where records reference one another.
- Flag customizations to baseline records as upgrade-risk candidates.

## Deployment Checklist

Require the reviewer to confirm:

- The set was captured in the intended scope and has a clear owner.
- The target instance has prerequisite plugins, tables, fields, roles, and properties.
- Test scenarios cover the changed behavior, error paths, role access, and regression risk.
- A rollback or remediation plan exists for data and security-affecting changes.
- The update preview and commit results will be reviewed by a qualified administrator.

## Review Output

Produce sections for blockers, risks, dependencies to confirm, test plan, and deployment notes. Distinguish confirmed exported content from assumptions that need target-instance validation.
