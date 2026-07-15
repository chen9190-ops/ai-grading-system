import { Prisma } from "@prisma/client";
import { callDifyChatflow, DifyChatflowError } from "@/lib/dify";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) return Response.json({ success: false, error: "未登录" }, { status: 401 });
  if (session.role !== "teacher" && session.role !== "admin") return Response.json({ success: false, error: "仅教师可生成正式试卷" }, { status: 403 });

  const input = await readInput(request);
  if (!input) return Response.json({ success: false, error: "试卷参数格式无效" }, { status: 400 });

  try {
    if (!(await prisma.user.findUnique({ where: { id: session.id }, select: { id: true } }))) {
      return Response.json({ success: false, error: "当前登录用户尚未建立数据库档案" }, { status: 409 });
    }
    const answerText = await callDifyChatflow({
      apiKey: process.env.DIFY_PRACTICE_API_KEY,
      url: process.env.DIFY_PRACTICE_URL || "https://api.dify.ai/v1/chat-messages",
      query: `生成${input.course}${input.chapter}共${input.count}道${input.difficulty}难度训练题。请仅返回包含 questions 和 answers 的 JSON。`,
      user: session.id,
      inputs: input,
    });
    const generated = parseExamPaper(answerText);
    if (!generated) throw new DifyChatflowError("试卷 Chatflow 未返回有效的 questions 和 answers JSON");

    const paper = await prisma.examPaper.create({
      data: {
        teacherId: session.id,
        courseName: input.course,
        chapter: input.chapter,
        difficulty: input.difficulty,
        questionCount: input.count,
        questions: generated.questions as Prisma.InputJsonValue,
        answer: generated.answers as Prisma.InputJsonValue,
      },
    });
    return Response.json({ success: true, paper });
  } catch (error) {
    console.error("Exam generation failed", error);
    return Response.json({ success: false, error: error instanceof DifyChatflowError ? error.message : "AI 试卷生成失败" }, { status: 502 });
  }
}

async function readInput(request: Request) {
  try {
    const value: unknown = await request.json();
    if (!isRecord(value)) return null;
    const course = text(value.course, 100);
    const chapter = text(value.chapter, 100);
    const difficulty = text(value.difficulty, 30);
    const count = value.count;
    if (!course || !chapter || !difficulty || typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > 100) return null;
    return { course, chapter, difficulty, count };
  } catch { return null; }
}

function parseExamPaper(value: string) {
  try {
    const normalized = value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed: unknown = JSON.parse(normalized);
    if (!isRecord(parsed)) return null;
    const questions = parsed.questions;
    const answers = parsed.answers ?? parsed.answer;
    if ((!Array.isArray(questions) && !isRecord(questions)) || (!Array.isArray(answers) && !isRecord(answers))) return null;
    return { questions, answers };
  } catch { return null; }
}

function text(value: unknown, max: number) { return typeof value === "string" && value.trim() && value.trim().length <= max ? value.trim() : ""; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
