import type { CSSProperties } from "react";
import type { Layout } from "./types";

export function nodeClassName(id: string) {
    return `editor-node-${id}`;
}

export const pageClassName = "editor-page-root";

export function nodeStyle(layout: Layout): CSSProperties {
    const style = { ...layout };
    delete style.scrollable;
    delete style.scrollX;
    delete style.scrollY;
    return style as CSSProperties;
}

export function containerContentStyle(layout: Layout): CSSProperties {
    const nodeLayoutStyle = nodeStyle(layout);
    const layoutStyle: CSSProperties = {
        alignItems: nodeLayoutStyle.alignItems,
        display: nodeLayoutStyle.display,
        flexDirection: nodeLayoutStyle.flexDirection,
        flexWrap: nodeLayoutStyle.flexWrap,
        gap: nodeLayoutStyle.gap,
        gridTemplateColumns: nodeLayoutStyle.gridTemplateColumns,
        justifyContent: nodeLayoutStyle.justifyContent,
    };

    if (!layout.scrollable) {
        return { ...layoutStyle, height: layout.height ? "100%" : undefined };
    }

    return {
        ...layoutStyle,
        height: layout.height ? "100%" : undefined,
        overflowX: layout.scrollX !== false ? "auto" : "hidden",
        overflowY: layout.scrollY !== false ? "auto" : "hidden",
    };
}

export function scopedCss(id: string, css?: string, childSelector?: string) {
    const declarations = css?.trim();
    if (!declarations) return "";

    const selector = `.${nodeClassName(id)}`;
    const childRule = childSelector ? ` ${selector} > ${childSelector} { ${declarations} }` : "";
    return `${selector} { ${declarations} }${childRule}`;
}

export function scopedChildCss(id: string, css?: string, childSelector?: string) {
    const declarations = css?.trim();
    if (!declarations || !childSelector) return "";

    return `.${nodeClassName(id)} > ${childSelector} { ${prioritizeChildDeclarations(declarations)} }`;
}

function prioritizeChildDeclarations(declarations: string) {
    return declarations.replace(/(^|;)(\s*(?:--[\w-]+|[\w-]+)\s*:\s*)([^;{}]*?)(\s*!important)?(?=;|$)/g, (_match, prefix, property, value, important) => (
        `${prefix}${property}${value.trimEnd()}${important || " !important"}`
    ));
}

export function scopedHoverCss(id: string, css?: string, childSelector?: string) {
    const declarations = css?.trim();
    if (!declarations) return "";

    const selector = `.${nodeClassName(id)}:hover`;
    const childRule = childSelector ? ` ${selector} > ${childSelector} { ${declarations} }` : "";
    return `${selector} { ${declarations} }${childRule}`;
}

export function scopedActiveCss(id: string, css?: string, childSelector?: string) {
    const declarations = css?.trim();
    if (!declarations) return "";

    const selector = `.${nodeClassName(id)}:active`;
    const childRule = childSelector ? ` ${selector} > ${childSelector} { ${declarations} }` : "";
    return `${selector} { ${declarations} }${childRule}`;
}

export function scopedPseudoCss(id: string, css: string | undefined, suffix: string, childSelector?: string) {
    const declarations = css?.trim();
    if (!declarations) return "";

    const rootSelector = `.${nodeClassName(id)}`;
    const selector = childSelector ? `${rootSelector} > ${childSelector}${suffix}` : `${rootSelector}${suffix}`;
    return `${selector} { ${declarations} }`;
}

export function scopedPageCss(css?: string, state?: "hover" | "active") {
    const declarations = css?.trim();
    if (!declarations) return "";

    const selector = `.${pageClassName}${state ? `:${state}` : ""}`;
    const mediaRule = /^(@media\s*[^{]+)\{([\s\S]*)\}$/i.exec(declarations);
    if (mediaRule) return `${mediaRule[1]} { ${selector} { ${mediaRule[2].trim()} } }`;

    return `${selector} { ${declarations} }`;
}
