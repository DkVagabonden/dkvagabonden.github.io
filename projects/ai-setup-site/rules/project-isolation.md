# Project Isolation Rules

Keep projects isolated so changes remain understandable, testable, and safe to deploy.

1. **Independent ownership**: Each project owns its source code, dependencies, configuration, tests, and documentation.
2. **Explicit working directory**: Confirm the target project before running commands, installing packages, or creating files.
3. **Secrets stay local**: Keep credentials, tokens, instance exports, and environment-specific values outside source control and outside unrelated projects.
4. **Local customization**: A project may include its own AI instructions, rules, or skills for domain-specific guidance.
5. **No hidden coupling**: Do not rely on sibling projects, shared local paths, or undeclared tools unless the project documents that dependency.
