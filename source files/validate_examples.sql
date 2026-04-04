-- validate_examples.sql
-- Finds every row where at least one example sentence does NOT contain
-- the character it is supposed to illustrate.
--
-- Run:  psql $DATABASE_URL -f validate_examples.sql
--   or: \i validate_examples.sql   (inside psql)

-- ─── 1. examples: sentence must contain `simplified` ─────────────────────────
SELECT
    cc.index,
    cc.simplified,
    cc.traditional,
    'examples' AS field,
    ex->>'chinese' AS sentence
FROM
    chinese_characters cc,
    jsonb_array_elements(cc.examples) AS ex
WHERE
    ex->>'chinese' IS NOT NULL
    AND ex->>'chinese' != ''
    AND position(cc.simplified IN (ex->>'chinese')) = 0

UNION ALL

-- ─── 2. examples_traditional: sentence must contain `traditional` ─────────────
SELECT
    cc.index,
    cc.simplified,
    cc.traditional,
    'examples_traditional' AS field,
    ex->>'chinese' AS sentence
FROM
    chinese_characters cc,
    jsonb_array_elements(cc.examples_traditional) AS ex
WHERE
    cc.examples_traditional IS NOT NULL
    AND ex->>'chinese' IS NOT NULL
    AND ex->>'chinese' != ''
    AND position(cc.traditional IN (ex->>'chinese')) = 0

UNION ALL

-- ─── 3. word_examples: word must contain `simplified` ────────────────────────
SELECT
    cc.index,
    cc.simplified,
    cc.traditional,
    'word_examples' AS field,
    ex->>'word' AS sentence
FROM
    chinese_characters cc,
    jsonb_array_elements(cc.word_examples) AS ex
WHERE
    cc.word_examples IS NOT NULL
    AND ex->>'word' IS NOT NULL
    AND ex->>'word' != ''
    AND position(cc.simplified IN (ex->>'word')) = 0

UNION ALL

-- ─── 4. word_examples_traditional: word must contain `traditional` ────────────
SELECT
    cc.index,
    cc.simplified,
    cc.traditional,
    'word_examples_traditional' AS field,
    ex->>'word' AS sentence
FROM
    chinese_characters cc,
    jsonb_array_elements(cc.word_examples_traditional) AS ex
WHERE
    cc.word_examples_traditional IS NOT NULL
    AND ex->>'word' IS NOT NULL
    AND ex->>'word' != ''
    AND position(cc.traditional IN (ex->>'word')) = 0

ORDER BY index, field;
