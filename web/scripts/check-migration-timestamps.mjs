import fs from "node:fs";
import path from "node:path";

const migrationsDir = path.resolve(process.cwd(), "supabase", "migrations");
const entries = fs.existsSync(migrationsDir) ? fs.readdirSync(migrationsDir) : [];

const timestampPattern = /^(\d{14})_/;
const seen = new Map();
const duplicates = new Map();

for (const name of entries) {
  const match = name.match(timestampPattern);
  if (!match) continue;
  const timestamp = match[1];
  if (seen.has(timestamp)) {
    const list = duplicates.get(timestamp) ?? [seen.get(timestamp)];
    list.push(name);
    duplicates.set(timestamp, list);
  } else {
    seen.set(timestamp, name);
  }
}

if (duplicates.size > 0) {
  console.error("[migrations] Duplicate timestamps detected:");
  for (const [timestamp, files] of duplicates.entries()) {
    console.error(`- ${timestamp}: ${files.join(", ")}`);
  }
  process.exit(1);
}

console.log(`[migrations] OK (${seen.size} timestamped migrations)`);
