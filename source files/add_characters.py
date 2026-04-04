"""
add_characters.py
------------------
Populates chinese_characters with new entries from a master CSV file.

The CSV is the single source of truth for character ordering.
Row 1 of the CSV = index 0, row 2 = index 1, etc.
The existing 3000 characters (indexes 0-2999) came from the first 3000 rows
of alyssabedard/chinese-hsk-and-frequency-lists.  Any new characters you add
should come from the same CSV (rows 3001+) so the frequency ordering is preserved.

To add a custom character not in the HSK list, append a row to the CSV.

Expected CSV columns (alyssabedard/chinese-hsk-and-frequency-lists format):
    hanzi_sc              — simplified character  (required)
    hanzi_trad            — traditional character (optional; Claude fills if absent)
    pinyin                — tone-marked pinyin    (optional; Claude fills if absent)
    level                 — HSK level 1-9         (optional; Claude estimates if absent)
    cc_cedict_definitions — English definitions   (optional; Claude fills if absent)

For rows you added yourself, just fill in hanzi_sc and leave the rest blank —
Claude will generate everything missing.

Usage:
    python add_characters.py --source hsk.csv --from-to 3000 4000
    python add_characters.py --source hsk.csv --from-to 3005 3006   # single-char test
    python add_characters.py --source hsk.csv --from-to 3000 4000 --dry-run
    python add_characters.py --source hsk.csv --from-to 3000 4000 --overwrite

Requirements:
    pip install psycopg2-binary anthropic

Environment variables:
    DATABASE_URL       postgresql://postgres:postgres@localhost:5432/chinese_learning
    ANTHROPIC_API_KEY  sk-ant-...
"""

import argparse
import csv
import json
import os
import re
import sys
import time

try:
    import psycopg2
except ImportError:
    sys.exit("ERROR: psycopg2 not installed.  Run: pip install psycopg2-binary")

try:
    from anthropic import Anthropic
except ImportError:
    sys.exit("ERROR: anthropic not installed.  Run: pip install anthropic")

# ── Config ────────────────────────────────────────────────────────────────────
MODEL       = "claude-haiku-4-5-20251001"
DELAY       = 0.3
MAX_RETRIES = 3

# ── CSV column aliases ────────────────────────────────────────────────────────
CSV_COL_SIMPLIFIED  = ("hanzi_sc",  "simplified", "character", "char")
CSV_COL_TRADITIONAL = ("hanzi_trad", "traditional")
CSV_COL_PINYIN      = ("pinyin",)
CSV_COL_LEVEL       = ("level", "hsk_level", "hsk", "grade")
CSV_COL_DEFINITIONS = ("cc_cedict_definitions", "definition", "definitions", "meaning")


def csv_col(row: dict, candidates: tuple) -> str:
    for key in candidates:
        if key in row and row[key]:
            return str(row[key]).strip()
    return ""


# ── Claude prompts ────────────────────────────────────────────────────────────

# When the CSV already supplies simplified, traditional, pinyin, level,
# and definition — Claude only generates the enrichment fields.
ENRICH_PROMPT = """\
You are building a Mandarin Chinese learning database.
The following fields for the character '{simplified}' are already known:

  simplified:  {simplified}
  traditional: {traditional}
  pinyin:      {pinyin}
  definition:  {definition}
  hsk_level:   {hsk_level}

Generate ONLY the missing enrichment fields below.
Return a single valid JSON object — no markdown, no extra text.

{{
  "traditional_variants": ["<additional traditional variants beyond '{traditional}', else []>"],
  "pinyin2": "<second pronunciation if 多音字, else null>",
  "pinyin3": "<third pronunciation if 多音字, else null>",
  "numbered_pinyin":  "<'{pinyin}' in numbered-tone form, e.g. zhong1>",
  "numbered_pinyin2": "<numbered form of pinyin2, else null>",
  "numbered_pinyin3": "<numbered form of pinyin3, else null>",
  "radical_simplified":  "<Kangxi radical for '{simplified}', single char>",
  "radical_traditional": "<same radical in traditional script; same char if unchanged>",
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
    {{"word": "<compound in simplified Chinese containing '{simplified}'>", "pinyin": "<pinyin>", "meaning": "<English>"}},
    {{"word": "<compound in simplified Chinese containing '{simplified}'>", "pinyin": "<pinyin>", "meaning": "<English>"}},
    {{"word": "<compound in simplified Chinese containing '{simplified}'>", "pinyin": "<pinyin>", "meaning": "<English>"}}
  ],
  "word_examples_traditional": [
    {{"word": "<compound in traditional Chinese containing '{traditional}'>", "pinyin": "<pinyin>", "meaning": "<English>"}},
    {{"word": "<compound in traditional Chinese containing '{traditional}'>", "pinyin": "<pinyin>", "meaning": "<English>"}},
    {{"word": "<compound in traditional Chinese containing '{traditional}'>", "pinyin": "<pinyin>", "meaning": "<English>"}}
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

# When the CSV row has no pinyin/definition/traditional — Claude generates everything.
FULL_PROMPT = """\
You are building a Mandarin Chinese learning database.
Generate complete, accurate data for the character '{char}'.

