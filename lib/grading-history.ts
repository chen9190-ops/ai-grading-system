import { selectGradingReport } from "@/lib/grading-report";
import { extractStoredReportWithSelector, type StoredGradingRecord } from "@/lib/grading-history-core";
export { canAccessGradingRecord, gradingHistoryPath, normalizeStoredScore } from "@/lib/grading-history-core";

export function extractStoredGradingReport(record: StoredGradingRecord): string {
  return extractStoredReportWithSelector(record, (outputs) => selectGradingReport(outputs).markdown);
}
