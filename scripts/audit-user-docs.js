/**
 * A.1 — READ-ONLY audit of the `users` collection.
 *
 * Reports, per user doc: id, estimated size, and the count of any old-format
 * root arrays that belong in a subcollection. In this data model the only such
 * field is `goal.completionLog[]` (the in-doc XP breakdown added in Layer 0.2
 * and removed in Layer 2). `goal.completions[]` is current-format and stays in
 * the root doc by design — it is reported for size context only, NOT as a
 * migration target.
 *
 * Performs NO writes. Run: node scripts/audit-user-docs.js
 */
import { initAdmin } from "./_admin.js";
import { estimateDocBytes } from "../src/gamification/docsize.js";

function inspectDoc(data) {
  let completionLogEntries = 0;
  let completionLogGoals = 0;
  let completionsEntries = 0;
  for (const level of data.levels || []) {
    for (const goal of level.goals || []) {
      if (Array.isArray(goal.completionLog) && goal.completionLog.length) {
        completionLogGoals += 1;
        completionLogEntries += goal.completionLog.length;
      }
      if (Array.isArray(goal.completions)) completionsEntries += goal.completions.length;
    }
  }
  return { completionLogEntries, completionLogGoals, completionsEntries };
}

async function main() {
  const db = initAdmin();
  const snap = await db.collection("users").get();

  let inspected = 0;
  let withOldFormat = 0;
  let totalOldEntries = 0;
  let maxBytes = 0;
  let maxBytesUid = null;
  const offenders = [];

  for (const doc of snap.docs) {
    inspected += 1;
    const data = doc.data();
    const bytes = estimateDocBytes(data);
    if (bytes > maxBytes) { maxBytes = bytes; maxBytesUid = doc.id; }

    const { completionLogEntries, completionLogGoals, completionsEntries } = inspectDoc(data);
    if (completionLogEntries > 0) {
      withOldFormat += 1;
      totalOldEntries += completionLogEntries;
      offenders.push({ uid: doc.id, bytes, completionLogEntries, completionLogGoals, completionsEntries, over1mb: bytes > 1_048_576 });
    }
  }

  const fmt = (n) => n.toLocaleString("en-US");
  console.log("level'd — user document audit (READ-ONLY)");
  console.log("─".repeat(52));
  console.log(`inspected:                              ${fmt(inspected)} docs`);
  console.log(`old-format (root completionLog[]):      ${fmt(withOldFormat)} docs`);
  console.log(`total completionLog entries to migrate: ${fmt(totalOldEntries)}`);
  console.log(`max doc size:                           ${fmt(maxBytes)} bytes${maxBytesUid ? ` (uid ${maxBytesUid})` : ""}`);
  console.log("─".repeat(52));

  if (offenders.length === 0) {
    console.log("✓ No old-format arrays found — Layer 2 was clean from the start.");
    console.log("  A.2 migration is NOT needed.");
  } else {
    console.log("Docs needing migration (A.2):");
    for (const o of offenders) {
      console.log(`  ${o.uid} — ${o.completionLogEntries} completionLog entr${o.completionLogEntries === 1 ? "y" : "ies"} across ${o.completionLogGoals} goal(s), ${fmt(o.bytes)} bytes${o.over1mb ? "  [OVER 1MB — manual follow-up]" : ""}`);
    }
  }
  console.log("");
  console.log(`completion timestamps in root (current-format, informational): not migrated`);
}

main().then(() => process.exit(0)).catch((e) => { console.error("audit failed:", e.message); process.exit(1); });
