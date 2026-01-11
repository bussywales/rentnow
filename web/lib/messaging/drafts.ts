export const DRAFT_STORAGE_PREFIX = "rentnow:msg:draft:";

export function buildDraftStorageKey(threadId: string): string {
  return `${DRAFT_STORAGE_PREFIX}${threadId}`;
}

export function shouldPersistDraft(body: string): boolean {
  return body.trim().length > 0;
}
