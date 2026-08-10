import { Component, createElement, Fragment, useCallback, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { findNode, insertNode, isDescendant, removeNode, updateNode } from "./document";
import {
    loadPageDocument,
    loadResources,
    loadUniqueComponents,
    savePageDocument,
    saveResources,
    saveUniqueComponents,
} from "./storage";
import {
    cloneNode,
    componentLabels,
    createNode,
    type ComponentType,
    type EditorDocument,
    type EditorNode,
    type ImageResource,
    type Layout,
    type UniqueComponent,
} from "./types";
import { containerContentStyle, nodeClassName, nodeStyle, pageClassName, scopedActiveCss, scopedChildCss, scopedCss, scopedHoverCss, scopedPageCss, scopedPseudoCss } from "./nodePresentation";
import "./editor.css";

const componentTypes: ComponentType[] = ["heading", "text", "button", "container", "image", "html"];

type DomElementDefinition = {
    tag: string;
    label: string;
    group: "Structure" | "Content" | "Interactive" | "Forms";
    type: ComponentType;
    description: string;
};

const domElementDefinitions: DomElementDefinition[] = [
    { tag: "div", label: "Div", group: "Structure", type: "container", description: "Generic block container" },
    { tag: "section", label: "Section", group: "Structure", type: "container", description: "Thematic page section" },
    { tag: "header", label: "Header", group: "Structure", type: "container", description: "Introductory or site header" },
    { tag: "nav", label: "Nav", group: "Structure", type: "container", description: "Navigation links" },
    { tag: "main", label: "Main", group: "Structure", type: "container", description: "Primary page content" },
    { tag: "footer", label: "Footer", group: "Structure", type: "container", description: "Page or section footer" },
    { tag: "article", label: "Article", group: "Structure", type: "container", description: "Self-contained content" },
    { tag: "aside", label: "Aside", group: "Structure", type: "container", description: "Supporting content" },
    { tag: "h1", label: "Heading 1", group: "Content", type: "heading", description: "Primary heading" },
    { tag: "h2", label: "Heading 2", group: "Content", type: "heading", description: "Secondary heading" },
    { tag: "h3", label: "Heading 3", group: "Content", type: "heading", description: "Tertiary heading" },
    { tag: "p", label: "Paragraph", group: "Content", type: "text", description: "Paragraph of text" },
    { tag: "span", label: "Span", group: "Content", type: "text", description: "Inline text wrapper" },
    { tag: "strong", label: "Strong", group: "Content", type: "text", description: "Important text" },
    { tag: "em", label: "Emphasis", group: "Content", type: "text", description: "Emphasized text" },
    { tag: "a", label: "Link", group: "Interactive", type: "button", description: "Navigational link" },
    { tag: "button", label: "Button", group: "Interactive", type: "button", description: "Action button" },
    { tag: "img", label: "Image", group: "Content", type: "image", description: "Responsive image" },
    { tag: "form", label: "Form", group: "Forms", type: "container", description: "Form control group" },
    { tag: "label", label: "Label", group: "Forms", type: "text", description: "Form control label" },
    { tag: "input", label: "Input", group: "Forms", type: "element", description: "Single-line form field" },
    { tag: "textarea", label: "Textarea", group: "Forms", type: "element", description: "Multi-line form field" },
    { tag: "select", label: "Select", group: "Forms", type: "element", description: "Option selector" },
    { tag: "details", label: "Details", group: "Interactive", type: "container", description: "Disclosure container" },
    { tag: "summary", label: "Summary", group: "Interactive", type: "text", description: "Disclosure label" },
];

const voidDomTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);

function canContainChildren(node: EditorNode | undefined) {
    return Boolean(node && (node.type === "container" || (node.type === "element" && !voidDomTags.has(node.tag))));
}

function asDomElementNode(node: EditorNode): EditorNode {
    return { ...node, type: "element", children: node.children.map(asDomElementNode) };
}

type TextLayoutKey = "width" | "height" | "padding" | "margin" | "gap";

const layoutInputs: Array<{ key: TextLayoutKey; label: string; placeholder: string }> = [
    { key: "width", label: "Width", placeholder: "50%, 320px, auto" },
    { key: "height", label: "Height", placeholder: "240px, auto" },
    { key: "padding", label: "Padding", placeholder: "16px" },
    { key: "margin", label: "Margin", placeholder: "0 0 16px" },
    { key: "gap", label: "Gap", placeholder: "16px" },
];

const cssPropertySuggestions = [
    "align-content", "align-items", "align-self", "animation", "background", "background-color",
    "background-image", "background-position", "background-repeat", "background-size", "border",
    "border-bottom", "border-color", "border-left", "border-radius", "border-right", "border-style",
    "border-top", "border-width", "bottom", "box-shadow", "box-sizing", "color", "column-gap",
    "content", "cursor", "display", "filter", "flex", "flex-basis", "flex-direction", "flex-grow", "flex-shrink",
    "flex-wrap", "float", "font-family", "font-size", "font-style", "font-weight", "gap", "grid-area",
    "grid-column", "grid-row", "grid-template-columns", "grid-template-rows", "height", "justify-content",
    "justify-items", "left", "letter-spacing", "line-height", "margin", "margin-bottom", "margin-left",
    "margin-right", "margin-top", "max-height", "max-width", "min-height", "min-width", "object-fit",
    "opacity", "order", "outline", "outline-offset", "overflow", "overflow-x", "overflow-y", "padding", "padding-bottom",
    "padding-left", "padding-right", "padding-top", "position", "right", "row-gap", "text-align",
    "text-decoration", "text-decoration-color", "text-underline-offset", "text-transform", "top", "transform", "transform-origin", "transition", "vertical-align", "visibility",
    "white-space", "width", "word-break", "z-index",
];

const cssColorSuggestions = [
    "transparent", "black", "white", "red", "green", "blue", "yellow", "orange", "purple", "pink",
    "gray", "grey", "silver", "maroon", "olive", "lime", "aqua", "cyan", "teal", "navy", "fuchsia",
    "magenta", "brown", "coral", "crimson", "gold", "indigo", "ivory", "khaki", "lavender", "beige",
    "salmon", "tomato", "turquoise", "violet", "rebeccapurple",
];

const pageCssSuggestions = ["@media", "@supports", "@container", "@keyframes", "@layer", "@import"];

