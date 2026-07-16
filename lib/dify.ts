import "server-only";

type CallDifyChatflowOptions = {
  apiKey: string | undefined;
  url: string | undefined;
  query: string;
  user: string;
  inputs?: Record<string, unknown>;
};

type CallDifyWorkflowOptions = {
  apiKey: string | undefined;
  url: string | undefined;
  inputs: Record<string, unknown>;
  user: string;
};

type DifyChatflowResponse = {
  answer: string;
};

export class DifyChatflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DifyChatflowError";
  }
}

export async function callDifyChatflow({
  apiKey,
  url,
  query,
  user,
  inputs = {},
}: CallDifyChatflowOptions): Promise<string> {
  if (!apiKey?.trim()) {
    throw new DifyChatflowError("Dify Chatflow API Key 未配置");
  }

  if (!url?.trim()) {
    throw new DifyChatflowError("Dify Chatflow URL 未配置");
  }

  const chatflowUrl = normalizeChatflowUrl(url);

  let response: Response;
  try {
    response = await fetch(chatflowUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs,
        query,
        user,
        response_mode: "blocking",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(90_000),
    });
  } catch (error) {
    throw new DifyChatflowError(
      error instanceof Error && error.name === "TimeoutError"
        ? "Dify Chatflow 请求超时"
        : "无法连接 Dify Chatflow",
    );
  }

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new DifyChatflowError(
      extractError(data) || `Dify Chatflow 请求失败（${response.status}）`,
    );
  }

  const parsed = parseChatflowResponse(data);
  if (!parsed) {
    throw new DifyChatflowError("Dify Chatflow 返回格式异常：缺少 answer");
  }

  return parsed.answer;
}

function normalizeChatflowUrl(value: string) {
  const normalized = value.trim().replace(/\/+$/, "");
  return /\/chat-messages$/i.test(normalized)
    ? normalized
    : `${normalized}/chat-messages`;
}

export async function callDifyWorkflow({
  apiKey,
  url,
  inputs,
  user,
}: CallDifyWorkflowOptions): Promise<Record<string, unknown>> {
  if (!apiKey?.trim()) {
    throw new DifyChatflowError("Dify Workflow API Key 未配置");
  }
  if (!url?.trim()) {
    throw new DifyChatflowError("Dify Workflow URL 未配置");
  }

  const workflowUrl = normalizeWorkflowUrl(url);

  let response: Response;
  try {
    response = await fetch(workflowUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ inputs, user, response_mode: "blocking" }),
      cache: "no-store",
      signal: AbortSignal.timeout(90_000),
    });
  } catch (error) {
    throw new DifyChatflowError(
      error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
        ? "Dify Workflow 请求超时"
        : "无法连接 Dify Workflow",
    );
  }

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new DifyChatflowError(
      extractError(data) || `Dify Workflow 请求失败（${response.status}）`,
    );
  }
  if (!isRecord(data)) {
    throw new DifyChatflowError("Dify Workflow 返回格式异常");
  }

  const workflowData = isRecord(data.data) ? data.data : data;
  const outputs = workflowData.outputs;
  if (!isRecord(outputs)) {
    throw new DifyChatflowError("Dify Workflow 返回格式异常：缺少 outputs");
  }
  return outputs;
}

function parseChatflowResponse(value: unknown): DifyChatflowResponse | null {
  if (!isRecord(value) || typeof value.answer !== "string" || !value.answer.trim()) {
    return null;
  }
  const answer = stripThinking(value.answer);
  return answer ? { answer } : null;
}

function normalizeWorkflowUrl(value: string) {
  const normalized = value.trim().replace(/\/+$/, "");
  return /\/workflows\/run$/i.test(normalized)
    ? normalized
    : `${normalized}/workflows/run`;
}

function stripThinking(value: string) {
  return value.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

function extractError(value: unknown): string {
  if (!isRecord(value)) return "";
  const message = value.message ?? value.error;
  return typeof message === "string" ? message : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
