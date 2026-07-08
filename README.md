# Dynamic Widget Preview

Live preview for [dynamic_widget](https://pub.dev/packages/dynamic_widget) JSON files, right inside VS Code. Renders the widget tree as an approximate visual layout in a side webview and refreshes automatically when the JSON file is saved or changed on disk.

## Try it

1. `npm install`
2. Press `F5` (or run the "Run Extension" launch config) to open an Extension Development Host.
3. In that window, open `samples/weather.json` (a more complex, real-world layout — see below), right-click it in the Explorer (or use the Command Palette) and run **Dynamic Widget: Open Preview**.

### Samples

- `samples/demo.json` — quick smoke test touching most widget types.
- `samples/weather.json` — a complex weather screen (`Scaffold`/`AppBar`, hero section, horizontally-scrolling hourly forecast, a 7-day forecast list, and a details grid). It demonstrates both ways to show a widget icon/image:
  - `NetworkImage` — weather icons fetched live from `openweathermap.org`'s public icon CDN.
  - `AssetImage` — local icon files bundled in `samples/assets/`, resolved relative to the JSON file's own folder (works the same way for any asset path you reference from your own JSON). `FileImage` (an absolute path on disk) is resolved the same way — swap in a `filePath` pointing at a file on your machine to try it.

## Usage

- Right-click any `.json` file in the Explorer → **Dynamic Widget: Open Preview**.
- Or open a `.json` file and click the preview icon in the editor title bar, or run the command from the Command Palette.
- The preview panel re-renders automatically whenever the source file is saved or changed externally.

## Build

```
npm install    # install dependencies
npm run compile   # one-off TypeScript build -> dist/
npm run watch      # incremental build on file change (for development)
```

## Package as a .vsix

```
npm run package
```

This runs `vsce package` (via the `vscode:prepublish` hook it also recompiles first), producing `dynamic-widget-preview-<version>.vsix` in the project root. Install the result with:

```
code --install-extension dynamic-widget-preview-0.1.0.vsix
```

or in VS Code: Extensions view → `...` menu → **Install from VSIX...**.

`.vscodeignore` keeps the package limited to `dist/`, `package.json`, `README.md`, and `LICENSE` — source `.ts` files, editor config, `widgets.md`, and `samples/` are excluded.

## Supported widgets

All widget types documented in `widgets.md`: `Container`, `Text`, `SelectableText`, `TextSpan`/`TextStyle` (as nested properties), `RaisedButton`, `ElevatedButton`, `TextButton`, `Row`, `Column`, `AssetImage`, `NetworkImage`, `FileImage`, `Placeholder`, `GridView`, `ListView`, `PageView`, `Expanded`, `Padding`, `Center`, `Align`, `AspectRatio`, `FittedBox`, `Baseline`, `Stack`, `Positioned`, `IndexedStack`, `ExpandedSizedBox`, `SizedBox`, `Opacity`, `Wrap`, `ClipRRect`, `SafeArea`, `ListTile`, `Icon`, `DropCapText`, `Scaffold`, `AppBar`, `LimitedBox`, `Offstage`, `OverflowBox`, `Divider`, `RotatedBox`, `Card`, `SingleChildScrollView`.

Unknown or malformed widget nodes render as an inline warning instead of failing the whole preview.

## Notes on fidelity

This maps dynamic_widget JSON to HTML/CSS approximations (flexbox for `Row`/`Column`/`Wrap`, absolute positioning for `Stack`/`Positioned`, etc.) — it's meant for fast layout/content iteration, not pixel-perfect parity with Flutter's renderer. `Icon` uses a small glyph lookup table rather than the actual Material/FontAwesome icon fonts, and a few visual-only properties (e.g. `elevation` shadows, `blendMode`) are best-effort approximations.
