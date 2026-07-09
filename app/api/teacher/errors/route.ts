import { getErrorStats } from "@/lib/submissions";

export const runtime = "nodejs";

export async function GET() {
  try {
    return Response.json(await getErrorStats());
  } catch (error) {
    console.error("Failed to load error stats", error);
    return Response.json({ error: "错题分析加载失败" }, { status: 500 });
  }
}
