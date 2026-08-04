#!/usr/bin/env python3
"""Send a produced report by email.

    python3 docker/emailer.py --title "<subject>" --body "<markdown>" --to "<address>"

THE CONTRACT — this is the whole of it:

    print `1` (sent) or `0` (failed) as the LAST non-empty line of stdout,
    and exit normally.

Anything may be printed before the verdict; only the last non-empty line is
read, so log freely. The EXIT CODE IS NOT THE VERDICT — it only says whether
the script ran at all.

That separation is deliberate and measured. A crashing Python script exits 1:

    unhandled exception  → exit 1
    syntax error         → exit 1
    script missing       → exit 2
    killed / timed out   → exit 124

So an exit code of 1 could never be made to mean "sent" — every crash of a real
implementation would be reported as a delivered message. A verdict printed on
stdout cannot be produced by accident: a script that dies prints no `1`, and the
caller correctly reports a failure.

──────────────────────────────────────────────────────────────────────────────
THIS FILE IS A STAND-IN. It delivers nothing.

The target environment replaces it after the image is built, with a script that
actually sends mail. What must NOT change is the contract above: the three
flags, and `1`/`0` on the last line.

Until it is replaced, this stand-in echoes back what it was handed — so the
contract can be checked without a mail server — and returns success or failure
at random, so both paths get exercised by hand.

Random is right for a person clicking a button and useless for an automated
suite, which cannot assert against a coin flip. So the outcome can be pinned:

    EMAILER_FORCE=sent    → always 1
    EMAILER_FORCE=failed  → always 0

Unset, it stays random.
──────────────────────────────────────────────────────────────────────────────
"""

import argparse
import os
import random
import sys

SENT = "1"
FAILED = "0"


def main() -> int:
    parser = argparse.ArgumentParser(description="Send a report by email (stand-in).")
    parser.add_argument("--title", required=True, help="subject line")
    parser.add_argument("--body", required=True, help="report body, markdown")
    parser.add_argument("--to", required=True, help="recipient address")
    args = parser.parse_args()

    # Diagnostics BEFORE the verdict — the real script will want to log, and
    # printing here keeps the "last line wins" rule exercised by the shipped
    # file rather than only by a test fixture.
    print(f"to={args.to}")
    print(f"title={args.title}")
    print(f"body_bytes={len(args.body.encode('utf-8'))}")
    print(f"body_chars={len(args.body)}")

    forced = os.environ.get("EMAILER_FORCE", "").strip().lower()
    if forced == "sent":
        verdict = SENT
    elif forced == "failed":
        verdict = FAILED
    else:
        verdict = random.choice([SENT, FAILED])

    print("stand-in: pretending the message was sent" if verdict == SENT
          else "stand-in: pretending delivery failed", file=sys.stderr)

    # the verdict, last
    print(verdict)
    return 0


if __name__ == "__main__":
    sys.exit(main())
