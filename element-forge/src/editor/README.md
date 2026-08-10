# Element Forge editor

This folder contains Element Forge's local React page editor with no editor-library dependency. It is the complete extracted system; it does not depend on the parent site's `Site.tsx`, `admin/`, `assets/`, or `component/` folders.

## Responsibilities

- Add Heading, Text, Button, Container, Image, and HTML/CSS components from the Components palette.
- Add native DOM elements from the Elements palette.
- HTML/CSS components use HTML and CSS source editors, rendered directly inside their component container and reflected in the live DOM tree.
- Upload image resources from the Resources tab, then drag them to create Image components. Clicking a resource opens its action menu, including non-destructive cropping.
- Drag components onto the root canvas or into a Container.
- Move components between drop zones.
- Select a component and edit its content and layout in the Inspector. Containers can optionally scroll their content horizontally and/or vertically.
- Add scoped CSS declarations to an individual component from the expandable CSS style section.
- Give components class names in Advanced. Container Advanced settings import HTML and CSS together once while preserving the source DOM and complete stylesheet for visual parity.
- Inspect the browser-rendered DOM tree, including native tags, classes, attributes, dimensions, computed styles, and nested child structure.
- Use the Element inspector for DOM-specific editing and the Component inspector for reusable component options.
- Save a selected component as a reusable snapshot; it appears under its component type in the Components menu.
- Save and load sessions through the local `/api/session` endpoint, with browser `localStorage` as a fallback.
- Render the same document through the standalone canvas renderer.

## Files

- `Editor.tsx` — editor screen, palettes, canvas, live browser DOM tree, inspectors, drag-and-drop handling, and component removal.
- `PageRenderer.tsx` — document-to-HTML renderer retained for previews and integrations; the standalone entry renders `Editor.tsx` directly.
- `types.ts` — document, node, component, and layout TypeScript types; also creates new default nodes.
- `document.ts` — immutable tree helpers for finding, inserting, updating, removing, and validating nested nodes.
- `storage.ts` — session endpoint loading/saving with browser storage fallback for documents, image resources, and reusable components.
- `editor.css` — three-panel editor layout and all editor-specific styles.

## Data model

An `EditorDocument` has root-level `nodes`. Every node has a unique `id`, a `type`, editable `props`, and `children`. Only Container nodes currently render child nodes, although all nodes use the same tree shape for simpler updates.

Layout values are stored as CSS-compatible strings, such as `50%`, `24px`, `flex`, or `1fr 1fr`.

## Related instructions

- [`../../README.md`](../../README.md) — human-facing Element Forge overview, features, and installation.
- [`../../ai-readme.md`](../../ai-readme.md) — AI-oriented implementation rules and safe modification guidance.
- [`../../docs/architecture.md`](../../docs/architecture.md) — standalone runtime and module map.
- [`../README.md`](../README.md) — source entry and extraction boundary.
