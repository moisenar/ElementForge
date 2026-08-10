# Element Forge — AI Implementation Guide

This document is the machine-oriented companion to [`README.md`](README.md). Read it before modifying Element Forge. The regular README is written for humans, search engines, and generative-engine discovery; this file emphasizes implementation boundaries, runtime behavior, invariants, and safe change locations.

## Instruction files to read

Read these maintained Markdown files when their scope is relevant:

- [`README.md`](README.md) — product overview, user-facing behavior, installation, and feature vocabulary.
- [`src/README.md`](src/README.md) — standalone source entry and extraction boundary.
- [`src/editor/README.md`](src/editor/README.md) — editor feature responsibilities, files, and persisted data model.
- [`docs/architecture.md`](docs/architecture.md) — runtime flow, module ownership, and session file behavior.

Use this file for implementation invariants and safe change rules; use the subfolder documents for local module context. If a change crosses module boundaries, update all affected instruction files.

## Identity

- Product name: **Element Forge**.
- Purpose: visual React editor for component trees, native DOM elements, rendered DOM inspection, and HTML/CSS-backed DOM creation.
- Standalone root: repository root (`ElementForge/`).
- Standalone entry: `src/main.tsx`.
- Main implementation: `src/editor/Editor.tsx`.
- The parent site's `src/Site.tsx`, `src/admin/`, `src/assets/`, and `src/component/` are not part of the extracted system.

## Run and verify

```powershell
npm install
npm run dev
```

Editor URL:

```text
http://localhost:<vite-port>/?editor=true&page=home
```

Verification commands:

```powershell
npm run lint
npm run build
```

Do not treat a successful TypeScript check as sufficient for UI changes. For DOM tree, inspector, canvas, or cursor changes, verify the rendered editor and exercise selection, expansion, collapse, drag/drop, and switching between preview and edit modes.

## System map

```text
src/main.tsx
  -> initializeSession()
  -> <Editor pageId={...} />

Editor.tsx
  -> Components palette
  -> DOM Elements palette
  -> CanvasNode / CanvasDropZone
  -> LiveDomTree
  -> ElementInspector or component Inspector
  -> storage.ts

storage.ts
  -> GET /api/session
  -> POST /api/session
  -> localStorage fallback
```

## Feature ownership

### Component system

Component definitions and palette behavior are in `src/editor/Editor.tsx`. The persisted type union is in `src/editor/types.ts`.

Component types currently include:

```text
heading | text | container | image | button | html | element
```

Reusable component snapshots use `UniqueComponent` and are persisted with the document session.

### DOM Elements palette

Native DOM element definitions are held in `domElementDefinitions` in `Editor.tsx`. `createDomElement()` creates an editor node with `type: "element"`. `canContainChildren()` and `voidDomTags` enforce basic nesting behavior.

Do not convert a DOM element palette click into a generic container. The tag must remain the selected native tag, and the node must remain `type: "element"` unless there is an explicit migration requirement.

### Canvas renderer

Canvas rendering is implemented in `Editor.tsx`; shared document-to-HTML rendering is in `PageRenderer.tsx`.

- Container nodes render `.container-content`.
- Native editor elements render their actual `node.tag`.
- HTML/CSS nodes render `.html-css-content` with a source `<style>` and `dangerouslySetInnerHTML` content.
- Canvas wrappers receive `editor-node-<id>` classes so live browser nodes can map back to persisted editor nodes.

### Live DOM tree

`LiveDomTree` queries `.editor-canvas-panel .editor-page-root` and inspects the browser DOM using:

- `querySelector`
- `children`
- `attributes`
- `getComputedStyle`
- `getBoundingClientRect`
- `MutationObserver`
- `ResizeObserver`

`inspectCanvasWrapper()` removes editor-only wrappers from the visible hierarchy and exposes the rendered child elements. `inspectElement()` recursively creates `LiveDomItem` records.

Important invariants:

- The live tree must describe rendered DOM, not just `EditorDocument` nodes.
- React keys must be stable and unique across the whole live tree. Use deterministic traversal paths or another stable identity; never use only tag name, coordinates, or class names.
- Observer refreshes must be debounced or ignored when the structural tree has not changed.
- Expansion state is keyed by the stable `LiveDomItem.key`.
- Invalid live data must not crash the entire editor. Keep the boundary/recovery behavior around the live tree.

### DOM element viewer

`ElementInspector` is the DOM-oriented edit panel. It is selected when `liveDomSelection` exists or when the selected persisted node has `type: "element"`.

The component inspector must not replace the Element inspector for a live DOM selection. Imported HTML/CSS is read-only at the source-managed element level; editor-created native elements can expose editable tag, class, text, CSS, and attributes as supported by the model.

### HTML/CSS DOM creator

HTML/CSS source is stored on an `html` node in `node.props.html` and `node.props.css`. The browser renders it in the canvas. The live DOM tree then inspects the actual generated structure.

When modifying this feature:

1. Preserve the source HTML/CSS.
2. Render it in the canvas.
3. Keep imported children mapped as native element nodes where the model supports that conversion.
4. Ensure the live tree reads the browser result after render.
5. Do not assume a source HTML tree and browser DOM tree are identical; browser parsing can normalize markup.

## Persistence

`src/editor/storage.ts` owns persistence.

- First, `initializeSession()` requests `GET /api/session`.
- A valid version-1 snapshot is normalized and loaded.
- Saves use `POST /api/session` when the local Vite middleware is available.
- Browser `localStorage` remains the fallback.
- The local save file is `session/session.json` and is ignored by Git.

Do not place session data, screenshots, or generated user content in source files.

## Safe modification guide

| Change | Primary file(s) |
|---|---|
| Add a component palette item | `src/editor/Editor.tsx`, `src/editor/types.ts` |
| Add a native HTML element | `src/editor/Editor.tsx`, `src/editor/types.ts`, renderer logic |
| Change DOM tree display | `src/editor/Editor.tsx`, `src/editor/editor.css` |
| Change element inspection fields | `src/editor/Editor.tsx` |
| Change HTML/CSS import/rendering | `src/editor/Editor.tsx`, `src/editor/storage.ts`, `src/editor/PageRenderer.tsx` |
| Change persistence/session behavior | `src/editor/storage.ts`, `vite.config.ts` |
| Change layout or visual styling | `src/editor/editor.css`, `src/editor/nodePresentation.ts` |
| Change app startup | `src/main.tsx`, `index.html` |

## Common failure modes

- **Element click creates a container:** verify `createDomElement()` produces `type: "element"` and preserves `definition.tag`.
- **Component editor opens for a DOM selection:** verify `liveDomSelection` is checked before `selectedNode` in the right-panel render branch.
- **Second DOM-tree expansion crashes:** inspect React keys, observer refresh frequency, recursive child data, and the live-tree error boundary.
- **Imported HTML is missing from the tree:** verify the `.html-css-content` selector and the rendered child root structure.
- **Session does not load:** check `GET /api/session`, `session/session.json`, snapshot version, and normalization.
- **Build fails with `EPERM` in `node_modules`:** this is an environment write-permission issue; run the build with a writable dependency cache or approved permissions, then rerun the actual build.

## Documentation rule

If an implementation path, module responsibility, URL, session behavior, or feature boundary changes, update this file and the human-facing `README.md` in the same change. Use paths relative to the repository root in this document.
