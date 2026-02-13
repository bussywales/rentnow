import { isProductUpdateAudience } from "@/lib/product-updates/audience";
import {
  listUpdateNotes,
  type ListUpdateNotesResult,
  type UpdateNoteFile,
} from "@/lib/product-updates/update-notes.server";
import { mapUpdateAudiencesToProductAudiences } from "@/lib/product-updates/update-notes";

type SyncClient = {
  from: (table: string) => {
    select: (query: string) => {
      eq: (column: string, value: unknown) => {
        eq: (column: string, value: unknown) => {
          maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>;
        };
      };
    };
    update: (payload: Record<string, unknown>) => {
      eq: (column: string, value: unknown) => Promise<{ error: unknown }>;
    };
    insert: (payload: Record<string, unknown>) => Promise<{ error: unknown }>;
  };
};

export type ProductUpdatesSyncSummary = {
  created: number;
  updated: number;
  unchanged: number;
  skippedInvalid: number;
  processedNotes: number;
  invalidNotes: Array<{ filename: string; error: string }>;
};

export type SyncProductUpdatesDeps = {
  listUpdateNotes: () => Promise<ListUpdateNotesResult>;
};

const defaultDeps: SyncProductUpdatesDeps = {
  listUpdateNotes,
};

function buildNotePayload(note: UpdateNoteFile) {
  return {
    title: note.title.trim(),
    summary: note.summary.trim(),
    body: note.body.trim() || null,
    source_ref: note.filename,
    source_hash: note.source_hash,
  };
}

async function upsertAudienceDraft({
  client,
  note,
  audience,
  actorId,
}: {
  client: SyncClient;
  note: UpdateNoteFile;
  audience: string;
  actorId: string | null;
}): Promise<"created" | "updated" | "unchanged"> {
  const { data: existing, error: existingError } = await client
    .from("product_updates")
    .select("id, source_hash, published_at")
    .eq("source_ref", note.filename)
    .eq("audience", audience)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing?.id && existing.source_hash === note.source_hash) {
    return "unchanged";
  }

  const payload = buildNotePayload(note);

  if (existing?.id) {
    const { error } = await client
      .from("product_updates")
      .update({
        ...payload,
        published_at: existing.published_at ?? null,
      })
      .eq("id", existing.id);
    if (error) throw error;
    return "updated";
  }

  const { error } = await client.from("product_updates").insert({
    ...payload,
    audience,
    published_at: null,
    created_by: actorId,
  });
  if (error) throw error;
  return "created";
}

export async function syncProductUpdateDraftsFromDocs({
  client,
  actorId,
  deps = defaultDeps,
}: {
  client: SyncClient;
  actorId: string | null;
  deps?: SyncProductUpdatesDeps;
}): Promise<ProductUpdatesSyncSummary> {
  const listed = await deps.listUpdateNotes();

  const summary: ProductUpdatesSyncSummary = {
    created: 0,
    updated: 0,
    unchanged: 0,
    skippedInvalid: listed.invalidNotes.length,
    processedNotes: 0,
    invalidNotes: [...listed.invalidNotes],
  };

  for (const note of listed.notes) {
    const mappedAudiences = mapUpdateAudiencesToProductAudiences(note.audiences).filter(
      isProductUpdateAudience
    );

    if (!mappedAudiences.length || note.areas.length === 0) {
      summary.skippedInvalid += 1;
      summary.invalidNotes.push({
        filename: note.filename,
        error: !mappedAudiences.length
          ? "No valid audiences after mapping."
          : "Missing required areas in frontmatter.",
      });
      continue;
    }

    summary.processedNotes += 1;

    for (const audience of mappedAudiences) {
      const outcome = await upsertAudienceDraft({
        client,
        note,
        audience,
        actorId,
      });

      if (outcome === "created") summary.created += 1;
      if (outcome === "updated") summary.updated += 1;
      if (outcome === "unchanged") summary.unchanged += 1;
    }
  }

  return summary;
}
