export function validateRequestNote(note: unknown): { ok: boolean; message?: string } {
  if (typeof note !== "string" || !note.trim()) {
    return { ok: false, message: "Message to host is required." };
  }
  if (note.trim().length < 5) {
    return { ok: false, message: "Message must be at least 5 characters." };
  }
  return { ok: true };
}
