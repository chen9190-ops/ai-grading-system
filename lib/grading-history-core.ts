export type StoredGradingRecord = { gradingResult?: unknown; aiResult?: unknown; score?: unknown };

export function extractStoredReportWithSelector(record: StoredGradingRecord, select: (outputs: unknown) => string): string {
  return select({ result: record.gradingResult }) || select(record.aiResult);
}

export function normalizeStoredScore(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  const normalized = value > 10 && value <= 100 ? value / 10 : value;
  return normalized <= 10 ? Math.round(normalized * 10) / 10 : null;
}

export function gradingHistoryPath(id: string): string { return `/grading/history/${encodeURIComponent(id)}`; }
export function canAccessGradingRecord(sessionUserId: string, recordUserId: string | null): boolean { return Boolean(recordUserId) && sessionUserId === recordUserId; }
export function gradingHistoryLookupStatus(sessionUserId: string, recordUserId: string | null | undefined): 200 | 403 | 404 {
  if (recordUserId === undefined) return 404;
  return canAccessGradingRecord(sessionUserId, recordUserId) ? 200 : 403;
}
