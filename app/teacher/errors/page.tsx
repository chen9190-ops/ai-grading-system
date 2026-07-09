import { EmptyState, formatDate, PageHeading, Panel } from "../components";
import { getErrorStats } from "@/lib/submissions";

export const dynamic = "force-dynamic";

export default async function ErrorsPage() {
  const data = await getErrorStats();
  const maxErrorCount = Math.max(1, ...data.errorTypes.map((item) => item.count));

  return (
    <>
      <PageHeading eyebrow="Error Analysis" title="错题分析" description="聚合常见错误类型与知识点，快速定位需要重点讲解的内容。" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="错误类型分布">
          {data.errorTypes.length ? (
            <div className="space-y-4">
              {data.errorTypes.map((item) => (
                <div key={item.name}>
                  <div className="flex justify-between text-sm"><span className="font-medium text-[#0B2545]">{item.name}</span><span className="text-slate-500">{item.count} 次</span></div>
                  <div className="mt-2 h-2 bg-[#E7EBF1]"><div className="h-full bg-[#0B4EA2]" style={{ width: `${(item.count / maxErrorCount) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          ) : <EmptyState>暂无可统计的错误类型。</EmptyState>}
        </Panel>
        <Panel title="高频知识点">
          {data.knowledgePoints.length ? (
            <div className="flex flex-wrap gap-3">
              {data.knowledgePoints.map((item) => (
                <span key={item.name} className="border border-[#B9C4D4] bg-[#F8FAFD] px-3 py-2 text-sm font-medium text-[#163A70]">
                  {item.name} <strong className="ml-1">{item.count}</strong>
                </span>
              ))}
            </div>
          ) : <EmptyState>暂无可统计的知识点。</EmptyState>}
        </Panel>
      </div>
      <Panel title="近期首错记录" className="mt-6">
        {data.recentErrors.length ? (
          <div className="divide-y divide-[#E7EBF1]">
            {data.recentErrors.map((item) => (
              <article key={item.id} className="py-4 first:pt-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <strong className="text-sm text-[#0B2545]">{item.studentName}</strong>
                  {item.errorType ? <span className="bg-amber-50 px-2 py-1 text-amber-700">{item.errorType}</span> : null}
                  {item.knowledgePoint ? <span className="bg-[#EAF2FC] px-2 py-1 text-[#0B4EA2]">{item.knowledgePoint}</span> : null}
                  <span>{formatDate(item.createdAt)}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-700">{item.firstError}</p>
              </article>
            ))}
          </div>
        ) : <EmptyState>暂无首错记录。</EmptyState>}
      </Panel>
    </>
  );
}
