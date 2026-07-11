# Quasar App (quasar-project)

A Quasar Project

## Refactoring governance

Incremental refactoring in this legacy application is governed by the
[RSS Reader Constitution](.specify/memory/constitution.md). Refactors preserve
observable behavior by default, use independently reversible increments, and require
test evidence before high-risk changes.

## Install the dependencies
```bash
yarn
# or
npm install
```

### Start the app in development mode (hot-code reloading, error reporting, etc.)
```bash
quasar dev
```


### Build the app for production
```bash
quasar build
```

### Type check
```bash
npm run typecheck
```

### Run real RSS end-to-end check
```bash
npm run test:real-rss
```

### Customize the configuration
See [Configuring quasar.config.js](https://v2.quasar.dev/quasar-cli-vite/quasar-config-js).
