import { EmptyState, formatDate, formatScore, PageHeading } from "../components";
import { getStudentStats } from "@/lib/submissions";

export const dynamic = "force-dynamic";

export default async function StudentsPage() {
  const students = await getStudentStats();

  return (
    <>
      <PageHeading eyebrow="Students" title="学生完成情况" description="按学号或姓名汇总提交次数、平均得分和错误次数。" />
      {students.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {students.map((student) => (
            <article key={student.studentId || student.studentName} className="border border-[#D8DEE8] bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-[#0B2545]">{student.studentName}</h3>
                  <p className="mt-1 text-xs text-slate-500">{student.studentId || "无学号"} · {student.className || "未填写班级"}</p>
                </div>
                <span className="bg-[#EAF2FC] px-2 py-1 text-xs font-semibold text-[#0B4EA2]">{student.submissionCount} 次</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <Stat label="平均得分" value={`${formatScore(student.averageScore)} 分`} />
                <Stat label="错误记录" value={`${student.errorCount} 次`} />
              </div>
              <p className="mt-4 border-t border-[#E7EBF1] pt-4 text-xs text-slate-500">最近提交：{formatDate(student.latestSubmissionAt)}</p>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState>暂无学生提交数据。</EmptyState>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="bg-[#F8FAFD] p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold text-[#0B2545]">{value}</p></div>;
}
