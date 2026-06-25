const unavailableMessage = "历史记录详情暂时无法获取，请重新批改。";

export async function GET(request: Request) {
  const apiKey = process.env.DIFY_API_KEY;
  const baseUrl = process.env.DIFY_BASE_URL;
  const { searchParams } = new URL(request.url);
  const workflowRunId = searchParams.get("id");

  if (!apiKey || !baseUrl || !workflowRunId) {
    return Response.json({ error: unavailableMessage }, { status: 400 });
  }

  try {
    const response = await fetch(
      `${baseUrl.replace(/\/$/, "")}/workflows/run/${encodeURIComponent(
        workflowRunId,
      )}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );

    if (!response.ok) {
      return Response.json({ error: unavailableMessage }, { status: 502 });
    }

    const data = await response.json();
    const result = extractDifyResult(data);

    return Response.json({ result });
  } catch {
    return Response.json({ error: unavailableMessage }, { status: 502 });
  }
}

function extractDifyResult(payload: unknown) {
  const workflowData =
    typeof payload === "string" ? tryParseJson(payload) ?? payload : payload;
  const data = getRecordValue(workflowData, "data") ?? workflowData;
  const status = getRecordValue(data, "status");

  if (status === "failed") {
    return unavailableMessage;
  }

  const outputs = getRecordValue(data, "outputs");
  const candidate =
    getRecordValue(outputs, "direct_text") ??
    getRecordValue(outputs, "reference_text") ??
    getRecordValue(outputs, "none_text") ??
    getRecordValue(outputs, "text") ??
    getRecordValue(outputs, "result") ??
    getRecordValue(outputs, "output") ??
    getRecordValue(outputs, "answer") ??
    getRecordValue(workflowData, "answer");
  const text = extractTextCandidate(candidate);

  if (!text) {
    console.log("history response", {
      payload,
      data,
      outputs,
      availableOutputKeys:
        typeof outputs === "object" && outputs !== null ? Object.keys(outputs) : [],
    });
  }

  return cleanDifyText(
    text || "未获取到有效批改结果，请检查 Dify 输出节点配置。",
  );
}

function extractTextCandidate(value: unknown): string {
  if (typeof value === "string") {
    const parsedText = parseJsonTextDeep(value);
    return parsedText ?? value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (typeof value === "object" && value !== null) {
    const text = getRecordValue(value, "text");

    if (typeof text === "string") {
      return parseJsonTextDeep(text) ?? text;
    }
  }

  return "";
}

function parseJsonTextDeep(value: string): string | null {
  const trimmedValue = value.trim();

  if (!trimmedValue.startsWith("{") && !trimmedValue.startsWith("[")) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmedValue);
    const text = getRecordValue(parsed, "text");

    return typeof text === "string" ? parseJsonTextDeep(text) ?? text : null;
  } catch {
    return null;
  }
}

function cleanDifyText(value: string) {
  return value
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .trim();
}

function tryParseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getRecordValue(value: unknown, key: string) {
  if (typeof value !== "object" || value === null || !(key in value)) {
    return undefined;
  }

  return (value as Record<string, unknown>)[key];
}
