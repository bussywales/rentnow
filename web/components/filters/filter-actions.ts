export function createResetDraftAction<T>(
  getApplied: () => T,
  setDraft: (next: T) => void
): () => void {
  return () => {
    setDraft(getApplied());
  };
}

export function createApplyAndCloseAction(onApply: () => void, onClose: () => void): () => void {
  return () => {
    onApply();
    onClose();
  };
}

export function createClearApplyAndCloseAction<T>(
  createDefault: () => T,
  setDraft: (next: T) => void,
  onApply: (next: T) => void,
  onClose: () => void
): () => void {
  return () => {
    const cleared = createDefault();
    setDraft(cleared);
    onApply(cleared);
    onClose();
  };
}
