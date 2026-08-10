import type { EditorDocument, EditorNode } from "./types";

export function findNode(nodes: EditorNode[], id: string): EditorNode | undefined {
    for (const node of nodes) {
        if (node.id === id) return node;

        const match = findNode(node.children, id);
        if (match) return match;
    }
}

export function updateNode(
    nodes: EditorNode[],
    id: string,
    update: (node: EditorNode) => EditorNode,
): EditorNode[] {
    return nodes.map((node) => {
        if (node.id === id) return update(node);

        return { ...node, children: updateNode(node.children, id, update) };
    });
}

export function removeNode(nodes: EditorNode[], id: string): EditorNode[] {
    return nodes
        .filter((node) => node.id !== id)
        .map((node) => ({ ...node, children: removeNode(node.children, id) }));
}

export function insertNode(
    document: EditorDocument,
    parentId: string | null,
    node: EditorNode,
): EditorDocument {
    if (parentId === null) {
        return { ...document, nodes: [...document.nodes, node] };
    }

    return {
        ...document,
        nodes: updateNode(document.nodes, parentId, (parent) => ({
            ...parent,
            children: [...parent.children, node],
        })),
    };
}

export function isDescendant(node: EditorNode, possibleDescendantId: string): boolean {
    return node.children.some(
        (child) =>
            child.id === possibleDescendantId ||
            isDescendant(child, possibleDescendantId),
    );
}
