# Element Forge architecture

Element Forge is an editor-only React application extracted from the parent Japanese Style project.

```text
element-forge/index.html
  -> src/main.tsx
  -> src/editor/Editor.tsx
       -> src/editor/storage.ts
       -> src/editor/document.ts
       -> src/editor/PageRenderer.tsx
       -> src/editor/nodePresentation.ts
       -> src/editor/types.ts
```

## Editor responsibilities

- `Editor.tsx` owns the three-panel builder, component and DOM-element palettes, drag/drop, canvas selection, live browser DOM tree, element inspector, and component inspector.
- `PageRenderer.tsx` provides the same document-to-HTML rendering logic for future read-only previews.
- `storage.ts` loads the first available session from `/api/session`, then falls back to browser storage when the endpoint is unavailable. Saves are written to the local session endpoint when available.
- `document.ts` performs immutable tree operations.
- `types.ts` defines the persisted document model.
- `nodePresentation.ts` generates scoped classes, CSS, and layout styles.
- `editor.css` contains the Element Forge interface styles.

## Session file

The standalone Vite middleware stores the session at `element-forge/session/session.json`. The session directory and save file are created only when the first save is made. Do not commit that file; it is user data, not source code.

## URL

Use `/?editor=true&page=home` for the editor. The `page` query parameter selects the saved page identifier.

## Related instructions

- [`../README.md`](../README.md) — human-facing product overview and installation.
- [`../ai-readme.md`](../ai-readme.md) — AI-oriented implementation instructions.
- [`../src/README.md`](../src/README.md) — source entry and extraction boundary.
- [`../src/editor/README.md`](../src/editor/README.md) — editor-specific behavior and data model.
