export type ComponentType = "heading" | "text" | "container" | "image" | "button" | "html" | "element";

export type Layout = {
    display?: string;
    width?: string;
    height?: string;
    minWidth?: string;
    maxWidth?: string;
    minHeight?: string;
    margin?: string;
    padding?: string;
    gap?: string;
    flexDirection?: string;
    flexWrap?: string;
    justifyContent?: string;
    alignItems?: string;
    gridTemplateColumns?: string;
    verticalAlign?: string;
    scrollable?: boolean;
    scrollX?: boolean;
    scrollY?: boolean;
};

export type EditorNode = {
    id: string;
    tag: string;
    type: ComponentType;
    props: {
        text?: string;
        html?: string;
        className?: string;
        src?: string;
        alt?: string;
        resourceId?: string;
        css?: string;
        childrenCss?: string;
        hoverCss?: string;
        activeCss?: string;
        focusCss?: string;
        afterCss?: string;
        hoverAfterCss?: string;
        currentAfterCss?: string;
        href?: string;
        ariaCurrent?: boolean;
        layout: Layout;
    };
    children: EditorNode[];
};

export type EditorDocument = {
    nodes: EditorNode[];
    pageCss?: string;
    pageHoverCss?: string;
    pageActiveCss?: string;
};

export const STORAGE_KEY = "custom-page-editor-data";
export const RESOURCES_STORAGE_KEY = "custom-page-editor-resources";
export const UNIQUE_STORAGE_KEY = "custom-page-editor-unique";

export type ImageResource = {
    id: string;
    name: string;
    src: string;
};

export type UniqueComponent = {
    id: string;
    name: string;
    node: EditorNode;
};

export const defaultDocument: EditorDocument = {
    nodes: [],
};

export const componentLabels: Record<ComponentType, string> = {
    heading: "Heading",
    text: "Text",
    container: "Container",
    image: "Image",
    button: "Button",
    html: "HTML/CSS",
    element: "DOM element",
};

export const defaultTagByType: Record<ComponentType, string> = {
    heading: "h1",
    text: "p",
    container: "div",
    image: "img",
    button: "button",
    html: "div",
    element: "div",
};

export function createNode(type: ComponentType): EditorNode {
    const id = crypto.randomUUID();

    if (type === "heading") {
        return {
            id,
            tag: "h1",
            type,
            props: {
                text: "New heading",
                layout: { display: "inline-block", verticalAlign: "top", margin: "0", padding: "0" },
            },
            children: [],
        };
    }

    if (type === "text") {
        return {
            id,
            tag: "p",
            type,
            props: {
                text: "Write your text here.",
                layout: { display: "inline-block", verticalAlign: "top", margin: "0", padding: "0" },
            },
            children: [],
        };
    }

    if (type === "image") {
        return {
            id,
            tag: "img",
            type,
            props: {
                alt: "Image",
                layout: { display: "inline-block", verticalAlign: "top", maxWidth: "100%", margin: "0", padding: "0" },
            },
            children: [],
        };
    }

    if (type === "button") {
        return {
            id,
            tag: "button",
            type,
            props: {
                text: "Button",
                layout: { display: "inline-block", verticalAlign: "top", margin: "0", padding: "0" },
            },
            children: [],
        };
    }

    if (type === "html") {
        return {
            id,
            tag: "div",
            type,
            props: {
                html: "<p>Write your HTML here.</p>",
                css: "p { margin: 0; }",
                layout: { display: "block", width: "100%", height: "200px", margin: "0", padding: "0" },
            },
            children: [],
        };
    }

    if (type === "element") {
        return {
            id,
            tag: "div",
            type,
            props: {
                text: "New DOM element",
                layout: { display: "block", margin: "0", padding: "0" },
            },
            children: [],
        };
    }

    return {
        id,
        tag: "div",
        type,
        props: {
            layout: {
                display: "inline-block",
                verticalAlign: "top",
                minHeight: "96px",
                margin: "0",
                padding: "0",
            },
        },
        children: [],
    };
}

export function cloneNode(node: EditorNode): EditorNode {
    return {
        ...node,
        id: crypto.randomUUID(),
        props: { ...node.props, layout: { ...node.props.layout } },
        children: node.children.map(cloneNode),
    };
}