Return a single valid JSON object — no markdown, no extra text.

{{
  "simplified": "{char}",
  "traditional": "<standard Taiwan/HK form; same as simplified if unchanged>",
  "traditional_variants": ["<extra variants if any, else []>"],
  "pinyin": "<primary pronunciation, tone-marked, e.g. zhōng>",
  "pinyin2": "<second pronunciation if 多音字, else null>",
  "pinyin3": "<third pronunciation if 多音字, else null>",
  "numbered_pinyin":  "<numbered-tone form, e.g. zhong1>",
  "numbered_pinyin2": "<numbered form of pinyin2, else null>",
  "numbered_pinyin3": "<numbered form of pinyin3, else null>",
  "radical_simplified":  "<Kangxi radical, single char>",
  "radical_traditional": "<same radical in traditional script>",
  "definition": ["<gloss 1>", "<gloss 2>", "<gloss 3>"],
  "hsk_level": <integer 1-9>,
  "examples": [
    {{"chinese": "<sentence in simplified Chinese containing '{char}'>", "english": "<translation>"}},
    {{"chinese": "<sentence in simplified Chinese containing '{char}'>", "english": "<translation>"}},
    {{"chinese": "<sentence in simplified Chinese containing '{char}'>", "english": "<translation>"}}
  ],
  "examples_traditional": [
    {{"chinese": "<same sentence in traditional Chinese>", "english": "<translation>"}},
    {{"chinese": "<same sentence in traditional Chinese>", "english": "<translation>"}},
    {{"chinese": "<same sentence in traditional Chinese>", "english": "<translation>"}}
  ],
  "word_examples": [
    {{"word": "<compound in simplified Chinese containing '{char}'>", "pinyin": "<pinyin>", "meaning": "<English>"}},
    {{"word": "<compound in simplified Chinese containing '{char}'>", "pinyin": "<pinyin>", "meaning": "<English>"}},
    {{"word": "<compound in simplified Chinese containing '{char}'>", "pinyin": "<pinyin>", "meaning": "<English>"}}
  ],
  "word_examples_traditional": [
    {{"word": "<compound in traditional Chinese>", "pinyin": "<pinyin>", "meaning": "<English>"}},
    {{"word": "<compound in traditional Chinese>", "pinyin": "<pinyin>", "meaning": "<English>"}},
    {{"word": "<compound in traditional Chinese>", "pinyin": "<pinyin>", "meaning": "<English>"}}
  ]
}}

