import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { renderWidget } from './render';
import { RenderContext } from './context';

const PRESETS: Record<string, { w: number; h: number; label: string }> = {
    '480p': { w: 854, h: 480, label: '480p' },
    '720p': { w: 1280, h: 720, label: '720p' },
    '1080p': { w: 1920, h: 1080, label: '1080p' },
    '4k': { w: 3840, h: 2160, label: '4K' },
};
const DEFAULT_PRESET = '720p';

const BASE_CSS = `
html, body {
    margin: 0; padding: 0; height: 100%;
    display: flex; flex-direction: column;
}
body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #1d1d1d;
    background: var(--vscode-editor-background, #1e1e1e);
}
* { box-sizing: border-box; }
img { max-width: 100%; }

.dw-toolbar {
    flex: 0 0 auto;
    display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px;
    padding: 6px 10px;
    background: var(--vscode-sideBar-background, #252526);
    border-bottom: 1px solid var(--vscode-widget-border, rgba(128,128,128,0.3));
    color: var(--vscode-foreground, #ccc);
    font-size: 12px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}
.dw-toolbar label { display: flex; align-items: center; gap: 4px; flex: 0 0 auto; white-space: nowrap; }
.dw-toolbar input {
    background: var(--vscode-input-background, #3c3c3c);
    color: var(--vscode-input-foreground, #ccc);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 3px;
    padding: 2px 4px;
    font-size: 12px;
}
.dw-toolbar input[type="number"] { width: 70px; }
.dw-toolbar button {
    background: var(--vscode-button-secondaryBackground, #3a3d41);
    color: var(--vscode-button-secondaryForeground, #ccc);
    border: none; border-radius: 3px; padding: 3px 8px; cursor: pointer; font-size: 12px;
}
.dw-toolbar button:hover { background: var(--vscode-button-secondaryHoverBackground, #45494e); }
.dw-toolbar .dw-dims { color: var(--vscode-descriptionForeground, #999); }
.dw-presets, .dw-orient { display: flex; gap: 4px; flex: 0 0 auto; }
.dw-preset-btn.active, .dw-orient-btn.active {
    background: var(--vscode-button-background, #0e639c);
    color: var(--vscode-button-foreground, #fff);
}
.dw-zoom { display: flex; align-items: center; gap: 4px; flex: 0 0 auto; }
.dw-zoom button { padding: 3px 9px; }
.dw-zoom-label { min-width: 42px; text-align: center; color: var(--vscode-descriptionForeground, #999); }

.dw-stage {
    flex: 1 1 auto; overflow: auto;
    display: flex; align-items: flex-start; justify-content: center;
    padding: 28px; background: var(--vscode-editorWidget-background, #1e1e1e);
}
.dw-frame-wrap { flex-shrink: 0; }
.dw-frame {
    background: #f5f5f5;
    border-radius: 14px;
    box-shadow: 0 10px 34px rgba(0,0,0,0.4);
    overflow: hidden;
    transform-origin: top left;
}
.dw-root { height: 100%; overflow: auto; padding: 12px; }

.dw-unknown {
    padding: 8px; margin: 2px 0; border: 1px dashed #d32f2f; color: #b71c1c;
    font-size: 0.85em; background: #fdecea; border-radius: 4px;
}
.dw-error { padding: 16px; color: #d32f2f; font-family: monospace; white-space: pre-wrap; }

/* SizedBox/Expanded/AspectRatio give their child *tight* constraints in Flutter: the
   child fills the box exactly, even a bare Container with no width/height of its own. */
.dw-sizedbox, .dw-expandedsizedbox, .dw-expanded, .dw-aspectratio, .dw-fittedbox-fill { display: flex; }
.dw-sizedbox > *, .dw-expandedsizedbox > *, .dw-expanded > *, .dw-aspectratio > *, .dw-fittedbox-fill > * {
    flex: 1 1 auto; width: 100%; height: 100%; min-width: 0; min-height: 0;
}
`;

const ERROR_CSS = `
html, body { margin: 0; padding: 0; height: 100%; overflow: auto; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f5; }
.dw-error { padding: 16px; color: #d32f2f; font-family: monospace; white-space: pre-wrap; }
`;

function nonce(): string {
    return crypto.randomBytes(16).toString('hex');
}

function presetButtons(): string {
    return Object.entries(PRESETS)
        .map(([key, p]) => `<button class="dw-preset-btn" data-key="${key}" title="${p.w}x${p.h}">${p.label}</button>`)
        .join('');
}

