"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  BrainCircuit,
  Lightbulb,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  Target,
} from "lucide-react";

type SectionKey =
  | "classSummary"
  | "mainIssues"
  | "weakKnowledgePoints"
  | "teachingSuggestions"
  | "nextStagePlan";

export default function TeachingReportGenerator({
  course,
  students,
  scores,
  assignments,
}: {
  course: string;
  students: Array<Record<string, unknown>>;
  scores: number[];
  assignments: Array<Record<string, unknown>>;
}) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState("");
  const [message, setMessage] = useState("");
  const sections = useMemo(() => splitReportSections(report), [report]);

  async function generateReport() {
    if (!students.length || !scores.length) return;

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/report/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course,
          students,
          scores,
          assignments,
        }),
      });
      const payload: unknown = await response.json();

      if (
        !response.ok ||
        !isRecord(payload) ||
        payload.success !== true ||
        !isRecord(payload.report)
      ) {
        const error = isRecord(payload) && typeof payload.error === "string"
          ? payload.error
          : "教学报告生成失败";
        throw new Error(error);
      }

      setReport(formatStructuredReport(payload.report));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "教学报告生成失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  const canGenerate = students.length > 0 && scores.length > 0;

  return (
    <section className="mt-6 overflow-hidden border border-[#B9D2F2] bg-white shadow-sm">
      <div className="grid gap-6 bg-[linear-gradient(110deg,#EAF2FC_0%,#F8FAFD_65%,#FFFFFF_100%)] p-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center lg:p-6">
        <div><div className="flex items-center gap-3"><span className="grid size-11 place-items-center bg-[#0B4EA2] text-white"><BrainCircuit className="size-5" /></span><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0B4EA2]">AI Teaching Report</p><h3 className="mt-1 text-lg font-semibold text-[#0B2545]">AI 教学报告</h3></div></div><p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">将当前班级的真实成绩、知识点和错误类型统计提交至 Dify Workflow，生成课程学习总结与下一阶段教学建议。</p></div>
        <button type="button" onClick={generateReport} disabled={loading || !canGenerate} className="flex h-11 items-center justify-center gap-2 bg-[#0B4EA2] px-5 text-sm font-semibold text-white transition hover:bg-[#163A70] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500">{loading ? <LoaderCircle className="size-4 animate-spin" /> : report ? <RefreshCw className="size-4" /> : <Sparkles className="size-4" />}{loading ? "正在生成教学报告..." : report ? "重新生成报告" : "生成 AI 教学报告"}</button>
      </div>

      {message ? <div className="flex items-start gap-2 border-t border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><span>{message}</span></div> : null}

      {report ? (
        <div className="grid gap-px bg-[#D8DEE8] lg:grid-cols-2">
          <ReportCard icon={<BookOpenCheck className="size-5" />} title="班级学习总结" content={sections.classSummary} />
          <ReportCard icon={<AlertTriangle className="size-5" />} title="主要问题分析" content={sections.mainIssues} />
          <ReportCard icon={<Target className="size-5" />} title="薄弱知识点" content={sections.weakKnowledgePoints} />
          <ReportCard icon={<Lightbulb className="size-5" />} title="教学建议" content={sections.teachingSuggestions} />
          <ReportCard icon={<Sparkles className="size-5" />} title="下一阶段计划" content={sections.nextStagePlan} className="lg:col-span-2" />
        </div>
      ) : (
        <div className="grid gap-px bg-[#D8DEE8] sm:grid-cols-2 lg:grid-cols-5">{["班级学习总结", "主要问题分析", "薄弱知识点", "教学建议", "下一阶段计划"].map((title) => <div key={title} className="bg-white p-5"><span className="text-[#0B4EA2]"><Sparkles className="size-5" /></span><h4 className="mt-3 text-sm font-semibold text-[#0B2545]">{title}</h4><p className="mt-2 text-xs leading-5 text-slate-400">{canGenerate ? "点击生成报告后展示。" : "暂无可用班级成绩数据。"}</p></div>)}</div>
      )}
    </section>
  );
}

function ReportCard({ icon, title, content, className = "" }: { icon: React.ReactNode; title: string; content: string; className?: string }) {
  return <article className={`bg-white p-5 ${className}`}><div className="flex items-center gap-2 text-[#0B4EA2]">{icon}<h4 className="text-sm font-semibold text-[#0B2545]">{title}</h4></div><div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">{content || "Dify 本次返回未包含该章节。"}</div></article>;
}

function splitReportSections(report: string): Record<SectionKey, string> {
  const sections: Record<SectionKey, string[]> = {
    classSummary: [],
    mainIssues: [],
    weakKnowledgePoints: [],
    teachingSuggestions: [],
    nextStagePlan: [],
  };
  let active: SectionKey = "classSummary";

  for (const line of report.split("\n")) {
    const heading = matchSection(line);
    if (heading) {
      active = heading;
    } else {
      sections[active].push(line);
    }
  }

  return Object.fromEntries(
    Object.entries(sections).map(([key, lines]) => [key, lines.join("\n").trim()]),
  ) as Record<SectionKey, string>;
}

function matchSection(line: string): SectionKey | null {
  const heading = line.replace(/^[\s#>*\d.、（）()一二三四五]+/, "").replace(/[：:]$/, "").trim();
  if (/班级学习总结|学习总结|班级总结/.test(heading)) return "classSummary";
  if (/主要问题|问题分析|高频问题/.test(heading)) return "mainIssues";
  if (/薄弱知识点|知识薄弱|薄弱点/.test(heading)) return "weakKnowledgePoints";
  if (/教学建议|改进建议/.test(heading)) return "teachingSuggestions";
  if (/下一阶段|阶段计划|后续计划|推荐/.test(heading)) return "nextStagePlan";
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatStructuredReport(report: Record<string, unknown>) {
  if (typeof report.text === "string" && report.text.trim()) return report.text.trim();

  const sections = [
    ["班级学习总结", report.summary ?? report.classSummary],
    ["主要问题分析", report.mainIssues ?? report.problems],
    ["薄弱知识点", report.weakPoints ?? report.weakKnowledgePoints],
    ["教学建议", report.suggestions ?? report.teachingSuggestions],
    ["下一阶段计划", report.improvements ?? report.nextStagePlan],
  ];

  return sections
    .map(([title, value]) => `## ${title}\n${formatValue(value)}`)
    .join("\n\n");
}

function formatValue(value: unknown) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((item) => `- ${typeof item === "string" ? item : JSON.stringify(item)}`).join("\n");
  if (value !== undefined && value !== null) return JSON.stringify(value, null, 2);
  return "";
}
