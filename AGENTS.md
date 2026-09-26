# AGENTS.md

Personal Raycast extension that renders configured Hyper (`⌃⌥⇧⌘`) shortcuts as a visual macOS keyboard.

- Every data source stays read-only: the Raycast cloud-sync settings snapshot, the Obsidian Canvas, and custom JSON. Merge order and override semantics are defined in README → Data sources; keep README in step when they change.
- A missing or stale source is an expected state: render what is available and surface a warning with a next step, never an error screen.
- Shortcut data stays local; the only network use is downloading image URLs already present in the Canvas.
- Verify: `npm test && npm run typecheck && npm run lint && npm run build`; for rendering changes also `npm run preview`.
