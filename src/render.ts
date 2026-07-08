import { RenderContext } from './context';
import { textStyleToCss } from './textStyle';
import { iconGlyph } from './icons';
import {
    escapeHtml, escapeAttr, num, px, parseColor, edgeInsetsToCss, alignmentToFlex,
    alignmentToObjectPosition, mainAxisAlignmentToCss, crossAxisAlignmentToCss, boxFitToObjectFit,
    blendModeToCss, textAlignToCss, clipToOverflow, styleStr, attrStyle, attr, titleAttr,
    parseEdgeInsets,
} from './utils';

type Renderer = (node: any, ctx: RenderContext) => string;

export function renderWidget(node: any, ctx: RenderContext): string {
    if (node === null || node === undefined) { return ''; }
    if (Array.isArray(node)) { return node.map(n => renderWidget(n, ctx)).join(''); }
    if (typeof node !== 'object') { return escapeHtml(String(node)); }
    const type = node.type;
    if (!type) { return renderUnknown('Widget json is missing a "type" field.'); }
    const renderer = RENDERERS[type];
    if (!renderer) { return renderUnknown(`Unsupported widget type "${type}".`); }
    try {
        return renderer(node, ctx);
    } catch (err: any) {
        return renderUnknown(`Error rendering "${type}": ${err?.message ?? err}`);
    }
}

function renderChild(node: any, ctx: RenderContext): string {
    return node ? renderWidget(node, ctx) : '';
}

function renderChildren(nodes: any, ctx: RenderContext): string {
    return Array.isArray(nodes) ? nodes.map(n => renderWidget(n, ctx)).join('') : '';
}

function renderUnknown(message: string): string {
    return `<div class="dw-unknown">&#9888; ${escapeHtml(message)}</div>`;
}

// ---------------------------------------------------------------------------
// Layout & box widgets
// ---------------------------------------------------------------------------

function renderContainer(node: any, ctx: RenderContext): string {
    const margin = edgeInsetsToCss(node.margin);
    const padding = edgeInsetsToCss(node.padding);
    const color = parseColor(node.color);
    const width = px(node.width);
    const height = px(node.height);
    const c = node.constraints || {};
    const align = node.alignment ? alignmentToFlex(node.alignment) : undefined;
    const outerStyle = styleStr({ margin });
    const innerStyle = styleStr({
        padding, backgroundColor: color, width, height,
        minWidth: px(c.minWidth), maxWidth: px(c.maxWidth), minHeight: px(c.minHeight), maxHeight: px(c.maxHeight),
        display: align ? 'flex' : undefined,
        justifyContent: align?.justifyContent, alignItems: align?.alignItems,
        cursor: node.click_event ? 'pointer' : undefined,
    });
    return `<div class="dw-container"${attrStyle(outerStyle)}><div class="dw-container-inner"${attrStyle(innerStyle)}${titleAttr(node.click_event)}>${renderChild(node.child, ctx)}</div></div>`;
}

function renderPadding(node: any, ctx: RenderContext): string {
    const style = styleStr({ padding: edgeInsetsToCss(node.padding) });
    return `<div class="dw-padding"${attrStyle(style)}>${renderChild(node.child, ctx)}</div>`;
}

function renderCenter(node: any, ctx: RenderContext): string {
    const style = styleStr({
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        width: node.widthFactor ? 'fit-content' : '100%',
        height: node.heightFactor ? 'fit-content' : '100%',
    });
    return `<div class="dw-center"${attrStyle(style)}>${renderChild(node.child, ctx)}</div>`;
}

function renderAlign(node: any, ctx: RenderContext): string {
    const a = alignmentToFlex(node.alignment);
    const style = styleStr({
        display: 'flex', justifyContent: a.justifyContent, alignItems: a.alignItems,
        width: node.widthFactor ? 'fit-content' : '100%',
        height: node.heightFactor ? 'fit-content' : '100%',
    });
    return `<div class="dw-align"${attrStyle(style)}>${renderChild(node.child, ctx)}</div>`;
}

function renderAspectRatio(node: any, ctx: RenderContext): string {
    const ratio = num(node.aspectRatio) ?? 1;
    const style = styleStr({ aspectRatio: String(ratio), width: '100%', overflow: 'hidden' });
    return `<div class="dw-aspectratio"${attrStyle(style)}>${renderChild(node.child, ctx)}</div>`;
}

