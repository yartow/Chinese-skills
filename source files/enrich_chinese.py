"""
Chinese Characters Enrichment Script
-------------------------------------
This script:
1. Detects and fixes bad/duplicate/placeholder example sentences
2. Checks all columns for data integrity issues (pinyin, traditional variants, definitions)
3. Adds a new 'wordExamples' column with 3 compound word examples per character
4. Writes the corrected file back to Excel

Requirements:
    pip install anthropic openpyxl pandas

Usage:
    Set your API key:  export ANTHROPIC_API_KEY=sk-ant-...
    Run:               python enrich_chinese.py
"""

import os
import json
import time
import re
import pandas as pd
from anthropic import Anthropic

# ── Config ─────────────────────────────────────────────────────────────────────
INPUT_FILE  = "chinese_characters_export.xlsx"   # put your file in the same folder
OUTPUT_FILE = "chinese_characters_enriched.xlsx"
MODEL       = "claude-haiku-4-5-20251001"        # cheapest model — great for structured data tasks
MAX_TOKENS  = 4000  # ~350 tokens per char x 5 chars + overhead
BATCH_SIZE  = 5     # 5 chars x ~350 tokens output = ~1750 tokens, safe margin
DELAY       = 0.3   # seconds between API calls (respect rate limits)

# Pricing per 1M tokens (input / output) — update if Anthropic changes pricing
MODEL_PRICING = {
    "claude-haiku-4-5-20251001": (0.80, 4.00),    # cheapest, ~$1-2 for this job
    "claude-sonnet-4-6":         (3.00, 15.00),   # mid-range, ~$4-6 for this job
    "claude-opus-4-5":           (15.00, 75.00),  # most expensive, ~$20-25 for this job
}
# ───────────────────────────────────────────────────────────────────────────────

client = Anthropic()


# ── Quality Detection ───────────────────────────────────────────────────────────

def classify_example_quality(ex_str: str, char: str) -> str:
    """Returns 'ok' or a reason string if the examples need fixing."""
    try:
        data = json.loads(ex_str)
    except Exception:
        return "parse_error"

    if not data:
        return "empty"

    sentences = [d.get("chinese", "") for d in data]

    # Placeholder pattern: bare character, 学X, 这是X
    if any(s.strip() in (char, f"学{char}", f"这是{char}") for s in sentences):
        return "placeholder"

    # Fewer than 3 examples
    if len(data) < 3:
        return "incomplete"

    # All three sentences identical
    if len(set(sentences)) == 1:
        return "all_duplicate"

    # Any two sentences identical
    if len(set(sentences)) < len(sentences):
        return "partial_duplicate"

    # All sentences suspiciously short (≤ 3 chars) — not useful for learners
    if all(len(s) <= 3 for s in sentences):
        return "too_short"

    # Same English translation reused across different Chinese sentences
    translations = [d.get("english", "") for d in data]
    if len(set(translations)) == 1 and len(set(sentences)) > 1:
        return "duplicate_english"

    return "ok"


def needs_fix(row) -> bool:
    quality = classify_example_quality(row["examples"], row["simplified"])
    return quality != "ok"


def check_column_issues(df: pd.DataFrame) -> pd.DataFrame:
    """
    Adds a 'dataIssues' column flagging known integrity problems so Claude
    can fix them during enrichment.
    """
    issues = []
    for _, row in df.iterrows():
        flags = []

        # pinyin3 stored as literal string 'nan'
        if str(row.get("pinyin3", "")).strip().lower() == "nan":
            flags.append("pinyin3_is_nan_string")
        if str(row.get("numberedPinyin3", "")).strip().lower() == "nan":
            flags.append("numberedPinyin3_is_nan_string")

        # Traditional character same as simplified — may be correct but flag for review
        if row["traditional"] == row["simplified"]:
            flags.append("traditional_same_as_simplified")

        # Definition suspiciously short
        defn = str(row.get("definition", ""))
        if len(defn.strip()) < 3:
            flags.append("definition_too_short")

        issues.append(", ".join(flags) if flags else "")

    df = df.copy()
    df["dataIssues"] = issues
    return df


# ── API Call ────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a professional Mandarin Chinese language teacher creating study materials.
You will receive a batch of Chinese characters and return enrichment data for each one.

