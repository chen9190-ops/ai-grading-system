type DifyUploadedFile = {
  id: string;
};

const allowedImageTypes = new Set(["image/jpeg", "image/png"]);
const difyUser = "ai-grading-system";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const publicStreamErrorMessage = "AI分析超时或服务繁忙，请重试";
const responsePreviewLength = 500;

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const apiKey = process.env.DIFY_API_KEY;
  const baseUrl = process.env.DIFY_BASE_URL;

  logInfo(requestId, "submission received", {
    method: request.method,
    pathname: new URL(request.url).pathname,
    contentType: request.headers.get("content-type"),
    contentLength: request.headers.get("content-length"),
  });

  if (!apiKey || !baseUrl) {
    logError(requestId, "Dify configuration missing");
    return Response.json(
      { error: "Missing DIFY_API_KEY or DIFY_BASE_URL" },
      { status: 500, headers: requestIdHeaders(requestId) },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    logError(requestId, "submission form data parse failed", errorDetails(error));
    return Response.json(
      { error: "Invalid multipart form data" },
      { status: 400, headers: requestIdHeaders(requestId) },
    );
  }
  const problemImage = formData.get("problem_image");
  const answerImage = formData.get("answer_image");

  logInfo(requestId, "submission files received", {
    problemImage: fileDetails(problemImage),
    answerImage: fileDetails(answerImage),
  });

  if (!isValidImage(problemImage) || !isValidImage(answerImage)) {
    logError(requestId, "submission image validation failed", {
      problemImage: fileDetails(problemImage),
      answerImage: fileDetails(answerImage),
    });
    return Response.json(
      { error: "problem_image and answer_image must be JPG, JPEG, or PNG files" },
      { status: 400, headers: requestIdHeaders(requestId) },
    );
  }

  try {
    return streamDifyWorkflow(baseUrl.replace(/\/$/, ""), apiKey, requestId, {
      problemImage,
      answerImage,
    });
  } catch (error) {
    logError(requestId, "grade stream creation failed", errorDetails(error));
    return Response.json(
      {
        error: publicStreamErrorMessage,
      },
      { status: 502, headers: requestIdHeaders(requestId) },
    );
  }
}

function isValidImage(value: FormDataEntryValue | null): value is File {
  return value instanceof File && allowedImageTypes.has(value.type);
}

function streamDifyWorkflow(
  baseUrl: string,
  apiKey: string,
  requestId: string,
  files: {
    problemImage: File;
    answerImage: File;
  },
) {
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const [problemFile, answerFile] = await Promise.all([
          uploadFileToDify(baseUrl, apiKey, requestId, "problem_image", files.problemImage),
          uploadFileToDify(baseUrl, apiKey, requestId, "answer_image", files.answerImage),
        ]);
        const difyResponse = await runDifyWorkflowStream(baseUrl, apiKey, requestId, {
          problemFileId: problemFile.id,
          answerFileId: answerFile.id,
        });

        if (!difyResponse.body) {
          throw new Error("Empty Dify stream");
        }

        await forwardDifySse(difyResponse.body, controller, requestId);
      } catch (error) {
        logError(requestId, "Dify request chain failed", errorDetails(error));
        controller.enqueue(
          textEncoder.encode(
            `event: error\ndata: ${JSON.stringify({
              message: publicStreamErrorMessage,
            })}\n\n`,
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
      ...requestIdHeaders(requestId),
    },
  });
}

async function uploadFileToDify(
  baseUrl: string,
  apiKey: string,
  requestId: string,
  field: "problem_image" | "answer_image",
  file: File,
): Promise<DifyUploadedFile> {
  const body = new FormData();
  body.append("file", file);
  body.append("user", difyUser);

  logInfo(requestId, "Dify file upload started", {
    field,
    size: file.size,
    mimeType: file.type,
  });

  const response = await fetch(`${baseUrl}/files/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body,
  });

  const data = await readJson(response);
  logInfo(requestId, "Dify file upload returned", {
    field,
    status: response.status,
    responsePreview: safePreview(data),
  });

  if (!response.ok) {
    throw new Error(getDifyErrorMessage("Dify file upload failed", data));
  }

  if (!isDifyUploadedFile(data)) {
    throw new Error("Dify file upload response missing file id");
  }

  return data;
}

async function runDifyWorkflowStream(
  baseUrl: string,
  apiKey: string,
  requestId: string,
  fileIds: {
    problemFileId: string;
    answerFileId: string;
  },
): Promise<Response> {
  logInfo(requestId, "Dify workflow request started");
  const response = await fetch(`${baseUrl}/workflows/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: {
        problem_image: {
          transfer_method: "local_file",
          upload_file_id: fileIds.problemFileId,
          type: "image",
        },
        answer_image: {
          transfer_method: "local_file",
          upload_file_id: fileIds.answerFileId,
          type: "image",
        },
      },
      response_mode: "streaming",
      user: difyUser,
    }),
  });

  logInfo(requestId, "Dify workflow returned", { status: response.status });

  if (!response.ok) {
    const data = await readJson(response);
    logInfo(requestId, "Dify workflow response preview", {
      responsePreview: safePreview(data),
    });
    throw new Error(getDifyErrorMessage("Dify workflow run failed", data));
  }

  return response;
}

