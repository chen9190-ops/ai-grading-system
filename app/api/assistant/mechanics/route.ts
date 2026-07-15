import { Prisma } from "@prisma/client";
import { callDifyChatflow, DifyChatflowError } from "@/lib/dify";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) return Response.json({ success: false, error: "未登录" }, { status: 401 });
  if (session.role !== "student" && session.role !== "admin") return Response.json({ success: false, error: "无权使用学生助教" }, { status: 403 });

  const input = await readInput(request);
  if (!input) return Response.json({ success: false, error: "请输入有效的力学问题" }, { status: 400 });

  try {
    if (!(await userExists(session.id))) return Response.json({ success: false, error: "当前登录用户尚未建立数据库档案" }, { status: 409 });
    const answer = await callDifyChatflow({
      apiKey: process.env.DIFY_ASSISTANT_API_KEY,
      url: process.env.DIFY_ASSISTANT_URL || "https://api.dify.ai/v1/chat-messages",
      query: input.question,
      user: session.id,
      inputs: input.image ? { image: input.image } : {},
    });

    const conversation = await prisma.aIConversation.create({
      data: {
        userId: session.id,
        type: "MECHANICS_ASSISTANT",
        question: input.question,
        answer,
        knowledgeUsed: input.image ? { imageProvided: true } : Prisma.JsonNull,
      },
      select: { id: true, createdAt: true },
    });

    return Response.json({ success: true, answer, conversation });
  } catch (error) {
    console.error("Mechanics assistant request failed", error);
    return Response.json({ success: false, error: error instanceof DifyChatflowError ? error.message : "力学 AI 助教服务失败" }, { status: 502 });
  }
}

async function userExists(id: string) {
  return Boolean(await prisma.user.findUnique({ where: { id }, select: { id: true } }));
}

async function readInput(request: Request) {
  try {
    const value: unknown = await request.json();
    if (!isRecord(value) || typeof value.question !== "string") return null;
    const question = value.question.trim();
    const image = typeof value.image === "string" ? value.image.trim() : "";
    if (!question || question.length > 8000 || image.length > 2_000_000) return null;
    return { question, image: image || null };
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
