export type UpdateNoteImportState = {
  audiences: string[];
  importedAudiences: string[];
  syncedAudiences: string[];
};

export type UpdateNoteImportSummary = {
  newSinceImport: number;
  needsSync: number;
  upToDate: number;
};

export function summarizeUpdateImportStates(
  notes: UpdateNoteImportState[]
): UpdateNoteImportSummary {
  return notes.reduce(
    (acc, note) => {
      const missingAudiences = note.audiences.filter(
        (audience) => !note.importedAudiences.includes(audience)
      );
      const needsSync = note.importedAudiences.some(
        (audience) => !note.syncedAudiences.includes(audience)
      );

      if (missingAudiences.length > 0) {
        acc.newSinceImport += 1;
      } else if (needsSync) {
        acc.needsSync += 1;
      } else {
        acc.upToDate += 1;
      }

      return acc;
    },
    { newSinceImport: 0, needsSync: 0, upToDate: 0 }
  );
}
