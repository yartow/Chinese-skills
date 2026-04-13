"""
enrich_character.py
--------------------
Re-generates Claude-enriched fields for one or more individual characters
already in the chinese_characters table.

Enriched fields:
  traditional, traditional_variants, pinyin (if missing), definition (if missing),
  pinyin2/3, numbered_pinyin 1-3, radical_index, radical_index_traditional,
  examples, examples_traditional, word_examples, word_examples_traditional

Fields that are left untouched (authoritative from the original import):
  index, hsk_level, lesson

Usage:
    export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chinese_learning
    export ANTHROPIC_API_KEY=sk-ant-...

    python3 "source files/enrich_character.py" 嘌
    python3 "source files/enrich_character.py" 嘌 呤 囧   # multiple characters
    python3 "source files/enrich_character.py" 嘌 --dry-run
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
DELAY         = 0.3

PROMPT = """\
You are building a Mandarin Chinese learning database.
The following core fields for the character '{simplified}' are already known:

  simplified:  {simplified}
  traditional: {traditional}
  pinyin:      {pinyin}
  definition:  {definition}
  hsk_level:   {hsk_level}

Generate ONLY the enrichment fields below.
Return a single valid JSON object — no markdown, no extra text.

{{
  "hsk_level": <integer 0-9; 0 if not in any HSK list>,
  "traditional_variants": ["<additional traditional variants beyond '{traditional}', else []>"],
  "pinyin2": "<second pronunciation if 多音字, else null>",
  "pinyin3": "<third pronunciation if 多音字, else null>",
  "numbered_pinyin":  "<'{pinyin}' in numbered-tone form, e.g. zhong1>",
  "numbered_pinyin2": "<numbered form of pinyin2, else null>",
  "numbered_pinyin3": "<numbered form of pinyin3, else null>",
  "radical_simplified":  "<Kangxi radical for '{simplified}', single character>",
  "radical_traditional": "<same radical in traditional script; same character if unchanged>",
  "examples": [
    {{"chinese": "<short sentence in simplified Chinese containing '{simplified}'>", "english": "<translation>"}},
    {{"chinese": "<short sentence in simplified Chinese containing '{simplified}'>", "english": "<translation>"}},
    {{"chinese": "<short sentence in simplified Chinese containing '{simplified}'>", "english": "<translation>"}}
  ],
  "examples_traditional": [
    {{"chinese": "<same sentence in traditional Chinese containing '{traditional}'>", "english": "<translation>"}},
    {{"chinese": "<same sentence in traditional Chinese containing '{traditional}'>", "english": "<translation>"}},
    {{"chinese": "<same sentence in traditional Chinese containing '{traditional}'>", "english": "<translation>"}}
  ],
  "word_examples": [
    {{"word": "<compound word in simplified Chinese containing '{simplified}'>", "pinyin": "<pinyin>", "meaning": "<English>"}},
    {{"word": "<compound word in simplified Chinese containing '{simplified}'>", "pinyin": "<pinyin>", "meaning": "<English>"}},
    {{"word": "<compound word in simplified Chinese containing '{simplified}'>", "pinyin": "<pinyin>", "meaning": "<English>"}}
  ],
  "word_examples_traditional": [
    {{"word": "<same compound in traditional Chinese containing '{traditional}'>", "pinyin": "<pinyin>", "meaning": "<English>"}},
    {{"word": "<same compound in traditional Chinese containing '{traditional}'>", "pinyin": "<pinyin>", "meaning": "<English>"}},
    {{"word": "<same compound in traditional Chinese containing '{traditional}'>", "pinyin": "<pinyin>", "meaning": "<English>"}}
  ]
}}

