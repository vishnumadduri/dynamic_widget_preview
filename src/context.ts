/** Services a widget renderer needs from its host webview, without depending on vscode directly. */
export interface RenderContext {
    /** Resolves an AssetImage-style relative path to a URI the webview can load, or '' if unavailable. */
    resolveAsset: (relativePath: string) => string;
    /** Resolves a FileImage-style absolute path to a URI the webview can load, or '' if unavailable. */
    resolveFile: (absolutePath: string) => string;
    /** Registers a CSS rule keyed by a generated class name (needed for pseudo-elements like ::first-letter). */
    addStyleRule: (build: (className: string) => string) => string;
}
