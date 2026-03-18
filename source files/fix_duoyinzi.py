"""
fix_duoyinzi.py — Fill in missing alternate pronunciations (多音字)
--------------------------------------------------------------------
- Cleans up "nan" strings in pinyin2/numberedPinyin2 columns
- Identifies characters that likely have multiple pronunciations
- Calls Claude to verify and fill in correct pinyin2/numberedPinyin2
- Leaves all other columns untouched

Requirements:  pip install anthropic openpyxl pandas
Usage:         python fix_duoyinzi.py
"""

import os, json, time, re
import pandas as pd
from anthropic import Anthropic

# ── Config ──────────────────────────────────────────────────────────────────────
INPUT_FILE  = "chinese_characters_enriched.xlsx"   # your enriched output file
OUTPUT_FILE = "chinese_characters_enriched.xlsx"   # overwrite in place (safe — checkpoints first)
MODEL       = "claude-haiku-4-5-20251001"
MAX_TOKENS  = 1000
BATCH_SIZE  = 20   # pinyin responses are tiny, large batches are fine
DELAY       = 0.2
# ────────────────────────────────────────────────────────────────────────────────

client = Anthropic()

SYSTEM_PROMPT = """You are an expert in Mandarin Chinese linguistics specialising in 多音字 (duōyīnzì — characters with multiple pronunciations).

For each character given, determine if it has a second (or third) common pronunciation used in everyday Mandarin.

Rules:
- Only include pronunciations that are genuinely common and useful to a learner
- Do NOT include obscure literary, classical, or dialect-only readings
- pinyin2 must use tone marks (e.g. xiàng), numberedPinyin2 must use numbers (e.g. xiang4)
- If a character has NO second common pronunciation, return null for both fields
- Always respond with ONLY a valid JSON array, no markdown, no explanation

Example output:
[
  {"index": 5, "simplified": "行", "pinyin2": "háng", "numberedPinyin2": "hang2", "note": "row/profession (银行 bank)"},
  {"index": 9, "simplified": "的", "pinyin2": null, "numberedPinyin2": null, "note": "no common second pronunciation"},
  {"index": 12, "simplified": "长", "pinyin2": "cháng", "numberedPinyin2": "chang2", "note": "long (长城 Great Wall)"}
]"""


def clean_nan_strings(df: pd.DataFrame) -> pd.DataFrame:
    """Replace literal 'nan' strings with proper NaN in pinyin columns."""
    df = df.copy()
    for col in ["pinyin2", "pinyin3", "numberedPinyin2", "numberedPinyin3"]:
        if col in df.columns:
            df[col] = df[col].apply(
                lambda v: None if str(v).strip().lower() == "nan" else v
            )
    return df


def call_api(batch: list[dict]) -> list[dict] | None:
    prompt = f"""Check each character below for a second common pronunciation.

{json.dumps(batch, ensure_ascii=False, indent=2)}

Return a JSON array with one object per character in the same order."""

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}]
        )
        raw = response.content[0].text.strip()
        raw = re.sub(r"^```[a-z]*\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)
        return json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"    [!] JSON parse error: {e}")
        return None
    except Exception as e:
        print(f"    [!] API error: {e}")
        return None


def main():
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("ERROR: Set ANTHROPIC_API_KEY first.  export ANTHROPIC_API_KEY=sk-ant-...")
        return

    print(f"Loading {INPUT_FILE}...")
    df = pd.read_excel(INPUT_FILE)
    print(f"  {len(df)} rows loaded")

    # ── Step 1: Clean "nan" strings ──
    print("Cleaning 'nan' strings in pinyin columns...")
    before = df["pinyin2"].notna().sum()
    df = clean_nan_strings(df)
    after = df["pinyin2"].notna().sum()
    print(f"  pinyin2: {before} → {after} real values (rest now properly empty)")

    # ── Step 2: Find candidates — all chars currently missing pinyin2 ──
    # We ask Claude to judge each one; it will return null for non-duoyinzi
    candidates = df[df["pinyin2"].isna()][["index", "simplified", "pinyin", "numberedPinyin", "definition"]]
    print(f"  Characters without pinyin2: {len(candidates)} — sending all to Claude to check")
    print(f"  Estimated cost: ~${len(candidates) * (200 * 0.80 + 80 * 4.00) / 1_000_000:.3f} USD (Haiku)")
    print()

    confirm = input("Proceed? (y/n): ").strip().lower()
    if confirm != "y":
        print("Aborted.")
        return

    rows_to_check = candidates.to_dict("records")
    total = len(rows_to_check)
    updated = 0
    confirmed_duoyinzi = 0
    failed_indices = []

    print(f"\nChecking {total} characters in batches of {BATCH_SIZE}...")
    print("-" * 55)

    for batch_start in range(0, total, BATCH_SIZE):
        batch_rows = rows_to_check[batch_start: batch_start + BATCH_SIZE]

        api_input = [
            {
                "index": r["index"],
                "simplified": r["simplified"],
                "pinyin": r["pinyin"],
                "numberedPinyin": r["numberedPinyin"],
                "definition": str(r["definition"])[:80],
            }
            for r in batch_rows
        ]

        chars_preview = "".join(r["simplified"] for r in batch_rows)
        batch_num = batch_start // BATCH_SIZE + 1
        total_batches = (total + BATCH_SIZE - 1) // BATCH_SIZE
        print(f"  Batch {batch_num}/{total_batches}  [{chars_preview}]", end="  ")

        results = call_api(api_input)

        if results is None:
            print("retrying...", end=" ")
            time.sleep(2)
            results = call_api(api_input)

        if results:
            for item in results:
                idx = item.get("index")
                p2  = item.get("pinyin2")
                np2 = item.get("numberedPinyin2")

                if idx is None:
                    continue

                mask = df["index"] == idx
                if not mask.any():
                    continue

                row_i = df[mask].index[0]

                if p2 and str(p2).strip().lower() not in ("null", "none", "nan", ""):
                    df.at[row_i, "pinyin2"]         = p2
                    df.at[row_i, "numberedPinyin2"] = np2
                    confirmed_duoyinzi += 1

            updated += len(batch_rows)
            print(f"✓  ({updated}/{total} checked, {confirmed_duoyinzi} duoyinzi found)")
        else:
            failed_indices.extend(r["index"] for r in batch_rows)
            print(f"✗ FAILED")

        time.sleep(DELAY)

    # ── Save ──
    print()
    print("=" * 55)
    df.to_excel(OUTPUT_FILE, index=False)
    print(f"Checked {updated}/{total} characters")
    print(f"Found and filled {confirmed_duoyinzi} missing alternate pronunciations")
    print(f"Saved → {OUTPUT_FILE}")

    if failed_indices:
        print(f"\n[!] {len(failed_indices)} characters not processed — re-run to retry:")
        print(f"    {failed_indices}")


if __name__ == "__main__":
    main()