import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DifySseParser, type DifySseEvent } from "@/lib/dify-sse";
import {
  cleanGradingMarkdown,
  extractScore,
  isReasonableGradingText,
  selectGradingReport,
} from "@/lib/grading-report";
import { selectQuestionTitle } from "@/lib/grading-title";
import {
  DifyRequestError,
  mapDifyError,
  withDifyRetry,
} from "@/lib/dify-error";
import { createDifyTimeoutController, getDifyGradingTimeoutMs } from "@/lib/dify-timeout";

type DifyUploadedFile = {
  id: string;
};

const allowedImageTypes = new Set(["image/jpeg", "image/png"]);
const difyUser = "ai-grading-system";
const textEncoder = new TextEncoder();
const responsePreviewLength = 500;
const maxImageSize = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const requestId = randomUUID();
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
      gradingErrorResponse(requestId, new DifyRequestError("Dify authentication configuration missing", 401)),
      { status: 500, headers: requestIdHeaders(requestId) },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    logError(requestId, "submission form data parse failed", errorDetails(error));
    return Response.json(
      { success: false, requestId, errorCode: "UNKNOWN_GRADING_ERROR", retryable: false, userMessage: "上传数据格式错误。" },
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
      { success: false, requestId, errorCode: "UNKNOWN_GRADING_ERROR", retryable: false, userMessage: "题目和答案必须是有效的 JPG、JPEG 或 PNG 图片。" },
      { status: 400, headers: requestIdHeaders(requestId) },
    );
  }

  try {
    const [problemImageUrl, answerImageUrl] = await Promise.all([
      persistGradingImage(problemImage),
      persistGradingImage(answerImage),
    ]);
    return streamDifyWorkflow(baseUrl.replace(/\/$/, ""), apiKey, requestId, request.signal, {
      problemImage,
      answerImage,
      problemImageUrl,
      answerImageUrl,
    });
  } catch (error) {
    logError(requestId, "grade stream creation failed", errorDetails(error));
    return Response.json(
      gradingErrorResponse(requestId, error),
      { status: 502, headers: requestIdHeaders(requestId) },
    );
  }
}

function isValidImage(value: FormDataEntryValue | null): value is File {
  return value instanceof File && allowedImageTypes.has(value.type) && value.size > 0 && value.size <= maxImageSize;
}

async function persistGradingImage(file: File) {
  const extension = file.type === "image/png" ? "png" : "jpg";
  const filename = `${randomUUID()}.${extension}`;
  const relativeUrl = `/api/grade/history/image?asset=${filename}`;
  const uploadDirectory = path.join(process.cwd(), "storage", "grading");
  await mkdir(uploadDirectory, { recursive: true });
  await writeFile(path.join(uploadDirectory, filename), Buffer.from(await file.arrayBuffer()), { flag: "wx" });
  return relativeUrl;
}

