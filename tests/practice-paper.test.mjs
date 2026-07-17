import assert from "node:assert/strict";
import test from "node:test";
import { normalizePracticeMarkdown, parsePracticePaper } from "../lib/practice-paper.ts";
import { createTrainingAssistantContext, trainingAssistantInitialRequest } from "../lib/training-assistant-context.ts";

test("normalizes slash-delimited and bare unit formulas for KaTeX", () => {
  const markdown = normalizePracticeMarkdown(String.raw`已知力为 \(F=500,\text{N}\)。
M = 800,\text{N\cdot m}
\[L=2,\text{m}\]`);
  assert.match(markdown, /\$F=500,\\mathrm\{N\}\$/);
  assert.match(markdown, /\$M = 800,\\mathrm\{N\\cdot m\}\$/);
  assert.match(markdown, /\$\$\nL=2,\\mathrm\{m\}\n\$\$/);
});

test("repairs a common unclosed dollar delimiter", () => {
  assert.equal(normalizePracticeMarkdown("$F=ma"), "$F=ma$");
});

test("wraps a bare unit formula without damaging surrounding Chinese", () => {
  assert.equal(normalizePracticeMarkdown(String.raw`已知力为 500,\text{N}。`), String.raw`已知力为 $500,\mathrm{N}$。`);
});

test("parses a structured paper and normalizes each question", () => {
  const paper = parsePracticePaper(JSON.stringify({
    paperTitle: "理论力学训练",
    course: "理论力学",
    chapter: "静力学",
    difficulty: "中等",
    estimatedMinutes: 60,
    questions: [{ id: "q1", index: 1, score: 10, stemMarkdown: String.raw`求 \(M=800,\text{N\cdot m}\)。`, knowledgePoints: ["力矩"], difficulty: "中等", answer: "答案" }],
  }));
  assert.equal(paper?.questions[0].id, "q1");
  assert.match(paper?.questions[0].stemMarkdown ?? "", /\\mathrm/);
});

test("invalid JSON safely falls back by returning null", () => {
  assert.equal(parsePracticePaper("# 普通 Markdown 试卷"), null);
});

test("assistant context carries ids without putting content in a URL", () => {
  const paper = parsePracticePaper(JSON.stringify({ questions: [{ id: "q2", index: 2, stemMarkdown: "一道足够清晰的题目", knowledgePoints: ["力矩"], difficulty: "中等" }] }));
  const context = createTrainingAssistantContext("paper-1", paper?.questions[0] ?? null, "hint");
  assert.equal(context.paperId, "paper-1");
  assert.equal(context.questionId, "q2");
  assert.match(trainingAssistantInitialRequest(context), /下一步提示/);
});
