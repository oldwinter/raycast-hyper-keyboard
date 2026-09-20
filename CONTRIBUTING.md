# Contributing

This is a Raycast extension. Command views live in `src/`, parsers in `src/data/`, and Vitest files in `tests/`.

## Checks

```bash
npm test
npm run typecheck
```

`npm run lint` and `npm run build` invoke the Raycast CLI, which may write `~/.config/raycast`. Prefer the two commands above in sandboxes.

`npm run preview` needs `vite-node`, which is not a locked dependency. Do not treat a missing `vite-node` as a product failure.

## Scope

Do not add a default Canvas path under `oldwinter-notes`. Users set Preferences → Canvas File. Keep shortcut merge tests green when changing loaders.
