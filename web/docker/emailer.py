#!/usr/bin/env python3
"""Send a produced report by email.

    python3 docker/emailer.py --title "<subject>" --body "<markdown>" --to "<address>" [--from "<who sent it>"]

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

`--from` is ADDITIVE and ignorable: the system always passes it, but a
replacement written against the original three flags is still a valid
replacement. Do not make it required.

Until it is replaced, this stand-in echoes back what it was handed — so the
contract can be checked without a mail server — and returns success or failure
at random, so both paths get exercised by hand.

THE LOG is the stand-in's own feature, not part of the contract. Every
invocation appends one line — time, verdict, sender, recipient, subject — to
EMAILER_LOG (default: mail.log beside this script), failures included, because
a log of successes only tests half the mechanism. A real replacement brings the
real mail system's records and owes this file nothing. If the log cannot be
written, a warning is printed and the send proceeds: the testing aid must not
become the fault it exists to catch.

Random is right for a person clicking a button and useless for an automated
suite, which cannot assert against a coin flip. So the outcome can be pinned:

    EMAILER_FORCE=sent    → always 1
    EMAILER_FORCE=failed  → always 0

Unset, it stays random.
──────────────────────────────────────────────────────────────────────────────
"""

import argparse
import datetime
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
    parser.add_argument("--from", dest="sender", default="?", help="who sent it (display string; optional)")
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

    # the log line — before the verdict, so a logging crash could never be
    # mistaken for a delivery verdict, and wrapped so it never becomes one
    try:
        log_path = os.environ.get("EMAILER_LOG", "").strip() or os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "mail.log"
        )
        stamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        word = "נשלח" if verdict == SENT else "נכשל"
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(f"{stamp} | {word} | מאת: {args.sender} | אל: {args.to} | נושא: {args.title}\n")
    except OSError as e:
        print(f"warning: could not write mail log: {e}", file=sys.stderr)

    # the verdict, last
    print(verdict)
    return 0


if __name__ == "__main__":
    sys.exit(main())