export default function Editor({ pageId = "home" }: { pageId?: string }) {
    const [document, setDocument] = useState<EditorDocument>(() => loadPageDocument(pageId));
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [liveDomSelection, setLiveDomSelection] = useState<LiveDomItem | undefined>();
    const [isPageSelected, setIsPageSelected] = useState(false);
    const [dragOverId, setDragOverId] = useState<string | null>(null);
    const [sidebarView, setSidebarView] = useState<"components" | "dom" | "resources">("components");
    const [componentPanelTab, setComponentPanelTab] = useState<"components" | "elements">("components");
    const [expandedComponent, setExpandedComponent] = useState<ComponentType | null>(null);
    const [resources, setResources] = useState<ImageResource[]>(loadResources);
    const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
    const [cropResource, setCropResource] = useState<ImageResource | null>(null);
    const [uniqueComponents, setUniqueComponents] = useState<UniqueComponent[]>(loadUniqueComponents);
    const [theme, setTheme] = useState<"dark" | "light">("dark");
    const [cursorMode, setCursorMode] = useState<"edit" | "preview">("edit");
    const [canvasPreview, setCanvasPreview] = useState(() => ({ scale: 1, width: window.innerWidth }));
    const [canvasZoom, setCanvasZoom] = useState(1);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const canvasPanelRef = useRef<HTMLElement>(null);
    const documentRef = useRef(document);
    const selectedIdRef = useRef<string | null>(selectedId);
    const componentClipboardRef = useRef<EditorNode | null>(null);
    const undoStackRef = useRef<EditorDocument[]>([]);
    documentRef.current = document;
    selectedIdRef.current = selectedId;

    const selectedNode = useMemo(
        () => (selectedId ? findNode(document.nodes, selectedId) : undefined),
        [document.nodes, selectedId],
    );
    const selectedLiveDomInfo = useSelectedLiveDomInfo(selectedId);
    const pageSettingsNode = useMemo<EditorNode>(() => ({
        id: "page",
        tag: "main",
        type: "container",
        props: {
            css: document.pageCss,
            hoverCss: document.pageHoverCss,
            activeCss: document.pageActiveCss,
            layout: {},
        },
        children: [],
    }), [document.pageActiveCss, document.pageCss, document.pageHoverCss]);
    const previewScale = canvasPreview.scale * canvasZoom;
    const previewZoomPercent = Math.round(previewScale * 100);
    const changeCanvasZoom = (amount: number) => {
        setCanvasZoom((currentZoom) => Math.min(2.5, Math.max(0.5, Math.round((currentZoom + amount) * 100) / 100)));
    };

    const commit = useCallback((nextDocument: EditorDocument) => {
        undoStackRef.current.push(documentRef.current);
        if (undoStackRef.current.length > 80) undoStackRef.current.shift();
        documentRef.current = nextDocument;
        setDocument(nextDocument);
        savePageDocument(pageId, nextDocument);
    }, [pageId]);

    const createDomElement = (definition: DomElementDefinition) => {
        const node = createNode("element");
        node.tag = definition.tag;
        node.props.layout = {
            ...node.props.layout,
            display: ["span", "strong", "em", "a", "label", "summary"].includes(definition.tag) ? "inline" : node.props.layout.display,
        };
        if (definition.tag === "a") node.props.href = "#";
        if (["img", "input", "textarea", "select"].includes(definition.tag)) delete node.props.text;
        node.props.text = "";
        return node;
    };

    useEffect(() => {
        const handleEditorShortcut = (event: KeyboardEvent) => {
            if (!(event.ctrlKey || event.metaKey)) return;

            const target = event.target;
            if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName))) return;

            const key = event.key.toLowerCase();
            if (key === "c") {
                const selectedNode = selectedIdRef.current ? findNode(documentRef.current.nodes, selectedIdRef.current) : undefined;
                if (!selectedNode) return;

                event.preventDefault();
                componentClipboardRef.current = cloneNode(selectedNode);
                return;
            }

            if (key === "v") {
                const copiedNode = componentClipboardRef.current;
                if (!copiedNode) return;

                event.preventDefault();
                const selectedNode = selectedIdRef.current ? findNode(documentRef.current.nodes, selectedIdRef.current) : undefined;
                const parentId = canContainChildren(selectedNode) ? selectedNode?.id ?? null : null;
                const pastedNode = cloneNode(copiedNode);
                commit(insertNode(documentRef.current, parentId, pastedNode));
                setSelectedId(pastedNode.id);
                setIsPageSelected(false);
                return;
            }

            if (event.shiftKey || key !== "z") return;

            const previousDocument = undoStackRef.current.pop();
            if (!previousDocument) return;

            event.preventDefault();
            documentRef.current = previousDocument;
            setDocument(previousDocument);
            savePageDocument(pageId, previousDocument);
            setSelectedId((currentId) => currentId && findNode(previousDocument.nodes, currentId) ? currentId : null);
        };

        window.addEventListener("keydown", handleEditorShortcut);
        return () => window.removeEventListener("keydown", handleEditorShortcut);
    }, [commit, pageId]);

    useEffect(() => {
        const panel = canvasPanelRef.current;
        if (!panel) return;

        const updateCanvasPreview = () => {
            const pageWidth = window.innerWidth;
            const availableWidth = Math.max(1, panel.clientWidth - 64);
            setCanvasPreview({ scale: Math.min(1, availableWidth / pageWidth), width: pageWidth });
        };

        const observer = new ResizeObserver(updateCanvasPreview);
        observer.observe(panel);
        window.addEventListener("resize", updateCanvasPreview);
        updateCanvasPreview();

        return () => {
            observer.disconnect();
            window.removeEventListener("resize", updateCanvasPreview);
        };
    }, []);

    function addNode(type: ComponentType, parentId: string | null = null) {
        const node = createNode(type);
        commit(insertNode(document, parentId, node));
        setSelectedId(node.id);
    }

    function addDomElement(definition: DomElementDefinition, parentId: string | null = null) {
        const node = createDomElement(definition);
        commit(insertNode(document, parentId, node));
        setSelectedId(node.id);
        setIsPageSelected(false);
    }

    function addImageResource(resource: ImageResource, parentId: string | null = null) {
        const node = createNode("image");
        node.props.src = resource.src;
        node.props.alt = resource.name;
        node.props.resourceId = resource.id;
        commit(insertNode(document, parentId, node));
        setSelectedId(node.id);
    }

    function addUniqueComponent(component: UniqueComponent, parentId: string | null = null) {
        const node = cloneNode(component.node);
        commit(insertNode(document, parentId, node));
        setSelectedId(node.id);
    }

    function addResources(files: FileList | File[]) {
        const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));

        Promise.all(imageFiles.map((file) => new Promise<ImageResource>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve({ id: crypto.randomUUID(), name: file.name, src: String(reader.result) });
            reader.onerror = reject;
            reader.readAsDataURL(file);
        }))).then((newResources) => {
            const nextResources = [...resources, ...newResources];
            setResources(nextResources);
            saveResources(nextResources);
        }).catch(() => undefined);
    }

    function saveCroppedResourceCopy(source: ImageResource, src: string) {
        const baseName = source.name.replace(/\.[^/.]+$/, "") || source.name;
        const croppedResource: ImageResource = {
            id: crypto.randomUUID(),
            name: `${baseName} crop.png`,
            src,
        };
        const nextResources = [...resources, croppedResource];
        setResources(nextResources);
        saveResources(nextResources);
        setSelectedResourceId(croppedResource.id);
    }

    function replaceCroppedResource(source: ImageResource, src: string) {
        setResources((currentResources) => {
            const nextResources = currentResources.map((resource) => (
                resource.id === source.id ? { ...resource, src } : resource
            ));
            saveResources(nextResources);
            return nextResources;
        });
        commit({
            ...document,
            nodes: replaceImageSources(document.nodes, source.id, source.src, src),
        });
        setSelectedResourceId(source.id);
    }

    function deleteResource(resourceId: string) {
        setResources((currentResources) => {
            const nextResources = currentResources.filter((resource) => resource.id !== resourceId);
            saveResources(nextResources);
            return nextResources;
        });
        setSelectedResourceId((currentId) => currentId === resourceId ? null : currentId);
        setCropResource((currentResource) => currentResource?.id === resourceId ? null : currentResource);
    }

    function saveSelectedAsUnique() {
        if (!selectedNode) return;

        const name = `${componentLabels[selectedNode.type]} ${uniqueComponents.length + 1}`;
        const nextComponents = [
            ...uniqueComponents,
            { id: crypto.randomUUID(), name, node: cloneNode(selectedNode) },
        ];

        setUniqueComponents(nextComponents);
        saveUniqueComponents(nextComponents);
        setSidebarView("components");
        setExpandedComponent(selectedNode.type);
    }

    function removeUniqueComponent(componentId: string) {
        const nextComponents = uniqueComponents.filter((component) => component.id !== componentId);
        setUniqueComponents(nextComponents);
        saveUniqueComponents(nextComponents);
    }

    function moveNode(nodeId: string, targetParentId: string | null) {
        const node = findNode(document.nodes, nodeId);
        if (!node || node.id === targetParentId || isDescendant(node, targetParentId ?? "")) return;

        const withoutNode = { ...document, nodes: removeNode(document.nodes, nodeId) };
        commit(insertNode(withoutNode, targetParentId, node));
        setSelectedId(nodeId);
    }

    function updateSelected(update: (node: EditorNode) => EditorNode) {
        if (!selectedId) return;
        commit({ ...document, nodes: updateNode(document.nodes, selectedId, update) });
    }

    function updatePageSettings(update: (node: EditorNode) => EditorNode) {
        const updatedPage = update(pageSettingsNode);
        commit({
            ...document,
            pageCss: updatedPage.props.css,
            pageHoverCss: updatedPage.props.hoverCss,
            pageActiveCss: updatedPage.props.activeCss,
        });
    }

    function selectNode(id: string) {
        setSelectedId(id);
        setIsPageSelected(false);
    }

    function selectCanvasNode(id: string) {
        setLiveDomSelection(undefined);
        selectNode(id);
    }

    function selectPage() {
        setLiveDomSelection(undefined);
        setSelectedId(null);
        setIsPageSelected(true);
    }

    function deleteNode(id: string) {
        const node = findNode(document.nodes, id);
        if (!node) return;

        commit({ ...document, nodes: removeNode(document.nodes, id) });
        if (selectedId === id || (selectedId && isDescendant(node, selectedId))) {
            setSelectedId(null);
        }
    }

    function handleDrop(event: React.DragEvent, parentId: string | null) {
        event.preventDefault();
        setDragOverId(null);

        const newType = event.dataTransfer.getData("application/x-editor-component") as ComponentType;
        const domTag = event.dataTransfer.getData("application/x-editor-dom-element");
        const movedNodeId = event.dataTransfer.getData("application/x-editor-node");
        const resourceId = event.dataTransfer.getData("application/x-editor-resource");
        const uniqueId = event.dataTransfer.getData("application/x-editor-unique");

        if (componentTypes.includes(newType)) addNode(newType, parentId);
        if (domTag) {
            const definition = domElementDefinitions.find((item) => item.tag === domTag);
            if (definition) addDomElement(definition, parentId);
        }
        if (movedNodeId) moveNode(movedNodeId, parentId);
        if (resourceId) {
            const resource = resources.find((item) => item.id === resourceId);
            if (resource) addImageResource(resource, parentId);
        }
        if (uniqueId) {
            const component = uniqueComponents.find((item) => item.id === uniqueId);
            if (component) addUniqueComponent(component, parentId);
        }
    }

    return (
        <div className={`editor-root theme-${theme}`}>
        <main className={`editor-shell theme-${theme}`}>
            <header className="editor-header">
                <div>
                    <p className="editor-eyebrow">Custom page editor</p>
                    <h1>Canvas</h1>
                </div>
                <div className="editor-header-actions">
                    <div className="editor-mode-toolbar" role="toolbar" aria-label="Canvas cursor mode">
                        <button
                            type="button"
                            className={`editor-mode-button ${cursorMode === "preview" ? "is-active" : ""}`}
                            aria-pressed={cursorMode === "preview"}
                            aria-label="Use normal cursor"
                            title="Normal cursor: click buttons and navigate"
                            onClick={() => setCursorMode("preview")}
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 3 13 9-6 1.5L9 20 5 3Z" /><path d="m12 13 4 6" /></svg>
                        </button>
                        <button
                            type="button"
                            className={`editor-mode-button ${cursorMode === "edit" ? "is-active" : ""}`}
                            aria-pressed={cursorMode === "edit"}
                            aria-label="Use edit cursor"
                            title="Edit cursor: select DOM elements and components"
                            onClick={() => setCursorMode("edit")}
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l3.5-.8L18 8.7a2.12 2.12 0 0 0-3-3L4.5 16.2 4 20Z" /><path d="M13 7 17 11" /></svg>
                        </button>
                    </div>
                    <button className="editor-publish" onClick={() => savePageDocument(pageId, document)}>
                        Save page
                    </button>
                    <button
                        className="theme-toggle"
                        type="button"
                        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
                        title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
                        onClick={() => setTheme((currentTheme) => currentTheme === "dark" ? "light" : "dark")}
                    >
                        {theme === "dark" ? (
                            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>
                        ) : (
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 15.6A8.8 8.8 0 0 1 8.4 3.2 8.8 8.8 0 1 0 20.8 15.6Z" /></svg>
                        )}
                    </button>
                </div>
            </header>

            <aside className="editor-sidebar" aria-label="Component palette">
                <div className="sidebar-tabs" role="tablist" aria-label="Editor sidebar">
                    <button
                        role="tab"
                        aria-selected={sidebarView === "components"}
                        aria-controls="components-panel"
                        className={sidebarView === "components" ? "is-active" : ""}
                        onClick={() => setSidebarView("components")}
                    >
                        Components
                    </button>
                    <button
                        role="tab"
                        aria-selected={sidebarView === "dom"}
                        aria-controls="dom-panel"
                        className={sidebarView === "dom" ? "is-active" : ""}
                        onClick={() => setSidebarView("dom")}
                    >
                        DOM
                    </button>
                    <button
                        role="tab"
                        aria-selected={sidebarView === "resources"}
                        aria-controls="resources-panel"
                        className={sidebarView === "resources" ? "is-active" : ""}
                        onClick={() => setSidebarView("resources")}
                    >
                        Resources
                    </button>
                </div>

                {sidebarView === "components" ? (
                    <div id="components-panel" role="tabpanel" className="sidebar-panel">
                        <h2>Components</h2>
                        <p>{componentPanelTab === "components" ? "Reusable building blocks and saved versions." : "Native HTML elements you can add to the DOM tree."}</p>
                        <div className="component-panel-tabs" role="tablist" aria-label="Creation palette">
                            <button type="button" role="tab" aria-selected={componentPanelTab === "components"} className={componentPanelTab === "components" ? "is-active" : ""} onClick={() => setComponentPanelTab("components")}>Components</button>
                            <button type="button" role="tab" aria-selected={componentPanelTab === "elements"} className={componentPanelTab === "elements" ? "is-active" : ""} onClick={() => setComponentPanelTab("elements")}>DOM elements</button>
                        </div>
                        {componentPanelTab === "components" ? <div className="component-menu-list">
                            {componentTypes.map((type) => {
                                const isExpanded = expandedComponent === type;
                                const savedComponents = uniqueComponents.filter((component) => component.node.type === type);

                                return (
                                    <section key={type} className={`component-menu ${isExpanded ? "is-expanded" : ""}`}>
                                        <button
                                            className="component-menu-trigger"
                                            aria-expanded={isExpanded}
                                            aria-controls={`${type}-component-options`}
                                            onClick={() => setExpandedComponent(isExpanded ? null : type)}
                                        >
                                            <span>{componentLabels[type]}</span>
                                            <svg viewBox="0 0 16 16" aria-hidden="true">
                                                <path d="m4 6 4 4 4-4" />
                                            </svg>
                                        </button>
                                        {isExpanded && (
                                            <div id={`${type}-component-options`} className="component-submenu">
                                                <button
                                                    className="component-option"
                                                    draggable
                                                    onClick={() => addNode(type)}
                                                    onDragStart={(event) => {
                                                        event.dataTransfer.setData("application/x-editor-component", type);
                                                        event.dataTransfer.effectAllowed = "copy";
                                                    }}
                                                >
                                                    <span>Default</span>
                                                    <span className="component-option-description">New {componentLabels[type].toLowerCase()}</span>
                                                </button>
                                                {savedComponents.map((component) => (
                                                    <div key={component.id} className="unique-component-option">
                                                        <button
                                                            className="component-option"
                                                            draggable
                                                            onClick={() => addUniqueComponent(component)}
                                                            onDragStart={(event) => {
                                                                event.dataTransfer.setData("application/x-editor-unique", component.id);
                                                                event.dataTransfer.effectAllowed = "copy";
                                                            }}
                                                        >
                                                            <span>{component.name}</span>
                                                            <span className="component-option-description">Saved version</span>
                                                        </button>
                                                        <button
                                                            className="unique-component-remove"
                                                            type="button"
                                                            aria-label={`Remove saved ${component.name}`}
                                                            title={`Remove ${component.name}`}
                                                            onClick={() => removeUniqueComponent(component.id)}
                                                        >
                                                            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4h10M6 4V2.5h4V4M5 6v6M8 6v6M11 6v6M4.5 4l.5 10h6l.5-10" /></svg>
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </section>
                                );
                            })}
                        </div> : <DomElementPalette onAdd={addDomElement} />}
                    </div>
                ) : sidebarView === "dom" ? (
                    <div id="dom-panel" role="tabpanel" className="sidebar-panel">
                        <h2>DOM</h2>
                        <ul className="component-tree component-tree--page">
                            <li>
                                <div className="tree-item">
                                    <button className={`tree-select tree-page-select ${isPageSelected ? "is-active" : ""}`} onClick={selectPage}>
                                        <TreeIcon type="page" />
                                        <span>&lt;document&gt; page</span>
                                    </button>
                                </div>
                                <LiveDomTreeBoundary key={pageId} selectedId={selectedId} onSelect={selectNode} onInspect={setLiveDomSelection} />
                            </li>
                        </ul>
                    </div>
                ) : sidebarView === "resources" ? (
                    <div id="resources-panel" role="tabpanel" className="sidebar-panel">
                        <div className="panel-heading">
                            <h2>Resources</h2>
                            <button className="add-resource" onClick={() => imageInputRef.current?.click()}>
                                Add image
                            </button>
                        </div>
                        <p>Add images with the button or drop image files below. Drag an image to the canvas to create an Image component; click it for actions.</p>
                        <input
                            ref={imageInputRef}
                            className="visually-hidden"
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(event) => {
                                if (event.target.files) addResources(event.target.files);
                                event.target.value = "";
                            }}
                        />
                        <div
                            className="resource-drop-zone"
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => {
                                event.preventDefault();
                                addResources(event.dataTransfer.files);
                            }}
                        >
                            Drop image files here
                        </div>
                        <div className="resource-list">
                            {resources.map((resource) => {
                                const isSelected = selectedResourceId === resource.id;

                                return (
                                    <div key={resource.id} className="resource-entry">
                                        <button
                                            className={`resource-card ${isSelected ? "is-selected" : ""}`}
                                            draggable
                                            aria-expanded={isSelected}
                                            onClick={() => setSelectedResourceId(isSelected ? null : resource.id)}
                                            onDragStart={(event) => {
                                                event.dataTransfer.setData("application/x-editor-resource", resource.id);
                                                event.dataTransfer.effectAllowed = "copy";
                                            }}
                                        >
                                            <img src={resource.src} alt="" />
                                            <span>{resource.name}</span>
                                        </button>
                                        {isSelected && (
                                            <div className="resource-options" aria-label={`${resource.name} actions`}>
                                                <button className="resource-option" aria-label={`Crop ${resource.name}`} title="Crop image" onClick={() => setCropResource(resource)}>
                                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                                        <path d="M7 3v14a4 4 0 0 0 4 4h10M3 7h14a4 4 0 0 1 4 4v10M7 3h4M3 7v4" />
                                                    </svg>
                                                </button>
                                                <button className="resource-option resource-option-delete" aria-label={`Delete ${resource.name}`} title="Delete image" onClick={() => deleteResource(resource.id)}>
                                                    <svg viewBox="0 0 24 24" aria-hidden="true">
                                                        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                                                    </svg>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : null}
            </aside>

            <section ref={canvasPanelRef} className="editor-canvas-panel" aria-label="Page canvas">
                {scopedPageCss(document.pageCss) && <style>{scopedPageCss(document.pageCss)}</style>}
                {scopedPageCss(document.pageHoverCss, "hover") && <style>{scopedPageCss(document.pageHoverCss, "hover")}</style>}
                {scopedPageCss(document.pageActiveCss, "active") && <style>{scopedPageCss(document.pageActiveCss, "active")}</style>}
                <div className="canvas-zoom-controls" aria-label="Canvas zoom controls">
                    <button type="button" onClick={() => changeCanvasZoom(-0.1)} disabled={canvasZoom <= 0.5} aria-label="Zoom out" title="Zoom out">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12" /></svg>
                    </button>
                    <button type="button" className="canvas-zoom-value" onClick={() => setCanvasZoom(1)} aria-label="Reset canvas zoom to fit" title="Reset canvas zoom to fit">
                        {previewZoomPercent}%
                    </button>
                    <button type="button" onClick={() => changeCanvasZoom(0.1)} disabled={canvasZoom >= 2.5} aria-label="Zoom in" title="Zoom in">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12" /></svg>
                    </button>
                </div>
                <CanvasDropZone
                    parentId={null}
                    active={cursorMode === "edit" && dragOverId === "root"}
                    className={pageClassName}
                    style={{ display: "block", width: `${canvasPreview.width}px`, zoom: previewScale }}
                    onDragEnter={() => cursorMode === "edit" && setDragOverId("root")}
                    onDragLeave={() => setDragOverId(null)}
                    onDrop={cursorMode === "edit" ? handleDrop : () => undefined}
                >
                    {document.nodes.length === 0 ? (
                        <div className="canvas-empty">
                            <strong>Start building</strong>
                            <span>Drag a component here or choose one from the palette.</span>
                        </div>
                    ) : (
                        document.nodes.map((node) => (
                            <CanvasNode
                                key={node.id}
                                node={node}
                                cursorMode={cursorMode}
                                selectedId={selectedId}
                                dragOverId={dragOverId}
                                onSelect={selectCanvasNode}
                                onRemove={deleteNode}
                                onDragOver={setDragOverId}
                                onDrop={handleDrop}
                            />
                        ))
                    )}
                </CanvasDropZone>
            </section>

            <aside className="editor-inspector" aria-label="Edit selected DOM element">
                <h2>Edit</h2>
                {isPageSelected ? (
                    <Inspector key="page" node={pageSettingsNode} pageCss={document.pageCss} onChange={updatePageSettings} onDelete={() => undefined} onSave={() => undefined} pageSettings />
                ) : liveDomSelection ? (
                    <ElementInspector key={`live-${liveDomSelection.key}`} node={selectedNode?.type === "element" ? selectedNode : liveDomSelectionToNode(liveDomSelection)} liveInfo={liveDomSelection} readOnly={selectedNode?.type !== "element"} onChange={selectedNode?.type === "element" ? updateSelected : () => undefined} onDelete={selectedNode?.type === "element" ? () => deleteNode(selectedNode.id) : () => undefined} />
                ) : selectedNode ? (
                    selectedNode.type === "element" ? (
                        <ElementInspector key={selectedNode.id} node={selectedNode} liveInfo={selectedLiveDomInfo} onChange={updateSelected} onDelete={() => deleteNode(selectedNode.id)} />
                    ) : (
                        <Inspector key={selectedNode.id} node={selectedNode} pageCss={document.pageCss} liveInfo={selectedLiveDomInfo} onChange={updateSelected} onDelete={() => deleteNode(selectedNode.id)} onSave={saveSelectedAsUnique} />
                    )
                ) : (
                    <p>Select a component or DOM element on the canvas to edit its options.</p>
                )}
            </aside>
        </main>
        {cropResource && (
            <CropDialog
                resource={cropResource}
                onClose={() => setCropResource(null)}
                onSave={(src, mode) => {
                    if (!cropResource) return;

                    if (mode === "replace") replaceCroppedResource(cropResource, src);
                    else saveCroppedResourceCopy(cropResource, src);
                }}
            />
        )}
        </div>
    );
}

type CropArea = {
    height: number;
    width: number;
    x: number;
    y: number;
};

type CropHandle = "top" | "right" | "bottom" | "left" | "top-left" | "top-right" | "bottom-right" | "bottom-left";

const cropHandles: CropHandle[] = ["top", "right", "bottom", "left", "top-left", "top-right", "bottom-right", "bottom-left"];

function CropDialog({ resource, onClose, onSave }: { resource: ImageResource; onClose: () => void; onSave: (src: string, mode: "replace" | "copy") => void }) {
    const imageRef = useRef<HTMLImageElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const resizeState = useRef<{ crop: CropArea; handle: CropHandle } | null>(null);
    const [imageSize, setImageSize] = useState<{ height: number; width: number } | null>(null);
    const [crop, setCrop] = useState<CropArea>({ x: 8, y: 8, width: 84, height: 84 });

    const pointInStage = (clientX: number, clientY: number) => {
        const bounds = stageRef.current?.getBoundingClientRect();
        if (!bounds) return null;
        return {
            x: Math.max(0, Math.min(100, ((clientX - bounds.left) / bounds.width) * 100)),
            y: Math.max(0, Math.min(100, ((clientY - bounds.top) / bounds.height) * 100)),
        };
    };

    const resizeCrop = (point: { x: number; y: number }) => {
        const state = resizeState.current;
        if (!state) return;
        const minimumSize = 4;
        const { crop: initialCrop, handle } = state;
        let left = initialCrop.x;
        let top = initialCrop.y;
        let right = initialCrop.x + initialCrop.width;
        let bottom = initialCrop.y + initialCrop.height;

        if (handle.includes("left")) left = Math.max(0, Math.min(point.x, right - minimumSize));
        if (handle.includes("right")) right = Math.min(100, Math.max(point.x, left + minimumSize));
        if (handle.includes("top")) top = Math.max(0, Math.min(point.y, bottom - minimumSize));
        if (handle.includes("bottom")) bottom = Math.min(100, Math.max(point.y, top + minimumSize));

        setCrop({
            x: left,
            y: top,
            width: right - left,
            height: bottom - top,
        });
    };

    const beginResize = (event: React.PointerEvent<HTMLButtonElement>, handle: CropHandle) => {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        resizeState.current = { crop, handle };
    };

    const createCroppedSource = () => {
        const image = imageRef.current;
        if (!image || !imageSize || crop.width < 1 || crop.height < 1) return null;

        const sourceX = Math.floor(image.naturalWidth * crop.x / 100);
        const sourceY = Math.floor(image.naturalHeight * crop.y / 100);
        const sourceWidth = Math.max(1, Math.floor(image.naturalWidth * crop.width / 100));
        const sourceHeight = Math.max(1, Math.floor(image.naturalHeight * crop.height / 100));
        const canvas = window.document.createElement("canvas");
        canvas.width = sourceWidth;
        canvas.height = sourceHeight;
        const context = canvas.getContext("2d");
        if (!context) return null;

        context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
        return canvas.toDataURL("image/png");
    };

    const finishSave = (mode: "replace" | "copy") => {
        const src = createCroppedSource();
        if (!src) return;

        onClose();
        onSave(src, mode);
    };

    return (
        <div className="crop-dialog-backdrop" role="presentation" onMouseDown={onClose}>
            <section className="crop-dialog" role="dialog" aria-modal="true" aria-labelledby="crop-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
                <header className="crop-dialog-header">
                    <div>
                        <p>Image editor</p>
                        <h2 id="crop-dialog-title">Crop {resource.name}</h2>
                    </div>
                    <button className="crop-close" aria-label="Close crop editor" onClick={onClose}>
                        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 3 10 10M13 3 3 13" /></svg>
                    </button>
                </header>
                <p className="crop-instructions">Drag the frame borders or corner handles to choose the part to keep.</p>
                <div
                    ref={stageRef}
                    className="crop-stage"
                    style={imageSize ? { aspectRatio: `${imageSize.width} / ${imageSize.height}` } : undefined}
                    onPointerMove={(event) => {
                        const point = pointInStage(event.clientX, event.clientY);
                        if (point) resizeCrop(point);
                    }}
                    onPointerUp={(event) => {
                        const point = pointInStage(event.clientX, event.clientY);
                        if (point) resizeCrop(point);
                        resizeState.current = null;
                    }}
                >
                    <img
                        ref={imageRef}
                        src={resource.src}
                        alt=""
                        draggable={false}
                        onLoad={(event) => setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
                    />
                    <div className="crop-selection" style={{ left: `${crop.x}%`, top: `${crop.y}%`, width: `${crop.width}%`, height: `${crop.height}%` }}>
                        {cropHandles.map((handle) => (
                            <button
                                key={handle}
                                className={`crop-handle crop-handle--${handle}`}
                                aria-label={`Resize crop from ${handle.replace("-", " ")}`}
                                onPointerDown={(event) => beginResize(event, handle)}
                            />
                        ))}
                    </div>
                </div>
                <footer className="crop-dialog-actions">
                    <button className="crop-cancel" onClick={onClose}>Cancel</button>
                    <div className="crop-save-options">
                        <button className="crop-save-copy" disabled={!imageSize || crop.width < 1 || crop.height < 1} onClick={() => finishSave("copy")}>Save as copy</button>
                        <button className="crop-save" disabled={!imageSize || crop.width < 1 || crop.height < 1} onClick={() => finishSave("replace")}>Save</button>
                    </div>
                </footer>
            </section>
        </div>
    );
}

function replaceImageSources(nodes: EditorNode[], resourceId: string, oldSource: string, newSource: string): EditorNode[] {
    return nodes.map((node) => ({
        ...node,
        props: node.type === "image" && (node.props.resourceId === resourceId || node.props.src === oldSource)
            ? { ...node.props, resourceId, src: newSource }
            : node.props,
        children: replaceImageSources(node.children, resourceId, oldSource, newSource),
    }));
}

function CanvasDropZone({
    parentId,
    active,
    children,
    onDragEnter,
    onDragLeave,
    onDrop,
    style,
    className,
}: {
    parentId: string | null;
    active: boolean;
    children: React.ReactNode;
    onDragEnter: () => void;
    onDragLeave: () => void;
    onDrop: (event: React.DragEvent, parentId: string | null) => void;
    style?: React.CSSProperties;
    className?: string;
}) {
    return (
        <div
            className={`canvas-drop-zone ${className ?? ""} ${active ? "is-drag-over" : ""}`}
            style={style}
            onDragOver={(event) => event.preventDefault()}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDrop={(event) => {
                event.stopPropagation();
                onDrop(event, parentId);
            }}
        >
            {children}
        </div>
    );
}

function CanvasNode({
    node,
    cursorMode,
    selectedId,
    dragOverId,
    onSelect,
    onRemove,
    onDragOver,
    onDrop,
}: {
    node: EditorNode;
    cursorMode: "edit" | "preview";
    selectedId: string | null;
    dragOverId: string | null;
    onSelect: (id: string) => void;
    onRemove: (id: string) => void;
    onDragOver: (id: string | null) => void;
    onDrop: (event: React.DragEvent, parentId: string | null) => void;
}) {
    const selected = selectedId === node.id;
    const style = nodeStyle(node.props.layout);
    const componentChildSelector = node.type === "button"
        ? ".editor-button"
        : node.type === "image"
            ? ".canvas-image"
            : node.type === "container"
                ? ".container-content"
                : undefined;
    const componentCss = node.type === "html" ? "" : scopedCss(node.id, node.props.css, componentChildSelector);
    const childrenCss = scopedChildCss(node.id, node.props.childrenCss, node.type === "container" ? ".container-content > .canvas-node" : undefined);
    const componentHoverCss = scopedHoverCss(node.id, node.props.hoverCss, node.type === "button" ? ".editor-button" : undefined);
    const componentActiveCss = scopedActiveCss(node.id, node.props.activeCss, node.type === "button" ? ".editor-button" : undefined);
    const componentFocusCss = scopedPseudoCss(node.id, node.props.focusCss, ":focus-visible", node.type === "button" ? ".editor-button" : undefined);
    const componentAfterCss = scopedPseudoCss(node.id, node.props.afterCss, "::after", node.type === "button" ? ".editor-button" : undefined);
    const componentHoverAfterCss = scopedPseudoCss(node.id, node.props.hoverAfterCss, ":hover::after", node.type === "button" ? ".editor-button" : undefined);
    const componentCurrentAfterCss = scopedPseudoCss(node.id, node.props.currentAfterCss, '[aria-current="page"]::after', node.type === "button" ? ".editor-button" : undefined);

    return (
        <div
            className={`canvas-node canvas-node--${node.type} ${nodeClassName(node.id)} ${node.props.className ?? ""} ${selected ? "is-selected" : ""} ${dragOverId === node.id ? "is-drop-target" : ""} ${cursorMode === "preview" ? "canvas-node--preview" : ""}`}
            style={style}
            draggable={cursorMode === "edit"}
            onClick={(event) => {
                if (cursorMode === "preview") return;
                event.stopPropagation();
                onSelect(node.id);
            }}
            onDragStart={(event) => {
                if (cursorMode === "preview") return;
                event.dataTransfer.setData("application/x-editor-node", node.id);
                event.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(event) => {
                if (cursorMode === "preview") return;
                event.preventDefault();
                event.stopPropagation();
                onDragOver(node.id);
            }}
            onDragLeave={() => onDragOver(null)}
            onDrop={(event) => {
                if (cursorMode === "preview") return;
                if (!canContainChildren(node)) return;
                event.stopPropagation();
                onDrop(event, node.id);
            }}
        >
            {componentCss && <style>{componentCss}</style>}
            {childrenCss && <style>{childrenCss}</style>}
            {componentHoverCss && <style>{componentHoverCss}</style>}
            {componentActiveCss && <style>{componentActiveCss}</style>}
            {componentFocusCss && <style>{componentFocusCss}</style>}
            {componentAfterCss && <style>{componentAfterCss}</style>}
            {componentHoverAfterCss && <style>{componentHoverAfterCss}</style>}
            {componentCurrentAfterCss && <style>{componentCurrentAfterCss}</style>}
            {cursorMode === "edit" && <div className="canvas-node-toolbar" role="toolbar" aria-label={`${componentLabels[node.type]} actions`}>
                <span className="toolbar-section toolbar-component">{componentLabels[node.type]}</span>
                <span className="toolbar-section toolbar-drag" title="Drag this component to move it" aria-label="Drag to move">
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                        <circle cx="5" cy="3" r="1" />
                        <circle cx="11" cy="3" r="1" />
                        <circle cx="5" cy="8" r="1" />
                        <circle cx="11" cy="8" r="1" />
                        <circle cx="5" cy="13" r="1" />
                        <circle cx="11" cy="13" r="1" />
                    </svg>
                </span>
                <button
                    className="toolbar-section toolbar-remove"
                    aria-label={`Remove ${componentLabels[node.type]}`}
                    onClick={(event) => {
                        event.stopPropagation();
                        onRemove(node.id);
                    }}
                >
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M3 4h10M6 4V2.5h4V4M5 6v6M8 6v6M11 6v6M4.5 4l.5 10h6l.5-10" />
                    </svg>
                </button>
            </div>}
            {node.type === "heading" && <h1>{node.props.text}</h1>}
            {node.type === "text" && <p>{node.props.text}</p>}
            {node.type === "button" && (node.props.href ? (
                <a className="editor-button" href={node.props.href} aria-current={node.props.ariaCurrent ? "page" : undefined} onClick={cursorMode === "edit" ? (event) => event.preventDefault() : undefined}>{node.props.text}</a>
            ) : <button className="editor-button" type="button">{node.props.text}</button>)}
            {node.type === "image" && (
                node.props.src ? (
                    <img className="canvas-image" src={node.props.src} alt={node.props.alt ?? ""} style={style} />
                ) : (
                    <div className="image-placeholder">Choose an image from Resources</div>
                )
            )}
            {node.type === "html" && <HtmlCssContent html={node.props.html ?? ""} css={node.props.css ?? ""} />}
            {node.type === "element" && createElement(
                node.tag,
                { className: "canvas-dom-element", value: node.props.text || undefined, ...(node.tag === "a" && node.props.href ? { href: node.props.href } : {}) },
                node.children.length > 0 ? node.children.map((child) => (
                    <CanvasNode
                        key={child.id}
                        node={child}
                        cursorMode={cursorMode}
                        selectedId={selectedId}
                        dragOverId={dragOverId}
                        onSelect={onSelect}
                        onRemove={onRemove}
                        onDragOver={onDragOver}
                        onDrop={onDrop}
                    />
                )) : node.props.text,
            )}
            {node.type === "container" && (
                <div className="container-content" style={containerContentStyle(node.props.layout)}>
                    {node.children.length === 0 ? (
                        <span className="container-placeholder">Drop components inside this container</span>
                    ) : (
                        node.children.map((child) => (
                            <CanvasNode
                            key={child.id}
                            node={child}
                            cursorMode={cursorMode}
                                selectedId={selectedId}
                                dragOverId={dragOverId}
                                onSelect={onSelect}
                                onRemove={onRemove}
                                onDragOver={onDragOver}
                                onDrop={onDrop}
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

function HtmlCssContent({ html, css }: { html: string; css: string }) {
    return (
        <div className="html-css-content">
            <style>{css}</style>
            <div dangerouslySetInnerHTML={{ __html: html }} />
        </div>
    );
}

function DomElementPalette({ onAdd }: { onAdd: (definition: DomElementDefinition) => void }) {
    const groups: DomElementDefinition["group"][] = ["Structure", "Content", "Interactive", "Forms"];

    return (
        <div className="dom-element-palette">
            {groups.map((group) => (
                <section key={group} className="dom-element-group">
                    <h3>{group}</h3>
                    <div className="dom-element-list">
                        {domElementDefinitions.filter((definition) => definition.group === group).map((definition) => (
                            <button
                                key={definition.tag}
                                type="button"
                                className="dom-element-option"
                                draggable
                                onClick={() => onAdd(definition)}
                                onDragStart={(event) => {
                                    event.dataTransfer.setData("application/x-editor-dom-element", definition.tag);
                                    event.dataTransfer.effectAllowed = "copy";
                                }}
                            >
                                <code>&lt;{definition.tag}&gt;</code>
                                <span>
                                    <strong>{definition.label}</strong>
                                    <small>{definition.description}</small>
                                </span>
                            </button>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}

type LiveDomItem = {
    key: string;
    tag: string;
    className: string;
    id?: string;
    text: string;
    attributes: Array<[string, string]>;
    display: string;
    computed: Array<[string, string]>;
    position: string;
    size: string;
    editorNodeId?: string;
    children: LiveDomItem[];
};

function useSelectedLiveDomInfo(selectedId: string | null) {
    const [item, setItem] = useState<LiveDomItem | undefined>();

    useEffect(() => {
        const update = () => {
            try {
                if (!selectedId) {
                    setItem(undefined);
                    return;
                }
                const wrapper = document.querySelector<HTMLElement>(`.editor-node-${selectedId}`);
                setItem(wrapper ? inspectCanvasWrapper(wrapper)[0] : undefined);
            } catch {
                setItem(undefined);
            }
        };

        update();
        const root = document.querySelector<HTMLElement>('.editor-canvas-panel .editor-page-root');
        if (!root) return;
        const observer = new MutationObserver(update);
        observer.observe(root, { attributes: true, childList: true, subtree: true, characterData: true });
        const resizeObserver = new ResizeObserver(update);
        resizeObserver.observe(root);
        return () => {
            observer.disconnect();
            resizeObserver.disconnect();
        };
    }, [selectedId]);

    return item;
}

function liveDomSelectionToNode(item: LiveDomItem): EditorNode {
    return {
        id: item.editorNodeId ?? item.key,
        tag: item.tag,
        type: "element",
        props: { className: item.className, text: item.text, layout: {} },
        children: [],
    };
}

function LiveDomTree({ selectedId, onSelect, onInspect }: { selectedId: string | null; onSelect: (id: string) => void; onInspect: (item: LiveDomItem) => void }) {
    const [items, setItems] = useState<LiveDomItem[]>([]);
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
    const [inspected, setInspected] = useState<LiveDomItem | null>(null);

    useEffect(() => {
        const root = document.querySelector<HTMLElement>('.editor-canvas-panel .editor-page-root');
        if (!root) {
            setItems([]);
            return;
        }

        let readFrame: number | undefined;
        const readTree = () => {
            try {
                const nextItems = Array.from(root.children)
                    .filter((child): child is HTMLElement => child instanceof HTMLElement)
                    .flatMap((child, index) => child.classList.contains("canvas-node")
                        ? inspectCanvasWrapper(child, `root-${index}`)
                        : [inspectElement(child, undefined, `root-${index}`)]);
                setItems((current) => sameLiveTree(current, nextItems) ? current : nextItems);
                setInspected((current) => {
                    if (!current) return null;
                    const next = findLiveItem(nextItems, current.key);
                    return next?.key === current.key ? current : next ?? null;
                });
            } catch {
                setItems([]);
                setInspected(null);
            }
        };
        const scheduleRead = () => {
            if (readFrame !== undefined) cancelAnimationFrame(readFrame);
            readFrame = requestAnimationFrame(() => {
                readFrame = undefined;
                readTree();
            });
        };

        readTree();
        const observer = new MutationObserver(scheduleRead);
        observer.observe(root, { attributes: true, childList: true, subtree: true, characterData: true });
        const resizeObserver = new ResizeObserver(scheduleRead);
        resizeObserver.observe(root);

        return () => {
            if (readFrame !== undefined) cancelAnimationFrame(readFrame);
            observer.disconnect();
            resizeObserver.disconnect();
        };
    }, [selectedId]);

    if (items.length === 0) return <p className="tree-empty">The rendered DOM is empty.</p>;

    const toggle = (item: LiveDomItem) => {
        setExpanded((current) => {
            const next = new Set(current);
            if (next.has(item.key)) next.delete(item.key);
            else next.add(item.key);
            return next;
        });
    };

    return (
        <div className="live-dom-inspector">
            <div className="live-dom-source-badge"><span className="live-dom-pulse" />Live rendered DOM</div>
            <ul className="live-dom-tree">
                {items.map((item) => (
                    <LiveDomItemRow
                        key={item.key}
                        item={item}
                        expanded={expanded}
                        selectedId={selectedId}
                        onToggle={toggle}
                        onSelect={(next) => {
                            setInspected(next);
                            onInspect(next);
                            if (next.editorNodeId) onSelect(next.editorNodeId);
                        }}
                    />
                ))}
            </ul>
            {inspected && <LiveDomDetails item={inspected} />}
        </div>
    );
}

type LiveDomTreeBoundaryProps = {
    selectedId: string | null;
    onSelect: (id: string) => void;
    onInspect: (item: LiveDomItem) => void;
};

class LiveDomTreeBoundary extends Component<LiveDomTreeBoundaryProps, { hasError: boolean }> {
    state = { hasError: false };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error("Live DOM tree recovered from a render error", error, info.componentStack);
    }

    render(): ReactNode {
        if (this.state.hasError) {
            return <p className="tree-empty">The live DOM tree was reset after an invalid rendered node.</p>;
        }
        return <LiveDomTree selectedId={this.props.selectedId} onSelect={this.props.onSelect} onInspect={this.props.onInspect} />;
    }
}

function LiveDomItemRow({ item, expanded, selectedId, onToggle, onSelect }: {
    item: LiveDomItem;
    expanded: Set<string>;
    selectedId: string | null;
    onToggle: (item: LiveDomItem) => void;
    onSelect: (item: LiveDomItem) => void;
}) {
    const hasChildren = item.children.length > 0;
    const isOpen = expanded.has(item.key);
    return (
        <li className="live-dom-item">
            <div className={`live-dom-row ${item.editorNodeId === selectedId ? "is-active" : ""}`}>
                {hasChildren ? <button type="button" className="live-dom-toggle" onClick={(event) => { event.stopPropagation(); onToggle(item); }} aria-label={`${isOpen ? "Collapse" : "Expand"} ${item.tag}`}>
                    {isOpen ? "⌄" : "›"}
                </button> : <span className="live-dom-toggle-spacer" />}
                <button type="button" className="live-dom-select" onClick={(event) => { event.stopPropagation(); onSelect(item); }}>
                    <code>&lt;{item.tag}&gt;</code>
                    {item.className && <span className="live-dom-class">.{item.className.split(/\s+/).join(".")}</span>}
                    {item.text && <span className="live-dom-text">{item.text}</span>}
                </button>
            </div>
            {hasChildren && isOpen && <ul className="live-dom-children">
                {item.children.map((child) => <LiveDomItemRow key={child.key} item={child} expanded={expanded} selectedId={selectedId} onToggle={onToggle} onSelect={onSelect} />)}
            </ul>}
        </li>
    );
}

function LiveDomDetails({ item }: { item: LiveDomItem }) {
    return (
        <div className="live-dom-details">
            <strong>Rendered element</strong>
            <code>&lt;{item.tag}{item.id ? ` id="${item.id}"` : ""}{item.className ? ` class="${item.className}"` : ""}&gt;</code>
            <dl>
                <dt>Display</dt><dd>{item.display}</dd>
                <dt>Position</dt><dd>{item.position}</dd>
                <dt>Size</dt><dd>{item.size}</dd>
                {(item.attributes ?? []).map(([name, value]) => <Fragment key={name}><dt>{name}</dt><dd>{value || "(empty)"}</dd></Fragment>)}
            </dl>
        </div>
    );
}

function ElementInspector({ node, liveInfo, readOnly = false, onChange, onDelete }: { node: EditorNode; liveInfo?: LiveDomItem; readOnly?: boolean; onChange: (update: (node: EditorNode) => EditorNode) => void; onDelete: () => void }) {
    return (
        <div className="element-inspector">
            <div className="element-inspector-heading">
                <p>ELEMENT</p>
                <code>&lt;{node.tag}&gt;</code>
                <span>{readOnly ? "Live browser element · source-managed" : "Live browser element"}</span>
            </div>
            {liveInfo ? <details className="inspector-section element-live-section" open>
                <summary>Browser inspect</summary>
                <LiveDomDetails item={liveInfo} />
            </details> : <p className="inspector-empty">The rendered element is not currently available in the canvas.</p>}
            <details className="inspector-section" open>
                <summary>HTML</summary>
                <div className="element-inspector-fields">
                    <label>Tag<input disabled={readOnly} value={node.tag} onChange={(event) => onChange((current) => ({ ...current, tag: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") || "div" }))} /></label>
                    <label>Class<input disabled={readOnly} value={node.props.className ?? ""} onChange={(event) => onChange((current) => ({ ...current, props: { ...current.props, className: event.target.value } }))} /></label>
                    <label>Text content<textarea disabled={readOnly} value={node.props.text ?? ""} onChange={(event) => onChange((current) => ({ ...current, props: { ...current.props, text: event.target.value } }))} /></label>
                    {node.tag === "a" && <label>Href<input disabled={readOnly} value={node.props.href ?? ""} onChange={(event) => onChange((current) => ({ ...current, props: { ...current.props, href: event.target.value } }))} /></label>}
                </div>
            </details>
            <details className="inspector-section" open>
                <summary>Attributes</summary>
                {liveInfo && (liveInfo.attributes ?? []).length > 0 ? <dl className="element-attribute-list">
                    {(liveInfo.attributes ?? []).map(([name, value]) => <Fragment key={name}><dt>{name}</dt><dd>{value || "(empty)"}</dd></Fragment>)}
                </dl> : <p className="inspector-empty">No browser attributes detected.</p>}
            </details>
            <details className="inspector-section" open>
                <summary>Computed styles</summary>
                {liveInfo ? <dl className="element-attribute-list">
                    {(liveInfo.computed ?? []).map(([name, value]) => <Fragment key={name}><dt>{name}</dt><dd>{value}</dd></Fragment>)}
                </dl> : <p className="inspector-empty">No computed styles detected.</p>}
            </details>
            <details className="inspector-section" open>
                <summary>Authored CSS</summary>
                <textarea disabled={readOnly} className="css-code-editor" value={node.props.css ?? ""} aria-label="Element CSS declarations" placeholder="display: block;\ncolor: #222;" onChange={(event) => onChange((current) => ({ ...current, props: { ...current.props, css: event.target.value } }))} />
            </details>
            {!readOnly && <footer className="inspector-actions"><button className="delete-button" onClick={onDelete}>Delete element</button></footer>}
        </div>
    );
}

function inspectCanvasWrapper(wrapper: HTMLElement, path = "wrapper"): LiveDomItem[] {
    const editorNodeId = Array.from(wrapper.classList).find((name) => name.startsWith("editor-node-"))?.slice("editor-node-".length);
    const htmlRoot = wrapper.querySelector<HTMLElement>(":scope > .html-css-content > div");
    if (htmlRoot) return Array.from(htmlRoot.children).map((child, index) => inspectElement(child as HTMLElement, editorNodeId, `${path}-${index}`));
    const directElement = wrapper.querySelector<HTMLElement>(":scope > .canvas-dom-element");
    if (directElement) return [inspectElement(directElement, editorNodeId, `${path}-0`)];
    const container = wrapper.querySelector<HTMLElement>(":scope > .container-content");
    if (container) return [inspectElement(container, editorNodeId, `${path}-0`)];
    const content = Array.from(wrapper.children).find((child) => !child.classList.contains("canvas-node-toolbar") && child.tagName !== "STYLE") as HTMLElement | undefined;
    return content ? [inspectElement(content, editorNodeId, `${path}-0`)] : [];
}

function inspectElement(element: HTMLElement, editorNodeId?: string, path = "0"): LiveDomItem {
    const computed = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const attributes = Array.from(element.attributes)
        .filter((attribute) => attribute.name !== "class" && attribute.name !== "style")
        .slice(0, 12)
        .map((attribute) => [attribute.name, attribute.value] as [string, string]);
    const children = Array.from(element.children)
        .filter((child): child is HTMLElement => child instanceof HTMLElement)
        .flatMap((child, index) => child.classList.contains("canvas-node")
            ? inspectCanvasWrapper(child, `${path}-${index}`)
            : [inspectElement(child, undefined, `${path}-${index}`)]);
    return {
        // Use the DOM traversal path instead of layout/class data. Repeated tags and
        // classes are common, and duplicate React keys made the second expand unstable.
        key: `${editorNodeId ?? "dom"}-${path}`,
        tag: element.tagName.toLowerCase(),
        className: typeof element.className === "string" ? element.className.replace(/\b(canvas-node|canvas-node-toolbar|container-content|html-css-content|canvas-dom-element)\b/g, "").trim() : "",
        id: element.id || undefined,
        text: Array.from(element.childNodes).filter((child) => child.nodeType === Node.TEXT_NODE).map((child) => child.textContent?.trim()).filter(Boolean).join(" ").slice(0, 48),
        attributes,
        display: computed.display,
        computed: [
            ["display", computed.display],
            ["position", computed.position],
            ["width", computed.width],
            ["height", computed.height],
            ["margin", computed.margin],
            ["padding", computed.padding],
            ["color", computed.color],
            ["background", computed.backgroundColor],
            ["font-size", computed.fontSize],
            ["font-family", computed.fontFamily],
            ["line-height", computed.lineHeight],
        ],
        position: `${Math.round(rect.left)}px, ${Math.round(rect.top)}px`,
        size: `${Math.round(rect.width)} × ${Math.round(rect.height)}px`,
        editorNodeId,
        children,
    };
}

function findLiveItem(items: LiveDomItem[], key: string): LiveDomItem | undefined {
    for (const item of items) {
        if (item.key === key) return item;
        const match = findLiveItem(item.children, key);
        if (match) return match;
    }
    return undefined;
}

function sameLiveTree(left: LiveDomItem[], right: LiveDomItem[]): boolean {
    if (left.length !== right.length) return false;
    return left.every((item, index) => {
        const next = right[index];
        return item.key === next.key
            && item.tag === next.tag
            && item.className === next.className
            && item.text === next.text
            && sameLiveTree(item.children, next.children);
    });
}

function TreeIcon({ type }: { type: ComponentType | "page" }) {
    if (type === "page") {
        return <svg className="tree-node-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2h7l3 3v9H3V2Zm7 0v3h3M5 8h6M5 11h6" /></svg>;
    }

    if (type === "heading") {
        return <svg className="tree-node-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3v10M13 3v10M3 8h10M6 3v10M10 3v10" /></svg>;
    }

    if (type === "text") {
        return <svg className="tree-node-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4h10M3 7h7M3 10h10M3 13h6" /></svg>;
    }

    if (type === "image") {
        return <svg className="tree-node-icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="10" rx="1" /><circle cx="5.25" cy="6.25" r="1" /><path d="m3 12 3.5-3 2.25 2 1.5-1.5 2.8 2.5" /></svg>;
    }

    if (type === "button") {
        return <svg className="tree-node-icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="4" width="12" height="8" rx="2" /><path d="M5.5 8h5" /></svg>;
    }

    if (type === "html") {
        return <svg className="tree-node-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="m6 4-3 4 3 4M10 4l3 4-3 4M9 2 7 14" /></svg>;
    }

    return <svg className="tree-node-icon" viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="12" height="12" rx="1" /><path d="M5 5h6v6H5z" /></svg>;
}

type CssMode = "normal" | "children" | "hover" | "click" | "focus" | "after" | "hoverAfter" | "currentAfter";

const standardCssModes: CssMode[] = ["normal", "hover", "click"];
const containerCssModes: CssMode[] = ["normal", "children", "hover", "click"];
const buttonCssModes: CssMode[] = ["normal", "hover", "click", "focus", "after", "hoverAfter", "currentAfter"];
const cssModeProperty: Record<CssMode, "css" | "childrenCss" | "hoverCss" | "activeCss" | "focusCss" | "afterCss" | "hoverAfterCss" | "currentAfterCss"> = {
    normal: "css",
    children: "childrenCss",
    hover: "hoverCss",
    click: "activeCss",
    focus: "focusCss",
    after: "afterCss",
    hoverAfter: "hoverAfterCss",
    currentAfter: "currentAfterCss",
};
const cssModeLabels: Record<CssMode, string> = {
    normal: "Default",
    children: "Children",
    hover: "Hover",
    click: "Pressed",
    focus: "Focus",
    after: "After",
    hoverAfter: "After hover",
    currentAfter: "Current",
};
const cssModeDescriptions: Record<CssMode, string> = {
    normal: "CSS declarations apply by default.",
    children: "CSS declarations apply to this container’s direct child components.",
    hover: "CSS declarations apply while this component is hovered.",
    click: "CSS declarations apply while this component is pressed.",
    focus: "CSS declarations apply while this component has keyboard focus.",
    after: "CSS declarations apply to this button’s ::after element.",
    hoverAfter: "CSS declarations apply to the ::after element while this button is hovered.",
    currentAfter: "CSS declarations apply to the ::after element when this link is the current page.",
};

function parseCssStylesheet(stylesheet: string, supportsButtonStates: boolean, supportsContainerChildren = false): Partial<Record<CssMode, string>> {
    const importedStyles: Partial<Record<CssMode, string>> = {};
    const withoutComments = stylesheet.replace(/\/\*[\s\S]*?\*\//g, "");
    const blocks = withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g);

    for (const block of blocks) {
        const declarations = block[2].trim();
        if (!declarations) continue;

        const modes = new Set<CssMode>();
        for (const selector of block[1].split(",")) {
            const mode = cssModeFromSelector(selector, supportsButtonStates, supportsContainerChildren);
            if (mode) modes.add(mode);
        }

        for (const mode of modes) {
            importedStyles[mode] = importedStyles[mode]
                ? `${importedStyles[mode]}\n${declarations}`
                : declarations;
        }
    }

    return importedStyles;
}

function cssModeFromSelector(selector: string, supportsButtonStates: boolean, supportsContainerChildren = false): CssMode | null {
    const normalized = selector.trim().toLowerCase();
    if (!normalized || normalized.startsWith("@")) return null;

    if (supportsContainerChildren && /(?:\s+|>)\s*(?:div|\*)\b/.test(normalized)) return "children";
    if (supportsButtonStates && /:hover\s*::after/.test(normalized)) return "hoverAfter";
    if (supportsButtonStates && /\[\s*aria-current\s*=\s*(['"]?)page\1\s*\]\s*::after/.test(normalized)) return "currentAfter";
    if (supportsButtonStates && /::after/.test(normalized)) return "after";
    if (/:(focus-visible)\b/.test(normalized)) return "focus";
    if (/:active\b/.test(normalized)) return "click";
    if (/:hover\b/.test(normalized)) return "hover";
    return "normal";
}

type ImportedCssTarget = "css" | "hoverCss" | "activeCss" | "focusCss";

function classCssDefinitions(stylesheet: string) {
    const definitions = new Map<string, Partial<Record<ImportedCssTarget, string>>>();
    const blocks = stylesheet.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g);

    for (const block of blocks) {
        const declarations = block[2].trim();
        if (!declarations) continue;

        for (const selector of block[1].split(",")) {
            const match = /^\.([\w-]+)(?::(hover|active|focus-visible))?$/.exec(selector.trim());
            if (!match) continue;

            const target: ImportedCssTarget = match[2] === "hover"
                ? "hoverCss"
                : match[2] === "active"
                    ? "activeCss"
                    : match[2] === "focus-visible"
                        ? "focusCss"
                        : "css";
            const current = definitions.get(match[1]) ?? {};
            current[target] = current[target] ? `${current[target]}\n${declarations}` : declarations;
            definitions.set(match[1], current);
        }
    }

    return definitions;
}

function attachImportedCss(node: EditorNode, definitions: Map<string, Partial<Record<ImportedCssTarget, string>>>): EditorNode {
    const classNames = node.props.className?.split(/\s+/).filter(Boolean) ?? [];
    const props = { ...node.props };

    for (const className of classNames) {
        const rules = definitions.get(className);
        if (!rules) continue;
        for (const [target, declarations] of Object.entries(rules) as Array<[ImportedCssTarget, string]>) {
            props[target] = props[target] ? `${props[target]}\n${declarations}` : declarations;
        }
    }

    return { ...node, props, children: node.children.map((child) => attachImportedCss(child, definitions)) };
}

function importHtmlComponents(markup: string, stylesheet: string): EditorNode[] {
    const source = new DOMParser().parseFromString(markup, "text/html");

    const fromNode = (sourceNode: ChildNode): EditorNode | null => {
        if (sourceNode.nodeType === Node.TEXT_NODE) {
            const text = sourceNode.textContent?.trim();
            if (!text) return null;
            const node = createNode("text");
            node.props.text = text;
            node.props.layout.display = "inline";
            return node;
        }

        if (!(sourceNode instanceof HTMLElement)) return null;

        const tag = sourceNode.tagName.toLowerCase();
        const className = sourceNode.getAttribute("class") ?? undefined;
        const inlineCss = sourceNode.getAttribute("style") ?? undefined;
        const elementChildren = () => Array.from(sourceNode.children)
            .map(fromNode)
            .filter((child): child is EditorNode => child !== null);
        const withAttributes = (node: EditorNode): EditorNode => ({
            ...node,
            tag,
            props: {
                ...node.props,
                ...(className ? { className } : {}),
                ...(inlineCss ? { css: inlineCss } : {}),
            },
        });

        if (/^h[1-6]$/.test(tag)) {
            const node = createNode("heading");
            node.props.text = sourceNode.textContent?.trim() ?? "";
            node.children = elementChildren();
            return withAttributes(node);
        }

        if (["p", "span", "label", "small", "strong", "em"].includes(tag)) {
            const node = createNode("text");
            node.props.text = sourceNode.textContent?.trim() ?? "";
            if (tag === "span") node.props.layout.display = "inline";
            node.children = elementChildren();
            return withAttributes(node);
        }

        if (tag === "button" || tag === "a") {
            const node = createNode("button");
            node.props.text = sourceNode.textContent?.trim() ?? "Button";
            if (tag === "a") node.props.href = sourceNode.getAttribute("href") ?? "";
            node.children = elementChildren();
            return withAttributes(node);
        }

        if (tag === "img") {
            const node = createNode("image");
            node.props.src = sourceNode.getAttribute("src") ?? "";
            node.props.alt = sourceNode.getAttribute("alt") ?? "";
            return withAttributes(node);
        }

        if (["div", "section", "article", "main", "header", "footer", "nav", "form", "ul", "ol", "li"].includes(tag)) {
            const node = createNode("container");
            node.children = elementChildren();
            return withAttributes(node);
        }

        // Inputs, selects, and other unsupported native tags retain their exact markup.
        const node = createNode("html");
        node.props.html = sourceNode.outerHTML;
        node.props.css = "";
        return withAttributes(node);
    };

    const definitions = classCssDefinitions(stylesheet);
    return Array.from(source.body.childNodes)
        .map(fromNode)
        .filter((node): node is EditorNode => node !== null)
        .map((node) => attachImportedCss(node, definitions));
}

function Inspector({ node, pageCss, liveInfo, onChange, onDelete, onSave, pageSettings = false }: { node: EditorNode; pageCss?: string; liveInfo?: LiveDomItem; onChange: (update: (node: EditorNode) => EditorNode) => void; onDelete: () => void; onSave: () => void; pageSettings?: boolean }) {
    const layout = node.props.layout;
    const isButton = !pageSettings && node.type === "button";
    const isContainer = !pageSettings && node.type === "container";
    const [cssMode, setCssMode] = useState<CssMode>("normal");
    const [cssDrafts, setCssDrafts] = useState({
        normal: node.props.css ?? "",
        children: node.props.childrenCss ?? "",
        hover: node.props.hoverCss ?? "",
        click: node.props.activeCss ?? "",
        focus: node.props.focusCss ?? "",
        after: node.props.afterCss ?? "",
        hoverAfter: node.props.hoverAfterCss ?? "",
        currentAfter: node.props.currentAfterCss ?? "",
    });
    const cssEditorRef = useRef<HTMLTextAreaElement>(null);
    const [cssCompletion, setCssCompletion] = useState<CssCompletion | null>(null);
    const [autoApplyCss, setAutoApplyCss] = useState(false);
    const [cssSettingsOpen, setCssSettingsOpen] = useState(false);
    const [inspectorSection, setInspectorSection] = useState<"design" | "logic" | "advanced">("design");
    const [htmlImportDraft, setHtmlImportDraft] = useState("");
    const [htmlImportCssDraft, setHtmlImportCssDraft] = useState("");
    const cssDraft = cssDrafts[cssMode];
    const cssProperty = cssModeProperty[cssMode];
    const savedCss = node.props[cssProperty] ?? "";
    const cssModes = isButton ? buttonCssModes : isContainer ? containerCssModes : standardCssModes;
    const isFlexLayout = layout.display === "flex" || layout.display === "inline-flex";
    const isGridLayout = layout.display === "grid" || layout.display === "inline-grid";
    const updateLayout = (key: keyof Layout, value: string | boolean) => {
        onChange((current) => {
            const nextLayout = { ...current.props.layout, [key]: value };

            // New containers have a minimum height so they are easy to target. An explicit
            // height must take precedence, including when it is smaller than that default.
            if (key === "height" && typeof value === "string" && value.trim()) delete nextLayout.minHeight;

            return {
                ...current,
                props: { ...current.props, layout: nextLayout },
            };
        });
    };

    const updateCssDraft = (css: string) => {
        setCssDrafts((currentDrafts) => ({ ...currentDrafts, [cssMode]: css }));
        if (autoApplyCss) applyCssValue(css);
    };

    const applyCssValue = (css: string) => {
        onChange((current) => ({
            ...current,
            props: { ...current.props, [cssProperty]: css },
        }));
    };

    const applyCss = () => applyCssValue(cssDraft);

    const importCssStylesheet = (stylesheet: string) => {
        const importedStyles = parseCssStylesheet(stylesheet, isButton, isContainer);
        if (Object.keys(importedStyles).length === 0) return false;

        setCssDrafts((currentDrafts) => ({ ...currentDrafts, ...importedStyles }));
        onChange((current) => {
            const nextProps = { ...current.props };
            for (const [mode, css] of Object.entries(importedStyles) as Array<[CssMode, string]>) {
                nextProps[cssModeProperty[mode]] = css;
            }
            return { ...current, props: nextProps };
        });
        setCssMode("normal");
        setCssCompletion(null);
        return true;
    };

    const toggleAutoApplyCss = () => {
        if (!autoApplyCss) applyCss();
        setAutoApplyCss(!autoApplyCss);
    };

    const clearAllCss = () => {
        setCssDrafts({ normal: "", children: "", hover: "", click: "", focus: "", after: "", hoverAfter: "", currentAfter: "" });
        setCssCompletion(null);
        setCssSettingsOpen(false);
        onChange((current) => ({
            ...current,
            props: {
                ...current.props,
                css: "",
                childrenCss: "",
                hoverCss: "",
                activeCss: "",
                focusCss: "",
                afterCss: "",
                hoverAfterCss: "",
                currentAfterCss: "",
            },
        }));
    };

    const selectCssMode = (nextMode: CssMode) => {
        setCssMode(nextMode);
        setCssCompletion(null);
        requestAnimationFrame(() => cssEditorRef.current?.focus());
    };

    const focusCssEditor = () => {
        const nextCss = cssDraft && !cssDraft.endsWith("\n") ? `${cssDraft}\n` : cssDraft;
        if (nextCss !== cssDraft) updateCssDraft(nextCss);

        requestAnimationFrame(() => {
            const editor = cssEditorRef.current;
            if (!editor) return;
            editor.focus();
            editor.setSelectionRange(nextCss.length, nextCss.length);
        });
    };

    const updateCssCompletion = (value: string, caret: number) => {
        setCssCompletion(findCssCompletion(value, caret, pageSettings));
    };

    const acceptCssCompletion = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
            event.preventDefault();
            applyCss();
            return;
        }

        if (event.key !== "Tab") return;

        const completion = findCssCompletion(event.currentTarget.value, event.currentTarget.selectionStart, pageSettings);
        if (!completion) return;

        event.preventDefault();
        const currentCss = event.currentTarget.value;
        const nextCss = `${currentCss.slice(0, completion.start)}${completion.suggestion}${completion.suffix}${currentCss.slice(completion.end)}`;
        const nextCaret = completion.start + completion.suggestion.length + completion.suffix.length;
        updateCssDraft(nextCss);
        setCssCompletion(null);

        requestAnimationFrame(() => {
            cssEditorRef.current?.setSelectionRange(nextCaret, nextCaret);
        });
    };

    const injectHtmlComponents = () => {
        if (!htmlImportDraft.trim()) return;

        const domNodes = importHtmlComponents(htmlImportDraft, htmlImportCssDraft).map(asDomElementNode);
        if (domNodes.length === 0) return;

        // Keep the authored markup as the render source, while storing the
        // parsed DOM nodes as children so the DOM panel can inspect and edit
        // the same structure without losing selectors, pseudo-elements, or
        // responsive rules.
        const importedNode = createNode("html");
        importedNode.props = {
            ...importedNode.props,
            html: htmlImportDraft,
            css: htmlImportCssDraft,
            layout: { display: "block", width: "100%", margin: "0", padding: "0" },
        };
        importedNode.tag = domNodes.length === 1 ? domNodes[0].tag : "fragment";
        importedNode.props.className = domNodes.length === 1 ? domNodes[0].props.className : undefined;
        importedNode.children = domNodes.length === 1 ? domNodes[0].children : domNodes;

        onChange((current) => ({ ...current, children: [...current.children, importedNode] }));
        setHtmlImportDraft("");
        setHtmlImportCssDraft("");
    };

    if (!pageSettings && node.type === "html") {
        return (
            <div className="inspector-fields html-css-inspector">
                {liveInfo && <details className="inspector-section browser-inspect-section" open>
                    <summary>Browser inspect</summary>
                    <LiveDomDetails item={liveInfo} />
                </details>}
                <p className="inspector-type">HTML/CSS</p>
                <label>
                    .html file
                    <textarea
                        className="css-code-editor html-css-code-input"
                        value={node.props.html ?? ""}
                        spellCheck={false}
                        onChange={(event) => onChange((current) => ({ ...current, props: { ...current.props, html: event.target.value } }))}
                    />
                </label>
                <label>
                    .css file
                    <textarea
                        className="css-code-editor html-css-code-input"
                        value={node.props.css ?? ""}
                        spellCheck={false}
                        onChange={(event) => onChange((current) => ({ ...current, props: { ...current.props, css: event.target.value } }))}
                    />
                </label>
            </div>
        );
    }

    return (
        <div className="inspector-fields">
            {liveInfo && <details className="inspector-section browser-inspect-section" open>
                <summary>Browser inspect</summary>
                <LiveDomDetails item={liveInfo} />
            </details>}
            <div className="inspector-workspace">
                <nav className="inspector-menu" aria-label="Inspector sections">
                    <button className={inspectorSection === "design" ? "is-active" : ""} type="button" onClick={() => setInspectorSection("design")}>Design</button>
                    <button className={inspectorSection === "logic" ? "is-active" : ""} type="button" onClick={() => setInspectorSection("logic")}>Logic</button>
                    <button className={inspectorSection === "advanced" ? "is-active" : ""} type="button" onClick={() => setInspectorSection("advanced")}>Advanced</button>
                </nav>
                <div className="inspector-panel">
            {inspectorSection === "design" && <>
            <p className="inspector-type">{pageSettings ? "PAGE" : `<${node.tag}> · ${componentLabels[node.type]}`}</p>
            {(node.type === "heading" || node.type === "text" || node.type === "button" || node.type === "element") && (
                <details className="inspector-section content-section">
                    <summary>Content</summary>
                    <div className="content-section-content">
                        <label>
                            {node.type === "element" ? "Text or value" : "Text"}
                            <textarea value={node.props.text ?? ""} onChange={(event) => onChange((current) => ({ ...current, props: { ...current.props, text: event.target.value } }))} />
                        </label>
                    </div>
                </details>
            )}
            {node.type === "image" && (
                <label>
                    Alt text
                    <input value={node.props.alt ?? ""} onChange={(event) => onChange((current) => ({ ...current, props: { ...current.props, alt: event.target.value } }))} />
                </label>
            )}

            {!pageSettings && <details className="inspector-section layout-section">
                <summary>Layout</summary>
                <div className="layout-section-content">
                <label>
                    Display
                    <input
                        list="display-values"
                        value={layout.display ?? "block"}
                        placeholder="block, inline-grid, flex..."
                        onChange={(event) => updateLayout("display", event.target.value)}
                    />
                    <datalist id="display-values">
                        <option value="block" />
                        <option value="inline" />
                        <option value="inline-block" />
                        <option value="flex" />
                        <option value="inline-flex" />
                        <option value="grid" />
                        <option value="inline-grid" />
                        <option value="flow-root" />
                        <option value="contents" />
                        <option value="list-item" />
                        <option value="table" />
                        <option value="table-row" />
                        <option value="table-cell" />
                        <option value="none" />
                        <option value="inherit" />
                        <option value="initial" />
                        <option value="unset" />
                        <option value="revert" />
                    </datalist>
                </label>

                {layoutInputs.filter(({ key }) => layout.display !== "block" || key !== "width").map(({ key, label, placeholder }) => (
                    <label key={key}>
                        {label}
                        <input value={layout[key] ?? ""} placeholder={placeholder} onChange={(event) => updateLayout(key, event.target.value)} />
                    </label>
                ))}

                {node.type === "container" && (
                    <fieldset className="scroll-settings">
                        <legend>Scrolling</legend>
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={layout.scrollable ?? false}
                                onChange={(event) => updateLayout("scrollable", event.target.checked)}
                            />
                            Scrollable content
                        </label>
                        {layout.scrollable && (
                            <div className="scroll-axis-options" aria-label="Scrollable axes">
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={layout.scrollX !== false}
                                        onChange={(event) => updateLayout("scrollX", event.target.checked)}
                                    />
                                    Horizontal (X)
                                </label>
                                <label className="checkbox-label">
                                    <input
                                        type="checkbox"
                                        checked={layout.scrollY !== false}
                                        onChange={(event) => updateLayout("scrollY", event.target.checked)}
                                    />
                                    Vertical (Y)
                                </label>
                            </div>
                        )}
                    </fieldset>
                )}

                {(isFlexLayout || isGridLayout) && (
                    <>
                        {isFlexLayout && (
                            <label>
                                Direction
                                <select value={layout.flexDirection ?? "row"} onChange={(event) => updateLayout("flexDirection", event.target.value)}>
                                    <option value="row">Row</option>
                                    <option value="column">Column</option>
                                </select>
                            </label>
                        )}
                        {isGridLayout && (
                            <label>
                                Grid columns
                                <input value={layout.gridTemplateColumns ?? ""} placeholder="1fr 1fr" onChange={(event) => updateLayout("gridTemplateColumns", event.target.value)} />
                            </label>
                        )}
                    </>
                )}
                </div>
            </details>}
            <details
                className="inspector-section css-style-section"
                open
                onToggle={(event) => {
                    if (event.currentTarget.open) focusCssEditor();
                }}
            >
                <summary>CSS style</summary>
                <div className="css-style-content">
                    <div className={`css-mode-tabs ${isButton ? "css-mode-tabs--button" : ""}`} role="tablist" aria-label="CSS style mode">
                        {cssModes.map((mode) => (
                            <button
                                key={mode}
                                className={cssMode === mode ? "is-active" : ""}
                                type="button"
                                role="tab"
                                aria-selected={cssMode === mode}
                                onClick={() => selectCssMode(mode)}
                            >
                                {cssModeLabels[mode]}
                            </button>
                        ))}
                    </div>
                    <div className="css-style-heading">
                        <p>{cssModeDescriptions[cssMode]}</p>
                        <div className="css-style-actions">
                            <button
                                className={`css-settings-button ${cssSettingsOpen ? "is-active" : ""}`}
                                type="button"
                                aria-label="CSS settings"
                                aria-expanded={cssSettingsOpen}
                                title="CSS settings"
                                onClick={() => setCssSettingsOpen((isOpen) => !isOpen)}
                            >
                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.9 1.9-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V20h-2.7v-.1a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-1.9-1.9.06-.06A1.7 1.7 0 0 0 7.76 15a1.7 1.7 0 0 0-1.56-1.03H6.1v-2.7h.1A1.7 1.7 0 0 0 7.76 10a1.7 1.7 0 0 0-.34-1.88l-.06-.06 1.9-1.9.06.06A1.7 1.7 0 0 0 11.2 6.56 1.7 1.7 0 0 0 12.23 5h2.7v.1A1.7 1.7 0 0 0 15.96 6.66a1.7 1.7 0 0 0 1.88-.34l.06-.06 1.9 1.9-.06.06A1.7 1.7 0 0 0 19.4 10a1.7 1.7 0 0 0 1.56 1.03h.1v2.7h-.1A1.7 1.7 0 0 0 19.4 15Z" /></svg>
                            </button>
                            {cssSettingsOpen && <div className="css-settings-menu" role="menu" aria-label="CSS settings">
                                <button
                                    className={`auto-apply-css-button ${autoApplyCss ? "is-active" : ""}`}
                                    type="button"
                                    role="menuitemcheckbox"
                                    aria-checked={autoApplyCss}
                                    onClick={toggleAutoApplyCss}
                                >
                                    Instant apply {autoApplyCss ? "on" : "off"}
                                </button>
                                <button className="clear-css-button" type="button" role="menuitem" onClick={clearAllCss}>Clear all CSS</button>
                            </div>}
                            <button
                                className="apply-css-button"
                                disabled={cssDraft === savedCss}
                                onClick={applyCss}
                                aria-label={`Apply ${cssMode === "normal" ? "CSS" : `${cssModeLabels[cssMode]} CSS`}`}
                                title={`Apply ${cssMode === "normal" ? "CSS" : `${cssModeLabels[cssMode]} CSS`}`}
                            >
                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7" /></svg>
                            </button>
                        </div>
                    </div>
                    <textarea
                        className="css-code-editor"
                        ref={cssEditorRef}
                        aria-label="CSS style declarations"
                        value={cssDraft}
                        placeholder={"background-color: rgba(124, 58, 237, 0.2);\nborder-radius: 12px;"}
                        spellCheck={false}
                        aria-describedby={cssCompletion ? "css-completion-hint" : undefined}
                        onChange={(event) => {
                            updateCssDraft(event.target.value);
                            updateCssCompletion(event.target.value, event.target.selectionStart);
                        }}
                        onPaste={(event) => {
                            const stylesheet = event.clipboardData.getData("text");
                            if (importCssStylesheet(stylesheet)) event.preventDefault();
                        }}
                        onKeyDown={acceptCssCompletion}
                        onSelect={(event) => updateCssCompletion(event.currentTarget.value, event.currentTarget.selectionStart)}
                    />
                    {cssCompletion && (
                        <div id="css-completion-hint" className="css-completion-hint" aria-live="polite">
                            <span>{cssCompletion.typed}</span><span className="css-completion-ghost">{cssCompletion.suggestion.slice(cssCompletion.typed.length)}</span>
                            <kbd>Tab</kbd>
                        </div>
                    )}
                    <CssColorSwatches css={cssDraft} variableCss={pageCss} onChange={updateCssDraft} />
                </div>
            </details>
            </>}
            {inspectorSection === "logic" && (
                <>
                    <p className="inspector-type">Logic</p>
                    {isButton ? (
                        <>
                            <label>
                                Link URL
                                <input value={node.props.href ?? ""} placeholder="/about or https://example.com" onChange={(event) => onChange((current) => ({ ...current, props: { ...current.props, href: event.target.value } }))} />
                            </label>
                            <label className="checkbox-label">
                                <input type="checkbox" checked={node.props.ariaCurrent ?? false} onChange={(event) => onChange((current) => ({ ...current, props: { ...current.props, ariaCurrent: event.target.checked } }))} />
                                Current page link
                            </label>
                        </>
                    ) : <p className="inspector-empty">No logic settings are available for this component yet.</p>}
                </>
            )}
            {inspectorSection === "advanced" && (
                <>
                    <p className="inspector-type">Advanced</p>
                    {!pageSettings && <label>
                        Class name
                        <input
                            value={node.props.className ?? ""}
                            placeholder="header-nav"
                            onChange={(event) => onChange((current) => ({ ...current, props: { ...current.props, className: event.target.value } }))}
                        />
                    </label>}
                    {!pageSettings && node.type === "element" && <label>
                        HTML tag
                        <input value={node.tag} onChange={(event) => onChange((current) => ({ ...current, tag: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") || "div" }))} />
                    </label>}
                    {isContainer && <>
                        <details className="inspector-section html-import-section">
                                <summary>Create DOM from HTML + CSS</summary>
                            <div className="content-section-content">
                                <p className="inspector-empty">Paste your markup and stylesheet. The editor creates a DOM tree from the HTML and keeps the original HTML/CSS as the exact render source.</p>
                                <label>
                                    HTML markup
                                    <textarea
                                        className="css-code-editor html-import-input"
                                        value={htmlImportDraft}
                                        placeholder={'<div class="header-nav">\n  <button>Home</button>\n</div>'}
                                        spellCheck={false}
                                        onChange={(event) => setHtmlImportDraft(event.target.value)}
                                    />
                                </label>
                                <label>
                                    CSS stylesheet
                                    <textarea
                                        className="css-code-editor html-import-input"
                                        value={htmlImportCssDraft}
                                        placeholder={".header-nav {\n  display: flex;\n  gap: 16px;\n}"}
                                        spellCheck={false}
                                        onChange={(event) => setHtmlImportCssDraft(event.target.value)}
                                    />
                                </label>
                                <button type="button" className="html-import-button" onClick={injectHtmlComponents} disabled={!htmlImportDraft.trim()}>Create DOM structure</button>
                            </div>
                        </details>
                    </>}
                </>
            )}
                </div>
            </div>
            {!pageSettings && <footer className="inspector-actions">
                <button className="save-component-button" onClick={onSave}>Save component</button>
                <button className="delete-button" onClick={onDelete}>Delete component</button>
            </footer>}
        </div>
    );
}

type CssColor = {
    alpha: string;
    end: number;
    hex: string;
    kind: "hex" | "named" | "rgb" | "variable";
    start: number;
    value: string;
};

type PendingCssColor = {
    alpha: string;
    end: number;
    functionName: "rgb" | "rgba";
    hex: string;
    start: number;
};

type CssCompletion = {
    end: number;
    start: number;
    suggestion: string;
    suffix: string;
    typed: string;
};

function findCssCompletion(css: string, caret: number, includePageKeywords = false): CssCompletion | null {
    const beforeCaret = css.slice(0, caret);
    const atRuleMatch = beforeCaret.match(/(?:^|\n)\s*(@[a-z-]*)$/i);
    if (includePageKeywords && atRuleMatch) return createCssCompletion(atRuleMatch[1], caret, pageCssSuggestions, " ");

    const colorMatch = beforeCaret.match(/:\s*([a-z-]{1,})$/i);
    if (colorMatch) return createCssCompletion(colorMatch[1], caret, cssColorSuggestions, "");

    const propertyMatch = beforeCaret.match(/(?:^|[;\n]\s*)([a-z-]{2,})$/i);
    if (!propertyMatch) return null;

    return createCssCompletion(propertyMatch[1], caret, cssPropertySuggestions, ": ");
}

function createCssCompletion(typedValue: string, caret: number, suggestions: string[], suffix: string): CssCompletion | null {
    const typed = typedValue.toLowerCase();
    const suggestion = suggestions.find((item) => item.startsWith(typed) && item !== typed);
    if (!suggestion) return null;

    return {
        end: caret,
        start: caret - typed.length,
        suggestion,
        suffix,
        typed,
    };
}

const cssNamedColorValues: Record<string, string> = {
    aqua: "#00ffff", beige: "#f5f5dc", black: "#000000", blue: "#0000ff", brown: "#a52a2a",
    coral: "#ff7f50", crimson: "#dc143c", cyan: "#00ffff", fuchsia: "#ff00ff", gold: "#ffd700",
    gray: "#808080", green: "#008000", grey: "#808080", indigo: "#4b0082", ivory: "#fffff0",
    khaki: "#f0e68c", lavender: "#e6e6fa", lime: "#00ff00", magenta: "#ff00ff", maroon: "#800000",
    navy: "#000080", olive: "#808000", orange: "#ffa500", pink: "#ffc0cb", purple: "#800080",
    rebeccapurple: "#663399", red: "#ff0000", salmon: "#fa8072", silver: "#c0c0c0", teal: "#008080",
    tomato: "#ff6347", transparent: "#000000", turquoise: "#40e0d0", violet: "#ee82ee", white: "#ffffff",
    yellow: "#ffff00",
};

function CssColorSwatches({ css, variableCss = "", onChange }: { css: string; variableCss?: string; onChange: (css: string) => void }) {
    const colors = findCssColors(css, variableCss);
    const pendingColor = findPendingCssColor(css);

    if (colors.length === 0 && !pendingColor) return null;

    return (
        <div className="css-color-list" aria-label="Detected CSS colors">
            <span>Detected colors</span>
            {colors.map((color, index) => (
                <label key={`${color.value}-${index}`} className="css-color-swatch" style={{ backgroundColor: color.value }} title={`Edit ${color.value}`}>
                    <input
                        type="color"
                        value={color.hex}
                        aria-label={`Edit ${color.value}`}
                        onChange={(event) => onChange(replaceCssColor(css, color, event.target.value))}
                    />
                    <code>{color.value}</code>
                </label>
            ))}
            {pendingColor && (
                <label className="css-color-swatch css-color-swatch--pending" style={{ backgroundColor: pendingColor.hex }} title={`Choose a ${pendingColor.functionName.toUpperCase()} color`}>
                    <input
                        type="color"
                        value={pendingColor.hex}
                        aria-label={`Choose a ${pendingColor.functionName.toUpperCase()} color`}
                        onChange={(event) => onChange(replacePendingCssColor(css, pendingColor, event.target.value))}
                    />
                    <code>Choose {pendingColor.functionName.toUpperCase()} color</code>
                </label>
            )}
        </div>
    );
}

function findCssColors(css: string, variableCss = ""): CssColor[] {
    const variables = cssVariables(`${variableCss}\n${css}`);
    const colors: CssColor[] = [];
    const addColor = (match: RegExpExecArray, hex: string, alpha: string, kind: CssColor["kind"]) => {
        colors.push({ alpha, end: match.index + match[0].length, hex, kind, start: match.index, value: match[0] });
    };

    for (const match of css.matchAll(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([\d.]+))?\s*\)/gi)) {
        addColor(match, rgbToHex(Number(match[1]), Number(match[2]), Number(match[3])), match[4] ?? "1", "rgb");
    }

    for (const match of css.matchAll(/#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})\b/gi)) {
        const parsed = hexColor(match[0]);
        if (parsed) addColor(match, parsed.hex, parsed.alpha, "hex");
    }

    for (const match of css.matchAll(/\b([a-z]+)\b/gi)) {
        if (css.slice(Math.max(0, match.index - 2), match.index) === "--") continue;
        const hex = cssNamedColorValues[match[1].toLowerCase()];
        if (hex) addColor(match, hex, "1", "named");
    }

    for (const match of css.matchAll(/var\(\s*(--[\w-]+)(?:\s*,\s*([^)]*))?\s*\)/gi)) {
        const resolved = resolveCssColor(variables.get(match[1]) ?? match[2] ?? "", variables);
        if (resolved) addColor(match, resolved.hex, resolved.alpha, "variable");
    }

    return colors.sort((first, second) => first.start - second.start || first.end - second.end)
        .filter((color, index, all) => index === 0 || color.start >= all[index - 1].end);
}

function findPendingCssColor(css: string): PendingCssColor | null {
    const match = /(?:^|[;:\s])(rgba?)\s*(?:\(([^)]*)?)?$/i.exec(css);
    if (!match) return null;

    const functionName = match[1].toLowerCase() as "rgb" | "rgba";
    const functionOffset = match[0].indexOf(match[1]);
    const values = (match[2] ?? "").split(",").map((value) => Number.parseFloat(value.trim()));
    const [red = 0, green = 0, blue = 0] = values.map((value) => Number.isFinite(value) ? value : 0);
    const alpha = functionName === "rgba" && Number.isFinite(values[3]) ? String(values[3]) : "1";

    return {
        alpha,
        end: css.length,
        functionName,
        hex: rgbToHex(red, green, blue),
        start: (match.index ?? 0) + functionOffset,
    };
}

function replaceCssColor(css: string, color: CssColor, hex: string) {
    const [red, green, blue] = hexToRgb(hex);
    const value = color.kind === "rgb" ? `rgba(${red}, ${green}, ${blue}, ${color.alpha})` : hex;
    return `${css.slice(0, color.start)}${value}${css.slice(color.end)}`;
}

function cssVariables(css: string) {
    const variables = new Map<string, string>();
    for (const match of css.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)) variables.set(match[1], match[2].trim());
    return variables;
}

function resolveCssColor(value: string, variables: Map<string, string>, visited = new Set<string>()): { alpha: string; hex: string } | null {
    const trimmed = value.trim();
    const variable = /^var\(\s*(--[\w-]+)(?:\s*,\s*([^)]*))?\s*\)$/i.exec(trimmed);
    if (variable) {
        if (visited.has(variable[1])) return null;
        visited.add(variable[1]);
        return resolveCssColor(variables.get(variable[1]) ?? variable[2] ?? "", variables, visited);
    }

    const parsedHex = hexColor(trimmed);
    if (parsedHex) return parsedHex;

    const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(trimmed);
    if (rgb) return { alpha: rgb[4] ?? "1", hex: rgbToHex(Number(rgb[1]), Number(rgb[2]), Number(rgb[3])) };

    const namedHex = cssNamedColorValues[trimmed.toLowerCase()];
    return namedHex ? { alpha: "1", hex: namedHex } : null;
}

function hexColor(value: string): { alpha: string; hex: string } | null {
    const match = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.exec(value);
    if (!match) return null;

    const raw = match[1];
    const expanded = raw.length <= 4 ? raw.split("").map((item) => `${item}${item}`).join("") : raw;
    return {
        alpha: expanded.length === 8 ? String(Math.round((Number.parseInt(expanded.slice(6, 8), 16) / 255) * 100) / 100) : "1",
        hex: `#${expanded.slice(0, 6)}`,
    };
}

function replacePendingCssColor(css: string, pendingColor: PendingCssColor, hex: string) {
    const [red, green, blue] = hexToRgb(hex);
    const value = pendingColor.functionName === "rgba"
        ? `rgba(${red}, ${green}, ${blue}, ${pendingColor.alpha})`
        : `rgb(${red}, ${green}, ${blue})`;

    return `${css.slice(0, pendingColor.start)}${value}${css.slice(pendingColor.end)}`;
}

function rgbToHex(red: number, green: number, blue: number) {
    return `#${[red, green, blue].map((value) => Math.min(255, Math.max(0, value)).toString(16).padStart(2, "0")).join("")}`;
}

function hexToRgb(hex: string) {
    return [
        Number.parseInt(hex.slice(1, 3), 16),
        Number.parseInt(hex.slice(3, 5), 16),
        Number.parseInt(hex.slice(5, 7), 16),
    ];
}
