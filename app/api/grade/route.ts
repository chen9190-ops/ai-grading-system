type DifyUploadedFile = {
  id: string;
};

const allowedImageTypes = new Set(["image/jpeg", "image/png"]);
const difyUser = "ai-grading-system";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const publicStreamErrorMessage = "AI分析超时或服务繁忙，请重试";

export async function POST(request: Request) {
  const apiKey = process.env.DIFY_API_KEY;
  const baseUrl = process.env.DIFY_BASE_URL;

  if (!apiKey || !baseUrl) {
    return Response.json(
      { error: "Missing DIFY_API_KEY or DIFY_BASE_URL" },
      { status: 500 },
    );
  }

  const formData = await request.formData();
  const problemImage = formData.get("problem_image");
  const answerImage = formData.get("answer_image");

  if (!isValidImage(problemImage) || !isValidImage(answerImage)) {
    return Response.json(
      { error: "problem_image and answer_image must be JPG, JPEG, or PNG files" },
      { status: 400 },
    );
  }

  try {
    return streamDifyWorkflow(baseUrl.replace(/\/$/, ""), apiKey, {
      problemImage,
      answerImage,
    });
  } catch {
    return Response.json(
      {
        error: publicStreamErrorMessage,
      },
      { status: 502 },
    );
  }
}

function isValidImage(value: FormDataEntryValue | null): value is File {
  return value instanceof File && allowedImageTypes.has(value.type);
}

function streamDifyWorkflow(
  baseUrl: string,
  apiKey: string,
  files: {
    problemImage: File;
    answerImage: File;
  },
) {
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const [problemFile, answerFile] = await Promise.all([
          uploadFileToDify(baseUrl, apiKey, files.problemImage),
          uploadFileToDify(baseUrl, apiKey, files.answerImage),
        ]);
        const difyResponse = await runDifyWorkflowStream(baseUrl, apiKey, {
          problemFileId: problemFile.id,
          answerFileId: answerFile.id,
        });

        if (!difyResponse.body) {
          throw new Error("Empty Dify stream");
        }

        await forwardDifySse(difyResponse.body, controller);
      } catch {
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
    },
  });
}

async function uploadFileToDify(
  baseUrl: string,
  apiKey: string,
  file: File,
): Promise<DifyUploadedFile> {
  const body = new FormData();
  body.append("file", file);
  body.append("user", difyUser);

  const response = await fetch(`${baseUrl}/files/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body,
  });

  const data = await readJson(response);

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
  fileIds: {
    problemFileId: string;
    answerFileId: string;
  },
): Promise<Response> {
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

  if (!response.ok) {
    const data = await readJson(response);
    throw new Error(getDifyErrorMessage("Dify workflow run failed", data));
  }

  return response;
}

async function forwardDifySse(
  body: ReadableStream<Uint8Array>,
  controller: ReadableStreamDefaultController,
) {
  const reader = body.getReader();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += textDecoder.decode(value, { stream: true });
    const events = buffer.split(/\n\n/);
    buffer = events.pop() ?? "";

    for (const eventText of events) {
      controller.enqueue(textEncoder.encode(transformDifyEvent(eventText)));
    }
  }

  if (buffer.trim()) {
    controller.enqueue(textEncoder.encode(transformDifyEvent(buffer)));
  }
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
