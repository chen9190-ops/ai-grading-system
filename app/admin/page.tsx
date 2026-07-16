import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, BookOpenCheck, Bot, Database, GraduationCap, Users } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { withBasePath } from "@/lib/base-path";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getCurrentSession();
  if (!session) redirect(withBasePath("/login"));
  if (session.role !== "admin") redirect(withBasePath(session.role === "teacher" ? "/teacher" : "/"));

  const [students, teachers, courses, conversations, examPapers, reports] = await Promise.all([
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.user.count({ where: { role: "TEACHER" } }),
    prisma.course.count(),
    prisma.aIConversation.count(),
    prisma.examPaper.count(),
    prisma.teachingReport.count(),
  ]);
  const aiCalls = conversations + examPapers + reports;

  return <main className="min-h-screen bg-[#F5F7FA] text-[#0B2545]"><header className="border-b-4 border-[#0B4EA2] bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#0B4EA2]">Administration</p><h1 className="mt-1 text-2xl font-semibold">平台管理后台</h1></div><Link href="/teacher" className="text-sm font-semibold text-[#0B4EA2]">返回教师工作台 →</Link></div></header><div className="mx-auto max-w-6xl space-y-8 px-5 py-8"><section><h2 className="text-lg font-semibold">用户与教学资源</h2><div className="mt-4 grid gap-4 sm:grid-cols-3"><AdminMetric icon={<GraduationCap className="size-5" />} label="学生数量" value={students} unit="人" /><AdminMetric icon={<Users className="size-5" />} label="教师数量" value={teachers} unit="人" /><AdminMetric icon={<BookOpenCheck className="size-5" />} label="课程数量" value={courses} unit="门" /></div></section><section><h2 className="text-lg font-semibold">系统状态</h2><div className="mt-4 grid gap-4 sm:grid-cols-2"><AdminMetric icon={<Bot className="size-5" />} label="AI 调用记录" value={aiCalls} unit="次" /><article className="border border-[#D8DEE8] bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><span className="grid size-10 place-items-center bg-emerald-50 text-emerald-700"><Database className="size-5" /></span><span className="flex items-center gap-2 text-xs font-semibold text-emerald-700"><Activity className="size-4" />运行正常</span></div><p className="mt-4 text-sm text-slate-500">数据库状态</p><p className="mt-2 text-2xl font-semibold">PostgreSQL 已连接</p></article></div></section></div></main>;
}

function AdminMetric({ icon, label, value, unit }: { icon: React.ReactNode; label: string; value: number; unit: string }) {
  return <article className="border border-[#D8DEE8] bg-white p-5 shadow-sm"><span className="grid size-10 place-items-center bg-[#EAF2FC] text-[#0B4EA2]">{icon}</span><p className="mt-4 text-sm text-slate-500">{label}</p><p className="mt-2 text-3xl font-semibold">{value}<span className="ml-1 text-sm text-slate-500">{unit}</span></p></article>;
}
