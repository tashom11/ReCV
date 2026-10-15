# Landing page

Static page (HTML, CSS, one small script) that presents Re:CV and links to the installer. No build step, no dependency.

- `index.html`, `style.css`: the page, with the colours and fonts of the application.
- `download.js`: reads the latest GitHub release to point the buttons at the installer (falls back to the releases
  page). No cookie, no tracking.
- `vercel.json`: security headers (strict Content-Security-Policy) and font caching.
- `assets/`: logo, screenshots (copied from `docs/captures/`) and self-hosted fonts (Atkinson Hyperlegible and
  Bricolage Grotesque, SIL Open Font License).

## Preview

Open `index.html` in a browser, or serve the folder: `npx serve site`.

## Deploy on Vercel

Import the repository, then set **Root Directory** to `site`, **Framework Preset** to *Other*, and leave the build
command and output directory empty. To avoid redeploying on application-only commits, set *Ignored Build Step* to
`git diff --quiet HEAD^ HEAD -- .`.
