"use client";

import { FormEvent, useState } from "react";
import { BookOpenCheck, LoaderCircle, Sparkles } from "lucide-react";
import { PageHeading, Panel } from "../components";

const courses = ["理论力学", "材料力学", "空气动力学"];
const inputClass = "h-11 w-full border border-[#B9C4D4] bg-white px-3 text-sm outline-none focus:border-[#0B4EA2] focus:ring-4 focus:ring-[#0B4EA2]/10";

export default function TeacherExamPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [paper, setPaper] = useState<Record<string, unknown> | null>(null);

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setPaper(null);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/exam/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course: form.get("course"),
          chapter: form.get("chapter"),
          difficulty: form.get("difficulty"),
          count: Number(form.get("count")),
        }),
      });
      const payload: unknown = await response.json();
      if (!isRecord(payload) || !response.ok || payload.success !== true || !isRecord(payload.paper)) {
        throw new Error(isRecord(payload) && typeof payload.error === "string" ? payload.error : "试卷生成失败");
      }
      setPaper(payload.paper);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "试卷生成失败");
    } finally {
      setLoading(false);
    }
  }

  return <>
    <PageHeading eyebrow="AI Exam Generator" title="AI 生成试卷" description="按课程、章节与难度调用 Dify Chatflow，生成后自动保存到试卷库。" />
    <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
      <Panel title="生成参数"><form onSubmit={generate} className="space-y-4"><Field label="课程"><select name="course" className={inputClass}>{courses.map((course) => <option key={course}>{course}</option>)}</select></Field><Field label="章节"><input required name="chapter" placeholder="例如：第二章 静力学" className={inputClass} /></Field><Field label="难度"><select name="difficulty" className={inputClass}><option>基础</option><option>中等</option><option>提高</option></select></Field><Field label="题目数量"><input required name="count" type="number" min="1" max="100" defaultValue="10" className={inputClass} /></Field>{error ? <p className="border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}<button disabled={loading} className="flex h-11 w-full items-center justify-center gap-2 bg-[#0B4EA2] text-sm font-semibold text-white disabled:bg-slate-400">{loading ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{loading ? "AI 正在生成..." : "生成并保存试卷"}</button></form></Panel>
      <Panel title="试卷结果">{paper ? <div><div className="mb-4 flex items-center gap-2 text-[#0B4EA2]"><BookOpenCheck className="size-5" /><span className="text-sm font-semibold">已生成并写入数据库</span></div><pre className="max-h-[680px] overflow-auto whitespace-pre-wrap bg-[#F8FAFD] p-4 text-xs leading-6 text-slate-700">{JSON.stringify({ questions: paper.questions, answer: paper.answer }, null, 2)}</pre></div> : <div className="py-16 text-center text-sm text-slate-400">填写参数后生成试卷，结果将在这里展示。</div>}</Panel>
    </div>
  </>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-semibold text-[#0B2545]">{label}<div className="mt-2">{children}</div></label>; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
