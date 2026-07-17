import assert from "node:assert/strict";
import test from "node:test";
import {
  canDeleteGradingRecord,
  gradingAssetFilename,
  gradingDeleteApiPath,
  gradingDeletionStatus,
  isExclusiveAssetReference,
  removeGradingRecord,
} from "../lib/grading-deletion.ts";

test("current student can delete their own grading record", () => {
  assert.equal(canDeleteGradingRecord("student-1", "student-1"), true);
  assert.equal(gradingDeletionStatus("student-1", "student-1"), 200);
});

test("current student cannot delete another student's record", () => {
  assert.equal(canDeleteGradingRecord("student-1", "student-2"), false);
  assert.equal(gradingDeletionStatus("student-1", "student-2"), 403);
});

test("missing grading record maps to 404", () => {
  assert.equal(gradingDeletionStatus("student-1", undefined), 404);
});

test("only exclusively referenced uploaded images are deleted", () => {
  assert.equal(isExclusiveAssetReference(1), true);
  assert.equal(isExclusiveAssetReference(2), false);
  assert.equal(
    gradingAssetFilename("/api/grade/history/image?asset=550e8400-e29b-41d4-a716-446655440000.jpg"),
    "550e8400-e29b-41d4-a716-446655440000.jpg",
  );
  assert.equal(gradingAssetFilename("https://external.example/file.jpg"), null);
});

test("successful deletion immediately removes the list item", () => {
  assert.deepEqual(removeGradingRecord([{ id: "a" }, { id: "b" }], "a"), [{ id: "b" }]);
});

test("repeated list removal is harmless", () => {
  const once = removeGradingRecord([{ id: "a" }], "a");
  assert.deepEqual(removeGradingRecord(once, "a"), []);
});

test("delete API path remains compatible with a configured basePath", () => {
  const path = gradingDeleteApiPath("database/id");
  assert.equal(path, "/api/grading-history/database%2Fid");
  assert.equal(
    `/ai_grading_hust_course${path}`,
    "/ai_grading_hust_course/api/grading-history/database%2Fid",
  );
});
