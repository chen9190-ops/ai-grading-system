import assert from "node:assert/strict";
import test from "node:test";
import { DifySseParser } from "../lib/dify-sse.ts";

test("parses JSON split across chunks and CRLF event boundaries", () => {
  const parser = new DifySseParser();
  const events = [
    ...parser.push('event: workflow_started\r\ndata: {"event":"workflow_'),
    ...parser.push('started","data":{"id":"run-1"}}\r\n\r'),
    ...parser.push('\nevent: ping\r\ndata: {}\r\n\r\n'),
  ];

  assert.deepEqual(events.map((event) => event.event), ["workflow_started", "ping"]);
  assert.equal(events[0].payload.data.id, "run-1");
});

test("extracts a complete workflow_finished event split across reads", () => {
  const parser = new DifySseParser();
  const events = [
    ...parser.push('data: {"event":"workflow_fini'),
    ...parser.push('shed","data":{"outputs":{"text":"批改完成"}}}\n'),
    ...parser.push('\n'),
  ];

  assert.equal(events.length, 1);
  assert.equal(events[0].event, "workflow_finished");
  assert.equal(events[0].payload.data.outputs.text, "批改完成");
});

test("parses workflow_failed without waiting for stream end", () => {
  const parser = new DifySseParser();
  const events = parser.push(
    'data: {"event":"workflow_failed","message":"模型失败"}\n\n',
  );

  assert.equal(events.length, 1);
  assert.equal(events[0].event, "workflow_failed");
  assert.equal(events[0].payload.message, "模型失败");
});
