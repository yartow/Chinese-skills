"""
Traditional Chinese Translation Script
----------------------------------------
Converts simplified Chinese in columns O (examples) and Q (wordExamples)
to traditional Chinese, writing results into columns P (examplesTraditional)
and R (wordExamplesTraditional).

Only English translations are kept as-is — only the Chinese characters are
converted from simplified to traditional form.

Requirements:
    pip install anthropic openpyxl pandas

Usage:
    conda activate claudeProject
    export ANTHROPIC_API_KEY=sk-ant-...
    python translate_traditional.py
"""

import os
import json
import time
import re
import pandas as pd
from anthropic import Anthropic

# ── Config ─────────────────────────────────────────────────────────────────────
INPUT_FILE  = "/Users/andrewyong/Downloads/chinese_charactersv2.xlsx"
OUTPUT_FILE = "/Users/andrewyong/Downloads/chinese_charactersv2_traditional.xlsx"
MODEL       = "claude-haiku-4-5-20251001"
MAX_TOKENS  = 4000
BATCH_SIZE  = 10    # More rows per batch since this is simpler than enrichment
DELAY       = 0.3   # seconds between API calls

MODEL_PRICING = {
    "claude-haiku-4-5-20251001": (0.80, 4.00),
    "claude-sonnet-4-6":         (3.00, 15.00),
}
# ───────────────────────────────────────────────────────────────────────────────

client = Anthropic()

SYSTEM_PROMPT = """You are a Chinese language expert specialising in simplified-to-traditional Chinese conversion.
You will receive batches of JSON data containing simplified Chinese text and must convert ONLY the Chinese characters to their traditional forms.

Rules:
- Convert simplified Chinese characters to traditional Chinese characters
- Keep all English text EXACTLY as-is
- Keep all pinyin EXACTLY as-is
- Keep all JSON structure and field names EXACTLY as-is
- Do NOT rephrase, rewrite, or change the meaning — only convert character forms
- If a character has no traditional variant (already the same), leave it unchanged
- Always respond with ONLY a valid JSON array — no markdown, no explanation"""


def build_prompt(batch: list[dict]) -> str:
    return f"""Convert the simplified Chinese to traditional Chinese for each row below.
Keep English and pinyin unchanged. Return a JSON array in the same order.

Input:
{json.dumps(batch, ensure_ascii=False, indent=2)}

Return a JSON array with one object per row:
[
  {{
    "index": <original index>,
    "examplesTraditional": [<same structure as examples but with traditional Chinese>],
    "wordExamplesTraditional": [<same structure as wordExamples but with traditional Chinese>]
  }},
  ...
]

For examplesTraditional each item has: {{"chinese": "<traditional>", "english": "<unchanged>"}}
For wordExamplesTraditional each item has the same fields as wordExamples but with traditional Chinese in the "word" and "chinese" fields."""


def call_api(batch: list[dict]) -> list[dict] | None:
    prompt = build_prompt(batch)
    raw = None
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
        if raw is not None:
            print(f"    Raw response: {raw[:300]}")
        return None
    except Exception as e:
        print(f"    [!] API error: {e}")
        return None


def apply_results(df: pd.DataFrame, results: list[dict]) -> pd.DataFrame:
    df = df.copy()
    for item in results:
        idx = item.get("index")
        if idx is None:
            continue
        mask = df["index"] == idx
        if not mask.any():
            continue
        row_idx = df[mask].index[0]

        if item.get("examplesTraditional"):
            df.at[row_idx, "examplesTraditional"] = json.dumps(
                item["examplesTraditional"], ensure_ascii=False
            )

        if item.get("wordExamplesTraditional"):
            df.at[row_idx, "wordExamplesTraditional"] = json.dumps(
                item["wordExamplesTraditional"], ensure_ascii=False
            )

    return df


def needs_examples_trad(row) -> bool:
    val = row.get("examplesTraditional")
    if val is None or (isinstance(val, float) and pd.isna(val)) or str(val).strip() in ("", "nan"):
        return True
    try:
        parsed = json.loads(str(val))
        return not parsed
    except Exception:
        return True


def needs_word_examples_trad(row) -> bool:
    # Only process if the row has wordExamples to begin with
    we = row.get("wordExamples")
    if we is None or (isinstance(we, float) and pd.isna(we)) or str(we).strip() in ("", "nan"):
        return False  # nothing to translate
    try:
        parsed = json.loads(str(we))
        if not parsed:
            return False
    except Exception:
        return False

    val = row.get("wordExamplesTraditional")
    if val is None or (isinstance(val, float) and pd.isna(val)) or str(val).strip() in ("", "nan"):
        return True
    try:
        parsed = json.loads(str(val))
        return not parsed
    except Exception:
        return True


