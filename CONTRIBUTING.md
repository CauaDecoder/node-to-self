# Contributing

Thanks for helping improve Mind Map. The project is intentionally small and local-first; keep changes focused on an observable user outcome.

## Development

1. Install Node.js 20+ and npm 10+.
2. Run `npm install`.
3. Start the fixed-origin server with `npm run dev`.
4. Make the smallest coherent change and add a behavior-focused unit or browser test when behavior changes.

Before opening a change, run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

If a browser or environment check cannot be run, say so explicitly in the change description. Do not describe an unrun check as passing.

## Persistence and data safety

Do not add remote services, telemetry, authentication, or required network resources. Preserve the versioned JSON format, validate imports with Zod, and keep save failures recoverable. Changes to persisted data need a migration and tests; do not invent migrations for versions that do not exist.

## Pull requests

Describe the user-visible result, tests run, and known limitations. Keep `package-lock.json` synchronized with `package.json`. Avoid committing generated `dist/`, Playwright reports, test results, or browser binaries.

## License

By contributing, you agree that your contribution is provided under the MIT License in [LICENSE](LICENSE).
