import { getStudentStats } from "@/lib/submissions";

export const runtime = "nodejs";

export async function GET() {
  try {
    return Response.json({ students: await getStudentStats() });
  } catch (error) {
    console.error("Failed to load student stats", error);
    return Response.json({ error: "学生统计加载失败" }, { status: 500 });
  }
}
