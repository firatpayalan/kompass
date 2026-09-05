export function createDraftStore() {
  let draft: string | null = null;
  return {
    saveDraft(body: string) {
      draft = body;
    },
    getDraft() {
      return draft;
    },
    clearDraft() {
      draft = null;
    },
  };
}

export type DraftStore = ReturnType<typeof createDraftStore>;
