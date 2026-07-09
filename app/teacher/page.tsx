import Link from "next/link";
import { EmptyState, formatDate, formatScore, PageHeading, Panel } from "./components";
import { getDashboardData } from "@/lib/submissions";

export const dynamic = "force-dynamic";

export default async function TeacherDashboard() {
  const data = await getDashboardData();
  const cards = [
    { label: "累计批改", value: data.totalSubmissions, unit: "次" },
    { label: "参与学生", value: data.totalStudents, unit: "人" },
    { label: "平均得分", value: formatScore(data.averageScore), unit: "分" },
    { label: "最高得分", value: formatScore(data.highestScore), unit: "分" },
    { label: "发现错误", value: data.errorCount, unit: "次" },
  ];

  return (
    <>
      <PageHeading
        eyebrow="Overview"
        title="教学数据总览"
        description="快速了解课程批改进度、学生参与情况与近期反馈。"
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
        <Panel title="最近批改">
          {data.recentRecords.length ? (
            <div className="divide-y divide-[#E7EBF1]">
              {data.recentRecords.map((record) => (
                <div key={record.id} className="flex flex-col gap-2 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-[#0B2545]">{record.studentName}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {record.courseName} · {formatDate(record.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {record.errorType ? (
                      <span className="bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                        {record.errorType}
                      </span>
                    ) : null}
                    <span className="text-lg font-semibold text-[#0B4EA2]">
                      {formatScore(record.score)} 分
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState>学生完成首次 AI 批改后，记录会出现在这里。</EmptyState>
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
