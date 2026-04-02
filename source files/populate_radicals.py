"""
Radical Index Population Script
---------------------------------
For each character in the Excel file this script:
1. Asks Claude to identify the correct simplified radical (checks / fixes column K)
2. Asks Claude to identify the correct traditional radical (populates column L)

Radicals are returned as characters, then mapped to index numbers using the
214-radical Kangxi table embedded from server/data/radicals-seed.json.

Requirements:
    pip install anthropic openpyxl pandas

Usage:
    conda activate claudeProject
    export ANTHROPIC_API_KEY=sk-ant-...
    python populate_radicals.py
"""

import os
import json
import time
import re
import unicodedata
import argparse
from datetime import datetime
import pandas as pd
from anthropic import Anthropic

# ── Config ─────────────────────────────────────────────────────────────────────
INPUT_FILE   = "/Users/andrewyong/Downloads/chinese_characters_radicals_v4.xlsx"
OUTPUT_FILE  = "/Users/andrewyong/Downloads/chinese_characters_radicals_v5.xlsx"
RADICALS_FILE = "/Users/andrewyong/Documents/GitHub/Chinese-skills/server/data/radicals-seed.json"
MODEL        = "claude-haiku-4-5-20251001"
MAX_TOKENS   = 4000
BATCH_SIZE   = 20
DELAY        = 0.3

MODEL_PRICING = {
    "claude-haiku-4-5-20251001": (0.80, 4.00),
    "claude-sonnet-4-6":         (3.00, 15.00),
}
# ───────────────────────────────────────────────────────────────────────────────

client = Anthropic()


# ── Build radical lookup tables ─────────────────────────────────────────────────

# Positional/simplified variant forms not listed as primary Kangxi radicals,
# mapped to the canonical Kangxi index they belong to.
RADICAL_VARIANTS: dict[str, int] = {
    # Simplified side-form variants
    "纟": 120,  # silk side (simplified) → 糸
    "讠": 149,  # speech side (simplified) → 言
    "钅": 167,  # metal side (simplified) → 金
    "饣": 184,  # food side (simplified) → 食
    # Positional variants shared by simplified and traditional
    "亻": 9,    # person side → 人
    "扌": 64,   # hand side → 手
    "氵": 85,   # water side → 水
    "灬": 86,   # fire bottom → 火
    "爫": 87,   # claw top → 爪
    "礻": 113,  # spirit side → 示
    "罒": 122,  # net top/flat → 网
    "阝": 170,  # mound/city side → 阜 (170 for left-side; right-side is 邑 163, but 170 is more common)
    "攵": 66,   # rap/knock → 攴
    # Characters used as radical proxies in some classification systems
    "王": 96,   # jade side → 玉 (王 appears on left in 现、环、班 etc.)
    "母": 80,   # mother → 毋
    "旡": 71,   # already/without → 无 (closest match)
    # Cases where Claude returned the wrong character or the full character itself
    "夜": 36,   # 多's radical is 夕; Claude confused 夕 (dusk) with 夜 (night)
    "乾": 5,    # traditional 乾 → 乙
    "世": 1,    # 世 → 一
    "民": 83,   # 民 → 氏
    "值": 9,    # 值 → 亻 (person side); Claude returned full character
    "丽": 1,    # simplified 丽 → 一
    "麗": 198,  # traditional 麗 → 鹿
    "丈": 1,    # 丈 → 一
    "卷": 26,   # 卷 → 卩
    "巳": 49,   # Claude returned 巳 for 巴 → 己
    "巴": 49,   # Claude returned 巴 itself → 己
    "廿": 1,    # Claude returned 廿 for 世 → 一
    "井": 7,    # 井 → 二
    "丙": 1,    # 丙 → 一
    "卵": 26,   # 卵 → 卩
    "丘": 1,    # 丘 → 一
}


