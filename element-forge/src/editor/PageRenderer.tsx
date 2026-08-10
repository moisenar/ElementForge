import { createElement, type CSSProperties } from "react";
import { containerContentStyle, nodeClassName, nodeStyle, pageClassName, scopedActiveCss, scopedChildCss, scopedCss, scopedHoverCss, scopedPageCss, scopedPseudoCss } from "./nodePresentation";
import type { EditorNode } from "./types";

type PageRendererProps = {
    nodes: EditorNode[];
    pageActiveCss?: string;
    pageCss?: string;
    pageHoverCss?: string;
};

function NodeRenderer({ node }: { node: EditorNode }) {
    const style = nodeStyle(node.props.layout) as CSSProperties;
    const className = nodeClassName(node.id);
    const componentChildSelector = node.type === "button"
        ? ".editor-button"
        : node.type === "image"
            ? ".canvas-image"
            : node.type === "container"
                ? ".container-content"
                : undefined;
    const componentCss = node.type === "html" ? "" : scopedCss(node.id, node.props.css, componentChildSelector);
    const childrenCss = scopedChildCss(node.id, node.props.childrenCss, node.type === "container" ? ".container-content > .editor-render-node" : undefined);
    const buttonChildSelector = node.type === "button" ? ".editor-button" : undefined;
    const componentHoverCss = scopedHoverCss(node.id, node.props.hoverCss, buttonChildSelector);
    const componentActiveCss = scopedActiveCss(node.id, node.props.activeCss, buttonChildSelector);
    const componentFocusCss = scopedPseudoCss(node.id, node.props.focusCss, ":focus-visible", buttonChildSelector);
    const componentAfterCss = scopedPseudoCss(node.id, node.props.afterCss, "::after", buttonChildSelector);
    const componentHoverAfterCss = scopedPseudoCss(node.id, node.props.hoverAfterCss, ":hover::after", buttonChildSelector);
    const componentCurrentAfterCss = scopedPseudoCss(node.id, node.props.currentAfterCss, '[aria-current="page"]::after', buttonChildSelector);

    const content = (() => {
        if (node.type === "heading") {
            return createElement(node.tag, null, node.props.text);
        }

        if (node.type === "text") {
            return createElement(node.tag, null, node.props.text);
        }

        if (node.type === "button") {
            return node.tag === "a" || node.props.href ? (
                <a className="editor-button" href={node.props.href} aria-current={node.props.ariaCurrent ? "page" : undefined}>{node.props.text}</a>
            ) : createElement(node.tag, { className: "editor-button", type: node.tag === "button" ? "button" : undefined }, node.props.text);
        }

        if (node.type === "image") {
            return node.props.src ? (
                <img className="canvas-image" src={node.props.src} alt={node.props.alt ?? ""} style={style} />
            ) : null;
        }

        if (node.type === "html") {
            return (
                <div className="html-css-content">
                    <style>{node.props.css ?? ""}</style>
                    <div dangerouslySetInnerHTML={{ __html: node.props.html ?? "" }} />
                </div>
            );
        }

        if (node.type === "element") {
            return createElement(
                node.tag,
                { className: "dom-element-content", value: node.props.text || undefined, ...(node.tag === "a" && node.props.href ? { href: node.props.href } : {}) },
                node.children.length > 0
                    ? node.children.map((child) => <NodeRenderer key={child.id} node={child} />)
                    : node.props.text,
            );
        }

        return createElement(
            node.tag,
            { className: "container-content", style: containerContentStyle(node.props.layout) },
            node.children.map((child) => <NodeRenderer key={child.id} node={child} />),
        );
    })();

    if (!content) return null;

    return (
        <div className={`editor-render-node editor-render-node--${node.type} ${className} ${node.props.className ?? ""}`} style={style}>
            {componentCss && <style>{componentCss}</style>}
            {childrenCss && <style>{childrenCss}</style>}
            {componentHoverCss && <style>{componentHoverCss}</style>}
            {componentActiveCss && <style>{componentActiveCss}</style>}
            {componentFocusCss && <style>{componentFocusCss}</style>}
            {componentAfterCss && <style>{componentAfterCss}</style>}
            {componentHoverAfterCss && <style>{componentHoverAfterCss}</style>}
            {componentCurrentAfterCss && <style>{componentCurrentAfterCss}</style>}
            {content}
        </div>
    );
}

export function PageRenderer({ nodes, pageCss, pageHoverCss, pageActiveCss }: PageRendererProps) {
    const normalCss = scopedPageCss(pageCss);
    const hoverCss = scopedPageCss(pageHoverCss, "hover");
    const activeCss = scopedPageCss(pageActiveCss, "active");

    return (
        <>
            {normalCss && <style>{normalCss}</style>}
            {hoverCss && <style>{hoverCss}</style>}
            {activeCss && <style>{activeCss}</style>}
            <div className={pageClassName}>
                {nodes.map((node) => (
                    <NodeRenderer key={node.id} node={node} />
                ))}
            </div>
        </>
    );
}
