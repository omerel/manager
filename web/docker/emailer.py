#!/usr/bin/env python3
"""Send a produced report by email.

    python3 docker/emailer.py --title "<report title>" --body "<markdown>" --to "<address>"

Exit code 201 means SENT. Anything else means FAILED, and the caller shows the
user that it failed.

A WARNING for whoever writes the real script: Unix masks an exit code to 8 bits,
so `sys.exit(<http status>)` is NOT safe. 500 arrives as 244 (harmless — still
not 201), but 457 arrives as exactly 201 and would be read as SENT. Decide
sent/failed in the script and exit 201 or 1; do not pass an HTTP status through.
The status itself belongs on stdout as `status=<code>`, where it is useful for
diagnosis and cannot be mistaken for the verdict.

──────────────────────────────────────────────────────────────────────────────
THIS FILE IS A STAND-IN. It delivers nothing.

The target environment replaces it after the image is built, with a script that
actually sends mail. What must NOT change is the interface above: the three
flags, and 201 as the only success code. The application depends on exactly
that and on nothing else about how delivery happens.

Until it is replaced, this stand-in echoes back what it was handed — so the
contract can be checked without a mail server — and returns success or failure
at random, so both paths get exercised by hand.

Random is right for a person clicking a button and useless for an automated
suite, which cannot assert against a coin flip. So the outcome can be pinned:

    EMAILER_FORCE=sent    → always 201
    EMAILER_FORCE=failed  → always 500

Unset, it stays random.
──────────────────────────────────────────────────────────────────────────────
"""

import argparse
import os
import random
import sys

SENT = 201
FAILED = 1  # deliberately small: an exit code is 8 bits, see the warning above


def main() -> int:
    parser = argparse.ArgumentParser(description="Send a report by email (stand-in).")
    parser.add_argument("--title", required=True, help="report title")
    parser.add_argument("--body", required=True, help="report body, markdown")
    parser.add_argument("--to", required=True, help="recipient address")
    args = parser.parse_args()

    # Echo the contract back, so a caller can verify what actually arrived.
    print(f"to={args.to}")
    print(f"title={args.title}")
    print(f"body_bytes={len(args.body.encode('utf-8'))}")
    print(f"body_chars={len(args.body)}")

    forced = os.environ.get("EMAILER_FORCE", "").strip().lower()
    if forced == "sent":
        outcome = SENT
    elif forced == "failed":
        outcome = FAILED
    else:
        outcome = random.choice([SENT, FAILED])

    # the real script reports its mail API's status here; the verdict is the exit code
    print(f"status={201 if outcome == SENT else 500}")
    if outcome == SENT:
        print("stand-in: pretending the message was sent", file=sys.stderr)
    else:
        print("stand-in: pretending delivery failed", file=sys.stderr)
    return outcome


if __name__ == "__main__":
    sys.exit(main())
