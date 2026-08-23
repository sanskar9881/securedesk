#!/usr/bin/env python3
"""
Seed synthetic security events into a LOCAL DEVELOPMENT database.

Why this exists: the dashboard's charts and tables only look right with a
realistic spread of events, and a fresh dev database has none. This is a
development convenience — it is NOT demo data for a customer, and it must
never be pointed at a production database.

Every document written carries `_seed: true`, so a run can be undone exactly:

    python scripts/seed_dev_events.py          # insert ~14 days of events
    python scripts/seed_dev_events.py --clear  # remove ONLY seeded documents

The script refuses to run against anything that does not look like localhost.
"""
import argparse
import os
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from pymongo import MongoClient  # noqa: E402

from config import DATABASE_NAME, MONGODB_URL  # noqa: E402

SEED_MARKER = {"_seed": True}

ACTORS = [
    ("Aarti Deshmukh", "aarti@example.test"),
    ("Rohan Mehta", "rohan@example.test"),
    ("Priya Raman", "priya@example.test"),
    ("Vikram Nair", "vikram@example.test"),
    ("Sneha Kulkarni", "sneha@example.test"),
]
DESTINATIONS = [
    ("chatgpt.com", "high"), ("claude.ai", "high"), ("gemini.google.com", "high"),
    ("drive.google.com", "medium"), ("dropbox.com", "medium"),
    ("gmail.com", "medium"), ("github.com", "medium"),
    ("slack.com", "low"), ("confluence.internal", "low"), ("jira.internal", "low"),
]
ARTEFACTS = [
    "customer_export.csv", "q3_pipeline.xlsx", "auth_service.py",
    "onboarding_notes.docx", "invoice_batch.pdf", "config.env",
    "support_tickets.csv", "design_review.pptx",
]


def require_local(url: str) -> None:
    if not any(t in url for t in ("localhost", "127.0.0.1", "0.0.0.0")):
        sys.exit(
            f"refusing to run against a non-local database:\n  {url}\n"
            "This script is for local development only."
        )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--clear", action="store_true", help="remove seeded documents and exit")
    ap.add_argument("--days", type=int, default=14)
    ap.add_argument("--count", type=int, default=90)
    args = ap.parse_args()

    require_local(MONGODB_URL)
    db = MongoClient(MONGODB_URL)[DATABASE_NAME]
    col = db["transactions"]

    if args.clear:
        removed = col.delete_many(SEED_MARKER).deleted_count
        print(f"removed {removed} seeded document(s)")
        return

    random.seed(7)  # reproducible
    now = datetime.now(timezone.utc)
    docs = []
    for _ in range(args.count):
        # Weight recent days more heavily, and weekdays more than weekends.
        day_offset = int(abs(random.gauss(0, args.days / 2.4))) % args.days
        when = now - timedelta(
            days=day_offset, hours=random.randint(0, 23), minutes=random.randint(0, 59)
        )
        if when.weekday() >= 5 and random.random() < 0.65:
            continue

        name, email = random.choice(ACTORS)
        dest, dest_risk = random.choice(DESTINATIONS)
        roll = random.random()
        if dest_risk == "high":
            severity = "high" if roll < 0.42 else "medium" if roll < 0.78 else "low"
        elif dest_risk == "medium":
            severity = "high" if roll < 0.12 else "medium" if roll < 0.5 else "low"
        else:
            severity = "medium" if roll < 0.15 else "low"

        score = {
            "high": random.uniform(70, 98),
            "medium": random.uniform(35, 69),
            "low": random.uniform(2, 34),
        }[severity]

        docs.append({
            "_id": str(uuid.uuid4()),
            "_seed": True,
            "sender_name": name,
            "sender_email": email,
            "recipient_email": dest,
            "subject": f"Upload to {dest}",
            "filename": random.choice(ARTEFACTS),
            "classification": "suspicious" if severity in ("high", "medium") else "legitimate",
            "risk_score": round(score, 1),
            "severity": severity,
            "type": "file_transaction",
            "timestamp": when,
        })

    if docs:
        col.insert_many(docs)
    by_sev = {s: sum(1 for d in docs if d["severity"] == s) for s in ("high", "medium", "low")}
    print(f"inserted {len(docs)} seeded event(s) across {args.days} days  {by_sev}")
    print("undo with:  python scripts/seed_dev_events.py --clear")


if __name__ == "__main__":
    main()
