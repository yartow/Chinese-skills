"""
import_excel_characters.py
--------------------------
Bulk-imports characters from mega_hanzi_compilation.xlsx into chinese_characters.

Reads these columns:
  B  simplified
  C  traditional
  D  pinyin          (comma-separated, up to 3 pronunciations)
  E  pinyin_style2   (numbered-tone form, same order as D)
  N  meaning_junda   (short definition, slash-separated)
  P  hsk30_level     (HSK level string like "HSK_L7", or empty)
  U  cc_cedict_definitions  (fallback definition)

Does NOT use the Claude API — all data comes from the Excel file.
Examples and radical fields are left empty (can be enriched later).

New characters are assigned indexes 3000, 3001, … (after the existing 3000 HSK chars).
Characters already in the database (by simplified form) are skipped.
Characters missing pinyin are skipped (pinyin is NOT NULL in the schema).

Usage:
    export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chinese_learning
    python3 import_excel_characters.py [--dry-run]
"""

import argparse
import json
import os
import re
import sys

try:
    import openpyxl
except ImportError:
    sys.exit("ERROR: openpyxl not installed.  Run: pip install openpyxl")

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    sys.exit("ERROR: psycopg2 not installed.  Run: pip install psycopg2-binary")

EXCEL_PATH = os.path.join(os.path.dirname(__file__), "mega_hanzi_compilation.xlsx")

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
        NULL, NULL,
        %(definition)s::text[], %(hsk_level)s, NULL,
        '[]'::jsonb, '[]'::jsonb,
        NULL, NULL
    )
    ON CONFLICT (index) DO NOTHING