function renderFittedBox(node: any, ctx: RenderContext): string {
    const a = alignmentToFlex(node.alignment);
    const style = styleStr({
        display: 'flex', justifyContent: a.justifyContent, alignItems: a.alignItems,
        overflow: 'hidden', width: '100%',
    });
    return `<div class="dw-fittedbox"${attrStyle(style)}>${renderChild(node.child, ctx)}</div>`;
}

function renderBaseline(node: any, ctx: RenderContext): string {
    const baseline = num(node.baseline) ?? 0;
    const style = styleStr({ paddingTop: `${baseline}px` });
    return `<div class="dw-baseline"${attrStyle(style)}>${renderChild(node.child, ctx)}</div>`;
}

function renderExpandedSizedBox(node: any, ctx: RenderContext): string {
    return `<div class="dw-expandedsizedbox" style="width:100%;height:100%">${renderChild(node.child, ctx)}</div>`;
}

function renderSizedBox(node: any, ctx: RenderContext): string {
    const style = styleStr({ width: px(node.width), height: px(node.height) });
    return `<div class="dw-sizedbox"${attrStyle(style)}>${renderChild(node.child, ctx)}</div>`;
}

function renderOpacity(node: any, ctx: RenderContext): string {
    const style = styleStr({ opacity: node.opacity !== undefined ? String(node.opacity) : undefined });
    return `<div class="dw-opacity"${attrStyle(style)}>${renderChild(node.child, ctx)}</div>`;
}

function renderClipRRect(node: any, ctx: RenderContext): string {
    let borderRadius: string | undefined;
    if (node.borderRadius) {
        const parts = String(node.borderRadius).split(',').map((s: string) => parseFloat(s.trim()) || 0);
        if (parts.length === 4) {
            const [tl, tr, bl, br] = parts;
            borderRadius = `${tl}px ${tr}px ${br}px ${bl}px`;
        }
    }
    const style = styleStr({ borderRadius, overflow: clipToOverflow(node.clipBehavior) });
    return `<div class="dw-cliprrect"${attrStyle(style)}>${renderChild(node.child, ctx)}</div>`;
}

function renderSafeArea(node: any, ctx: RenderContext): string {
    const min = parseEdgeInsets(node.minimum);
    const top = node.top !== false ? Math.max(20, min?.top ?? 0) : (min?.top ?? 0);
    const bottom = node.bottom !== false ? (min?.bottom ?? 0) : (min?.bottom ?? 0);
    const left = node.left !== false ? (min?.left ?? 0) : (min?.left ?? 0);
    const right = node.right !== false ? (min?.right ?? 0) : (min?.right ?? 0);
    const style = styleStr({ padding: `${top}px ${right}px ${bottom}px ${left}px` });
    return `<div class="dw-safearea"${attrStyle(style)}>${renderChild(node.child, ctx)}</div>`;
}

function renderLimitedBox(node: any, ctx: RenderContext): string {
    const style = styleStr({ maxWidth: px(node.maxWidth), maxHeight: px(node.maxHeight), overflow: 'auto' });
    return `<div class="dw-limitedbox"${attrStyle(style)}>${renderChild(node.child, ctx)}</div>`;
}

function renderOffstage(node: any, ctx: RenderContext): string {
    if (node.offstage) { return ''; }
    return renderChild(node.child, ctx);
}

function renderOverflowBox(node: any, ctx: RenderContext): string {
    const a = alignmentToFlex(node.alignment);
    const outerStyle = styleStr({ display: 'flex', justifyContent: a.justifyContent, alignItems: a.alignItems, position: 'relative' });
    const innerStyle = styleStr({
        maxWidth: px(node.maxWidth), maxHeight: px(node.maxHeight),
        minWidth: px(node.minWidth), minHeight: px(node.minHeight),
    });
    return `<div class="dw-overflowbox"${attrStyle(outerStyle)}><div class="dw-overflowbox-inner"${attrStyle(innerStyle)}>${renderChild(node.child, ctx)}</div></div>`;
}

