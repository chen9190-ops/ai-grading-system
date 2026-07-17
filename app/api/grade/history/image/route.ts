import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { canAccessGradingRecord } from "@/lib/grading-history";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session) return Response.json({ error: "未登录" }, { status: 401 });
  if (session.role !== "student") return Response.json({ error: "无权查看该图片" }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const kind = searchParams.get("kind");
  if (!id || (kind !== "problem" && kind !== "answer")) return Response.json({ error: "图片参数无效" }, { status: 400 });

  const record = await prisma.submission.findUnique({ where: { id }, select: { userId: true, problemImageUrl: true, answerImageUrl: true } });
  if (!record) return Response.json({ error: "历史记录不存在" }, { status: 404 });
  if (!canAccessGradingRecord(session.id, record.userId)) return Response.json({ error: "无权查看该图片" }, { status: 403 });
  const storedUrl = kind === "problem" ? record.problemImageUrl : record.answerImageUrl;
  const filename = storedUrl ? new URL(storedUrl, "http://local").searchParams.get("asset") : null;
  if (!filename || !/^[0-9a-f-]+\.(?:jpg|png)$/i.test(filename)) return Response.json({ error: "图片不存在" }, { status: 404 });

  try {
    const content = await readFile(path.join(process.cwd(), "storage", "grading", filename));
    return new Response(content, { headers: { "Cache-Control": "private, max-age=3600", "Content-Type": filename.endsWith(".png") ? "image/png" : "image/jpeg", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return Response.json({ error: "图片不存在" }, { status: 404 });
  }
}
