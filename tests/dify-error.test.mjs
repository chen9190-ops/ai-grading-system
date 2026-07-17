import assert from "node:assert/strict";
import test from "node:test";
import {
  DifyRequestError,
  gradingUserMessage,
  mapDifyError,
  withDifyRetry,
} from "../lib/dify-error.ts";

const dashScopeTimeout = new Error(
  "PluginInvokeError: HTTPSConnectionPool(host='dashscope.aliyuncs.com', port=443): Connection timed out; Max retries exceeded",
);

test("DashScope plugin timeout maps to a retryable dedicated error", () => {
  assert.deepEqual(mapDifyError(dashScopeTimeout), {
    errorCode: "DASHSCOPE_CONNECT_TIMEOUT",
    retryable: true,
    userMessage: "阿里云模型服务连接超时，请稍后重试。",
    errorType: "PluginInvokeError",
    targetHost: "dashscope.aliyuncs.com",
    timeout: true,
  });
});

test("PluginInvokeError is not misclassified as missing grading output", () => {
  assert.equal(mapDifyError(new Error("PluginInvokeError: model invocation failed")).errorCode, "DIFY_PLUGIN_ERROR");
  assert.equal(mapDifyError(new DifyRequestError("DIFY_NO_GRADING_OUTPUT")).errorCode, "DIFY_NO_GRADING_OUTPUT");
});

test("network errors retry and stop after at most two retries", async () => {
  let calls = 0;
  await assert.rejects(() => withDifyRetry(async () => {
    calls += 1;
    throw new Error("fetch failed: ECONNRESET");
  }, { sleep: async () => undefined }));
  assert.equal(calls, 3);
});

test("non-network errors do not retry", async () => {
  let calls = 0;
  await assert.rejects(() => withDifyRetry(async () => {
    calls += 1;
    throw new Error("PluginInvokeError: invalid model parameter");
  }, { sleep: async () => undefined }));
  assert.equal(calls, 1);
});

test("a long workflow execution timeout is not automatically retried", async () => {
  let calls = 0;
  await assert.rejects(() => withDifyRetry(async () => {
    calls += 1;
    throw new DifyRequestError("DIFY_REQUEST_TIMEOUT");
  }, { sleep: async () => undefined }));
  assert.equal(calls, 1);
});

test("502, 503 and 504 responses still receive finite retries", async () => {
  for (const status of [502, 503, 504]) {
    let calls = 0;
    await assert.rejects(() => withDifyRetry(async () => {
      calls += 1;
      throw new DifyRequestError("upstream unavailable", status);
    }, { sleep: async () => undefined }));
    assert.equal(calls, 3);
  }
});

test("client displays the safe Chinese user message", () => {
  assert.equal(
    gradingUserMessage({ userMessage: mapDifyError(dashScopeTimeout).userMessage }, "fallback"),
    "阿里云模型服务连接超时，请稍后重试。",
  );
});
