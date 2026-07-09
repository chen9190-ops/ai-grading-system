import { EmptyState, formatDate, formatScore, PageHeading } from "../components";
import { getRecordsData } from "@/lib/submissions";

export const dynamic = "force-dynamic";

export default async function RecordsPage() {
  const { records } = await getRecordsData({ pageSize: 100 });

  return (
    <>
      <PageHeading eyebrow="Records" title="批改记录" description="查看每次 AI 批改的学生、图片、得分与完整分析结果。" />
      {records.length ? (
        <div className="grid gap-4">
          {records.map((record) => (
            <details key={record.id} className="group border border-[#D8DEE8] bg-white shadow-sm">
              <summary className="grid cursor-pointer list-none gap-3 p-5 sm:grid-cols-[1.2fr_1fr_100px_24px] sm:items-center">
                <div>
                  <p className="font-semibold text-[#0B2545]">{record.studentName}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {record.studentId || "无学号"} · {record.className || "未填写班级"}
                  </p>
                </div>
                <div className="text-sm text-slate-600">
                  <p>{record.courseName}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDate(record.createdAt)}</p>
                </div>
                <p className="text-xl font-semibold text-[#0B4EA2]">{formatScore(record.score)} 分</p>
                <span className="text-xl text-slate-400 transition group-open:rotate-45">+</span>
              </summary>
              <div className="border-t border-[#D8DEE8] bg-[#F8FAFD] p-5">
                <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                  <Meta label="题目图片" value={record.problemImageName} />
                  <Meta label="答案图片" value={record.answerImageName} />
                  <Meta label="错误类型" value={record.errorType || "未提取"} />
                  <Meta label="知识点" value={record.knowledgePoint || "未提取"} />
                </div>
                {record.firstError ? (
                  <div className="mt-4 border-l-4 border-amber-400 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                    <strong>首个错误：</strong>{record.firstError}
                  </div>
                ) : null}
                <pre className="mt-4 max-h-[520px] overflow-auto whitespace-pre-wrap border border-[#D8DEE8] bg-white p-4 font-sans text-sm leading-7 text-slate-700">
                  {record.gradingResult}
                </pre>
              </div>
            </details>
          ))}
        </div>
      ) : (
        <EmptyState>暂无批改记录。</EmptyState>
      )}
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1 break-all font-medium text-[#0B2545]">{value}</p></div>;
}
