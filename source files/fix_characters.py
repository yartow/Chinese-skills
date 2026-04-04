"""
fix_characters.py
------------------
Repairs chinese_characters data in two phases:

  Phase 1  — Fix the `traditional` column where it holds an archaic/obscure
              variant not used in modern Taiwan/HK Chinese. For each such row
              Claude returns the correct modern traditional form; the database
              is updated in place.  examples_traditional is usually already
              correct and needs no change.

  Phase 2  — Regenerate broken example sentences: rows where (after Phase 1)
              `examples`, `examples_traditional`, `word_examples`, or
              `word_examples_traditional` still don't contain the target character.

Requirements:
    pip install psycopg2-binary anthropic

Usage:
    export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chinese_learning
    export ANTHROPIC_API_KEY=sk-ant-...

    python fix_characters.py --phase 1            # fix traditional column only
    python fix_characters.py --phase 2            # regenerate broken examples only
    python fix_characters.py                      # run both phases
    python fix_characters.py --dry-run            # print what would change, no writes
"""

import argparse
import json
import os
import sys
import time

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("ERROR: psycopg2 not installed.  Run: pip install psycopg2-binary")
    sys.exit(1)

try:
    from anthropic import Anthropic
except ImportError:
    print("ERROR: anthropic not installed.  Run: pip install anthropic")
    sys.exit(1)

# ── Config ──────────────────────────────────────────────────────────────────────
DATABASE_URL   = os.environ.get("DATABASE_URL", "")
ANTHROPIC_KEY  = os.environ.get("ANTHROPIC_API_KEY", "")
MODEL          = "claude-haiku-4-5-20251001"
DELAY          = 0.2   # seconds between API calls

# ── Helpers ─────────────────────────────────────────────────────────────────────

def get_conn():
    if not DATABASE_URL:
        print("ERROR: DATABASE_URL not set.")
        sys.exit(1)
    return psycopg2.connect(DATABASE_URL)


def get_client():
    if not ANTHROPIC_KEY:
        print("ERROR: ANTHROPIC_API_KEY not set.")
        sys.exit(1)
    return Anthropic(api_key=ANTHROPIC_KEY)


def parse_json(val):
    if val is None:
        return []
    if isinstance(val, list):
        return val
    try:
        return json.loads(val)
    except Exception:
        return []


def contains_char(entries, key, char):
    """Return list of entries where entries[key] does NOT contain char."""
    bad = []
    for e in entries:
        v = e.get(key, "")
        if v and char not in v:
            bad.append(e)
    return bad


def validate_row(row):
    """Return dict of field → [bad entries] for a row."""
    issues = {}
    for field, key, char in [
        ("examples",                   "chinese", row["simplified"]),
        ("examples_traditional",       "chinese", row["traditional"]),
        ("word_examples",              "word",    row["simplified"]),
        ("word_examples_traditional",  "word",    row["traditional"]),
    ]:
        data = parse_json(row[field])
        if not data:
            continue
        bad = contains_char(data, key, char)
        if bad:
            issues[field] = bad
    return issues


# ── Phase 1: fix traditional column ─────────────────────────────────────────────

PHASE1_PROMPT = """You are a Classical and Modern Chinese linguistics expert.

What is the single standard traditional Chinese character for the simplified
character '{simplified}', as written in Taiwan and Hong Kong today?

If the character is identical in simplified and traditional Chinese, return '{simplified}'.
Return ONLY the single character. No explanation, no punctuation, nothing else.
"""

def ask_correct_traditional(client, simplified, traditional, examples_trad):
    """Ask Claude for the correct modern traditional form (ignores examples)."""
    prompt = PHASE1_PROMPT.format(simplified=simplified)
    resp = client.messages.create(
        model=MODEL,
        max_tokens=10,
        messages=[{"role": "user", "content": prompt}],
    )
    result = resp.content[0].text.strip()
    # Sanity: should be exactly 1 character
    if len(result) == 1:
        return result
    # Sometimes the model returns the char followed by punctuation; take first char
    if result:
        return result[0]
    return None


