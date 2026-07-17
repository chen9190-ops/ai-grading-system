import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import {
  canAccessFollowupGrading,
  limitFollowupHistory,
  maxFollowupQuestionLength,
  validateFollowupQuestion,
  type FollowupMessage,
} from "@/lib/grading-followup-core";
import { callGradingFollowupDify, GradingFollowupDifyError } from "@/lib/grading-followup-dify";

export const runtime = "nodejs";

const followupInstruction = `你是本次题目批改后的讲解助手。
必须结合题目、学生答案和批改报告回答。
优先解释学生具体错在哪里、为什么错、正确思路是什么。
不得编造题目中不存在的条件。
如果批改报告与题目明显矛盾，应明确说明存在不确定性。
回答面向学生，语言清晰，可使用 Markdown 和 LaTeX。
不要重新输出整份批改报告，除非用户明确要求。`;

export async function POST(request: Request) {
  const requestId = randomUUID();
  const startedAt = Date.now();
  let gradingId = "";
  let conversationId: string | null = null;
  try {
    const session = await getCurrentSession();
    if (!session) return failure(requestId, "请先登录", 401);
    if (session.role !== "student") return failure(requestId, "无权使用该批改记录", 403);

    const body: unknown = await request.json().catch(() => null);
    if (!isRecord(body)) return failure(requestId, "请求数据格式不正确", 400);
    gradingId = typeof body.gradingId === "string" ? body.gradingId.trim() : "";
    const rawQuestion = typeof body.question === "string" ? body.question.trim() : "";
    if (!rawQuestion) return failure(requestId, "请输入追问内容", 400);
    if (rawQuestion.length > maxFollowupQuestionLength) return failure(requestId, `追问内容不能超过 ${maxFollowupQuestionLength} 字`, 400);
    const question = validateFollowupQuestion(rawQuestion);
    if (!question || !gradingId) return failure(requestId, "缺少有效的批改记录或追问内容", 400);

    console.info(`[grading-followup][${requestId}] request received`, { gradingId });
    const grading = await prisma.submission.findUnique({
      where: { id: gradingId },
      select: {
        id: true,
        userId: true,
        problemOcr: true,
        answerOcr: true,
        gradingResult: true,
        score: true,
        courseName: true,
        firstError: true,
        errorType: true,
        feedback: true,
      },
    });
    if (!grading) return failure(requestId, "未找到当前批改上下文", 404);
    if (!canAccessFollowupGrading(session.id, grading.userId)) return failure(requestId, "无权访问该批改记录", 403);

    const conversation = await prisma.gradingConversation.upsert({
      where: { gradingId_userId: { gradingId, userId: session.id } },
      create: { gradingId, userId: session.id },
      update: {},
      select: { id: true },
    });
    conversationId = conversation.id;
    const storedMessages = await prisma.gradingMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { role: true, content: true },
    });
    const history = limitFollowupHistory(storedMessages.reverse().filter(isFollowupMessage));
    const dify = await callGradingFollowupDify({
      url: process.env.DIFY_FOLLOWUP_API_URL,
      apiKey: process.env.DIFY_FOLLOWUP_API_KEY,
      query: question,
      user: session.id,
      inputs: {
        question_text: grading.problemOcr ?? "",
        student_answer: grading.answerOcr ?? "",
        grading_report: grading.gradingResult,
        score: grading.score === null ? "" : `${grading.score}/10`,
        subject: grading.courseName || "理论力学",
        error_analysis: [grading.errorType, grading.firstError].filter(Boolean).join("："),
        scoring_advice: grading.feedback ?? "",
        conversation_history: JSON.stringify(history),
        system_instruction: followupInstruction,
      },
    });

    await prisma.$transaction([
      prisma.gradingMessage.create({ data: { conversationId, role: "user", content: question } }),
      prisma.gradingMessage.create({ data: { conversationId, role: "assistant", content: dify.answer } }),
      prisma.gradingConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } }),
    ]);
    console.info(`[grading-followup][${requestId}] response sent`, {
      gradingId,
      conversationId,
      difyStatus: dify.status,
      elapsedMs: Date.now() - startedAt,
      outputLength: dify.answer.length,
    });
    return Response.json({ success: true, requestId, conversationId, answer: dify.answer });
  } catch (error) {
    const status = error instanceof GradingFollowupDifyError
      ? error.code === "TIMEOUT" ? 504 : error.code === "CONFIG" ? 503 : 502
      : 500;
    console.error(`[grading-followup][${requestId}] request failed`, {
      gradingId: gradingId || null,
      conversationId,
      difyStatus: error instanceof GradingFollowupDifyError ? error.status ?? null : null,
      elapsedMs: Date.now() - startedAt,
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    const message = error instanceof GradingFollowupDifyError ? error.message : "AI 追问暂时无法响应，请稍后重试";
    return failure(requestId, message, status);
  }
}

function failure(requestId: string, error: string, status: number) {
  return Response.json({ success: false, requestId, error }, { status });
}

function isFollowupMessage(value: { role: string; content: string }): value is FollowupMessage {
  return (value.role === "user" || value.role === "assistant") && Boolean(value.content.trim());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
