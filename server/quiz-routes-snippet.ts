// ─────────────────────────────────────────────────────────────────────────────
// QUIZ ROUTES — add these inside registerRoutes(), just before the final:
//   const httpServer = createServer(app);
//   return httpServer;
// ─────────────────────────────────────────────────────────────────────────────
//
// Also add this import at the top of routes.ts:
//   import Anthropic from "@anthropic-ai/sdk";
//
// And add this after the `const upload = ...` line:
//   const anthropic = new Anthropic();
//
// Then run:  npm install @anthropic-ai/sdk
// ─────────────────────────────────────────────────────────────────────────────

  // GET /api/quiz/question?levels=1,2,3
  // Returns a random fill-in-the-blank question from the requested HSK levels
  app.get('/api/quiz/question', isAuthenticated, async (req: any, res) => {
    try {
      const levelsParam = (req.query.levels as string) || "1,2,3";
      const hskLevels = levelsParam
        .split(",")
        .map(Number)
        .filter((n) => !isNaN(n) && n >= 1 && n <= 6);

      if (hskLevels.length === 0) {
        return res.status(400).json({ message: "No valid HSK levels provided" });
      }

      // Pull a random character from the requested levels
      // We fetch a modest pool and pick randomly to avoid loading all 3000
      const POOL_SIZE = 50;
      const result = await storage.getFilteredCharacters(
        req.user.claims.sub,
        Math.floor(Math.random() * 20), // random page within the filtered set
        POOL_SIZE,
        { hskLevels }
      );

      if (result.characters.length === 0) {
        return res.status(404).json({ message: "No characters found for selected levels" });
      }

      // Pick a random character from the pool that has a usable example
      let chosen = null;
      let chosenExample = null;

      const shuffled = result.characters.sort(() => Math.random() - 0.5);
      for (const char of shuffled) {
        const examples = char.examples as { chinese: string; english: string }[];
        const valid = examples?.filter((e) => e.chinese?.includes(char.simplified));
        if (valid && valid.length > 0) {
          chosen = char;
          chosenExample = valid[Math.floor(Math.random() * valid.length)];
          break;
        }
      }

      if (!chosen || !chosenExample) {
        return res.status(404).json({ message: "Could not find a suitable question" });
      }

      const blanked = chosenExample.chinese.replace(chosen.simplified, "＿");

      res.json({
        characterIndex: chosen.index,
        character: chosen.simplified,
        traditional: chosen.traditional,
        pinyin: chosen.pinyin,
        pinyin2: chosen.pinyin2 ?? null,
        definition: Array.isArray(chosen.definition) ? chosen.definition : [chosen.definition],
        hskLevel: chosen.hskLevel,
        sentence: chosenExample.chinese,
        blanked,
        translation: chosenExample.english,
      });
    } catch (error) {
      console.error("Error generating quiz question:", error);
      res.status(500).json({ message: "Failed to generate question" });
    }
  });

  // POST /api/quiz/check
  // Checks the user's answer and returns AI-generated feedback via Claude
  app.post('/api/quiz/check', isAuthenticated, async (req: any, res) => {
    try {
      const { character, answer, blanked, translation, definition, pinyin, hskLevel } = req.body;

      if (!character || !answer) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const isCorrect = answer.trim() === character;
      const fullSentence = blanked.replace("＿", character);

      // Generate feedback with Claude
      const prompt = `A student is studying for HSK ${hskLevel}. They saw this fill-in-the-blank:

Sentence: ${blanked}
English: ${translation}
Correct answer: ${character} (${pinyin}) — ${Array.isArray(definition) ? definition.join(" | ") : definition}
Student answered: "${answer.trim()}"
Result: ${isCorrect ? "CORRECT" : "WRONG"}

Write 2-3 sentences of feedback in English:
- If CORRECT: explain why ${character} fits this context, give one memory tip or usage note
- If WRONG: gently explain the error, clarify what ${character} means here, and if "${answer.trim()}" is a real character briefly say what it means
Keep it concise and encouraging for a language learner.`;

      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{ role: "user", content: prompt }],
      });

      const feedback = (response.content[0] as { text: string }).text.trim();

      res.json({
        correct: isCorrect,
        correctAnswer: character,
        fullSentence,
        feedback,
      });
    } catch (error) {
      console.error("Error checking quiz answer:", error);
      res.status(500).json({ message: "Failed to check answer" });
    }
  });
