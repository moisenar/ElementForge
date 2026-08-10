import {
    defaultDocument,
    RESOURCES_STORAGE_KEY,
    STORAGE_KEY,
    UNIQUE_STORAGE_KEY,
    defaultTagByType,
    type EditorDocument,
    type EditorNode,
    type ImageResource,
    type UniqueComponent,
} from "./types";

function normalizeNode(node: EditorNode): EditorNode {
    return { ...node, tag: node.tag || defaultTagByType[node.type], children: node.children.map(normalizeNode) };
}

function normalizeDocument(document: EditorDocument): EditorDocument {
    return { ...document, nodes: document.nodes.map(normalizeImportedDomTree) };
}

function convertImportedDomNode(node: EditorNode): EditorNode {
    return { ...node, type: "element", children: node.children.map(convertImportedDomNode) };
}

function normalizeImportedDomTree(node: EditorNode): EditorNode {
    const normalized = normalizeNode(node);
    if (normalized.type === "html" && normalized.props.html && normalized.children.length > 0) {
        return { ...normalized, children: normalized.children.map(convertImportedDomNode) };
    }
    return normalized;
}

export const PAGES_STORAGE_KEY = "custom-page-editor-pages";

export type SessionSnapshot = {
    version: 1;
    savedAt: string;
    pages: ManagedPage[];
    resources: ImageResource[];
    uniqueComponents: UniqueComponent[];
};

let loadedSession: SessionSnapshot | null = null;
let sessionWrite: Promise<void> = Promise.resolve();

export async function initializeSession() {
    try {
        const response = await fetch("/api/session", { headers: { Accept: "application/json" } });
        if (!response.ok) return;
        const snapshot = await response.json() as Partial<SessionSnapshot>;
        if (snapshot.version !== 1 || !Array.isArray(snapshot.pages)) return;
        loadedSession = {
            version: 1,
            savedAt: typeof snapshot.savedAt === "string" ? snapshot.savedAt : new Date().toISOString(),
            pages: snapshot.pages.map((page) => ({ ...page, document: normalizeDocument(page.document) })),
            resources: Array.isArray(snapshot.resources) ? snapshot.resources : [],
            uniqueComponents: Array.isArray(snapshot.uniqueComponents)
                ? snapshot.uniqueComponents.map((component) => ({ ...component, node: normalizeNode(component.node) }))
                : [],
        };
    } catch {
        // Static builds and servers without the local session endpoint use browser storage.
    }
}

function persistSession() {
    if (!loadedSession) return;
    const snapshot = { ...loadedSession, savedAt: new Date().toISOString() };
    loadedSession = snapshot;
    sessionWrite = sessionWrite.then(async () => {
        try {
            await fetch("/api/session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(snapshot),
            });
        } catch {
            // Keep local editing usable if the dev server is unavailable.
        }
    });
}

export type ManagedPage = {
    document: EditorDocument;
    id: string;
    slug: string;
    title: string;
    updatedAt: string;
};

export function loadDocument(): EditorDocument {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? normalizeDocument(JSON.parse(saved) as EditorDocument) : defaultDocument;
    } catch {
        return defaultDocument;
    }
}

export function saveDocument(document: EditorDocument) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(document));
}

export function loadPages(): ManagedPage[] {
    if (loadedSession) return loadedSession.pages;
    try {
        const saved = localStorage.getItem(PAGES_STORAGE_KEY);
        if (saved) {
            const pages = JSON.parse(saved) as ManagedPage[];
            if (Array.isArray(pages) && pages.length > 0) return pages.map((page) => ({ ...page, document: normalizeDocument(page.document) }));
        }
    } catch {
        // Fall through to the one-time migration below.
    }

    const initialPages = [{
        document: loadDocument(),
        id: "home",
        slug: "/",
        title: "Home",
        updatedAt: new Date().toISOString(),
    }];

    // Loading the dashboard must never depend on being allowed to write to
    // localStorage. The initial collection is persisted on the first edit.
    return initialPages;
}

export function savePages(pages: ManagedPage[]) {
    try {
        localStorage.setItem(PAGES_STORAGE_KEY, JSON.stringify(pages));
    } catch {
        // Keep the current editor session usable when browser storage is
        // unavailable or full. The page list remains in React state.
    }
    if (loadedSession) {
        loadedSession.pages = pages;
        persistSession();
    }
}

export function loadPageDocument(pageId = "home"): EditorDocument {
    const pages = loadPages();
    return normalizeDocument(pages.find((page) => page.id === pageId)?.document
        ?? pages.find((page) => page.id === "home")?.document
        ?? pages[0]?.document
        ?? defaultDocument);
}

export function savePageDocument(pageId: string, document: EditorDocument) {
    const pages = loadPages();
    const nextPages = pages.map((page) => page.id === pageId ? {
        ...page,
        document,
        updatedAt: new Date().toISOString(),
    } : page);
    savePages(nextPages);

    if (pageId === "home") saveDocument(document);
}

function loadCollection<T>(key: string): T[] {
    try {
        const saved = localStorage.getItem(key);
        return saved ? (JSON.parse(saved) as T[]) : [];
    } catch {
        return [];
    }
}

export function loadResources() {
    if (loadedSession) return loadedSession.resources;
    return loadCollection<ImageResource>(RESOURCES_STORAGE_KEY);
}

export function saveResources(resources: ImageResource[]) {
    localStorage.setItem(RESOURCES_STORAGE_KEY, JSON.stringify(resources));
    if (loadedSession) {
        loadedSession.resources = resources;
        persistSession();
    }
}

export function loadUniqueComponents() {
    if (loadedSession) return loadedSession.uniqueComponents;
    return loadCollection<UniqueComponent>(UNIQUE_STORAGE_KEY).map((component) => ({ ...component, node: normalizeNode(component.node) }));
}

export function saveUniqueComponents(components: UniqueComponent[]) {
    localStorage.setItem(UNIQUE_STORAGE_KEY, JSON.stringify(components));
    if (loadedSession) {
        loadedSession.uniqueComponents = components;
        persistSession();
    }
}