Rules for example sentences:
- Write 3 DISTINCT sentences per character — different grammar structures and contexts
- Sentences should be natural, modern Mandarin (not textbook stiff)
- Length: 6–15 characters per sentence (not too short, not too long)
- Show the target character used in genuinely different ways across the 3 sentences
- English translations must be natural and accurate
- Use simplified Chinese unless told otherwise
- Do NOT repeat the same sentence with only the English changed

Rules for word examples:
- Provide 3 common compound words or phrases that contain the character
- Format: {"word": "便宜", "pinyin": "piányí", "meaning": "cheap / inexpensive"}
- If fewer than 3 real compound words exist, provide as many as possible (min 1)
- Only use real, commonly-used words — never invent words

Rules for data corrections:
- If pinyin appears wrong, provide the correct pinyin
- If the traditional character looks wrong, provide the correct one
- If definition is missing or incomplete, improve it

Always respond with ONLY a valid JSON array — no markdown, no explanation."""


def build_prompt(rows: list[dict]) -> str:
    chars_json = json.dumps(rows, ensure_ascii=False, indent=2)
    return f"""For each character below, return enriched data.

Input characters:
{chars_json}

Return a JSON array with one object per character, in the same order:
[
  {{
    "index": <original index number>,
    "simplified": "<character>",
    "pinyin_corrected": "<corrected pinyin or null if already correct>",
    "numberedPinyin_corrected": "<corrected numbered pinyin or null>",
    "traditional_corrected": "<corrected traditional or null if already correct>",
    "definition_corrected": "<improved definition or null if already correct>",
    "examples": [
      {{"chinese": "<sentence>", "english": "<translation>"}},
      {{"chinese": "<sentence>", "english": "<translation>"}},
      {{"chinese": "<sentence>", "english": "<translation>"}}
    ],
    "wordExamples": [
      {{"word": "<compound word>", "pinyin": "<pinyin>", "meaning": "<meaning>"}},
      {{"word": "<compound word>", "pinyin": "<pinyin>", "meaning": "<meaning>"}},
      {{"word": "<compound word>", "pinyin": "<pinyin>", "meaning": "<meaning>"}}
    ]
  }}
]"""


def call_api(batch_rows: list[dict]) -> list[dict] | None:
    """Calls the Claude API for a batch of characters. Returns parsed JSON or None on failure."""
    prompt = build_prompt(batch_rows)
    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}]
        )
        raw = response.content[0].text.strip()

        # Strip accidental markdown fences
        raw = re.sub(r"^```[a-z]*\n?", "", raw)
        raw = re.sub(r"\n?```$", "", raw)

        return json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"    [!] JSON parse error: {e}")
        return None
    except Exception as e:
        print(f"    [!] API error: {e}")
        return None


# ── Apply Corrections ───────────────────────────────────────────────────────────

def apply_corrections(df: pd.DataFrame, results: list[dict]) -> pd.DataFrame:
    """Writes API results back into the dataframe."""
    df = df.copy()
    for item in results:
        idx = item.get("index")
        if idx is None:
            continue

        mask = df["index"] == idx
        if not mask.any():
            continue

        row_idx = df[mask].index[0]

        # Fix examples
        if "examples" in item and item["examples"]:
            df.at[row_idx, "examples"] = json.dumps(item["examples"], ensure_ascii=False)

        # Fix word examples
        if "wordExamples" in item and item["wordExamples"]:
            df.at[row_idx, "wordExamples"] = json.dumps(item["wordExamples"], ensure_ascii=False)

        # Fix pinyin if corrected
        if item.get("pinyin_corrected"):
            df.at[row_idx, "pinyin"] = item["pinyin_corrected"]
        if item.get("numberedPinyin_corrected"):
            df.at[row_idx, "numberedPinyin"] = item["numberedPinyin_corrected"]

        # Fix traditional if corrected
        if item.get("traditional_corrected"):
            df.at[row_idx, "traditional"] = item["traditional_corrected"]

        # Fix definition if corrected
        if item.get("definition_corrected"):
            df.at[row_idx, "definition"] = item["definition_corrected"]

    return df


# ── Main ────────────────────────────────────────────────────────────────────────

def main():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: Set your ANTHROPIC_API_KEY environment variable first.")
        print("  export ANTHROPIC_API_KEY=sk-ant-...")
        return

    # ── Load ──
    print(f"Loading {INPUT_FILE}...")
    df = pd.read_excel(INPUT_FILE)
    print(f"  Loaded {len(df)} rows, columns: {list(df.columns)}")

    # ── Add wordExamples column if missing ──
    if "wordExamples" not in df.columns:
        df["wordExamples"] = None

    # ── Check column integrity ──
    print("Checking column integrity...")
    df = check_column_issues(df)

    # ── Identify rows needing work ──
    bad_examples_mask = df.apply(needs_fix, axis=1)
    missing_words_mask = df["wordExamples"].isna() | (df["wordExamples"] == "")
    needs_work_mask = bad_examples_mask | missing_words_mask

    work_df = df[needs_work_mask]
    print(f"  Rows with bad examples:        {bad_examples_mask.sum()}")
    print(f"  Rows missing word examples:    {missing_words_mask.sum()}")
    print(f"  Total rows to enrich:          {len(work_df)}")
    print()

    if len(work_df) == 0:
        print("Nothing to fix — all rows look good!")
        df.to_excel(OUTPUT_FILE, index=False)
        print(f"Saved to {OUTPUT_FILE}")
        return

    # Estimate cost based on selected model (~500 input + 300 output tokens per character)
    input_price, output_price = MODEL_PRICING.get(MODEL, (3.00, 15.00))
    estimated_cost = len(work_df) * (500 * input_price + 300 * output_price) / 1_000_000
    print(f"Model: {MODEL}")
    print(f"Estimated API cost: ~${estimated_cost:.2f} USD")
    confirm = input("Proceed? (y/n): ").strip().lower()
    if confirm != "y":
        print("Aborted.")
        return

    # ── Process in batches ──
    rows_to_process = work_df.to_dict("records")
    total = len(rows_to_process)
    fixed = 0
    failed_indices = []

    print(f"\nProcessing {total} rows in batches of {BATCH_SIZE}...")
    print("-" * 50)

    for batch_start in range(0, total, BATCH_SIZE):
        batch = rows_to_process[batch_start: batch_start + BATCH_SIZE]

        # Build minimal input for API (only what Claude needs)
        api_input = []
        for row in batch:
            api_input.append({
                "index": row["index"],
                "simplified": row["simplified"],
                "traditional": row["traditional"],
                "pinyin": row["pinyin"],
                "pinyin2": row.get("pinyin2") if pd.notna(row.get("pinyin2")) else None,
                "numberedPinyin": row["numberedPinyin"],
                "definition": row["definition"],
                "hskLevel": row["hskLevel"],
                "currentExamples": row["examples"],
                "exampleQuality": classify_example_quality(row["examples"], row["simplified"]),
                "dataIssues": row.get("dataIssues", ""),
            })

        chars_preview = ", ".join(r["simplified"] for r in batch)
        print(f"  Batch {batch_start // BATCH_SIZE + 1}/{(total + BATCH_SIZE - 1) // BATCH_SIZE}  [{chars_preview}]", end=" ")

        results = call_api(api_input)

        if results:
            df = apply_corrections(df, results)
            fixed += len(batch)
            print(f"✓ ({fixed}/{total})")
        else:
            # Retry once
            print("retrying...", end=" ")
            time.sleep(2)
            results = call_api(api_input)
            if results:
                df = apply_corrections(df, results)
                fixed += len(batch)
                print(f"✓ ({fixed}/{total})")
            else:
                failed_indices.extend(r["index"] for r in batch)
                print(f"✗ FAILED — indices: {[r['index'] for r in batch]}")

        # Save checkpoint every 50 rows so you don't lose progress
        if (batch_start + BATCH_SIZE) % 50 == 0:
            checkpoint_file = OUTPUT_FILE.replace(".xlsx", "_checkpoint.xlsx")
            df.to_excel(checkpoint_file, index=False)
            print(f"  [checkpoint saved → {checkpoint_file}]")

        time.sleep(DELAY)

    # ── Save final output ──
    print()
    print("=" * 50)
    df.to_excel(OUTPUT_FILE, index=False)
    print(f"Done! Fixed {fixed}/{total} rows.")
    print(f"Saved to: {OUTPUT_FILE}")

    if failed_indices:
        print(f"\n[!] {len(failed_indices)} rows could not be processed:")
        print(f"    Indices: {failed_indices}")
        print(f"    Tip: re-run the script — it will skip already-fixed rows.")


if __name__ == "__main__":
    main()