def phase1(dry_run=False):
    print("\n=== Phase 1: Fix traditional column ===\n")
    conn = get_conn()
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    client = get_client()

    cur.execute("""
        SELECT index, simplified, traditional,
               examples, examples_traditional,
               word_examples, word_examples_traditional
        FROM chinese_characters
        ORDER BY index
    """)
    rows = cur.fetchall()

    updates = []   # list of (index, new_traditional)
    skipped = []

    for row in rows:
        trad = row["traditional"]
        issues = validate_row(row)

        # Only act on rows where examples_traditional or word_examples_traditional fail
        trad_issues = {k: v for k, v in issues.items()
                       if k in ("examples_traditional", "word_examples_traditional")}
        if not trad_issues:
            continue

        examples_trad = parse_json(row["examples_traditional"])
        if not examples_trad:
            skipped.append((row["index"], row["simplified"], trad, "no examples_traditional to inspect"))
            continue

        print(f"  [{row['index']}] simplified={row['simplified']}  current_traditional={trad}")
        new_trad = ask_correct_traditional(
            client,
            row["simplified"],
            trad,
            examples_trad,
        )
        time.sleep(DELAY)

        if not new_trad:
            skipped.append((row["index"], row["simplified"], trad, "Claude returned empty"))
            continue

        if new_trad == trad:
            skipped.append((row["index"], row["simplified"], trad, "no change needed per Claude"))
            continue

        # Verify new_trad actually appears in examples
        sample_sentences = [e.get("chinese", "") for e in examples_trad]
        if not any(new_trad in s for s in sample_sentences):
            skipped.append((row["index"], row["simplified"], trad,
                            f"Claude returned '{new_trad}' but it's not in the examples either"))
            continue

        print(f"    → update traditional: '{trad}' → '{new_trad}'")
        updates.append((row["index"], new_trad))

    print(f"\nPhase 1 summary: {len(updates)} update(s), {len(skipped)} skipped.\n")

    if skipped:
        print("Skipped rows:")
        for idx, simp, trad, reason in skipped:
            print(f"  [{idx}] {simp}/{trad}: {reason}")
        print()

    if dry_run:
        print("[dry-run] No changes written.")
    else:
        update_cur = conn.cursor()
        for idx, new_trad in updates:
            update_cur.execute(
                "UPDATE chinese_characters SET traditional = %s WHERE index = %s",
                (new_trad, idx),
            )
        conn.commit()
        print(f"Phase 1 complete: {len(updates)} traditional values updated.")

    cur.close()
    conn.close()


# ── Phase 2: regenerate broken examples ─────────────────────────────────────────

REGEN_EXAMPLES_PROMPT = """You are a Mandarin Chinese language teacher creating study materials.

Generate exactly 3 short, natural example sentences for the Chinese character '{char}'.
The character is: {char} (meaning: {definition})

CRITICAL REQUIREMENTS:
- Every sentence MUST contain the character '{char}'
- Use {script} Chinese characters throughout
- Keep sentences short (5–12 characters)
- Vary the usage context
- Include an accurate English translation

Return a JSON array only, with no other text:
[
  {{"chinese": "...", "english": "..."}},
  {{"chinese": "...", "english": "..."}},
  {{"chinese": "...", "english": "..."}}
]"""

REGEN_WORD_EXAMPLES_PROMPT = """You are a Mandarin Chinese language teacher creating study materials.

Generate exactly 3 compound words or two-character phrases that contain the character '{char}'.
The character is: {char} (meaning: {definition})

CRITICAL REQUIREMENTS:
- Every word/phrase MUST contain the character '{char}'
- Use {script} Chinese characters
- Provide pinyin and meaning for each

Return a JSON array only, with no other text:
[
  {{"word": "...", "pinyin": "...", "meaning": "..."}},
  {{"word": "...", "pinyin": "...", "meaning": "..."}},
  {{"word": "...", "pinyin": "...", "meaning": "..."}}
]"""


def call_claude_json(client, prompt):
    resp = client.messages.create(
        model=MODEL,
        max_tokens=600,
        messages=[{"role": "user", "content": prompt}],
    )
    text = resp.content[0].text.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())


def regenerate_field(client, char, definition, script, field_type):
    """Returns newly generated list for a field, validated to contain char."""
    if field_type in ("examples", "examples_traditional"):
        prompt = REGEN_EXAMPLES_PROMPT.format(
            char=char, definition=definition, script=script
        )
        entries = call_claude_json(client, prompt)
        # Validate
        valid = [e for e in entries if char in e.get("chinese", "")]
        return valid if valid else None
    else:  # word_examples / word_examples_traditional
        prompt = REGEN_WORD_EXAMPLES_PROMPT.format(
            char=char, definition=definition, script=script
        )
        entries = call_claude_json(client, prompt)
        valid = [e for e in entries if char in e.get("word", "")]
        return valid if valid else None


