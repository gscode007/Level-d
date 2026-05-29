/**
 * A.2 — Idempotent migration of old-format root arrays to a subcollection.
 *
 * Target (confirmed by the A.1 audit): stray `goal.completionLog[]` entries —
 * the in-doc XP breakdown added in Layer 0.2 and removed in Layer 2. Each entry
 * moves to the `users/{uid}/xpAudit` subcollection, then the root completionLog
 * field is cleared. `goal.completions[]` is current-format and is NOT touched.
 *
 * Modes (one is required — never executes by default):
 *   node scripts/migrate-completions.js --dry-run    # read-only preview
 *   node scripts/migrate-completions.js --execute     # apply
 *
 * Idempotent (re-run = identical state), skip-not-error on already-migrated
 * docs, continue-on-error per doc. The transactional move logic lives in
 * src/server/migrate.js (unit-tested). See HARDENING.md.
 */
import { initAdmin } from "./_admin.js";
import { estimateDocBytes, FIRESTORE_DOC_LIMIT_BYTES } from "../src/gamification/docsize.js";
import { collectCompletionLog, migrateUserDoc, MAX_TX_ENTRIES } from "../src/server/migrate.js";

function parseMode() {
  const args = process.argv.slice(2);
  if (args.includes("--execute")) return "execute";
  if (args.includes("--dry-run")) return "dry-run";
  console.error("Refusing to run: pass --dry-run (preview) or --execute (apply).");
  process.exit(2);
}

async function main() {
  const mode = parseMode();
  const db = initAdmin();
  const snap = await db.collection("users").get();

  let skipped = 0, migrated = 0, errors = 0, special = 0, totalMoved = 0, totalAlready = 0;

  console.log(`level'd — completionLog migration [${mode.toUpperCase()}]`);
  console.log("─".repeat(52));

  for (const doc of snap.docs) {
    const uid = doc.id;
    try {
      const data = doc.data();
      const entries = collectCompletionLog(data);

      if (entries.length === 0) { console.log(`[SKIP] ${uid} — no old-format arrays`); skipped += 1; continue; }

      if (estimateDocBytes(data) > FIRESTORE_DOC_LIMIT_BYTES) {
        console.log(`[SPECIAL] ${uid} — doc exceeds 1MB; cannot migrate in one transaction → manual follow-up`);
        special += 1; continue;
      }
      if (entries.length > MAX_TX_ENTRIES) {
        console.log(`[SPECIAL] ${uid} — ${entries.length} entries exceed the single-transaction limit → manual follow-up`);
        special += 1; continue;
      }

      if (mode === "dry-run") {
        console.log(`[DRY-RUN] ${uid} — would move ${entries.length} entr${entries.length === 1 ? "y" : "ies"} to xpAudit and clear root completionLog`);
        totalMoved += entries.length; continue;
      }

      const { moved, alreadyPresent } = await migrateUserDoc(db, uid);
      console.log(`[MIGRATED] ${uid} — ${moved} entries moved${alreadyPresent ? ` (${alreadyPresent} already present, skipped)` : ""}`);
      migrated += 1; totalMoved += moved; totalAlready += alreadyPresent;
    } catch (e) {
      console.log(`[ERROR] ${uid} — ${e.message}`);
      errors += 1;
    }
  }

  console.log("─".repeat(52));
  if (mode === "dry-run") {
    console.log(`dry-run: ${skipped} skipped, ${special} special, ${totalMoved} entries WOULD move. No writes performed.`);
  } else {
    console.log(`execute: ${migrated} migrated, ${skipped} skipped, ${special} special, ${errors} errors, ${totalMoved} entries moved (${totalAlready} already present).`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error("migration failed:", e.message); process.exit(1); });
