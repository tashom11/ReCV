## What changes

<!-- What changes for the person using Re:CV, in a sentence or two. Link the issue: "Closes #123". -->

## How it was checked

<!-- Tests added or updated, and what you tried in the app (`npm run dev`). -->

## Checklist

- [ ] `npm run typecheck`, `npm run lint` and `npm test` pass
- [ ] Code, names and comments in English; displayed texts in French, in `src/renderer/src/i18n/fr.ts`
- [ ] No real model call in the tests (`MockProvider` / `MockEngine`)
- [ ] The model still never adds anything the resume does not contain
- [ ] Interface change: usable with the keyboard alone, labelled fields, no horizontal scrolling at 320 px
- [ ] No new dependency, or it was discussed in an issue first
