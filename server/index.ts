import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { execSync } from "child_process";
import { registerRoutes } from "./routes";
import { log } from "./log";
import { ensureDataSeeded } from "./autoSeed";
import { serveStatic } from "./static";
import { db } from "./db";
import { sql } from "drizzle-orm";

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // In production, sync the database schema before starting so any new columns
  // added during development are present in the production database.
  if (process.env.NODE_ENV === "production") {
    try {
      // ── Manual migrations (idempotent) applied before db:push ────────────
      // These handle schema changes that drizzle-kit cannot apply non-interactively.

      // 1. Add serial primary key to teacher_students
      await db.execute(sql`ALTER TABLE teacher_students ADD COLUMN IF NOT EXISTS id SERIAL`);
      await db.execute(sql`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name='teacher_students' AND constraint_type='PRIMARY KEY'
          ) THEN ALTER TABLE teacher_students ADD PRIMARY KEY (id); END IF;
        END $$
      `);

      // 2. Remove duplicate lessons then ensure unique index exists
      await db.execute(sql`
        DELETE FROM lessons WHERE id NOT IN (
          SELECT MIN(id) FROM lessons GROUP BY class_id, lesson
        )
      `);
      // Drop the old CONSTRAINT form if it exists (replaced by a unique INDEX)
      await db.execute(sql`ALTER TABLE lessons DROP CONSTRAINT IF EXISTS uq_class_lesson`);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_class_lesson ON lessons (class_id, lesson)
      `);

      // 3. Add teacher_student_id + core to custom_matching; fix unique indexes
      await db.execute(sql`ALTER TABLE custom_matching ADD COLUMN IF NOT EXISTS teacher_student_id INTEGER`);
      await db.execute(sql`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name='custom_matching'
              AND constraint_name='custom_matching_teacher_student_id_teacher_students_id_fk'
          ) THEN
            ALTER TABLE custom_matching ADD CONSTRAINT custom_matching_teacher_student_id_teacher_students_id_fk
              FOREIGN KEY (teacher_student_id) REFERENCES teacher_students(id) ON DELETE CASCADE;
          END IF;
        END $$
      `);
      await db.execute(sql`ALTER TABLE custom_matching ADD COLUMN IF NOT EXISTS core BOOLEAN NOT NULL DEFAULT false`);
      await db.execute(sql`ALTER TABLE custom_matching DROP CONSTRAINT IF EXISTS uq_char_lesson`);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_personal_char_lesson
          ON custom_matching (user_id, character_index, lesson_id)
          WHERE teacher_student_id IS NULL
      `);
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_shared_char_lesson
          ON custom_matching (teacher_student_id, character_index, lesson_id)
          WHERE teacher_student_id IS NOT NULL
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_custom_matching_rel ON custom_matching (teacher_student_id)
      `);
      // ─────────────────────────────────────────────────────────────────────

      log("Syncing database schema…");
      execSync("npm run db:push", { input: "y\n", stdio: ["pipe", "inherit", "inherit"], timeout: 30000 });
      log("Database schema sync complete.");
    } catch (err) {
      log("Database schema sync FAILED — aborting startup: " + String(err));
      process.exit(1);
    }
  }

  // Seed database if empty (supports fresh clones and new deployments)
  await ensureDataSeeded(log);

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