export class PreviewPanel {
    private static readonly viewType = 'dynamicWidgetPreview';
    private static readonly panels = new Map<string, PreviewPanel>();

    private readonly panel: vscode.WebviewPanel;
    private readonly sourceUri: vscode.Uri;
    private readonly disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri, sourceUri: vscode.Uri): void {
        const key = sourceUri.toString();
        const existing = PreviewPanel.panels.get(key);
        if (existing) {
            existing.panel.reveal(vscode.ViewColumn.Beside);
            existing.refresh();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            PreviewPanel.viewType,
            `Preview: ${path.basename(sourceUri.fsPath)}`,
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.file(path.dirname(sourceUri.fsPath)), extensionUri],
                retainContextWhenHidden: true,
            }
        );

        const instance = new PreviewPanel(panel, sourceUri);
        PreviewPanel.panels.set(key, instance);
    }

    private constructor(panel: vscode.WebviewPanel, sourceUri: vscode.Uri) {
        this.panel = panel;
        this.sourceUri = sourceUri;

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        const watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(path.dirname(sourceUri.fsPath), path.basename(sourceUri.fsPath))
        );
        watcher.onDidChange(() => this.refresh(), null, this.disposables);
        watcher.onDidCreate(() => this.refresh(), null, this.disposables);
        this.disposables.push(watcher);

        this.disposables.push(vscode.workspace.onDidSaveTextDocument(doc => {
            if (doc.uri.toString() === this.sourceUri.toString()) { this.refresh(); }
        }));

        this.refresh();
    }

    private dispose(): void {
        PreviewPanel.panels.delete(this.sourceUri.toString());
        this.disposables.forEach(d => d.dispose());
    }

    private refresh(): void {
        try {
            const text = fs.readFileSync(this.sourceUri.fsPath, 'utf8');
            const json = JSON.parse(text);
            this.panel.title = `Preview: ${path.basename(this.sourceUri.fsPath)}`;
            this.panel.webview.html = this.buildHtml(json);
        } catch (err: any) {
            this.panel.webview.html = this.buildErrorHtml(err?.message ?? String(err));
        }
    }

    private buildHtml(json: any): string {
        const webview = this.panel.webview;
        const baseDir = path.dirname(this.sourceUri.fsPath);
        const rules: string[] = [];
        let counter = 0;

        const ctx: RenderContext = {
            resolveAsset: (relPath: string) => {
                if (!relPath) { return ''; }
                try {
                    const abs = path.isAbsolute(relPath) ? relPath : path.join(baseDir, relPath);
                    if (!fs.existsSync(abs)) { return ''; }
                    return webview.asWebviewUri(vscode.Uri.file(abs)).toString();
                } catch { return ''; }
            },
            resolveFile: (absPath: string) => {
                if (!absPath) { return ''; }
                try {
                    if (!fs.existsSync(absPath)) { return ''; }
                    return webview.asWebviewUri(vscode.Uri.file(absPath)).toString();
                } catch { return ''; }
            },
            addStyleRule: build => {
                const className = `dw-gen-${counter++}`;
                rules.push(build(className));
                return className;
            },
        };

        const body = renderWidget(json, ctx);
        const nonceVal = nonce();
        const csp = `default-src 'none'; img-src ${webview.cspSource} https: data:; style-src 'unsafe-inline' ${webview.cspSource}; script-src 'nonce-${nonceVal}';`;
        const defaultPreset = PRESETS[DEFAULT_PRESET];

        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<title>Dynamic Widget Preview</title>
<style>
${BASE_CSS}
${rules.join('\n')}
</style>
</head>
<body>
<div class="dw-toolbar">
    <div class="dw-presets" id="dwPresets">${presetButtons()}</div>
    <label>W <input id="dwWidth" type="number" min="100" max="8000" value="${defaultPreset.w}"></label>
    <label>H <input id="dwHeight" type="number" min="100" max="8000" value="${defaultPreset.h}"></label>
    <div class="dw-orient">
        <button id="dwLandscape" class="dw-orient-btn" title="Landscape orientation">Landscape</button>
        <button id="dwPortrait" class="dw-orient-btn" title="Portrait orientation">Portrait</button>
    </div>
    <div class="dw-zoom">
        <button id="dwZoomOut" title="Zoom out">−</button>
        <span class="dw-zoom-label" id="dwZoomLabel">100%</span>
        <button id="dwZoomIn" title="Zoom in">+</button>
        <button id="dwZoomFit" title="Fit to window">Fit</button>
    </div>
    <span class="dw-dims" id="dwDims"></span>
</div>
<div class="dw-stage" id="dwStage">
    <div class="dw-frame-wrap" id="dwFrameWrap">
        <div class="dw-frame" id="dwFrame">
            <div class="dw-root">${body}</div>
        </div>
    </div>
</div>
<script nonce="${nonceVal}">
(function() {
    const PRESETS = ${JSON.stringify(PRESETS)};
    const vscode = acquireVsCodeApi();
    const stage = document.getElementById('dwStage');
    const wrap = document.getElementById('dwFrameWrap');
    const frame = document.getElementById('dwFrame');
    const presetButtons = Array.prototype.slice.call(document.querySelectorAll('.dw-preset-btn'));
    const widthInput = document.getElementById('dwWidth');
    const heightInput = document.getElementById('dwHeight');
    const landscapeBtn = document.getElementById('dwLandscape');
    const portraitBtn = document.getElementById('dwPortrait');
    const zoomInBtn = document.getElementById('dwZoomIn');
    const zoomOutBtn = document.getElementById('dwZoomOut');
    const zoomFitBtn = document.getElementById('dwZoomFit');
    const zoomLabel = document.getElementById('dwZoomLabel');
    const dims = document.getElementById('dwDims');
    const STAGE_PADDING = 56;

    function clampZoom(z) { return Math.min(5, Math.max(0.05, z)); }

    const saved = vscode.getState() || {};
    const initial = PRESETS['${DEFAULT_PRESET}'];
    let state = {
        preset: saved.preset || '${DEFAULT_PRESET}',
        width: saved.width || initial.w,
        height: saved.height || initial.h,
        zoom: saved.zoom || 1,
    };

    function applyFrame() {
        frame.style.width = state.width + 'px';
        frame.style.height = state.height + 'px';
        frame.style.transform = 'scale(' + state.zoom + ')';
        wrap.style.width = (state.width * state.zoom) + 'px';
        wrap.style.height = (state.height * state.zoom) + 'px';
        widthInput.value = String(state.width);
        heightInput.value = String(state.height);
        presetButtons.forEach(function(btn) {
            btn.classList.toggle('active', btn.getAttribute('data-key') === state.preset);
        });
        landscapeBtn.classList.toggle('active', state.width >= state.height);
        portraitBtn.classList.toggle('active', state.height >= state.width);
        zoomLabel.textContent = Math.round(state.zoom * 100) + '%';
        dims.textContent = state.width + ' x ' + state.height;
        vscode.setState(state);
    }

    presetButtons.forEach(function(btn) {
        btn.addEventListener('click', function() {
            const key = btn.getAttribute('data-key');
            const p = PRESETS[key];
            if (!p) { return; }
            state.preset = key;
            state.width = p.w;
            state.height = p.h;
            applyFrame();
        });
    });

    widthInput.addEventListener('change', function() {
        const v = parseInt(widthInput.value, 10);
        state.width = isNaN(v) ? state.width : Math.max(100, v);
        state.preset = '';
        applyFrame();
    });

    heightInput.addEventListener('change', function() {
        const v = parseInt(heightInput.value, 10);
        state.height = isNaN(v) ? state.height : Math.max(100, v);
        state.preset = '';
        applyFrame();
    });

    landscapeBtn.addEventListener('click', function() {
        if (state.height > state.width) {
            const w = state.width;
            state.width = state.height;
            state.height = w;
        }
        applyFrame();
    });

    portraitBtn.addEventListener('click', function() {
        if (state.width > state.height) {
            const h = state.height;
            state.height = state.width;
            state.width = h;
        }
        applyFrame();
    });

    zoomInBtn.addEventListener('click', function() {
        state.zoom = clampZoom(state.zoom * 1.25);
        applyFrame();
    });

    zoomOutBtn.addEventListener('click', function() {
        state.zoom = clampZoom(state.zoom / 1.25);
        applyFrame();
    });

    zoomFitBtn.addEventListener('click', function() {
        const availW = stage.clientWidth - STAGE_PADDING;
        const availH = stage.clientHeight - STAGE_PADDING;
        state.zoom = clampZoom(Math.min(availW / state.width, availH / state.height));
        applyFrame();
    });

    applyFrame();
})();
</script>
</body>
</html>`;
    }

    private buildErrorHtml(message: string): string {
        const escaped = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><style>${ERROR_CSS}</style></head>
<body><div class="dw-error"><h3>Failed to render preview</h3><pre>${escaped}</pre></div></body>
</html>`;
    }
}
