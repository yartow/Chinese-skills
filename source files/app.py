"""
HSK Fill-in-the-Blank Quiz App
--------------------------------
Backend: Flask + Anthropic API
Frontend: quiz.html (served from /static)

Install:  pip install flask anthropic openpyxl pandas
Run:      python app.py
"""

import os, json, random, re
import pandas as pd
from flask import Flask, jsonify, request, send_from_directory
from anthropic import Anthropic

app = Flask(__name__, static_folder="static")
client = Anthropic()

# ── Load data once at startup ────────────────────────────────────────────────
EXCEL_FILE = "chinese_characters_enriched.xlsx"

def load_data():
    df = pd.read_excel(EXCEL_FILE)
    # Clean nan strings
    for col in ["pinyin2", "numberedPinyin2", "traditionalVariants"]:
        if col in df.columns:
            df[col] = df[col].apply(lambda v: None if str(v).strip().lower() == "nan" else v)
    return df

df = load_data()

def get_characters(hsk_levels: list[int]) -> pd.DataFrame:
    if not hsk_levels:
        return df
    return df[df["hskLevel"].isin(hsk_levels)]

def parse_examples(ex_str) -> list[dict]:
    try:
        return json.loads(ex_str)
    except Exception:
        return []


# ── Routes ───────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return send_from_directory("static", "quiz.html")

@app.route("/api/question", methods=["GET"])
def get_question():
    """Return a random fill-in-the-blank question."""
    levels = request.args.get("levels", "1,2,3")
    try:
        hsk_levels = [int(x) for x in levels.split(",") if x.strip()]
    except ValueError:
        hsk_levels = [1, 2, 3]

    pool = get_characters(hsk_levels)
    if pool.empty:
        return jsonify({"error": "No characters found for selected levels"}), 400

    # Pick a random character that has usable examples
    for _ in range(20):  # max attempts to find a good row
        row = pool.sample(1).iloc[0]
        examples = parse_examples(row["examples"])
        # Find an example where the character appears in the sentence
        valid = [e for e in examples if row["simplified"] in e.get("chinese", "")]
        if valid:
            break
    else:
        return jsonify({"error": "Could not find a suitable question"}), 500

    example = random.choice(valid)
    sentence = example["chinese"]
    translation = example["english"]
    char = row["simplified"]

    # Replace first occurrence of character with blank
    blanked = sentence.replace(char, "＿", 1)

    return jsonify({
        "character": char,
        "pinyin": row["pinyin"],
        "pinyin2": row.get("pinyin2") if pd.notna(row.get("pinyin2")) else None,
        "definition": row["definition"],
        "hskLevel": int(row["hskLevel"]),
        "sentence": sentence,
        "blanked": blanked,
        "translation": translation,
        "traditional": row["traditional"],
    })


@app.route("/api/check", methods=["POST"])
def check_answer():
    """Check user's answer and return AI feedback."""
    data = request.json
    character   = data.get("character", "")
    user_answer = data.get("answer", "").strip()
    blanked     = data.get("blanked", "")
    translation = data.get("translation", "")
    definition  = data.get("definition", "")
    pinyin      = data.get("pinyin", "")

    is_correct = user_answer == character

    # Build the full sentence back for feedback
    full_sentence = blanked.replace("＿", character, 1)

    # Get AI explanation
    prompt = f"""A student is learning Chinese (HSK exam prep). They were shown this fill-in-the-blank:

Sentence: {blanked}
English meaning: {translation}
Correct answer: {character} ({pinyin}) — {definition}
Student answered: "{user_answer}"
Correct: {"YES" if is_correct else "NO"}

Give a short, encouraging response (2-3 sentences max):
- If correct: briefly explain WHY this character fits here and give one memory tip
- If wrong: gently explain the mistake, clarify what {character} means in this context, and what "{user_answer}" means if it's a real character

Keep it concise and useful for an HSK 3 learner. Respond in English."""

    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=200,
            messages=[{"role": "user", "content": prompt}]
        )
        feedback = response.content[0].text.strip()
    except Exception as e:
        feedback = f"{'Correct!' if is_correct else 'Not quite.'} The answer is {character} ({pinyin}): {definition}"

    return jsonify({
        "correct": is_correct,
        "correctAnswer": character,
        "fullSentence": full_sentence,
        "feedback": feedback,
    })


@app.route("/api/stats", methods=["GET"])
def get_stats():
    """Return character count per HSK level."""
    stats = df.groupby("hskLevel").size().to_dict()
    return jsonify({int(k): int(v) for k, v in stats.items()})


if __name__ == "__main__":
    print(f"Loaded {len(df)} characters from {EXCEL_FILE}")
    app.run(host="0.0.0.0", port=8080, debug=False)