function streamDifyWorkflow(
  baseUrl: string,
  apiKey: string,
  requestId: string,
  clientSignal: AbortSignal,
  files: {
    problemImage: File;
    answerImage: File;
    problemImageUrl: string;
    answerImageUrl: string;
  },
) {
  const timeoutMs = getDifyGradingTimeoutMs();
  const startedAt = Date.now();
  let workflowRunId = "";
  logInfo(requestId, "Dify grading wait started", {
    timeoutMs,
    startedAt: new Date(startedAt).toISOString(),
  });
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const [problemFile, answerFile] = await Promise.all([
          uploadFileToDify(baseUrl, apiKey, requestId, "problem_image", files.problemImage, clientSignal, timeoutMs),
          uploadFileToDify(baseUrl, apiKey, requestId, "answer_image", files.answerImage, clientSignal, timeoutMs),
        ]);
        await withDifyRetry(async () => {
          const timeout = createDifyTimeoutController(timeoutMs);
          const abortForClient = () => timeout.controller.abort(new Error("CLIENT_REQUEST_ABORTED"));
          clientSignal.addEventListener("abort", abortForClient, { once: true });
          if (clientSignal.aborted) abortForClient();
          try {
            const difyResponse = await runDifyWorkflowStream(baseUrl, apiKey, requestId, {
              problemFileId: problemFile.id,
              answerFileId: answerFile.id,
            }, timeout.controller.signal);
            if (!difyResponse.body) throw new DifyRequestError("Empty Dify stream");
            await forwardDifySse(difyResponse.body, controller, requestId, { problemImageUrl: files.problemImageUrl, answerImageUrl: files.answerImageUrl }, (id) => { workflowRunId = id; });
          } catch (error) {
            if (timeout.didTimeOut()) throw new DifyRequestError("DIFY_REQUEST_TIMEOUT", undefined, workflowRunId);
            if (clientSignal.aborted) throw new DifyRequestError("CLIENT_REQUEST_ABORTED", undefined, workflowRunId);
            throw error;
          } finally {
            clientSignal.removeEventListener("abort", abortForClient);
            timeout.cleanup();
            timeout.controller.abort();
          }
        }, {
          onRetry: (error, attempt, delayMs) => logRetry(requestId, error, attempt, delayMs),
        });
      } catch (error) {
        const mapped = mapDifyError(error);
        logMappedError(requestId, error, mapped, {
          timeoutMs,
          startedAt: new Date(startedAt).toISOString(),
          elapsedMs: Date.now() - startedAt,
          abortedByController: error instanceof DifyRequestError && error.message === "DIFY_REQUEST_TIMEOUT",
          abortedByClient: clientSignal.aborted || (error instanceof DifyRequestError && error.message === "CLIENT_REQUEST_ABORTED"),
          workflowRunId: workflowRunId || null,
        });
        if (clientSignal.aborted) return;
        controller.enqueue(
          textEncoder.encode(
            `event: error\ndata: ${JSON.stringify({
              event: "error",
              success: false,
              requestId,
              errorCode: mapped.errorCode,
              retryable: mapped.retryable,
              userMessage: mapped.userMessage,
            })}\n\n`,
          ),
        );
      } finally {
        logInfo(requestId, "Dify grading wait ended", {
          timeoutMs,
          startedAt: new Date(startedAt).toISOString(),
          elapsedMs: Date.now() - startedAt,
          abortedByClient: clientSignal.aborted,
          workflowRunId: workflowRunId || null,
        });
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
  clientSignal: AbortSignal,
  timeoutMs: number,
): Promise<DifyUploadedFile> {
  logInfo(requestId, "Dify file upload started", {
    field,
    size: file.size,
    mimeType: file.type,
  });

  const uploadResult = await withDifyRetry(async () => {
    const currentBody = new FormData();
    currentBody.append("file", file);
    currentBody.append("user", difyUser);
    return withDifyAttemptTimeout(async (signal) => {
      const currentResponse = await fetch(`${baseUrl}/files/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: currentBody,
        signal,
      });
      const data = await readJson(currentResponse);
      if ([502, 503, 504].includes(currentResponse.status)) {
        throw new DifyRequestError(getDifyErrorMessage("Dify file upload failed", data), currentResponse.status);
      }
      return { response: currentResponse, data };
    }, timeoutMs, clientSignal);
  }, {
    onRetry: (error, attempt, delayMs) => logRetry(requestId, error, attempt, delayMs),
  });

  const { response, data } = uploadResult;
  logInfo(requestId, "Dify file upload returned", {
    field,
    status: response.status,
    responsePreview: safePreview(data),
  });

  if (!response.ok) {
    throw new DifyRequestError(getDifyErrorMessage("Dify file upload failed", data), response.status);
  }

  if (!isDifyUploadedFile(data)) {
    throw new DifyRequestError("Dify file upload response missing file id");
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
  signal: AbortSignal,
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
    signal,
  });

  logInfo(requestId, "Dify workflow returned", { status: response.status });

  if (!response.ok) {
    const data = await readJson(response);
    logInfo(requestId, "Dify workflow response preview", {
      responsePreview: safePreview(data),
    });
    throw new DifyRequestError(getDifyErrorMessage("Dify workflow run failed", data), response.status);
  }

  return response;
}

async function forwardDifySse(
  body: ReadableStream<Uint8Array>,
  controller: ReadableStreamDefaultController,
  requestId: string,
  media: { problemImageUrl: string; answerImageUrl: string },
  onWorkflowRunId: (workflowRunId: string) => void,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = new DifySseParser();
  let responsePreview = "";
  let workflowFinished = false;
  let finalResult = "";
  let streamedText = "";
  let nodeResult = "";
  let normalEnd = false;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        const decoderTail = decoder.decode();
        for (const event of parser.push(decoderTail)) {
          captureWorkflowRunId(event.payload, onWorkflowRunId);
          const state = handleDifyEvent(event, controller, requestId, streamedText, nodeResult, media);
          streamedText = state.streamedText;
          nodeResult = state.nodeResult;
          if (state.workflowFinished) {
            workflowFinished = true;
            finalResult = state.finalResult;
          }
        }
        normalEnd = true;
        break;
      }

      const decodedChunk = decoder.decode(value, { stream: true });
      if (responsePreview.length < responsePreviewLength) {
        responsePreview += decodedChunk.slice(0, responsePreviewLength - responsePreview.length);
      }
      for (const event of parser.push(decodedChunk)) {
        captureWorkflowRunId(event.payload, onWorkflowRunId);
        const state = handleDifyEvent(event, controller, requestId, streamedText, nodeResult, media);
        streamedText = state.streamedText;
        nodeResult = state.nodeResult;
        if (state.workflowFinished) {
          workflowFinished = true;
          finalResult = state.finalResult;
        }
      }
    }

    for (const event of parser.finish()) {
      captureWorkflowRunId(event.payload, onWorkflowRunId);
      const state = handleDifyEvent(event, controller, requestId, streamedText, nodeResult, media);
      if (state.workflowFinished) {
        workflowFinished = true;
        finalResult = state.finalResult;
      }
    }

    if (!workflowFinished || !finalResult) {
      throw new Error("Dify 流已结束，但没有最终批改结果");
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // The upstream stream may already be closed or aborted.
    }
    reader.releaseLock();
    logInfo(requestId, "Dify stream ended", {
      normalEnd,
      workflowFinished,
      finalResultExtracted: Boolean(finalResult),
    });
    logInfo(requestId, "Dify workflow response preview", {
      responsePreview: redactSecrets(responsePreview),
    });
  }
}

function handleDifyEvent(
  event: DifySseEvent,
  controller: ReadableStreamDefaultController,
  requestId: string,
  streamedText: string,
  nodeResult: string,
  media: { problemImageUrl: string; answerImageUrl: string },
) {
  logInfo(requestId, "Dify SSE event", { event: event.event });

  if (event.event === "workflow_failed" || event.event === "error") {
    throw new DifyRequestError(
      extractDifyEventError(event.payload) || "Dify workflow 执行失败",
      undefined,
      getWorkflowRunId(event.payload),
    );
  }
  if (
    event.event === "workflow_finished" &&
    getRecordValue(getRecordValue(event.payload, "data"), "status") === "failed"
  ) {
    throw new DifyRequestError(
      extractDifyEventError(event.payload) || "Dify workflow 执行失败",
      undefined,
      getWorkflowRunId(event.payload),
    );
  }

  let nextStreamedText = streamedText;
  const nextNodeResult = nodeResult;
  if (event.event === "text_chunk") {
    nextStreamedText += extractTextChunk(event.payload);
  }

  if (event.event === "workflow_finished") {
    const data = getRecordValue(event.payload, "data");
    const outputs = getRecordValue(data, "outputs") ?? getRecordValue(event.payload, "outputs");
    const selected = selectGradingReport(outputs);
    const streamedMarkdown = cleanGradingMarkdown(nextStreamedText);
    const finalResult = selected.markdown || (
      isReasonableGradingText(streamedMarkdown) ? streamedMarkdown : ""
    );
    const selectedOutputField = selected.markdown ? selected.selectedOutputField : finalResult ? "text_chunk" : null;
    logWorkflowFinishedDiagnostics(requestId, event.payload, outputs, selected, streamedMarkdown, finalResult);
    logInfo(requestId, "Dify grading output selected", {
      requestId,
      workflowRunId: getWorkflowRunId(event.payload) || null,
      availableOutputKeys: selected.outputKeys,
      selectedSourceField: selectedOutputField,
      selectedContentLength: finalResult.length,
      hadThinkBlock: selected.hadThinkBlock || /<think>[\s\S]*?<\/think>/i.test(nextStreamedText),
      outputsPreview: safePreview(outputs),
    });
    if (!finalResult) {
      logError(requestId, "DIFY_NO_GRADING_OUTPUT diagnostics", {
        workflowRunId: getWorkflowRunId(event.payload) || null,
        reason: explainMissingGradingOutput(outputs, selected.outputKeys, streamedMarkdown),
      });
      throw new DifyRequestError("DIFY_NO_GRADING_OUTPUT", undefined, getWorkflowRunId(event.payload));
    }
    logInfo(requestId, "Dify workflow_finished processed", {
      workflowFinished: true,
      finalResultExtracted: Boolean(finalResult),
    });
    const payload = isRecord(event.payload)
      ? {
          ...event.payload,
          result: finalResult,
          gradingReport: {
            requestId,
            score: selected.markdown ? selected.score : extractScore(finalResult),
            maxScore: 10,
            markdown: finalResult,
            createdAt: new Date().toISOString(),
            workflowRunId: getWorkflowRunId(event.payload),
            selectedOutputField,
            title: selectQuestionTitle(outputs, finalResult),
            problemImageUrl: media.problemImageUrl,
            answerImageUrl: media.answerImageUrl,
          },
        }
      : { event: "workflow_finished", result: finalResult };
    enqueueSse(controller, event.event, payload);
    return { streamedText: nextStreamedText, nodeResult: nextNodeResult, workflowFinished: true, finalResult };
  }

  enqueueSse(controller, event.event, event.payload ?? event.data);
  return { streamedText: nextStreamedText, nodeResult: nextNodeResult, workflowFinished: false, finalResult: "" };
}

function extractTextChunk(payload: unknown) {
  const data = getRecordValue(payload, "data");
  const text = getRecordValue(data, "text") ?? getRecordValue(payload, "text");
  return typeof text === "string" ? text : "";
}

function logWorkflowFinishedDiagnostics(
  requestId: string,
  payload: unknown,
  outputs: unknown,
  selected: ReturnType<typeof selectGradingReport>,
  streamedMarkdown: string,
  finalResult: string,
) {
  const data = getRecordValue(payload, "data");
  const outputEntries = isRecord(outputs)
    ? Object.entries(outputs).map(([key, value]) => ({
        key,
        type: value === null ? "null" : Array.isArray(value) ? "object" : typeof value,
        stringPreview: typeof value === "string"
          ? redactSecrets(value.slice(0, 200))
          : undefined,
      }))
    : [];

  logInfo(requestId, "Dify workflow_finished diagnostics", {
    requestId,
    workflowRunId: getWorkflowRunId(payload) || null,
    workflowStatus: getRecordValue(data, "status") ?? getRecordValue(payload, "status") ?? null,
    availableOutputKeys: outputEntries.map((entry) => entry.key),
    outputFields: outputEntries,
    extractGradingContentSourceField: selected.selectedOutputField,
    selectedContentLength: selected.selectedTextLength,
    textChunkFallbackMatched: !selected.markdown && Boolean(finalResult),
    textChunkLength: streamedMarkdown.length,
  });
}

function explainMissingGradingOutput(outputs: unknown, availableKeys: string[], streamedMarkdown: string) {
  if (outputs === null || outputs === undefined) return "workflow_finished did not contain outputs";
  if (!isRecord(outputs) && typeof outputs !== "string") return `outputs had unsupported type: ${typeof outputs}`;
  if (availableKeys.length === 0 && typeof outputs !== "string") return "outputs object had no first-level keys";
  if (streamedMarkdown && !isReasonableGradingText(streamedMarkdown)) {
    return "no supported output field contained reasonable grading text; text_chunk fallback was present but did not meet grading text validation";
  }
  return "no supported output field contained non-empty reasonable grading text, and no valid text_chunk fallback was available";
}

function getWorkflowRunId(payload: unknown) {
  const data = getRecordValue(payload, "data");
  const id =
    getRecordValue(payload, "workflow_run_id") ??
    getRecordValue(data, "workflow_run_id") ??
    getRecordValue(data, "id");
  return typeof id === "string" ? id : "";
}

function captureWorkflowRunId(payload: unknown, onWorkflowRunId: (workflowRunId: string) => void) {
  const workflowRunId = getWorkflowRunId(payload);
  if (workflowRunId) onWorkflowRunId(workflowRunId);
}

function enqueueSse(
  controller: ReadableStreamDefaultController,
  event: string,
  payload: unknown,
) {
  controller.enqueue(textEncoder.encode(
    `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`,
  ));
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
    .replace(/((?:api[_-]?key|token|secret)["'\s:=]+)[^\s,"'}]+/gi, "$1[REDACTED]")
    .replace(/((?:cookie|set-cookie)["'\s:=]+)[^\r\n]+/gi, "$1[REDACTED]");
}

function errorDetails(error: unknown) {
  return error instanceof Error
    ? { name: error.name, message: redactSecrets(error.message) }
    : { message: redactSecrets(String(error)) };
}

function extractDifyEventError(payload: unknown) {
  const data = getRecordValue(payload, "data");
  const candidate =
    getRecordValue(payload, "message") ??
    getRecordValue(payload, "error") ??
    getRecordValue(data, "message") ??
    getRecordValue(data, "error");
  return typeof candidate === "string" ? candidate : "";
}

function logInfo(requestId: string, message: string, details?: unknown) {
  console.info(`[grading][api][${requestId}] ${message}`, details ?? "");
}

function logError(requestId: string, message: string, details?: unknown) {
  console.error(`[grading][api][${requestId}] ${message}`, details ?? "");
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

async function withDifyAttemptTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  clientSignal: AbortSignal,
): Promise<T> {
  const timeout = createDifyTimeoutController(timeoutMs);
  const abortForClient = () => timeout.controller.abort(new Error("CLIENT_REQUEST_ABORTED"));
  clientSignal.addEventListener("abort", abortForClient, { once: true });
  if (clientSignal.aborted) abortForClient();
  try {
    return await operation(timeout.controller.signal);
  } catch (error) {
    if (timeout.didTimeOut()) throw new DifyRequestError("DIFY_REQUEST_TIMEOUT");
    if (clientSignal.aborted) throw new DifyRequestError("CLIENT_REQUEST_ABORTED");
    throw error;
  } finally {
    clientSignal.removeEventListener("abort", abortForClient);
    timeout.cleanup();
    timeout.controller.abort();
  }
}

function gradingErrorResponse(requestId: string, error: unknown) {
  const mapped = mapDifyError(error);
  return {
    success: false,
    requestId,
    errorCode: mapped.errorCode,
    retryable: mapped.retryable,
    userMessage: mapped.userMessage,
  };
}

function logRetry(requestId: string, error: unknown, attempt: number, delayMs: number) {
  const mapped = mapDifyError(error);
  logInfo(requestId, "Dify retry scheduled", {
    attempt,
    delayMs,
    error_type: mapped.errorType,
    targetHost: mapped.targetHost,
    timeout: mapped.timeout,
  });
}

function logMappedError(requestId: string, error: unknown, mapped = mapDifyError(error), timing?: Record<string, unknown>) {
  logError(requestId, "Dify request chain failed", {
    workflowRunId: error instanceof DifyRequestError ? error.workflowRunId ?? null : null,
    error_type: mapped.errorType,
    targetHost: mapped.targetHost,
    timeout: mapped.timeout,
    errorPreview: safePreview(error instanceof Error ? error.message : String(error)),
    ...timing,
  });
}

function getRecordValue(value: unknown, key: string) {
  if (typeof value !== "object" || value === null || !(key in value)) {
    return undefined;
  }

  return (value as Record<string, unknown>)[key];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
