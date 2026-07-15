import { callDifyChatflow, DifyChatflowError } from "@/lib/dify";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) return Response.json({ success: false, error: "未登录" }, { status: 401 });
  if (session.role !== "student" && session.role !== "admin") return Response.json({ success: false, error: "无权使用训练中心" }, { status: 403 });

  const message = await readMessage(request);
  if (!message) {
    return Response.json(
      { success: false, error: "请输入有效的训练需求" },
      { status: 400 },
    );
  }

  try {
    if (!(await prisma.user.findUnique({ where: { id: session.id }, select: { id: true } }))) {
      return Response.json({ success: false, error: "当前登录用户尚未建立数据库档案" }, { status: 409 });
    }
    const paper = await callDifyChatflow({
      apiKey: process.env.DIFY_PRACTICE_API_KEY,
      url: process.env.DIFY_PRACTICE_URL || "https://api.dify.ai/v1/chat-messages",
      query: message,
      user: session.id,
    });
    const conversation = await prisma.aIConversation.create({
      data: { userId: session.id, type: "EXAM_GENERATOR", question: message, answer: paper },
      select: { id: true, createdAt: true },
    });
    return Response.json({ success: true, paper, conversation });
  } catch (error) {
    console.error("Practice Chatflow request failed", error);
    return Response.json(
      {
        success: false,
        error: error instanceof DifyChatflowError
          ? error.message
          : "AI 试卷生成暂时不可用",
      },
      { status: 502 },
    );
  }
}

async function readMessage(request: Request) {
  try {
    const value: unknown = await request.json();
    if (!isRecord(value) || typeof value.message !== "string") return "";
    const message = value.message.trim();
    return message.length > 0 && message.length <= 8000 ? message : "";
  } catch {
    return "";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
