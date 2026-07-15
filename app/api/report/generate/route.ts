import { Prisma } from "@prisma/client";
import { callDifyWorkflow, DifyChatflowError } from "@/lib/dify";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) return Response.json({ success: false, error: "未登录" }, { status: 401 });
  if (session.role !== "teacher" && session.role !== "admin") return Response.json({ success: false, error: "仅教师可生成教学报告" }, { status: 403 });

  const input = await readInput(request);
  if (!input) return Response.json({ success: false, error: "教学报告数据格式无效" }, { status: 400 });

  try {
    if (!(await prisma.user.findUnique({ where: { id: session.id }, select: { id: true } }))) {
      return Response.json({ success: false, error: "当前登录用户尚未建立数据库档案" }, { status: 409 });
    }
    const outputs = await callDifyWorkflow({
      apiKey: process.env.DIFY_TEACHER_REPORT_API_KEY,
      url: process.env.DIFY_WORKFLOW_URL || "https://api.dify.ai/v1/workflows/run",
      inputs: input,
      user: session.id,
    });
    const report = normalizeReport(outputs);
    const saved = await prisma.teachingReport.create({
      data: {
        teacherId: session.id,
        courseName: input.course,
        inputData: input as Prisma.InputJsonValue,
        report: report as Prisma.InputJsonValue,
      },
    });
    return Response.json({ success: true, report, reportId: saved.id });
  } catch (error) {
    console.error("Teaching report generation failed", error);
    return Response.json({ success: false, error: error instanceof DifyChatflowError ? error.message : "AI 教学报告生成失败" }, { status: 502 });
  }
}

async function readInput(request: Request) {
  try {
    const value: unknown = await request.json();
    if (!isRecord(value) || typeof value.course !== "string" || !value.course.trim() || value.course.length > 100 || !Array.isArray(value.students) || value.students.length > 1000 || !Array.isArray(value.scores) || value.scores.length > 10_000 || !Array.isArray(value.assignments) || value.assignments.length > 10_000) return null;
    if (!value.students.every(isRecord) || !value.assignments.every(isRecord) || !value.scores.every((score) => typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 100)) return null;
    return { course: value.course.trim(), students: value.students, scores: value.scores, assignments: value.assignments };
  } catch { return null; }
}

function normalizeReport(outputs: Record<string, unknown>) {
  const candidate = outputs.report;
  if (isRecord(candidate)) return candidate;
  if (typeof candidate === "string") {
    try { const parsed: unknown = JSON.parse(candidate); if (isRecord(parsed)) return parsed; } catch { return { text: candidate }; }
  }
  const text = outputs.text;
  return typeof text === "string" ? { text } : outputs;
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
