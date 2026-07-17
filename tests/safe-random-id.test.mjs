import assert from "node:assert/strict";
import test from "node:test";
import { safeRandomId } from "../lib/safe-random-id.ts";

async function withCrypto(value, callback) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value,
  });
  try {
    await callback();
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "crypto", descriptor);
    else Reflect.deleteProperty(globalThis, "crypto");
  }
}

test("uses crypto.randomUUID when it is available", async () => {
  const uuid = "123e4567-e89b-12d3-a456-426614174000";
  await withCrypto({ randomUUID: () => uuid }, () => {
    assert.equal(safeRandomId("test"), uuid);
  });
});

test("returns a non-empty fallback when crypto.randomUUID is unavailable", async () => {
  await withCrypto({}, () => {
    assert.match(safeRandomId("fallback"), /^fallback-/);
  });
});

test("consecutive fallback IDs are not identical", async () => {
  await withCrypto(undefined, () => {
    const first = safeRandomId("fallback");
    const second = safeRandomId("fallback");
    assert.ok(first);
    assert.ok(second);
    assert.notEqual(first, second);
  });
});
