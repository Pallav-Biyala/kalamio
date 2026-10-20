# Security Policy

## Reporting a vulnerability

**Please don't report security problems in public issues, pull requests, or discussions.**

Report them privately through GitHub instead:
**[Report a vulnerability](https://github.com/kalamiohq/kalamio/security/advisories/new)**
(the repository's **Security** tab → **Report a vulnerability**).

If you can't use GitHub, email **[security@kalamio.com](mailto:security@kalamio.com)** instead.

Please include:

- what the problem is and what an attacker could do with it,
- steps to reproduce, or a proof of concept,
- the affected area (for example: API endpoint, page, or file), and
- any ideas you have for a fix.

## What to expect

- We aim to acknowledge your report within **5 days**.
- We'll keep you updated while we investigate and fix it.
- Once a fix is released, we'll publish a security advisory and credit you,
  unless you'd prefer to stay anonymous.

## Supported versions

Security fixes go into the `main` branch and the next release. Older releases don't
receive separate patches.

## Testing guidelines

Test against your own local setup (see [CONTRIBUTING.md](CONTRIBUTING.md)) — not against
kalamio.com. Please do not:

- access, change, or delete other users' data,
- run denial-of-service, spam, or automated high-volume tests against our servers, or
- use social engineering against users or maintainers.

Thank you for helping keep Kalamio and its users safe.