def load_radicals(path: str):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    # Prefer mainIndex == 1 entries (primary forms over alternative forms)
    simp_to_index: dict[str, int] = {}
    trad_to_index: dict[str, int] = {}

    # First pass: primary forms only (NFC-normalised keys)
    for r in data:
        if r["mainIndex"] == 1:
            simp_to_index[unicodedata.normalize("NFC", r["simplified"])] = r["index"]
            trad_to_index[unicodedata.normalize("NFC", r["traditional"])] = r["index"]

    # Second pass: fill in alternative forms where not already mapped
    for r in data:
        sk = unicodedata.normalize("NFC", r["simplified"])
        tk = unicodedata.normalize("NFC", r["traditional"])
        if sk not in simp_to_index:
            simp_to_index[sk] = r["index"]
        if tk not in trad_to_index:
            trad_to_index[tk] = r["index"]

    return data, simp_to_index, trad_to_index


def _normalize(char: str) -> str:
    return unicodedata.normalize("NFC", char.strip())


def lookup_simp_radical_index(char: str, simp_to_index: dict, trad_to_index: dict) -> int | None:
    c = _normalize(char)
    return simp_to_index.get(c) or trad_to_index.get(c) or RADICAL_VARIANTS.get(c)


def lookup_trad_radical_index(char: str, trad_to_index: dict, simp_to_index: dict) -> int | None:
    c = _normalize(char)
    return trad_to_index.get(c) or simp_to_index.get(c) or RADICAL_VARIANTS.get(c)


# ── Build the radical reference string for the prompt ───────────────────────────

def build_radical_reference(radicals_data: list) -> str:
    lines = []
    for r in radicals_data:
        if r["mainIndex"] == 1:
            simp = r["simplified"]
            trad = r["traditional"]
            label = f"{simp}" if simp == trad else f"{simp}/{trad}"
            lines.append(f"  {r['index']:3d}. {label} ({r['pinyin']})")
    return "\n".join(lines)


# ── Prompt ──────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a Chinese linguistics expert specialising in Kangxi radicals.

CRITICAL: Simplified and traditional Chinese characters often have COMPLETELY DIFFERENT radicals.
You must look up each form independently — never assume the traditional form has the same radical as the simplified form.

Example of different radicals:
- 从 (simplified) → radical 人 (rén, index 9)
- 從 (traditional) → radical 彳 (chì, index 60)

For each pair provided:
1. Look up the SIMPLIFIED character and identify its Kangxi radical — return the simplified form of that radical
2. Look up the TRADITIONAL character independently and identify its Kangxi radical — return the traditional form of that radical

Rules:
- Use standard Kangxi radical classification
- Return the exact radical character from the reference list
- Always respond with ONLY a valid JSON array — no markdown, no explanation"""


def build_prompt(batch: list[dict], radical_reference: str) -> str:
    return f"""For each row, identify the Kangxi radical of the SIMPLIFIED character and the Kangxi radical of the TRADITIONAL character independently.

The simplified and traditional forms may have completely different radicals — look each one up separately.

Kangxi radical reference (index. simplified/traditional form):
{radical_reference}

Characters to process:
{json.dumps(batch, ensure_ascii=False, indent=2)}

