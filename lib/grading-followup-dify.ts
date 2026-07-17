export class GradingFollowupDifyError extends Error {
  readonly code: "CONFIG" | "TIMEOUT" | "HTTP" | "EMPTY";
  readonly status?: number;

  constructor(
    message: string,
    code: "CONFIG" | "TIMEOUT" | "HTTP" | "EMPTY",
    status?: number,
  ) {
    super(message);
    this.name = "GradingFollowupDifyError";
    this.code = code;
    this.status = status;
  }
}

export async function callGradingFollowupDify(options: {
  url: string | undefined;
  apiKey: string | undefined;
  query: string;
  user: string;
  inputs: Record<string, unknown>;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}) {
  if (!options.url?.trim() || !options.apiKey?.trim()) {
    throw new GradingFollowupDifyError("批改追问服务尚未配置", "CONFIG");
  }
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? 90_000);
  try {
    const response = await (options.fetcher ?? fetch)(normalizeUrl(options.url), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: options.inputs,
        query: options.query,
        user: options.user,
        response_mode: "blocking",
      }),
      cache: "no-store",
      signal: controller.signal,
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      throw new GradingFollowupDifyError(`Dify 追问请求失败（${response.status}）`, "HTTP", response.status);
    }
    const answer = parseAnswer(payload);
    if (!answer) throw new GradingFollowupDifyError("Dify 追问返回空正文", "EMPTY", response.status);
    return { answer, status: response.status };
  } catch (error) {
    if (timedOut) throw new GradingFollowupDifyError("AI 追问响应超时，请稍后重试", "TIMEOUT");
    throw error;
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

function normalizeUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, "");
  return /\/chat-messages$/i.test(normalized) ? normalized : `${normalized}/chat-messages`;
}

function parseAnswer(value: unknown): string {
  if (typeof value !== "object" || value === null || !("answer" in value) || typeof value.answer !== "string") return "";
  return value.answer.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}
