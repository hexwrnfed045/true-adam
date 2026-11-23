import type { ApplicationType, Photo } from "@/types/api";

export type ApplicationDraft = {
  selection: string;
  modelId: string;
  personalValues: Record<string, string>;
  savedSelections: Partial<Record<ApplicationType, Photo[]>>;
  photos: File[];
  projectDate: string;
  projectType: string;
};

// Keep drafts in the current tab's memory so returning via browser history
// restores the form without writing contact details or files to disk.
const drafts = new Map<string, ApplicationDraft>();
let owner: string | null = null;

export function setApplicationDraftOwner(userId: string | null) {
  if (owner === userId) return;
  owner = userId;
  drafts.clear();
}

export function getApplicationDraft(userId: string | undefined, key: string) {
  return userId && userId === owner ? drafts.get(key) : undefined;
}

export function saveApplicationDraft(userId: string | undefined, key: string, draft: ApplicationDraft | null) {
  if (!userId || userId !== owner) return;
  if (draft) drafts.set(key, draft);
  else drafts.delete(key);
}
