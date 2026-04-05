"""
generate_word_examples.py
--------------------------
Generates fill-in-blank example sentences for every row in chinese_words
where examples is empty or missing.

Each word gets one sentence containing the word in simplified Chinese,
stored as:
  [{"chinese": "...", "english": "..."}]

Usage:
    export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chinese_learning
    export ANTHROPIC_API_KEY=sk-ant-...

    python3 generate_word_examples.py              # fill all empty rows
    python3 generate_word_examples.py --dry-run    # print sample, no writes
    python3 generate_word_examples.py --limit 50   # process only N words
    python3 generate_word_examples.py --overwrite  # regenerate even if examples exist

Requirements:
    pip install psycopg2-binary anthropic
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
    sys.exit("ERROR: psycopg2 not installed.  Run: pip install psycopg2-binary")

try:
    from anthropic import Anthropic
except ImportError:
    sys.exit("ERROR: anthropic not installed.  Run: pip install anthropic")

DATABASE_URL  = os.environ.get("DATABASE_URL", "")
ANTHROPIC_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
MODEL         = "claude-haiku-4-5-20251001"
DELAY         = 0.2  # seconds between API calls

PROMPT = """\
Create one short, natural example sentence in simplified Mandarin Chinese \
using the word "{word}" ({pinyin}, meaning: {definition}).

Rules:
- The sentence MUST contain "{word}" exactly as written
- Keep it short: 8–15 characters
- Include an accurate English translation

Reply with JSON only — no markdown, no extra text:
{{"chinese": "...", "english": "..."}}
"""


def call_claude(client: Anthropic, word: str, pinyin: str, definition: str) -> dict | None:
    prompt = PROMPT.format(
        word=word,
        pinyin=pinyin,
        definition=definition,
    )
    for attempt in range(1, 4):
        try:
            resp = client.messages.create(
                model=MODEL,
                max_tokens=200,
                messages=[{"role": "user", "content": prompt}],
            )
            text = resp.content[0].text.strip()
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            parsed = json.loads(text.strip())
            if parsed.get("chinese") and parsed.get("english") and word in parsed["chinese"]:
                return parsed
            print(f"      retry {attempt}: word '{word}' missing from generated sentence")
        except Exception as e:
            print(f"      attempt {attempt} failed: {e}")
            time.sleep(1.0)
    return None


def main():
    parser = argparse.ArgumentParser(description="Bulk-generate examples for chinese_words")
    parser.add_argument("--dry-run",  action="store_true", help="Print sample output, no DB writes")
    parser.add_argument("--overwrite", action="store_true", help="Regenerate even if examples already exist")
    parser.add_argument("--limit", type=int, default=0, help="Max number of words to process (0 = all)")
    args = parser.parse_args()

    if not DATABASE_URL:
        sys.exit("ERROR: DATABASE_URL not set.")
    if not ANTHROPIC_KEY:
        sys.exit("ERROR: ANTHROPIC_API_KEY not set.")

    conn = psycopg2.connect(DATABASE_URL)
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    client = Anthropic(api_key=ANTHROPIC_KEY)

    if args.overwrite:
        cur.execute("SELECT id, word, pinyin, definition FROM chinese_words ORDER BY hsk_level, id")
    else:
        cur.execute("""
            SELECT id, word, pinyin, definition
            FROM chinese_words
            WHERE examples IS NULL OR examples = '[]'::jsonb
            ORDER BY hsk_level, id
        """)
    rows = cur.fetchall()

    if args.limit:
        rows = rows[:args.limit]

    print(f"Words to process: {len(rows)}")
    if args.dry_run:
        print("(dry-run — no writes)\n")

    ok = skipped = 0
    for row in rows:
        word       = row["word"]
        pinyin     = row["pinyin"]
        definition = "; ".join(row["definition"]) if row["definition"] else word

        print(f"  [{row['id']}] {word} ({pinyin}) …", end=" ", flush=True)

        result = call_claude(client, word, pinyin, definition)
        time.sleep(DELAY)

        if not result:
            print("FAILED")
            skipped += 1
            continue

        print(f"→ {result['chinese']}")

        if not args.dry_run:
            cur.execute(
                "UPDATE chinese_words SET examples = %s::jsonb WHERE id = %s",
                (json.dumps([result], ensure_ascii=False), row["id"]),
            )
            conn.commit()
        ok += 1

    print(f"\nDone. generated={ok}  failed={skipped}")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
