import { prisma } from "@/lib/prisma";

export const noErrorLabel = "无明显错误";

export async function getDashboardData() {
  const [totalSubmissions, studentRows, scoreStats, errorCount, recentRecords] =
    await Promise.all([
      prisma.submission.count(),
      prisma.submission.findMany({
        distinct: ["studentName", "studentId"],
        select: { studentName: true, studentId: true },
      }),
      prisma.submission.aggregate({
        _avg: { score: true },
        _max: { score: true },
      }),
      prisma.submission.count({
        where: {
          errorType: { not: null },
          NOT: { errorType: noErrorLabel },
        },
      }),
      prisma.submission.findMany({
        take: 6,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          studentName: true,
          courseName: true,
          score: true,
          errorType: true,
          createdAt: true,
        },
      }),
    ]);

  return {
    totalSubmissions,
    totalStudents: studentRows.length,
    averageScore: scoreStats._avg.score,
    highestScore: scoreStats._max.score,
    errorCount,
    recentRecords,
  };
}

export async function getRecordsData(options?: {
  page?: number;
  pageSize?: number;
  search?: string;
}) {
  const page = Math.max(1, options?.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options?.pageSize ?? 20));
  const search = options?.search?.trim();
  const where = search
    ? {
        OR: [
          { studentName: { contains: search, mode: "insensitive" as const } },
          { studentId: { contains: search, mode: "insensitive" as const } },
          { courseName: { contains: search, mode: "insensitive" as const } },
          { className: { contains: search, mode: "insensitive" as const } },
          { knowledgePoint: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : undefined;
  const [records, total] = await Promise.all([
    prisma.submission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.submission.count({ where }),
  ]);

  return { records, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function getStudentStats() {
  const submissions = await prisma.submission.findMany({
    select: {
      studentName: true,
      studentId: true,
      className: true,
      score: true,
      errorType: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  const students = new Map<
    string,
    {
      studentName: string;
      studentId: string | null;
      className: string | null;
      submissionCount: number;
      scoredCount: number;
      scoreTotal: number;
      errorCount: number;
      latestSubmissionAt: Date;
    }
  >();

  for (const item of submissions) {
    const key = item.studentId?.trim() || `name:${item.studentName}`;
    const current = students.get(key) ?? {
      studentName: item.studentName,
      studentId: item.studentId,
      className: item.className,
      submissionCount: 0,
      scoredCount: 0,
      scoreTotal: 0,
      errorCount: 0,
      latestSubmissionAt: item.createdAt,
    };
    current.submissionCount += 1;
    if (item.score !== null) {
      current.scoredCount += 1;
      current.scoreTotal += item.score;
    }
    if (item.errorType && item.errorType !== noErrorLabel) {
      current.errorCount += 1;
    }
    students.set(key, current);
  }

  return Array.from(students.values())
    .map(({ scoredCount, scoreTotal, ...student }) => ({
      ...student,
      averageScore: scoredCount ? scoreTotal / scoredCount : null,
    }))
    .sort((a, b) => b.submissionCount - a.submissionCount);
}

export async function getErrorStats() {
  const [errorTypes, knowledgePoints, recentErrors] = await Promise.all([
    prisma.submission.groupBy({
      by: ["errorType"],
      where: { errorType: { not: null }, NOT: { errorType: noErrorLabel } },
      _count: { _all: true },
      orderBy: { _count: { errorType: "desc" } },
    }),
    prisma.submission.groupBy({
      by: ["knowledgePoint"],
      where: { knowledgePoint: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { knowledgePoint: "desc" } },
    }),
    prisma.submission.findMany({
      where: { firstError: { not: null } },
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        studentName: true,
        firstError: true,
        errorType: true,
        knowledgePoint: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    errorTypes: errorTypes.map((item) => ({
      name: item.errorType,
      count: item._count._all,
    })),
    knowledgePoints: knowledgePoints.map((item) => ({
      name: item.knowledgePoint,
      count: item._count._all,
    })),
    recentErrors,
  };
}
