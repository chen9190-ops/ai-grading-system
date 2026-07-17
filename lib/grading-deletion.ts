export function gradingDeleteApiPath(id: string): string {
  return `/api/grading-history/${encodeURIComponent(id)}`;
}

export function canDeleteGradingRecord(
  sessionUserId: string,
  recordUserId: string | null,
): boolean {
  return Boolean(recordUserId) && sessionUserId === recordUserId;
}

export function gradingDeletionStatus(
  sessionUserId: string,
  recordUserId: string | null | undefined,
): 200 | 403 | 404 {
  if (recordUserId === undefined) return 404;
  return canDeleteGradingRecord(sessionUserId, recordUserId) ? 200 : 403;
}

export function removeGradingRecord<T extends { id: string }>(
  items: T[],
  id: string,
): T[] {
  return items.filter((item) => item.id !== id);
}

export function isExclusiveAssetReference(referenceCount: number): boolean {
  return referenceCount === 1;
}

export function gradingAssetFilename(storedUrl: string | null): string | null {
  if (!storedUrl) return null;
  const filename = new URL(storedUrl, "http://local").searchParams.get("asset");
  return filename && /^[0-9a-f-]+\.(?:jpg|png)$/i.test(filename) ? filename : null;
}
