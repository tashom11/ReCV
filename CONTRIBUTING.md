# Contributing to Re:CV

Thank you for your interest in Re:CV. Issues and pull requests are welcome, in English or in French.

## Before you start

- **Small fix** (typo, obvious bug): open a pull request directly.
- **New feature, new dependency or larger change**: open an issue first, so we can agree on the approach before you
  spend time on it.
- **Security vulnerability**: do not open a public issue; follow [SECURITY.md](SECURITY.md).

## Setup

Requirements: Windows, Node.js 24 or later.

```bash
npm install
npm run dev        # the app, with hot reload
```

Before opening a pull request, all of these must pass (the CI runs them too):

```bash
npm run typecheck
npm run lint       # Biome; `npx biome check --write .` fixes formatting
npm test           # Vitest
```

To try the whole pipeline on text files without Electron, see `npm run try` in the [README](README.md#develop).

## Project layout

| Folder | Rule |
|---|---|
| `src/core` | Pure business logic. No Electron import, nothing tied to the window: it must be testable on its own. |
| `src/main` | Main process: database, IPC handlers, model downloads, updates. Every IPC input is validated with Zod. |
| `src/preload` | The only bridge to the interface (`contextBridge`). Never enable `nodeIntegration`. |
| `src/renderer` | React interface: `screens/`, `ui/` (one component per file), `i18n/` (displayed texts). |

## Conventions

### No personal data, ever

Never commit real personal data: no real résumé (yours or anyone's), phone number, e-mail, address, employer, school
or personal website, not even in tests or fixtures. Use fictitious data (`claire@exemple.fr`, `06 12 34 56 78`,
invented names and companies). `npm run check:personal-data` runs in the CI; enable it before every commit with:

```bash
git config core.hooksPath .githooks
```

To protect your own strings (employer, town…), list them in an untracked `.private-patterns` file at the root, one
per line.

### Languages

- **Code is in English**: identifiers, file names, comments, test names, commit messages.
- **Displayed texts are in French** and address the user formally (« vous »). They all live in
  `src/renderer/src/i18n/fr.ts` and are read through `texts.…`: never write a visible text directly in a component.
- **Prompts stay in French** (`src/core/llm/`, `src/core/tailoring/`): the produced résumés are in French, and small
  local models write better French when the prompt is in French. Test data is French too.
- Labels written on the produced résumé live in `CV_LABELS` (`src/core/export/cvDocument.ts`).

### The model never invents

Re:CV only selects, reorders and rephrases what is already in the user's résumé. Any change to the prompts or to the
tailoring pipeline must keep that promise:

- every model output goes through a Zod schema;
- a skill the résumé does not show is only ever offered as an unchecked box;
- tests use `MockProvider` / `MockEngine`: **no real model call in Vitest**.

### Accessibility

The interface targets WCAG 2.2 AA. For any interface change, check at least:

- everything works with the keyboard alone, with a visible focus;
- every field has a label, every icon-only button an accessible name;
- after a screen change or a removal, the focus lands somewhere sensible;
- no horizontal scrolling at 320 px wide (400 % zoom).

### Dependencies

Do not add a dependency without discussing it in an issue first: Re:CV ships as a desktop installer and every package
adds weight and attack surface.

### Pitfalls

- Never use `Re:CV` in a file name, an artifact name or `productName`: `:` is forbidden in Windows file names, and
  Electron derives its data folder from `productName`. `Re:CV` only appears in displayed titles.
- `node-llama-cpp` is ESM with top-level await: always import it dynamically (`await import('node-llama-cpp')`).
- Database changes go through a new migration in `src/main/db/migrations.ts` (`PRAGMA user_version`); never edit an
  existing one.

## Pull requests

- Keep each pull request focused on one change; small, targeted diffs are reviewed faster.
- Add or update tests for any behaviour change.
- Describe what changes for the user, and how you checked it.

By contributing, you agree that your contribution is released under the [MIT License](LICENSE) and that you follow
the [Code of Conduct](CODE_OF_CONDUCT.md).
