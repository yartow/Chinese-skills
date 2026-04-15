/**
 * Offline progress queue for brief connectivity drops.
 *
 * Two separate queues mirror the two server endpoints:
 *   - patchQueue  → PATCH /api/progress/:index   (quiz correct-answer saves)
 *   - postQueue   → POST  /api/progress            (daily/standard view toggles)
 *
 * Both are flushed automatically 1 s after the browser reports it is back online,
 * giving the connection a moment to stabilise.
 *
 * The optimistic UI updates (setQueryData) already happened before enqueue, so
 * the user sees correct state throughout — the queue just makes the server catch up.
 */

// ── Patch queue (quiz saves — one field at a time) ────────────────────────────

interface PatchEntry {
  characterIndex: number;
  field: "reading" | "writing";
}

const patchQueue: PatchEntry[] = [];

/** Queue a quiz correct-answer save to retry when back online. */
export function enqueuePatch(characterIndex: number, field: "reading" | "writing") {
  // Deduplicate: one entry per character+field combination
  const exists = patchQueue.some(
    (e) => e.characterIndex === characterIndex && e.field === field
  );
  if (!exists) patchQueue.push({ characterIndex, field });
}

async function flushPatchQueue() {
  if (patchQueue.length === 0) return;
  const items = patchQueue.splice(0);
  for (const item of items) {
    try {
      const res = await fetch(`/api/progress/${item.characterIndex}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [item.field]: true }),
        credentials: "include",
      });
      if (!res.ok) patchQueue.push(item); // server error — keep for next flush
    } catch {
      patchQueue.push(item); // still offline — keep for next flush
    }
  }
}

// ── Post queue (daily/standard view — full progress state) ────────────────────

interface PostEntry {
  characterIndex: number;
  reading: boolean;
  writing: boolean;
  radical: boolean;
}

const postQueue: PostEntry[] = [];

/** Queue a full progress save (from daily/standard view toggles) to retry when back online. */
export function enqueuePost(entry: PostEntry) {
  // Last write wins per character — replace any existing entry
  const idx = postQueue.findIndex((e) => e.characterIndex === entry.characterIndex);
  if (idx >= 0) {
    postQueue[idx] = entry;
  } else {
    postQueue.push({ ...entry });
  }
}

async function flushPostQueue() {
  if (postQueue.length === 0) return;
  const items = postQueue.splice(0);
  for (const item of items) {
    try {
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
        credentials: "include",
      });
      if (!res.ok) postQueue.push(item);
    } catch {
      postQueue.push(item);
    }
  }
}

// ── Auto-flush on reconnect ───────────────────────────────────────────────────

window.addEventListener("online", () => {
  setTimeout(() => {
    flushPatchQueue();
    flushPostQueue();
  }, 1000);
});
