# Contributing to Local Agent Office

Thanks for your interest in improving Local Agent Office! Issues and pull requests are welcome.

## Getting started

```bash
npm install
npm run dev      # esbuild watch — rebuilds main.js on change
npm test         # Vitest (the pure, testable core)
npm run lint     # ESLint (typescript-eslint + eslint-plugin-obsidianmd)
npm run build    # typecheck + production bundle
```

To test inside Obsidian, symlink or copy `main.js`, `manifest.json` and `styles.css`
into `<your-vault>/.obsidian/plugins/local-agent-office/`, then reload (Ctrl/Cmd+R).

## Architecture

The codebase splits into a **pure, framework-free core** (unit-tested with Vitest) and a
**thin Obsidian layer**:

- Core (no Obsidian imports, fully tested): `src/agency`, `src/brainstorm`, `src/squad`,
  `src/canvas`, `src/context`, `src/registry`, `src/i18n`.
- Obsidian layer (views, commands, modals, settings): `src/main.ts`, `src/office`,
  `src/chat`, `src/settings`, `src/providers`.

Keep new logic in the pure core where possible, and cover it with a test in `tests/`.

## Pull requests

Before opening a PR, please make sure:

1. `npm test` passes (add tests for new behavior).
2. `npm run lint` is clean.
3. `npm run build` succeeds.
4. UI strings are added to **both** `en` and `pt` dictionaries in `src/i18n/index.ts`.
5. The change is focused — one concern per PR.

## Reporting issues

Include your OS, Obsidian version, the provider you use (without the API key), and clear
steps to reproduce. For agent-behavior issues, the **Validate agents** command output helps.

## Code of conduct

Be kind and constructive. This is a small project built in the open — assume good faith.
