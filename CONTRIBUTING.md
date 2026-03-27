# Contributing to YearView

Thanks for taking the time to contribute.

## Contributor License Agreement

Before a pull request can be merged, you must agree to the
[Contributor License Agreement](CLA.md). It lets the copyright holder
(Simon Mendoza) continue to offer YearView under both the open-source
AGPL-3.0 licence and a separate commercial licence, while you retain
ownership of your contribution.

**To accept:** add the following line to your pull request description
or a commit message in the PR:

```
I have read and agree to the YearView Contributor License Agreement.
```

No account, email, or signature is required beyond this statement.

## How to contribute

1. Fork the repository and create a branch from `master`.
2. Make your changes. Keep the scope focused — one fix or feature per PR.
3. Test locally with `npm run dev`.
4. Open a pull request with a clear description of what and why, and
   include the CLA acceptance line above.

## Code style

- Vanilla JS (ES modules), no build step, no frameworks.
- Match the surrounding code style — 2-space indent, single quotes.
- Keep server-side and client-side concerns separate (`server.js` vs `public/js/`).

## Reporting bugs

Open a GitHub issue. Include browser/OS, steps to reproduce, and what
you expected vs what happened.