function renderRotatedBox(node: any, ctx: RenderContext): string {
    const turns = num(node.quarterTurns) ?? 0;
    const style = styleStr({ display: 'inline-block', transform: `rotate(${turns * 90}deg)` });
    return `<div class="dw-rotatedbox"${attrStyle(style)}>${renderChild(node.child, ctx)}</div>`;
}

function renderSingleChildScrollView(node: any, ctx: RenderContext): string {
    const horizontal = node.scrollDirection === 'horizontal';
    const overflow = clipToOverflow(node.clipBehavior);
    const style = styleStr({
        overflowX: horizontal ? 'auto' : overflow,
        overflowY: horizontal ? overflow : 'auto',
        padding: edgeInsetsToCss(node.padding),
        maxHeight: !horizontal ? '480px' : undefined,
    });
    return `<div class="dw-scrollview"${attrStyle(style)}>${renderChild(node.child, ctx)}</div>`;
}

// ---------------------------------------------------------------------------
// Flex, stack & scrolling collections
// ---------------------------------------------------------------------------

function renderFlex(node: any, ctx: RenderContext, direction: 'row' | 'column'): string {
    const reverse = direction === 'row' ? node.textDirection === 'rtl' : node.verticalDirection === 'up';
    const style = styleStr({
        display: 'flex',
        flexDirection: reverse ? `${direction}-reverse` : direction,
        justifyContent: mainAxisAlignmentToCss(node.mainAxisAlignment),
        alignItems: crossAxisAlignmentToCss(node.crossAxisAlignment),
        width: direction === 'row' && node.mainAxisSize !== 'min' ? '100%' : undefined,
    });
    return `<div class="dw-${direction}"${attrStyle(style)}>${renderChildren(node.children, ctx)}</div>`;
}

function renderExpanded(node: any, ctx: RenderContext): string {
    const flex = node.flex ?? 1;
    const style = styleStr({ flex: `${flex} 1 0%`, minWidth: '0', minHeight: '0' });
    return `<div class="dw-expanded"${attrStyle(style)}>${renderChild(node.child, ctx)}</div>`;
}

function renderWrap(node: any, ctx: RenderContext): string {
    const vertical = node.direction === 'vertical';
    const style = styleStr({
        display: 'flex', flexWrap: 'wrap', flexDirection: vertical ? 'column' : 'row',
        justifyContent: mainAxisAlignmentToCss(node.alignment),
        alignItems: crossAxisAlignmentToCss(node.crossAxisAlignment),
        alignContent: mainAxisAlignmentToCss(node.runAlignment),
        gap: `${num(node.runSpacing) ?? 0}px ${num(node.spacing) ?? 0}px`,
    });
    return `<div class="dw-wrap"${attrStyle(style)}>${renderChildren(node.children, ctx)}</div>`;
}

function renderStack(node: any, ctx: RenderContext): string {
    const a = alignmentToFlex(node.alignment);
    const style = styleStr({ position: 'relative', overflow: clipToOverflow(node.clipBehavior) });
    const children = Array.isArray(node.children)
        ? node.children.map((child: any) => renderStackChild(child, ctx, a)).join('')
        : '';
    return `<div class="dw-stack"${attrStyle(style)}>${children}</div>`;
}

function renderStackChild(child: any, ctx: RenderContext, parentAlign: { justifyContent: string; alignItems: string }): string {
    if (child && child.type === 'Positioned') { return renderPositioned(child, ctx); }
    const style = styleStr({
        position: 'absolute', inset: '0', display: 'flex',
        justifyContent: parentAlign.justifyContent, alignItems: parentAlign.alignItems,
    });
    return `<div class="dw-stack-item"${attrStyle(style)}>${renderWidget(child, ctx)}</div>`;
}

function renderPositioned(node: any, ctx: RenderContext): string {
    const style = styleStr({
        position: 'absolute', top: px(node.top), left: px(node.left),
        right: px(node.right), bottom: px(node.bottom), width: px(node.width), height: px(node.height),
    });
    return `<div class="dw-positioned"${attrStyle(style)}>${renderChild(node.child, ctx)}</div>`;
}

