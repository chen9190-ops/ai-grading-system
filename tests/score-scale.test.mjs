import assert from "node:assert/strict";
import test from "node:test";
import {
  formatScoreWithMaximum,
  parseScore,
  scoreProgress,
} from "../lib/score-scale.ts";

test("formats raw scores on a ten-point scale", () => {
  assert.equal(formatScoreWithMaximum(10), "10 / 10");
  assert.equal(formatScoreWithMaximum(8.5), "8.5 / 10");
});

test("parses stored score fractions without converting to percentages", () => {
  assert.equal(parseScore("7.5/10"), 7.5);
  assert.equal(parseScore("6"), 6);
});

test("calculates grade progress against ten points", () => {
  assert.ok(Math.abs(scoreProgress(3.3) - 0.33) < Number.EPSILON);
  assert.equal(scoreProgress(10), 1);
});