FIELD_SCRIPT = {
    "examples":                   "simplified",
    "examples_traditional":       "traditional",
    "word_examples":              "simplified",
    "word_examples_traditional":  "traditional",
}

FIELD_CHAR_KEY = {
    "examples":                   ("simplified", "chinese"),
    "examples_traditional":       ("traditional", "chinese"),
    "word_examples":              ("simplified", "word"),
    "word_examples_traditional":  ("traditional", "word"),
}

DB_COLUMN = {
    "examples":                   "examples",
    "examples_traditional":       "examples_traditional",
    "word_examples":              "word_examples",
    "word_examples_traditional":  "word_examples_traditional",
}


def phase2(dry_run=False):
    print("\n=== Phase 2: Regenerate broken examples ===\n")
    conn = get_conn()
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    client = get_client()

    cur.execute("""
        SELECT index, simplified, traditional, definition,
               examples, examples_traditional,
               word_examples, word_examples_traditional
        FROM chinese_characters
        ORDER BY index
    """)
    rows = cur.fetchall()

    all_updates = []   # list of (index, db_column, new_value)
    failed = []

    for row in rows:
        issues = validate_row(row)
        if not issues:
            continue

        definition = ", ".join(row["definition"]) if row["definition"] else row["simplified"]
        print(f"\n  [{row['index']}] simplified={row['simplified']}  traditional={row['traditional']}")

        for field, bad_entries in issues.items():
            char_key, entry_key = FIELD_CHAR_KEY[field]
            char = row[char_key]
            script = FIELD_SCRIPT[field]
            db_col = DB_COLUMN[field]

            print(f"    [{field}] {len(bad_entries)} bad entry(ies) for '{char}'")

            # Get current full list and replace only the bad entries
            current = parse_json(row[field])
            good = [e for e in current if char in e.get(entry_key, "")]

            # We need to regenerate a replacement for the bad ones
            max_attempts = 3
            new_entries = None
            for attempt in range(1, max_attempts + 1):
                try:
                    new_entries = regenerate_field(client, char, definition, script, field)
                    time.sleep(DELAY)
                    if new_entries:
                        break
                except Exception as e:
                    print(f"      attempt {attempt} failed: {e}")
                    time.sleep(1)

            if not new_entries:
                failed.append((row["index"], row["simplified"], field, char))
                print(f"      FAILED to generate valid entries after {max_attempts} attempts")
                continue

            # Merge: good existing entries + new ones, capped at 3
            merged = (good + new_entries)[:3]
            if len(merged) < 3:
                merged = new_entries[:3]

            print(f"      → replacing with {len(merged)} valid entries")
            all_updates.append((row["index"], db_col, json.dumps(merged, ensure_ascii=False)))

    print(f"\nPhase 2 summary: {len(all_updates)} field update(s), {len(failed)} field(s) failed.\n")

    if failed:
        print("Failed regenerations:")
        for idx, simp, field, char in failed:
            print(f"  [{idx}] {simp} — {field} (target: {char})")
        print()

    if dry_run:
        print("[dry-run] No changes written.")
        for idx, col, val in all_updates[:5]:
            print(f"  would update index={idx} column={col}")
            print(f"    {val[:120]}")
    else:
        update_cur = conn.cursor()
        for idx, col, val in all_updates:
            update_cur.execute(
                f"UPDATE chinese_characters SET {col} = %s::jsonb WHERE index = %s",
                (val, idx),
            )
        conn.commit()
        print(f"Phase 2 complete: {len(all_updates)} fields updated.")

    cur.close()
    conn.close()


# ── Entry point ──────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Fix chinese_characters data")
    parser.add_argument("--phase", type=int, choices=[1, 2],
                        help="Run only phase 1 (fix traditional) or phase 2 (regen examples). "
                             "Default: both.")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print what would change without writing to the database.")
    args = parser.parse_args()

    run_phase1 = args.phase in (None, 1)
    run_phase2 = args.phase in (None, 2)

    if run_phase1:
        phase1(dry_run=args.dry_run)
    if run_phase2:
        phase2(dry_run=args.dry_run)

    print("\nDone.")


if __name__ == "__main__":
    main()
