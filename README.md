# Element Forge — Visual DOM and Component Editor

Element Forge is a **React-based**, browser-based visual web editor for building, inspecting, and editing component-driven pages and their real rendered DOM. Built with React, TypeScript, and Vite, it combines a drag-and-drop component system with a native DOM element library, a live DOM tree, browser-style element inspection, and HTML/CSS-to-DOM creation.

It is designed for developers, designers, educators, and AI-assisted workflows that need to understand how page structure, styles, components, and rendered browser elements relate to one another.

## Technology stack

- **React** — interactive editor interface and component rendering.
- **TypeScript** — typed document model, editor state, and DOM inspection logic.
- **Vite** — fast local development server and production bundling.
- **Browser DOM APIs** — live DOM inspection, computed styles, dimensions, mutation tracking, and resize tracking.

> Looking for instructions intended for an AI coding agent? Read [`ai-readme.md`](ai-readme.md) first.

## What Element Forge does

Element Forge provides a visual editing environment with three connected layers:

1. **Components** — reusable page-building blocks such as headings, text, buttons, containers, images, and HTML/CSS components.
2. **DOM elements** — native HTML elements such as `header`, `nav`, `section`, `div`, `a`, `button`, `form`, `input`, `textarea`, and more.
3. **The rendered browser DOM** — the actual DOM produced in the canvas, inspected through browser APIs rather than only through the editor's data model.

This makes it possible to move from a high-level component to its native HTML structure, inspect the browser's computed result, and edit the appropriate layer without confusing components with DOM elements.

## Core features

### Component system

The Components panel contains draggable and clickable building blocks. Components can be placed at the page root or nested inside compatible containers. A component can be selected, moved, styled, deleted, and saved as a reusable component snapshot.

Supported component types include:

- Headings and text elements.
- Buttons and links.
- Containers with nested children.
- Images and image resources.
- HTML/CSS components for custom markup and styles.

The component editor exposes component-level content, layout, CSS, hover/active/focus states, class names, and other options according to the selected component.

### DOM elements

The Elements tab exposes native HTML tags as individually draggable elements. Each element is represented as a real DOM-oriented editor node, rather than being silently converted into a generic container.

Elements are grouped by purpose:

- Structure: `div`, `section`, `header`, `nav`, `main`, `footer`, `article`, and `aside`.
- Content: headings, paragraphs, spans, emphasis, images, and related tags.
- Interactive: links, buttons, details, and summaries.
- Forms: forms, labels, inputs, textareas, and selects.

Elements can be nested when the HTML tag supports children. Void elements such as `img` and `input` are treated as childless elements.

### Live DOM tree

The DOM tab reads the rendered canvas using the browser's DOM APIs. It shows the structure that actually exists in the page, including:

- Native tag names.
- Classes and IDs.
- Text content.
- HTML attributes.
- Nested child elements.
- Display and position information.
- Rendered dimensions.
- Selected computed CSS values.

The tree is refreshed when the rendered canvas changes and uses a stable DOM traversal identity so expanding and collapsing nodes does not depend on changing layout coordinates or class names.

### DOM element viewer and inspector

Selecting an item in the DOM tree opens the Element viewer in the Edit panel. The viewer is intentionally separate from the Component inspector.

The Element viewer can show:

- The live rendered tag.
- Browser-detected attributes.
- Computed styles.
- Rendered size and position.
- Class and text information.
- Authored CSS for editor-owned elements.

Imported or source-managed HTML is inspected as live browser output and is protected from accidental source edits. Elements created directly in the editor expose editable tag, class, text, CSS, and relevant attributes.

### HTML/CSS DOM tree creator

HTML/CSS components let you paste or write markup and styles together. Element Forge renders the HTML in the canvas, applies the CSS, and reads the resulting browser DOM for the DOM tree and Element viewer.

This workflow is useful for importing an existing header, navigation bar, landing-page section, or complete component reference:

1. Add an HTML/CSS component.
2. Enter the HTML structure and CSS rules.
3. Render the source in the canvas.
4. Inspect the resulting native DOM tree.
5. Compare tags, nesting, attributes, computed styles, dimensions, and visual behavior.

The creator preserves the source markup for visual fidelity while exposing its browser-rendered structure for inspection. It does not claim to replace the browser's own DevTools; it provides an editor-integrated view of the same rendered DOM concepts.

### Editor behavior

Element Forge supports two interaction modes:

- **Preview cursor** — interact with links and controls as a normal page visitor.
- **Edit cursor** — select components or rendered DOM elements and open their appropriate inspector.

The canvas supports root-level and nested drag-and-drop, selection, moving, deletion, zoom controls, responsive layout behavior, and visual feedback for drop targets. The DOM tree selection and canvas selection remain distinct so a live element can be inspected without incorrectly opening the component-only editor.

## Installation

### Requirements

- Node.js with npm.
- A modern browser with standard DOM, `MutationObserver`, `ResizeObserver`, and CSSOM support.

### Install and run locally

From the repository root:

```powershell
npm install
npm run dev
```

Open the URL printed by Vite. The editor route is:

```text
/?editor=true&page=home
```

The `page` query parameter identifies the page document being edited.

### Production build

```powershell
npm run build
npm run preview
```

## Saving and sessions

Element Forge checks for an existing session save when it starts. When the local session endpoint is available, it loads and saves the session at:

```text
session/session.json
```

The session directory and file are created on first save. Session data includes page documents, resources, reusable components, and the save timestamp. The session file is local user data and should not be committed.

If the local session endpoint is unavailable, the editor falls back to browser `localStorage` so editing remains usable in static or embedded environments.

## Project structure

```text
ElementForge/
├── README.md                 Human and SEO/GEO-friendly introduction
├── ai-readme.md              AI-oriented implementation guide
├── docs/
│   └── architecture.md       Runtime and module architecture
├── src/
│   ├── main.tsx              Standalone Element Forge entry point
│   └── editor/
│       ├── Editor.tsx        Main editor, canvas, palettes, tree, and inspectors
│       ├── PageRenderer.tsx  Document-to-HTML renderer
│       ├── storage.ts        Session and browser-storage persistence
│       ├── types.ts          Document, node, component, and layout types
│       ├── document.ts       Immutable tree operations
│       ├── nodePresentation.ts Scoped classes and CSS helpers
│       └── editor.css        Editor interface styles
```

## Extending Element Forge

To add a new component or native element, update the definitions and node creation behavior in `src/editor/Editor.tsx`, then update the relevant types in `src/editor/types.ts` and rendering behavior in `src/editor/PageRenderer.tsx` or the canvas renderer.

When changing the live DOM tree, keep these rules in mind:

- Inspect the rendered browser DOM, not only the persisted model.
- Keep tree identities stable across refreshes.
- Separate component selection from element inspection.
- Guard observer-driven refreshes against unnecessary state updates.
- Preserve void-element behavior and valid HTML nesting.

## Documentation

- [`ai-readme.md`](ai-readme.md) — implementation-oriented instructions for AI assistants and coding agents.
- [`src/README.md`](src/README.md) — source entry, standalone runtime entry point, and extraction boundary.
- [`src/editor/README.md`](src/editor/README.md) — editor responsibilities, feature behavior, files, and data model.
- [`docs/architecture.md`](docs/architecture.md) — standalone runtime flow, module ownership, and session behavior.

These subfolder documents are part of the maintained Element Forge instructions. When a feature's implementation, path, or behavior changes, update the closest instruction file as well as this root README when the change affects users.
