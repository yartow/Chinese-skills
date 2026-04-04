"""
validate_examples.py — Task A
------------------------------
Finds every row in chinese_characters where at least one example sentence
does NOT contain the character it is supposed to illustrate.

Checks:
  examples                  — each {chinese} must contain `simplified`
  examples_traditional      — each {chinese} must contain `traditional`
  word_examples             — each {word}    must contain `simplified`
  word_examples_traditional — each {word}    must contain `traditional`

Requirements:
    pip install psycopg2-binary

Usage:
    export DATABASE_URL=postgresql://user:pass@host:5432/dbname
    python validate_examples.py
"""

import os
import json
import sys
from collections import defaultdict

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("ERROR: psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL environment variable not set.")
    sys.exit(1)


def parse_json_field(value):
    """Safely parse a JSON field that may already be a list/dict or a string."""
    if value is None:
        return []
    if isinstance(value, (list, dict)):
        return value if isinstance(value, list) else [value]
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return []


def check_examples(examples, character, field_name):
    """Return list of (field, sentence) where sentence doesn't contain character."""
    bad = []
    for ex in examples:
        sentence = ex.get("chinese", "")
        if sentence and character not in sentence:
            bad.append((field_name, sentence))
    return bad


def check_word_examples(examples, character, field_name):
    """Return list of (field, word) where word doesn't contain character."""
    bad = []
    for ex in examples:
        word = ex.get("word", "")
        if word and character not in word:
            bad.append((field_name, word))
    return bad


def main():
    print("Connecting to database...")
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute("""
        SELECT index, simplified, traditional,
               examples, examples_traditional,
               word_examples, word_examples_traditional
        FROM chinese_characters
        ORDER BY index
    """)
    rows = cur.fetchall()
    print(f"Loaded {len(rows)} rows.\n")

    bad_rows = []
    field_counts = defaultdict(int)

    for row in rows:
        issues = []

        issues += check_examples(
            parse_json_field(row["examples"]),
            row["simplified"],
            "examples",
        )
        issues += check_examples(
            parse_json_field(row["examples_traditional"]),
            row["traditional"],
            "examples_traditional",
        )
        issues += check_word_examples(
            parse_json_field(row["word_examples"]),
            row["simplified"],
            "word_examples",
        )
        issues += check_word_examples(
            parse_json_field(row["word_examples_traditional"]),
            row["traditional"],
            "word_examples_traditional",
        )

        if issues:
            bad_rows.append((row["index"], row["simplified"], row["traditional"], issues))
            for field, _ in issues:
                field_counts[field] += 1

    cur.close()
    conn.close()

    if not bad_rows:
        print("No issues found — all sentences contain their target character.")
        return

    print("=" * 72)
    print(f"Found {len(bad_rows)} row(s) with broken sentences:\n")

    for idx, simplified, traditional, issues in bad_rows:
        print(f"Index {idx}  simplified={simplified}  traditional={traditional}")
        for field, sentence in issues:
            # Determine expected character for display
            expected = simplified if "traditional" not in field else traditional
            print(f'  [{field}]  expected "{expected}" in: "{sentence}"')
        print()

    print("=" * 72)
    print(f"\nSummary: {len(bad_rows)} row(s) affected.")
    for field, count in sorted(field_counts.items()):
        print(f"  {field}: {count} bad sentence(s)")


if __name__ == "__main__":
    main()
