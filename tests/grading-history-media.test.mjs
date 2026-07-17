import assert from "node:assert/strict";
import test from "node:test";
import { createQuestionTitle, historyTitle, selectQuestionTitle } from "../lib/grading-title.ts";
import { historyThumbnailMode } from "../lib/history-thumbnail.ts";
import { gradingHistoryPath } from "../lib/grading-history-core.ts";

test("structured question title is preferred", () => {
  assert.equal(selectQuestionTitle({ questionTitle: "空间杆系各杆内力计算", summary: "备用摘要" }), "空间杆系各杆内力计算");
});

test("question text generates a short readable title", () => {
  const title = createQuestionTitle("杆系由铰链连接，位于立方体的边和对角线上，节点D作用有沿LD方向的力Q。求各杆内力。");
  assert.ok(title.length <= 25);
  assert.match(title, /^杆系由铰链连接/);
});

test("upload filenames never become final titles", () => {
  assert.equal(selectQuestionTitle({ title: "Screenshot 2026-06-24 at 2.16.18 PM.png" }), "理论力学题目");
  assert.equal(selectQuestionTitle({ title: "IMG_1234.jpg" }), "理论力学题目");
});

test("saved image renders a thumbnail", () => {
  assert.equal(historyThumbnailMode("/api/grade/history/image?id=record&kind=problem", false), "image");
});

test("missing image renders the document fallback", () => {
  assert.equal(historyThumbnailMode(null, false), "fallback");
});

test("failed image load switches to the document fallback", () => {
  assert.equal(historyThumbnailMode("/api/grade/history/image?id=record&kind=problem", true), "fallback");
});

test("legacy records without title or image remain valid", () => {
  assert.equal(historyTitle(null, null, "理论力学"), "理论力学题目");
  assert.equal(historyThumbnailMode(null, false), "fallback");
});

test("relative upload URLs remain basePath-compatible", () => {
  assert.equal(`/ai_grading_hust_course${"/api/grade/history/image?id=record&kind=problem"}`, "/ai_grading_hust_course/api/grade/history/image?id=record&kind=problem");
});

test("list navigation continues to use the database id", () => {
  assert.equal(gradingHistoryPath("database-id"), "/grading/history/database-id");
});
