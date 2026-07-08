import * as vscode from 'vscode';
import { PreviewPanel } from './panel';

export function activate(context: vscode.ExtensionContext): void {
    const openPreview = vscode.commands.registerCommand('dynamicWidgetPreview.start', (uri?: vscode.Uri) => {
        const target = resolveTargetUri(uri);
        if (!target) {
            vscode.window.showErrorMessage('Open or select a JSON file to preview.');
            return;
        }
        PreviewPanel.createOrShow(context.extensionUri, target);
    });

    context.subscriptions.push(openPreview);
}

function resolveTargetUri(uri?: vscode.Uri): vscode.Uri | undefined {
    if (uri && uri.scheme === 'file') { return uri; }
    const active = vscode.window.activeTextEditor;
    if (active && active.document.uri.scheme === 'file') { return active.document.uri; }
    return undefined;
}

export function deactivate(): void {}