"""


_MONTH_SYLLABLE = {
    1: "jan", 2: "feb", 3: "mar", 4: "apr", 5: "may", 6: "jun",
    7: "jul", 8: "aug", 9: "sep", 10: "oct", 11: "nov", 12: "dec",
}


def cell_to_str(value) -> str:
    """Convert a cell value to string, recovering Excel-mangled dates.

    Numbered pinyin like 'jun1' gets auto-converted by Excel to a date
    (e.g. datetime(2026, 6, 1)).  We reverse that by mapping month → syllable
    and day → tone number.
    """
    import datetime
    if isinstance(value, datetime.datetime):
        syllable = _MONTH_SYLLABLE.get(value.month, "")
        return f"{syllable}{value.day}" if syllable else ""
    return (str(value) if value is not None else "").strip()


def split_pinyin(raw) -> list:
    """Split a (possibly datetime-mangled) pinyin cell into up to 3 parts."""
    s = cell_to_str(raw)
    if not s:
        return []
    parts = [p.strip() for p in re.split(r",\s*", s)]
    return [p for p in parts if p][:3]


def parse_definition(meaning_junda: str, cedict: str) -> list:
    """Return a text[] suitable for the definition column."""
    raw = (meaning_junda or "").strip() or (cedict or "").strip()
    if not raw:
        return []
    parts = [p.strip() for p in raw.split("/") if p.strip()]
    # Drop only cross-reference meta-notes, not legitimate parenthetical definitions
    parts = [p for p in parts if not re.match(r"^\((?:see|same as|variant of|also written|abbr\.? for)", p, re.I)]
    return parts[:5]


def load_rows(excel_path: str, existing_simplified: set) -> list:
    """
    Return list of param dicts for rows not already in the DB.
    Assigns consecutive indexes starting at 3000 + len(existing_simplified)
    — but actually we start at max(existing index) + 1.
    """
    wb = openpyxl.load_workbook(excel_path, read_only=True, data_only=True)
    ws = wb.active

    next_index = 3000  # will be set from DB
    rows = []
    skipped_no_pinyin = 0

    for i, row in enumerate(ws.iter_rows(values_only=True)):
        if i == 0:  # header
            continue

        simp = (row[1] or "").strip()
        if not simp:
            continue
        if simp in existing_simplified:
            continue

        # Required: pinyin
        pinyin_raw   = cell_to_str(row[3])
        numbered_raw = cell_to_str(row[4]) if len(row) > 4 else ""
        if not pinyin_raw:
            skipped_no_pinyin += 1
            continue

        trad = (row[2] or "").strip() or simp

        hsk_raw = cell_to_str(row[15]) if len(row) > 15 else ""
        if not hsk_raw:
            hsk_level = 0
        elif re.match(r"^HSK_L\d+$", hsk_raw):
            hsk_level = int(hsk_raw[5:])
        else:
            print(f"      WARNING: unexpected hsk30_level value {hsk_raw!r} for {simp!r} — defaulting to 0")
            hsk_level = 0

        meaning_junda = cell_to_str(row[13]) if len(row) > 13 else ""
        cedict        = cell_to_str(row[20]) if len(row) > 20 else ""
        definition    = parse_definition(meaning_junda, cedict)

        pinyins  = split_pinyin(pinyin_raw)
        numbered = split_pinyin(numbered_raw)

        rows.append({
            "simplified":       simp,
            "traditional":      trad,
            "pinyin":           pinyins[0] if pinyins else "",
            "pinyin2":          pinyins[1] if len(pinyins) > 1 else None,
            "pinyin3":          pinyins[2] if len(pinyins) > 2 else None,
            "numbered_pinyin":  numbered[0] if numbered else None,
            "numbered_pinyin2": numbered[1] if len(numbered) > 1 else None,
            "numbered_pinyin3": numbered[2] if len(numbered) > 2 else None,
            "definition":       definition,
            "hsk_level":        hsk_level,
            "traditional_variants": None,
        })

    wb.close()

    if skipped_no_pinyin:
        print(f"  Skipped {skipped_no_pinyin} rows with no pinyin.")

    # Assign indexes in order
    for row in rows:
        row["index"] = next_index
        next_index += 1

    return rows


def main():
    parser = argparse.ArgumentParser(description="Bulk import Excel characters into DB")
    parser.add_argument("--dry-run", action="store_true", help="Print counts, no writes")
    args = parser.parse_args()

    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        sys.exit("ERROR: DATABASE_URL not set.")

    conn = psycopg2.connect(db_url)
    cur  = conn.cursor()

    cur.execute("SELECT simplified FROM chinese_characters")
    existing = {row[0] for row in cur.fetchall()}
    cur.execute("SELECT COALESCE(MAX(index), 2999) FROM chinese_characters")
    max_index = cur.fetchone()[0]
    print(f"DB has {len(existing)} characters, max index = {max_index}")

    rows = load_rows(EXCEL_PATH, existing)
    # Correct starting index based on actual DB max
    offset = (max_index + 1) - 3000
    for row in rows:
        row["index"] += offset

    print(f"New characters to insert: {len(rows)}")
    if rows:
        print(f"  Index range: {rows[0]['index']} – {rows[-1]['index']}")

    hsk_breakdown = {}
    for r in rows:
        hsk_breakdown[r["hsk_level"]] = hsk_breakdown.get(r["hsk_level"], 0) + 1
    print(f"  HSK 0 (non-HSK): {hsk_breakdown.get(0, 0)}")
    for lvl in sorted(k for k in hsk_breakdown if k > 0):
        print(f"  HSK {lvl}: {hsk_breakdown[lvl]}")

    no_def = sum(1 for r in rows if not r["definition"])
    print(f"  Missing definition: {no_def}")

    if args.dry_run:
        print("\n[dry-run] Sample of first 5 rows:")
        for r in rows[:5]:
            print(f"  [{r['index']}] {r['simplified']} / {r['traditional']}  "
                  f"{r['pinyin']}  HSK={r['hsk_level']}  def={r['definition'][:2]}")
        print("\n[dry-run] Nothing written.")
        cur.close()
        conn.close()
        return

    # Bulk insert in batches of 500
    BATCH = 500
    inserted = 0
    for i in range(0, len(rows), BATCH):
        batch = rows[i:i + BATCH]
        psycopg2.extras.execute_batch(cur, INSERT_SQL, batch, page_size=BATCH)
        conn.commit()
        inserted += len(batch)
        print(f"  Inserted {inserted}/{len(rows)}…")

    print(f"\nDone. {inserted} characters inserted.")
    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