RULES (must be followed exactly):
1. Every sentence in "examples" MUST contain '{simplified}'.
2. Every sentence in "examples_traditional" MUST contain '{traditional}'.
3. Every word in "word_examples" MUST contain '{simplified}'.
4. Every word in "word_examples_traditional" MUST contain '{traditional}'.
5. Sentences should be short: 5-15 Chinese characters.
6. Return pure JSON only.
"""


def call_claude(client: Anthropic, row: dict) -> dict:
    definition = "; ".join(row["definition"]) if row["definition"] else row["simplified"]
    traditional = row["traditional"] or row["simplified"]
    prompt = PROMPT.format(
        simplified=row["simplified"],
        traditional=traditional,
        pinyin=row["pinyin"],
        definition=definition,
        hsk_level=row["hsk_level"],
    )
    for attempt in range(1, 4):
        try:
            resp = client.messages.create(
                model=MODEL,
                max_tokens=1400,
                messages=[{"role": "user", "content": prompt}],
            )
            text = resp.content[0].text.strip()
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            return json.loads(text.strip())
        except Exception as e:
            print(f"      attempt {attempt} failed: {e}")
            if attempt < 3:
                time.sleep(1.0)
    raise RuntimeError("Claude failed after 3 attempts")


def lookup_radical(cur, char: str):
    if not char:
        return None
    cur.execute(
        "SELECT index FROM radicals WHERE simplified = %s OR traditional = %s LIMIT 1",
        (char, char),
    )
    row = cur.fetchone()
    return row["index"] if row else None


def main():
    parser = argparse.ArgumentParser(description="Enrich individual characters with Claude-generated data")
    parser.add_argument("characters", nargs="+", help="Simplified character(s) to enrich, e.g. 嘌")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be written without updating DB")
    args = parser.parse_args()

    if not DATABASE_URL:
        sys.exit("ERROR: DATABASE_URL not set.")
    if not ANTHROPIC_KEY:
        sys.exit("ERROR: ANTHROPIC_API_KEY not set.")

    conn = psycopg2.connect(DATABASE_URL)
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    client = Anthropic(api_key=ANTHROPIC_KEY)

    ok = skipped = errors = 0

    for char in args.characters:
        char = char.strip()
        if not char:
            continue

        cur.execute(
            "SELECT index, simplified, traditional, pinyin, definition, hsk_level "
            "FROM chinese_characters WHERE simplified = %s LIMIT 1",
            (char,),
        )
        row = cur.fetchone()
        if not row:
            print(f"  '{char}' — NOT FOUND in database, skipping.")
            skipped += 1
            continue

        row = dict(row)
        row["traditional"] = row["traditional"] or row["simplified"]
        print(f"  [{row['index']}] {char} ({row['pinyin']}) HSK {row['hsk_level']}  → generating enrichment…")

        try:
            enrichment = call_claude(client, row)
            time.sleep(DELAY)
        except RuntimeError as e:
            print(f"      ERROR: {e}")
            errors += 1
            continue

        rad_simp = (enrichment.get("radical_simplified") or "").strip()
        rad_trad = (enrichment.get("radical_traditional") or rad_simp).strip()
        radical_idx      = lookup_radical(cur, rad_simp)
        radical_idx_trad = lookup_radical(cur, rad_trad)

        trad_variants = [
            v for v in (enrichment.get("traditional_variants") or [])
            if isinstance(v, str) and v.strip()
        ] or None

        def nullable(key):
            v = enrichment.get(key)
            return v if (v and str(v).strip()) else None

        def to_json(key):
            v = enrichment.get(key)
            return json.dumps(v, ensure_ascii=False) if v else None

        raw_hsk = enrichment.get("hsk_level")
        hsk_level = int(raw_hsk) if raw_hsk is not None else row["hsk_level"]

        params = {
            "hsk_level":                 hsk_level,
            "traditional_variants":      trad_variants,
            "pinyin2":                   nullable("pinyin2"),
            "pinyin3":                   nullable("pinyin3"),
            "numbered_pinyin":           nullable("numbered_pinyin"),
            "numbered_pinyin2":          nullable("numbered_pinyin2"),
            "numbered_pinyin3":          nullable("numbered_pinyin3"),
            "radical_index":             radical_idx,
            "radical_index_traditional": radical_idx_trad,
            "examples":                  to_json("examples"),
            "examples_traditional":      to_json("examples_traditional"),
            "word_examples":             to_json("word_examples"),
            "word_examples_traditional": to_json("word_examples_traditional"),
            "index":                     row["index"],
        }

        if args.dry_run:
            print(f"      [dry-run] would update:")
            for k, v in params.items():
                if k == "index":
                    continue
                display = str(v)[:80] if v else "NULL"
                print(f"        {k:<28} {display}")
            ok += 1
            continue

        # Use a plain cursor for the UPDATE
        update_cur = conn.cursor()
        update_cur.execute("""
            UPDATE chinese_characters SET
                hsk_level                 = %(hsk_level)s,
                traditional_variants      = %(traditional_variants)s::text[],
                pinyin2                   = %(pinyin2)s,
                pinyin3                   = %(pinyin3)s,
                numbered_pinyin           = %(numbered_pinyin)s,
                numbered_pinyin2          = %(numbered_pinyin2)s,
                numbered_pinyin3          = %(numbered_pinyin3)s,
                radical_index             = %(radical_index)s,
                radical_index_traditional = %(radical_index_traditional)s,
                examples                  = %(examples)s::jsonb,
                examples_traditional      = %(examples_traditional)s::jsonb,
                word_examples             = %(word_examples)s::jsonb,
                word_examples_traditional = %(word_examples_traditional)s::jsonb
            WHERE index = %(index)s
        """, params)
        conn.commit()
        update_cur.close()
        print(f"      ✓ updated  radical={rad_simp or '?'}  numbered={nullable('numbered_pinyin') or '?'}")
        ok += 1

    print(f"\nDone.  updated={ok}  skipped={skipped}  errors={errors}")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