RULES:
1. Every sentence in "examples" MUST contain '{char}'.
2. Every sentence in "examples_traditional" MUST contain the traditional form.
3. Every word in "word_examples" MUST contain '{char}'.
4. Every word in "word_examples_traditional" MUST contain the traditional form.
5. Sentences should be 5-15 Chinese characters.
6. Return pure JSON only.
"""


# ── CSV parsing ───────────────────────────────────────────────────────────────

def parse_definitions(raw: str) -> list:
    if not raw:
        return []
    parts = re.split(r"[/;]", raw)
    cleaned = []
    for p in parts:
        p = p.strip()
        if p and not re.match(r"^\(.*\)$", p):
            cleaned.append(p)
    return cleaned[:4]


def load_csv(path: str) -> list[dict]:
    """
    Load the master CSV and return a list of row dicts, one per character.
    Row index in the list = character index in the database (0-based).
    """
    if not path.lower().endswith(".csv"):
        sys.exit(
            "ERROR: --source must be a .csv file.\n"
            "The CSV is the single source of truth for character ordering.\n"
            "See the file header for the expected column format."
        )
    try:
        with open(path, encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            rows = list(reader)
    except FileNotFoundError:
        sys.exit(f"ERROR: file not found: {path}")

    if not rows:
        sys.exit("ERROR: CSV file is empty or has no data rows.")

    found_cols = set(rows[0].keys())
    if not any(c in found_cols for c in CSV_COL_SIMPLIFIED):
        sys.exit(
            f"ERROR: CSV is missing a simplified-character column.\n"
            f"Expected one of: {CSV_COL_SIMPLIFIED}\n"
            f"Found columns: {sorted(found_cols)}"
        )

    return rows


def row_to_entry(row: dict, index: int) -> dict:
    """
    Convert a CSV row to a character entry.
    Returns a dict with all available fields; missing fields are None/[].
    """
    simplified  = csv_col(row, CSV_COL_SIMPLIFIED)
    traditional = csv_col(row, CSV_COL_TRADITIONAL) or None  # None = let Claude decide
    pinyin      = csv_col(row, CSV_COL_PINYIN) or None
    level_raw   = csv_col(row, CSV_COL_LEVEL)
    defs_raw    = csv_col(row, CSV_COL_DEFINITIONS)

    try:
        hsk_level = int(float(level_raw)) if level_raw else None
    except ValueError:
        hsk_level = None

    definition = parse_definitions(defs_raw)  # [] if absent

    return {
        "index":       index,
        "simplified":  simplified,
        "traditional": traditional,
        "pinyin":      pinyin,
        "hsk_level":   hsk_level,
        "definition":  definition,
    }


# ── Claude ────────────────────────────────────────────────────────────────────

def call_claude(client, prompt: str) -> dict:
    for attempt in range(1, MAX_RETRIES + 1):
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
            if attempt < MAX_RETRIES:
                print(f"        attempt {attempt} failed ({e}), retrying…")
                time.sleep(1.0)
            else:
                raise RuntimeError(f"Claude failed after {MAX_RETRIES} attempts: {e}")


def generate(client, entry: dict) -> dict:
    """
    Call Claude with the appropriate prompt based on how much the CSV provided.
    Returns a complete data dict ready for build_params().
    """
    simplified  = entry["simplified"]
    traditional = entry["traditional"]
    pinyin      = entry["pinyin"]
    hsk_level   = entry["hsk_level"]
    definition  = entry["definition"]

    # If the CSV supplied the core fields, use the cheaper enrichment-only prompt.
    # If anything essential is missing, fall back to full generation.
    has_core = bool(traditional) and bool(pinyin) and hsk_level is not None and bool(definition)

    if has_core:
        prompt = ENRICH_PROMPT.format(
            simplified=simplified,
            traditional=traditional,
            pinyin=pinyin,
            definition="; ".join(definition),
            hsk_level=hsk_level,
        )
        enrichment = call_claude(client, prompt)
        # Merge: CSV fields are authoritative; Claude provides the rest
        return {
            "simplified":  simplified,
            "traditional": traditional,
            "pinyin":      pinyin,
            "hsk_level":   hsk_level,
            "definition":  definition,
            **enrichment,
        }
    else:
        prompt = FULL_PROMPT.format(char=simplified)
        data = call_claude(client, prompt)
        # Override with whatever the CSV did supply
        if traditional:
            data["traditional"] = traditional
        if pinyin:
            data["pinyin"] = pinyin
        if hsk_level is not None:
            data["hsk_level"] = hsk_level
        if definition:
            data["definition"] = definition
        return data


# ── Validation ────────────────────────────────────────────────────────────────

def validate(data: dict, simplified: str, traditional: str) -> list:
    issues = []
    for ex in data.get("examples", []):
        s = ex.get("chinese", "")
        if s and simplified not in s:
            issues.append(("examples", s))
    for ex in data.get("examples_traditional", []):
        s = ex.get("chinese", "")
        if s and traditional not in s:
            issues.append(("examples_traditional", s))
    for ex in data.get("word_examples", []):
        w = ex.get("word", "")
        if w and simplified not in w:
            issues.append(("word_examples", w))
    for ex in data.get("word_examples_traditional", []):
        w = ex.get("word", "")
        if w and traditional not in w:
            issues.append(("word_examples_traditional", w))
    return issues


# ── Radical lookup ────────────────────────────────────────────────────────────

def lookup_radical(cur, char: str):
    if not char:
        return None
    cur.execute(
        "SELECT index FROM radicals WHERE simplified = %s OR traditional = %s LIMIT 1",
        (char, char),
    )
    row = cur.fetchone()
    return row[0] if row else None


# ── DB insert ─────────────────────────────────────────────────────────────────

INSERT_SQL = """
    INSERT INTO chinese_characters (
        index, simplified, traditional, traditional_variants,
        pinyin, pinyin2, pinyin3,
        numbered_pinyin, numbered_pinyin2, numbered_pinyin3,
        radical_index, radical_index_traditional,
        definition, hsk_level, lesson,
        examples, examples_traditional,
        word_examples, word_examples_traditional
    ) VALUES (
        %(index)s, %(simplified)s, %(traditional)s, %(traditional_variants)s::text[],
        %(pinyin)s, %(pinyin2)s, %(pinyin3)s,
        %(numbered_pinyin)s, %(numbered_pinyin2)s, %(numbered_pinyin3)s,
        %(radical_index)s, %(radical_index_traditional)s,
        %(definition)s::text[], %(hsk_level)s, %(lesson)s,
        %(examples)s::jsonb, %(examples_traditional)s::jsonb,
        %(word_examples)s::jsonb, %(word_examples_traditional)s::jsonb
    )
