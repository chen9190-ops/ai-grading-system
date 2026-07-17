import assert from "node:assert/strict";
import test from "node:test";
import { selectGradingReport } from "../lib/grading-report.ts";
import { canAccessGradingRecord, extractStoredReportWithSelector, gradingHistoryLookupStatus, gradingHistoryPath, normalizeStoredScore } from "../lib/grading-history-core.ts";

const extractStoredGradingReport = (record) => extractStoredReportWithSelector(record, (outputs) => selectGradingReport(outputs).markdown);

const report = "# 题目理解\n这是足够长的理论力学题目分析，用于验证历史记录能够展示真实 Markdown 正文。\n# 评分建议（满分10分）\n**5.5分**";

test("new gradingResult markdown is extracted", () => {
  assert.equal(extractStoredGradingReport({ gradingResult: report }), report);
});

test("legacy aiResult result is extracted without reading arbitrary ids", () => {
  assert.equal(extractStoredGradingReport({ gradingResult: "", aiResult: { created_at: "1782288114574", result: report } }), report);
  assert.equal(extractStoredGradingReport({ gradingResult: "", aiResult: { created_at: "1782288114574", id: "record-id" } }), "");
});

test("legacy percentage score is normalized only from score", () => {
  assert.equal(normalizeStoredScore(55), 5.5);
  assert.equal(normalizeStoredScore(80), 8);
  assert.equal(normalizeStoredScore(100), 10);
});

test("database id lookup succeeds for the current student", () => {
  assert.equal(gradingHistoryLookupStatus("student-a", "student-a"), 200);
});

test("current student cannot access another student's record", () => {
  assert.equal(canAccessGradingRecord("student-a", "student-a"), true);
  assert.equal(canAccessGradingRecord("student-a", "student-b"), false);
  assert.equal(canAccessGradingRecord("student-a", null), false);
});

test("homepage navigation uses the database id", () => {
  assert.equal(gradingHistoryPath("db/id"), "/grading/history/db%2Fid");
});

test("the relative history path remains compatible with a configured basePath", () => {
  assert.equal(`/ai_grading_hust_course${gradingHistoryPath("database-id")}`, "/ai_grading_hust_course/grading/history/database-id");
});

test("missing reports remain an empty state", () => {
  assert.equal(extractStoredGradingReport({ gradingResult: "", aiResult: null }), "");
});

test("a missing database id maps to 404", () => {
  assert.equal(gradingHistoryLookupStatus("student-a", undefined), 404);
});
