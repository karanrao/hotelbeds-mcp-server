# Contributing

This is a personal proof-of-concept project, shared in the hope it's useful. Issues and
pull requests are welcome, but please keep a few things in mind.

- **Never commit credentials.** `.env` is git-ignored; use `.env.example` as the template.
  The Hotelbeds keypair authenticates real booking actions against your account.
- **Validate against the sandbox.** Run `npm run smoke` (with a test keypair) before opening
  a PR. New tools should come with coverage in `test/smoke.mjs`.
- **Keep the surface honest.** The booking and cancellation flows are deliberately two-step
  to prevent accidental commits/cancellations — preserve that behaviour.
- **Match the house style.** One tool per file in `src/tools/`, Zod input schemas, and the
  `ok`/`fail` result helpers in `src/util.js`.

By contributing you agree your contributions are licensed under the MIT License.
