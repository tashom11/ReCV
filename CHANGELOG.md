# Changelog

All notable changes to Re:CV. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Diagnostic report: each CV import records how many experiences, skills, education entries and languages the model
  returned and how many were kept (numbers only), to tell a model that read little from a filter that removed too much.
- Review screen: "Experiences in this CV" lets you untick any kept experience to leave it out of this CV only (your
  profile is not modified), whatever its age.
- Settings: "Save graphics card memory" (built-in model). A smaller context leaves room for more of the model on the
  card, which speeds up the computation on cards with little memory.

### Changed
- A stray "{" or other punctuation-only value left by the model is no longer kept as a skill, language or title (also
  for profiles imported before).
- Larger default window (up to 1440 × 940, never more than 90 % of the usable screen), with a minimum size.
- Import: a CV the model could not read (no experience, skill nor education extracted) is no longer saved as an empty
  profile; a clear message points to the "Soigné" model level. Small models returned empty lists.
- The "Soigné" model (9B) is recommended from 8 GB of graphics memory, the smaller ones reading CVs unreliably.
- The "suggest a sentence" button now says when your CV lists no quality, instead of a generic failure.
- Settings: the online service option states that your CV and job postings are sent to that service.
- When only part of the built-in model fits on the graphics card, the CV import and the tailoring screens say how many
  layers it holds (e.g. 24 out of 36) and that the rest runs on the processor, which explains a slow computation.

## [0.4.0] - 2026-10-15

### Security
- A custom model file is chosen with the file picker only; the app refuses any other path.

### Added
- Third-party notices (THIRD_PARTY_NOTICES.md) shipped with the app, next to the Re:CV license.
- Uninstalling asks whether to also delete your data (CV, settings, downloaded models); "No" by default.

### Changed
- More breathing room between the content and the window edges on every screen, growing with the window width.
- The installer no longer ships NVIDIA CUDA binaries (about 520 MB, over half of its size): the engine uses the graphics
  card through Vulkan, NVIDIA cards included. It also drops llama.cpp sources, whose very long paths could make the
  installation fail on Windows without long path support.
- The built-in engine never tries to compile llama.cpp on your computer when its prebuilt binaries cannot load.
- A red badge on the Settings button signals an update ready to install (replaces the separate "update ready" button).

## [0.3.0] - 2026-10-14

### Added
- A "report a problem" card in Settings: copies a diagnostic report to paste into a bug report, and shows what was copied.
- Local diagnostic log (error codes only, never CV data); it never leaves the computer unless you copy the report.
- Removing an experience, a degree or a language can be undone.
- Contributor documentation: English README with a French version, contributing guide, security policy, code of
  conduct, issue and pull request templates.

### Changed
- Corrections to your CV are saved automatically, even when leaving the screen without clicking "continue".
- Choices in Settings are saved immediately; unsaved text fields are flagged.
- Only the active profile and the 20 most recent tailored CVs are kept.
- Faster previews while editing: the selected layout updates first, the thumbnails after a pause.
- Faster tailoring with the built-in model.
- Smaller interface bundle and installer.
- Data from earlier versions is migrated automatically on first launch.

### Fixed
- "Erase everything" in Settings now really removes the data from the disk.
- A damaged database no longer prevents the app from starting; it is set aside and the app starts empty.
- Closing the app no longer hangs when the built-in model takes too long to unload.

### Accessibility
- Screen readers: each screen announces its title, the focus moves to it, and downloads are announced every 10 %.
- Full keyboard use of tabs, layout choice and the confirmation dialog.
- Usable at 400 % zoom without horizontal scrolling, and in Windows high contrast mode.
- Better contrast for field placeholders.

### Security
- The interface is served from an internal `app://` address; navigation and IPC are limited to the app's own pages.
- Job posting links that point to your computer or local network are refused.
- Warning when Ollama runs on another device, as your CV then leaves your computer.

## [0.2.1] - 2026-10-13

### Fixed
- Release publishing: the installer, its update file and download links are published together on a single release.

## [0.2.0] - 2026-10-13

First public release.

### Added
- Three-step flow: import your CV (PDF or Word), give a job posting (link or text), download the tailored CV.
- Tailoring that never invents: it selects, reorders and rephrases what your CV already contains; skills the posting
  asks for and your CV lacks are offered as unchecked boxes.
- Built-in AI model (Fast, Balanced or Quality), downloaded once and resumable, then working offline; Ollama and online
  services with your own key as options.
- Six ATS-friendly layouts with live previews, optional photo, PDF and Word export.
- Before/after comparison of every change.
- Automatic updates, checked at startup and every six hours.

[0.4.0]: https://github.com/tashom11/ReCV/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/tashom11/ReCV/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/tashom11/ReCV/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/tashom11/ReCV/tree/v0.2.0
