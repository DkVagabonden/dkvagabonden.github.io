# Zurich to Brazil: Upgrade Review Guide

Source review: 2026-11-13. Guide reorganized: 2026-11-16.

Use this guide to decide what affects your existing instance, test the required
actions, and record a decision. It is not a list of settings to enable blindly.
No instance configuration has been inspected or changed.

## Start Here

1. **Record the upgrade path.** Note the current and target family/patch, installed
	application versions, and the non-production instance used for testing.
2. **Work through the first-priority findings.** For each one, check the
	applicability statement before making a change. A new-instance default is not
	proof that an upgraded instance receives the same behavior.
3. **Choose the product-specific findings that apply.** Use the product names and
	the complete file appendix to find your installed products and integrations.
4. **Follow the numbered steps in non-production.** Keep the original value or
	configuration, test representative users and integrations, and collect evidence.
5. **Record a decision.** Use the record below for each applicable finding. Mark
	missing vendor instructions as Needs confirmation, not Done.
6. **Approve production work separately.** Schedule changes with an owner,
	validation, and a recovery plan. Do not treat successful document review as a
	completed instance upgrade.

**Review record:** Finding ID / Applies: Yes, No, or Unknown / Owner / Current
state / Decision / Test evidence / Production change reference / Status.

**Status:** Not checked, Needs confirmation, Ready for production, Done, or
Not applicable. Only use Done after the agreed implementation and validation;
record the reason for Not applicable.

The appendix retains all **373 product files**: **20 Now**, **216 Conditional**,
**22 Watch**, and **115 Feature**. These are source-file screening labels, not
373 separate implementation tasks or a claim that every product is installed.

## Find Your Work

