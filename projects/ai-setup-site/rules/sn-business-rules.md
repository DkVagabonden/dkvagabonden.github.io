# ServiceNow Business Rules Best Practices

1. **No `current.update()` in `before` Rules**: Never call `current.update()` in a `before` business rule; modify fields on `current` directly (`current.state = 2;`).
2. **Async for Heavy Loads**: Move external API integrations, notifications, and heavy data computations into **Async** business rules to avoid blocking the user's browser.
3. **`g_scratchpad`**: Pass server data to the client during form load via `display` Business Rules instead of making `onLoad` Ajax requests.
4. **Header Documentation**: Every business rule script must include a header comment stating target table, execution timing (`when`), insert/update triggers, and condition logic.
