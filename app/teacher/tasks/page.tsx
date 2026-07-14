"use client";

import { FormEvent, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  FileImage,
  FileText,
  Paperclip,
  Plus,
  Send,
  Upload,
  X,
} from "lucide-react";
import { EmptyState, PageHeading, Panel } from "../components";

const courses = ["理论力学", "材料力学", "空气动力学"];
const inputClassName = "h-11 w-full border border-[#B9C4D4] bg-white px-3 text-sm font-normal text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#0B4EA2] focus:ring-4 focus:ring-[#0B4EA2]/10";

export default function TeacherTasksPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState("");

  function publishTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("作业发布接口已预留。后端接入后可在此完成正式发布。");
  }

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeading eyebrow="Assignment Management" title="作业管理" description="创建课程教学任务，设置章节与截止时间，并跟踪学生提交进度。" />
        <button type="button" onClick={() => { setFormOpen(true); setStatus(""); }} className="flex h-11 shrink-0 items-center justify-center gap-2 bg-[#0B4EA2] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#163A70] focus:outline-none focus:ring-4 focus:ring-[#0B4EA2]/15"><Plus className="size-4" />创建作业</button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel title="已发布作业">
          <div className="hidden grid-cols-[1.4fr_1fr_160px_160px_100px] gap-4 border-b border-[#D8DEE8] pb-3 text-xs font-semibold text-slate-500 lg:grid">
            <span>作业名称</span><span>课程</span><span>发布时间</span><span>截止时间</span><span className="text-right">提交人数</span>
          </div>
          <EmptyState><span className="mx-auto mb-4 grid size-12 place-items-center bg-[#EAF2FC] text-[#0B4EA2]"><ClipboardList className="size-6" /></span><strong className="block text-base font-semibold text-[#0B2545]">暂无发布作业</strong><span className="mt-2 block">创建第一个教学任务。</span><button type="button" onClick={() => setFormOpen(true)} className="mt-5 border border-[#0B4EA2] bg-white px-4 py-2 text-sm font-semibold text-[#0B4EA2] transition hover:bg-[#EAF2FC]">立即创建</button></EmptyState>
        </Panel>

        <aside className="space-y-4">
          <div className="border border-[#D8DEE8] bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center bg-[#EAF2FC] text-[#0B4EA2]"><CalendarClock className="size-5" /></span><div><p className="text-sm font-semibold text-[#0B2545]">教学任务概览</p><p className="mt-1 text-xs text-slate-500">数据将在作业接口接入后展示</p></div></div><div className="mt-5 grid grid-cols-2 gap-3"><Stat label="已发布" value="—" /><Stat label="待截止" value="—" /><Stat label="累计提交" value="—" /><Stat label="平均完成率" value="—" /></div></div>
          <div className="border-l-4 border-[#0B4EA2] bg-[#EAF2FC] p-4 text-sm leading-6 text-[#163A70]"><strong>发布提示</strong><p className="mt-1">附件支持 PDF、JPG、JPEG 和 PNG。正式发布前请确认课程、章节与截止时间。</p></div>
        </aside>
      </div>

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/35 px-4 py-6 sm:items-center" role="dialog" aria-modal="true" aria-label="创建作业">
          <button type="button" aria-label="关闭创建作业" className="fixed inset-0 cursor-default" onClick={() => setFormOpen(false)} />
          <section className="relative w-full max-w-2xl border border-[#D8DEE8] bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b-4 border-[#0B4EA2] bg-[#F8FAFD] px-5 py-5 sm:px-6"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0B4EA2]">Create Assignment</p><h2 className="mt-1 text-xl font-semibold text-[#0B2545]">创建教学作业</h2><p className="mt-1 text-xs text-slate-500">填写教学任务信息并添加相关附件</p></div><button type="button" onClick={() => setFormOpen(false)} aria-label="关闭" className="grid size-9 place-items-center border border-[#D8DEE8] bg-white text-slate-500 transition hover:border-[#0B4EA2] hover:text-[#0B4EA2]"><X className="size-4" /></button></div>

            <form onSubmit={publishTask} className="p-5 sm:p-6">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="作业名称" className="sm:col-span-2"><input required name="title" type="text" maxLength={100} placeholder="请输入作业名称" className={inputClassName} /></Field>
                <Field label="课程"><div className="relative"><select required name="course" defaultValue="" className={`${inputClassName} appearance-none pr-10`}><option value="" disabled>请选择课程</option>{courses.map((course) => <option key={course} value={course}>{course}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" /></div></Field>
                <Field label="章节"><input required name="chapter" type="text" maxLength={100} placeholder="例如：第二章 静力学" className={inputClassName} /></Field>
                <Field label="截止时间" className="sm:col-span-2"><input required name="deadline" type="datetime-local" className={inputClassName} /></Field>
                <Field label="上传附件" hint="支持 PDF、JPG、JPEG、PNG，可多选" className="sm:col-span-2"><label className="flex min-h-32 cursor-pointer flex-col items-center justify-center border border-dashed border-[#B9C4D4] bg-[#F8FAFD] px-4 text-center transition hover:border-[#0B4EA2] hover:bg-[#F0F5FB]"><input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="sr-only" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} /><span className="grid size-10 place-items-center bg-[#0B4EA2] text-white"><Upload className="size-5" /></span><span className="mt-3 text-sm font-semibold text-[#0B2545]">点击选择教学附件</span><span className="mt-1 text-xs text-slate-500">单次可上传多个文件</span></label></Field>
              </div>

              {files.length ? <div className="mt-4 border border-[#D8DEE8] bg-[#F8FAFD] p-3"><p className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#0B2545]"><Paperclip className="size-4 text-[#0B4EA2]" />已选择 {files.length} 个附件</p><div className="space-y-2">{files.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center gap-2 bg-white px-3 py-2 text-xs text-slate-600">{file.type === "application/pdf" ? <FileText className="size-4 shrink-0 text-red-500" /> : <FileImage className="size-4 shrink-0 text-[#0B4EA2]" />}<span className="min-w-0 flex-1 truncate">{file.name}</span><button type="button" onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} aria-label={`移除 ${file.name}`} className="text-slate-400 hover:text-red-500"><X className="size-4" /></button></div>)}</div></div> : null}

              {status ? <div className="mt-4 flex items-start gap-2 border border-[#B9D2F2] bg-[#EAF2FC] p-3 text-sm text-[#163A70]"><CheckCircle2 className="mt-0.5 size-4 shrink-0" /><span>{status}</span></div> : null}

              <div className="mt-6 flex flex-col-reverse gap-3 border-t border-[#E7EBF1] pt-5 sm:flex-row sm:justify-end"><button type="button" onClick={() => setFormOpen(false)} className="h-11 border border-[#D8DEE8] bg-white px-5 text-sm font-semibold text-slate-600 transition hover:bg-[#F8FAFD]">取消</button><button type="submit" className="flex h-11 items-center justify-center gap-2 bg-[#0B4EA2] px-6 text-sm font-semibold text-white transition hover:bg-[#163A70]"><Send className="size-4" />发布作业</button></div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}

function Field({ label, hint, className = "", children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return <div className={`block text-sm font-semibold text-[#0B2545] ${className}`}><span>{label}</span>{hint ? <span className="ml-2 text-xs font-normal text-slate-400">{hint}</span> : null}<div className="mt-2">{children}</div></div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="bg-[#F8FAFD] p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold text-[#0B2545]">{value}</p></div>;
}