- [Security and access](#security-and-access): ACLs, scripts, authentication, and search.
- [Requests, workspaces, and reporting](#requests-workspaces-and-reporting): catalog,
  incidents, dashboards, and older interfaces.
- [Infrastructure and CMDB](#infrastructure-and-cmdb): MID, drivers, encryption,
  APIs, and CI ingestion.
- [AI configuration](#ai-configuration): activation, providers, access, and integrations.
- [Product-specific actions](#product-specific-actions): use only the products you run.
- [Completion and source limits](#completion-and-source-limits): evidence and unresolved instructions.
- [Appendix: all 373 files](#appendix-all-373-files): complete source coverage and screening labels.

Start with the security, requester/reporting, and infrastructure checks. Skip a
finding only after documenting why its applicability condition does not match your
instance. AI and product-specific actions are conditional on what you use.

## Security and Access

### A01. Decide Whether to Enable Strict Denial for Invalid ACL Roles

**Release:** Brazil. **Owner to involve:** Platform security.

**What changed:** An ACL whose referenced roles are all missing can now deny
access predictably. This does not cover ACLs containing both valid and invalid roles.

**New versus upgraded:** On by default for new instances. Upgraded instances must
explicitly enable `glide.security.acl_with_invalid_roles_strict_deny` to adopt it.

**Check whether it affects you:** Review the instance's property value and the
ACLs identified under **All > Access Management > Access Findings**, in Access Checks.

**Source excerpt:**
> This behavior is on by default for new instances.

**Steps:**
1. In non-production, record whether the property exists and its current value.
	Do not assume a missing property means the new-instance default applies.
2. Open Access Findings and identify ACLs whose referenced roles are all invalid.
3. Review each affected ACL with its owner. Decide whether to correct stale role
	references, retain the present behavior temporarily, or adopt strict denial.
4. If approved, enable the property in non-production using the supported property
	administration procedure. Test the affected records as ordinary users and
	integration identities, including both allowed and denied access.
5. Record the decision, results, original configuration, and production change plan.

**Done when:** The decision is documented and, if enabled, affected access has
passed the agreed tests and production validation. Correcting ACLs alone is not
evidence that the property has been enabled.

**Needs confirmation:** The bundled note does not specify the property-creation
procedure or required administration role. Confirm those before changing it.

**Source:** [Access Management](delta-zurich-brazil/brazil-zurich-accessmanagement-release-notes.md),
Brazil > Changes > Explore Access Control Lists.

<details>
<summary>Other security checks: query ACLs, scripts, read-only fields, hardening, scopes, authentication, search</summary>

### A02. Check Custom Query ACLs That Become Inactive

**Release:** Australia. **Applies if:** You have custom query ACLs or install platform plugins.

**What changed:** Most platform plugins load preconfigured query ACLs during
installation. Store-app query ACLs are not included in that coverage.

> Existing custom query ACLs are preserved and loaded as inactive.

**New versus upgraded:** Preserving a custom ACL does not mean it stays active.

**Steps:**
1. List your custom query ACLs and record which are active before the change.
2. After upgrade/plugin installation in non-production, inspect inactive entries
	in the ACL list and compare them with the new rules.
3. Decide which custom restrictions are still required. Test permitted and
	forbidden range queries before approving any activation or replacement.

**Done when:** Required restrictions are covered by tested active rules.
**Needs confirmation:** Use KB2046494 for plugin-specific coverage; do not activate
every old rule indiscriminately.

**Source:** [Access Management](delta-zurich-brazil/brazil-zurich-accessmanagement-release-notes.md), Australia > Changes.

### A03. Find Scripts Rejected by the Guarded Evaluator

**Release:** Zurich Patch 9 / Australia Patch 2. **Applies to:** Sandbox scripts,
particularly public portals and unauthenticated requests.

**What changed:** Incompatible guest-submitted scripts are rejected by default.
Authenticated-user enforcement is phased and varies by instance type.

> Scripts that use unsupported features are recorded in the Incompatible Guarded Scripts list

**New versus upgraded:** Guest enforcement is described for all instances, not
only new ones. The old `glide.script.use.sandbox` property is removed.

**Steps:**
1. Exercise public forms and integrations in non-production, both as guest and
	authenticated users.
2. Review Incompatible Guarded Scripts and identify the owning customization.
3. Rewrite unsupported code and repeat the failing journey. Treat an exemption
	as a separate security decision, not a way to disable the sandbox globally.

**Done when:** Required journeys pass without unexplained rejected scripts.
**Needs confirmation:** Check the enforcement phase for your target patch and
instance type before predicting authenticated-user behavior.

**Source:** [Platform core](delta-zurich-brazil/brazil-zurich-servicenowaiplatformcorefeature-release-notes.md), New features and Deprecations.

### A04. Test Client Scripts That Update Read-Only Fields

**Release:** Australia upgrade guidance; also repeated in some Zurich product notes.
**Applies if:** Custom scripts modify ServiceNow-owned read-only fields.

**What changed:** `read_only_option` adds granular controls, including
`strict_read_only` and `client_script_modifiable`.

> maintain backward-compatible behavior

**New versus upgraded:** This is not a claim that every upgraded read-only field
starts failing. Existing custom code needs targeted testing.

**Steps:**
1. Identify `g_form.setValue()` / `g_form.clearValue()` calls that target
	read-only fields.
2. Follow KB2718122 to identify affected fields; test the relevant forms and
	scripts in non-production.
3. Correct the script or approve the appropriate field setting. Do not relax
	read-only security across the instance as a blanket workaround.

**Done when:** Required form behavior works and protected fields remain protected.
**Needs confirmation:** Affected-field identification and the exact setting for
each field require the linked vendor guidance.

**Source:** [Platform core](delta-zurich-brazil/brazil-zurich-servicenowaiplatformcorefeature-release-notes.md), Australia > Upgrade information;
[AI Admin Hub](delta-zurich-brazil/brazil-zurich-aiadminhub-release-notes.md), Australia > Upgrade information.

### A05. Compare Hardened Property Values After Upgrade

**Release:** Australia. **Applies to:** Platform security configuration.

**What changed:** Security-related Glide properties receive secure defaults.

> Glide properties that can impact instance security are set to secure values by default.

**New versus upgraded:** The combined note does not enumerate each property's
upgrade handling. Do not assume all custom values are overwritten or preserved.

**Steps:**
1. Obtain the affected-property list from KB1982254 and record your current values.
2. Compare effective values after a non-production upgrade.
3. Test affected integrations and obtain security approval for any exception.

**Done when:** Every relevant difference has a tested, owned decision.
**Needs confirmation:** Exact properties and override behavior come from KB1982254.

**Source:** [Platform core](delta-zurich-brazil/brazil-zurich-servicenowaiplatformcorefeature-release-notes.md), Australia > Changes.

### A06. Test Dot-Walking Across Application Scopes

**Release:** Australia. **Applies if:** Scripts or queries follow reference fields
into another application scope, especially on domain-separated instances.

**What changed:** Additional properties and a table attribute strengthen scope boundaries.

> Strengthen scope boundary enforcement

**New versus upgraded:** The note describes new controls but does not state every
default or retrofit rule.

**Steps:**
1. Use KB2793170 to identify the controls and check your cross-scope reference use.
2. Test representative permitted and denied dot-walks in non-production.
3. Correct affected code/access configuration and verify tenant/domain isolation.

**Done when:** Required cross-scope reads work without exposing restricted data.
**Needs confirmation:** Exact properties/defaults and the domain-separation bypass
check must be confirmed for your release.

**Source:** [Platform core](delta-zurich-brazil/brazil-zurich-servicenowaiplatformcorefeature-release-notes.md), Australia > New features;
[Domain Separation](delta-zurich-brazil/brazil-zurich-domainseparation-release-notes.md), Australia > Changes.

### A07. Retest Restricted Caller Access After Update Sets

**Release:** Brazil. **Applies if:** You deploy source-code changes used across scopes.

**What changed:** By default, source-code update-set commits invalidate related
Restricted Caller Access (RCA) records.

> invalidates RCA records at the time of the commits

**New versus upgraded:** Do not rely on an earlier approval remaining valid after
a deployment. The control is `glide.sys.fencing.restricted_caller_access.invalidation_mode`.

**Steps:**
1. Record the current control and identify affected cross-scope callers.
2. Commit a representative approved update set in non-production.
3. Inspect the resulting RCA state and run the dependent flows/integrations.
	Resolve new access requests through your approval process.

**Done when:** Deployment validation includes cross-scope calls and RCA outcomes.
**Needs confirmation:** Confirm supported property values before changing the
invalidation mode; they are not listed in this combined note.

**Source:** [Platform core](delta-zurich-brazil/brazil-zurich-servicenowaiplatformcorefeature-release-notes.md), Brazil > Changes.

### A08. Assess Basic Authentication Before Enforcing an Allowlist

**Release:** Brazil. **Applies if:** Users or integrations use Basic Authentication.

**What changed:** Basic Auth Restriction provides tracking followed by allowlist enforcement.

> Run the tracking period first

**New versus upgraded:** This is an enforcement feature to configure, not evidence
that the upgrade has already blocked every Basic Auth caller.

**Steps:**
1. Run tracking and identify callers, owners, and authentication alternatives.
2. Agree the required allowlist and test it in non-production, including blocked callers.
3. Enable production enforcement only through an approved change with monitoring.

**Done when:** Required callers are accounted for and enforcement tests match policy.
**Needs confirmation:** Check the documented allowlist categories and enforcement
configuration, including `snc_basic_auth_api_access`, before assigning exemptions.

**Source:** [Authentication](delta-zurich-brazil/brazil-zurich-authentication-release-notes.md), Brazil > New features.

### A09. Review Authentication and Identity Administration

**Release:** Australia; relevant Zurich baseline changes are also included.
**Applies if:** You configure inbound OAuth integrations, MFA/SSO, or AI identities.

**What changed:** Inbound integration configuration moves toward Machine Identity
Console. Granular administration roles replace reliance on broad admin access.
`glide.login.no_blank_password` is deprecated and no longer affects login behavior.

**New versus upgraded:** Configuration deprecation is not removal of OAuth itself.

**Steps:**
1. Inventory inbound integrations and the administrators who maintain them.
2. Test their configuration/authorization in Machine Identity Console and with
	the applicable granular roles. Check MFA/SSO and AI-user administration separately.
3. Remove reliance on ineffective login properties from operating procedures.

**Done when:** Integrations authenticate and approved administrators can maintain
them without unintended broad permissions.
**Needs confirmation:** Confirm which legacy configuration paths remain supported
for your exact patch; do not recreate every integration solely because of the notice.

**Sources:** [Authentication](delta-zurich-brazil/brazil-zurich-authentication-release-notes.md), Australia > New features / Deprecations;
[Identity](delta-zurich-brazil/brazil-zurich-identity-release-notes.md), Australia > New features / Changes.

### A10. Check OIDC Reauthentication Using max_age

**Release:** Brazil. **Applies if:** An OIDC client sends `max_age`.

**What changed:** Parameter handling is refined to align with OIDC Core 1.0;
authentication older than the requested age requires reauthentication.

**New versus upgraded:** Test existing clients; the note does not limit this to new instances.

**Steps:**
1. Identify clients that send `max_age` and record their expected sign-in behavior.
2. Test fresh and expired authentication sessions in non-production.
3. Correct client assumptions and document any user-visible login change.

**Done when:** Required reauthentication occurs without breaking the login journey.
**Needs confirmation:** Use the target-version OIDC documentation for edge cases.

**Source:** [Authentication](delta-zurich-brazil/brazil-zurich-authentication-release-notes.md), Brazil > Changes.

### A11. Check Search Results Against Indexed-Column ACLs

**Release:** Brazil. **Applies if:** You use Zing text indexes.

**What changed:** Column-level `query_range` read ACLs affect text search.
Legacy v3 indexes require access to every indexed column. With v4 indexes, matches
are limited to accessible columns instead.

**New versus upgraded:** A legacy index can lose results because one indexed
column is inaccessible; this is not just a new-instance default.

**Steps:**
1. Identify searchable tables and their text-index versions.
2. Run Text Search Query Range ACL Checker.
3. Test expected results and forbidden content with representative non-admin roles;
	resolve index/ACL issues using the supported procedure.

**Done when:** Allowed results remain searchable and restricted content stays hidden.
**Needs confirmation:** Plan any index-format migration using vendor guidance;
the combined note does not provide a rebuild procedure.

**Source:** [Zing search](delta-zurich-brazil/brazil-zurich-zingtextindexingandsearchengine-release-notes.md), Brazil > New features.

### A12. Reassess Security Center Findings

**Release:** Zurich/Australia hardening updates. **Applies to:** Security review.

**What changed:** Hardening baselines and family-specific recommendations change.
Accepted risk requires justification and affects compliance scoring.

**New versus upgraded:** A changed score is not by itself proof that configuration
changed or that the instance became safer.

**Steps:**
1. Record current hardening and Access Controls findings.
2. Reassess applicable findings after upgrade and assign remediation owners.
3. Document justified exceptions with a review date; do not accept risk merely
	to improve the score.

**Done when:** New/relevant findings have remediation or an approved exception.
**Needs confirmation:** Verify which baseline/check version applies to your patch.

**Source:** [Security Center](delta-zurich-brazil/brazil-zurich-securitycenter-release-notes.md), New features / Changes.

</details>

## Requests, Workspaces, and Reporting

<details>
<summary>Open the catalog, reports, incident, legacy UI, SOW, and notification review steps</summary>

### B01. Decide Whether to Migrate the Core UI Catalog

**Release:** Brazil. **Applies if:** Requesters still use the Core UI catalog.

**What changed:** The Angular portal replaces that requesting experience when
`com.glideapp.servicecatalog.ui16_portal` is installed.

> On new instances, the plugin is active by default.

**New versus upgraded:** Administrators must install the plugin on upgraded
instances if choosing this migration.

**Steps:**
1. Inventory catalog entry points, customizations, and requester roles.
2. Confirm prerequisites and test installation in non-production.
3. Test browse, variables, ordering, approvals, and existing links; approve the
	migration and user communication separately from the family upgrade.

**Done when:** The chosen experience supports the required requester journeys.
**Needs confirmation:** Confirm supported installation/recovery guidance before
activation; plugin removal must not be assumed to be a rollback option.

**Source:** [Service Catalog](delta-zurich-brazil/brazil-zurich-servicecatalog-release-notes.md), Brazil > New features.

### B02. Test Request Access for Catalog-Only Users

**Release:** Brazil. **Applies if:** Users have catalog roles but no request-management role.

**What changed:** Catalog-owned ACLs on Request/Requested Item tables and fields
stop granting access through catalog/catalog-admin roles alone.

**New versus upgraded:** Other ACLs may still grant access; do not predict a
blanket loss of access from this change alone.

**Steps:**
1. Identify users/integrations whose expected access depends on catalog roles.
2. Test required request-table reads/writes as those identities after upgrade.
3. Assign only the appropriate request-management access, or correct custom ACLs,
	after owner/security approval.

**Done when:** Required actions work and unrelated request data remains inaccessible.
**Needs confirmation:** Inspect the effective ACL path rather than assuming the
catalog team's ACLs are the only rules on the table.

**Source:** [Service Catalog](delta-zurich-brazil/brazil-zurich-servicecatalog-release-notes.md), Brazil > Deprecations.

### B03. Decide Whether Subscriptions May Bypass Catalog Criteria

**Release:** Brazil. **Applies if:** Service subscriptions grant catalog-item access.

**What changed:** `glide.sc.catalog_item.subscription_enforcement` offers
`require_criteria` and `allow_bypass` modes.

> "allow_bypass" is a default value.

**New versus upgraded:** The stricter option is not automatically adopted merely
because the feature exists.

**Steps:**
1. Record the effective property and identify subscription-based access paths.
2. Agree whether every requester must also meet Available for criteria.
3. If stricter behavior is approved, test `require_criteria` in non-production
	with subscribed users who meet and fail the criteria.

**Done when:** Access matches the approved policy and negative tests pass.
**Needs confirmation:** Confirm the effective value if the property is absent;
do not infer it from another instance's configuration.

**Source:** [Service Catalog](delta-zurich-brazil/brazil-zurich-servicecatalog-release-notes.md), Brazil > New features.

### B04. Prepare Users for Platform Analytics

**Release:** Australia. **Applies to:** Report/dashboard users.

**What changed:** Platform Analytics experience is enabled for all users on upgrade.

> Platform Analytics experience is enabled by default for all users on upgrade to Australia

**New versus upgraded:** This explicitly includes upgraded instances.

**Steps:**
1. Identify heavily used dashboards, owners, custom widgets, and access roles.
2. Test navigation, data, filters, editing, exports, and embedded content after upgrade.
3. Correct problems and communicate the changed experience before production.

**Done when:** Owners approve key reporting journeys and user communication is ready.
**Needs confirmation:** Validate each artifact; enabling the experience does not
prove every Core UI artifact has been migrated successfully.

**Source:** [Platform Analytics](delta-zurich-brazil/brazil-zurich-platformanalyticsexperience-release-notes.md), Australia > Changes.

### B05. Replace Access to Unpublished Public Reports

**Release:** Australia. **Applies if:** Core UI reports are publicly consumed or embedded.

**What changed:**
> All Core UI public reports are unpublished after upgrading.

**New versus upgraded:** This is an explicit upgrade action, separate from the
new analytics interface.

**Steps:**
1. Inventory public report URLs, embeds, audiences, and business owners.
2. Test those paths after a non-production upgrade, including unauthenticated access.
3. Agree a supported replacement/access model. The note allows report
	administrators to make reports available to logged-in users; do not assume
	anonymous publication should simply be restored.

**Done when:** Each required consumer has an approved, tested access path.
**Needs confirmation:** Confirm the supported replacement for each external/public use case.

**Source:** [Platform Analytics](delta-zurich-brazil/brazil-zurich-platformanalyticsexperience-release-notes.md), Australia > Upgrade information.

### B06. Test Analytics Hub Links and Homepage Migration

**Release:** Zurich baseline homepage/list migration; Australia Analytics Hub replacement.
**Applies if:** Users depend on homepages, simple lists, or Analytics Hub bookmarks.

**What changed:** Opened homepages migrate to Core UI dashboards and simple lists
convert to List elements. Analytics Hub is replaced by KPI Details.

**New versus upgraded:** Earlier Zurich work may already be complete. Check the
current state rather than scheduling an unnecessary second migration.

**Steps:**
1. List the affected homepages, list elements, and KPI bookmarks.
2. Check their resulting dashboards/elements and KPI Details redirects in non-production.
3. Update links, guidance, and any custom behavior that did not carry over.

**Done when:** Owners can reach and use the replacement content.
**Needs confirmation:** The note only promises migration of homepages that have
been opened; account for unused but still-required content explicitly.

**Sources:** [Platform Analytics](delta-zurich-brazil/brazil-zurich-platformanalyticsexperience-release-notes.md), Upgrade information;
[Performance Analytics](delta-zurich-brazil/brazil-zurich-performanceanalytics-release-notes.md), Australia > Deprecations.

### B07. Retest Incident Auto-Closure in Business Days

**Release:** Brazil. **Applies if:** Resolved incidents automatically close.

**What changed:** Auto-closure uses business days instead of calendar days,
controlled by `glide.ui.autoclose.time`; zero disables the feature.

**New versus upgraded:** This is distinct from the zboot-only On-Hold feature in B09.

**Steps:**
1. Record the property and your required closure policy.
2. Test resolved incidents across weekends and applicable non-working days in
	non-production using the target release's supported scheduling behavior.
3. Agree any value/procedure changes and notify process/reporting owners.

**Done when:** Observed closure dates match the approved business policy.
**Needs confirmation:** The combined note does not define the exact business-day
calendar used; confirm it before predicting holiday behavior.

**Source:** [Incident Management](delta-zurich-brazil/brazil-zurich-incidentmanagement-release-notes.md), Brazil > Changes.

### B08. Test Incident Communication Permissions

**Release:** Australia granular administration; Brazil communication ACL/role changes.
**Applies if:** You use major incidents, communication plans/tasks, or custom role checks.

**What changed:** Communication-channel ACLs move away from ITIL-only checks.
Granular incident/communication administration roles are introduced.

**New versus upgraded:** Several role-inheritance reductions apply only to zboot.
Upgraded major-incident/communication-plan managers retain ITIL inheritance;
additional granular roles are added when the ITSM Roles plugin is installed.

**Steps:**
1. Record the plugin state, effective role inheritance, and assigned personas.
2. Test communication plans/tasks, channel creation, incident administration,
	and denied access using non-admin test users.
3. Correct role/custom-ACL assumptions without granting broad ITIL access by default.

**Done when:** Each persona has the intended incident and communication permissions.
**Needs confirmation:** Check the exact ACL and role path on your instance; zboot
documentation is not proof that existing inheritance was removed.

**Source:** [Incident Management](delta-zurich-brazil/brazil-zurich-incidentmanagement-release-notes.md), New features / Changes.

### B09. Do Not Assume On-Hold Incidents Now Auto-Resolve

**Release:** Brazil. **Applies to:** Comparing new-instance defaults with your upgrade.

**What changed:** New zboot instances can notify an unresponsive caller and
auto-resolve an On-Hold incident after configured attempts.

> This is applicable only in the zboot instances.

**New versus upgraded:** The documented default is not an automatic behavior
change for an existing upgraded instance.

**Steps:**
1. Check whether equivalent automation is actually active on your instance.
2. If adopting it, have the process owner approve attempts, business-day intervals,
	exceptions, and the requester experience.
3. Test caller replies, strike exhaustion, and disabled automation in non-production.

**Done when:** The actual behavior is documented; adopt only through a separate approved change.
**Needs confirmation:** Obtain the precise upgrade-instance setup procedure if
you want to adopt the zboot functionality.

**Source:** [Incident Management](delta-zurich-brazil/brazil-zurich-incidentmanagement-release-notes.md), Brazil > New features.

### B10. Remove Dependencies on Unsupported UI11 and UI15

**Release:** Australia. **Applies if:** Users or custom links still invoke these legacy UIs.

**What changed:** UI11/UI15 no longer receive enhancements, fixes, or support.

**New versus upgraded:** Legacy rendering may still appear for some system
features; appearing on screen does not imply continued support.

**Steps:**
1. Inventory legacy UI entry points and custom assumptions.
2. Test replacements in Next Experience with the affected users.
3. Update links/procedures and record any unavoidable vendor-owned legacy rendering.

**Done when:** Required workflows have a supported interface or an owned vendor issue.
**Needs confirmation:** Confirm exceptions with ServiceNow rather than assuming
every printer-friendly legacy view must be rewritten by your team.

**Source:** [Next Experience](delta-zurich-brazil/brazil-zurich-nextexperience-release-notes.md), Australia > Deprecations.

### B11. Replace Legacy Workspace List and Condition Components

**Release:** Zurich baseline. **Applies if:** You customized UI Builder workspaces.

**What changed:** List, List - Simple, List - Related, and Condition Builder are
unavailable in UI Builder; replacements are Record List and Predicate Builder.

**New versus upgraded:** An existing custom page needs regression review; the
note does not prove that every old page is automatically rewritten.

**Steps:**
1. Identify pages/variants that depend on the older components.
2. Test list actions, filtering, related lists, and event/data bindings.
3. Use supported replacement bundles where needed and retest custom interactions.

**Done when:** Required page variants work with supported components.
**Needs confirmation:** Check migration guidance before replacing a component
whose inputs/events your page customizes.

**Source:** [Configurable Workspace](delta-zurich-brazil/brazil-zurich-configurableworkspace-release-notes.md), Zurich > Deprecations.

### B12. Decide Which UI16 Links Should Redirect to SOW

**Release:** Australia. **Applies if:** You use Service Operations Workspace (SOW).

**What changed:** UI16 module links can redirect to equivalent SOW forms/lists.
The property is `sn_sow_itsm_admin.experience_redirection_enabled.sow`.

**New versus upgraded:** New-instance configuration is available automatically.
Upgrade-instance administrators configure it in SOW Admin Center.

**Steps:**
1. Choose applications/tables and user groups that should be redirected.
2. Configure and test the policy in non-production, including custom tables.
3. Test bookmarks, forms/lists, and users outside the selected groups.

**Done when:** Targeted links reach the correct workspace without redirecting unintended users.
**Needs confirmation:** Check prerequisites and supported mappings before enabling globally.

**Source:** [SOW for ITSM](delta-zurich-brazil/brazil-zurich-serviceoperationsworkspaceforitsm-release-notes.md), Australia > New features.

### B13. Verify SOW Application Version Compatibility

**Release:** Zurich/Australia/Brazil activation guidance. **Applies if:** SOW is installed.

**What changed:** Family upgrades install documented SOW versions. ITSM and ITOM
workspace content applications must be compatible.

**New versus upgraded:** A family upgrade is not evidence that every installed
Store content app is at the right version.

**Steps:**
1. Record versions of `sn_sow_itsm_cont` and `sn_sow_itom_cont` and the SOW app.
2. Check the linked compatibility guidance against your target.
3. Upgrade compatible dependencies as needed and test combined ITSM/ITOM pages.

**Done when:** The installed combination is supported and required pages pass.
**Needs confirmation:** Obtain the current compatibility matrix; do not use the
bundled example/default version as a universal target.

**Source:** [SOW for ITSM](delta-zurich-brazil/brazil-zurich-serviceoperationsworkspaceforitsm-release-notes.md), Upgrade information / Activation information.

### B14. Test Notification and Email Security Changes

**Release:** Australia; Brazil adds further inbound privacy configuration.
**Applies if:** You use CLE-enabled email tables, custom inbound processing, or email administration.

**What changed:** Email attachments in CLE-enabled tables are encrypted at rest
and decrypted for outbound delivery. Notifications also introduces granular admin roles.

**New versus upgraded:** Test your real configuration; this is not a claim that
all outbound attachments become encrypted for their recipients.

**Steps:**
1. Identify affected tables, attachment handlers, threading rules, and administrators.
2. Test inbound storage, authorized reads, outbound delivery, and reply threading.
3. Review inbound privacy controls and admin permissions before enabling new email automation.

**Done when:** Approved mail flows preserve privacy, permissions, and correct replies.
**Needs confirmation:** Confirm the exact CLE/privacy prerequisites and effective
settings for the features you use.

**Source:** [Notifications](delta-zurich-brazil/brazil-zurich-notifications-release-notes.md), Australia / Brazil > New features / Changes.

</details>

## Infrastructure and CMDB

<details>
<summary>Open the MID, JDBC, encryption, API, Dynamic Schema, and CMDB review steps</summary>

### C01. Check MID Runtime and Download Requirements

**Release:** Zurich/Australia upgrade guidance. **Applies if:** You run MID Servers.

**What changed:** Runtime support checks, download connectivity, and security-log
storage requirements must be met. Australia bundles JRE 21.

**New versus upgraded:** Bring-your-own JRE needs explicit verification; do not
substitute the separate Edge Encryption requirements in C05.

**Steps:**
1. Inventory hosts, runtime versions, free space, and custom runtime configuration.
2. Check the target-version MID requirements and access to `install.service-now.com`.
3. Run MID pre-upgrade checks, upgrade in non-production, and verify validation,
	Discovery/integration execution, and at least 100 MB security-log capacity.

**Done when:** Hosts meet the target requirements and MID-dependent jobs pass.
**Needs confirmation:** Check current target-patch minimum/recommended JRE versions;
older Zurich recommendations are not a Brazil support matrix.

**Source:** [MID Server](delta-zurich-brazil/brazil-zurich-midserver-release-notes.md), Upgrade information / Changes.

### C02. Find Duplicate Windows Services for One MID Installation

**Release:** Zurich/Australia upgrade guidance. **Applies if:** MID runs on Windows.

**What changed:** Multiple services pointing at the same installation folder
cannot start after upgrade.

**New versus upgraded:** This explicitly affects upgraded Windows MID installations.

**Steps:**
1. Compare Windows service executable paths with MID installation directories.
2. Identify duplicates and plan their correction with the host owner.
3. Apply the supported correction and verify start/stop, registration, and job execution.

**Done when:** Each installation has a valid service configuration and starts successfully.
**Needs confirmation:** Use the linked MID Server fails to start procedure;
do not delete services without identifying their owning installation.

**Source:** [MID Server](delta-zurich-brazil/brazil-zurich-midserver-release-notes.md), Upgrade information.

### C03. Supply a Supported MSSQL JDBC Driver

**Release:** Australia. **Applies if:** JDBC integrations connect to Microsoft SQL Server.

**What changed:** `mssql-jdbc.7.4.1.jre8` is no longer bundled with MID Server.

**New versus upgraded:** Existing integrations may still depend on that removed JAR.

**Steps:**
1. Inventory MSSQL JDBC sources, driver dependencies, and executing MID hosts.
2. Follow KB0862383 and vendor guidance to select/install a supported driver.
3. Test connection, authentication, representative queries, and scheduled imports.

**Done when:** Required JDBC jobs pass using the supported installed driver.
**Needs confirmation:** Driver/runtime compatibility and installation location
must be checked; do not assume reinstalling the old JRE8 JAR is the best target.

**Source:** [Import and Export](delta-zurich-brazil/brazil-zurich-importandexport-release-notes.md), Australia > Changes.

### C04. Find Remaining GlideEncrypter Dependencies

**Release:** Zurich baseline, repeated in Australia. **Applies if:** Custom code uses GlideEncrypter/3DES.

**What changed:** 3DES is removed. Upgraded instances retain a KMF/AES-backed
compatibility API; new Zurich-or-later instances cannot use it.

**New versus upgraded:** Compatibility on an upgraded instance is not support
for copying the same code to a new instance. Setting
`glide.security.glideencrypter.allow=false` disables that upgraded-instance API.

**Steps:**
1. Inventory callers, encrypted data, KMF/CLE dependencies, and the current allow setting.
2. Plan supported KMF replacements and test encryption/decryption of existing
	and new data in non-production.
3. Disable compatibility only after dependent use is resolved and recovery is planned.

**Done when:** Required data is readable and approved code uses supported cryptography.
**Needs confirmation:** Use KB1704481 / KB1700704 and target-version KMF guidance
for data migration; do not delete keys or assume property reversal recovers data.

**Sources:** [Encryption](delta-zurich-brazil/brazil-zurich-encryption-release-notes.md), Upgrade information;
[Encryption Key Management](delta-zurich-brazil/brazil-zurich-encryptionkeymanagement-release-notes.md), Upgrade information;
[Key Management](delta-zurich-brazil/brazil-zurich-keymanagement-release-notes.md), Changes.

### C05. Meet Edge Encryption Prerequisites Before Brazil

**Release:** Brazil. **Applies if:** You operate an Edge Encryption proxy.

**What changed:** Java 21 or later is required before upgrading the proxy.
Scheduled upgrade also requires Zurich Patch 13 / Australia Patch 6 or later.

> If you're on an earlier version, scheduled upgrade will not work.

**New versus upgraded:** These are pre-upgrade conditions for existing proxies.

**Steps:**
1. Record proxy, Java, and platform-patch versions and the intended upgrade method.
2. Meet the Java and applicable patch prerequisites using the supported procedure.
3. Test the proxy upgrade and encrypted traffic in non-production before scheduling production.

**Done when:** All prerequisites and encryption traffic tests pass.
**Needs confirmation:** Confirm proxy-version compatibility, change order, and
recovery guidance; command-line upgrade does not waive Java 21.

**Source:** [Encryption](delta-zurich-brazil/brazil-zurich-encryption-release-notes.md), Brazil > Upgrade information.

### C06. Replace Removed API and Mobile SDK Calls

**Release:** Australia. **Applies if:** Custom apps or mobile clients use the affected APIs.

**What changed:** `GlideElementDynamicAttribute`, iOS NowAnalyticsService /
NowAnalyticsServiceDelegate, and Android NowAnalyticsSDK are removed.

**New versus upgraded:** This is removal, not a new-instance-only activation difference.

**Steps:**
1. Search custom source and mobile dependencies for the named classes.
2. Replace dynamic-attribute calls with the appropriate typed GlideElement API;
	obtain supported replacements for the mobile analytics integration.
3. Build and regression-test the affected clients and server paths.

**Done when:** Required code no longer relies on removed APIs and tests pass.
**Needs confirmation:** The combined note does not name every mobile replacement;
verify the SDK-specific migration guidance.

**Source:** [API](delta-zurich-brazil/brazil-zurich-api-release-notes.md), Australia > Deprecations.

### C07. Verify Dynamic Schema Migration

**Release:** Zurich baseline, repeated for later upgrade paths.
**Applies if:** Dynamic Schema was implemented in Xanadu/Yokohama or code uses dynamic groups.

**What changed:** The framework migrates automatically. Dynamic groups are removed;
`getGroupName()` can return null for migrated/new attributes.

**New versus upgraded:** Automatic framework migration does not remove the need
to update custom assumptions or verify attribute data.

**Steps:**
1. Inventory dynamic attributes, group-based code, and dependent forms/integrations.
2. Follow KB2146133 to verify migration and required manual follow-up.
3. Test data access, scripts, null handling, and workspace filtering.

**Done when:** Migrated attributes and dependent code work with the current framework.
**Needs confirmation:** Check the exact migration state before running any fix
script; do not repeat a baseline migration without guidance.

**Sources:** [Platform core](delta-zurich-brazil/brazil-zurich-servicenowaiplatformcorefeature-release-notes.md), Upgrade information / Deprecations;
[API](delta-zurich-brazil/brazil-zurich-api-release-notes.md), Zurich > Deprecations.

### C08. Decide Whether to Switch Static IRE to Dynamic IRE

**Release:** Brazil. **Applies if:** Your upgraded instance still uses Static IRE.

**What changed:** Dynamic IRE becomes the new zboot default and improves dynamic
identification/rule updates during ingestion.

> on upgraded instances that are using Static IRE you can switch into using Dynamic IRE

**New versus upgraded:** The upgrade does not automatically make a Static IRE
instance use Dynamic IRE.

**Steps:**
1. Identify the current IRE mode, data sources, identification rules, and known duplicates.
2. Review the linked Dynamic IRE adoption procedure and test it in non-production.
3. Compare CI matching, updates, duplicate creation, and reconciliation outcomes;
	approve a switch only when those results are acceptable.

**Done when:** The mode decision and ingestion evidence are recorded.
**Needs confirmation:** Obtain the supported activation and recovery procedure;
the combined note does not supply an adoption property or one-click rollback.

**Source:** [CMDB](delta-zurich-brazil/brazil-zurich-configurationmanagementdatabasecmdb-release-notes.md), Brazil > Changes / Upgrade information.

### C09. Check the Manual CMDB Role-Cleanup Job

**Release:** Zurich baseline; Australia repeats it for direct Xanadu/Yokohama upgrades.
**Applies if:** The role migration has not already been completed.

**What changed:** New instances separate CMDB roles from ITIL inheritance.
Upgraded instances have a documented manual scheduled job.

**New versus upgraded:** Verify completion instead of assuming new-instance
role containment was applied to your existing instance.

**Steps:**
1. Review current `itil`, `itil_admin`, `sn_cmdb_editor`, and `sn_cmdb_admin`
	inheritance and CI create/update/delete permissions.
2. Read KB2290506 and assess the job **Remove CMDB Roles from ITIL roles and
	Add CUD access to sn_cmdb_admin/sn_cmdb_editor roles**.
3. If applicable, run it through an approved non-production change and test CMDB
	editors, administrators, and users who should lose unrelated access.

**Done when:** Intended CMDB permissions and inheritance are proven by role tests.
**Needs confirmation:** Verify prior execution, custom roles/ACLs, and target-path
applicability before running a role-mutating job.

**Source:** [CMDB](delta-zurich-brazil/brazil-zurich-configurationmanagementdatabasecmdb-release-notes.md), Zurich / Australia > Upgrade information.

### C10. Correct CIs Affected by Removal of Design Status

**Release:** Zurich baseline. **Applies if:** CIs created through Manual via IRE retain the removed value.

**What changed:** Design is no longer an Operational status option.

**New versus upgraded:** Existing affected records need review; a newer family
does not prove that historical cleanup was completed.

**Steps:**
1. Identify CIs whose discovery source is Manual via IRE.
2. Review their operational status with data owners and choose supported values.
3. Test dependent reporting/automation before applying approved corrections.

**Done when:** Relevant records have supported, business-correct status values.
**Needs confirmation:** Non-Operational is an example, not a blanket replacement
for every CI; use the documented lifecycle model.

**Source:** [CMDB](delta-zurich-brazil/brazil-zurich-configurationmanagementdatabasecmdb-release-notes.md), Zurich > Upgrade information / Deprecations.

### C11. Budget for CMDB Composite-Index Upgrade Time

**Release:** Australia. **Applies to:** Upgrade scheduling, especially large `cmdb_ci` tables.

**What changed:** A composite-index addition can increase upgrade duration.

**New versus upgraded:** This is an existing-data upgrade concern, not a feature to enable.

**Steps:**
1. Review KB2588894 with the upgrade owner before booking the change window.
2. Rehearse on representative non-production data and record elapsed time.
3. Adjust the production window and monitoring according to the supported guidance.

**Done when:** The upgrade plan includes a realistic duration and escalation path.
**Needs confirmation:** Do not invent index changes or promise a duration without
the KB and a representative rehearsal.

**Source:** [CMDB](delta-zurich-brazil/brazil-zurich-configurationmanagementdatabasecmdb-release-notes.md), Australia > Upgrade information.

</details>

## AI Configuration

Only apply these findings where the relevant AI applications are installed or
being adopted. An installed plugin, an active asset, an entitled feature, and a
user's permission are different things; check each explicitly.

<details>
<summary>Open the shared AI activation, provider, access, validation, A2A, and regional-routing checks</summary>

### D01. Compare AI Assets Activated During Updates

**Release:** Asset/app-specific Zurich patches and Australia onward.
**Applies if:** Now Assist / ServiceNow Otto products are installed.

**What changed:** Designated untouched skills, agents, or workflows can turn on
automatically. Assets intentionally enabled then disabled remain inactive.

> Any previously unconfigured skill is turned on automatically

**New versus upgraded:** Upgrading existing customers can be affected, not only
new installations. Some product notes also describe role-configuration exceptions.

**Steps:**
1. Export or otherwise record asset activation, configuration, and roles before updates.
2. Compare effective state after non-production app/plugin updates.
3. Approve newly active assets with security/process owners; test access, actions,
	cost exposure, and intentionally disabled assets.

**Done when:** Every unexpected activation is resolved or explicitly approved.
**Needs confirmation:** Check the exact app/patch and per-asset rules. Do not use
one shared activation date for every AI product.

**Sources:** [AI Admin Hub](delta-zurich-brazil/brazil-zurich-aiadminhub-release-notes.md), Changes;
[Otto for SIR](delta-zurich-brazil/brazil-zurich-servicenowottoforsecurityincidentresponsesirsir-release-notes.md), Upgrade information;
[Now Assist for VR](delta-zurich-brazil/brazil-zurich-nowassistforvulnerabilityresponse-release-notes.md), Upgrade information.

### D02. Verify the Effective LLM Provider

**Release:** Australia changes, with related notices in Zurich patches and Brazil.
**Applies if:** You use AI skills, agents, or workflows.

**What changed:** New/inactive AI assets default to a third-party LLM. Existing
Now LLM configurations are described as retained, but separate upgrade warnings
say routing to an unprovisioned provider can cause failures.

> existing configurations using the Now LLM Service continue unchanged

**New versus upgraded:** Do not treat either the retained-setting statement or
the routing warning as a guarantee for every installed asset.

**Steps:**
1. Record each important asset's configured provider, availability, and data-policy approval.
2. Execute it after non-production updates and verify the provider actually used.
3. Correct provisioning/routing and retest custom UI actions, functionality, and consumption.

**Done when:** Effective providers are approved, provisioned, and tested.
**Needs confirmation:** Reconcile conflicting app/version notices with current
guidance. Older-model restrictions for new development do not imply that every
published skill immediately stops working.

**Sources:** [AI Admin Hub](delta-zurich-brazil/brazil-zurich-aiadminhub-release-notes.md), Australia > Changes;
[ServiceNow Otto](delta-zurich-brazil/brazil-zurich-servicenowotto-release-notes.md), Upgrade information;
[Public Sector Digital Services](delta-zurich-brazil/brazil-zurich-publicsectordigitalservices-release-notes.md), Upgrade information.

### D03. Audit AI Access Instead of Assuming Deny-by-Default Was Retrofitted

**Release:** Zurich/Australia/Brazil AI Agent Studio notes.
**Applies if:** Agentic record types or tools are available on your instance.

**What changed:** Deny-by-default access applies to newly activated instances for
`gen_ai_agent`, `gen_ai_workflow`, `gen_ai_skill`, `Flow`, and `flow_action`.

> for newly activated ServiceNow instances

**New versus upgraded:** The note does not promise that existing instances receive
the same ACL configuration automatically.

**Steps:**
1. Inspect effective discover/execute access for your installed AI assets.
2. Test permitted users, unauthorized users, and any public exposure.
3. Approve/correct ACLs and security controls with the security owner; retest tool execution.

**Done when:** Actual access matches the approved least-privilege model.
**Needs confirmation:** No retrofit property/procedure is supplied here. Obtain
the supported existing-instance guidance rather than inventing a switch.

**Source:** [AI Agent Studio](delta-zurich-brazil/brazil-zurich-aiagentstudio-release-notes.md), New features.

### D04. Decide Whether AI Record Updates Must Apply UI Validation

**Release:** Zurich/Australia changes. **Applies if:** AI updates records governed
by required fields or other UI validation.

**What changed:** `glide.ai_record_activity.validation.feature.enabled` enables
UI-rule validation, with additional execution-context controls.

> This feature is opt-in and disabled by default.

**New versus upgraded:** Having an updated AI app does not mean this validation is enabled.

**Steps:**
1. Identify AI update paths and the rules your business expects them to obey.
2. Review context-specific properties, including
	`glide.ai_record_activity.ai_detection.nap.enabled` for the Otto panel.
3. Test approved validation settings in non-production with valid and invalid
	updates from each used channel.

**Done when:** AI updates obey the agreed rules without breaking authorized flows.
**Needs confirmation:** Use the linked AI-agent reference for all required
context controls; a single property may not cover every channel.

**Source:** [AI Agent Studio](delta-zurich-brazil/brazil-zurich-aiagentstudio-release-notes.md), Changes.

### D05. Test A2A Credentials After the Header Change

**Release:** Zurich/Australia changes. **Applies if:** Agent2Agent endpoints require a Bearer token.

**What changed:** A2A flow actions no longer insert the Bearer prefix automatically.

> include the prefix directly in the API Key credential value

**New versus upgraded:** Existing credentials relying on automatic insertion need review.

**Steps:**
1. Identify affected A2A connections without displaying tokens in tickets or logs.
2. Update the credential format in non-production according to endpoint requirements.
3. Test authentication and agent execution, including expiry/failure handling.

**Done when:** Required connections authenticate with the expected header format.
**Needs confirmation:** Confirm endpoint-specific requirements; do not add a
Bearer prefix to every unrelated API-key integration.

**Source:** [AI Agent Studio](delta-zurich-brazil/brazil-zurich-aiagentstudio-release-notes.md), Changes > External agents with Agent2Agent.

### D06. Approve Regional Data Routing Before Google Web Search

**Release:** Zurich change notice. **Applies if:** AI web-search tools use Google.

**What changed:** Grounding with Google Search uses Global Standard deployment;
data may be routed outside your instance's specified regions.

**New versus upgraded:** This is a provider/use-case policy check, not a claim
that the family upgrade sends all instance data to Google.

**Steps:**
1. Identify Google-backed search tools, users, and data that could enter prompts.
2. Review provider deployment/data policies with security and privacy owners.
3. Approve, constrain, or disable that use case and test the approved configuration.

**Done when:** The selected provider/use case has explicit data-policy approval.
**Needs confirmation:** Confirm contractual and regional requirements using
current provider and ServiceNow documentation.

**Source:** [AI Agent Studio](delta-zurich-brazil/brazil-zurich-aiagentstudio-release-notes.md), Zurich > Changes.

</details>

## Product-Specific Actions

Open only the groups matching your installed products or planned adoption. Each
numbered finding is a separate review record, not an instruction to enable a feature.
The release labels below identify the source row or application boundary, not a
guarantee that your installed Store app already contains the change.

<details>
<summary>Access and security products: HAM, SPM partitions, CSM/FSO, Data Privacy, Vault, OT/Discovery</summary>

### E01. Decide Whether to Restrict Asset Reads

**Release / applies if:** Zurich Patch 12, Australia Patch 5, and Brazil HAM guidance;
users have only `snc_internal` and can read asset records.

**Change:** `sn_itam_restrict_asset_read` defaults to false. True restricts these
users to assets assigned to or referencing them. Users with additional roles retain
full read access under the described behavior; this is not universal asset isolation.

**Steps:**
1. Record the property and test an internal-only user against owned and unrelated assets.
2. Agree the desired access model and test true in non-production, including child tables.
3. Check portal/integration regressions and audit customized or deleted asset ACL roles.

**Done when:** The approved access model passes positive and negative tests.
**Confirm first:** Property availability and the effective ACL path on your app version.
**Source:** [HAM](delta-zurich-brazil/brazil-zurich-hardwareassetmanagement-release-notes.md), Upgrade information.

### E02. Check Administrators' Access to SPM Partitions

**Release / applies if:** SPM Enterprise-Wide Deployment v1.0.5+; partitioned data is used.

**Change:** `sn_spm_ewd.allow_admin_access_to_all_partitions` defaults false.
Administrators without the relevant partition role lose access after the documented update.

**Steps:**
1. Inventory administrators, partition roles, and required access.
2. Test approved and denied access in non-production after updating.
3. Prefer correct partition roles; enable the all-partitions bypass only with an
	explicit governance decision and tests.

**Done when:** Administrator visibility matches the approved partition policy.
**Confirm first:** The applicable app version and existing property value.
**Source:** [SPM EWD](delta-zurich-brazil/brazil-zurich-spmenterprisewidedeployment-release-notes.md), Brazil > Upgrade information / Changes.

### E03. Decide Where to Enable Additional Partition Security

**Release / applies if:** Brazil Extended Security for EWD; Project, Demand,
Program, or Portfolio data needs partition protection.

**Change:** Additional ACL enforcement is explicitly enabled per table through
**Configure SPM > Partitions > Enable additional security**. Do not assume a family
upgrade enables it. Existing-record partition backfill is a separate preparation step.

**Steps:**
1. Finish partition configuration and assign required user/group roles.
2. Review and test **Update existing records with partition details** after that setup.
3. Enable additional security on selected tables in non-production and verify
	parent/related records, hidden records, and authorized cross-partition visibility.

**Done when:** Existing and new records enforce the intended boundaries.
**Confirm first:** Supported table coverage, backfill procedure, and recovery plan.
**Sources:** [Extended EWD security](delta-zurich-brazil/brazil-zurich-extendedsecurityforenterprisewidedeployment-release-notes.md), Brazil > New features;
[SPM EWD](delta-zurich-brazil/brazil-zurich-spmenterprisewidedeployment-release-notes.md), Australia > New features.

### E04. Test Public CSM and FSO Access Against Deny-Unless ACLs

**Release / applies if:** Zurich baseline; CSM/FSO portals or APIs serve unauthenticated users.

**Change:** Deny-unless ACLs restrict create/read/update/delete operations on affected
tables to authenticated users. Public-role access must not be assumed to survive.

**Steps:**
1. Identify intentionally public use cases and affected tables.
2. Test them as guests and authenticated external users in non-production.
3. Agree a supported secure design for legitimate public intake; do not simply remove deny ACLs.

**Done when:** Approved public journeys work without exposing protected case data.
**Confirm first:** Exact table/ACL coverage and supported public-access design.
**Sources:** [CSM cases](delta-zurich-brazil/brazil-zurich-casemanagementforcsm-release-notes.md), Zurich > Changes;
[FSO Core](delta-zurich-brazil/brazil-zurich-financialservicesoperationscore-release-notes.md), Zurich > New features.

### E05. Replace the Unsupported Data Separation Application

**Release / applies if:** Australia; the Data Separation application is used.

**Change:** It is no longer deployed, enhanced, or supported. This does not mean
that the separate Domain Separation capability is discontinued.

**Steps:**
1. Inventory isolation rules and the data/users they protect.
2. Design a replacement with Data Filters and ACLs using KB0558290.
3. Test allowed and forbidden access before retiring old dependencies.

**Done when:** A supported replacement protects every required isolation case.
**Confirm first:** Vendor migration guidance; do not remove isolation controls before validation.
**Source:** [Data Separation](delta-zurich-brazil/brazil-zurich-dataseparation-release-notes.md), Australia > Deprecations.

### E06. Test Discovery Artifacts Against Code Signing

**Release / applies if:** Australia Code Signing update; Discovery uses probes,
parameters, or sensors, especially custom ones.

**Change:** Unsigned/tampered payloads can be blocked. Brazil also records protected
record changes by default on production instances when Code Signing is active.

**Steps:**
1. Inventory custom Discovery artifacts and review missing/invalid signature findings.
2. Apply the supported signing process and test MID execution in non-production.
3. Review audit access, retention, and maximum record count before production.

**Done when:** Legitimate payloads execute, invalid payloads are rejected, and audit retention is approved.
**Confirm first:** Applicable plugin/configuration, trusted certificates, and signing procedure.
**Source:** [Code Signing](delta-zurich-brazil/brazil-zurich-codesigning-release-notes.md), Australia / Brazil > New features.

### E07. Review Attachment Quarantine Before Adopting Real-Time Scanning

**Release / applies if:** Australia Data Privacy; sensitive-data upload scanning is used or planned.

**Change:** Detected sensitive attachments can be quarantined, restricting access
until review. This is a feature configuration, not proof every upload is now scanned.

**Steps:**
1. Identify protected upload paths, authorized reviewers, and business exceptions.
2. Test sensitive and ordinary files, including owner/reviewer download permissions.
3. Agree review/release handling and user communication before enabling in production.

**Done when:** Sensitive uploads follow policy without stranding required documents.
**Confirm first:** Activation prerequisites and supported quarantine-review procedure.
**Source:** [Data Privacy](delta-zurich-brazil/brazil-zurich-dataprivacy-release-notes.md), Australia > New features.

### E08. Review Vault's Default Step-Up Policies

**Release / applies if:** Brazil; installing Zero Trust Access with ServiceNow Vault.

**Change:** Default step-up authentication policies are applied automatically on
installation. Policies supplied by ServiceNow use the Vault by Default prefix.

**Steps:**
1. Inspect the policies created in Vault Console after non-production installation.
2. Test normal and elevated-access journeys with affected users/integrations.
3. Approve or adjust policies using the supported procedure before production.

**Done when:** Step-up requirements match policy and required access paths work.
**Confirm first:** Installation-specific scope; do not assume every existing Vault
instance has had identical policies retrofitted.
**Source:** [Vault](delta-zurich-brazil/brazil-zurich-servicenowvault-release-notes.md), Brazil > New features / Changes.

### E09. Review Vault AI Workflows and Administration Roles

**Release / applies if:** Australia/Brazil; ServiceNow Otto for Vault is installed.

**Change:** Several security-configuration AI workflows default on at installation.
Vault Console no longer requires `security_admin` elevation; Brazil workflows also
remove that role from role masking. Azure OpenAI is the documented default AI provider.

**Steps:**
1. Record installed workflows, active state, effective roles, and provider.
2. Test approved administrators and AI actions with least-privilege users.
3. Approve activation/provider choices and review any custom `security_admin` assumptions.

**Done when:** Only intended users and workflows can alter data protection.
**Confirm first:** Exact app version and workflow scope; use D01/D02 for the shared
activation/provider checks. Default log export still requires explicit configuration activation.
**Source:** [Vault](delta-zurich-brazil/brazil-zurich-servicenowvault-release-notes.md), Australia / Brazil > New features / Changes.

### E10. Preserve Customized Privacy Risk Statements

**Release / applies if:** Privacy Management Content v22.3.x; existing risk statements are customized.

**Change:** Reinstalling existing statements after the content update may overwrite changes.

**Steps:**
1. Identify and preserve custom statement content before updating/reinstalling.
2. Compare the updated content in non-production.
3. Merge only approved changes and verify downstream assessments/control mappings.

**Done when:** Required customizations and new regulatory content are both accounted for.
**Confirm first:** Supported content installation/merge procedure for your package version.
**Source:** [Privacy Management](delta-zurich-brazil/brazil-zurich-privacymanagement-release-notes.md), Australia > New features.

### E11. Review ICW Archival Before Applying the Default Retention

**Release / applies if:** Australia Industrial Connected Workforce Core; Action,
Deviation, or RCA records are retained for audit/operations.

**Change:** Archival rules introduce a configurable 24-month default retention
period and activation controls.

**Steps:**
1. Inspect the effective rule state, properties, and existing record ages.
2. Compare with legal/operational retention and test archival/retrieval in non-production.
3. Approve the configuration and preservation plan before production execution.

**Done when:** Retention and retrieval satisfy the record owners' requirements.
**Confirm first:** Whether rules are active on your instance and the exact inactivity criteria.
**Source:** [ICW Core](delta-zurich-brazil/brazil-zurich-industrialconnectedworkforcecore-release-notes.md), Australia > New features.

### E12. Keep Discovery Credentials Off Unencrypted HTTP

**Release / applies if:** Zurich ITOM Visibility; HTTP Classify is used.

**Change:** Credentials are no longer attempted over HTTP by default. Setting
`mid.http_classy.allow_credentials_over_http=true` overrides that protection.

**Steps:**
1. Identify classification failures caused by HTTP-only endpoints.
2. Prefer enabling/fixing HTTPS and keep the property false.
3. Test classification and credential handling; require security approval for any exception.

**Done when:** Required Discovery works without unintended cleartext credential transmission.
**Confirm first:** Effective MID property and endpoint behavior; do not restore the
old behavior simply to clear a Discovery error.
**Source:** [ITOM Visibility](delta-zurich-brazil/brazil-zurich-itomvisibility-release-notes.md), Zurich > Changes.

</details>

<details>
<summary>AI and knowledge products: AI Control Tower, GAIC, Knowledge Center, Virtual Agent, Creator, Subscription Management</summary>

### E13. Recheck AI Control Tower Sampling Limits After Upgrade

**Release / applies if:** Brazil; AI Control Tower security metrics are configured.

**Change:** Upgrade resets Sampling rate and Max skill calls to new defaults.
Detection enabled is retained. This explicitly changes upgraded-instance settings.

**Steps:**
1. Record current limits and the intended monitoring/cost tradeoff.
2. After non-production upgrade, inspect **Settings > Rules and templates > Security**.
3. Restore or adjust approved limits and verify metric collection and expected usage.

**Done when:** Effective limits and detection state match the approved configuration.
**Confirm first:** New numeric defaults and any metric-specific limits are not listed here.
**Source:** [AI Control Tower](delta-zurich-brazil/brazil-zurich-aicontroltower-release-notes.md), Brazil > Changes.

### E14. Migrate Veza Authentication to OAuth

**Release / applies if:** Brazil; the AI Control Tower Veza connector is used.

**Change:** OAuth 2.0 replaces API-key authentication; `sn_ai_security.veza.api.key` is deprecated.

**Steps:**
1. Configure an approved OAuth profile/alias in non-production.
2. Select it under **Settings > Integrations > Connectors**.
3. Test discovery/access operations and verify whether tokens are per-user or system-level.

**Done when:** The connector uses the intended identity model and required operations succeed.
**Confirm first:** Credential/grant requirements and supported cutover procedure; do not expose secrets in review records.
**Source:** [AI Control Tower](delta-zurich-brazil/brazil-zurich-aicontroltower-release-notes.md), Brazil > Changes / Deprecations.

### E15. Plan AI Control Tower's Redesigned Experience Separately

**Release / applies if:** Combined Zurich-to-Brazil notes; legacy AI Control Tower is in use.

**Change:** A redesigned experience has a documented migration path. Some metrics
are removed, reorganized, or require AI Security Exposure Management instead of base functionality.

**Steps:**
1. Use KB3144679 to map your current app, connections, dashboards, and dependencies.
2. Test the migration and confirm each required metric remains available or has an alternative.
3. Resolve missing-plugin and legacy-connection issues before scheduling production.

**Done when:** Required governance/monitoring functions have a supported tested home.
**Confirm first:** AI Gateway lifecycle wording varies by row/version; do not
confuse a deprecated legacy application with the new September 2026 gateway.
**Source:** [AI Control Tower](delta-zurich-brazil/brazil-zurich-aicontroltower-release-notes.md), Upgrade information / Changes / Deprecations.

### E16. Replace Direct Generative AI Controller Action Calls

**Release / applies if:** Zurich Patch 5+; custom flows call GAIC actions directly.

**Change:** Direct calls are unsupported so AI capabilities can be protected by ACLs.

**Steps:**
1. Find custom Generate Content, QnA, Summarize, Generic Prompt, and Sentiment Analysis use.
2. Follow KB2716977 and implement supported AI Skill Kit replacements.
3. Test outputs, caller authorization, error handling, and cost before cutover.

**Done when:** Required flows no longer depend on unsupported direct actions.
**Confirm first:** Exact replacement design and entitlement; this is not a request
to recreate removed actions without access control.
**Source:** [Generative AI Controller](delta-zurich-brazil/brazil-zurich-generativeaicontroller-release-notes.md), Zurich > Changes.

### E17. Review Longer Generative AI Log Retention

**Release / applies if:** Zurich/Australia GAIC notes; `sys_generative_ai_log` contains sensitive data.

**Change:** Documented retention increases from 30 to 180 days.

**Steps:**
1. Inspect effective retention and which prompts/responses or metadata are stored.
2. Obtain privacy/security approval for the retained content and duration.
3. Test approved retention configuration and access to logs in non-production.

**Done when:** Logging, access, and retention match approved policy.
**Confirm first:** Actual configured retention may differ from the documented default.
**Source:** [Generative AI Controller](delta-zurich-brazil/brazil-zurich-generativeaicontroller-release-notes.md), New features.

### E18. Decide Whether AI Control Tower May Discard Trace Data

**Release / applies if:** Combined AI Control Tower notes; trace/session insights are used.

**Change:** Trace/session/span data can be retained for scoring or discarded.
Discarding also disables AI Skill Kit insights and hides evaluated-session views.

**Steps:**
1. Identify required troubleshooting, audit, and evaluation evidence.
2. Compare the configured retention with those requirements and storage policy.
3. Test the chosen option and the availability of dependent insights before production.

**Done when:** The retention decision includes its functional and evidence consequences.
**Confirm first:** The exact retention controls for your app version; a default is not stated here.
**Source:** [AI Control Tower](delta-zurich-brazil/brazil-zurich-aicontroltower-release-notes.md), New features.

### E19. Align Agent Role Masking With Tool ACLs

**Release / applies if:** Zurich/Australia AI application updates; role-restricted agents/workflows are used.

**Change:** Installed agent roles must be included in selected-role security
controls or the asset may not execute. Tool/action ACL roles must also align.

**Steps:**
1. Inventory run-as identities, role masks, selected-role controls, and tool ACLs.
2. Compare them with each installed agent's documented required roles.
3. Test permitted/forbidden execution and, where used, Twilio and Microsoft 365 actions.

**Done when:** Required agents execute with only approved permissions.
**Confirm first:** Requirements are per asset; broad admin or ITIL grants are not
an acceptable substitute for identifying the missing permission.
**Sources:** [Otto for ITSM](delta-zurich-brazil/brazil-zurich-servicenowottoforitservicemanagementitsm-release-notes.md), New features / Changes;
[CMDB](delta-zurich-brazil/brazil-zurich-configurationmanagementdatabasecmdb-release-notes.md), Changes.

### E20. Update CMDB AI Skill Permissions and Documentation Content

**Release / applies if:** Zurich/Australia; Otto for CMDB is used.

**Change:** Create configuration item requires `sn_cmdb_admin` rather than editor.
Panel skills add `now_assist_panel_user` requirements; contextual documentation help
requires the External Content Connectors plugin, documentation connector, and a crawl.

**Steps:**
1. Match each used skill to its required role, including `cmdb_dedup_admin` where documented.
2. Test creation, duplicate remediation, and governance advice as intended personas.
3. If using contextual help, install/configure the documented connector and verify crawled content.

**Done when:** Approved personas can use the intended skills without wider access.
**Confirm first:** Check the per-skill role list and activation-path changes for your version.
**Source:** [Otto for CMDB](delta-zurich-brazil/brazil-zurich-servicenowottoforconfigurationmanagementdatabasecmdb-release-notes.md), Upgrade information / Changes.

### E21. Decide Whether Knowledge Articles May Auto-Update and Publish

**Release / applies if:** Australia Knowledge Center; Article Optimization is used.

**Change:** Auto-update needs the skill, `sn_km_center.ao_auto_update.enabled`
(default-on), and the knowledge base's AO auto publish setting.
One default-on property does not mean all knowledge articles publish automatically.

**Steps:**
1. Inventory skill state, property, and per-knowledge-base publication settings.
2. Agree the eligible content, approvals, and review responsibilities.
3. Test generated changes, publication, permissions, and recovery with sample articles.

**Done when:** Actual publication behavior matches the knowledge owners' decision.
**Confirm first:** Version-specific skill and knowledge-base controls before enabling.
**Source:** [Knowledge Center](delta-zurich-brazil/brazil-zurich-knowledgecenter-release-notes.md), Australia > Activation information.

### E22. Decide Whether Duplicate Articles May Auto-Merge

**Release / applies if:** Australia Knowledge Center; automatic merge/publish is planned.

**Change:** Auto-merge has separate skills, `sn_km_gen_ai.auto_merge.enable`,
knowledge-base publish settings, confidence thresholds, and a limited revert window.

**Steps:**
1. Review the Identify duplicate articles / Merge Articles skills and publish controls.
2. Approve `sn_km_gen_ai.auto_merge.confidence_threshold` and
	`sn_km_gen_ai.auto_merge.revert_ttl_days` values.
3. Test a merge, resulting publication/citations, and reversion before production.

**Done when:** Owners approve merge quality, publishing, and recovery limits.
**Confirm first:** Reversion is not available indefinitely; verify the configured window.
**Source:** [Knowledge Center](delta-zurich-brazil/brazil-zurich-knowledgecenter-release-notes.md), Australia > Activation information.

### E23. Reconfigure Messages and Fallbacks When Adopting Premium Chat

**Release / applies if:** Zurich onward; existing assistants opt into premium chat.

**Change:** Legacy messages/fallbacks are not migrated automatically. Eligible
new customers have a different default/available chat experience.

**Steps:**
1. Inventory current greetings, fallbacks, custom assets, channels, and provider.
2. Check eligibility and configure premium messages/fallbacks in Assistant Designer.
3. Test failure, live-agent handoff, catalog, and supported-channel journeys.

**Done when:** Required custom conversations work in the chosen experience.
**Confirm first:** Premium prerequisites/provider restrictions and supported return
path; `sn_nowassist_va.enable_nap_aix_experience` affects available configuration options.
**Sources:** [Now Assist in Virtual Agent](delta-zurich-brazil/brazil-zurich-nowassistinvirtualagent-release-notes.md), New features;
[Otto for Virtual Agent](delta-zurich-brazil/brazil-zurich-servicenowottoforvirtualagent-release-notes.md), Australia / Brazil > New features.

### E24. Plan Virtual Agent Legacy Replacements Without Calling Everything Removed

**Release / applies if:** Zurich-to-Brazil; NLU/Lite, legacy channel integrations,
Microsoft LUIS, or Sensitive Data Handler/Masking are used.

**Change:** LUIS is unsupported. Sensitive Data Handler/Masking has a Data Privacy
replacement. Brazil NLU/Lite and selected channels are planned deprecations with
existing support retained, not immediate wholesale removal.

**Steps:**
1. Identify the exact installed capability, channel, and support status.
2. Prioritize unsupported dependencies; plan migration for supported legacy ones.
3. Test replacements, including privacy masking, and retire only verified dependencies.

**Done when:** Each used legacy capability has a tested replacement or an owned migration plan.
**Confirm first:** Current support dates and identity of legacy/new products.
**Source:** [Otto for Virtual Agent](delta-zurich-brazil/brazil-zurich-servicenowottoforvirtualagent-release-notes.md), Deprecations;
also see removed `sn_aia.use_agents_in_planner` in [Now Assist in Virtual Agent](delta-zurich-brazil/brazil-zurich-nowassistinvirtualagent-release-notes.md).

### E25. Replace the Archived Incident Assist Skill

**Release / applies if:** Zurich Patch 9 / Australia Patch 2 retirement, with earlier
replacement guidance; the old Incident assist skill is used.

**Change:** The old skill becomes archived/unavailable; an enhanced agentic workflow is active by default.

**Steps:**
1. Identify old skill activation, entry points, customizations, and replacement workflow.
2. Test replacement permissions and incident-assist behavior in non-production.
3. Remove obsolete dependencies and duplicate activation according to the applicable patch guidance.

**Done when:** Supported incident assistance works without relying on the archived skill.
**Confirm first:** Exact retirement patch and asset versions; the combined notes
contain overlapping timeline statements.
**Source:** [Otto for ITSM](delta-zurich-brazil/brazil-zurich-servicenowottoforitservicemanagementitsm-release-notes.md), Upgrade information / Deprecations.

### E26. Check Now Assist Context Menu Customizations

**Release / applies if:** Zurich Patch 4 baseline; ITSM context menu was customized before that update.

**Change:** The documented update does not preserve those NACM customizations.

**Steps:**
1. Determine whether the affected update was already applied and the customizations restored.
2. Compare required actions/prompts with the current non-production menu.
3. Reapply supported configuration where needed and regression-test permissions and output.

**Done when:** Required custom actions work on the target version.
**Confirm first:** Use the linked NACM upgrade guidance; do not repeat already-completed baseline work.
**Source:** [Otto for ITSM](delta-zurich-brazil/brazil-zurich-servicenowottoforitservicemanagementitsm-release-notes.md), Zurich > Upgrade information.

### E27. Enable App Summary Only After Reviewing the New Agent

**Release / applies if:** Brazil ServiceNow Studio; application summaries are required.

**Change:** Summary generation moves from a skill to an AI agent that is off
after installation to avoid unexpected charges.

**Steps:**
1. Confirm App Summary plugin/agent installation, entitlements, and cost expectations.
2. If approved, enable the agent in AI Agent Studio in non-production.
3. Test generation and user access before a production activation decision.

**Done when:** Approved users can generate summaries with understood consumption.
**Confirm first:** Effective agent state after your particular update, not only a fresh install.
**Source:** [ServiceNow Studio](delta-zurich-brazil/brazil-zurich-servicenowstudio-release-notes.md), Brazil > Changes.

### E28. Replace Removed Creator Spoke Generation

**Release / applies if:** Zurich/Australia Otto for Creator; the spoke-generation capability is used.

**Change:** Spoke generation has been removed from this product.

**Steps:**
1. Identify development procedures or automation relying on it.
2. Obtain the supported alternative and its entitlement/prerequisites.
3. Test that alternative and update the team's build instructions.

**Done when:** Required spoke development has a supported workflow.
**Confirm first:** The combined note does not supply a like-for-like replacement.
**Source:** [Otto for Creator](delta-zurich-brazil/brazil-zurich-servicenowottoforcreator-release-notes.md), Deprecations.

### E29. Verify AI Guardian Coverage and Blocking Policy

**Release / applies if:** Documented Zurich/Australia patches; generative AI is used.

**Change:** Guardian detection/logging defaults on, but blocking is configurable.
Skill-level coverage has exceptions, including platform/custom skills in the
documented prompt-injection setting.

**Steps:**
1. Inventory instance/skill-level settings and supported provider coverage.
2. Agree detection versus blocking policy with security owners.
3. Test supported guardrail cases in non-production and verify logs and responses.

**Done when:** Actual coverage and enforcement match the approved policy.
**Confirm first:** Per-skill/provider support; default detection is not a guarantee of universal blocking.
**Source:** [AI Admin Hub](delta-zurich-brazil/brazil-zurich-aiadminhub-release-notes.md), New features.

### E30. Synchronize AI Usage Measurement Across Instances

**Release / applies if:** Australia Early Access measurement change and Subscription
Management app updates; AI usage is measured across multiple instances.

**Change:** Usage moves from a 365-day look-back to a burn-down model resetting
at contract anniversary. Australia guidance specifies Subscription Management v6.1+
on all instances to avoid mixed measurement states.

**Steps:**
1. Inventory app versions, contract anniversary, and usage reporting on every relevant instance.
2. Check KB2704710 and align compatible app versions; earlier Zurich guidance differs.
3. Validate consumption, reset expectations, and demo-instance exclusions with license owners.

**Done when:** Usage reporting is consistent and finance/license owners understand the model.
**Confirm first:** Current contract-specific measurement and supported version combination.
**Sources:** [Subscription Management](delta-zurich-brazil/brazil-zurich-subscriptionmanagement-release-notes.md), Changes;
[AI Admin Hub](delta-zurich-brazil/brazil-zurich-aiadminhub-release-notes.md), Changes.

### E31. Check Whether Manual Subscription Allocation Is Still Available

**Release / applies if:** Zurich Patch 11 / Australia notices; administrators use user-based allocation.

**Change:** Administrators who used manual allocation retain it; those who never
used it no longer receive that workflow. This differs by history, not simply instance age.

**Steps:**
1. Identify who uses manual allocation and which subscriptions depend on it.
2. Test the available workflow after non-production updates.
3. Document the supported allocation process for both existing and new administrators.

**Done when:** License administrators have a workable, documented allocation process.
**Confirm first:** Actual administrator history and subscription type.
**Source:** [Subscription Management](delta-zurich-brazil/brazil-zurich-subscriptionmanagement-release-notes.md), Changes.

</details>

<details>
<summary>Data and integrations: Service Exchange, IDR, HLA, RPA, Kubernetes, Synthetic Monitoring, Clone, ERP, SDK, TISC</summary>

### E32. Plan the Service Exchange Upgrade Sequence

**Release / applies if:** Zurich/Australia guidance; Service Exchange / Service Bridge is used.

**Change:** Legacy configurations need a migration path. Provider and consumer
apps on one instance must be upgraded together to compatible matching versions;
entitlement activation also depends on the documented compatibility version.

**Steps:**
1. Inventory both ends' app/platform versions and current entitlements.
2. Follow KB1499823 / KB1700387 for the applicable legacy-to-v2 path and rehearse it.
3. Test old/new entitlements, synchronization, connections, and the post-upgrade scan suite.

**Done when:** Both ends work in a supported combination and migration scans are resolved.
**Confirm first:** The Australia pre-Patch-1 RPS blocker is historical; verify the
actual target patch rather than treating it as proof of the same Brazil defect.
**Sources:** [Service Exchange](delta-zurich-brazil/brazil-zurich-serviceexchange-release-notes.md), Upgrade information;
[Service Bridge / Exchange](delta-zurich-brazil/brazil-zurich-serviceexchangeformerlyservicebridge-release-notes.md), Australia > Upgrade information.

### E33. Check the Service Exchange Missing-Deny-ACL Repair Case

**Release / applies if:** The documented pre-family-upgrade combination of Service
Exchange v2.0.55 and Sales CRM v1.0.4 was installed.

**Change:** New deny ACLs may not be installed in that specific sequence.

**Steps:**
1. Establish whether your version/install history matches the documented case.
2. Inspect the affected ACL state and follow the post-upgrade application Repair guidance.
3. Re-run security tests and the application scan suite in non-production.

**Done when:** Expected deny ACLs exist and allowed/denied access is correct.
**Confirm first:** Required ACLs and repair prerequisites; do not repair unrelated
applications merely because your platform was upgraded.
**Source:** [Service Bridge / Exchange](delta-zurich-brazil/brazil-zurich-serviceexchangeformerlyservicebridge-release-notes.md), Australia > Upgrade information.

### E34. Migrate Service Exchange OAuth Grants on Both Ends

**Release / applies if:** Service Exchange v2.3.x; connections use authorization-code grants.

**Change:** Existing connections must move to client credentials to avoid User Not Authenticated errors.

**Steps:**
1. Inventory affected provider/consumer connections and their credential owners.
2. Follow KB2944968 on both ends after the upgrade and before using the connection.
3. Test authentication, token renewal, and synchronized operations.

**Done when:** Both ends use the supported grant and required transactions succeed.
**Confirm first:** Grant/scopes and identity permissions; do not copy credentials into the review record.
**Source:** [Service Bridge / Exchange](delta-zurich-brazil/brazil-zurich-serviceexchangeformerlyservicebridge-release-notes.md), Australia > Upgrade information.

### E35. Move Legacy IDR Replication Sets to V2

**Release / applies if:** Zurich baseline; Instance Data Replication uses legacy sets.

**Change:** Legacy sets are unsupported. V2 uses Hermes Messaging Service.

**Steps:**
1. Inventory replication sets, filters, endpoints, and synchronization expectations.
2. Follow the linked Upgrading legacy sets procedure in non-production.
3. Validate data consistency, scheduling, errors, and downstream consumers before cutover.

**Done when:** Required replication uses supported sets and data reconciliation passes.
**Confirm first:** Migration order, recovery, and endpoint compatibility.
**Source:** [IDR](delta-zurich-brazil/brazil-zurich-instancedatareplication-release-notes.md), Zurich > Upgrade information / Deprecations.

### E36. Preserve Needed IDR Error Logs Before Upgrade

**Release / applies if:** Zurich/Australia IDR upgrade; old replication errors are needed.

**Change:** Upgrade enables rotation on `idr_replication_payload_error` and
truncates records created before the upgrade. The documented rotation uses seven
shards of five days each.

**Steps:**
1. Have operations/audit owners identify logs that must be retained.
2. Preserve required evidence through an approved method before the upgrade.
3. Check post-upgrade rotation and new error logging against retention policy.

**Done when:** Required historical evidence is preserved and new logging is verified.
**Confirm first:** Preservation/retrieval procedure; do not assume truncated records
will remain available through the normal application UI.
**Source:** [IDR](delta-zurich-brazil/brazil-zurich-instancedatareplication-release-notes.md), Upgrade information.

### E37. Plan for HLA Historical Log Unavailability

**Release / applies if:** Brazil Health Log Analytics; older alerts are needed for investigation.

**Change:** Short-term logs move automatically to LogDB. Earlier alerts remain,
but surrounding historical logs are unavailable in the new experience because the
existing data remains in Elasticsearch. The note prescribes no customer migration action.

**Steps:**
1. Identify unresolved investigations or evidence needs involving historical alert logs.
2. Agree preservation/access requirements with the service owner before transition.
3. Verify new ingestion and alert context after transition; escalate unexpected gaps.

**Done when:** The team accepts the historical limitation and new logs populate correctly.
**Confirm first:** Ask ServiceNow about supported access to old data if needed;
do not describe unavailable logs as proven deleted or promise a self-service backfill.
**Source:** [HLA](delta-zurich-brazil/brazil-zurich-healthloganalytics-release-notes.md), Brazil > Changes.

### E38. Upgrade External Robot and Desktop Installers

**Release / applies if:** Relevant RPA Hub / AI Desktop Actions update; external software is installed.

**Change:** Instance upgrades do not replace endpoint MSIs. Older robot versions
do not work with the documented newer release.

**Steps:**
1. Inventory RPA Desktop Design Studio, Attended/Unattended Robot, Login Agent,
	and AI Desktop Actions versions where used.
2. Check supported OS/runtime requirements, stop the relevant execution/app, and
	install matching supported software in non-production.
3. Test connection, authentication, representative automation, and scheduled execution.

**Done when:** Endpoints and instance apps run supported matching versions.
**Confirm first:** RPA's `glide.rollback.blacklist.TableParentChange.change`
instructions apply to old San Diego/Tokyo paths, not automatically Zurich-to-Brazil.
Check AI Desktop Actions' Windows/.NET/display or macOS/extension requirements separately.
**Sources:** [RPA Hub](delta-zurich-brazil/brazil-zurich-rpahub-release-notes.md), Upgrade information / Requirements;
[AI Desktop Actions](delta-zurich-brazil/brazil-zurich-aidesktopactions-release-notes.md), Upgrade information / Requirements.

### E39. Update the Kubernetes Visibility Agent in Each Cluster

**Release / applies if:** Brazil KVA; clusters have an existing agent deployment.

**Change:** After the Store app update, cluster deployments need the corresponding agent version.

**Steps:**
1. Inventory the app and each cluster deployment/version.
2. Update a non-production cluster through the supported deployment procedure.
3. Verify permissions, discovered resources, ingestion, and dependency views before rollout.

**Done when:** Required clusters report through supported corresponding versions.
**Confirm first:** Deployment method and the legacy discovery API's future removal timeline.
**Source:** [KVA](delta-zurich-brazil/brazil-zurich-kubernetesvisibilityagentkva-release-notes.md), Brazil > Upgrade information / Deprecations.

### E40. Restart MID Locations Used by Synthetic Monitoring

**Release / applies if:** Zurich baseline; Synthetic Monitoring uses MID-based locations.

**Change:** The MID Server must be restarted after the documented upgrade to run monitors there.

**Steps:**
1. Identify affected MID locations and their monitors.
2. Schedule the supported restart with the host owner after updating.
3. Confirm monitor execution, results, alert generation, and any OAuth credentials.

**Done when:** Required monitors run and expected alert behavior is verified.
**Confirm first:** Current MID/app versions and maintenance impact; this is not a
request to restart every unrelated MID Server.
**Source:** [Synthetic Monitoring](delta-zurich-brazil/brazil-zurich-syntheticmonitoring-release-notes.md), Upgrade information / New features.

### E41. Retest Clone Registration and Authentication

**Release / applies if:** Australia/Brazil Clone Admin Console; cross-instance cloning is used.

**Change:** Authentication moves to JWT certificates. Optional OAuth target
authentication requires both source and target on Australia Patch 5 or later.
Legacy list/form clone requests are unsupported and redirect.

**Steps:**
1. Inventory source/target registration, clone profiles/scripts, and request automation.
2. Configure/test the supported authentication in non-production on compatible endpoints.
3. Validate request submission, profile behavior, and old entry-point redirects.

**Done when:** Approved clone requests work without obsolete credential assumptions.
**Confirm first:** Registration/certificate procedures and target compatibility;
do not execute a production clone as a documentation check.
**Source:** [Clone Admin Console](delta-zurich-brazil/brazil-zurich-cloneadminconsole-release-notes.md), Changes / New features / Deprecations.

### E42. Move ERP Scheduled Extractions With the Documented Fix Script

**Release / applies if:** Zurich baseline; Zero Copy Connector for ERP has existing scheduled extractions.

**Change:** **Scheduled Extraction V2 Move** puts schedules in the new table/script engine.

**Steps:**
1. Inventory existing extraction schedules and determine whether migration already ran.
2. Follow the linked Run fix scripts procedure in non-production if still required.
3. Check schedule preservation, execution, extracted data, and supported ERP source versions.

**Done when:** Required extractions execute from the supported schedule structure.
**Confirm first:** Script applicability and recovery; also use D01/D02/E19 for ERP
AI activation, providers, and permissions rather than treating renaming as migration.
**Source:** [Zero Copy ERP](delta-zurich-brazil/brazil-zurich-zerocopyconnectorforerp-release-notes.md), Zurich > Upgrade information.

### E43. Reauthenticate Windows SDK Users After Keytar Removal

**Release / applies if:** ServiceNow SDK v4.3+; Windows users have stored credentials.

**Change:** Old stored credentials are unsupported after the documented update.

**Steps:**
1. Identify affected developer/automation environments and installed SDK versions.
2. Re-add credentials locally using `now-sdk auth --add` and the supported auth flow.
3. Test authentication and required development/deployment operations.

**Done when:** Intended environments authenticate successfully without relying on old storage.
**Confirm first:** The approved auth method; enter secrets only in the credential
prompt, never in the guide, chat, logs, or review evidence.
**Source:** [SDK](delta-zurich-brazil/brazil-zurich-servicenowsdk-release-notes.md), Upgrade information.

### E44. Update SDK Build and API Assumptions

**Release / applies if:** Zurich/Australia SDK changes; SDK-based build/deployment is used.

**Change:** `now-sdk build` compiles but does not package; `pack` / `install`
provide packaging. `now-sdk upgrade` is removed; Fluent snake_case properties and
some `$id` usage are deprecated.

**Steps:**
1. Review pipeline commands and source for the affected SDK conventions.
2. Apply the documented version-upgrade/API replacements and explicit packaging step.
3. Build, inspect the deployable artifact, and test installation in non-production.

**Done when:** The pipeline produces and deploys a valid artifact with supported APIs.
**Confirm first:** Exact SDK/instance compatibility and current command syntax.
**Source:** [SDK](delta-zurich-brazil/brazil-zurich-servicenowsdk-release-notes.md), New features / Deprecations.

### E45. Retest TISC Correlation and Relationship Limits

**Release / applies if:** Brazil Threat Intelligence Security Center; automated correlation is used.

**Change:** New rules affect future relationships; old relationships remain.
The common-observables correlation rule is removed, and potential-relationship
creation stops at a configured volume threshold.

**Steps:**
1. Inventory used correlation rules, relationship volumes, and business expectations.
2. Test new feed ingestion and relationship creation in non-production.
3. Review the threshold and replace dependencies on removed logic without
	assuming old relationships will be recalculated automatically.

**Done when:** Required correlation works within approved volume/performance limits.
**Confirm first:** Exact replacement rules and threshold settings for your app version.
**Source:** [TISC](delta-zurich-brazil/brazil-zurich-threatintelligencesecuritycenter-release-notes.md), Brazil > Upgrade information.

### E46. Replace the TISC Email-Template Property

**Release / applies if:** Australia TISC; custom report/email configuration references the old property.

**Change:** `sn_sec_tisc.reporting.email_template_sn_sec_tisc_case` is replaced by
`sn_sec_tisc.default_report_email_template`.

**Steps:**
1. Find property consumers and record the intended report email template.
2. Update the supported configuration/custom references in non-production.
3. Generate and deliver a test report to an approved test recipient.

**Done when:** Required report emails use the intended template without the unsupported property.
**Confirm first:** App-version availability and whether your existing configuration was migrated.
**Source:** [TISC](delta-zurich-brazil/brazil-zurich-threatintelligencesecuritycenter-release-notes.md), Australia > Changes.

</details>

<details>
<summary>Risk and assessments: TPRM, Operational Resilience, AI Risk and Compliance</summary>

### E47. Confirm Sequential Upgrade Requirements

**Release / applies if:** TPRM/VRM, Operational Resilience, or AI Risk and Compliance
upgrade paths described in the combined notes.

**Change:** The relevant notes require sequential upgrades so migration scripts
run in order. Skipping required stages can cause data inconsistency or broken behavior.

**Steps:**
1. Record starting platform/app versions and migration history.
2. Confirm the required supported sequence with the product upgrade guidance.
3. Rehearse the sequence and validate script results/data before production planning.

**Done when:** The upgrade sequence is approved and migration evidence is complete.
**Confirm first:** Whether the requirement concerns platform families, app versions,
or both for your start state. Do not generalize it to every ServiceNow application.
**Sources:** [TPRM](delta-zurich-brazil/brazil-zurich-thirdpartyriskmanagement-release-notes.md), Upgrade information;
[Operational Resilience](delta-zurich-brazil/brazil-zurich-operationalresilience-release-notes.md), Brazil > Upgrade information;
[AI Risk and Compliance](delta-zurich-brazil/brazil-zurich-airiskandcompliance-release-notes.md), Brazil > Upgrade information.

### E48. Treat TPRM Smart Assessment Enablement as Irreversible

**Release / applies if:** TPRM v21.0.x+ migration guidance; the legacy assessment engine is used.

**Change:** Enabling `sn_vdr_risk_asmt.sae_enabled` makes Smart Assessment Engine
(SAE) the default and replaces the legacy experience.

> The transition is irreversible.

**Steps:**
1. Inventory legacy templates, assessments, integrations, and required differences.
2. Migrate templates through the TPRM application and test end-to-end outside production.
3. Obtain explicit owner approval, preservation, and recovery arrangements before production enablement.

**Done when:** The approved migration and assessment validation are complete.
**Confirm first:** Vendor migration/backup guidance. Turning the property back off
must not be presented as a rollback plan.
**Source:** [TPRM](delta-zurich-brazil/brazil-zurich-thirdpartyriskmanagement-release-notes.md), Australia / Brazil > Upgrade information.

### E49. Review TPRM Custom Role Combinations Before the Grace Period Ends

**Release / applies if:** TPRM v22.3.3+; custom role combinations or broad admin access are used.

**Change:** TPRM roles stop directly inheriting `grc_business_user` / `grc_reader`.
Most users migrate to feature-specific roles; custom combinations may not migrate automatically.

**Steps:**
1. Inventory persona access and custom role combinations before updating.
2. Compare migrated permissions in non-production, including administrators and external responders.
3. Assign approved feature-specific roles and resolve gaps before the applicable grace deadline.

**Done when:** Required personas pass access tests under the new model.
**Confirm first:** Obtain the actual grace deadline and migration rules; the combined
note does not supply a date to use for every instance.
**Source:** [TPRM](delta-zurich-brazil/brazil-zurich-thirdpartyriskmanagement-release-notes.md), Upgrade information / Changes / Deprecations.

### E50. Update TPRM Consumers of the Company Industry Field

**Release / applies if:** TPRM v21.0.3+; custom code/reporting uses Company Industry.

**Change:** Data migrates automatically to `tprm_industry`; custom consumers need review.

**Steps:**
1. Inventory references to the original Industry column.
2. Wait for the documented migration completion log and reconcile data in non-production.
3. Update approved consumers and validate reports/integrations before considering old-column removal.

**Done when:** Data and consumers use the intended column consistently.
**Confirm first:** The exact column/migration state; do not drop historical fields
without an approved dependency, retention, and recovery assessment.
**Source:** [TPRM](delta-zurich-brazil/brazil-zurich-thirdpartyriskmanagement-release-notes.md), Upgrade information.

### E51. Remove TPRM Assessment Data-Model Assumptions

**Release / applies if:** Australia TPRM; custom assessments/integrations use legacy scoring/entity fields.

**Change:** `scoring_rule` / `scoring_rule_ref` fields are removed from assessment
forms/UI sections; entity-based assessments are unsupported. Third-party elements
also move to single-third-party ownership in the documented update.

**Steps:**
1. Identify affected fields, entity-based assessments, and shared-element assumptions.
2. Plan supported replacements with the assessment owner and migrate/test custom consumers.
3. Validate scoring, ownership, portal responses, and reporting on representative assessments.

**Done when:** Required assessments work without the deprecated data-model assumptions.
**Confirm first:** App-version-specific replacement fields and migration steps.
**Source:** [TPRM](delta-zurich-brazil/brazil-zurich-thirdpartyriskmanagement-release-notes.md), Australia > Changes / Deprecations.

### E52. Decide Whether to Activate Quarterly DORA Report Generation

**Release / applies if:** Digital Resilience Third-party Information Register v23.0.3;
quarterly Register of Information CSV reports are required.

**Change:** **DORA: Quarterly CSV download** is delivered inactive by default
and reuses settings from the most recent download request.

**Steps:**
1. Review the last request's filters/settings and the required reporting period.
2. As the authorized TPRM administrator, test the scheduled job in non-production.
3. If approved, activate/schedule it under **All > System Definition > Scheduled Jobs**.

**Done when:** The correct quarter and approved scope are generated and validated.
**Confirm first:** Schedule, effective filters, and owner; the feature's presence
does not mean the report will run automatically on your instance.
**Source:** [TPRM](delta-zurich-brazil/brazil-zurich-thirdpartyriskmanagement-release-notes.md), Brazil > Changes.

### E53. Refresh Operational Resilience Dependency Metadata

**Release / applies if:** Operational Resilience v21.0.x upgrade guidance; dependency data is used.

**Change:** **Update CSDM and other dependencies** must be rerun to populate new metadata.

**Steps:**
1. Check the installed version, job history, and existing dependency results.
2. Follow the documented job procedure in non-production when the update is applicable.
3. Validate dependency chains, top-level nodes, impacted objects, and reports.

**Done when:** Required dependency metadata and results are correct.
**Confirm first:** Prior execution and target-path relevance; do not rerun a
baseline job unnecessarily on a later completed migration.
**Source:** [Operational Resilience](delta-zurich-brazil/brazil-zurich-operationalresilience-release-notes.md), Zurich > Upgrade information / Deprecations.

### E54. Check Operational Resilience Jobs Instead of Assuming They Are Enabled

**Release / applies if:** Operational Resilience v22.0.x+; CSDM dependencies/red flags are used.

**Change:** **Calculate red flags for CSDM and dependencies** and **Update CSDM
and other dependencies** default inactive for new installations. Existing
installations keep their active/inactive state.

**Steps:**
1. Record both jobs' state, schedules, and business purpose.
2. Test the desired schedule and resulting metadata/flags in non-production.
3. Activate or retain inactivity deliberately, with an owner and monitoring.

**Done when:** Required jobs run at the intended times and outputs are validated.
**Confirm first:** Instance history and effective state; do not overwrite a
deliberately inactive job just to match another instance.
**Source:** [Operational Resilience](delta-zurich-brazil/brazil-zurich-operationalresilience-release-notes.md), Australia > Upgrade information.

</details>

<details>
<summary>Compliance, mining, and analytics: control objectives, sustainability campaigns, Process Mining, PA snapshots</summary>

### E55. Decide Whether to Enable Control Objective Workflow

**Release / applies if:** Policy and Compliance Management v22.0.1+; control objectives are used.

**Change:** The new workflow is disabled by default. Enabling it introduces
draft/review/approval behavior; major revisions can move associated controls to Draft.
State fields can appear even while the workflow is disabled.

**Steps:**
1. Inspect **Policy and Compliance > All > Properties > Enable Control Objective Workflow**.
2. Agree ownership, approval, and major/minor revision rules with compliance owners.
3. Test publication and changes to existing control objectives before enabling in production.

**Done when:** Owners approve lifecycle behavior and effects on associated controls.
**Confirm first:** Exact version and transition procedure; a new State field alone
does not prove the full workflow is active.
**Source:** [Policy and Compliance](delta-zurich-brazil/brazil-zurich-policyandcompliancemanagement-release-notes.md), Australia > New features.

### E56. Enable Sustainability Campaigns Only With an Approval Decision

**Release / applies if:** Documented Operational Sustainability / GRC Metrics updates;
the team wants campaign-based collection and approval.

**Change:** Campaigns need explicit properties: `sn_esg.metric_campaign`,
`sn_esg.campaign_bulk_action_enabled`, and the `sn_esg.metric_approval` mode.

**Steps:**
1. Choose campaign scope, data owners, and Simple versus Advanced approval.
2. Configure approved settings in non-production and test a full collection/approval cycle.
3. Validate bulk submission/rejection and permitted roles before production activation.

**Done when:** Campaign and bulk behavior match approved responsibilities.
**Confirm first:** Installed app version and existing role inheritance; some
documented access reductions apply only to new installations.
**Source:** [Sustainability / former ESG](delta-zurich-brazil/brazil-zurich-operationalsustainabilitymanagementformerlyenvironmentalsocialandgovernance-release-notes.md), Australia > Upgrade information / Changes.

### E57. Set Process Mining Metered-Usage Guardrails

**Release / applies if:** Brazil; Process Mining consumes metered entitlements.

**Change:** Table-level guardrails and mandatory filters can cap or flag usage
before mining. New properties include `promin.metered_usage.allow_unrestricted`
and `promin.metered_usage.warning_limit`.

**Steps:**
1. Inventory mined tables, record volumes, filters, and entitlement expectations.
2. Approve limits with license/process owners and configure supported guardrails.
3. Test permitted, capped, and warning cases in non-production.

**Done when:** Expected mining works and over-limit behavior prevents unapproved consumption.
**Confirm first:** Units, defaults, and entitlement rules; the combined note does
not provide safe numeric limits for your organization.
**Source:** [Process Mining](delta-zurich-brazil/brazil-zurich-processmining-release-notes.md), Brazil > New features.

### E58. Update Process Mining Role and API References

**Release / applies if:** Australia role renaming / Brazil API deprecations;
custom scripts, integrations, or permissions reference the old identifiers.

**Change:** Role names move from optimization to mining. Brazil deprecates
`promin.api.allow_no_role_mining` and `promin.api.auto_share_project_with_creator`.

**Steps:**
1. Find old role/API references and record intended project access/sharing.
2. Apply documented replacements and test owner/shared-user permissions.
3. Verify content-pack availability against the active application and required table.

**Done when:** Required projects, sharing, and content work without obsolete assumptions.
**Confirm first:** Per-identifier migration/support handling; deprecation is not
proof the API has already been removed from your version.
**Source:** [Process Mining](delta-zurich-brazil/brazil-zurich-processmining-release-notes.md), Australia / Brazil > Changes / Deprecations.

### E59. Check PA Data Snapshot Eligibility and Activation

**Release / applies if:** Australia Patch 3+; RaptorDB Professional and Performance Analytics are used.

**Change:** The plugin installs automatically on eligible instances. Domain-separated
instances receive it disabled; not every existing indicator is eligible for migration.

**Steps:**
1. Record database entitlement, domain-separation state, plugin state, and indicator eligibility.
2. Test approved indicators, collection schedules, breakdowns, and KPI Details.
3. Compare scores/history and validate activation before migrating additional indicators.

**Done when:** Selected indicators collect accurate data in a supported configuration.
**Confirm first:** Eligibility and historical-data behavior; automatic installation
is not evidence that every indicator or domain is enabled.
**Source:** [Performance Analytics](delta-zurich-brazil/brazil-zurich-performanceanalytics-release-notes.md), Australia > Changes / Requirements.

</details>

<details>
<summary>Vulnerabilities and assets: VR, AVR, CVR, Configuration Compliance, USEM, Wiz, HAM, SAM</summary>

### E60. Decide Whether the VR App Update Crosses Into USEM

**Release / applies if:** Zurich/Australia/Brazil upgrade guidance; VR, AVR, CVR,
or Configuration Compliance is installed without a planned USEM migration.

**Change:** The notes direct customers not migrating to USEM to stay below v30.x
for the affected applications and use compatible integration versions.

**Steps:**
1. Record installed/candidate app and integration versions before approving updates.
2. Check KB0856498 and decide explicitly whether USEM migration is in scope.
3. Select a supported version combination and test it; do not approve latest blindly.

**Done when:** The target versions match the approved architecture and compatibility matrix.
**Confirm first:** Current support/entitlements and the exact boundary for each app.
This is an application-version decision, not a claim that Brazil itself forces USEM.
**Sources:** [VR](delta-zurich-brazil/brazil-zurich-vulnerabilityresponse-release-notes.md),
[AVR](delta-zurich-brazil/brazil-zurich-applicationvulnerabilityresponse-release-notes.md),
[CVR](delta-zurich-brazil/brazil-zurich-containervulnerabilityresponse-release-notes.md),
[Configuration Compliance](delta-zurich-brazil/brazil-zurich-configurationcompliance-release-notes.md), Upgrade information.

### E61. Run USEM as a Separate Migration Project

**Release / applies if:** Migrating legacy vulnerability applications to USEM.

**Change:** USEM changes architecture, data/rules, and workflows; it is not just
a product rename or routine family update.

**Steps:**
1. Use KB2556844 and the Migration Assistant to assess plugins, data, rules, and integrations.
2. Rehearse mapping/migration and reconcile representative findings, tasks, approvals, and access.
3. Approve cutover only after compatibility, evidence, and recovery requirements are met.

**Done when:** Migration validation proves required business/security workflows work.
**Confirm first:** Current migration tooling and entitlements. Upgrade later defers
the assistant; it does not certify the old/new app version combination as supported.
**Sources:** [USEM migration](delta-zurich-brazil/brazil-zurich-unifiedsecurityexposuremanagement-release-notes.md), Upgrade information;
[USEM](delta-zurich-brazil/brazil-zurich-unifiedsecurityexposuremanagementusem-release-notes.md), Upgrade information / New features.

### E62. Backdate Wiz Primary Integrations Where the v1.1 Migration Requires It

**Release / applies if:** Documented Wiz integration v1.1 transition;
legacy backfill/Missing Assets data is present.

**Change:** `sn_vul_wiz_missing_asset` is deprecated. The notes require backdating
existing primary integrations by three days and running them after the specified update.

**Steps:**
1. Verify installed version, migration history, primary integrations, and data volumes.
2. Follow the version-specific backdating/run procedure in non-production.
3. Reconcile results, ignored-field mappings, and obsolete backfill dependencies.

**Done when:** Expected data is present without gaps or unintended duplicate findings.
**Confirm first:** Applicability to your installed Wiz/USEM path; do not repeat
historical backfills merely because this instruction appears in the combined notes.
**Sources:** [VR](delta-zurich-brazil/brazil-zurich-vulnerabilityresponse-release-notes.md), Zurich > Upgrade information / New features;
[Configuration Compliance](delta-zurich-brazil/brazil-zurich-configurationcompliance-release-notes.md), New features.

### E63. Review the Wiz Asset Integration's Default and Import Scope

**Release / applies if:** USEM v32.1 / non-USEM v4.1 Wiz guidance.

**Change:** Asset integration is deactivated by default and is no longer a
mandatory prerequisite. If activated without resource-type filters, it retrieves
all resource types. New-customer detection-key behavior also differs from existing customers.

**Steps:**
1. Record active state, configured resource types, and your detection-key scheme.
2. Choose the required asset scope before activating or changing the integration.
3. Test volumes, keys, and finding continuity in non-production.

**Done when:** Imports contain the intended resources without unexpected volume/identity changes.
**Confirm first:** Current configuration and customer/migration path; do not replace
existing finding keys solely to imitate a new-instance default.
**Sources:** [VR](delta-zurich-brazil/brazil-zurich-vulnerabilityresponse-release-notes.md), Australia > New features;
[CVR](delta-zurich-brazil/brazil-zurich-containervulnerabilityresponse-release-notes.md), New features.

### E64. Reconcile Container Findings After Integration Updates

**Release / applies if:** Documented CVR/Wiz updates; container images/findings are imported.

**Change:** Enriched fields require a full import. Path tracking moves to Container
Image Finding, and repository/relationship mappings change. Discovery-based relationship
imports need their populate job completed at least four hours before third-party runs.

**Steps:**
1. Review finding keys, Path consumers, source choice, and job schedules.
2. Apply the supported configuration/full-import procedure in non-production.
3. Reconcile images/findings/repositories and schedule dependencies before production.

**Done when:** Required attributes and relationships are accurate and duplicate/gap checks pass.
**Confirm first:** Version-specific full-import cost and scheduling; new-customer
lookback defaults are not proof existing instances received the same values.
**Sources:** [CVR](delta-zurich-brazil/brazil-zurich-containervulnerabilityresponse-release-notes.md), Upgrade information / New features / Deprecations;
[Cloud Exposure View](delta-zurich-brazil/brazil-zurich-cloudexposureview-release-notes.md), New features.

### E65. Update the Property for Rerunning Vulnerability Assignment Rules

**Release / applies if:** Australia VR; rerunning assignment rules is required.

**Change:** `sn_vul.rerun_task_rules` changes to `sn_sec_rem.rerun_task_rules`;
the new property must be true when you need this behavior.

**Steps:**
1. Record the old/new properties and custom references.
2. Configure the approved replacement in non-production.
3. Test rerunning rules on representative records and confirm resulting ownership.

**Done when:** The required reassignment behavior works through the supported property.
**Confirm first:** Desired scope and rule effects; do not enable bulk reassignment without review.
**Source:** [VR](delta-zurich-brazil/brazil-zurich-vulnerabilityresponse-release-notes.md), Australia > Changes.

### E66. Update Patch-Orchestration Consumers to Multi-Value Fields

**Release / applies if:** Australia VR; Microsoft SCCM or HCL BigFix Patch Orchestration is used.

**Change:** Old Patch update / Collection fields migrate to Patch updates /
Collections. Deprecated fields remain on forms but are no longer used for new deployments.

**Steps:**
1. Inventory scripts, mappings, and operator procedures using the old fields.
2. Verify automatic migration and update consumers in non-production.
3. Test multi-patch/multi-group deployment through an approved safe test process.

**Done when:** New deployments and integrations use the supported fields.
**Confirm first:** Connector prerequisites; JDBC data ingestion does not remove
the WMI requirement for actual SCCM patch deployment.
**Sources:** [VR](delta-zurich-brazil/brazil-zurich-vulnerabilityresponse-release-notes.md), Australia > Upgrade information / New features;
[USEM](delta-zurich-brazil/brazil-zurich-unifiedsecurityexposuremanagementusem-release-notes.md), Australia > New features.

### E67. Check the ITSM Advanced Dependency for USEM Change Actions

**Release / applies if:** Documented USEM update; Remediation view Create Change /
Add to existing change options are used.

**Change:** These options require ITSM Advanced. Moving to an AI Native SKU
without that capability can remove access.

**Steps:**
1. Confirm installed plugins, SKU entitlements, and required remediation actions.
2. Test the options with intended users in non-production.
3. Resolve entitlement/plugin gaps with the product owner before cutover.

**Done when:** Required change actions work in the licensed, supported configuration.
**Confirm first:** Entitlements with ServiceNow; do not install a paid capability solely on this guide's recommendation.
**Source:** [USEM](delta-zurich-brazil/brazil-zurich-unifiedsecurityexposuremanagementusem-release-notes.md), Australia > New features.

### E68. Verify Tenable Compliance Ingestion and Uniqueness

**Release / applies if:** Documented Configuration Compliance integration updates;
Tenable conformance tests/results are imported.

**Change:** Results ingestion splits into open/fixed integrations. Test uniqueness
can use `compliance_control_id`, `check_id`, or `compliance_functional_id` to
avoid overwriting distinct tests that share a control identifier.

**Steps:**
1. Identify integration versions, current keys, and any overwritten/duplicate test patterns.
2. Follow the supported replacement configuration and choose the correct identifier.
3. Reconcile open/fixed results and test identity with representative data.

**Done when:** Distinct tests/results persist accurately without unexpected overwrites.
**Confirm first:** The local note contains a version placeholder for part of this
change; obtain the actual applicable version before changing ingestion.
**Source:** [Configuration Compliance](delta-zurich-brazil/brazil-zurich-configurationcompliance-release-notes.md), Changes / New features.

### E69. Plan the Unified Microsoft Defender Integration

**Release / applies if:** Zurich/Australia security integration updates;
standalone Defender for Cloud / MS TVM integrations are used.

**Change:** A unified Security Exposure Management plugin replaces the separate
path and adds container-image ingestion. A guided data migration is documented.

**Steps:**
1. Inventory installed connectors, schedules, credentials, mappings, and existing findings.
2. Rehearse the supported migration and reconcile old/new records in non-production.
3. Validate new container ingestion, ownership, access, and duplicate prevention.

**Done when:** Required data flows through the supported connector without gaps.
**Confirm first:** Supported migration sequence and integration compatibility with your USEM/non-USEM choice.
**Sources:** [VR](delta-zurich-brazil/brazil-zurich-vulnerabilityresponse-release-notes.md), New features;
[USEM](delta-zurich-brazil/brazil-zurich-unifiedsecurityexposuremanagementusem-release-notes.md), New features.

### E70. Check Whether Customized Asset Workflows Were Replaced

**Release / applies if:** Zurich baseline; HAM/SAM/Procurement/Contract legacy workflows are used.

**Change:** Untouched workflows receive flow replacements. Customized workflows
can remain instead of executing the replacements and are treated as unsupported custom code.

**Steps:**
1. Inventory customized reclamation, procurement, transfer, sourcing, allocation,
   and contract approval workflows and determine which replacements actually execute.
2. Compare custom behavior with the supported flows and plan the migration.
3. Test approvals, errors, state transitions, and integrations before cutover.

**Done when:** Every required process has an owned, supported implementation or an explicitly managed custom-code risk.
**Confirm first:** Product-specific migration behavior; HAM and SAM package replacement differently.
Reject obsolete contract approval-history records as documented rather than deleting them and expecting correct substate updates.
**Sources:** [HAM](delta-zurich-brazil/brazil-zurich-hardwareassetmanagement-release-notes.md), Zurich > Upgrade information;
[SAM](delta-zurich-brazil/brazil-zurich-softwareassetmanagement-release-notes.md), Zurich > Upgrade information.

### E71. Verify Access to Legacy HAM Audit Records

**Release / applies if:** HAM v15.0.0+; common Asset Audits enhancements are enabled.

**Change:** New audits use `sn_itam_common_asset_audit`; old audits are no longer
visible in the same inventory tab after the switch. Documented access depends on
the alternate view and `migrate_hamaudit` setting.

**Steps:**
1. Record which audit model is enabled and identify old/new records needed for evidence.
2. Test the documented views and property behavior in non-production.
3. Update links/reports and verify authorized access to historical as well as current audits.

**Done when:** Audit owners can retrieve required old and new evidence.
**Confirm first:** The installed migration state and supported property use; hidden
records are not necessarily deleted records.
**Source:** [HAM](delta-zurich-brazil/brazil-zurich-hardwareassetmanagement-release-notes.md), Australia > Changes.

### E72. Verify the SAM Workspace Store Migration and Dependencies

**Release / applies if:** Zurich baseline SAM; Software Asset Workspace is used.

**Change:** Family plugin `com.sn_sam_workspace` is inactivated and Store app
`sn_sam_workspace` enabled. SaaS License Management v16.0.6+ has a documented
workspace version dependency. Spend Detection moves out of Core UI.

**Steps:**
1. Record installed family/Store components, workspace version, and SaaS integrations.
2. Check the supported version combination and test the workspace migration.
3. Verify spend imports, existing transactions, licensing operations, and navigation.

**Done when:** Required operations work in a compatible Store workspace.
**Confirm first:** The note's v9.0.4 workspace instruction is tied to a specific
Zurich combination, not a universal latest target.
**Source:** [SAM](delta-zurich-brazil/brazil-zurich-softwareassetmanagement-release-notes.md), Upgrade information / Changes.

### E73. Review the SAM Plugin Choice Before Losing Core UI Access

**Release / applies if:** Brazil; considering `com.sn_samp_master_ws` activation.

**Change:** Activating the master-with-workspace plugin removes access to SAM Core UI.

**Steps:**
1. Inventory users and processes still depending on Core UI.
2. Test the required workspace equivalents before activation approval.
3. Agree the transition, communications, and supported recovery approach.

**Done when:** Required processes have a validated workspace route and owners approve activation.
**Confirm first:** Plugin dependencies and reversibility; do not assume deactivation restores Core UI.
**Source:** [SAM](delta-zurich-brazil/brazil-zurich-softwareassetmanagement-release-notes.md), Brazil > Activation information.

</details>

<details>
<summary>Sales and procurement: Sales Cart, CSM data, Retail, CPQ/Pricing, APO, approvals, customer success, suppliers</summary>

### E74. Complete Sales Cart Migration Before Customers Lose Cart Content

**Release / applies if:** Zurich baseline Sales CRM self-service; existing order/cart data needs migration.

**Change:** The new Sales Cart plugin requires post-upgrade order migration.
Skipping the documented steps can lose products already in customers' carts.

**Steps:**
1. Inventory affected carts/orders and determine whether the migration already ran.
2. Follow the linked Post-upgrade order migration procedure in non-production.
3. Reconcile cart items and test checkout, billing/payment dependencies, and customer access.

**Done when:** Required existing carts and ordering journeys are preserved.
**Confirm first:** Exact migration sequence, preservation, and recovery guidance;
do not treat a fresh empty-cart test as proof that historical data migrated.
**Source:** [Sales CRM self-service](delta-zurich-brazil/brazil-zurich-customerselfserviceforsalescustomerrelationshipmanagement-release-notes.md), Zurich > Upgrade information.

### E75. Run the CSM Role Job Before Configuring Restricted Customer Access

**Release / applies if:** Brazil Data Management for CSM; Restricted Customer Access is used.

**Change:** Upgrade customers must run **Remove Legacy roles from Loc Mgr Contrib**
to enable the restricted-access configuration.

**Steps:**
1. Review current business-organization staff roles and expected customer visibility.
2. Verify applicability and execute the one-time job in non-production as documented.
3. Configure/test criteria with users inside and outside the permitted organization.

**Done when:** Intended customer/consumer visibility is enforced for existing and new records.
**Confirm first:** Prior execution, custom role impact, and supported job procedure.
**Source:** [CSM data](delta-zurich-brazil/brazil-zurich-datamanagementforcsm-release-notes.md), Brazil > New features.

### E76. Remove Dependencies on Deprecated CSM Responsibility Fields

**Release / applies if:** Australia Data Management for CSM; declarative responsibility customizations exist.

**Change:** Legacy Applicable to and Restrict access to fields are deprecated.
Escalation workflows also have a documented low-code replacement path.

**Steps:**
1. Find scripts, access configuration, and reports using the deprecated fields.
2. Map them to supported responsibility configuration and test effective record access.
3. Review escalation-template customizations before choosing the replacement flow path.

**Done when:** Required responsibility/access behavior does not depend on unsupported assumptions.
**Confirm first:** Replacement fields and migration steps; the combined note does
not provide a complete field-by-field implementation recipe.
**Source:** [CSM data](delta-zurich-brazil/brazil-zurich-datamanagementforcsm-release-notes.md), Changes / Deprecations.

### E77. Point FSO Case-Type Criteria at the CSM Tables

**Release / applies if:** Australia FSO Core; custom code uses legacy service-definition criteria tables.

**Change:** Existing criteria migrate automatically to
`sn_csm_case_types_service_user_criteria` and
`sn_csm_case_types_service_customer_criteria`. Old FSO tables remain referenceable
on upgraded instances but are not maintained. Show in Interceptor is deprecated.

**Steps:**
1. Inventory legacy table/field consumers and record current case-type visibility.
2. Reconcile migrated criteria and update consumers in non-production.
3. Test agent/customer visibility, including intended hidden service definitions.

**Done when:** Supported criteria control the correct case-type choices.
**Confirm first:** The supported No User / user-criteria mapping and custom migration impact.
**Source:** [FSO Core](delta-zurich-brazil/brazil-zurich-financialservicesoperationscore-release-notes.md), Australia > Changes / Deprecations.

### E78. Stop Creating or Updating the Abstract Retail Base Case

**Release / applies if:** Zurich guidance and affected updates beginning in Yokohama;
implementations use the retail base case table directly.

**Change:** The base case is abstract; creation/update must use specialized case types.

**Steps:**
1. Find direct table use in integrations, forms, scripts, and record producers.
2. Follow KB2216547 to select supported case types or an approved extension.
3. Migrate/test create and update journeys, ownership, access, and existing records.

**Done when:** Required case operations no longer depend on direct abstract-table use.
**Confirm first:** Existing-record migration and supported case mapping; do not
change record classes blindly.
**Source:** [Retail Applications](delta-zurich-brazil/brazil-zurich-retailapplications-release-notes.md), Zurich > Upgrade information.

### E79. Use Template Item Instead of Origin for New Retail Plan Cases

**Release / applies if:** Brazil Retail; custom behavior identifies cases through Origin.

**Change:** New store-plan/audit-plan cases populate Template item instead of Origin.

**Steps:**
1. Inventory consumers of Origin and the historical data they need.
2. Update logic for new cases while preserving appropriate handling for old ones.
3. Test plan/audit case generation, reporting, and linked template navigation.

**Done when:** Both historical and newly created cases are interpreted correctly.
**Confirm first:** Historical backfill behavior is not promised in this note.
**Source:** [Retail](delta-zurich-brazil/brazil-zurich-retail-release-notes.md), Brazil > Changes.

### E80. Explicitly Enable the Advanced CPQ Configurator When Adopting It

**Release / applies if:** Zurich baseline; moving from legacy configuration to CPQ Configurator.

**Change:** Upgraded customers must set `sn_prd_pm.enable_advanced_configuration=true`
for the documented Sales CRM workflow integration.

**Steps:**
1. Verify prerequisites, current configurator, and affected product workflows.
2. If adopting, enable/test the supported configuration in non-production.
3. Validate configuration, pricing, quote/order generation, and user permissions.

**Done when:** The approved configurator works end-to-end for representative products.
**Confirm first:** Entitlements, transition, and recovery; this is not a mandatory
instruction to replace every existing configurator during a family upgrade.
**Source:** [CPQ Configurator](delta-zurich-brazil/brazil-zurich-cpqconfigurator-release-notes.md), Zurich > Upgrade information.

### E81. Review the New Default Pricing Plan Before Publishing It

**Release / applies if:** Documented Pricing Management updates, including v15/v16;
a custom pricing plan is already in use.

**Change:** The new default can remain Retired after update. Custom plans must
include required Net Price Calculation, Line Rollup, and Header Rollup behavior
to retain the described previous quote/order functionality.

**Steps:**
1. Compare active custom and retired default plans and their calculation steps.
2. Decide whether to retain/adapt custom pricing or publish the new default.
3. Test representative quotes/orders, derived products, discounts, ramps, and rollups.

**Done when:** Approved pricing scenarios produce correct values with the selected plan.
**Confirm first:** App-version-specific step order and dependencies before publication.
**Sources:** [Product Catalog and Pricing](delta-zurich-brazil/brazil-zurich-productcatalogmanagementandpricingmanagement-release-notes.md), Upgrade information;
[Pricing Management](delta-zurich-brazil/brazil-zurich-pricingmanagement-release-notes.md), Brazil > Upgrade information.

### E82. Remove Pricing Parallel-Execution Property Assumptions

**Release / applies if:** Australia/Brazil pricing updates; parallel execution was customized.

**Change:** `sn_csm_pricing.enable_pricing_engine_parallel_execution` and
`sn_csm_pricing.pricing_engine_parallelism_lines_threshold` are removed.
Pricing now runs sequentially; no replacement properties are supplied.

**Steps:**
1. Find property consumers and record expected pricing performance/correctness.
2. Remove reliance on the unsupported controls in non-production.
3. Test pricing accuracy, derived-line additions/removals, edit restrictions, and realistic volume.

**Done when:** Correct pricing meets agreed performance without the removed settings.
**Confirm first:** Escalate unsupported performance needs rather than inventing replacement properties.
**Sources:** [Pricing Management](delta-zurich-brazil/brazil-zurich-pricingmanagement-release-notes.md), Brazil > Deprecations;
[Product Catalog and Pricing](delta-zurich-brazil/brazil-zurich-productcatalogmanagementandpricingmanagement-release-notes.md), Australia > Deprecations.

### E83. Republish Product Catalog AI Search After the Relevant App Update

**Release / applies if:** Product Catalog Management Core v19.0.0+;
AI Search was already used for product catalog.

**Change:** Stop words, search profiles, and index tables need republishing for
the documented multilingual changes.

**Steps:**
1. Record current app/search configuration and expected languages/results.
2. Run **Scheduled job to publish stop words dictionary, search profiles and index tables**
	through the supported non-production update procedure.
3. Test indexing, multilingual search, permissions, and catalog availability.

**Done when:** Intended product searches work with the republished configuration.
**Confirm first:** Prerequisites and prior execution. For first-time adoption,
the separate setup includes `enable_ai_search_in_catalog` and required AI plugins.
**Source:** [Product Catalog and Pricing](delta-zurich-brazil/brazil-zurich-productcatalogmanagementandpricingmanagement-release-notes.md), Upgrade information.

### E84. Activate APO Case Exclusions Through the Updated Flow

**Release / applies if:** Brazil Accounts Payable Operations; upgrade users want case exclusions.

**Change:** The out-of-box **Create Inquiry Case on Invoice email** flow must be
copied, customized as needed, and activated for this configuration.

**Steps:**
1. Review the existing email-case flow and required exclusion conditions.
2. Copy/configure the documented flow in non-production and plan active-flow ownership.
3. Test included/excluded emails and ensure duplicate case-creation paths are avoided.

**Done when:** Emails create or exclude cases exactly as approved.
**Confirm first:** Supported cutover/activation procedure and custom flow differences.
**Source:** [APO](delta-zurich-brazil/brazil-zurich-accountspayableoperations-release-notes.md), Brazil > Upgrade information.

### E85. Retest Multi-Intent APO Email Routing

**Release / applies if:** Brazil APO; the Email parser agent handles multi-intent messages.

**Change:** The Universal Request path is removed; messages use standard AP intent handling.

**Steps:**
1. Identify workflows/reporting that expect a Universal Request from these emails.
2. Test representative single/multiple AP and unsupported intents in non-production.
3. Update approved routing dependencies, notifications, and operator procedures.

**Done when:** Intended cases/tasks are routed correctly without obsolete UR assumptions.
**Confirm first:** Scope this to the APO agent; other SPO/SLO products may still use UR.
**Source:** [APO](delta-zurich-brazil/brazil-zurich-accountspayableoperations-release-notes.md), Brazil > Changes.

### E86. Retest Supplier Tax After Rollup Removal

**Release / applies if:** Australia APO; supplier-declared tax participates in invoice checks.

**Change:** Rollup applies to system tax, not supplier-declared tax; supplier tax rollup is removed.

**Steps:**
1. Identify tax integrations, invoice validations, and custom rollup assumptions.
2. Test line/header tax and multiple invoices against purchase orders in non-production.
3. Approve accounting outcomes and update exception-handling procedures.

**Done when:** Tax calculations/validations match finance requirements.
**Confirm first:** Regional rules and configured tax-engine behavior; do not infer them from the feature name.
**Source:** [APO](delta-zurich-brazil/brazil-zurich-accountspayableoperations-release-notes.md), Changes / Deprecations.

### E87. Review Advanced Approval Chain Order and Requester Permissions

**Release / applies if:** Australia Advanced Approval Management; approval chains are configured.

**Change:** Default Rule order becomes 10. The requester-only
`approval_request_submitter` role does not provide full workflow access or recall/update powers.

**Steps:**
1. Compare configured chain orders with the intended execution order.
2. Assign the appropriate requester/approver roles in non-production.
3. Test submission, sequencing, approval/rejection, and denied recall/update actions.

**Done when:** Approval routing and requester permissions match the business process.
**Confirm first:** Review differing orders rather than overwriting all values with 10.
**Source:** [Advanced Approval Management](delta-zurich-brazil/brazil-zurich-advancedapprovalmanagement-release-notes.md), Australia > Upgrade information.

### E88. Run the Customer Success Health Migration When Required

**Release / applies if:** Upgrading Customer Success Management v5.3.10 or earlier
to the documented v5.3.11 health-score capability.

**Change:** **Set health migration status** must run to enable the calculated data source.

**Steps:**
1. Check starting/target versions, prior migration, and existing health models.
2. Run the documented script in non-production if applicable.
3. Validate scores and source data against expected engagements.

**Done when:** Required calculations use the intended source and produce approved results.
**Confirm first:** Applicability and script instructions; later family upgrades
do not automatically mean this old version boundary is still pending.
**Source:** [Customer Success Management](delta-zurich-brazil/brazil-zurich-customersuccessmanagement-release-notes.md), Zurich > New features.

### E89. Schedule the Sourcing Migration Job After Upgrade

**Release / applies if:** Zurich/Australia Source-to-Pay Operations Integrations guidance.

**Change:** The sourcing fix script no longer runs automatically during upgrade;
it is supplied as an on-demand job because of a performance issue.

**Steps:**
1. Confirm required migration, exact job, prerequisites, and previous execution.
2. Rehearse outside business hours in non-production and validate migrated data/processes.
3. Schedule the approved post-upgrade production execution outside business hours with monitoring.

**Done when:** Required migration completes and reconciliation evidence is approved.
**Confirm first:** The combined note does not name the job; obtain vendor
instructions before execution and record the actual job reference.
**Source:** [Source-to-Pay Integrations](delta-zurich-brazil/brazil-zurich-sourcetopayoperationsintegrations-release-notes.md), Upgrade information.

### E90. Install the Supplier Operations Dependency After Upgrade

**Release / applies if:** Zurich/Australia Supplier Lifecycle Operations upgrade.

**Change:** `com.snc.sn_so` must be installed after the documented upgrade.
The older supplier-management plugin is renamed Supplier Case Management;
renaming alone is not completion of dependency setup.

**Steps:**
1. Record installed supplier plugins and app versions.
2. Follow Install Supplier Operations in non-production after the applicable upgrade.
3. Test supplier onboarding/cases and required integration/approval workflows.

**Done when:** Required dependency and supplier processes work in a supported combination.
**Confirm first:** Entitlements, installation prerequisites, and exact target versions.
**Source:** [Supplier Lifecycle Operations](delta-zurich-brazil/brazil-zurich-supplierlifecycleoperations-release-notes.md), Activation information / Highlights.

</details>

<details>
<summary>Planning and operations: PPM, Strategic Planning, FSM, Event Management, On-Call/Notify, testing, ReleaseOps</summary>

### E91. Replace Unsupported PPM Planning Tools

**Release / applies if:** Australia Project Workbench / Brazil Planning console;
users still depend on those tools.

**Change:** They are no longer supported. Project Workspace is the documented
planning route. Other older PPM portals/dashboards have different planned-deprecation status.

**Steps:**
1. Inventory actual planning entry points, customizations, and project-owner requirements.
2. Test supported Project Workspace/Next Experience alternatives.
3. Migrate procedures and links; track separately any supported legacy features with future plans.

**Done when:** Required planning has a supported tested workflow.
**Confirm first:** Exact capability support; do not classify every old PPM dashboard as already removed.
**Source:** [PPM](delta-zurich-brazil/brazil-zurich-projectportfoliomanagement-release-notes.md), Australia / Brazil > Deprecations.

### E92. Update Planning Filters to the Migrated Investment Fields

**Release / applies if:** Strategic Planning v4.8.0+; views/filters use Investment type or class.

**Change:** Values move to fields on parent Planning item. Old Project/Demand
fields are deprecated; automatic value copying does not update every personalization.

**Steps:**
1. Inventory saved filters, roadmap/prioritization/scenario views, and integrations.
2. Reconcile migrated values and update consumers to the current fields.
3. Test selections, reporting, financial baselines, and permissions in non-production.

**Done when:** Required views use the intended fields and show accurate data.
**Confirm first:** Field identities and migration completion; separately validate
investment-currency baseline changes if you use multicurrency.
**Source:** [Strategic Planning](delta-zurich-brazil/brazil-zurich-strategicplanning-release-notes.md), Upgrade information / Changes.

### E93. Decide Whether Opening a Demand Should Generate an AI Summary

**Release / applies if:** Australia demand-summarization updates; the skill is used.

**Change:** Summary moves to AI Overview and auto-generates on landing by default
for the documented states. Manual triggering can be configured instead.

**Steps:**
1. Inspect activation, trigger mode, eligible demand states, provider, and expected consumption.
2. Agree automatic versus manual behavior with demand owners.
3. Test tab entry, summary quality, permissions, and consumption in non-production.

**Done when:** The skill triggers only as approved and required summaries work.
**Confirm first:** Installed app/skill configuration; an AI Overview tab is not proof
that every demand on your instance will auto-generate content.
**Sources:** [Portfolio Planning](delta-zurich-brazil/brazil-zurich-portfolioplanning-release-notes.md), Australia > Changes;
[Strategic Planning](delta-zurich-brazil/brazil-zurich-strategicplanning-release-notes.md), Australia > Changes.

### E94. Enable the Google APIs Required by FSM Maps

**Release / applies if:** Zurich / Dispatcher Workspace v8.0 guidance; Google mapping is used.

**Change:** Legacy Google Places, Directions, and Distance Matrix services are
replaced by Places API (New) and Routes API in the documented integration.

**Steps:**
1. Identify Google Cloud projects, keys, restrictions, and integration versions.
2. Enable the required new APIs using the supported setup, checking billing/access policy.
3. Test address lookup, travel/route calculations, and dispatcher workflows.

**Done when:** Required mapping works with the supported APIs and restricted credentials.
**Confirm first:** Exact Google/ServiceNow prerequisites and current vendor lifecycle.
**Source:** [FSM](delta-zurich-brazil/brazil-zurich-fieldservicemanagement-release-notes.md), Zurich > Upgrade information.

### E95. Replace Schedule Optimization Queue Properties With Registries

**Release / applies if:** Brazil Schedule Optimization v2.0; custom queue tuning is used.

**Change:** Custom queue-count, claim-limit, and event-distribution properties
are unsupported and replaced by Queue Registries.

**Steps:**
1. Inventory `sn_schedule_optim.data_processor_number_of_queues`,
	`sn_schedule_optim.solution_processor_number_of_queues`, and queue-specific tuning.
2. Map the supported behavior to Queue Registries in non-production.
3. Test optimization correctness, throughput, backlog, and failures at representative volume.

**Done when:** Optimization operates within agreed limits without obsolete controls.
**Confirm first:** Registry configuration and supported tuning guidance for your version.
**Source:** [FSM](delta-zurich-brazil/brazil-zurich-fieldservicemanagement-release-notes.md), Brazil > Deprecations.

### E96. Update the Control for Live Alert Refresh

**Release / applies if:** Zurich Event Management; live alert updates use legacy configuration.

**Change:** `em_alert_lists_auto_refresh` no longer controls SOW list refresh;
the documented replacement uses `sys_ux_list` configuration.

**Steps:**
1. Inventory current live-list behavior and old control consumers.
2. Follow the supported new list configuration in non-production.
3. Test incoming updates, pause/resume, filters, and operator expectations.

**Done when:** Alerts refresh according to approved operational behavior.
**Confirm first:** Exact `sys_ux_list` configuration; do not create an arbitrary
system property named after a table just because the combined wording is terse.
**Source:** [Event Management](delta-zurich-brazil/brazil-zurich-eventmanagement-release-notes.md), Zurich > Deprecations.

### E97. Move vRealize Connector Dependencies to the JSON API

**Release / applies if:** Zurich Event Management; vRealize event connector/customizations are used.

**Change:** The connector replaces its deprecated XML API with JSON-based access.

**Steps:**
1. Inventory connector version, endpoint compatibility, and custom XML parsing/mappings.
2. Configure/test the supported JSON-based integration in non-production.
3. Reconcile event fields, deduplication, authentication, and failures.

**Done when:** Required event ingestion works without the deprecated API dependency.
**Confirm first:** Vendor endpoint versions and custom connector migration steps.
**Source:** [Event Management](delta-zurich-brazil/brazil-zurich-eventmanagement-release-notes.md), Zurich > Deprecations.

### E98. Validate Existing Alert Clustering in Alert Automation

**Release / applies if:** Australia Event Management; Alert Clustering Definitions (ACD) are used.

**Change:** Alert Automation replaces ACD. Existing configurations are described
as supported with feature parity; this is not a statement that all definitions disappear.

**Steps:**
1. Inventory definitions, outcomes, and custom automation dependencies.
2. Validate the equivalent Alert Automation behavior after non-production update.
3. Update navigation/procedures and resolve any parity gap before production.

**Done when:** Required clustering/automation outcomes are preserved.
**Confirm first:** Actual migration state and supported handling of custom definitions.
**Source:** [Event Management](delta-zurich-brazil/brazil-zurich-eventmanagement-release-notes.md), Australia > Deprecations.

### E99. Replace the Unsupported Service Management Dashboard

**Release / applies if:** Australia Event Management; the named legacy dashboard is used.

**Change:** Service Management Dashboard is unsupported and unavailable for new activation.

**Steps:**
1. Record the metrics, filters, audiences, and operational decisions it supports.
2. Select/test a supported dashboard alternative with the operations owner.
3. Update links, procedures, and monitoring handovers.

**Done when:** Required operational visibility exists in a supported experience.
**Confirm first:** Replacement/entitlement guidance; continued rendering does not prove support.
**Source:** [Event Management](delta-zurich-brazil/brazil-zurich-eventmanagement-release-notes.md), Australia > Deprecations.

### E100. Plan On-Call and Notify Subflow Migration Without Breaking Existing Calls

**Release / applies if:** Zurich baseline; legacy On-Call Scheduling or Notify workflows are used.

**Change:** New installations use subflows. Existing workflows remain supported
in the documented product guidance, unlike some customized asset workflows in E70.

**Steps:**
1. Inventory workflows, escalation rules, voice/SMS providers, and custom activities.
2. Map required behavior to supported subflows and test it in non-production.
3. Validate escalation acknowledgments, calls, SMS, time-off/rota behavior, and custom channels before cutover.

**Done when:** The migration decision and tested delivery paths are recorded.
**Confirm first:** Version-specific legacy support and workflow-artifact plugin
availability; do not delete functioning legacy flows solely because new installs differ.
**Sources:** [On-Call](delta-zurich-brazil/brazil-zurich-oncallscheduling-release-notes.md), Upgrade information;
[Notify](delta-zurich-brazil/brazil-zurich-notify-release-notes.md), Upgrade information.

### E101. Check the Existing On-Call Escalation Logging Value

**Release / applies if:** Brazil; On-Call escalation logs are required.

**Change:** `com.snc.on_call_rotation.log_escalations` defaults true, but its
existing value remains unchanged on upgrade.

**Steps:**
1. Record the current effective value and retention/access requirements.
2. Decide explicitly whether logging should be enabled.
3. Test an escalation and verify the resulting logs and permissions.

**Done when:** The observed logging behavior matches the approved policy.
**Confirm first:** A new-instance default does not establish your upgraded instance's state.
**Source:** [On-Call](delta-zurich-brazil/brazil-zurich-oncallscheduling-release-notes.md), Brazil > Changes.

### E102. Adapt ATF Quick Starts to Your Instance

**Release / applies if:** Zurich ATF guidance; quick starts are used as upgrade evidence.

**Change:** Base quick starts assume uncustomized functionality and supplied demo
data. They must be copied/adapted for instance-specific data and behavior.

**Steps:**
1. Select the workflows and failure risks that need upgrade regression coverage.
2. Copy/configure suitable quick starts for your custom data and permissions.
3. Run them in non-production and review failures, coverage, and manual-test gaps.

**Done when:** Passing tests validate your actual business journeys, not just demo behavior.
**Confirm first:** Test data/setup and supported execution environment; never infer
production safety solely from an untouched demo-data pass.
**Source:** [ATF](delta-zurich-brazil/brazil-zurich-automatedtestframework-release-notes.md), Zurich > Upgrade information.

### E103. Set the Intended Instance Scan Scope

**Release / applies if:** Australia Instance Scan; inactive/base-system checks need execution.

**Change:** Explicit properties are needed for those scopes:
`glide.scan.inactive_records` and `glide.scan.base_system_records`.
The `scan_check_writer` role controls authoring checks.

**Steps:**
1. Identify required checks/scope and record existing properties and author permissions.
2. Configure the approved scope in non-production and run representative scans.
3. Verify expected check execution, runtime, and ownership of findings.

**Done when:** Evidence shows the intended checks ran under approved access.
**Confirm first:** Property availability and scope semantics on your version;
do not enable every check merely to increase the count.
**Source:** [Instance Scan](delta-zurich-brazil/brazil-zurich-instancescan-release-notes.md), Australia > New features / Changes.

### E104. Reapply Missing ReleaseOps Runbook Activity in Customized Playbooks

**Release / applies if:** Australia ReleaseOps; sample playbooks were customized.

**Change:** Runbook task playbook activity does not populate automatically for
those customized playbooks during upgrade.

**Steps:**
1. Identify customized playbooks and required runbook tasks.
2. Compare with the new supported samples and apply approved changes in non-production.
3. Execute a representative pipeline/release and verify tasks, approvals, and ATF coverage.

**Done when:** Required release work is present and executes in the intended order.
**Confirm first:** ReleaseOps is not supported on-premise or in regulated environments
under the documented requirements; check eligibility before choosing it as a migration target.
**Source:** [ReleaseOps](delta-zurich-brazil/brazil-zurich-releaseops-release-notes.md), Australia > Upgrade information / Requirements.

### E105. Update the Store Workflow Studio App After the Family Upgrade

**Release / applies if:** Zurich/Australia Playbook guidance; Workflow Studio playbooks are used.

**Change:** The notes explicitly require a Store application update after upgrading the family.

**Steps:**
1. Record family, installed Workflow Studio version, and required playbook features.
2. Select a supported Store version and test the update in non-production.
3. Validate author/runtime roles, triggers, nested/agentic activities, and execution.

**Done when:** The supported app version and required playbook workflows are validated.
**Confirm first:** Current compatibility and regional LLM availability; a family
upgrade alone is not proof that the newest Store app is installed.
**Sources:** [Playbook](delta-zurich-brazil/brazil-zurich-playbook-release-notes.md), Australia > Upgrade information;
[Playbooks in Workflow Studio](delta-zurich-brazil/brazil-zurich-playbooksinworkflowstudio-release-notes.md), Zurich > Upgrade information.

### E106. Verify CSM Family-to-Store Packaging Changes

**Release / applies if:** Zurich Case Types / Australia Household, portal, and framework migration guidance;
the corresponding CSM plugins are installed.

**Change:** Enhancements move to Store applications. Family-plugin visibility,
names, and versions are not sufficient evidence of the resulting installed app.

**Steps:**
1. Inventory Customer Service Case Types, Household, Customer Service Portal Base,
	Subscriptions and Activity Feed Framework, and Walk-up for CSM where used.
2. Confirm resulting Store apps and supported versions after non-production upgrade.
3. Test dependent case selection, household/portal, subscriptions, and walk-up journeys.

**Done when:** Required functionality is backed by the expected supported Store apps.
**Confirm first:** Migration/dependency behavior per plugin; do not install every
listed application where it was never part of your implementation.
**Sources:** [CSM cases](delta-zurich-brazil/brazil-zurich-casemanagementforcsm-release-notes.md), Zurich > Deprecations;
[CSM data](delta-zurich-brazil/brazil-zurich-datamanagementforcsm-release-notes.md), Australia > Changes;
[CSM omnichannel](delta-zurich-brazil/brazil-zurich-selfserviceandomnichannelengagementforcsm-release-notes.md), Australia > Changes.

</details>

## Completion and Source Limits

### Before You Mark a Finding Done

- [ ] Record the actual platform/app versions and why the finding applies.
- [ ] Record the original setting/data state and the approved decision.
- [ ] Complete the finding's tests in non-production, including denied-access tests where relevant.
- [ ] Resolve Confirm first / Needs confirmation items before implementing a change.
- [ ] Obtain an owner, production change approval, and a tested recovery or preservation plan.
- [ ] Validate production results and attach evidence without credentials or sensitive instance data.

A decision to leave a feature off can be a valid outcome. Document the reason and
any remaining risk; do not mark it enabled. For irreversible changes, an old
property value is not a recovery plan.

### How to Handle Legacy Features

**Removed or unsupported:** If used, identify and test a supported replacement.
Examples include Data Separation, UI11/UI15, direct GAIC actions, legacy IDR sets,
and the documented PPM tools. Service Creator becomes unsupported in Brazil;
its earlier Zurich planned-deprecation wording is not the final status.

**Planned deprecation with support retained:** Assign a migration owner and review
date rather than declaring immediate breakage. This applies to many Classic
Workflow, Legacy Studio, Guided Setup, Document Intelligence, Cloud Discovery,
HR background integration, CMDB Baseline, OT/Claroty, NLU/channel, and older PPM
notices. Always check the exact product/version statement; support can change
between the rows in a combined note.

### What This Guide Does Not Prove

These are bundled release notes, not a live patch feed or an inspection of your
instance. **Source** identifies the vendor statement; numbered **Steps** are
recommended review and test work, not a claim that every click was verified on
your instance. Support KBs have not been independently verified in this review.

Keep these cases as Needs confirmation:

- Missing property values, administration roles, job names, grace deadlines, or
	migration/recovery procedures. Obtain the current linked documentation first.
- Placeholder source sections: UI Builder's Australia upgrade text, empty Brazil
	Case and Knowledge Management entries, and the Otto for SAM TBD upgrade entry.
- Conflicting or overlapping lifecycle/timing notices, including AI Gateway,
	older Now LLM models, and some Incident assist statements.
- A renamed product or separate thin source page. Similar names do not prove
	equivalent entitlements, automatic migration, or identical behavior.

Zurich findings may already be completed baseline work or may apply only from a
later Zurich patch. Establish your history before repeating a fix script or
reclassifying old work as a new Brazil requirement.

## Appendix: All 373 Files

The original screening covered all 12 sections in each of the 373 product files,
including Changes, New features, Activation information, and requirements.
Duplicate/renamed files remain separate. This proves file coverage, not that every
product is installed or that every upgrade is safe.

**Now (20):** Check these platform-wide source areas first.
**Conditional (216):** Review if the product/integration/customization is used.
**Watch (22):** Confirm lifecycle and own a migration plan where relevant.
**Feature (115):** Lower priority for this upgrade-action screen, not a safety certification.

The appendix is a source inventory, not another 373 tasks. Use the action guides
above for the detailed findings; use the original note when an appendix-only
feature matters to your implementation.

<details>
<summary>Show the complete 373-file source inventory</summary>

| # | Source area | Screen | Reason to check |
| --- | --- | --- | --- |
| 1 | [Access Management](delta-zurich-brazil/brazil-zurich-accessmanagement-release-notes.md) | Now | Strict-deny opt-in; inactive custom query ACLs; scripting governance. |
| 2 | [Accounts Payable Operations](delta-zurich-brazil/brazil-zurich-accountspayableoperations-release-notes.md) | Conditional | Manual case-exclusion flow; tax/routing changes; AI provider review. |
| 3 | [Activity Management](delta-zurich-brazil/brazil-zurich-activitymanagement-release-notes.md) | Conditional | Responsibility-scoped access and add-in write permissions; read-only entity fields. |
| 4 | [Adoption Services](delta-zurich-brazil/brazil-zurich-adoptionservices-release-notes.md) | Conditional | Dynamic Guidance grants genai_admin through role inheritance; Guided Setup lifecycle. |
| 5 | [Advanced AI Search Management Tools](delta-zurich-brazil/brazil-zurich-advancedaisearchmanagementtools-release-notes.md) | Watch | Removed dashboard visualizations; Usage Insights API prerequisite. |
| 6 | [Advanced Approval Management](delta-zurich-brazil/brazil-zurich-advancedapprovalmanagement-release-notes.md) | Conditional | Chain order default and requester-only role; approval permissions. |
| 7 | [Advanced Approval Management AI](delta-zurich-brazil/brazil-zurich-advancedapprovalmanagementai-release-notes.md) | Feature | MCP requester/approver capabilities; assess before adoption. |
| 8 | [Advanced Risk](delta-zurich-brazil/brazil-zurich-advancedrisk-release-notes.md) | Conditional | AI auto-activation; risk scoring, template, and assessment behavior. |
| 9 | [Advanced Work Assignment](delta-zurich-brazil/brazil-zurich-advancedworkassignmentawa-release-notes.md) | Feature | Assignment/interaction enhancements; no specific retrofit/removal identified. |
| 10 | [Agent Chat](delta-zurich-brazil/brazil-zurich-agentchat-release-notes.md) | Feature | Third-party chat and inbox changes; test if customized. |
| 11 | [Agent Client Collector](delta-zurich-brazil/brazil-zurich-agentclientcollector-release-notes.md) | Conditional | Endpoint upgrades/certificates; UserAssist last-used metric replaced; SIR no longer supported. |
| 12 | [Agent experience for CSM](delta-zurich-brazil/brazil-zurich-agentexperienceforcsm-release-notes.md) | Conditional | Granular roles, default alert dismissal, and customized workspace behavior. |
| 13 | [Agentic Contact Center for Banking](delta-zurich-brazil/brazil-zurich-agenticcontactcenterforbanking-release-notes.md) | Feature | FSO dependency and CSR roles for adopting the contact center. |
| 14 | [Agentic Contact Center for Insurance](delta-zurich-brazil/brazil-zurich-agenticcontactcenterforinsurance-release-notes.md) | Feature | FSO dependency and insurance CSR access configuration. |
| 15 | [Agent Workspace for HR Case Management](delta-zurich-brazil/brazil-zurich-agentworkspaceforhrcasemanagement-release-notes.md) | Feature | CCaaS/recommended-action/editor changes; test custom HR workspace. |
| 16 | [AI Admin Center](delta-zurich-brazil/brazil-zurich-aiadmincenter-release-notes.md) | Conditional | Removed savings configurations/recommendation; automation administration changes. |
| 17 | [AI Admin Hub](delta-zurich-brazil/brazil-zurich-aiadminhub-release-notes.md) | Conditional | AI auto-activation/provider/Guardian changes; granular roles and client scripts. |
| 18 | [AI Agent Advisor](delta-zurich-brazil/brazil-zurich-aiagentadvisor-release-notes.md) | Conditional | Removed multi-projection/daily recommendation behavior; automation changes. |
| 19 | [AI Agent Studio](delta-zurich-brazil/brazil-zurich-aiagentstudio-release-notes.md) | Conditional | New-instance deny default; opt-in validation; A2A credentials and regional routing. |
| 20 | [AI Control Tower](delta-zurich-brazil/brazil-zurich-aicontroltower-release-notes.md) | Conditional | Upgrade resets sampling limits; Veza OAuth; legacy migration and metric dependencies. |
| 21 | [AI Desktop Actions](delta-zurich-brazil/brazil-zurich-aidesktopactions-release-notes.md) | Conditional | Update external installers; default AI recording and restrictive prerequisites. |
| 22 | [AIOps LEAP](delta-zurich-brazil/brazil-zurich-aiopsleap-release-notes.md) | Feature | Model options and Creator dependency; see canonical LEAP/ITOM notes. |
| 23 | [AI Risk and Compliance](delta-zurich-brazil/brazil-zurich-airiskandcompliance-release-notes.md) | Conditional | Sequential upgrade instruction; assessment/versioning/access and provider behavior. |
| 24 | [AI Search](delta-zurich-brazil/brazil-zurich-aisearch-release-notes.md) | Conditional | Search roles/semantics and source facets; indexing and AI provider changes. |
| 25 | [AI Skill Kit](delta-zurich-brazil/brazil-zurich-aiskillkit-release-notes.md) | Conditional | Task-specific admin roles; alternative to removed GAIC calls; AI usage accounting. |
| 26 | [Alumni Center](delta-zurich-brazil/brazil-zurich-alumnicenter-release-notes.md) | Conditional | Removed email/import properties; registration/user-creation customizations. |
| 27 | [API](delta-zurich-brazil/brazil-zurich-api-release-notes.md) | Now | Removed APIs/SDKs; encryption and dynamic-attribute compatibility. |
| 28 | [App Engine ERP Rapid Deployment Packs](delta-zurich-brazil/brazil-zurich-appengineerprapiddeploymentpacks-release-notes.md) | Feature | New offering rather than an existing-instance retrofit. |
| 29 | [App Engine Management Center](delta-zurich-brazil/brazil-zurich-appenginemanagementcenter-release-notes.md) | Conditional | ReleaseOps pipeline migration and separately installed dependency. |
| 30 | [App Engine Studio](delta-zurich-brazil/brazil-zurich-appenginestudio-release-notes.md) | Conditional | ui_builder_admin removal from portal template; flow-template lifecycle. |
| 31 | [Applicant Center](delta-zurich-brazil/brazil-zurich-applicantcenter-release-notes.md) | Feature | Hiring Core dependency and applicant workflows. |
| 32 | [Application Manager](delta-zurich-brazil/brazil-zurich-applicationmanager-release-notes.md) | Watch | Patch prerequisites and replacement of legacy manager; licensing indicators. |
| 33 | [Application Vulnerability Response](delta-zurich-brazil/brazil-zurich-applicationvulnerabilityresponse-release-notes.md) | Conditional | Below-v30 versus USEM decision; integrations and migration. |
| 34 | [Asset Audit Response](delta-zurich-brazil/brazil-zurich-assetauditresponse-release-notes.md) | Conditional | Shared read-only security change; audit evidence roles and workflows. |
| 35 | [Audit Management](delta-zurich-brazil/brazil-zurich-auditmanagement-release-notes.md) | Feature | Audit-entry/evidence capabilities; assess product-specific workflows. |
| 36 | [Authentication](delta-zurich-brazil/brazil-zurich-authentication-release-notes.md) | Now | Basic Auth allowlist; integration console deprecation; SSO/roles/max_age. |
| 37 | [Automated Test Framework](delta-zurich-brazil/brazil-zurich-automatedtestframework-release-notes.md) | Conditional | Quick starts must be adapted to your data/customizations to be useful evidence. |
| 38 | [Automation Discovery](delta-zurich-brazil/brazil-zurich-automationdiscovery-release-notes.md) | Watch | Hidden on new instances; existing-release support retained. |
| 39 | [Autonomous Workforce](delta-zurich-brazil/brazil-zurich-autonomousworkforce-release-notes.md) | Conditional | Patch prerequisites; no Domain Separation support in documented version; default search. |
| 40 | [Build Agent](delta-zurich-brazil/brazil-zurich-buildagent-release-notes.md) | Feature | Thin topic; use the separate Build Agent and Autonomous Engineer note. |
| 41 | [Build Agent and Autonomous Engineer](delta-zurich-brazil/brazil-zurich-buildagentandautonomousengineer-release-notes.md) | Conditional | Trial default installation; testing opt-ins and update-set/checkpoint behavior. |
| 42 | [Business Continuity Management](delta-zurich-brazil/brazil-zurich-businesscontinuitymanagement-release-notes.md) | Feature | Recovery/task/reporting behavior; product-owner review if used. |
| 43 | [Buying Group](delta-zurich-brazil/brazil-zurich-buyinggroup-release-notes.md) | Feature | New buying-group modeling capabilities. |
| 44 | [Card Data Security](delta-zurich-brazil/brazil-zurich-carddatasecurity-release-notes.md) | Conditional | Tokenized PAN/document handling and connector changes if card operations are used. |
| 45 | [Career Conversations](delta-zurich-brazil/brazil-zurich-careerconversations-release-notes.md) | Feature | Growth/feedback AI and conversation enhancements. |
| 46 | [Care Team Mobile](delta-zurich-brazil/brazil-zurich-careteammobile-release-notes.md) | Feature | Mobile request/scan/location experience. |
| 47 | [Care Team Operations for Biomed](delta-zurich-brazil/brazil-zurich-careteamoperationsforbiomed-release-notes.md) | Conditional | Shared read-only/granular-admin changes; AI case-creation dependency. |
| 48 | [Care Team Operations for Environmental Services](delta-zurich-brazil/brazil-zurich-careteamoperationsforenvironmentalservices-release-notes.md) | Conditional | Shared read-only/granular-admin changes and case/work-order synchronization. |
| 49 | [Care Team Operations for Facilities](delta-zurich-brazil/brazil-zurich-careteamoperationsforfacilities-release-notes.md) | Conditional | Shared read-only/granular-admin changes and facilities case flow. |
| 50 | [Care Team Operations for Healthcare IT](delta-zurich-brazil/brazil-zurich-careteamoperationsforhealthcareit-release-notes.md) | Conditional | Shared read-only/granular-admin changes and AI dependency. |
| 51 | [Care Team Work Management](delta-zurich-brazil/brazil-zurich-careteamworkmanagement-release-notes.md) | Feature | New playbooks/smart-assessment dependency and roles. |
| 52 | [Case and Knowledge Management](delta-zurich-brazil/brazil-zurich-caseandknowledgemanagement-release-notes.md) | Conditional | HR granular security/COE diagnostics; incomplete Brazil task text. |
| 53 | [Case Management for CSM](delta-zurich-brazil/brazil-zurich-casemanagementforcsm-release-notes.md) | Conditional | Deny-unless ACLs; Case Types Store migration and new viewer roles. |
| 54 | [Certificate Inventory and Management](delta-zurich-brazil/brazil-zurich-certificateinventoryandmanagement-release-notes.md) | Feature | Thin local delta; follow ITOM Visibility for certificate lifecycle changes. |
| 55 | [Change Management](delta-zurich-brazil/brazil-zurich-changemanagement-release-notes.md) | Conditional | Granular role replacement; conflict-detection flow/property and custom formatter. |
| 56 | [Classic Workflow](delta-zurich-brazil/brazil-zurich-classicworkflow-release-notes.md) | Watch | New-instance removal differs from upgraded-instance retention; editor role requirement. |
| 57 | [Clone Admin Console](delta-zurich-brazil/brazil-zurich-cloneadminconsole-release-notes.md) | Conditional | JWT/OAuth registration requirements; unsupported legacy clone request flow. |
| 58 | [Cloud Cost Management](delta-zurich-brazil/brazil-zurich-cloudcostmanagement-release-notes.md) | Conditional | Brazil ACL audit; change-write replaced by read; Azure download lifecycle. |
| 59 | [Cloud Exposure View](delta-zurich-brazil/brazil-zurich-cloudexposureview-release-notes.md) | Conditional | USEM prerequisites; Wiz new-customer keys and full-import requirements. |
| 60 | [Code Signing](delta-zurich-brazil/brazil-zurich-codesigning-release-notes.md) | Conditional | Discovery payload enforcement; default production audit and retention. |
| 61 | [Collaborative Work Management](delta-zurich-brazil/brazil-zurich-collaborativeworkmanagement-release-notes.md) | Conditional | Third-party LLM default plus project/sprint/task integration changes. |
| 62 | [Collaborative Work Management (CWM)](delta-zurich-brazil/brazil-zurich-collaborativeworkmanagementcwm-release-notes.md) | Feature | Separate Brazil page: dashboard data collection and EAP sprint synchronization. |
| 63 | [Common Core](delta-zurich-brazil/brazil-zurich-commoncore-release-notes.md) | Conditional | EBA restrictions/configuration removal and preview; agent ACL/run-as controls. |
| 64 | [Common GRC feature](delta-zurich-brazil/brazil-zurich-commongovernanceriskandcompliancefeature-release-notes.md) | Conditional | Default AI providers and notification/workspace routing. |
| 65 | [Common GRC features](delta-zurich-brazil/brazil-zurich-commongovernanceriskandcompliancefeatures-release-notes.md) | Feature | Separate Brazil page: configurable issue/entity lifecycle workflows. |
| 66 | [Compliance Case Management](delta-zurich-brazil/brazil-zurich-compliancecasemanagement-release-notes.md) | Conditional | Default provider and assessment-template versioning. |
| 67 | [Configurable Workspace](delta-zurich-brazil/brazil-zurich-configurableworkspace-release-notes.md) | Now | Replaced list/condition components; public-page actions and custom UI behavior. |
| 68 | [Configuration Compliance](delta-zurich-brazil/brazil-zurich-configurationcompliance-release-notes.md) | Conditional | USEM version boundary; Wiz migration; Tenable keys/integration replacement. |
| 69 | [CMDB](delta-zurich-brazil/brazil-zurich-configurationmanagementdatabasecmdb-release-notes.md) | Now | Dynamic IRE opt-in; manual role job; data/index/workspace/access changes. |
| 70 | [Container Vulnerability Response](delta-zurich-brazil/brazil-zurich-containervulnerabilityresponse-release-notes.md) | Conditional | USEM boundary; full imports, container relationship scheduling, replaced Path field. |
| 71 | [Content Understanding](delta-zurich-brazil/brazil-zurich-contentunderstanding-release-notes.md) | Feature | Extraction/insights/summarization capabilities. |
| 72 | [Continual Improvement Management](delta-zurich-brazil/brazil-zurich-continualimprovementmanagement-release-notes.md) | Feature | CIM roles/integrations; no explicit new-instance retrofit identified. |
| 73 | [Continuous Authorization and Monitoring](delta-zurich-brazil/brazil-zurich-continuousauthorizationandmonitoring-release-notes.md) | Feature | Workflow/OSCAL and POAM permissions; relevant to authorization users. |
| 74 | [Contract Management Pro](delta-zurich-brazil/brazil-zurich-contractmanagementpro-release-notes.md) | Feature | Upgrade section explicitly says no action; check adjacent contract AI notes if used. |
| 75 | [Contract Management Pro for Legal Service Delivery](delta-zurich-brazil/brazil-zurich-contractmanagementproforlegalservicedelivery-release-notes.md) | Feature | Contract amendment capabilities; review if adopting. |
| 76 | [Contract Management Pro MCP Server](delta-zurich-brazil/brazil-zurich-contractmanagementpromcpserver-release-notes.md) | Feature | New MCP integration rather than mandatory retrofit. |
| 77 | [Conversation Improvement Themes](delta-zurich-brazil/brazil-zurich-conversationimprovementthemes-release-notes.md) | Feature | Conversation classification/quality capabilities. |
| 78 | [Conversation Insights](delta-zurich-brazil/brazil-zurich-conversationinsights-release-notes.md) | Feature | CSAT/AI analytics capabilities. |
| 79 | [Core Business Suite](delta-zurich-brazil/brazil-zurich-corebusinesssuite-release-notes.md) | Conditional | Shared read-only security, requester roles, and AI licensing checks. |
| 80 | [CPQ](delta-zurich-brazil/brazil-zurich-cpq-release-notes.md) | Conditional | Smart Predict requires tenant and layout enablement; transaction access/approval changes. |
| 81 | [CPQ Configurator](delta-zurich-brazil/brazil-zurich-cpqconfigurator-release-notes.md) | Conditional | Legacy users must explicitly enable advanced configurator property. |
| 82 | [Creator Studio](delta-zurich-brazil/brazil-zurich-creatorstudio-release-notes.md) | Feature | Granular roles, form deletion, and entitlement checks when used. |
| 83 | [CRM API Core](delta-zurich-brazil/brazil-zurich-crmapicore-release-notes.md) | Feature | Product rename; do not infer API breakage from name alone. |
| 84 | [CRM Core](delta-zurich-brazil/brazil-zurich-crmcore-release-notes.md) | Feature | Lead-to-Cash rename; inspect dependencies if adopting. |
| 85 | [CRM Outlook Add-in](delta-zurich-brazil/brazil-zurich-crmoutlookaddin-release-notes.md) | Conditional | User Mailbox Integration required for email promotion. |
| 86 | [Customer Contracts and Entitlements](delta-zurich-brazil/brazil-zurich-customercontractsandentitlements-release-notes.md) | Feature | Renewal/derived-pricing behavior; business-process regression review if used. |
| 87 | [Customer Engagement Sequences](delta-zurich-brazil/brazil-zurich-customerengagementsequences-release-notes.md) | Conditional | Replace deprecated Schedule call for click-to-call; email sequences need mailbox plugin. |
| 88 | [Customer self-service for Sales CRM](delta-zurich-brazil/brazil-zurich-customerselfserviceforsalescustomerrelationshipmanagement-release-notes.md) | Conditional | Sales Cart migration warns of lost cart products; billing/order dependencies. |
| 89 | [Customer Service Problem Management](delta-zurich-brazil/brazil-zurich-customerserviceproblemmanagement-release-notes.md) | Conditional | Default LLM change; complaint plugin dependency. |
| 90 | [Customer Success Management](delta-zurich-brazil/brazil-zurich-customersuccessmanagement-release-notes.md) | Conditional | Health migration script, granular access/read-only changes, provider review. |
| 91 | [Data Catalog](delta-zurich-brazil/brazil-zurich-datacatalog-release-notes.md) | Feature | Collector/metadata/asset-lineage enhancements. |
| 92 | [Data Center and Network Asset Management](delta-zurich-brazil/brazil-zurich-datacenterandnetworkassetmanagement-release-notes.md) | Feature | Cross-references EAM/TNI; review owning notes for those dependencies. |
| 93 | [Data Loss Prevention Incident Response](delta-zurich-brazil/brazil-zurich-datalosspreventionincidentresponse-release-notes.md) | Feature | Proofpoint and SLA setup; no mandatory local migration identified. |
| 94 | [Data Management](delta-zurich-brazil/brazil-zurich-datamanagement-release-notes.md) | Conditional | Console replacement, granular admin access, and archive/restore behavior. |
| 95 | [Data Management for CSM](delta-zurich-brazil/brazil-zurich-datamanagementforcsm-release-notes.md) | Conditional | Restricted-access manual job; responsibility fields and workflow/Store migration. |
| 96 | [Data Privacy](delta-zurich-brazil/brazil-zurich-dataprivacy-release-notes.md) | Conditional | Optional real-time blocking/quarantine; encrypted-field and variable anonymization. |
| 97 | [Data Products](delta-zurich-brazil/brazil-zurich-dataproducts-release-notes.md) | Feature | Data interface authoring/editing and connector capabilities. |
| 98 | [Data Separation](delta-zurich-brazil/brazil-zurich-dataseparation-release-notes.md) | Conditional | Unsupported in Australia; replace isolation design with filters/ACLs. |
| 99 | [Developer Sandboxes](delta-zurich-brazil/brazil-zurich-developersandboxes-release-notes.md) | Conditional | Data-generation deletion/deprecation; shared-table isolation; pooled URLs/staleness. |
| 100 | [DevOps Change Velocity](delta-zurich-brazil/brazil-zurich-devopschangevelocity-release-notes.md) | Conditional | Bitbucket app-password replacement; Jira/Rally/JFrog authentication and pipeline changes. |
| 101 | [Digital End-User Experience](delta-zurich-brazil/brazil-zurich-digitalenduserexperience-release-notes.md) | Conditional | Data migrations, removed users/pages, and removal of inherited ITIL roles. |
| 102 | [Digital Portfolio Management](delta-zurich-brazil/brazil-zurich-digitalportfoliomanagementdpm-release-notes.md) | Feature | Scheduled KPI email is opt-in/default-off; portfolio visibility choices. |
| 103 | [Discovery](delta-zurich-brazil/brazil-zurich-discovery-release-notes.md) | Feature | Thin local delta; inspect ITOM Visibility, MID, Code Signing, and import notes. |
| 104 | [Discovery Store Applications](delta-zurich-brazil/brazil-zurich-discoverystoreapplications-release-notes.md) | Feature | Thin local delta; Store version and ITOM pattern notes remain necessary. |
| 105 | [Dispute Content Pack for US Regulations](delta-zurich-brazil/brazil-zurich-disputecontentpackforusregulations-release-notes.md) | Conditional | Reg E / Reg Z SLA definition changes if US dispute processing is used. |
| 106 | [Dispute Rules Content Pack for Mastercard](delta-zurich-brazil/brazil-zurich-disputerulescontentpackformastercard-release-notes.md) | Conditional | Removed subcategory; new eligibility fields/rules need populated data. |
| 107 | [Dispute Rules Content Pack for Nacha](delta-zurich-brazil/brazil-zurich-disputerulescontentpackfornacha-release-notes.md) | Feature | ACH decision tables and supporting guidance. |
| 108 | [Dispute Rules Content Pack for Visa](delta-zurich-brazil/brazil-zurich-disputerulescontentpackforvisa-release-notes.md) | Conditional | Date/region-dependent eligibility and questionnaire rules; regression test disputes. |
| 109 | [Document Intelligence](delta-zurich-brazil/brazil-zurich-documentintelligence-release-notes.md) | Watch | Legacy extraction/admin lifecycle; existing support versus new activation. |
| 110 | [Document Services](delta-zurich-brazil/brazil-zurich-documentservices-release-notes.md) | Conditional | Granular roles, external cloud permissions, PDF/signature and framework changes. |
| 111 | [Domain Separation](delta-zurich-brazil/brazil-zurich-domainseparation-release-notes.md) | Conditional | Dot-walk bypass compliance and process overrides; verify tenant boundaries. |
| 112 | [Dynamic Translation](delta-zurich-brazil/brazil-zurich-dynamictranslation-release-notes.md) | Feature | Exclusion-rule testing; no explicit mandatory retrofit identified. |
| 113 | [Employee Center](delta-zurich-brazil/brazil-zurich-employeecenter-release-notes.md) | Conditional | Shared read-only security; default lazy load and request/chat integration. |
| 114 | [Employee Center Pro](delta-zurich-brazil/brazil-zurich-employeecenterpro-release-notes.md) | Conditional | Shared read-only security and portal/chat/feedback integration. |
| 115 | [Employee Slate](delta-zurich-brazil/brazil-zurich-employeeslate-release-notes.md) | Feature | Patch/assistant prerequisites for adopting conversation-first experience. |
| 116 | [Employee Slate for ITSM](delta-zurich-brazil/brazil-zurich-employeeslateforitsm-release-notes.md) | Feature | Booking/service-status enhancements. |
| 117 | [EMR Provider Directory Sync](delta-zurich-brazil/brazil-zurich-emrproviderdirectorysyncsync-release-notes.md) | Feature | FHIR initial-load and monitoring setup if implemented. |
| 118 | [Encryption](delta-zurich-brazil/brazil-zurich-encryption-release-notes.md) | Now | 3DES/KMF boundary and Brazil Edge Encryption Java/patch prerequisites. |
| 119 | [Encryption Key Management](delta-zurich-brazil/brazil-zurich-encryptionkeymanagement-release-notes.md) | Now | GlideEncrypter differs between upgraded and new instances. |
| 120 | [Enterprise Architecture](delta-zurich-brazil/brazil-zurich-enterprisearchitecture-release-notes.md) | Conditional | Granular roles/properties; certification migration, retired-app visibility, default LLM. |
| 121 | [Enterprise Asset Management](delta-zurich-brazil/brazil-zurich-enterpriseassetmanagement-release-notes.md) | Conditional | Granular admin ACLs; classification/import-template changes and audit/navigation migrations. |
| 122 | [Enterprise Service Management Foundation](delta-zurich-brazil/brazil-zurich-enterpriseservicemanagementfoundation-release-notes.md) | Feature | Foundation offering; inspect dependent products separately. |
| 123 | [ERP Semantic Mining](delta-zurich-brazil/brazil-zurich-erpsemanticmining-release-notes.md) | Watch | Hidden/new-activation deprecation; existing support retained. |
| 124 | [Event Management](delta-zurich-brazil/brazil-zurich-eventmanagement-release-notes.md) | Conditional | Replaced refresh/connectors/ACD and unsupported dashboard; automation regression. |
| 125 | [Extended Security for EWD](delta-zurich-brazil/brazil-zurich-extendedsecurityforenterprisewidedeployment-release-notes.md) | Conditional | Explicit per-table additional-security opt-in and mandatory partition-role enforcement. |
| 126 | [External Content Connectors](delta-zurich-brazil/brazil-zurich-externalcontentconnectors-release-notes.md) | Conditional | Inbound mTLS, connector roles, user permission mappings, and limited Confluence RBAC. |
| 127 | [Field Service Management](delta-zurich-brazil/brazil-zurich-fieldservicemanagement-release-notes.md) | Conditional | Google API activation; Schedule Optimization queue-property replacement. |
| 128 | [FSM for Telecommunication](delta-zurich-brazil/brazil-zurich-fieldservicemanagementfortelecommunication-release-notes.md) | Feature | Work-order features; inspect owning FSM upgrade instructions. |
| 129 | [Financial Services Card Operations](delta-zurich-brazil/brazil-zurich-financialservicescardoperations-release-notes.md) | Conditional | Mandatory dispute questionnaire/validation changes and model review. |
| 130 | [Financial Services Operations Core](delta-zurich-brazil/brazil-zurich-financialservicesoperationscore-release-notes.md) | Conditional | Deny-unless ACLs; deprecated criteria tables migrate to CSM equivalents. |
| 131 | [FSO Integration with Mastercard](delta-zurich-brazil/brazil-zurich-financialservicesoperationsintegrationwithmastercard-release-notes.md) | Conditional | Updated Mastercom subflows, attachment and validation wiring. |
| 132 | [FSO Integration with Verifi](delta-zurich-brazil/brazil-zurich-financialservicesoperationsintegrationwithverifi-release-notes.md) | Conditional | Integration property must be true and ships false; configure before use. |
| 133 | [FSO Integration with Visa](delta-zurich-brazil/brazil-zurich-financialservicesoperationsintegrationwithvisa-release-notes.md) | Conditional | Property/subflow/questionnaire validation and action wiring changes. |
| 134 | [Firewall Audits and Reporting](delta-zurich-brazil/brazil-zurich-firewallauditsandreporting-release-notes.md) | Feature | Vendor/dashboard capability and ITOM/role prerequisites. |
| 135 | [Flows, Subflows, and Actions](delta-zurich-brazil/brazil-zurich-flowssubflowsandactions-release-notes.md) | Conditional | Read-only changes, autosave recovery, conversational/security testing. |
| 136 | [Flows in Workflow Studio](delta-zurich-brazil/brazil-zurich-flowssubflowsandactionsinworkflowstudio-release-notes.md) | Watch | Separate legacy page: autosave recovery for old upgrade paths. |
| 137 | [Generative AI Controller](delta-zurich-brazil/brazil-zurich-generativeaicontroller-release-notes.md) | Conditional | Removed direct action calls; 180-day log retention and usage changes. |
| 138 | [Goal Framework](delta-zurich-brazil/brazil-zurich-goalframework-release-notes.md) | Feature | Role/form changes and AI Control Tower linkage. |
| 139 | [Goal Framework for SPM](delta-zurich-brazil/brazil-zurich-goalframeworkforspm-release-notes.md) | Feature | Automatic status/check-in configuration; goal-owner review if used. |
| 140 | [Hardware Asset Management](delta-zurich-brazil/brazil-zurich-hardwareassetmanagement-release-notes.md) | Conditional | Default-off asset read restriction; customized workflows and audit-table changes. |
| 141 | [Healthcare and Life Sciences Core](delta-zurich-brazil/brazil-zurich-healthcareandlifesciencesservicemanagementcore-release-notes.md) | Conditional | Shared read-only/granular-admin upgrade checks despite thin feature section. |
| 142 | [Healthcare Operations Core](delta-zurich-brazil/brazil-zurich-healthcareoperationscore-release-notes.md) | Conditional | Read-only/admin checks, care-team role and AI case-creation dependencies. |
| 143 | [Health Log Analytics](delta-zurich-brazil/brazil-zurich-healthloganalytics-release-notes.md) | Conditional | LogDB automatic transition makes historical alert logs unavailable. |
| 144 | [Hermes Messaging Service](delta-zurich-brazil/brazil-zurich-hermesmessagingservice-release-notes.md) | Conditional | IP access controls, viewer role, encryption and topic-retention settings. |
| 145 | [Hiring](delta-zurich-brazil/brazil-zurich-hiring-release-notes.md) | Feature | Hiring Core dependency and requisition workflows. |
| 146 | [HL7 FHIR Spoke](delta-zurich-brazil/brazil-zurich-hl7fhirspoke-release-notes.md) | Feature | Connection/action configuration if healthcare integration is adopted. |
| 147 | [HL7 v2.x Integration](delta-zurich-brazil/brazil-zurich-hl7v2xintegration-release-notes.md) | Feature | Inbound parsing/log configuration if used. |
| 148 | [HR Multi Instance Integration](delta-zurich-brazil/brazil-zurich-hrmultiinstanceintegration-release-notes.md) | Feature | Cross-instance HR integration capability; configuration review if adopted. |
| 149 | [HR Accurate Background Integration](delta-zurich-brazil/brazil-zurich-hrservicedeliveryintegrationwithaccuratebackgroundservice-release-notes.md) | Watch | Hidden/no new activation; existing support retained. |
| 150 | [HR First Advantage Integration](delta-zurich-brazil/brazil-zurich-hrservicedeliveryintegrationwithfirstadvantageservice-release-notes.md) | Watch | Hidden/no new activation; existing support retained. |
| 151 | [HR Sterling Talent Integration](delta-zurich-brazil/brazil-zurich-hrservicedeliveryintegrationwithsterlingtalentsolutionsservice-release-notes.md) | Watch | Hidden/no new activation; existing support retained. |
| 152 | [Identity](delta-zurich-brazil/brazil-zurich-identity-release-notes.md) | Now | Role masking/AI identity administration; Conditional Script Writer and registration changes. |
| 153 | [Impact](delta-zurich-brazil/brazil-zurich-impact-release-notes.md) | Conditional | Default-on outcome skill; removed accelerators and registration/version dependencies. |
| 154 | [Import and Export](delta-zurich-brazil/brazil-zurich-importandexport-release-notes.md) | Now | MSSQL JDBC JAR removed from MID distribution; vendor driver installation required. |
| 155 | [Incident Management](delta-zurich-brazil/brazil-zurich-incidentmanagement-release-notes.md) | Now | Business-day closure, role/ACL changes; on-hold feature is zboot-only. |
| 156 | [Industrial Connected Workforce Core](delta-zurich-brazil/brazil-zurich-industrialconnectedworkforcecore-release-notes.md) | Conditional | Archival/24-month retention, role framework, and packaging. |
| 157 | [Industrial Connected Workforce Mobile](delta-zurich-brazil/brazil-zurich-industrialconnectedworkforcemobileexperience-release-notes.md) | Feature | Guided/mobile task and safety-report capabilities. |
| 158 | [Industrial Guided Tasks](delta-zurich-brazil/brazil-zurich-industrialguidedtasks-release-notes.md) | Feature | Lifecycle/scoring/smart-action features; automatic ICW dependency install. |
| 159 | [Industrial Process Manager](delta-zurich-brazil/brazil-zurich-industrialprocessmanager-release-notes.md) | Conditional | Granular admin dependency and OT location/model mapping changes. |
| 160 | [Industrial Standards](delta-zurich-brazil/brazil-zurich-industrialstandards-release-notes.md) | Feature | Standards/task scheduling and ICW packaging. |
| 161 | [Instance Data Replication](delta-zurich-brazil/brazil-zurich-instancedatareplication-release-notes.md) | Conditional | Unsupported legacy sets; automatic pre-upgrade error-log truncation. |
| 162 | [Instance Scan](delta-zurich-brazil/brazil-zurich-instancescan-release-notes.md) | Conditional | New check-writer role; inactive/base-system execution needs explicit properties. |
| 163 | [Integration Hub](delta-zurich-brazil/brazil-zurich-integrationhub-release-notes.md) | Conditional | Authentication/retry/spoke licensing and streaming integration behavior. |
| 164 | [Intelligence for CSM](delta-zurich-brazil/brazil-zurich-intelligenceforcsm-release-notes.md) | Feature | Thin topic; inspect Predictive AI for CSM and CSM AI notes. |
| 165 | [Intelligent Approvals](delta-zurich-brazil/brazil-zurich-intelligentapprovals-release-notes.md) | Feature | New approval-authoring experience rather than automatic retrofit. |
| 166 | [Interview Management](delta-zurich-brazil/brazil-zurich-interviewmanagement-release-notes.md) | Feature | Hiring Core dependency and scheduling workflow changes. |
| 167 | [ITOM AIOps](delta-zurich-brazil/brazil-zurich-itomaiops-release-notes.md) | Feature | Activation/license cross-reference; inspect Event Management/HLA. |
| 168 | [ITOM Cloud Accelerate](delta-zurich-brazil/brazil-zurich-itomcloudaccelerate-release-notes.md) | Conditional | Legacy cloud workflows unsupported; migrate future work to flows/subflows. |
| 169 | [ITOM MCP Server Console](delta-zurich-brazil/brazil-zurich-itommcpserverconsole-release-notes.md) | Feature | New MCP remediation/log-ingestion capabilities and security configuration. |
| 170 | [ITOM Visibility](delta-zurich-brazil/brazil-zurich-itomvisibility-release-notes.md) | Conditional | HTTP credential behavior; Cloud Discovery Workspace lifecycle and pattern updates. |
| 171 | [ITSM Employee Slate for Moveworks](delta-zurich-brazil/brazil-zurich-itsmemployeeslateformoveworks-release-notes.md) | Feature | Thin local topic; see Slate/ITSM notes. |
| 172 | [ITSM MCP Server](delta-zurich-brazil/brazil-zurich-itsmmcpserver-release-notes.md) | Conditional | requester.escalate disabled; migrate to incident.modify escalation inputs. |
| 173 | [Journey Designer](delta-zurich-brazil/brazil-zurich-journeydesigner-release-notes.md) | Watch | Learning/Listening Posts consolidation; legacy journey/AI behavior review. |
| 174 | [Key Management](delta-zurich-brazil/brazil-zurich-keymanagement-release-notes.md) | Now | GlideEncrypter allow control and new/upgraded KMF behavior. |
| 175 | [Knowledge Center](delta-zurich-brazil/brazil-zurich-knowledgecenter-release-notes.md) | Conditional | Auto-update/merge/publish enablement, confidence, and revert controls. |
| 176 | [Knowledge Graph](delta-zurich-brazil/brazil-zurich-knowledgegraph-release-notes.md) | Conditional | Model/version prerequisites and AI usage/provider changes. |
| 177 | [Knowledge Management](delta-zurich-brazil/brazil-zurich-knowledgemanagement-release-notes.md) | Conditional | Knowledge processes move from workflows to flows; test custom publishing/approval. |
| 178 | [Kubernetes Visibility Agent](delta-zurich-brazil/brazil-zurich-kubernetesvisibilityagentkva-release-notes.md) | Conditional | Update cluster agent to matching app version; legacy API lifecycle. |
| 179 | [L1 IT Service Desk AI Specialist](delta-zurich-brazil/brazil-zurich-l1itservicedeskaispecialist-release-notes.md) | Conditional | Patch prerequisites and unsupported domain separation in documented version. |
| 180 | [Lead Management](delta-zurich-brazil/brazil-zurich-leadmanagement-release-notes.md) | Feature | Touchpoint functionality. |
| 181 | [Lead-to-Cash Process Management](delta-zurich-brazil/brazil-zurich-leadtocashprocessmanagement-release-notes.md) | Feature | Business objects/process/task/dashboard configuration. |
| 182 | [LEAP](delta-zurich-brazil/brazil-zurich-leap-release-notes.md) | Conditional | Platform/Creator dependencies; replacement path for deprecated suggested steps. |
| 183 | [Learning Posts](delta-zurich-brazil/brazil-zurich-learningposts-release-notes.md) | Watch | Deprecated/no new activation; Journey Designer consolidation. |
| 184 | [Legacy Application Manager](delta-zurich-brazil/brazil-zurich-legacyapplicationmanager-release-notes.md) | Watch | Patch-specific deprecation and bookmark redirection. |
| 185 | [Legacy Studio](delta-zurich-brazil/brazil-zurich-legacystudio-release-notes.md) | Watch | New-instance install hidden; existing support retained. |
| 186 | [Legal Conflict of Interest](delta-zurich-brazil/brazil-zurich-legalconflictofinterest-release-notes.md) | Feature | Risk assessment and conversational intake. |
| 187 | [Legal Hold Notification](delta-zurich-brazil/brazil-zurich-legalholdnotification-release-notes.md) | Feature | Hold issuance/acknowledgment capabilities; verify preservation workflows if used. |
| 188 | [Legal Matter Management](delta-zurich-brazil/brazil-zurich-legalmattermanagement-release-notes.md) | Feature | Attorney-client privilege functionality. |
| 189 | [Legal Request Management](delta-zurich-brazil/brazil-zurich-legalrequestmanagement-release-notes.md) | Feature | Attorney-client privilege functionality. |
| 190 | [Lifecycle Events](delta-zurich-brazil/brazil-zurich-lifecycleevents-release-notes.md) | Feature | Logging requires enablement and new case-log table usage. |
| 191 | [Listening Posts](delta-zurich-brazil/brazil-zurich-listeningposts-release-notes.md) | Watch | Deprecated/no new activation; Journey Designer consolidation. |
| 192 | [Live Connect](delta-zurich-brazil/brazil-zurich-liveconnect-release-notes.md) | Conditional | SOAP-to-REST client/configuration migration with RaptorDB entitlement; OAuth. |
| 193 | [Localization Workspace](delta-zurich-brazil/brazil-zurich-localizationworkspace-release-notes.md) | Feature | Translation request/status/terminology role changes. |
| 194 | [Manufacturing Commercial Operations](delta-zurich-brazil/brazil-zurich-manufacturingcommercialoperations-release-notes.md) | Conditional | Default model provider and nonconformance/FSM workflow changes. |
| 195 | [Mastercard Spoke](delta-zurich-brazil/brazil-zurich-mastercardspoke-release-notes.md) | Feature | Arbitration/case filing; inspect FSO/rule-pack changes if used. |
| 196 | [MCP for Strategic Portfolio Management](delta-zurich-brazil/brazil-zurich-mcpforstrategicportfoliomanagement-release-notes.md) | Feature | New goal/portfolio/project tools; security review if adopted. |
| 197 | [MCP Server Console](delta-zurich-brazil/brazil-zurich-mcpserverconsole-release-notes.md) | Conditional | OAuth/client authorizations, Quickstart-only tools, and external exposure review. |
| 198 | [Mentoring](delta-zurich-brazil/brazil-zurich-mentoring-release-notes.md) | Feature | Mentoring program creation. |
| 199 | [MID Server](delta-zurich-brazil/brazil-zurich-midserver-release-notes.md) | Now | Runtime/download requirements; duplicate Windows services; security log storage. |
| 200 | [Mobile Platform](delta-zurich-brazil/brazil-zurich-mobileplatform-release-notes.md) | Conditional | Granular admin/PIN/impersonation controls; shared-device and Android build requirements. |
| 201 | [Model Risk Management](delta-zurich-brazil/brazil-zurich-modelriskmanagement-release-notes.md) | Feature | Model assessment/validation/documentation capabilities. |
| 202 | [Next Experience](delta-zurich-brazil/brazil-zurich-nextexperience-release-notes.md) | Now | UI11/UI15 unsupported; default lazy load and accessibility changes. |
| 203 | [Next Experience Components](delta-zurich-brazil/brazil-zurich-nextexperiencecomponents-release-notes.md) | Watch | Deprecated dashboard template; chart/component changes need custom UI regression. |
| 204 | [Next Experience Developer Tools](delta-zurich-brazil/brazil-zurich-nextexperiencedevelopernedtools-release-notes.md) | Feature | Inspector traces/events/components enhancements. |
| 205 | [Notifications](delta-zurich-brazil/brazil-zurich-notifications-release-notes.md) | Now | Granular admin roles, email threading/privacy and CLE attachment behavior. |
| 206 | [Notify](delta-zurich-brazil/brazil-zurich-notify-release-notes.md) | Conditional | New-install subflows versus retained existing workflows; granular configuration access. |
| 207 | [Now Assist for Employee Center Pro](delta-zurich-brazil/brazil-zurich-nowassistforemployeecenterpro-release-notes.md) | Feature | Requester-only scope; other AI products may be required. |
| 208 | [Now Assist for Sales CRM Telecommunications](delta-zurich-brazil/brazil-zurich-nowassistforsalescrmfortelecommunications-release-notes.md) | Feature | Fallout/move-order voice agents; assess licensing/configuration. |
| 209 | [Now Assist for Vulnerability Response](delta-zurich-brazil/brazil-zurich-nowassistforvulnerabilityresponse-release-notes.md) | Conditional | Default-on untouched skills/dependencies; legacy name/lifecycle and USEM route. |
| 210 | [Now Assist in AI Search](delta-zurich-brazil/brazil-zurich-nowassistinaisearch-release-notes.md) | Conditional | Guided setup auto-activates MCR results; search/provider/usage effects. |
| 211 | [Now Assist in Contract Management](delta-zurich-brazil/brazil-zurich-nowassistincontractmanagement-release-notes.md) | Conditional | Upsert DI skill config migration for specified older customized use cases. |
| 212 | [Now Assist in Document Intelligence](delta-zurich-brazil/brazil-zurich-nowassistindocumentintelligence-release-notes.md) | Conditional | Default-on skills; merged/removed skill entries and runtime dependencies. |
| 213 | [Now Assist in Virtual Agent](delta-zurich-brazil/brazil-zurich-nowassistinvirtualagent-release-notes.md) | Conditional | Premium messages/fallbacks not auto-migrated; removed settings/skills and defaults. |
| 214 | [On-Call Scheduling](delta-zurich-brazil/brazil-zurich-oncallscheduling-release-notes.md) | Conditional | Workflow/subflow transition; logging default preserves existing value. |
| 215 | [Operational Resilience](delta-zurich-brazil/brazil-zurich-operationalresilience-release-notes.md) | Conditional | Sequential upgrades; dependency job rerun/default-off jobs; DORA validation. |
| 216 | [Operational Sustainability Management](delta-zurich-brazil/brazil-zurich-operationalsustainabilitymanagement-release-notes.md) | Feature | Separate Brazil content-generation/regulatory enhancements. |
| 217 | [Operational Sustainability Management / former ESG](delta-zurich-brazil/brazil-zurich-operationalsustainabilitymanagementformerlyenvironmentalsocialandgovernance-release-notes.md) | Conditional | Campaign property opt-ins; role inheritance differs for new installations. |
| 218 | [Operational Technology Discovery](delta-zurich-brazil/brazil-zurich-operationaltechnologydiscovery-release-notes.md) | Watch | Connector/console/sensor/collector new installation hidden; existing support retained. |
| 219 | [OT Incident Management](delta-zurich-brazil/brazil-zurich-operationaltechnologyincidentmanagement-release-notes.md) | Conditional | Default LLM changes and granular admin/AI workflow access. |
| 220 | [OT Manager](delta-zurich-brazil/brazil-zurich-operationaltechnologymanager-release-notes.md) | Conditional | Enhanced filters/deny-unless/query ACLs; bulk-context restrictions and roles. |
| 221 | [OT Manager Foundation](delta-zurich-brazil/brazil-zurich-operationaltechnologyotmanagerfoundation-release-notes.md) | Conditional | Default-on AI assets, role masking, and provider changes. |
| 222 | [OT Setup](delta-zurich-brazil/brazil-zurich-operationaltechnologysetup-release-notes.md) | Feature | Setup assistance for OT use cases. |
| 223 | [OT Vulnerability Response](delta-zurich-brazil/brazil-zurich-operationaltechnologyvulnerabilityresponse-release-notes.md) | Feature | SEM workspace/risk assessment capabilities; see VR/USEM migration boundary. |
| 224 | [Opportunity Management](delta-zurich-brazil/brazil-zurich-opportunitymanagement-release-notes.md) | Conditional | Optional win/loss/stage enforcement; removed opportunity-line button. |
| 225 | [Order Management](delta-zurich-brazil/brazil-zurich-ordermanagement-release-notes.md) | Conditional | Derived pricing auto-add/update/removal and system-line edit restrictions. |
| 226 | [Partner Relationship Management](delta-zurich-brazil/brazil-zurich-partnerrelationshipmanagement-release-notes.md) | Feature | Deal approval/task/partner portal capability; configure governance if used. |
| 227 | [Password Reset](delta-zurich-brazil/brazil-zurich-passwordreset-release-notes.md) | Conditional | password_reset_admin granular configuration role. |
| 228 | [Performance Analytics](delta-zurich-brazil/brazil-zurich-performanceanalytics-release-notes.md) | Conditional | Snapshot auto-install/Domain Separation caveat; KPI/Analytics Hub lifecycle. |
| 229 | [Performance Analyzer](delta-zurich-brazil/brazil-zurich-performanceanalyzer-release-notes.md) | Feature | Availability automatic from Zurich; newer analysis capabilities. |
| 230 | [Platform Analytics Experience](delta-zurich-brazil/brazil-zurich-platformanalyticsexperience-release-notes.md) | Now | Default-on upgrade, public-report unpublishing, homepage/list migration. |
| 231 | [Playbook](delta-zurich-brazil/brazil-zurich-playbook-release-notes.md) | Conditional | Update Store Workflow Studio after upgrade; author/runtime roles and LLM changes. |
| 232 | [Playbooks in Workflow Studio](delta-zurich-brazil/brazil-zurich-playbooksinworkflowstudio-release-notes.md) | Conditional | Store app update and region-specific LLM availability. |
| 233 | [Policy and Compliance Management](delta-zurich-brazil/brazil-zurich-policyandcompliancemanagement-release-notes.md) | Conditional | Default-off control-objective workflow; entity-based access and version behavior. |
| 234 | [Portfolio Planning](delta-zurich-brazil/brazil-zurich-portfolioplanning-release-notes.md) | Conditional | Demand AI auto-generation, financial baseline migration and content-pack packaging. |
| 235 | [Predictive AI for CSM](delta-zurich-brazil/brazil-zurich-predictiveaiforcsm-release-notes.md) | Conditional | Mandatory contextual inputs must be populated; default LLM and action access. |
| 236 | [Predictive Intelligence](delta-zurich-brazil/brazil-zurich-predictiveintelligence-release-notes.md) | Conditional | KAA defaults true but validation is skipped without mTLS; data-access validation. |
| 237 | [Pricing Management](delta-zurich-brazil/brazil-zurich-pricingmanagement-release-notes.md) | Conditional | Removed parallel-execution properties; retired default-plan decision. |
| 238 | [Privacy Management](delta-zurich-brazil/brazil-zurich-privacymanagement-release-notes.md) | Conditional | Content reinstall can overwrite changes; legal-entity access and AI defaults. |
| 239 | [Proactive Service Experience Workflows](delta-zurich-brazil/brazil-zurich-proactiveserviceexperienceworkflows-release-notes.md) | Feature | Diagnostic/product-support workflows. |
| 240 | [Process Mining](delta-zurich-brazil/brazil-zurich-processmining-release-notes.md) | Conditional | Metered guardrails, role rename, deprecated APIs, and content-pack availability. |
| 241 | [Process Mining for ITSM](delta-zurich-brazil/brazil-zurich-processminingforitsm-release-notes.md) | Feature | Thin local topic; owning Process Mining note has the actions. |
| 242 | [Product Catalog Management](delta-zurich-brazil/brazil-zurich-productcatalogmanagement-release-notes.md) | Conditional | Channel-specific availability and new lifecycle fields affect custom search/automation. |
| 243 | [Product Catalog Management and Pricing](delta-zurich-brazil/brazil-zurich-productcatalogmanagementandpricingmanagement-release-notes.md) | Conditional | Re-publish AI Search; CPQ opt-in; custom pricing steps and removed properties. |
| 244 | [Product Support for Technology](delta-zurich-brazil/brazil-zurich-productsupportfortechnology-release-notes.md) | Conditional | Removed Analytics/Notify Customers UI; provider and account-view changes. |
| 245 | [Project Portfolio Management](delta-zurich-brazil/brazil-zurich-projectportfoliomanagement-release-notes.md) | Conditional | Unsupported planning/workbench; admin ACLs and older dashboard/portal lifecycle. |
| 246 | [Project Workspace](delta-zurich-brazil/brazil-zurich-projectworkspace-release-notes.md) | Conditional | Legacy report/dashboard alternatives; provider/AI roles and resource synchronization. |
| 247 | [Public Sector Digital Services](delta-zurich-brazil/brazil-zurich-publicsectordigitalservices-release-notes.md) | Conditional | Unprovisioned LLM routing warning; post-upgrade labels and dashboard/portal migration. |
| 248 | [Purchase Order Management](delta-zurich-brazil/brazil-zurich-purchaseordermanagement-release-notes.md) | Feature | Exception/confirmation automation and data-model enhancements. |
| 249 | [Quote Management](delta-zurich-brazil/brazil-zurich-quotemanagement-release-notes.md) | Conditional | Automatic derived lines/edit restrictions; approval and price-ramp behavior. |
| 250 | [Recommended Actions for HRSD](delta-zurich-brazil/brazil-zurich-recommendedactionsforhrsd-release-notes.md) | Feature | New HR recommendations; verify roles and context if adopted. |
| 251 | [Recommended Actions for OTSM](delta-zurich-brazil/brazil-zurich-recommendedactionsforoperationaltechnologyservicemanagementotsm-release-notes.md) | Conditional | Default LLM and external-document context handling. |
| 252 | [Recruitment Workspace](delta-zurich-brazil/brazil-zurich-recruitmentworkspace-release-notes.md) | Feature | Hiring Core dependency and recruiter workflow changes. |
| 253 | [Regulatory Change Management](delta-zurich-brazil/brazil-zurich-regulatorychangemanagement-release-notes.md) | Conditional | Read-only/admin changes, task flow updates, and default AI providers. |
| 254 | [ReleaseOps](delta-zurich-brazil/brazil-zurich-releaseops-release-notes.md) | Conditional | Customized playbooks do not auto-populate runbook activity; regulated/on-prem unsupported. |
| 255 | [Request Management](delta-zurich-brazil/brazil-zurich-requestmanagement-release-notes.md) | Feature | Thin local delta; Service Catalog ACL changes still affect request tables. |
| 256 | [Resource Management Workspace](delta-zurich-brazil/brazil-zurich-resourcemanagementworkspace-release-notes.md) | Feature | Assignment experience; use PPM/partition notes for lifecycle/access risks. |
| 257 | [Retail](delta-zurich-brazil/brazil-zurich-retail-release-notes.md) | Conditional | New cases populate Template item instead of Origin; update custom consumers. |
| 258 | [Retail Applications](delta-zurich-brazil/brazil-zurich-retailapplications-release-notes.md) | Conditional | Abstract base case blocks creation/update; use specialized case types. |
| 259 | [Retail SPM Suite](delta-zurich-brazil/brazil-zurich-retailstrategicportfoliomanagementsuite-release-notes.md) | Feature | Project Workspace prerequisite and playbook/project types. |
| 260 | [Return Merchandise Authorization](delta-zurich-brazil/brazil-zurich-returnmerchandiseauthorization-release-notes.md) | Conditional | Granular Install Base roles and RMA case flow changes. |
| 261 | [Reverse Tunnel](delta-zurich-brazil/brazil-zurich-reversetunnel-release-notes.md) | Feature | Optional private connectivity/relay setup. |
| 262 | [RPA Hub](delta-zurich-brazil/brazil-zurich-rpahub-release-notes.md) | Conditional | Matching external MSIs required; old-path table migration and ACL changes. |
| 263 | [Sales Agreement](delta-zurich-brazil/brazil-zurich-salesagreement-release-notes.md) | Feature | Buyer-organization agreement capability. |
| 264 | [Sales CRM for Telecommunications](delta-zurich-brazil/brazil-zurich-salescrmfortelecommunications-release-notes.md) | Conditional | Default LLM and order/task-plan/voice workflows. |
| 265 | [Sales CRM Mobile](delta-zurich-brazil/brazil-zurich-salescrmmobile-release-notes.md) | Feature | Mobile/offline/AI capabilities; mobile-security checks if adopted. |
| 266 | [Sales Forecasting](delta-zurich-brazil/brazil-zurich-salesforecasting-release-notes.md) | Feature | Forecast model/rollup/owner configuration; process regression if used. |
| 267 | [Sales Territory Management](delta-zurich-brazil/brazil-zurich-salesterritorymanagement-release-notes.md) | Feature | Territory model/user setup; no explicit mandatory retrofit identified. |
| 268 | [Security Center](delta-zurich-brazil/brazil-zurich-securitycenter-release-notes.md) | Now | Updated/family-scoped hardening and access findings; accepted-risk governance. |
| 269 | [Security Incident Response](delta-zurich-brazil/brazil-zurich-securityincidentresponse-release-notes.md) | Conditional | Irremovable manual security tags; external access/admin/connector and AI changes. |
| 270 | [Security Posture Control](delta-zurich-brazil/brazil-zurich-securityposturecontrol-release-notes.md) | Conditional | Version/dependency requirements and AI connector configuration; USEM linkage. |
| 271 | [Self-service and Omnichannel CSM](delta-zurich-brazil/brazil-zurich-selfserviceandomnichannelengagementforcsm-release-notes.md) | Conditional | Unsupported CTI/Communities; family-to-Store portal/framework migration. |
| 272 | [Service Catalog](delta-zurich-brazil/brazil-zurich-servicecatalog-release-notes.md) | Now | Upgraded-instance portal install; catalog/request ACL separation; criteria opt-in. |
| 273 | [Service Creator](delta-zurich-brazil/brazil-zurich-servicecreator-release-notes.md) | Conditional | Brazil says unsupported; move to Creator Studio rather than baseline-only watch. |
| 274 | [Service Exchange](delta-zurich-brazil/brazil-zurich-serviceexchange-release-notes.md) | Conditional | Legacy migration, deny-ACL repair, and coupled version requirements. |
| 275 | [Service Exchange / former Service Bridge](delta-zurich-brazil/brazil-zurich-serviceexchangeformerlyservicebridge-release-notes.md) | Conditional | Australia patch blocker; OAuth grant migration and missing-deny-ACL repair. |
| 276 | [SGC Microsoft Defender for IoT](delta-zurich-brazil/brazil-zurich-servicegraphconnectorformicrosoftdefenderforiotazure-release-notes.md) | Feature | Class/firmware/mapping capabilities; verify OT ingestion if used. |
| 277 | [SGC Claroty CTD](delta-zurich-brazil/brazil-zurich-servicegraphconnectorintegrationforclarotyctd-release-notes.md) | Watch | Hidden/no new install; existing support retained. |
| 278 | [Service Level Management](delta-zurich-brazil/brazil-zurich-servicelevelmanagement-release-notes.md) | Feature | SLA timer configuration; no explicit removal/default retrofit identified. |
| 279 | [Service Mapping](delta-zurich-brazil/brazil-zurich-servicemapping-release-notes.md) | Feature | MCP/lightweight modeling; inspect ITOM Visibility and CMDB ingestion changes. |
| 280 | [ServiceNow AI Lens](delta-zurich-brazil/brazil-zurich-servicenowailens-release-notes.md) | Feature | Autofill/browser/document capabilities; review role/context policy if used. |
| 281 | [ServiceNow AI Platform Core](delta-zurich-brazil/brazil-zurich-servicenowaiplatformcorefeature-release-notes.md) | Now | Guarded scripts, hardening, read-only, guest/cross-scope access and removed properties. |
| 282 | [ServiceNow CLI](delta-zurich-brazil/brazil-zurich-servicenowcli-release-notes.md) | Feature | Thin local topic; check SDK tooling changes separately. |
| 283 | [ServiceNow IDE](delta-zurich-brazil/brazil-zurich-servicenowide-release-notes.md) | Conditional | Version updates and blocked-public-registry/private-registry prerequisite. |
| 284 | [ServiceNow Lux Lab for VS Code](delta-zurich-brazil/brazil-zurich-servicenowluxlabforvscode-release-notes.md) | Conditional | Node/pnpm/SDK/editor and instance-patch prerequisites. |
| 285 | [ServiceNow Otto](delta-zurich-brazil/brazil-zurich-servicenowotto-release-notes.md) | Conditional | Effective LLM routing/provisioning, custom skill UI, read-only and granular authorization. |
| 286 | [Otto for App Engine](delta-zurich-brazil/brazil-zurich-servicenowottoforappengine-release-notes.md) | Conditional | Default LLM/usage changes and Build Agent access. |
| 287 | [Otto for Care Team Operations](delta-zurich-brazil/brazil-zurich-servicenowottoforcareteamoperations-release-notes.md) | Feature | Care-team requester AI capabilities/entitlements. |
| 288 | [Otto for CMDB](delta-zurich-brazil/brazil-zurich-servicenowottoforcmdb-release-notes.md) | Conditional | Separate activation-path note; default-on assets and roles in canonical CMDB AI page. |
| 289 | [Otto for Collaborative Work Management](delta-zurich-brazil/brazil-zurich-servicenowottoforcollaborativeworkmanagementcwmcwm-release-notes.md) | Conditional | Default-on skills and AI usage/model checks. |
| 290 | [Otto for Configuration Management Database](delta-zurich-brazil/brazil-zurich-servicenowottoforconfigurationmanagementdatabasecmdb-release-notes.md) | Conditional | New required roles, connector/documentation crawl, default-on skills and model change. |
| 291 | [Otto for CPQ](delta-zurich-brazil/brazil-zurich-servicenowottoforconfigurepricequotecpq-release-notes.md) | Conditional | AI usage accounting and quote-summary permissions if used. |
| 292 | [Otto for Contract Management Pro](delta-zurich-brazil/brazil-zurich-servicenowottoforcontractmanagementpro-release-notes.md) | Conditional | Default Azure OpenAI/activation; metadata extraction mapping and agent roles. |
| 293 | [Otto for Creator](delta-zurich-brazil/brazil-zurich-servicenowottoforcreator-release-notes.md) | Conditional | Removed spoke generation; Build Agent upgrade/dependencies; role/activation changes. |
| 294 | [Otto for Customer Service Management](delta-zurich-brazil/brazil-zurich-servicenowottoforcustomerservicemanagementcsm-release-notes.md) | Conditional | Default provider/template changes; agent roles and custom skill configuration. |
| 295 | [Otto for Enterprise Architecture](delta-zurich-brazil/brazil-zurich-servicenowottoforenterprisearchitectureea-release-notes.md) | Conditional | Default-on AI, role masking/restrictions, provider and usage changes. |
| 296 | [Otto for Financial Services Operations](delta-zurich-brazil/brazil-zurich-servicenowottoforfinancialservicesoperationsfso-release-notes.md) | Conditional | ACL implementation, agent role requirements, default provider. |
| 297 | [Otto for FSM](delta-zurich-brazil/brazil-zurich-servicenowottoforfsm-release-notes.md) | Conditional | Agent access/model requirements and customized template/prompt handling. |
| 298 | [Otto for Hardware Asset Management](delta-zurich-brazil/brazil-zurich-servicenowottoforhardwareassetmanagementham-release-notes.md) | Conditional | Default-on agents, masking roles, procurement access and license prerequisite. |
| 299 | [Otto for HR Service Delivery](delta-zurich-brazil/brazil-zurich-servicenowottoforhrservicedeliveryhrsd-release-notes.md) | Conditional | Default-on HR skills, AI security/provider and case-routing behavior. |
| 300 | [Otto for IT Operations Management](delta-zurich-brazil/brazil-zurich-servicenowottoforitoperationsmanagementitom-release-notes.md) | Conditional | Default-on assets; removed/replaced analysis agents and alert workflows. |
| 301 | [Otto for IT Service Management](delta-zurich-brazil/brazil-zurich-servicenowottoforitservicemanagementitsm-release-notes.md) | Conditional | Archived Incident assist; default-on workflow; lost context-menu customization and roles. |
| 302 | [Otto for Legal Service Delivery](delta-zurich-brazil/brazil-zurich-servicenowottoforlegalservicedeliverylsd-release-notes.md) | Conditional | Default-on skills, role requirements, model/usage checks. |
| 303 | [Otto for Manufacturing Commercial Operations](delta-zurich-brazil/brazil-zurich-servicenowottoformanufacturingcommercialoperationsmco-release-notes.md) | Conditional | AI usage accounting and recall workflow access if used. |
| 304 | [Otto for Operational Sustainability](delta-zurich-brazil/brazil-zurich-servicenowottoforoperationalsustainabilitymanagementmanagement-release-notes.md) | Conditional | Default-on AI assets, required roles, usage and invoice extraction. |
| 305 | [Otto for Operational Technology Service Management](delta-zurich-brazil/brazil-zurich-servicenowottoforoperationaltechnologyotservicemanagement-release-notes.md) | Conditional | Default LLM changes and OT AI workflow behavior. |
| 306 | [Otto for Order Management](delta-zurich-brazil/brazil-zurich-servicenowottoforordermanagement-release-notes.md) | Conditional | AI usage and customer order/voice/handoff access if used. |
| 307 | [Otto for Platform Analytics](delta-zurich-brazil/brazil-zurich-servicenowottoforplatformanalytics-release-notes.md) | Conditional | Separate highlight page; default-on assets/usage and canonical analytics AI behavior. |
| 308 | [Otto for Retail Service Management](delta-zurich-brazil/brazil-zurich-servicenowottoforretailservicemanagementrsm-release-notes.md) | Conditional | AI usage and store-inquiry agent permissions. |
| 309 | [Otto for Sales Automation](delta-zurich-brazil/brazil-zurich-servicenowottoforsalesautomation-release-notes.md) | Conditional | Sales-agent prerequisite and AI usage accounting. |
| 310 | [Otto for Sales CRM Telecommunications](delta-zurich-brazil/brazil-zurich-servicenowottoforsalescustomerrelationshipmanagementfortelecommunications-release-notes.md) | Conditional | Agent ACL/role configuration and AI usage. |
| 311 | [Otto for Security Incident Response](delta-zurich-brazil/brazil-zurich-servicenowottoforsecurityincidentresponsesirsir-release-notes.md) | Conditional | Default-on large asset set/dependency updates; AI Search and role requirements. |
| 312 | [Otto for Setup](delta-zurich-brazil/brazil-zurich-servicenowottoforsetup-release-notes.md) | Feature | Guided required/optional app installation and entitlement verification. |
| 313 | [Otto for Software Asset Management](delta-zurich-brazil/brazil-zurich-servicenowottoforsoftwareassetmanagementsam-release-notes.md) | Conditional | Default-on AI/roles/provider changes; incomplete Australia upgrade text. |
| 314 | [Otto for Source-to-Pay Operations](delta-zurich-brazil/brazil-zurich-servicenowottoforsourcetopayoperations-release-notes.md) | Conditional | Default-on skills, supplier automation roles and AI usage/provider checks. |
| 315 | [Otto for Strategic Portfolio Management](delta-zurich-brazil/brazil-zurich-servicenowottoforstrategicportfoliomanagement-release-notes.md) | Conditional | Default-on agents/skills and project-insight email/access configuration. |
| 316 | [Otto for Telecommunications, Media, and Technology](delta-zurich-brazil/brazil-zurich-servicenowottofortelecommunicationsmediaandtechnologytmt-release-notes.md) | Conditional | Agent ACL/role requirements and AI usage across workflows. |
| 317 | [Otto for Third-party Risk Management](delta-zurich-brazil/brazil-zurich-servicenowottoforthirdpartyriskmanagementtprm-release-notes.md) | Conditional | Default-on skills/provider and AI usage; inspect TPRM migration separately. |
| 318 | [Otto for Vault](delta-zurich-brazil/brazil-zurich-servicenowottoforvault-release-notes.md) | Conditional | AI-assisted security administration; default-on workflows detailed in Vault note. |
| 319 | [Otto for Virtual Agent](delta-zurich-brazil/brazil-zurich-servicenowottoforvirtualagent-release-notes.md) | Conditional | Premium new-customer default, masking/LUIS changes, and NLU/channel deprecations. |
| 320 | [Otto for Workplace Service Delivery](delta-zurich-brazil/brazil-zurich-servicenowottoforworkplaceservicedeliverywsd-release-notes.md) | Conditional | AI usage and automated map/cleaning workflow access if used. |
| 321 | [Otto for Zero Copy Connector](delta-zurich-brazil/brazil-zurich-servicenowottoforzerocopyconnector-release-notes.md) | Conditional | Ask AI removed; connector AI capability/permission review. |
| 322 | [Otto in Platform Analytics](delta-zurich-brazil/brazil-zurich-servicenowottoinplatformanalytics-release-notes.md) | Conditional | Default-on Query Generation/export; protected-scope and domain limitations. |
| 323 | [ServiceNow Quote Experience](delta-zurich-brazil/brazil-zurich-servicenowquoteexperience-release-notes.md) | Feature | Contract/subscription/pricing integration; use owning pricing/CPQ notes. |
| 324 | [ServiceNow SDK](delta-zurich-brazil/brazil-zurich-servicenowsdk-release-notes.md) | Conditional | Windows reauthentication; removed commands/property conventions; build no longer packages. |
| 325 | [ServiceNow Studio](delta-zurich-brazil/brazil-zurich-servicenowstudio-release-notes.md) | Conditional | Summary agent off by default; removed tools/resources/switcher and deployment changes. |
| 326 | [ServiceNow Vault](delta-zurich-brazil/brazil-zurich-servicenowvault-release-notes.md) | Conditional | Default policies/AI workflows; elevation/provider and optional log-export setup. |
| 327 | [Service Observability](delta-zurich-brazil/brazil-zurich-serviceobservability-release-notes.md) | Conditional | Manager role also needs an srm-type user group; data-mapping integrations. |
| 328 | [Service Operations Workspace for ITSM](delta-zurich-brazil/brazil-zurich-serviceoperationsworkspaceforitsm-release-notes.md) | Now | Upgrade-instance redirection opt-in, installed versions and ITSM/ITOM compatibility. |
| 329 | [Service Portal](delta-zurich-brazil/brazil-zurich-serviceportal-release-notes.md) | Conditional | Per-portal authentication/identifier-first configuration; approvals and widget loading. |
| 330 | [Service Portfolio Management](delta-zurich-brazil/brazil-zurich-serviceportfoliomanagement-release-notes.md) | Feature | Small experience changes; owning portfolio/platform notes may still matter. |
| 331 | [Service Reliability Management](delta-zurich-brazil/brazil-zurich-servicereliabilitymanagement-release-notes.md) | Feature | SLO/notification/team governance and service removal behavior. |
| 332 | [Sidebar](delta-zurich-brazil/brazil-zurich-sidebar-release-notes.md) | Feature | Collaboration capability; no mandatory retrofit identified. |
| 333 | [Simplified IT Service Management](delta-zurich-brazil/brazil-zurich-simplifieditservicemanagement-release-notes.md) | Feature | New simplified requester/fulfiller experience and SOW redirection. |
| 334 | [Skills Foundation](delta-zurich-brazil/brazil-zurich-skillsfoundation-release-notes.md) | Conditional | Skills ontology/LinkedIn parsing removed; bring data and verify HR/SAP dependencies. |
| 335 | [Smart Assessment Engine](delta-zurich-brazil/brazil-zurich-smartassessmentengine-release-notes.md) | Conditional | Template versioning/retirement, hidden conditional questions, migration behavior. |
| 336 | [Software Asset Management](delta-zurich-brazil/brazil-zurich-softwareassetmanagement-release-notes.md) | Conditional | Customized workflow replacement, workspace/Store dependencies and Core UI loss. |
| 337 | [Source-to-Pay Operations Integrations](delta-zurich-brazil/brazil-zurich-sourcetopayoperationsintegrations-release-notes.md) | Conditional | On-demand sourcing migration job must run manually after upgrade. |
| 338 | [Sourcing and Procurement Operations](delta-zurich-brazil/brazil-zurich-sourcingandprocurementoperations-release-notes.md) | Conditional | Case closure waits for acceptance; quantities, email and purchasing workflow changes. |
| 339 | [SPM Enterprise-Wide Deployment](delta-zurich-brazil/brazil-zurich-spmenterprisewidedeployment-release-notes.md) | Conditional | Admin partition access restricted by default; configure/backfill existing records. |
| 340 | [SQL API](delta-zurich-brazil/brazil-zurich-sqlapi-release-notes.md) | Conditional | SOAP-to-REST/driver migration with RaptorDB entitlement; renamed Live Connect. |
| 341 | [Strategic Planning](delta-zurich-brazil/brazil-zurich-strategicplanning-release-notes.md) | Conditional | Migrated field filters, EAP roles/iteration behavior, financial and AI defaults. |
| 342 | [Strategic Spend Tracking for PPM](delta-zurich-brazil/brazil-zurich-strategicspendtrackingforppm-release-notes.md) | Watch | Brazil planned deprecation/hiding; verify exact target support. |
| 343 | [Stream Connect](delta-zurich-brazil/brazil-zurich-streamconnect-release-notes.md) | Feature | OAuth/SASL streaming capabilities; inspect Integration Hub/Hermes dependencies. |
| 344 | [Subscription Management](delta-zurich-brazil/brazil-zurich-subscriptionmanagement-release-notes.md) | Conditional | Update all instances for compatible usage accounting; allocation behavior differs by history. |
| 345 | [Supplier Lifecycle Operations](delta-zurich-brazil/brazil-zurich-supplierlifecycleoperations-release-notes.md) | Conditional | Supplier Operations plugin required after upgrade; supplier AI/provider changes. |
| 346 | [Synthetic Monitoring](delta-zurich-brazil/brazil-zurich-syntheticmonitoring-release-notes.md) | Conditional | MID restart required for MID-based locations; monitor/credential changes. |
| 347 | [System Localization](delta-zurich-brazil/brazil-zurich-systemlocalization-release-notes.md) | Feature | Locale/date settings move; optional new language pack. |
| 348 | [Table Builder](delta-zurich-brazil/brazil-zurich-tablebuilder-release-notes.md) | Conditional | Read-only option replaces editable legacy field; Form Designer lifecycle. |
| 349 | [Talent Profile](delta-zurich-brazil/brazil-zurich-talentprofile-release-notes.md) | Feature | Pool/profile management capabilities. |
| 350 | [Telecommunication Network Inventory](delta-zurich-brazil/brazil-zurich-telecommunicationnetworkinventory-release-notes.md) | Conditional | Separate older page: query_range access and inventory model review. |
| 351 | [Telecommunications Customer 360](delta-zurich-brazil/brazil-zurich-telecommunicationscustomer360-release-notes.md) | Conditional | Default LLM, recommended-action and customer-history behavior. |
| 352 | [Telecommunications Network Inventory](delta-zurich-brazil/brazil-zurich-telecommunicationsnetworkinventory-release-notes.md) | Conditional | Standard roles lose TNI read access on installs and upgrades; review roles/dependencies. |
| 353 | [Telecommunications Service Operations Management](delta-zurich-brazil/brazil-zurich-telecommunicationsserviceoperationsmanagementtsom-release-notes.md) | Conditional | Replaced ETLs/audit; granular roles and connector polling/metric constraints. |
| 354 | [Theme Builder](delta-zurich-brazil/brazil-zurich-themebuilder-release-notes.md) | Feature | Coral publication is explicit for applicable upgraded instances; branding/UI regression. |
| 355 | [Third-party Risk Management](delta-zurich-brazil/brazil-zurich-thirdpartyriskmanagement-release-notes.md) | Conditional | Irreversible SAE; sequential upgrades; role/data migration; removed scoring/entity behavior. |
| 356 | [Threat Intelligence Security Center](delta-zurich-brazil/brazil-zurich-threatintelligencesecuritycenter-release-notes.md) | Conditional | Correlation rule removal/threshold; property rename and feed mapping. |
| 357 | [UI Builder](delta-zurich-brazil/brazil-zurich-uibuilder-release-notes.md) | Conditional | Custom component/page testing; Australia upgrade section is a placeholder. |
| 358 | [Unified Security Exposure Management](delta-zurich-brazil/brazil-zurich-unifiedsecurityexposuremanagement-release-notes.md) | Conditional | Separate migration page; major architecture/data/rule migration, not automatic rebranding. |
| 359 | [Unified Security Exposure Management (USEM)](delta-zurich-brazil/brazil-zurich-unifiedsecurityexposuremanagementusem-release-notes.md) | Conditional | Migration assistant, integration/version boundaries; permanent SBOM cleanup and ITSM dependency. |
| 360 | [Universal Request](delta-zurich-brazil/brazil-zurich-universalrequest-release-notes.md) | Feature | Router/inter-department capabilities; inspect APO/SPO routing changes if used. |
| 361 | [Upgrade Console](delta-zurich-brazil/brazil-zurich-upgradeconsole-release-notes.md) | Watch | Production preparation step removed; console is not a substitute for this checklist. |
| 362 | [Usage Insights](delta-zurich-brazil/brazil-zurich-usageinsights-release-notes.md) | Feature | Xanadu-only support warning is baseline-outside-scope; export/analytics features. |
| 363 | [Virtual Agent](delta-zurich-brazil/brazil-zurich-virtualagent-release-notes.md) | Watch | Thin local topic; canonical Otto/NAVA pages describe channel/NLU/legacy lifecycle. |
| 364 | [Visa Spoke](delta-zurich-brazil/brazil-zurich-visaspoke-release-notes.md) | Conditional | Authentication Program field removed without replacement; parser/response changes. |
| 365 | [Vulnerability Response](delta-zurich-brazil/brazil-zurich-vulnerabilityresponse-release-notes.md) | Conditional | USEM/v30 boundary; integration backfills; rerun property and field migration. |
| 366 | [VR Integration with Claroty CTD](delta-zurich-brazil/brazil-zurich-vulnerabilityresponseintegrationwithclarotyctd-release-notes.md) | Watch | Hidden/no new installation; existing support retained. |
| 367 | [Walk-up Experience](delta-zurich-brazil/brazil-zurich-walkupexperience-release-notes.md) | Feature | Thin local change; CSM-specific Store migration is in the omnichannel note. |
| 368 | [Workforce Optimization for CSM](delta-zurich-brazil/brazil-zurich-workforceoptimizationforcsm-release-notes.md) | Conditional | Manager dashboard decoupling/dependencies and calendar/channel access changes. |
| 369 | [Workforce Optimization for Customer Service CSM](delta-zurich-brazil/brazil-zurich-workforceoptimizationforcustomerservicecsm-release-notes.md) | Feature | Separate thin topic; use Workforce Optimization for CSM page. |
| 370 | [Zero Copy Connector for ERP](delta-zurich-brazil/brazil-zurich-zerocopyconnectorforerp-release-notes.md) | Conditional | Scheduled Extraction V2 Move; AI role access/provider and source prerequisites. |
| 371 | [Zero Copy Connector Hub](delta-zurich-brazil/brazil-zurich-zerocopyconnectorhub-release-notes.md) | Feature | Primary connector/data-fabric capabilities; inspect source-specific integrations. |
| 372 | [Zero Copy Connectors](delta-zurich-brazil/brazil-zurich-zerocopyconnectors-release-notes.md) | Conditional | df_connection_admin/data-steward access; personal OAuth/REST and connector status. |
| 373 | [Zing Text Indexing and Search](delta-zurich-brazil/brazil-zurich-zingtextindexingandsearchengine-release-notes.md) | Now | v3/v4 query_range ACL enforcement can change or suppress search results. |

Supporting files reviewed: [Catalog index](delta-zurich-brazil/index.md) and [Combined introduction](delta-zurich-brazil/rn-combined-intro.md). They identify the corpus; they are not additional product changes.

</details>