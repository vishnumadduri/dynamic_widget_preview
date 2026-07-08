import { parseColor, fontWeightToCss, textDecorationToCss, num } from './utils';

/** Converts a dynamic_widget TextStyle json object into a CSS declaration map. */
export function textStyleToCss(style: any): Record<string, string | undefined> {
    if (!style || typeof style !== 'object') { return {}; }
    const css: Record<string, string | undefined> = {};
    const color = parseColor(style.color);
    if (color) { css.color = color; }
    const fontSize = num(style.fontSize);
    if (fontSize !== undefined) { css.fontSize = `${fontSize}px`; }
    if (style.fontStyle) { css.fontStyle = style.fontStyle === 'italic' ? 'italic' : 'normal'; }
    const weight = fontWeightToCss(style.fontWeight);
    if (weight) { css.fontWeight = weight; }
    if (style.fontFamily) { css.fontFamily = style.fontFamily; }
    const decoration = textDecorationToCss(style.decoration);
    if (decoration) { css.textDecorationLine = decoration; }
    return css;
}
