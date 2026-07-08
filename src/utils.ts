export function escapeHtml(input: string): string {
    return String(input)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export const escapeAttr = escapeHtml;

const INFINITE = 1e8;

/** Parses a numeric json value; treats dynamic_widget's double.infinity sentinel (>=1e8) as "unset". */
export function num(value: any): number | undefined {
    if (value === undefined || value === null || value === '') { return undefined; }
    const n = typeof value === 'number' ? value : parseFloat(value);
    if (isNaN(n) || Math.abs(n) >= INFINITE) { return undefined; }
    return n;
}

export function px(value: any): string | undefined {
    const n = num(value);
    return n === undefined ? undefined : `${n}px`;
}

/** Parses Flutter's "#AARRGGBB" or "#RRGGBB" hex color strings into a CSS rgba() color. */
export function parseColor(value?: string): string | undefined {
    if (!value || typeof value !== 'string') { return undefined; }
    let hex = value.trim().replace(/^0x/i, '').replace(/^#/, '');
    if (hex.length === 6) { hex = 'FF' + hex; }
    if (hex.length !== 8 || /[^0-9a-fA-F]/.test(hex)) { return undefined; }
    const a = parseInt(hex.substring(0, 2), 16) / 255;
    const r = parseInt(hex.substring(2, 4), 16);
    const g = parseInt(hex.substring(4, 6), 16);
    const b = parseInt(hex.substring(6, 8), 16);
    return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
}

export interface EdgeInsets { left: number; top: number; right: number; bottom: number; }

/** Parses a dynamic_widget "left,top,right,bottom" string. */
export function parseEdgeInsets(value?: string): EdgeInsets | undefined {
    if (!value || typeof value !== 'string') { return undefined; }
    const parts = value.split(',').map(s => parseFloat(s.trim()));
    if (parts.length !== 4 || parts.some(isNaN)) { return undefined; }
    const [left, top, right, bottom] = parts;
    return { left, top, right, bottom };
}

export function edgeInsetsToCss(value?: string): string | undefined {
    const e = parseEdgeInsets(value);
    return e ? `${e.top}px ${e.right}px ${e.bottom}px ${e.left}px` : undefined;
}

const ALIGNMENTS: Record<string, { justifyContent: string; alignItems: string }> = {
    topLeft: { justifyContent: 'flex-start', alignItems: 'flex-start' },
    topCenter: { justifyContent: 'center', alignItems: 'flex-start' },
    topRight: { justifyContent: 'flex-end', alignItems: 'flex-start' },
    centerLeft: { justifyContent: 'flex-start', alignItems: 'center' },
    center: { justifyContent: 'center', alignItems: 'center' },
    centerRight: { justifyContent: 'flex-end', alignItems: 'center' },
    bottomLeft: { justifyContent: 'flex-start', alignItems: 'flex-end' },
    bottomCenter: { justifyContent: 'center', alignItems: 'flex-end' },
    bottomRight: { justifyContent: 'flex-end', alignItems: 'flex-end' },
    // AlignmentDirectional variants (assumes LTR text direction).
    topStart: { justifyContent: 'flex-start', alignItems: 'flex-start' },
    topEnd: { justifyContent: 'flex-end', alignItems: 'flex-start' },
    centerStart: { justifyContent: 'flex-start', alignItems: 'center' },
    centerEnd: { justifyContent: 'flex-end', alignItems: 'center' },
    bottomStart: { justifyContent: 'flex-start', alignItems: 'flex-end' },
    bottomEnd: { justifyContent: 'flex-end', alignItems: 'flex-end' },
};

export function alignmentToFlex(value?: string, fallback: string = 'center'): { justifyContent: string; alignItems: string } {
    return ALIGNMENTS[value || fallback] || ALIGNMENTS.center;
}

export function alignmentToObjectPosition(value?: string): string {
    const map: Record<string, string> = {
        topLeft: 'left top', topCenter: 'top', topRight: 'right top',
        centerLeft: 'left', center: 'center', centerRight: 'right',
        bottomLeft: 'left bottom', bottomCenter: 'bottom', bottomRight: 'right bottom',
    };
    return map[value || 'center'] || 'center';
}

const MAIN_AXIS: Record<string, string> = {
    start: 'flex-start', end: 'flex-end', center: 'center',
    spaceBetween: 'space-between', spaceAround: 'space-around', spaceEvenly: 'space-evenly',
};

export function mainAxisAlignmentToCss(value?: string): string {
    return MAIN_AXIS[value || 'start'] || 'flex-start';
}

const CROSS_AXIS: Record<string, string> = {
    center: 'center', start: 'flex-start', end: 'flex-end', stretch: 'stretch', baseline: 'baseline',
};

export function crossAxisAlignmentToCss(value?: string): string {
    return CROSS_AXIS[value || 'center'] || 'center';
}

const BOX_FIT: Record<string, string> = {
    fill: 'fill', contain: 'contain', cover: 'cover',
    fitWidth: 'cover', fitHeight: 'cover', none: 'none', scaleDown: 'scale-down',
};

export function boxFitToObjectFit(value?: string): string {
    return BOX_FIT[value || 'contain'] || 'contain';
}

const BLEND_MODES: Record<string, string> = {
    multiply: 'multiply', screen: 'screen', overlay: 'overlay', darken: 'darken', lighten: 'lighten',
    colorDodge: 'color-dodge', colorBurn: 'color-burn', hardLight: 'hard-light', softLight: 'soft-light',
    difference: 'difference', exclusion: 'exclusion', hue: 'hue', saturation: 'saturation',
    color: 'color', luminosity: 'luminosity',
};

export function blendModeToCss(value?: string): string {
    return (value && BLEND_MODES[value]) || 'normal';
}

const FONT_WEIGHT: Record<string, string> = {
    w100: '100', w200: '200', w300: '300', w400: '400', w500: '500',
    w600: '600', w700: '700', w800: '800', w900: '900', normal: '400', bold: '700',
};

export function fontWeightToCss(value?: string): string | undefined {
    return value ? FONT_WEIGHT[value] : undefined;
}

const TEXT_ALIGN: Record<string, string> = {
    left: 'left', right: 'right', center: 'center', justify: 'justify', start: 'left', end: 'right',
};

export function textAlignToCss(value?: string): string | undefined {
    return value ? TEXT_ALIGN[value] : undefined;
}

const TEXT_DECORATION: Record<string, string> = {
    none: 'none', lineThrough: 'line-through', overline: 'overline', underline: 'underline',
};

export function textDecorationToCss(value?: string): string | undefined {
    return value ? TEXT_DECORATION[value] : undefined;
}

/** "Clip.none" is the only dynamic_widget clip value that should NOT hide overflow. */
export function clipToOverflow(value?: string): 'visible' | 'hidden' {
    return value === 'none' ? 'visible' : 'hidden';
}

export function styleStr(styles: Record<string, string | number | undefined | false>): string {
    const parts: string[] = [];
    for (const key of Object.keys(styles)) {
        const v = styles[key];
        if (v === undefined || v === false || v === '') { continue; }
        const cssKey = key.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
        parts.push(`${cssKey}:${v}`);
    }
    return parts.join(';');
}

export function attrStyle(style: string): string {
    return style ? ` style="${escapeAttr(style)}"` : '';
}

export function attr(name: string, value?: string): string {
    return value ? ` ${name}="${escapeAttr(value)}"` : '';
}

export function titleAttr(value?: string): string {
    return value ? ` title="${escapeAttr(value)}"` : '';
}
