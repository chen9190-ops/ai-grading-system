export type GradingErrorCode =
  | "DASHSCOPE_CONNECT_TIMEOUT"
  | "DIFY_REQUEST_TIMEOUT"
  | "DIFY_PLUGIN_ERROR"
  | "DIFY_NO_GRADING_OUTPUT"
  | "DIFY_AUTH_ERROR"
  | "DIFY_NETWORK_ERROR"
  | "UNKNOWN_GRADING_ERROR";

export type GradingErrorMapping = {
  errorCode: GradingErrorCode;
  retryable: boolean;
  userMessage: string;
  errorType: string;
  targetHost: string | null;
  timeout: boolean;
};

export class DifyRequestError extends Error {
  readonly status?: number;
  readonly workflowRunId?: string;

  constructor(
    message: string,
    status?: number,
    workflowRunId?: string,
  ) {
    super(message);
    this.name = "DifyRequestError";
    this.status = status;
    this.workflowRunId = workflowRunId;
  }
}

export function mapDifyError(error: unknown): GradingErrorMapping {
  const text = errorText(error);
  const normalized = text.toLowerCase();
  const status = error instanceof DifyRequestError ? error.status : undefined;
  const targetHost = extractTargetHost(text);
  const isDashScope = normalized.includes("dashscope.aliyuncs.com");
  const isConnectTimeout = includesAny(normalized, [
    "connecttimeouterror",
    "httpsconnectionpool",
    "timed out",
    "max retries exceeded",
  ]);

  if (isDashScope && isConnectTimeout) {
    return mapping("DASHSCOPE_CONNECT_TIMEOUT", true, "阿里云模型服务连接超时，请稍后重试。", "PluginInvokeError", targetHost, true);
  }
  if (isAbortError(error) || includesAny(normalized, ["dify_request_timeout", "request timed out", "请求超时"])) {
    return mapping("DIFY_REQUEST_TIMEOUT", true, "AI批改请求超时，请稍后重试。", "DifyRequestTimeout", targetHost, true);
  }
  if (status === 401 || status === 403 || includesAny(normalized, ["unauthorized", "invalid api key", "authentication failed"])) {
    return mapping("DIFY_AUTH_ERROR", false, "AI批改服务认证失败，请联系管理员。", "DifyAuthError", targetHost, false);
  }
  if (normalized.includes("dify_no_grading_output")) {
    return mapping("DIFY_NO_GRADING_OUTPUT", false, "未能读取 AI 批改正文，请使用 requestId 联系管理员。", "DifyNoGradingOutput", targetHost, false);
  }
  if (
    status === 502 || status === 503 || status === 504 ||
    isConnectTimeout ||
    includesAny(normalized, ["econnreset", "connection reset", "enotfound", "eai_again", "getaddrinfo", "dns", "network error", "fetch failed"])
  ) {
    return mapping("DIFY_NETWORK_ERROR", true, "AI批改服务网络连接失败，请稍后重试。", "DifyNetworkError", targetHost, isConnectTimeout);
  }
  if (normalized.includes("plugininvokeerror")) {
    return mapping("DIFY_PLUGIN_ERROR", false, "AI模型插件调用失败，请稍后重试。", "PluginInvokeError", targetHost, false);
  }
  return mapping("UNKNOWN_GRADING_ERROR", false, "AI批改失败，请稍后重试。", error instanceof Error ? error.name : "UnknownError", targetHost, false);
}

export function shouldRetryDifyError(error: unknown): boolean {
  return mapDifyError(error).retryable;
}

export function gradingUserMessage(payload: unknown, fallback: string): string {
  if (typeof payload !== "object" || payload === null) return fallback;
  const userMessage = (payload as Record<string, unknown>).userMessage;
  return typeof userMessage === "string" && userMessage.trim() ? userMessage : fallback;
}

export async function withDifyRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: {
    maxRetries?: number;
    delaysMs?: number[];
    sleep?: (delayMs: number) => Promise<void>;
    onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
  } = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 2;
  const delays = options.delaysMs ?? [1_000, 3_000];
  const sleep = options.sleep ?? ((delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)));
  let attempt = 0;
  while (true) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (attempt >= maxRetries || !shouldRetryDifyError(error)) throw error;
      const delayMs = delays[Math.min(attempt, delays.length - 1)] ?? 1_000;
      options.onRetry?.(error, attempt + 1, delayMs);
      await sleep(delayMs);
      attempt += 1;
    }
  }
}

function mapping(errorCode: GradingErrorCode, retryable: boolean, userMessage: string, errorType: string, targetHost: string | null, timeout: boolean): GradingErrorMapping {
  return { errorCode, retryable, userMessage, errorType, targetHost, timeout };
}

function errorText(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return typeof error === "string" ? error : JSON.stringify(error) || String(error);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function extractTargetHost(text: string): string | null {
  const hostMatch = text.match(/host=['"]([^'"]+)['"]/i) ?? text.match(/https?:\/\/([^/\s:'"]+)/i);
  return hostMatch?.[1] ?? (text.toLowerCase().includes("dashscope.aliyuncs.com") ? "dashscope.aliyuncs.com" : null);
}

function includesAny(value: string, candidates: string[]): boolean {
  return candidates.some((candidate) => value.includes(candidate));
}
