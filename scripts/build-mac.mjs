// Builds dist/mac/Markdown Outliner.app: the page (vite.mac.config.ts), the Swift app (mac/) compiled
// with swiftc from the Command Line Tools, and an ad-hoc signature. `--debug` compiles with
// `-D DEBUG`, which enables the `-debugScript` launch argument (see mac/main.swift).
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const debug = process.argv.includes('--debug');
const { version } = JSON.parse(await readFile(path.join(rootDirectory, 'package.json'), 'utf8'));
const executable = 'MarkdownOutliner';
const app = path.join(rootDirectory, 'dist', 'mac', 'Markdown Outliner.app');
const run = (command, args) => execFileSync(command, args, { cwd: rootDirectory, stdio: 'inherit' });

run('npx', ['vite', 'build', '--config', 'vite.mac.config.ts']);
await rm(app, { recursive: true, force: true });
await mkdir(path.join(app, 'Contents', 'MacOS'), { recursive: true });
run('swiftc', [
  '-O', '-target', `${process.arch === 'arm64' ? 'arm64' : 'x86_64'}-apple-macos11.0`,
  ...(debug ? ['-D', 'DEBUG'] : []),
  'mac/main.swift', 'mac/Workspace.swift',
  '-o', path.join(app, 'Contents', 'MacOS', executable),
]);
await cp(path.join(rootDirectory, 'dist', 'mac', 'web'), path.join(app, 'Contents', 'Resources', 'web'), { recursive: true });
await writeFile(path.join(app, 'Contents', 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleExecutable</key><string>${executable}</string>
  <key>CFBundleIdentifier</key><string>io.github.hota911.markdown-outliner</string>
  <key>CFBundleName</key><string>Markdown Outliner</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>${version}</string>
  <key>CFBundleVersion</key><string>${version}</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSPrincipalClass</key><string>NSApplication</string>
</dict>
</plist>
`);
run('codesign', ['--force', '--sign', '-', app]);
console.log(`Built ${path.relative(rootDirectory, app)}${debug ? ' (debug)' : ''}`);
