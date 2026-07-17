import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { canAccessGradingRecord, extractStoredGradingReport, normalizeStoredScore } from "@/lib/grading-history";
import { historyTitle } from "@/lib/grading-title";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const logRequestId = randomUUID();
  const { searchParams } = new URL(request.url);
  const databaseId = searchParams.get("id");
  console.info(`[grading-history][api][${logRequestId}] detail request received`, { databaseId: databaseId ?? null });

  try {
    const session = await getCurrentSession();
    if (!session) return fail(logRequestId, databaseId, "session", "unauthenticated", 401, "未登录");
    if (session.role !== "student") return fail(logRequestId, databaseId, "authorization", "forbidden_role", 403, "无权查看该历史记录");

    if (!databaseId) return listHistory(session.id, logRequestId);

    console.info(`[grading-history][api][${logRequestId}] record lookup started`, { databaseId });
    const record = await prisma.submission.findUnique({
      where: { id: databaseId },
      select: {
        id: true,
        userId: true,
        requestId: true,
        workflowRunId: true,
        assignmentName: true,
        title: true,
        courseName: true,
        score: true,
        gradingResult: true,
        aiResult: true,
        createdAt: true,
        problemImageName: true,
        answerImageName: true,
        problemImageUrl: true,
        answerImageUrl: true,
        problemOcr: true,
      },
    });

    if (!record) return fail(logRequestId, databaseId, "lookup", "not_found", 404, "历史记录不存在");
    if (!canAccessGradingRecord(session.id, record.userId)) return fail(logRequestId, databaseId, "authorization", "record_owner_mismatch", 403, "无权查看该历史记录");
    console.info(`[grading-history][api][${logRequestId}] record found`, { databaseId, recordRequestId: record.requestId });

    const markdown = extractStoredGradingReport(record);
    console.info(`[grading-history][api][${logRequestId}] report extracted`, { databaseId, hasReport: Boolean(markdown), reportLength: markdown.length });
    const payload = {
      id: record.id,
      requestId: record.requestId,
      workflowRunId: record.workflowRunId,
      title: historyTitle(record.title, record.problemOcr, record.courseName),
      courseName: record.courseName,
      score: normalizeStoredScore(record.score),
      maxScore: 10,
      markdown,
      createdAt: record.createdAt,
      problemImageUrl: record.problemImageUrl ? protectedImageUrl(record.id, "problem") : null,
      answerImageUrl: record.answerImageUrl ? protectedImageUrl(record.id, "answer") : null,
    };
    console.info(`[grading-history][api][${logRequestId}] response sent`, { databaseId, status: 200 });
    return Response.json(payload);
  } catch (error) {
    return fail(logRequestId, databaseId, "unexpected", error instanceof Error ? error.name : "unknown", 500, "历史记录加载失败");
  }
}

async function listHistory(userId: string, logRequestId: string) {
  const records = await prisma.submission.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, requestId: true, title: true, problemOcr: true, courseName: true, score: true, gradingResult: true, aiResult: true, problemImageUrl: true, createdAt: true },
  });
  const history = records.map((record) => {
    const markdown = extractStoredGradingReport(record);
    return { id: record.id, requestId: record.requestId, title: historyTitle(record.title, record.problemOcr, record.courseName), problemImageUrl: record.problemImageUrl ? protectedImageUrl(record.id, "problem") : null, courseName: record.courseName, score: normalizeStoredScore(record.score), maxScore: 10, createdAt: record.createdAt, hasReport: Boolean(markdown) };
  });
  console.info(`[grading-history][api][${logRequestId}] response sent`, { status: 200, recordCount: history.length });
  return Response.json({ history });
}

function fail(requestId: string, databaseId: string | null, stage: string, errorType: string, status: number, message: string) {
  console.error(`[grading-history][api][${requestId}] request failed`, { databaseId, stage, errorType, status });
  return Response.json({ error: message, requestId }, { status });
}

function protectedImageUrl(id: string, kind: "problem" | "answer") {
  return `/api/grade/history/image?id=${encodeURIComponent(id)}&kind=${kind}`;
}
