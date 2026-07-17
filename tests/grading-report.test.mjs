import assert from "node:assert/strict";
import test from "node:test";
import {
  extractScore,
  selectGradingReport,
  splitGradingReport,
} from "../lib/grading-report.ts";

const report = `# 题目理解
分析题目的已知条件和目标，建立清晰的受力关系。

# 学生答案逐步分析
学生第一步正确，第二步漏掉了约束力。

# 评分建议（满分10分）
**3分**

# 学习建议
重新检查约束条件并完成受力分析。`;

test("selects a complete Markdown report from outputs.result", () => {
  const selected = selectGradingReport({ result: report });
  assert.equal(selected.markdown, report);
  assert.equal(selected.selectedOutputField, "result");
});

test("never selects created_at before result", () => {
  const selected = selectGradingReport({ created_at: 1782288114574, result: report });
  assert.equal(selected.markdown, report);
  assert.equal(selected.selectedOutputField, "result");
});

test("removes think blocks from the selected report", () => {
  const selected = selectGradingReport({ result: `<think>内部推理</think>\n${report}` });
  assert.equal(selected.markdown, report);
  assert.equal(selected.hadThinkBlock, true);
});

test("normalizes CRLF without losing report content", () => {
  const selected = selectGradingReport({ result: report.replace(/\n/g, "\r\n") });
  assert.equal(selected.markdown, report);
});

test("extracts a 10-point score from the scoring section", () => {
  assert.equal(extractScore(report), 3);
});

test("invalid output produces no mock steps or report", () => {
  const selected = selectGradingReport({ created_at: 1782288114574, task_id: "abc" });
  assert.equal(selected.markdown, "");
  assert.deepEqual(splitGradingReport(selected.markdown), []);
});

test("an unsectioned valid report remains available as full Markdown", () => {
  const markdown = `题目理解：这是完整的批改正文。学生答案存在约束条件遗漏。评分建议为3分。${"请复核计算过程。".repeat(5)}`;
  assert.equal(splitGradingReport(markdown).length, 0);
  assert.equal(selectGradingReport({ result: markdown }).markdown, markdown);
});
