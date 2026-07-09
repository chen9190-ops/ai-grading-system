import { getRecordsData } from "@/lib/submissions";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    return Response.json(
      await getRecordsData({
        page: Number(params.get("page")) || 1,
        pageSize: Number(params.get("pageSize")) || 20,
        search: params.get("search") || "",
      }),
    );
  } catch (error) {
    console.error("Failed to load records", error);
    return Response.json({ error: "批改记录加载失败" }, { status: 500 });
  }
}
