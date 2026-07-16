import {
  BarChart3,
  ChevronDown,
  ClipboardCheck,
  FileWarning,
  Users,
} from "lucide-react";
import { EmptyState, formatScore, PageHeading, Panel } from "../components";
import { getRecordsData, noErrorLabel } from "@/lib/submissions";
import TeachingReportGenerator from "./TeachingReportGenerator";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const courseName = "理论力学";

export default async function TeacherAnalysisPage() {
  const { records } = await getRecordsData({ pageSize: 100, search: courseName });
  const analysis = buildAnalysis(records);
  const studentUserIds = [...new Set(records.map((record) => record.userId).filter((id): id is string => Boolean(id)))];
  const aiGuidanceCount = studentUserIds.length ? await prisma.aIConversation.count({ where: { userId: { in: studentUserIds }, type: "MECHANICS_ASSISTANT" } }) : 0;

  return (
    <>
      <PageHeading eyebrow="Learning Analytics" title="AI 学情分析驾驶舱" description="基于真实批改与提交数据，观察班级成绩表现、薄弱知识点和学生学习情况。" />

      <section className="border border-[#D8DEE8] bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-[#D8DEE8] bg-[#F8FAFD] px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0B4EA2]">Course Overview</p><h2 className="mt-1 text-xl font-semibold text-[#0B2545]">{courseName}</h2><p className="mt-1 text-xs text-slate-500">航空航天学院 · 班级学习数据概览</p></div>
          <span className={`w-fit px-3 py-1.5 text-xs font-semibold ${records.length ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{records.length ? "数据已同步" : "暂无课程数据"}</span>
        </div>
        {records.length ? <div className="grid gap-px bg-[#D8DEE8] sm:grid-cols-2 xl:grid-cols-5"><OverviewCard icon={<Users className="size-5" />} label="学生人数" value={String(analysis.studentCount)} unit="人" /><OverviewCard icon={<ClipboardCheck className="size-5" />} label="提交数量" value={String(records.length)} unit="次" /><OverviewCard icon={<BarChart3 className="size-5" />} label="平均成绩" value={formatScore(analysis.averageScore)} unit="分" /><OverviewCard icon={<FileWarning className="size-5" />} label="高频错误知识点" value={analysis.knowledgePoints[0]?.name ?? "暂无"} unit="" /><OverviewCard icon={<Users className="size-5" />} label="AI 辅导次数" value={String(aiGuidanceCount)} unit="次" /></div> : <div className="p-5"><EmptyState>暂无“{courseName}”课程提交数据，学生完成批改后将自动生成概览。</EmptyState></div>}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(300px,.8fr)_minmax(0,1.2fr)]">
        <Panel title="班级成绩分析">
          {analysis.scoredCount ? <div><div className="flex items-end justify-between border-b border-[#E7EBF1] pb-5"><div><p className="text-sm text-slate-500">班级平均成绩</p><p className="mt-2 text-4xl font-semibold text-[#0B4EA2]">{formatScore(analysis.averageScore)}<span className="ml-1 text-sm text-slate-500">分</span></p></div><span className="bg-[#EAF2FC] px-3 py-1.5 text-xs font-semibold text-[#163A70]">{analysis.scoredCount} 次有效评分</span></div><div className="mt-5 grid grid-cols-2 gap-4"><ScoreMetric label="最高分" value={analysis.highestScore} tone="emerald" /><ScoreMetric label="最低分" value={analysis.lowestScore} tone="amber" /></div></div> : <EmptyState>暂无有效成绩数据。</EmptyState>}
        </Panel>

        <Panel title="AI 薄弱知识点分析">
          {analysis.knowledgePoints.length ? <div className="space-y-5">{analysis.knowledgePoints.map((item, index) => <div key={item.name}><div className="grid grid-cols-[28px_minmax(0,1fr)_80px_70px] items-center gap-3 text-sm"><span className={`grid size-7 place-items-center text-xs font-semibold ${index < 3 ? "bg-[#0B4EA2] text-white" : "bg-slate-100 text-slate-500"}`}>{index + 1}</span><span className="truncate font-semibold text-[#0B2545]">{item.name}</span><span className="text-right text-slate-600">{item.count} 次</span><span className="text-right font-semibold text-[#0B4EA2]">{item.rate}%</span></div><div className="ml-10 mt-2 h-2 overflow-hidden bg-[#E7EBF1]"><div className="h-full bg-gradient-to-r from-[#0B4EA2] to-[#4B91E2]" style={{ width: `${item.relativeWidth}%` }} /></div></div>)}</div> : <EmptyState>暂无可统计的知识点错误数据。</EmptyState>}
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="成绩分布">
          <ChartBars items={analysis.scoreDistribution.map((item) => ({ label: item.label, value: item.count }))} />
        </Panel>
        <Panel title="错题 TOP5">
          <ChartBars items={analysis.errorTypes.slice(0, 5).map((item) => ({ label: item.name, value: item.count }))} />
        </Panel>
        <Panel title="活跃学生排行">
          <div className="space-y-3">{analysis.students.slice(0, 5).map((student, index) => <div key={student.key} className="flex items-center gap-3 border-b border-[#E7EBF1] pb-3 last:border-0"><span className="grid size-7 place-items-center bg-[#EAF2FC] text-xs font-bold text-[#0B4EA2]">{index + 1}</span><span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#0B2545]">{student.studentName}</span><span className="text-xs text-slate-500">{student.submissionCount} 次</span></div>)}</div>
        </Panel>
      </div>

      <section className="mt-6 border border-[#D8DEE8] bg-white shadow-sm">
        <div className="border-b border-[#D8DEE8] bg-[#F8FAFD] px-5 py-4"><h3 className="text-base font-semibold text-[#0B2545]">学生学情列表</h3><p className="mt-1 text-xs text-slate-500">点击学生行查看主要错误与最近学习情况</p></div>
        {analysis.students.length ? <div><div className="hidden grid-cols-[1.2fr_1fr_100px_110px_1.3fr_24px] gap-4 border-b border-[#D8DEE8] px-5 py-3 text-xs font-semibold text-slate-500 lg:grid"><span>学生姓名</span><span>学号</span><span>提交次数</span><span>平均分</span><span>主要错误</span><span /></div>{analysis.students.map((student) => <details key={student.key} className="group border-b border-[#E7EBF1] last:border-b-0"><summary className="grid cursor-pointer list-none gap-2 px-5 py-4 transition hover:bg-[#F8FAFD] lg:grid-cols-[1.2fr_1fr_100px_110px_1.3fr_24px] lg:items-center lg:gap-4 [&::-webkit-details-marker]:hidden"><span className="font-semibold text-[#0B2545]">{student.studentName}</span><span className="text-sm text-slate-500">{student.studentId || "无学号"}</span><span className="text-sm text-slate-600"><span className="lg:hidden">提交：</span>{student.submissionCount} 次</span><span className="text-lg font-semibold text-[#0B4EA2]">{formatScore(student.averageScore)} 分</span><span className="truncate text-sm text-slate-600">{student.mainError || "无明显错误"}</span><ChevronDown className="size-4 text-slate-400 transition group-open:rotate-180" /></summary><div className="grid gap-4 border-t border-[#E7EBF1] bg-[#F8FAFD] px-5 py-4 sm:grid-cols-3"><DetailMetric label="错误记录" value={`${student.errorCount} 次`} /><DetailMetric label="主要知识点" value={student.mainKnowledgePoint || "暂无提取"} /><DetailMetric label="课程" value={courseName} /></div></details>)}</div> : <div className="p-5"><EmptyState>暂无学生学情数据。</EmptyState></div>}
      </section>

      <TeachingReportGenerator course={courseName} students={analysis.students.map(({ studentName, studentId, submissionCount, averageScore, mainError, mainKnowledgePoint }) => ({ studentName, studentId, submissionCount, averageScore, mainError, mainKnowledgePoint }))} scores={records.map((record) => record.score).filter((score): score is number => score !== null)} assignments={records.map((record) => ({ name: record.assignmentName || record.problemImageName, score: record.score, createdAt: record.createdAt.toISOString() }))} />
    </>
  );
}

type RecordItem = Awaited<ReturnType<typeof getRecordsData>>["records"][number];

function buildAnalysis(records: RecordItem[]) {
  const scores = records.map((record) => record.score).filter((score): score is number => score !== null);
  const averageScore = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null;
  const errorRecords = records.filter((record) => record.errorType && record.errorType !== noErrorLabel);
  const errorTypeCounts = countValues(errorRecords.flatMap((record) => splitValues(record.errorType)));
  const pointCounts = countValues(errorRecords.flatMap((record) => splitValues(record.knowledgePoint)));
  const maxPointCount = Math.max(1, ...pointCounts.map((item) => item.count));
  const studentMap = new Map<string, { key: string; studentName: string; studentId: string | null; scores: number[]; submissionCount: number; errors: string[]; points: string[] }>();

  for (const record of records) {
    const key = record.studentId?.trim() || `name:${record.studentName}`;
    const student = studentMap.get(key) ?? { key, studentName: record.studentName, studentId: record.studentId, scores: [], submissionCount: 0, errors: [], points: [] };
    student.submissionCount += 1;
    if (record.score !== null) student.scores.push(record.score);
    if (record.errorType && record.errorType !== noErrorLabel) student.errors.push(record.errorType);
    student.points.push(...splitValues(record.knowledgePoint));
    studentMap.set(key, student);
  }

  return {
    studentCount: studentMap.size,
    scoredCount: scores.length,
    averageScore,
    highestScore: scores.length ? Math.max(...scores) : null,
    lowestScore: scores.length ? Math.min(...scores) : null,
    errorCount: errorRecords.length,
    errorTypes: errorTypeCounts.slice(0, 8).map((item) => ({ ...item, rate: errorRecords.length ? Math.round((item.count / errorRecords.length) * 100) : 0 })),
    scoreDistribution: [
      { label: "0-59", count: scores.filter((score) => score < 60).length },
      { label: "60-69", count: scores.filter((score) => score >= 60 && score < 70).length },
      { label: "70-79", count: scores.filter((score) => score >= 70 && score < 80).length },
      { label: "80-89", count: scores.filter((score) => score >= 80 && score < 90).length },
      { label: "90-100", count: scores.filter((score) => score >= 90).length },
    ],
    knowledgePoints: pointCounts.slice(0, 8).map((item) => ({ ...item, rate: errorRecords.length ? Math.round((item.count / errorRecords.length) * 100) : 0, relativeWidth: Math.round((item.count / maxPointCount) * 100) })),
    students: [...studentMap.values()].map((student) => ({ key: student.key, studentName: student.studentName, studentId: student.studentId, submissionCount: student.submissionCount, averageScore: student.scores.length ? student.scores.reduce((sum, score) => sum + score, 0) / student.scores.length : null, errorCount: student.errors.length, mainError: mostFrequent(student.errors), mainKnowledgePoint: mostFrequent(student.points) })).sort((a, b) => b.submissionCount - a.submissionCount),
  };
}

function splitValues(value: string | null) {
  return value ? value.split(/[、，,；;|/]/).map((item) => item.trim()).filter(Boolean) : [];
}

function countValues(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

function mostFrequent(values: string[]) {
  return countValues(values)[0]?.name ?? "";
}

function OverviewCard({ icon, label, value, unit, hint }: { icon: React.ReactNode; label: string; value: string; unit: string; hint?: string }) {
  return <article className="bg-white p-5"><div className="flex items-center justify-between"><span className="grid size-9 place-items-center bg-[#EAF2FC] text-[#0B4EA2]">{icon}</span>{hint ? <span className="text-[10px] text-slate-400">{hint}</span> : null}</div><p className="mt-4 text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold text-[#0B2545]">{value}<span className="ml-1 text-sm font-medium text-slate-500">{unit}</span></p></article>;
}

function ScoreMetric({ label, value, tone }: { label: string; value: number | null; tone: "emerald" | "amber" }) {
  return <div className={tone === "emerald" ? "bg-emerald-50 p-4" : "bg-amber-50 p-4"}><p className={tone === "emerald" ? "text-xs text-emerald-700" : "text-xs text-amber-700"}>{label}</p><p className={tone === "emerald" ? "mt-2 text-2xl font-semibold text-emerald-800" : "mt-2 text-2xl font-semibold text-amber-800"}>{formatScore(value)} 分</p></div>;
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold text-[#0B2545]">{value}</p></div>;
}

function ChartBars({ items }: { items: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return items.length ? <div className="space-y-4">{items.map((item) => <div key={item.label}><div className="flex items-center justify-between text-xs"><span className="truncate text-slate-600">{item.label}</span><strong className="text-[#0B2545]">{item.value}</strong></div><div className="mt-2 h-2 bg-[#E7EBF1]"><div className="h-full bg-[#0B4EA2]" style={{ width: `${Math.round((item.value / max) * 100)}%` }} /></div></div>)}</div> : <EmptyState>暂无可展示数据。</EmptyState>;
}