"""


def build_params(index: int, data: dict, radical_idx, radical_idx_trad) -> dict:
    def nullable_str(key):
        v = data.get(key)
        return v if (v and str(v).strip()) else None

    def to_json(key):
        v = data.get(key)
        return json.dumps(v, ensure_ascii=False) if v else None

    trad_variants = [
        v for v in (data.get("traditional_variants") or [])
        if isinstance(v, str) and v.strip()
    ] or None

    definition = data.get("definition") or []
    if isinstance(definition, str):
        definition = [definition]

    return {
        "index":                     index,
        "simplified":                data["simplified"],
        "traditional":               data.get("traditional") or data["simplified"],
        "traditional_variants":      trad_variants,
        "pinyin":                    data["pinyin"],
        "pinyin2":                   nullable_str("pinyin2"),
        "pinyin3":                   nullable_str("pinyin3"),
        "numbered_pinyin":           nullable_str("numbered_pinyin"),
        "numbered_pinyin2":          nullable_str("numbered_pinyin2"),
        "numbered_pinyin3":          nullable_str("numbered_pinyin3"),
        "radical_index":             radical_idx,
        "radical_index_traditional": radical_idx_trad,
        "definition":                definition,
        "hsk_level":                 int(data["hsk_level"]) if data.get("hsk_level") is not None else 7,
        "lesson":                    None,
        "examples":                  to_json("examples"),
        "examples_traditional":      to_json("examples_traditional"),
        "word_examples":             to_json("word_examples"),
        "word_examples_traditional": to_json("word_examples_traditional"),
    }


def dry_run_print(index: int, params: dict):
    print(f"      [dry-run] index={index}:")
    for col, val in params.items():
        if col == "index":
            continue
        if isinstance(val, list):
            display = json.dumps(val, ensure_ascii=False)
        elif isinstance(val, str) and len(val) > 100:
            display = val[:97] + "…"
        else:
            display = str(val) if val is not None else "NULL"
        print(f"        {col:<28} {display}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Add new characters to chinese_characters from a master CSV.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--source", required=True, metavar="FILE",
        help="Master CSV file (alyssabedard/chinese-hsk-and-frequency-lists format).",
    )
    parser.add_argument(
        "--from-to", nargs=2, type=int, metavar=("START", "END"), required=True,
        help="Index range to populate. START inclusive, END exclusive.",
    )
    parser.add_argument(
        "--overwrite", action="store_true",
        help="Regenerate rows that already exist (default: skip).",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Show what would be inserted without writing to the database.",
    )
    args = parser.parse_args()

    start, end = args.from_to
    if start >= end:
        sys.exit("ERROR: START must be less than END.")

    # ── Load CSV ──────────────────────────────────────────────────────────────
    rows = load_csv(args.source)
    total_rows = len(rows)

    # Map rows to entries within the requested range
    entries = []
    for i, row in enumerate(rows):
        idx = i  # row position = database index (0-based)
        if idx < start:
            continue
        if idx >= end:
            break
        entry = row_to_entry(row, idx)
        if entry["simplified"]:
            entries.append(entry)

    if not entries:
        sys.exit(
            f"ERROR: no characters found in rows [{start}, {end}) of {args.source}.\n"
            f"The CSV has {total_rows} rows (indexes 0–{total_rows - 1})."
        )

    print(f"\nSource: {args.source}  ({total_rows} total rows)")
    print(f"Range [{start}, {end})  —  {len(entries)} character(s) to process.")
    if args.dry_run:
        print("(dry-run — nothing will be written)\n")
    else:
        print()

    # ── Connect ───────────────────────────────────────────────────────────────
    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        sys.exit("ERROR: DATABASE_URL not set.")
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        sys.exit("ERROR: ANTHROPIC_API_KEY not set.")

    conn   = psycopg2.connect(db_url)
    client = Anthropic(api_key=api_key)
    cur    = conn.cursor()

    # Which indexes already exist in the DB?
    cur.execute(
        "SELECT index FROM chinese_characters WHERE index >= %s AND index < %s",
        (start, end),
    )
    existing_indexes = {row[0] for row in cur.fetchall()}

    # Which simplified chars exist anywhere (duplicate guard)?
    cur.execute("SELECT index, simplified, hsk_level FROM chinese_characters")
    existing_chars: dict = {}
    for row in cur.fetchall():
        existing_chars[row[1]] = (row[0], row[2])

    inserted = skipped = errors = 0

    for entry in entries:
        idx  = entry["index"]
        char = entry["simplified"]

        # Skip: index already in DB
        if idx in existing_indexes and not args.overwrite:
            print(f"  [{idx}] {char}  → SKIP (index exists; use --overwrite to replace)")
            skipped += 1
            continue

        # Skip: same character already exists at a different index
        if char in existing_chars and existing_chars[char][0] != idx:
            other_idx, other_hsk = existing_chars[char]
            print(f"  [{idx}] {char}  → SKIP (already at index {other_idx}, HSK {other_hsk})")
            skipped += 1
            continue

        has_core = entry["traditional"] and entry["pinyin"] and entry["hsk_level"] and entry["definition"]
        mode_label = "enriching from CSV" if has_core else "generating all columns"
        print(f"  [{idx}] {char}  → {mode_label}…")

        # Generate via Claude
        try:
            data = generate(client, entry)
            time.sleep(DELAY)
        except RuntimeError as e:
            print(f"      ERROR: {e}")
            errors += 1
            continue

        simplified  = data.get("simplified", char)
        traditional = data.get("traditional") or simplified

        # Validate
        issues = validate(data, simplified, traditional)
        if issues:
            print(f"      VALIDATION WARNINGS ({len(issues)}):")
            for field, value in issues:
                print(f"        [{field}] '{value}'")

        # Radical lookup
        rad_simp = (data.get("radical_simplified") or "").strip()
        rad_trad = (data.get("radical_traditional") or rad_simp).strip()
        radical_idx      = lookup_radical(cur, rad_simp)
        radical_idx_trad = lookup_radical(cur, rad_trad)
        if not radical_idx:
            print(f"      NOTE: radical '{rad_simp}' not found → radical_index=NULL")

        params = build_params(idx, data, radical_idx, radical_idx_trad)

        if args.dry_run:
            dry_run_print(idx, params)
            print(f"      ✓ would insert: {simplified} / {traditional}  "
                  f"({data.get('pinyin','?')})  HSK {data.get('hsk_level','?')}")
            inserted += 1
            continue

        try:
            if idx in existing_indexes:
                cur.execute("DELETE FROM chinese_characters WHERE index = %s", (idx,))
            cur.execute(INSERT_SQL, params)
            conn.commit()
            action = "replaced" if idx in existing_indexes else "inserted"
            print(f"      ✓ {action}: {simplified} / {traditional}  "
                  f"({data.get('pinyin','?')})  HSK {data.get('hsk_level','?')}")
            inserted += 1
        except Exception as e:
            conn.rollback()
            print(f"      ERROR inserting: {e}")
            errors += 1

    print(f"\n{'='*60}")
    print(f"Done.  inserted={inserted}  skipped={skipped}  errors={errors}")
    if args.dry_run:
        print("(dry-run — no rows were written)")

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
