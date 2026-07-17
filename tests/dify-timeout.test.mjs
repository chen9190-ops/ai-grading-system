import assert from "node:assert/strict";
import test from "node:test";
import {
  createDifyTimeoutController,
  DEFAULT_DIFY_GRADING_TIMEOUT_MS,
  getDifyGradingTimeoutMs,
} from "../lib/dify-timeout.ts";

test("grading timeout defaults to 360 seconds", () => {
  assert.equal(DEFAULT_DIFY_GRADING_TIMEOUT_MS, 360_000);
  assert.equal(getDifyGradingTimeoutMs(undefined), 360_000);
  assert.equal(getDifyGradingTimeoutMs("invalid"), 360_000);
});

test("grading timeout can be overridden by environment value", () => {
  assert.equal(getDifyGradingTimeoutMs("420000"), 420_000);
});

test("AbortController timer is cleaned exactly once", () => {
  let callback;
  let cleared = 0;
  const timeout = createDifyTimeoutController(360_000, {
    setTimer: (nextCallback) => {
      callback = nextCallback;
      return 123;
    },
    clearTimer: (timer) => {
      assert.equal(timer, 123);
      cleared += 1;
    },
  });
  assert.equal(timeout.controller.signal.aborted, false);
  assert.equal(typeof callback, "function");
  timeout.cleanup();
  timeout.cleanup();
  assert.equal(cleared, 1);
});
