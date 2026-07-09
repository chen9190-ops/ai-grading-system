import { getDashboardData } from "@/lib/submissions";

export const runtime = "nodejs";

export async function GET() {
  try {
    return Response.json(await getDashboardData());
  } catch (error) {
    console.error("Failed to load dashboard", error);
    return Response.json({ error: "总览数据加载失败" }, { status: 500 });
  }
}
