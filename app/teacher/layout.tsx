import Link from "next/link";

const navigation = [
  { href: "/teacher", label: "总览" },
  { href: "/teacher/tasks", label: "作业管理" },
  { href: "/teacher/exams", label: "AI试卷" },
  { href: "/teacher/analysis", label: "学情分析" },
  { href: "/teacher/records", label: "批改记录" },
  { href: "/teacher/students", label: "学生统计" },
  { href: "/teacher/errors", label: "错题分析" },
];

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="blueprint-grid min-h-screen bg-[#F5F7FA] text-slate-950">
      <header className="border-b-4 border-[#0B4EA2] bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-center gap-4">
            <div className="grid size-12 shrink-0 place-items-center bg-[#0B4EA2] text-sm font-bold text-white">
              HUST
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0B4EA2]">
                Teacher Console
              </p>
              <h1 className="mt-1 text-xl font-semibold text-[#0B2545]">
                智能批改 · 教师工作台
              </h1>
            </div>
          </div>
          <Link
            href="/"
            className="text-sm font-semibold text-[#0B4EA2] hover:text-[#163A70]"
          >
            返回学生端 →
          </Link>
        </div>
        <nav className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 sm:px-6 lg:px-8">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 border-b-2 border-transparent px-3 py-3 text-sm font-semibold text-slate-600 transition hover:border-[#0B4EA2] hover:text-[#0B4EA2]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}
