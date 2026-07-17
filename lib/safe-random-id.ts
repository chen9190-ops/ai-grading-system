let fallbackSequence = 0;

export function safeRandomId(prefix = "id"): string {
  try {
    if (
      typeof globalThis !== "undefined" &&
      globalThis.crypto &&
      typeof globalThis.crypto.randomUUID === "function"
    ) {
      return globalThis.crypto.randomUUID();
    }
  } catch {
    // HTTP and older browser contexts may not expose a usable Web Crypto API.
  }

  fallbackSequence += 1;
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}-${fallbackSequence.toString(36)}`;
}
