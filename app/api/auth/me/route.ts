import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) return Response.json({ success: false, data: null, error: "未登录" }, { status: 401 });

    const [user, scoreStats, recentErrors] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          studentProfile: { select: { studentId: true, major: true, className: true } },
          _count: { select: { submissions: true, conversations: true } },
        },
      }),
      prisma.submission.aggregate({ where: { userId: session.id }, _avg: { score: true } }),
      prisma.submission.findMany({
        where: { userId: session.id, firstError: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { id: true, courseName: true, knowledgePoint: true, errorType: true, score: true, createdAt: true },
      }),
    ]);
    if (!user) return Response.json({ success: false, data: null, error: "用户档案不存在" }, { status: 404 });

    const { _count, ...profile } = user;
    return Response.json({ success: true, data: { ...profile, learningStats: { completedGradings: _count.submissions, averageScore: scoreStats._avg.score, aiLearningCount: _count.conversations, recentErrors } }, error: null });
  } catch (error) {
    console.error("Current user profile failed", error);
    return Response.json({ success: false, data: null, error: "用户档案加载失败" }, { status: 500 });
  }
}
