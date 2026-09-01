# ServiceNow Development & Performance Best Practices

Based on official ServiceNow GTS Performance Team and Community Development Standards, all ServiceNow code must follow these rules:

---

## 1. Database & GlideRecord Performance

### ⚡ Use `GlideAggregate` for Counting (Never `getRowCount()`)
`getRowCount()` instantiates every single record object in memory before counting. Use `GlideAggregate` for $O(1)$ database-level counting:
```javascript
// ❌ BAD:
var gr = new GlideRecord('incident');
gr.addQuery('active', true);
gr.query();
var count = gr.getRowCount(); // High memory overhead

// ✅ GOOD:
var ga = new GlideAggregate('incident');
ga.addQuery('active', true);
ga.addAggregate('COUNT');
ga.query();
var count = 0;
if (ga.next()) {
    count = ga.getAggregate('COUNT');
}
```

### ⚡ Always Extract Primitive Values (`getValue()`)
In loops, `gr.field` returns a reference to the same `GlideElement` object. Always use `getValue()`:
```javascript
// ❌ BAD: Stores pointers to the same last record
while (gr.next()) { list.push(gr.sys_id); }

// ✅ GOOD: Stores primitive strings
while (gr.next()) { list.push(gr.getValue('sys_id')); }
```

### ⚡ Guard Against `null` / `undefined` in Queries
Passing `undefined` to `addQuery` can result in unexpected full-table scans:
```javascript
// ❌ BAD:
gr.addQuery('assigned_to', myUserId); // If myUserId is undefined, queries incorrectly

// ✅ GOOD:
if (myUserId) {
    gr.addQuery('assigned_to', myUserId);
}
```

### ⚡ Always Use `setLimit()` on Large Tables
When inspecting or testing queries on large tables (`syslog`, `sys_audit`, `task`, `metric_instance`), always restrict result sets:
```javascript
gr.setLimit(50);
```

---

## 2. Business Rules & Execution Boundaries

### 🚫 Never Call `current.update()` in `before` Rules
Calling `current.update()` in a `before` business rule triggers the engine recursively:
```javascript
// ❌ BAD (in before business rule):
current.priority = 1;
current.update(); // Recursion hazard

// ✅ GOOD:
current.priority = 1; // Engine persists changes automatically
```

### ⚡ Use Async Business Rules for Heavy Tasks
Move external API calls, complex calculations, and notifications to **Async** rules so the end-user's browser does not block waiting for the transaction.

### ⚡ Use `g_scratchpad` to Eliminate Client-Side Server Calls
Pass server data to the client during form load using a `display` Business Rule instead of making round-trip `GlideAjax` requests on `onLoad`:
```javascript
// Display Business Rule:
g_scratchpad.userLocation = current.caller_id.location.getDisplayValue();
```

---

## 3. Client-Side Scripting

1. **Prefer UI Policies**: Use declarative UI Policies for mandatory, read-only, and visibility rules. Only use Client Scripts for complex logic.
2. **Never Use Synchronous `GlideAjax` or `getReference()` without Callbacks**: Always use asynchronous `getXMLAnswer(callback)` to keep the browser responsive.
3. **No Direct DOM Manipulation**: Do not use `document.getElementById` or `window.$`. Always use `g_form` APIs for upgrade safety.
4. **No Global Client Scripts**: Target specific tables.

---

## 4. Code Hygiene & System Properties

1. **No Hardcoded `sys_id`s**: Store configurable sys_ids in System Properties (`gs.getProperty('x_app.default_group')`).
2. **No `eval()`**: Strict prohibition against `eval()` or `new Function()`.
3. **Structured Logging**: Use `gs.info()`, `gs.warn()`, `gs.error()` with clear prefixes (e.g. `[IncidentUtils] ...`), and remove debug logs before promoting Update Sets.
