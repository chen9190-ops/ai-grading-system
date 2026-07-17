export type DifySseEvent = {
  event: string;
  data: string;
  payload: unknown;
};

const eventBoundaryPattern = /\r\n\r\n|\n\n|\r\r/;

export class DifySseParser {
  private buffer = "";

  push(chunk: string) {
    this.buffer += chunk;
    const events: DifySseEvent[] = [];
    let boundary = eventBoundaryPattern.exec(this.buffer);

    while (boundary) {
      const eventText = this.buffer.slice(0, boundary.index);
      this.buffer = this.buffer.slice(boundary.index + boundary[0].length);
      const event = parseDifySseEvent(eventText);
      if (event) events.push(event);
      boundary = eventBoundaryPattern.exec(this.buffer);
    }

    return events;
  }

  finish() {
    const event = parseDifySseEvent(this.buffer);
    this.buffer = "";
    return event ? [event] : [];
  }
}

export function parseDifySseEvent(eventText: string): DifySseEvent | null {
  if (!eventText.trim()) return null;

  const dataLines: string[] = [];
  let event = "";

  for (const line of eventText.split(/\r\n|\r|\n/)) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }

  const data = dataLines.join("\n");
  const payload = parseJson(data);
  const payloadEvent = getRecordValue(payload, "event");

  return {
    event: typeof payloadEvent === "string" ? payloadEvent : event || "message",
    data,
    payload,
  };
}

function parseJson(value: string): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function getRecordValue(value: unknown, key: string) {
  if (typeof value !== "object" || value === null || !(key in value)) return undefined;
  return (value as Record<string, unknown>)[key];
}
