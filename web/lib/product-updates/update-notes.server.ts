import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  buildSummaryFromBody,
  parseUpdateNote,
  type ParsedUpdateNote,
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

export type UpdateNoteParseIssue = {
  filename: string;
  error: string;
};

export type ListUpdateNotesResult = {
  notes: UpdateNoteFile[];
  invalidNotes: UpdateNoteParseIssue[];
};

const UPDATES_DIR = path.join(process.cwd(), "docs", "updates");

export async function listUpdateNotes(): Promise<ListUpdateNotesResult> {
  const entries = await fs.readdir(UPDATES_DIR).catch(() => []);
  const files = entries.filter(
    (name) =>
      name.endsWith(".md") &&
      name !== "NO_UPDATE.md" &&
      name !== "README.md" &&
      name !== "_TEMPLATE.md"
  );
  const notes: UpdateNoteFile[] = [];
  const invalidNotes: UpdateNoteParseIssue[] = [];

  for (const filename of files) {
    const fullPath = path.join(UPDATES_DIR, filename);
    try {
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
    } catch (error) {
      invalidNotes.push({
        filename,
        error: error instanceof Error ? error.message : "Unable to parse update note.",
      });
      console.error(
        `[product-updates] invalid update note ${filename}:`,
        error instanceof Error ? error.stack || error.message : error
      );
    }
  }

  return {
    notes: notes.sort((a, b) => a.filename.localeCompare(b.filename)),
    invalidNotes: invalidNotes.sort((a, b) => a.filename.localeCompare(b.filename)),
  };
}

export async function readUpdateNote(filename: string) {
  const safeName = path.basename(filename);
  const fullPath = path.join(UPDATES_DIR, safeName);
  const raw = await fs.readFile(fullPath, "utf-8");
  let parsed: ParsedUpdateNote;
  try {
    parsed = parseUpdateNote(raw);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Invalid note format.";
    throw new Error(`Invalid update note "${safeName}": ${reason}`);
  }
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, parsed, hash, filename: safeName };
}
