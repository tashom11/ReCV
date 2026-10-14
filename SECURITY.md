# Security policy

Re:CV handles résumés, which hold personal data, and can store an API key. Security reports are taken seriously.

## Supported versions

Only the [latest release](https://github.com/tashom11/ReCV/releases/latest) receives security fixes. The app updates
itself, so a fix reaches users through a new release.

## Reporting a vulnerability

Please **do not open a public issue**. Report it privately through GitHub:
[Security → Report a vulnerability](https://github.com/tashom11/ReCV/security/advisories/new).

Include what you can of:

- the affected version and Windows version;
- the steps to reproduce, or a proof of concept;
- the impact you expect (data read, code run, key leaked…).

Never include a real résumé or a real API key in a report.

Re:CV is maintained by volunteers. You should get a first answer within a week. Once a fix is released, the advisory
is published, with credit to you if you wish.

## Scope

In scope, for example:

- running code or reading files from the interface (IPC, the `app://` protocol, navigation, the preload bridge);
- reading the résumé, the job postings or the API key from outside the app;
- reaching the local network through the job posting link reader;
- a malicious résumé (PDF, DOCX) or job posting page that compromises the app.

Out of scope: what an online AI service does with the data the user chose to send it, and vulnerabilities in a
dependency that Re:CV does not reach (report those upstream).
