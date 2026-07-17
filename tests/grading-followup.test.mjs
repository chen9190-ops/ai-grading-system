import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFollowupRequest,
  canAccessFollowupGrading,
  limitFollowupHistory,
  validateFollowupQuestion,
} from "../lib/grading-followup-core.ts";
import { callGradingFollowupDify, GradingFollowupDifyError } from "../lib/grading-followup-dify.ts";

test("normal follow-up returns Dify answer text", async () => {
  const result = await callGradingFollowupDify({
    url: "https://api.dify.ai/v1/chat-messages",
    apiKey: "test-key",
    query: "为什么？",
    user: "student-1",
    inputs: {},
    fetcher: async () => Response.json({ answer: "因为约束力方向应先假设。" }),
  });
  assert.equal(result.answer, "因为约束力方向应先假设。");
});

test("quick question builds a submit-ready request", () => {
  assert.deepEqual(buildFollowupRequest("为什么这里取这个方向？", "grading-1", []), {
    question: "为什么这里取这个方向？",
    gradingId: "grading-1",
    history: [],
  });
});

test("missing grading and another user's grading are rejected by access checks", () => {
  assert.equal(canAccessFollowupGrading("student-1", null), false);
  assert.equal(canAccessFollowupGrading("student-1", "student-2"), false);
  assert.equal(canAccessFollowupGrading("student-1", "student-1"), true);
});

test("empty and oversized questions are invalid", () => {
  assert.equal(validateFollowupQuestion("  "), null);
  assert.equal(validateFollowupQuestion("问".repeat(2001)), null);
});

test("Dify timeout returns a dedicated timeout error", async () => {
  await assert.rejects(() => callGradingFollowupDify({
    url: "https://api.dify.ai/v1/chat-messages",
    apiKey: "test-key",
    query: "为什么？",
    user: "student-1",
    inputs: {},
    timeoutMs: 1,
    fetcher: async (_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    }),
  }), (error) => error instanceof GradingFollowupDifyError && error.code === "TIMEOUT");
});

test("empty Dify answer is rejected", async () => {
  await assert.rejects(() => callGradingFollowupDify({
    url: "https://api.dify.ai/v1/chat-messages",
    apiKey: "test-key",
    query: "为什么？",
    user: "student-1",
    inputs: {},
    fetcher: async () => Response.json({ answer: "" }),
  }), (error) => error instanceof GradingFollowupDifyError && error.code === "EMPTY");
});

test("conversation history keeps the latest ten rounds", () => {
  const history = Array.from({ length: 24 }, (_, index) => ({
    role: index % 2 ? "assistant" : "user",
    content: `message-${index}`,
  }));
  const limited = limitFollowupHistory(history);
  assert.equal(limited.length, 20);
  assert.equal(limited[0].content, "message-4");
  assert.equal(limited[19].content, "message-23");
});