Return a JSON array, one object per character, in the same order:
[
  {{
    "index": <row index>,
    "simplified": "<simplified character>",
    "traditional": "<traditional character>",
    "simplified_radical": "<radical of the SIMPLIFIED character, in its simplified form>",
    "traditional_radical": "<radical of the TRADITIONAL character, in its traditional form>"
  }},
  ...
]"""


def call_api(batch: list[dict], radical_reference: str) -> list[dict] | None:
    prompt = build_prompt(batch, radical_reference)
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


# ── Apply results ────────────────────────────────────────────────────────────────

def apply_results(df: pd.DataFrame, results: list[dict],
                  simp_to_index: dict, trad_to_index: dict,
                  corrections: list, unknowns: list) -> pd.DataFrame:
    df = df.copy()
    for item in results:
        idx = item.get("index")
        if idx is None:
            continue
        mask = df["index"] == idx
        if not mask.any():
            continue
        row_pos = df[mask].index[0]

        simp_radical_char = item.get("simplified_radical", "").strip()
        trad_radical_char = item.get("traditional_radical", "").strip()

        # Resolve radical characters to indices
        simp_idx = lookup_simp_radical_index(simp_radical_char, simp_to_index, trad_to_index)
        trad_idx = lookup_trad_radical_index(trad_radical_char, trad_to_index, simp_to_index)

        if simp_idx is None:
            unknowns.append({"index": idx, "char": item["simplified"], "radical": simp_radical_char, "type": "simplified"})
        else:
            old_val = df.at[row_pos, "radicalIndex"]
            old_idx = None if (pd.isna(old_val) or old_val == "") else int(old_val)
            if old_idx != simp_idx:
                corrections.append({
                    "index": idx,
                    "char": item["simplified"],
                    "old_radicalIndex": old_idx,
                    "new_radicalIndex": simp_idx,
                    "radical_char": simp_radical_char,
                })
            df.at[row_pos, "radicalIndex"] = str(simp_idx)

        if trad_idx is None:
            unknowns.append({"index": idx, "char": item.get("traditional", ""), "radical": trad_radical_char, "type": "traditional"})
        else:
            df.at[row_pos, "radicalIndexTraditional"] = str(trad_idx)

    return df


# ── Logging ──────────────────────────────────────────────────────────────────────

def make_log_path() -> str:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    return OUTPUT_FILE.replace(".xlsx", f"_debug_{ts}.txt")


class Logger:
    def __init__(self, path: str):
        self.path = path
        self._f = open(path, "w", encoding="utf-8")
        self._f.write(f"populate_radicals.py  —  {datetime.now().isoformat()}\n")
        self._f.write("=" * 60 + "\n\n")

    def log(self, msg: str):
        print(msg)
        self._f.write(msg + "\n")
        self._f.flush()

    def close(self):
        self._f.close()


# ── Main ─────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Populate radicalIndex and radicalIndexTraditional columns")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--force-restart", action="store_true",
                      help="Process all rows, overwriting any existing values")
    mode.add_argument("--skip-filled", action="store_true",
                      help="Skip rows where radicalIndexTraditional already has a value")
    args = parser.parse_args()

    # Default behaviour (neither flag): process all rows (same as --force-restart)
    skip_filled = args.skip_filled

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: Set your ANTHROPIC_API_KEY environment variable first.")
        return

    log_path = make_log_path()
    logger = Logger(log_path)
    logger.log(f"Mode: {'skip-filled' if skip_filled else 'force-restart (process all)'}")
    logger.log(f"Debug log: {log_path}\n")

    logger.log(f"Loading radicals from {RADICALS_FILE}...")
    radicals_data, simp_to_index, trad_to_index = load_radicals(RADICALS_FILE)
    radical_reference = build_radical_reference(radicals_data)
    logger.log(f"  Loaded {len(radicals_data)} radicals\n")

    logger.log(f"Loading {INPUT_FILE}...")
    df = pd.read_excel(INPUT_FILE)
    logger.log(f"  Loaded {len(df)} rows\n")

    # Ensure columns are string-typed
    for col in ("radicalIndex", "radicalIndexTraditional"):
        if col not in df.columns:
            df[col] = ""
        df[col] = df[col].where(df[col].notna(), other="").astype(str).replace("nan", "")

    all_rows = df.to_dict("records")

    if skip_filled:
        rows_to_process = [
            r for r in all_rows
            if str(r.get("radicalIndexTraditional", "")).strip() == ""
        ]
        logger.log(f"--skip-filled: {len(all_rows) - len(rows_to_process)} rows already filled, {len(rows_to_process)} to process")
    else:
        rows_to_process = all_rows
        logger.log(f"Processing all {len(rows_to_process)} rows")

    total = len(rows_to_process)
    if total == 0:
        logger.log("Nothing to do.")
        logger.close()
        return

    input_price, output_price = MODEL_PRICING.get(MODEL, (0.80, 4.00))
    estimated_cost = total * (300 * input_price + 150 * output_price) / 1_000_000
    logger.log(f"\nModel: {MODEL}")
    logger.log(f"Rows to process: {total}")
    logger.log(f"Estimated API cost: ~${estimated_cost:.2f} USD")
    confirm = input("Proceed? (y/n): ").strip().lower()
    if confirm != "y":
        logger.log("Aborted.")
        logger.close()
        return

    corrections = []
    unknowns = []
    failed_indices = []
    processed = 0

    logger.log(f"\nProcessing {total} rows in batches of {BATCH_SIZE}...")
    logger.log("-" * 60)

    for batch_start in range(0, total, BATCH_SIZE):
        batch = rows_to_process[batch_start: batch_start + BATCH_SIZE]

        api_input = [{
            "index": row["index"],
            "simplified": str(row["simplified"]),
            "traditional": str(row["traditional"]),
            "pinyin": str(row["pinyin"]),
        } for row in batch]

        chars_preview = "".join(r["simplified"] for r in batch[:10])
        batch_num = batch_start // BATCH_SIZE + 1
        total_batches = (total + BATCH_SIZE - 1) // BATCH_SIZE
        status_prefix = f"  Batch {batch_num}/{total_batches}  [{chars_preview}…]"
        print(status_prefix, end=" ", flush=True)
        self_log_line = status_prefix + " "

        results = call_api(api_input, radical_reference)

        if results:
            # Log raw API output for debugging
            logger._f.write(f"\n--- Batch {batch_num} raw results ---\n")
            for item in results:
                sr = item.get("simplified_radical", "")
                tr = item.get("traditional_radical", "")
                logger._f.write(
                    f"  [{item.get('index')}] {item.get('simplified')}/{item.get('traditional')}"
                    f"  simp_radical={sr!r} (U+{ord(sr):04X} if 1 char)"
                    f"  trad_radical={tr!r} (U+{ord(tr):04X} if 1 char)\n"
                    if sr and tr and len(sr) == 1 and len(tr) == 1
                    else f"  [{item.get('index')}] {item.get('simplified')}/{item.get('traditional')}"
                         f"  simp_radical={sr!r}  trad_radical={tr!r}\n"
                )
            logger._f.flush()

            df = apply_results(df, results, simp_to_index, trad_to_index, corrections, unknowns)
            processed += len(batch)
            msg = f"✓ ({processed}/{total})"
        else:
            print("retrying...", end=" ", flush=True)
            time.sleep(2)
            results = call_api(api_input, radical_reference)
            if results:
                df = apply_results(df, results, simp_to_index, trad_to_index, corrections, unknowns)
                processed += len(batch)
                msg = f"✓ retry ok ({processed}/{total})"
            else:
                failed_indices.extend(r["index"] for r in batch)
                msg = f"✗ FAILED — indices: {[r['index'] for r in batch]}"

        print(msg)
        logger._f.write(self_log_line + msg + "\n")
        logger._f.flush()

        # Checkpoint every 200 rows
        if (batch_start + BATCH_SIZE) % 200 == 0:
            checkpoint = OUTPUT_FILE.replace(".xlsx", "_checkpoint.xlsx")
            df.to_excel(checkpoint, index=False)
            logger.log(f"  [checkpoint → {checkpoint}]")

        time.sleep(DELAY)

    logger.log("\n" + "=" * 60)
    # Convert radical index columns from float notation (60.0) to clean integers (60)
    for col in ("radicalIndex", "radicalIndexTraditional"):
        if col in df.columns:
            def clean_index(v):
                s = str(v).strip()
                if s in ("", "nan"):
                    return ""
                try:
                    return str(int(float(s)))
                except (ValueError, TypeError):
                    return s
            df[col] = df[col].apply(clean_index)

    df.to_excel(OUTPUT_FILE, index=False)
    logger.log(f"Done! Processed {processed}/{total} rows.")
    logger.log(f"Saved to: {OUTPUT_FILE}")

    if corrections:
        logger.log(f"\n{len(corrections)} radicalIndex corrections made:")
        for c in corrections:
            logger.log(f"  [{c['index']}] {c['char']}: {c['old_radicalIndex']} → {c['new_radicalIndex']} ({c['radical_char']})")

    if unknowns:
        logger.log(f"\n{len(unknowns)} radicals could not be resolved to an index:")
        for u in unknowns:
            sr = u['radical']
            codepoints = " ".join(f"U+{ord(c):04X}" for c in sr) if sr else "empty"
            logger.log(f"  [{u['index']}] {u['char']} ({u['type']}): {sr!r} [{codepoints}] not found in radicals table")

    if failed_indices:
        logger.log(f"\n{len(failed_indices)} rows failed — re-run with --skip-filled to retry only those.")

    logger.log(f"\nFull debug log written to: {log_path}")
    logger.close()


if __name__ == "__main__":
    main()
