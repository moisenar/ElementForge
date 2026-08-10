# Element Forge source

This is the standalone source for Element Forge. It contains only the visual page-builder system; the original project's public site, admin dashboard, assets, and shared-site components are intentionally excluded.

## Runtime entry

- `main.tsx` starts Element Forge directly and initializes the local session before rendering the editor.
- `editor/` contains the editor UI, DOM tree, browser-style element inspector, canvas renderer, storage, and styling helpers.

Run the standalone app from the repository root with `npm run dev`, then open `/?editor=true&page=home`.

## Related instructions

- [`../README.md`](../README.md) — human-facing Element Forge overview and installation guide.
- [`../ai-readme.md`](../ai-readme.md) — AI-oriented implementation instructions.
- [`../docs/architecture.md`](../docs/architecture.md) — runtime flow and module ownership.
- [`editor/README.md`](editor/README.md) — editor-specific responsibilities and data model.
