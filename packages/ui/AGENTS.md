# @umamin/ui

The shared design system for `apps/web` and `apps/org`: shadcn components on
Radix, Tailwind v4, and the global stylesheet. Apps import from source through
the subpath exports (`@umamin/ui/components/*`, `@umamin/ui/lib/*`,
`@umamin/ui/hooks/*`, `@umamin/ui/globals.css`); there is no build step.

```sh
pnpm --filter=@umamin/ui check-types
pnpm --filter=@umamin/ui test
```

## Rules

- The package is `"type": "module"` on `moduleResolution: NodeNext`, so
  relative imports inside it need an explicit `.js` extension (TS2835).
- Apps should use the shared `<Button>` instead of a plain `<button>` for focus
  and accessibility styles. Its `[&_svg]:size-4` rule shrinks any icon inside
  it, so set an explicit size class on icons that must be larger.
- `cn` in `src/lib/utils.ts` is `cnfast`, not `twMerge(clsx(...))`. Same
  signature and output, several times faster on this repo's classes. Its merge
  tables are what can drift between versions. Before bumping `cnfast`, diff its
  output against `twMerge(clsx(...))` over class strings taken from the repo's
  `.tsx` files. `utils.test.ts` pins the Tailwind v4 groups in use.
- `react` and the `@types/react*` packages must match every other workspace
  (see the root `AGENTS.md`). Radix binds to the React this package resolves.

## Adding a component from the shadcn registry

Registry code needs adapting before it fits here:

- Rewrite `@/...` imports to `@umamin/ui/...` (or relative `.js` imports).
- Use `@radix-ui/react-slot` for `asChild`.
- If a component sets `data-slot`, put it after `{...props}`. A parent
  `asChild` trigger (for example `PopoverTrigger`) otherwise overrides it, and
  any styling keyed on that slot disappears. `bubble.tsx` had this bug.
- Remove utilities the app's CSS doesn't define, and check the component at
  phone width in a real page.