function renderIndexedStack(node: any, ctx: RenderContext): string {
    const idx = node.index ?? 0;
    const a = alignmentToFlex(node.alignment);
    const children = Array.isArray(node.children) ? node.children.map((child: any, i: number) => {
        const shown = i === idx;
        const style = styleStr({
            position: shown ? 'relative' : 'absolute', display: shown ? 'flex' : 'none',
            inset: '0', justifyContent: a.justifyContent, alignItems: a.alignItems,
        });
        return `<div class="dw-indexedstack-item"${attrStyle(style)}>${renderWidget(child, ctx)}</div>`;
    }).join('') : '';
    return `<div class="dw-indexedstack" style="position:relative">${children}</div>`;
}

function renderGridView(node: any, ctx: RenderContext): string {
    const cols = node.crossAxisCount ?? 2;
    const style = styleStr({
        display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: `${num(node.mainAxisSpacing) ?? 0}px ${num(node.crossAxisSpacing) ?? 0}px`,
        padding: edgeInsetsToCss(node.padding),
    });
    const ratio = num(node.childAspectRatio);
    const children = Array.isArray(node.children) ? node.children.map((child: any) => {
        const itemStyle = styleStr({ aspectRatio: ratio ? String(ratio) : undefined, overflow: 'hidden' });
        return `<div class="dw-grid-item"${attrStyle(itemStyle)}>${renderWidget(child, ctx)}</div>`;
    }).join('') : '';
    return `<div class="dw-gridview"${attrStyle(style)}>${children}</div>`;
}

function renderListView(node: any, ctx: RenderContext): string {
    const horizontal = node.scrollDirection === 'horizontal';
    const style = styleStr({
        display: 'flex',
        flexDirection: horizontal ? (node.reverse ? 'row-reverse' : 'row') : (node.reverse ? 'column-reverse' : 'column'),
        overflowX: horizontal ? 'auto' : 'hidden',
        overflowY: horizontal ? 'hidden' : 'auto',
        padding: edgeInsetsToCss(node.padding),
        maxHeight: !horizontal && !node.shrinkWrap ? '480px' : undefined,
    });
    const itemExtent = px(node.itemExtent);
    const children = Array.isArray(node.children) ? node.children.map((child: any) => {
        const itemStyle = styleStr({ flex: itemExtent ? `0 0 ${itemExtent}` : '0 0 auto' });
        return `<div class="dw-listview-item"${attrStyle(itemStyle)}>${renderWidget(child, ctx)}</div>`;
    }).join('') : '';
    return `<div class="dw-listview"${attrStyle(style)}>${children}</div>`;
}

