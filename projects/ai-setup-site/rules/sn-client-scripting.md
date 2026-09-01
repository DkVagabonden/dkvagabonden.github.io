# ServiceNow Client Scripting Best Practices

1. **Prefer UI Policies**: Use declarative UI Policies for mandatory, read-only, and visible field attributes. Only use Client Scripts for complex validation or logic.
2. **Asynchronous GlideAjax**: Always use asynchronous `GlideAjax` with `getXMLAnswer(callback)`. Never make synchronous server calls from client scripts.
3. **No Direct DOM Manipulation**: Do not use `document.getElementById`, `window.$`, or direct DOM access. Always use official `g_form` APIs for upgrade compatibility.
4. **No Global Client Scripts**: Always target specific tables to avoid slowing down form loads across the platform.
