# pip install pandas openpyxl hanziconv  (if not already installed)

import pandas as pd
from hanziconv import HanziConv   # Excellent simplified ↔ traditional converter

# 1. Load your file
df = pd.read_excel("chinese_characters3.xlsx", sheet_name="chinese_characters")

# 2. Make sure we have the columns we need
if 'examples' not in df.columns:
    print("Column 'examples' not found!")
    # You may need to rename column F to 'examples'

# 3. We'll work on column index 5 (F = examples) → make it proper traditional
#    and create new column G = simplified version

def fix_and_convert_examples(cell):
    if pd.isna(cell) or not isinstance(cell, list) or len(cell) == 0:
        return [], []  # empty → we'll fill below
    
    # For now we just take first sentence as base and generate 3 good ones later
    # In real usage → you would replace this with your own generation logic / GPT batch
    # Here we demonstrate structure only
    
    # Placeholder: pretend we create 3 good sentences (in reality → manual / AI batch)
    base_char = "?"   # you would get this from row['simplified'] or row['traditional']
    
    new_trad_sentences = [
        f"這是含有「{base_char}」的自然句子一。",
        f"他在日常生活中經常使用「{base_char}」。", 
        f"你知道「{base_char}」這個字有很多意思嗎？"
    ]
    
    new_simp_sentences = [HanziConv.toSimplified(s) for s in new_trad_sentences]
    
    return new_trad_sentences, new_simp_sentences


# Apply to every row (this is slow for 3000 rows — better to batch with LLM API)
results = df.apply(
    lambda row: fix_and_convert_examples(row['examples']),
    axis=1
)

# Unpack tuples into two new columns
df['examples_traditional_fixed'] = results.apply(lambda x: x[0])
df['examples_simplified']        = results.apply(lambda x: x[1])

# If you want to overwrite original column F:
# df['examples'] = df['examples_traditional_fixed']

# 4. Save result
df.to_excel("chinese_characters3_cleaned.xlsx", index=False)
print("Saved cleaned file.")