function renderPageView(node: any, ctx: RenderContext): string {
    const horizontal = node.scrollDirection !== 'vertical';
    const style = styleStr({
        display: 'flex',
        flexDirection: horizontal ? (node.reverse ? 'row-reverse' : 'row') : (node.reverse ? 'column-reverse' : 'column'),
        overflowX: horizontal ? 'auto' : 'hidden',
        overflowY: horizontal ? 'hidden' : 'auto',
        scrollSnapType: node.pageSnapping === false ? undefined : (horizontal ? 'x mandatory' : 'y mandatory'),
        width: '100%', height: '360px',
    });
    const children = Array.isArray(node.children) ? node.children.map((child: any) => {
        const itemStyle = styleStr({ flex: '0 0 100%', scrollSnapAlign: 'start', overflow: 'auto' });
        return `<div class="dw-pageview-item"${attrStyle(itemStyle)}>${renderWidget(child, ctx)}</div>`;
    }).join('') : '';
    return `<div class="dw-pageview"${attrStyle(style)}>${children}</div>`;
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

function renderText(node: any, ctx: RenderContext): string {
    const style = styleStr({
        textAlign: textAlignToCss(node.textAlign),
        direction: node.textDirection === 'rtl' ? 'rtl' : undefined,
        whiteSpace: node.softWrap === false ? 'nowrap' : 'pre-wrap',
        overflow: node.maxLines ? 'hidden' : undefined,
        display: node.maxLines ? '-webkit-box' : undefined,
        WebkitBoxOrient: node.maxLines ? 'vertical' : undefined,
        WebkitLineClamp: node.maxLines ? String(node.maxLines) : undefined,
        textOverflow: node.maxLines && node.overflow !== 'clip' ? 'ellipsis' : undefined,
    });
    const content = node.textSpan ? renderTextSpan(node.textSpan, ctx) : escapeHtml(node.data ?? '');
    return `<div class="dw-text"${attrStyle(style)}${attr('aria-label', node.semanticsLabel)}>${content}</div>`;
}

function renderTextSpan(span: any, ctx: RenderContext): string {
    if (!span) { return ''; }
    const style = styleStr(textStyleToCss(span.style));
    const text = span.text ? escapeHtml(span.text) : '';
    const children = Array.isArray(span.children) ? span.children.map((c: any) => renderTextSpan(c, ctx)).join('') : '';
    return `<span${attrStyle(style)}${titleAttr(span.recognizer)}>${text}${children}</span>`;
}

function renderSelectableText(node: any, ctx: RenderContext): string {
    return renderText(node, ctx);
}

function renderDropCapText(node: any, ctx: RenderContext): string {
    const textCss = textStyleToCss(node.style);
    const dropCss = textStyleToCss(node.dropCapStyle);
    const className = ctx.addStyleRule(cls => `.${cls}::first-letter { ${styleStr({
        ...dropCss, float: 'left', lineHeight: '0.8', paddingRight: '4px', fontSize: dropCss.fontSize ?? '3em',
    })} }`);
    const style = styleStr({ ...textCss, textAlign: textAlignToCss(node.textAlign) });
    const data = node.data ? escapeHtml(node.data) : '';
    return `<div class="dw-dropcaptext ${className}"${attrStyle(style)}>${data}</div>`;
}

function renderIcon(node: any): string {
    const size = px(node.size) ?? '24px';
    const color = parseColor(node.color) ?? 'currentColor';
    const style = styleStr({
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size, fontSize: size, color, lineHeight: '1',
        direction: node.textDirection === 'rtl' ? 'rtl' : undefined,
    });
    return `<span class="dw-icon"${attrStyle(style)}${attr('aria-label', node.semanticLabel ?? node.data)}>${escapeHtml(iconGlyph(node.data))}</span>`;
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

function renderImage(node: any, src: string): string {
    if (!src) {
        const label = node.name ?? node.src ?? node.filePath ?? '(unresolved)';
        return renderUnknown(`Image source not found: ${label}`);
    }
    const width = px(node.width);
    const height = px(node.height);
    const objectFit = boxFitToObjectFit(node.boxFit);
    const objectPosition = alignmentToObjectPosition(node.alignment);
    const color = parseColor(node.color);
    const imgStyle = styleStr({ width: width ?? '100%', height, objectFit, objectPosition, display: 'block' });
    const img = `<img src="${escapeAttr(src)}"${attrStyle(imgStyle)}${attr('alt', node.semanticLabel)} />`;
    const wrapStyle = styleStr({ position: 'relative', display: 'inline-block', width, height, cursor: node.click_event ? 'pointer' : undefined });
    if (color) {
        const overlayStyle = styleStr({ position: 'absolute', inset: '0', backgroundColor: color, mixBlendMode: blendModeToCss(node.blendMode) });
        return `<div class="dw-image-wrap"${attrStyle(wrapStyle)}${titleAttr(node.click_event)}>${img}<div${attrStyle(overlayStyle)}></div></div>`;
    }
    return `<div class="dw-image-wrap"${attrStyle(wrapStyle)}${titleAttr(node.click_event)}>${img}</div>`;
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

function renderButtonLike(node: any, ctx: RenderContext, defaultBg: string, defaultFg: string): string {
    const bg = parseColor(node.backgroundColor ?? node.color) ?? defaultBg;
    const fg = parseColor(node.foregroundColor ?? node.textColor) ?? defaultFg;
    const padding = edgeInsetsToCss(node.padding) ?? '8px 16px';
    const elevation = num(node.elevation);
    const boxShadow = elevation ? `0 ${Math.min(elevation, 8)}px ${elevation * 2}px rgba(0,0,0,0.3)` : undefined;
    const textCss = textStyleToCss(node.textStyle);
    const a = node.alignment ? alignmentToFlex(node.alignment) : undefined;
    const style = styleStr({
        display: 'inline-flex', alignItems: a?.alignItems ?? 'center', justifyContent: a?.justifyContent ?? 'center',
        padding, backgroundColor: bg, color: fg, borderRadius: '4px', boxShadow,
        cursor: node.click_event ? 'pointer' : undefined, border: 'none', fontFamily: 'inherit', ...textCss,
    });
    return `<div class="dw-button"${attrStyle(style)}${titleAttr(node.click_event)}>${renderChild(node.child, ctx)}</div>`;
}

// ---------------------------------------------------------------------------
// Material-ish composite widgets
// ---------------------------------------------------------------------------

function renderListTile(node: any, ctx: RenderContext): string {
    const padding = edgeInsetsToCss(node.contentPadding) ?? (node.dense ? '4px 16px' : '8px 16px');
    const style = styleStr({
        display: 'flex', alignItems: 'center', gap: '16px', padding,
        backgroundColor: node.selected ? 'rgba(33,150,243,0.12)' : undefined,
        opacity: node.enabled === false ? '0.5' : undefined,
        cursor: node.tapEvent ? 'pointer' : undefined,
        minHeight: node.isThreeLine ? '72px' : (node.dense ? '40px' : '56px'),
    });
    const leading = node.leading ? `<div class="dw-listtile-leading">${renderWidget(node.leading, ctx)}</div>` : '';
    const trailing = node.trailing ? `<div class="dw-listtile-trailing">${renderWidget(node.trailing, ctx)}</div>` : '';
    const title = node.title ? `<div class="dw-listtile-title">${renderWidget(node.title, ctx)}</div>` : '';
    const subtitle = node.subtitle ? `<div class="dw-listtile-subtitle" style="opacity:0.6;font-size:0.9em">${renderWidget(node.subtitle, ctx)}</div>` : '';
    return `<div class="dw-listtile"${attrStyle(style)}${titleAttr(node.tapEvent)}>${leading}<div class="dw-listtile-body" style="flex:1;min-width:0">${title}${subtitle}</div>${trailing}</div>`;
}

function renderPlaceholder(node: any): string {
    const color = parseColor(node.color) ?? 'rgba(158,158,158,1)';
    const strokeWidth = num(node.strokeWidth) ?? 2;
    const width = px(node.fallbackWidth) ?? '400px';
    const height = px(node.fallbackHeight) ?? '400px';
    const half = strokeWidth / 2;
    const style = styleStr({
        width, height, border: `${strokeWidth}px solid ${color}`,
        backgroundImage:
            `linear-gradient(to top right, transparent calc(50% - ${half}px), ${color} calc(50% - ${half}px), ${color} calc(50% + ${half}px), transparent calc(50% + ${half}px)),` +
            `linear-gradient(to top left, transparent calc(50% - ${half}px), ${color} calc(50% - ${half}px), ${color} calc(50% + ${half}px), transparent calc(50% + ${half}px))`,
    });
    return `<div class="dw-placeholder"${attrStyle(style)}></div>`;
}

function renderDivider(node: any): string {
    const height = num(node.height) ?? 16;
    const thickness = num(node.thickness) ?? 1;
    const indent = num(node.indent) ?? 0;
    const endIndent = num(node.endIndent) ?? 0;
    const color = parseColor(node.color) ?? 'rgba(0,0,0,0.12)';
    const style = styleStr({ height: `${height}px`, display: 'flex', alignItems: 'center', marginLeft: `${indent}px`, marginRight: `${endIndent}px` });
    return `<div class="dw-divider"${attrStyle(style)}><div style="width:100%;height:${thickness}px;background-color:${color}"></div></div>`;
}

function renderCard(node: any, ctx: RenderContext): string {
    const margin = edgeInsetsToCss(node.margin) ?? '4px';
    const color = parseColor(node.color) ?? '#ffffff';
    const shadowColor = parseColor(node.shadowColor) ?? 'rgba(0,0,0,0.3)';
    const elevation = num(node.elevation) ?? 1;
    let borderRadius = '4px';
    if (node.shape && typeof node.shape === 'object' && node.shape.borderRadius) {
        borderRadius = String(node.shape.borderRadius);
    }
    const style = styleStr({
        margin, backgroundColor: color, borderRadius,
        boxShadow: `0 ${elevation}px ${elevation * 2}px ${shadowColor}`,
        overflow: node.clipBehavior && node.clipBehavior !== 'none' ? 'hidden' : undefined,
    });
    return `<div class="dw-card"${attrStyle(style)}>${renderChild(node.child, ctx)}</div>`;
}

function renderScaffold(node: any, ctx: RenderContext): string {
    const bg = parseColor(node.backgroundColor) ?? '#ffffff';
    const style = styleStr({ display: 'flex', flexDirection: 'column', minHeight: '480px', backgroundColor: bg, position: 'relative' });
    const appBar = node.appBar ? renderWidget(node.appBar, ctx) : '';
    const body = `<div class="dw-scaffold-body" style="flex:1;position:relative">${renderChild(node.body, ctx)}</div>`;
    const fab = node.floatingActionButton
        ? `<div class="dw-scaffold-fab" style="position:absolute;right:16px;bottom:16px;z-index:10">${renderWidget(node.floatingActionButton, ctx)}</div>`
        : '';
    return `<div class="dw-scaffold"${attrStyle(style)}>${appBar}${body}${fab}</div>`;
}

function renderAppBar(node: any, ctx: RenderContext): string {
    const bg = parseColor(node.backgroundColor) ?? '#2196F3';
    const style = styleStr({
        display: 'flex', alignItems: 'center', height: '56px', padding: '0 16px', backgroundColor: bg,
        color: '#fff', gap: '16px', justifyContent: node.centerTitle ? 'center' : 'flex-start',
    });
    const leading = node.leading ? renderWidget(node.leading, ctx) : '';
    const title = node.title
        ? `<div class="dw-appbar-title" style="flex:${node.centerTitle ? '0' : '1'};font-size:1.25em">${renderWidget(node.title, ctx)}</div>`
        : '';
    const actions = Array.isArray(node.actions)
        ? `<div class="dw-appbar-actions" style="display:flex;gap:8px;margin-left:auto">${node.actions.map((a: any) => renderWidget(a, ctx)).join('')}</div>`
        : '';
    return `<div class="dw-appbar"${attrStyle(style)}>${leading}${title}${actions}</div>`;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const RENDERERS: Record<string, Renderer> = {
    Container: renderContainer,
    Text: renderText,
    RaisedButton: (n, c) => renderButtonLike(n, c, '#e0e0e0', 'rgba(0,0,0,0.87)'),
    ElevatedButton: (n, c) => renderButtonLike(n, c, '#e0e0e0', 'rgba(0,0,0,0.87)'),
    TextButton: (n, c) => renderButtonLike(n, c, 'transparent', '#2196F3'),
    Row: (n, c) => renderFlex(n, c, 'row'),
    Column: (n, c) => renderFlex(n, c, 'column'),
    AssetImage: (n, c) => renderImage(n, c.resolveAsset(n.name)),
    NetworkImage: (n) => renderImage(n, n.src ?? ''),
    FileImage: (n, c) => renderImage(n, c.resolveFile(n.filePath)),
    Placeholder: renderPlaceholder,
    GridView: renderGridView,
    ListView: renderListView,
    PageView: renderPageView,
    Expanded: renderExpanded,
    Padding: renderPadding,
    Center: renderCenter,
    Align: renderAlign,
    AspectRatio: renderAspectRatio,
    FittedBox: renderFittedBox,
    Baseline: renderBaseline,
    Stack: renderStack,
    Positioned: renderPositioned,
    IndexedStack: renderIndexedStack,
    ExpandedSizedBox: renderExpandedSizedBox,
    SizedBox: renderSizedBox,
    Opacity: renderOpacity,
    Wrap: renderWrap,
    ClipRRect: renderClipRRect,
    SafeArea: renderSafeArea,
    ListTile: renderListTile,
    SelectableText: renderSelectableText,
    Icon: renderIcon,
    DropCapText: renderDropCapText,
    Scaffold: renderScaffold,
    AppBar: renderAppBar,
    LimitedBox: renderLimitedBox,
    Offstage: renderOffstage,
    OverflowBox: renderOverflowBox,
    Divider: renderDivider,
    RotatedBox: renderRotatedBox,
    Card: renderCard,
    SingleChildScrollView: renderSingleChildScrollView,
};
