# Mind Map

Mind Map is an open-source, local-first visual workspace for organizing ideas, relationships, notes, and technical context. It runs entirely in the browser: projects and attached files stay in the browser's IndexedDB storage, and the application does not require an account, backend, telemetry, or network access after installation.

## Requirements

- Node.js 20 or newer
- npm 10 or newer
- A current desktop Chrome, Edge, or Firefox for normal use

## Install and run

```bash
npm install
npm run dev
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). The fixed loopback origin and port are intentional: browser storage belongs to an origin, so changing `127.0.0.1`, hostname, or port can make an existing project appear to be missing.

The app is usable offline after dependencies are installed and the local server is running. It does not load fonts, icons, analytics, or application data from remote services.

## Verify a checkout

```bash
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium firefox
npm run test:e2e
```

The Playwright flow covers project creation, node creation, autosave, and restoration after reload. Browser coverage is configured for Chromium and Firefox. When Microsoft Edge is installed, include its channel locally with:

```bash
TEST_EDGE=1 npx playwright test --project=edge
```

In PowerShell, use `$env:TEST_EDGE = '1'` before the command.

## Backups and storage

Use **Export backup** regularly. A backup is JSON containing the versioned project document and base64-encoded local attachment bytes. **Import project** validates the entire payload before writing it. Export remains available when a save fails or another tab wins a conflict, so in-memory changes are not silently discarded.

Browser storage is local to the current browser profile and origin. Clearing site data, using private browsing, changing the origin, uninstalling the browser, or storage eviction can remove projects. Keep backups outside the browser. The application cannot recover data that was cleared without a backup.

Current limits are 10 MiB per file, 50 MiB of active attachments per project, and 75 MiB per imported backup. Markdown export is documentation only and cannot be imported back into a project.

The JSON contract is documented in [docs/JSON_FORMAT.md](docs/JSON_FORMAT.md), with a small valid fixture in [docs/example-project.json](docs/example-project.json).
The current verification record, including environment-limited checks, is in [docs/VALIDATION.md](docs/VALIDATION.md).

## Design and scope

The editor uses a dark, compact canvas with a discrete grid, a collapsible sidebar (projects, outline, notes), a contextual selection toolbar, an on-demand details drawer, groups, editable and resizable Markdown notes, configurable node types, search, command palette actions, local attachments, undo/redo, and versioned JSON backups. See [docs/README.md](docs/README.md) for the implementation tickets and [docs/references](docs/references) for the visual guide.

The MVP intentionally does not include accounts, authentication, collaboration, synchronization, a backend, AI, plugins, auto-layout, multiple canvases per project, or PNG/SVG/Mermaid export.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Please keep the lockfile in sync, add behavior-focused tests for changes, and document any verification that could not be run.

## License

MIT. See [LICENSE](LICENSE).
