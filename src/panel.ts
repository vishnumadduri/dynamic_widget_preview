import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { renderWidget } from './render';
import { RenderContext } from './context';

const BASE_CSS = `
html, body { margin:0; padding:0; }
body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #1d1d1d;
    background: #f5f5f5;
}
* { box-sizing: border-box; }
img { max-width: 100%; }
.dw-root { padding: 12px; }
.dw-unknown {
    padding: 8px; margin: 2px 0; border: 1px dashed #d32f2f; color: #b71c1c;
    font-size: 0.85em; background: #fdecea; border-radius: 4px;
}
.dw-error { padding: 16px; color: #d32f2f; font-family: monospace; white-space: pre-wrap; }

/* SizedBox/Expanded/AspectRatio give their child *tight* constraints in Flutter: the
   child fills the box exactly, even a bare Container with no width/height of its own. */
.dw-sizedbox, .dw-expandedsizedbox, .dw-expanded, .dw-aspectratio { display: flex; }
.dw-sizedbox > *, .dw-expandedsizedbox > *, .dw-expanded > *, .dw-aspectratio > * {
    flex: 1 1 auto; width: 100%; height: 100%; min-width: 0; min-height: 0;
}
`;

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
                enableScripts: false,
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
        const csp = `default-src 'none'; img-src ${webview.cspSource} https: data:; style-src 'unsafe-inline' ${webview.cspSource};`;

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
<div class="dw-root">${body}</div>
</body>
</html>`;
    }

    private buildErrorHtml(message: string): string {
        const escaped = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><style>${BASE_CSS}</style></head>
<body><div class="dw-error"><h3>Failed to render preview</h3><pre>${escaped}</pre></div></body>
</html>`;
    }
}
