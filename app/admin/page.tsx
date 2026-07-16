import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, BookOpenCheck, Bot, Database, FileCheck2, GraduationCap, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { withBasePath } from "@/lib/base-path";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getCurrentSession();
  if (!session) redirect(withBasePath("/login"));
  if (session.role !== "admin") redirect(withBasePath(session.role === "teacher" ? "/teacher" : "/"));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [students, teachers, courses, submissions, conversations, examPapers, reports, todayConversations, todayExamPapers, todayReports] = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.user.count({ where: { role: "TEACHER" } }),
    prisma.course.count(),
    prisma.submission.count(),
    prisma.aIConversation.count(),
    prisma.examPaper.count(),
    prisma.teachingReport.count(),
    prisma.aIConversation.count({ where: { createdAt: { gte: today } } }),
    prisma.examPaper.count({ where: { createdAt: { gte: today } } }),
    prisma.teachingReport.count({ where: { createdAt: { gte: today } } }),
  ]);
  const aiCalls = conversations + examPapers + reports;
  const todayAiCalls = todayConversations + todayExamPapers + todayReports;

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#F5F7FA] text-[#0B2545]">
      <header className="border-b-4 border-[#0B4EA2] bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#0B4EA2]">Administration</p><h1 className="mt-1 text-2xl font-semibold">系统概览 Dashboard</h1></div>
          <Link href="/teacher" className="min-h-11 self-start py-3 text-sm font-semibold text-[#0B4EA2] sm:self-auto">返回教师工作台 →</Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl space-y-8 px-5 py-8">
        <DashboardSection title="用户" description="平台账号规模">
          <AdminMetric icon={<GraduationCap className="size-5" />} label="学生数量" value={students} unit="人" />
          <AdminMetric icon={<Users className="size-5" />} label="教师数量" value={teachers} unit="人" />
        </DashboardSection>
        <DashboardSection title="教学" description="课程与批改数据">
          <AdminMetric icon={<BookOpenCheck className="size-5" />} label="课程数量" value={courses} unit="门" />
          <AdminMetric icon={<FileCheck2 className="size-5" />} label="提交数量" value={submissions} unit="次" />
        </DashboardSection>
        <DashboardSection title="AI 与系统" description="智能服务及基础设施状态" wide>
          <AdminMetric icon={<Bot className="size-5" />} label="AI 调用次数" value={aiCalls} unit="次" />
          <AdminMetric icon={<Activity className="size-5" />} label="今日调用" value={todayAiCalls} unit="次" />
          <article className="border border-[#D8DEE8] bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between"><span className="grid size-10 place-items-center bg-emerald-50 text-emerald-700"><Database className="size-5" /></span><span className="flex items-center gap-2 text-xs font-semibold text-emerald-700"><span className="size-2 rounded-full bg-emerald-500" />运行正常</span></div>
            <p className="mt-4 text-sm text-slate-500">数据库状态</p><p className="mt-2 text-xl font-semibold">PostgreSQL 已连接</p>
          </article>
        </DashboardSection>
      </div>
    </main>
  );
}

function DashboardSection({ title, description, children, wide = false }: { title: string; description: string; children: React.ReactNode; wide?: boolean }) {
  return <section><div><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div><div className={`mt-4 grid gap-4 sm:grid-cols-2 ${wide ? "lg:grid-cols-3" : ""}`}>{children}</div></section>;
}

function AdminMetric({ icon, label, value, unit }: { icon: React.ReactNode; label: string; value: number; unit: string }) {
  return <article className="min-w-0 border border-[#D8DEE8] bg-white p-5 shadow-sm"><span className="grid size-10 place-items-center bg-[#EAF2FC] text-[#0B4EA2]">{icon}</span><p className="mt-4 text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold tabular-nums">{value}<span className="ml-1 text-sm text-slate-500">{unit}</span></p></article>;
}
