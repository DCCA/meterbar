# Security policy

MeterBar runs inside your logged-in browser sessions, so security and privacy bugs matter more than usual. Examples worth reporting:

- Any path that stores or transmits chat content, cookies, tokens, org/account identifiers, or anything beyond usage metrics.
- Network traffic to any origin other than the provider pages MeterBar reads.
- Data crossing the native companion boundary that the sanitizer should have removed.
- Ways for a web page to spoof or inject `usage:report` / `status:report` messages.

## Reporting

Please **do not open a public issue**. Use GitHub's private reporting instead: **Security -> Report a vulnerability** on this repository. Include steps to reproduce and the affected version or commit.

Only the latest `main` is supported.
