import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  buildSummaryFromBody,
  parseUpdateNote,
  type UpdateNoteAudience,
} from "@/lib/product-updates/update-notes";

export type UpdateNoteFile = {
  filename: string;
  title: string;
  audiences: UpdateNoteAudience[];
  areas: string[];
  cta_href?: string;
  published_at?: string;
  source_ref?: string;
  body: string;
  summary: string;
  source_hash: string;
};

const UPDATES_DIR = path.join(process.cwd(), "docs", "updates");

export async function listUpdateNotes(): Promise<UpdateNoteFile[]> {
  const entries = await fs.readdir(UPDATES_DIR).catch(() => []);
  const files = entries.filter((name) => name.endsWith(".md") && name !== "NO_UPDATE.md");
  const notes: UpdateNoteFile[] = [];

  for (const filename of files) {
    const fullPath = path.join(UPDATES_DIR, filename);
    const raw = await fs.readFile(fullPath, "utf-8");
    const parsed = parseUpdateNote(raw);
    const hash = crypto.createHash("sha256").update(raw).digest("hex");

    notes.push({
      filename,
      title: parsed.title,
      audiences: parsed.audiences,
      areas: parsed.areas,
      cta_href: parsed.cta_href,
      published_at: parsed.published_at,
      source_ref: parsed.source_ref,
      body: parsed.body,
      summary: parsed.summary || buildSummaryFromBody(parsed.body),
      source_hash: hash,
    });
  }

  return notes.sort((a, b) => a.filename.localeCompare(b.filename));
}

export async function readUpdateNote(filename: string) {
  const safeName = path.basename(filename);
  const fullPath = path.join(UPDATES_DIR, safeName);
  const raw = await fs.readFile(fullPath, "utf-8");
  const parsed = parseUpdateNote(raw);
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, parsed, hash, filename: safeName };
}
