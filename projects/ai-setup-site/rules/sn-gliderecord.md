# ServiceNow GlideRecord Performance Rules

1. **Counting**: Always use `GlideAggregate` (`ga.addAggregate('COUNT')`) for counting records. Never use `gr.getRowCount()`.
2. **Loop Values**: Always use `gr.getValue('column_name')` inside loops when storing values in arrays or objects. Never push raw `gr.field` or `gr.sys_id` pointers.
3. **Query Safety**: Always check if filter variables are defined before passing them to `addQuery()`. Never pass `undefined` or `null`.
4. **Query Limits**: Always use `gr.setLimit(N)` on large tables (`task`, `syslog`, `sys_audit`, `cmdb_ci`).
5. **Encoded Queries**: Prefer `addEncodedQuery()` over long chains of `addQuery()` and `addOrCondition()`.