def main():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: Set your ANTHROPIC_API_KEY environment variable first.")
        print("  export ANTHROPIC_API_KEY=sk-ant-...")
        return

    print(f"Loading {INPUT_FILE}...")
    df = pd.read_excel(INPUT_FILE)
    print(f"  Loaded {len(df)} rows, columns: {list(df.columns)}")

    # Ensure target columns exist and are string-typed (empty cells read as float64)
    for col in ("examplesTraditional", "wordExamplesTraditional"):
        if col not in df.columns:
            df[col] = ""
        df[col] = df[col].where(df[col].notna(), other="").astype(str).replace("nan", "")

    # Identify rows needing work
    needs_examples_mask  = df.apply(needs_examples_trad, axis=1)
    needs_words_mask     = df.apply(needs_word_examples_trad, axis=1)
    needs_work_mask      = needs_examples_mask | needs_words_mask

    work_df = df[needs_work_mask]
    print(f"  Rows missing examplesTraditional:     {needs_examples_mask.sum()}")
    print(f"  Rows missing wordExamplesTraditional: {needs_words_mask.sum()}")
    print(f"  Total rows to process:                {len(work_df)}")
    print()

    if len(work_df) == 0:
        print("Nothing to do — all rows already have traditional data!")
        df.to_excel(OUTPUT_FILE, index=False)
        print(f"Saved to {OUTPUT_FILE}")
        return

    input_price, output_price = MODEL_PRICING.get(MODEL, (0.80, 4.00))
    # ~200 input tokens + ~200 output tokens per row (simple conversion, short)
    estimated_cost = len(work_df) * (200 * input_price + 200 * output_price) / 1_000_000
    print(f"Model: {MODEL}")
    print(f"Estimated API cost: ~${estimated_cost:.2f} USD")
    confirm = input("Proceed? (y/n): ").strip().lower()
    if confirm != "y":
        print("Aborted.")
        return

    rows_to_process = work_df.to_dict("records")
    total = len(rows_to_process)
    fixed = 0
    failed_indices = []

    print(f"\nProcessing {total} rows in batches of {BATCH_SIZE}...")
    print("-" * 50)

    for batch_start in range(0, total, BATCH_SIZE):
        batch = rows_to_process[batch_start: batch_start + BATCH_SIZE]

        # Build minimal API input
        api_input = []
        for row in batch:
            entry = {
                "index": row["index"],
                "simplified": row["simplified"],
                "traditional": row["traditional"],
            }
            # Include examples if this row needs them translated
            if needs_examples_trad(row):
                try:
                    entry["examples"] = json.loads(str(row["examples"]))
                except Exception:
                    entry["examples"] = []

            # Include wordExamples if this row needs them translated
            if needs_word_examples_trad(row):
                try:
                    entry["wordExamples"] = json.loads(str(row["wordExamples"]))
                except Exception:
                    entry["wordExamples"] = []

            api_input.append(entry)

        chars_preview = ", ".join(r["simplified"] for r in batch)
        batch_num = batch_start // BATCH_SIZE + 1
        total_batches = (total + BATCH_SIZE - 1) // BATCH_SIZE
        print(f"  Batch {batch_num}/{total_batches}  [{chars_preview}]", end=" ", flush=True)

        results = call_api(api_input)

        if results:
            df = apply_results(df, results)
            fixed += len(batch)
            print(f"✓ ({fixed}/{total})")
        else:
            print("retrying...", end=" ", flush=True)
            time.sleep(2)
            results = call_api(api_input)
            if results:
                df = apply_results(df, results)
                fixed += len(batch)
                print(f"✓ ({fixed}/{total})")
            else:
                failed_indices.extend(r["index"] for r in batch)
                print(f"✗ FAILED — indices: {[r['index'] for r in batch]}")

        # Checkpoint every 100 rows
        if (batch_start + BATCH_SIZE) % 100 == 0:
            checkpoint_file = OUTPUT_FILE.replace(".xlsx", "_checkpoint.xlsx")
            df.to_excel(checkpoint_file, index=False)
            print(f"  [checkpoint saved → {checkpoint_file}]")

        time.sleep(DELAY)

    print()
    print("=" * 50)
    df.to_excel(OUTPUT_FILE, index=False)
    print(f"Done! Processed {fixed}/{total} rows.")
    print(f"Saved to: {OUTPUT_FILE}")

    if failed_indices:
        print(f"\n[!] {len(failed_indices)} rows could not be processed:")
        print(f"    Indices: {failed_indices}")
        print("    Tip: re-run on the output file — it will skip already-filled rows.")


if __name__ == "__main__":
    main()
