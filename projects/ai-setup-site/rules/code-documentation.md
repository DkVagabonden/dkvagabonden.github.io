# Code Documentation Standards

Use documentation to explain intent, constraints, and non-obvious behavior. Keep it current with the code.

## JSDoc and Docstrings

Add a concise JSDoc block or docstring for public APIs, exported functions, complex helpers, and code with non-obvious inputs, outputs, or side effects.

Document:

- Purpose and business context when it is not evident from the name
- Parameters and return values when the types or valid values are unclear
- Intentional errors or failure conditions
- Important assumptions, permissions, or data boundaries

Use examples only when they clarify a non-trivial API or workflow. Do not add repetitive comments that merely restate the code.

## Full JSDoc Mode

Use full JSDoc when a project explicitly requires it, or when code is a shared library, public API, reusable utility, integration boundary, or security-sensitive workflow.

For each public function or method, include:

- A one-sentence summary
- `@param` for each parameter with type and purpose
- `@returns` with the returned type and meaning
- `@throws` for intentional errors
- `@example` when a caller could misuse a non-trivial API

Do not require full JSDoc for short private helpers whose names, inputs, and outputs are already obvious. A project may adopt full JSDoc for every function, but it should state that choice in its repository instructions rather than assuming it everywhere.

## ServiceNow Script Context

For ServiceNow scripts, document the execution context when it affects safe use:

- Business Rules: table, timing, trigger, and condition
- Client Scripts: trigger field, UI context, and server calls
- Script Includes: public methods and whether they are client-callable
- Integrations: authentication boundary, payload assumptions, and failure behavior

## Inline Comments

Comment complex decisions, regular expressions, non-obvious query logic, and security or performance tradeoffs. Explain why the code exists, not only what each line does.
