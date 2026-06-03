# chat

Vite + React app in the umamin monorepo. Shares the design system and components from `@umamin/ui` and the repo-wide Tailwind v4 theme.

## Develop

```bash
pnpm --filter=chat dev
```

Runs from the repo root through Turborepo:

```bash
pnpm dev          # all apps
pnpm build        # build all apps (chat outputs to dist/)
pnpm check-types  # tsc across the workspace
```

## Notes

- UI primitives come from `@umamin/ui` (e.g. `@umamin/ui/components/button`). Add new shared components in `packages/ui`, not here.
- Styling uses the shared theme via `@import "@umamin/ui/globals.css"` in `src/index.css`.
- React Compiler is enabled through `@vitejs/plugin-react` + `@rolldown/plugin-babel`.
- Formatting and linting are handled repo-wide by Biome (`pnpm format-and-lint`).
