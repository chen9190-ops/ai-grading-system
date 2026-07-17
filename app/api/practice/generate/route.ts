import { callDifyChatflow, DifyChatflowError } from "@/lib/dify";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { parsePracticePaper } from "@/lib/practice-paper";

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
      query: buildPracticePrompt(message),
      user: session.id,
      inputs: { training_request: message },
    });
    const conversation = await prisma.aIConversation.create({
      data: { userId: session.id, type: "EXAM_GENERATOR", question: message, answer: paper },
      select: { id: true, createdAt: true },
    });
    return Response.json({ success: true, paper, structuredPaper: parsePracticePaper(paper), conversation });
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

function buildPracticePrompt(message: string) {
  return `${message}

请生成结构化训练试卷，并且只返回一个 JSON 对象，不要使用 JSON 代码围栏。结构必须为：
{"paperTitle":"...","course":"...","chapter":"...","difficulty":"...","estimatedMinutes":60,"questions":[{"id":"q1","index":1,"score":10,"stemMarkdown":"...","imageUrl":null,"knowledgePoints":["..."],"difficulty":"中等","answer":"..."}]}

公式规范：
- 所有行内公式使用 \\( ... \\)。
- 所有独立公式使用 \\[ ... \\]。
- 单位使用 \\mathrm{N}、\\mathrm{m}、\\mathrm{N\\cdot m}。
- 不输出裸露 LaTeX 命令。
- 不使用 \`\`\`latex 代码块展示题目公式。
- 确保每个公式分隔符完整闭合。
- stemMarkdown 保留 Markdown 标题、列表与中文正文。`;
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
