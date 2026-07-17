import Link from "next/link";
import { Bot, ClipboardCheck } from "lucide-react";
import { EmptyState, formatDate, formatScore, PageHeading, Panel } from "./components";
import { getDashboardData } from "@/lib/submissions";

export const dynamic = "force-dynamic";

export default async function TeacherDashboard() {
  const data = await getDashboardData();
  const cards = [
    { label: "学生数量", value: data.totalStudents, unit: "人" },
    { label: "今日提交", value: data.todaySubmissions, unit: "次" },
    { label: "平均成绩", value: formatScore(data.averageScore), unit: " / 10" },
    { label: "AI 辅导次数", value: data.aiGuidanceCount, unit: "次" },
  ];

  return (
    <>
      <PageHeading
        eyebrow="Overview"
        title="教学数据总览"
        description="快速了解课程批改进度、学生参与情况与近期反馈。"
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <article key={card.label} className="border border-[#D8DEE8] bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">{card.label}</p>
            <p className="mt-3 text-3xl font-semibold text-[#0B2545]">
              {card.value}
              <span className="ml-1 text-sm font-medium text-slate-500">{card.unit}</span>
            </p>
          </article>
        ))}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <Panel title="最近动态">
          {data.recentActivities.length ? (
            <div className="divide-y divide-[#E7EBF1]">
              {data.recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-center gap-3 py-4 first:pt-0">
                  <span className={`grid size-10 shrink-0 place-items-center ${activity.type === "ai" ? "bg-violet-50 text-violet-700" : "bg-blue-50 text-[#0B4EA2]"}`}>
                    {activity.type === "ai" ? <Bot className="size-5" /> : <ClipboardCheck className="size-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-[#0B2545]">{activity.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{activity.detail} · {formatDate(activity.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState>学生完成首次 AI 批改或学习对话后，动态会出现在这里。</EmptyState>
          )}
        </Panel>
        <Panel title="快捷入口">
          <div className="grid gap-3">
            {[
              ["/teacher/records", "查看全部批改记录"],
              ["/teacher/students", "查看学生完成情况"],
              ["/teacher/errors", "分析错误与知识点"],
            ].map(([href, label]) => (
              <Link key={href} href={href} className="border border-[#D8DEE8] bg-[#F8FAFD] px-4 py-3 text-sm font-semibold text-[#0B4EA2] transition hover:border-[#0B4EA2]">
                {label} →
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