async function forwardDifySse(
  body: ReadableStream<Uint8Array>,
  controller: ReadableStreamDefaultController,
  requestId: string,
) {
  const reader = body.getReader();
  let buffer = "";
  let responsePreview = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      const decodedChunk = textDecoder.decode(value, { stream: true });
      if (responsePreview.length < responsePreviewLength) {
        responsePreview += decodedChunk.slice(0, responsePreviewLength - responsePreview.length);
      }
      buffer += decodedChunk;
      const events = buffer.split(/\n\n/);
      buffer = events.pop() ?? "";

      for (const eventText of events) {
        controller.enqueue(textEncoder.encode(transformDifyEvent(eventText)));
      }
    }

    if (buffer.trim()) {
      controller.enqueue(textEncoder.encode(transformDifyEvent(buffer)));
    }
  } finally {
    logInfo(requestId, "Dify workflow response preview", {
      responsePreview: redactSecrets(responsePreview),
    });
  }
}

function requestIdHeaders(requestId: string) {
  return { "X-Grading-Request-Id": requestId };
}

function fileDetails(value: FormDataEntryValue | null) {
  return value instanceof File
    ? { present: true, size: value.size, mimeType: value.type }
    : { present: false, valueType: value === null ? "null" : typeof value };
}

function safePreview(value: unknown) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  return redactSecrets((serialized || "").slice(0, responsePreviewLength));
}

function redactSecrets(value: string) {
  return value
    .replace(/(authorization["'\s:]*)bearer\s+[^\s"']+/gi, "$1[REDACTED]")
    .replace(/((?:api[_-]?key|token|secret)["'\s:=]+)[^\s,"'}]+/gi, "$1[REDACTED]");
}

function errorDetails(error: unknown) {
  return error instanceof Error
    ? { name: error.name, message: redactSecrets(error.message) }
    : { message: redactSecrets(String(error)) };
}

function logInfo(requestId: string, message: string, details?: unknown) {
  console.info(`[grading][api][${requestId}] ${message}`, details ?? "");
}

function logError(requestId: string, message: string, details?: unknown) {
  console.error(`[grading][api][${requestId}] ${message}`, details ?? "");
}

function transformDifyEvent(eventText: string) {
  const event = parseSseEvent(eventText);

  if (!event) {
    return `${eventText}\n\n`;
  }

  const payload = parseJson(event.data);
  const eventName = getEventName(payload, event.event);

  if (eventName === "workflow_finished") {
    const nextPayload =
      typeof payload === "object" && payload !== null
        ? { ...(payload as Record<string, unknown>), result: extractDifyResult(payload) }
        : { event: "workflow_finished", result: extractDifyResult(payload) };

    return `event: ${event.event || "message"}\ndata: ${JSON.stringify(nextPayload)}\n\n`;
  }

  return `${event.event ? `event: ${event.event}\n` : ""}data: ${event.data}\n\n`;
}

function parseSseEvent(eventText: string) {
  const lines = eventText.split(/\n/);
  const dataLines: string[] = [];
  let event = "";

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  return {
    event,
    data: dataLines.join("\n"),
  };
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function getEventName(payload: unknown, fallbackEventName: string) {
  if (typeof payload === "object" && payload !== null && "event" in payload) {
    const event = (payload as { event?: unknown }).event;

    if (typeof event === "string") {
      return event;
    }
  }

  return fallbackEventName;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function isDifyUploadedFile(value: unknown): value is DifyUploadedFile {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string"
  );
}

function getDifyErrorMessage(prefix: string, data: unknown) {
  if (typeof data === "string") {
    return `${prefix}: ${data}`;
  }

  if (typeof data === "object" && data !== null) {
    if ("message" in data && typeof data.message === "string") {
      return `${prefix}: ${data.message}`;
    }

    if ("error" in data && typeof data.error === "string") {
      return `${prefix}: ${data.error}`;
    }
  }

  return prefix;
}

function extractDifyResult(payload: unknown) {
  const workflowData =
    typeof payload === "string" ? tryParseJson(payload) ?? payload : payload;

  const event = getRecordValue(workflowData, "event");
  const data = getRecordValue(workflowData, "data");

  if (event === "workflow_finished") {
    const status = getRecordValue(data, "status");

    if (status === "failed") {
      return "AI分析失败，请稍后重试。";
    }
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
