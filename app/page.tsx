"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useState } from "react";
import ImageCropper from "./components/ImageCropper";
import MobileShell from "./components/mobile/MobileShell";
import { useRouter } from "next/navigation";
import {
  Bell,
  BookOpen,
  Bot,
  Camera,
  ChevronRight,
  CircleUserRound,
  Clock3,
  FileText,
  ImageIcon,
  RotateCcw,
  Satellite,
  Sparkles,
  Trash2,
} from "lucide-react";
import { withBasePath } from "@/lib/base-path";

type UploadKind = "question" | "answer";
type UploadValue = {
  file?: File;
  fileName: string;
  previewUrl: string;
  sourceFileName?: string;
  sourcePreviewUrl?: string;
};
type CropDraft = {
  fileName: string;
  previewUrl: string;
};
type GradeHistoryItem = {
  id: string;
  createdAt: string;
  workflowRunId?: string;
  problemFileName: string;
  answerFileName: string;
  resultPreview: string;
  score?: string;
};
type WorkflowStepKey =
  | "user_input"
  | "problem_recognition"
  | "answer_recognition"
  | "knowledge_retrieval"
  | "knowledge_available"
  | "branch"
  | "standard_solution"
  | "grading"
  | "output";
type WorkflowStepStatus = "idle" | "running" | "done";
type WorkflowStep = {
  key: WorkflowStepKey;
  label: string;
  status: WorkflowStepStatus;
};

const allowedImageTypes = new Set(["image/jpeg", "image/jpg", "image/png"]);
const allowedImageNamePattern = /\.(?:jpe?g|png)$/i;
const historyStorageKey = "ai-grading-history";
const gradingResultStorageKey = "ai-grading-current-result";
const maxHistoryItems = 10;
const incompleteCropHint = "请先完成题目图片和学生答案图片裁剪。";
const workflowStepDefinitions: Array<Omit<WorkflowStep, "status">> = [
  { key: "user_input", label: "用户输入" },
  { key: "problem_recognition", label: "题目识别" },
  { key: "answer_recognition", label: "答案识别" },
  { key: "knowledge_retrieval", label: "知识检索" },
  { key: "knowledge_available", label: "知识库可用性判断" },
  { key: "branch", label: "DIRECT / REFERENCE / NONE 分支" },
  { key: "standard_solution", label: "标准解生成" },
  { key: "grading", label: "批改" },
  { key: "output", label: "输出" },
];

function createWorkflowSteps(): WorkflowStep[] {
  return workflowStepDefinitions.map((step) => ({ ...step, status: "idle" }));
}

export default function Home() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [questionUpload, setQuestionUpload] = useState<UploadValue | null>(null);
  const [answerUpload, setAnswerUpload] = useState<UploadValue | null>(null);
  const [questionDraft, setQuestionDraft] = useState<CropDraft | null>(null);
  const [answerDraft, setAnswerDraft] = useState<CropDraft | null>(null);
  const [draggingKind, setDraggingKind] = useState<UploadKind | null>(null);
  const [status, setStatus] = useState("等待上传题目与学生答案");
  const [, setResult] = useState("");
  const [isGrading, setIsGrading] = useState(false);
  const [hasWorkflowEvent, setHasWorkflowEvent] = useState(false);
  const [workflowSteps, setWorkflowSteps] =
    useState<WorkflowStep[]>(createWorkflowSteps);
  const [history, setHistory] = useState<GradeHistoryItem[]>([]);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [studentName, setStudentName] = useState("匿名学生");
  const [studentId, setStudentId] = useState("");
  const [courseName, setCourseName] = useState("工程课程");
  const [className, setClassName] = useState("");

  useEffect(() => {
    let isActive = true;

    queueMicrotask(() => {
      if (!isActive) {
        return;
      }

      setMounted(true);
      setHistory(getStoredHistory());
    });

    return () => {
      isActive = false;
    };
  }, []);

  const completedStepCount = workflowSteps.filter(
    (step) => step.status === "done",
  ).length;
  const progressPercent = Math.round(
    (completedStepCount / workflowSteps.length) * 100,
  );

  const isReadyToGrade = Boolean(
    questionUpload?.file && answerUpload?.file && !questionDraft && !answerDraft,
  );
  const reportProgressSteps = useMemo(
    () => [
      {
        label: "正在上传图片",
        status: hasWorkflowEvent
          ? "done"
          : isGrading
            ? "running"
            : ("idle" as WorkflowStepStatus),
      },
      {
        label: "正在识别题目",
        status: getWorkflowStatus(workflowSteps, "problem_recognition"),
      },
      {
        label: "正在识别学生答案",
        status: getWorkflowStatus(workflowSteps, "answer_recognition"),
      },
      {
        label: "正在生成批改报告",
        status: getReportGenerationStatus(workflowSteps, isGrading),
      },
    ],
    [hasWorkflowEvent, isGrading, workflowSteps],
  );

  const uploadItems = useMemo(
    () => [
      {
        id: "question-upload",
        kind: "question" as const,
        title: "题目图片",
        description: "拖拽或点击上传题目截图",
        upload: questionUpload,
        draft: questionDraft,
      },
      {
        id: "answer-upload",
        kind: "answer" as const,
        title: "学生答案",
        description: "拖拽或点击上传答案图片",
        upload: answerUpload,
        draft: answerDraft,
      },
    ],
    [answerDraft, answerUpload, questionDraft, questionUpload],
  );

  function handleUpload(kind: UploadKind, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (file) {
      handleImageFile(kind, file);
    }
  }

  function handleDrop(kind: UploadKind, event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDraggingKind(null);

    const file = event.dataTransfer.files?.[0] ?? null;

    if (file) {
      handleImageFile(kind, file);
    }
  }

  function handleImageFile(kind: UploadKind, file: File) {
    if (!isAllowedImageFile(file)) {
      setStatus("仅支持 JPG、JPEG、PNG 图片");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const nextUpload = {
        fileName: file.name,
        previewUrl: String(reader.result),
      };

      if (kind === "question") {
        setQuestionDraft(nextUpload);
        setQuestionUpload(null);
      } else {
        setAnswerDraft(nextUpload);
        setAnswerUpload(null);
      }

      setResult("");
      setStatus("请先框选图片区域并确认裁剪");
    };

    reader.onerror = () => {
      setStatus("图片读取失败，请重新上传");
    };

    reader.readAsDataURL(file);
  }

  function isAllowedImageFile(file: File) {
    return (
      allowedImageTypes.has(file.type) || allowedImageNamePattern.test(file.name)
    );
  }

  function removeUpload(kind: UploadKind) {
    if (kind === "question") {
      setQuestionUpload(null);
      setQuestionDraft(null);
    } else {
      setAnswerUpload(null);
      setAnswerDraft(null);
    }

    setResult("");
    setStatus("已删除图片，可以重新上传");
  }

  function cancelCrop(kind: UploadKind) {
    if (kind === "question") {
      setQuestionDraft(null);
    } else {
      setAnswerDraft(null);
    }

    setStatus("已取消裁剪，可以重新上传");
  }

  function confirmCrop(kind: UploadKind, file: File, previewUrl: string) {
    const draft = kind === "question" ? questionDraft : answerDraft;
    const nextUpload = {
      file,
      fileName: file.name,
      previewUrl,
      sourceFileName: draft?.fileName,
      sourcePreviewUrl: draft?.previewUrl,
    };

    if (kind === "question") {
      setQuestionUpload(nextUpload);
      setQuestionDraft(null);
    } else {
      setAnswerUpload(nextUpload);
      setAnswerDraft(null);
    }

    setResult("");
    setStatus(`✓ ${kind === "question" ? "题目图片" : "学生答案图片"}已裁剪`);
  }

  function reCrop(kind: UploadKind, upload: UploadValue) {
    const nextDraft = {
      fileName: upload.sourceFileName ?? upload.fileName,
      previewUrl: upload.sourcePreviewUrl ?? upload.previewUrl,
    };

    if (kind === "question") {
      setQuestionDraft(nextDraft);
      setQuestionUpload(null);
    } else {
      setAnswerDraft(nextDraft);
      setAnswerUpload(null);
    }

    setResult("");
    setStatus("请重新框选图片区域并确认裁剪");
  }

  async function startGrading() {
    if (questionDraft || answerDraft) {
      setStatus(incompleteCropHint);
      return;
    }

    if (!questionUpload?.file || !answerUpload?.file) {
      setStatus(incompleteCropHint);
      return;
    }

    const formData = new FormData();
    formData.append("problem_image", questionUpload.file);
    formData.append("answer_image", answerUpload.file);

    setIsGrading(true);
    setHasWorkflowEvent(false);
    setStatus("正在调用 Dify 工作流...");
    setResult("");
    setWorkflowSteps(createWorkflowSteps());
    let latestWorkflowRunId = "";

    try {
      const response = await fetch(withBasePath("/api/grade"), {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("AI分析超时或服务繁忙，请重试");
      }

      if (!response.body) {
        throw new Error("AI分析超时或服务繁忙，请重试");
      }

      const nextResult = await readWorkflowStream(response.body, {
        onNodeStarted: (payload) => {
          setHasWorkflowEvent(true);
          const stepKey = matchWorkflowStep(payload);

          if (stepKey) {
            setWorkflowSteps((currentSteps) =>
              updateWorkflowStep(currentSteps, stepKey, "running"),
            );
            setStatus(`${getWorkflowStepLabel(stepKey)}进行中`);
          }
        },
        onNodeFinished: (payload) => {
          setHasWorkflowEvent(true);
          const stepKey = matchWorkflowStep(payload);

          if (stepKey) {
            setWorkflowSteps((currentSteps) =>
              updateWorkflowStep(currentSteps, stepKey, "done"),
            );
            setStatus(`${getWorkflowStepLabel(stepKey)}已完成`);
          }
        },
        onWorkflowFinished: (payload) => {
          console.log("Dify workflow_finished raw payload:", payload);
          latestWorkflowRunId = extractWorkflowRunId(payload);
          const workflowResult = normalizeReportMarkdown(extractDifyResult(payload));
          setHasWorkflowEvent(true);
          setWorkflowSteps((currentSteps) =>
            currentSteps.map((step) => ({ ...step, status: "done" })),
          );
          setStatus("批改完成");
          setResult(workflowResult);
        },
      });

      const normalizedResult = normalizeReportMarkdown(nextResult);
      setStatus("批改完成");
      setResult(normalizedResult);
      setHasWorkflowEvent(true);
      setWorkflowSteps((currentSteps) =>
        currentSteps.map((step) => ({ ...step, status: "done" })),
      );
      addHistoryItem({
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        workflowRunId: latestWorkflowRunId,
        problemFileName: questionUpload.fileName,
        answerFileName: answerUpload.fileName,
        resultPreview: createResultPreview(normalizedResult),
        score: extractScore(normalizedResult),
      });
      const submissionSaved = await saveSubmission({
        studentName,
        studentId,
        courseName,
        className,
        problemImageName: questionUpload.fileName,
        answerImageName: answerUpload.fileName,
        gradingResult: normalizedResult,
        assignmentName: `${courseName.trim() || "工程课程"} AI拍照解析`,
      });

      if (!submissionSaved) {
        setStatus("批改完成，但数据库记录保存失败");
      }

      saveGradingResult({
        questionImage: questionUpload.previewUrl,
        questionFileName: questionUpload.fileName,
        result: normalizedResult,
        score: extractScore(normalizedResult),
        questionType: courseName.trim() || "工程课程",
        difficulty: 3,
        knowledgePoints: extractKnowledgePoints(normalizedResult),
        errorLocation: extractReportField(normalizedResult, [
          "首个错误",
          "第一处错误",
          "错误位置",
        ]) ?? "",
        errorReason: extractReportField(normalizedResult, [
          "错误原因",
          "原因分析",
          "错误类型",
        ]) ?? "",
        improvement: extractReportField(normalizedResult, [
          "改进建议",
          "学习建议",
          "建议",
        ]) ?? "",
      });
      router.push("/grading");
    } catch {
      setStatus("批改失败");
      setResult("AI分析超时或服务繁忙，请重试");
    } finally {
      setIsGrading(false);
    }
  }

  function addHistoryItem(item: GradeHistoryItem) {
    setHistory((currentHistory) => {
      const nextHistory = [item, ...currentHistory].slice(0, maxHistoryItems);

      if (mounted) {
        return saveHistorySafely(nextHistory);
      }

      return nextHistory;
    });
  }

  async function viewHistory(item: GradeHistoryItem) {
    setIsHistoryDrawerOpen(false);
    setResult("");
    setStatus("正在加载完整历史报告...");

    if (!item.workflowRunId) {
      setResult("该历史记录仅保存了预览，无法恢复完整报告，请重新批改。");
      setStatus("无法恢复完整历史报告");
      return;
    }

    try {
      const response = await fetch(
        withBasePath(`/api/grade/history?id=${encodeURIComponent(item.workflowRunId)}`),
      );
      const data = await response.json();

      if (!response.ok || typeof data?.result !== "string") {
        throw new Error("history unavailable");
      }

      const historyResult = normalizeReportMarkdown(data.result);
      setResult(historyResult);
      setStatus("已加载历史批改详情");
      saveGradingResult({
        questionImage: "",
        questionFileName: item.problemFileName,
        result: historyResult,
        score: item.score || extractScore(historyResult),
        questionType: courseName.trim() || "工程课程",
        difficulty: 3,
        knowledgePoints: extractKnowledgePoints(historyResult),
        errorLocation: extractReportField(historyResult, ["首个错误", "第一处错误", "错误位置"]) ?? "",
        errorReason: extractReportField(historyResult, ["错误原因", "原因分析", "错误类型"]) ?? "",
        improvement: extractReportField(historyResult, ["改进建议", "学习建议", "建议"]) ?? "",
      });
      router.push("/grading");
    } catch {
      setResult("历史记录详情暂时无法获取，请重新批改。");
      setStatus("历史记录详情暂时无法获取");
    }
  }

  function clearHistory() {
    setHistory([]);

    try {
      window.localStorage.removeItem(historyStorageKey);
    } catch {
      // Ignore storage failures so the page remains usable.
    }
  }

  return (
    <MobileShell>
        <header className="relative overflow-hidden px-5 pb-16 pt-5">
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="grid size-12 place-items-center overflow-hidden rounded-full border-2 border-white bg-gradient-to-br from-slate-700 to-slate-950 text-white shadow-md">
                <CircleUserRound className="size-8" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-lg font-bold tracking-tight">你好，张同学</p>
                <p className="mt-0.5 text-xs text-slate-500">航空航天学院</p>
              </div>
            </div>
            <button type="button" aria-label="通知" className="relative grid size-10 place-items-center rounded-full border border-white/80 bg-white/65 text-slate-700 shadow-sm backdrop-blur-md">
              <Bell className="size-5" />
              <span className="absolute right-2.5 top-2 size-2 rounded-full border border-white bg-red-500" />
            </button>
          </div>
        </header>

        <div className="relative -mt-10 space-y-5 px-4">
          <section className="overflow-hidden rounded-[24px] border border-white/75 bg-white/72 p-5 text-[#17243a] shadow-[0_14px_32px_rgba(71,85,105,.16)] backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-slate-500">07/07 - 07/13</p>
                <h2 className="mt-1 text-[15px] font-semibold">本周学习概览</h2>
              </div>
              <span className="rounded-full border border-white/80 bg-slate-100/75 px-2.5 py-1 text-[10px] text-slate-600">持续进步中</span>
            </div>
            <div className="mt-5 grid grid-cols-[96px_1fr] items-center gap-4">
              <div className="relative grid size-24 place-items-center rounded-full bg-[conic-gradient(#6688a8_0_82%,rgba(148,163,184,.24)_82%)] p-[7px] shadow-[0_8px_22px_rgba(71,85,105,.14)]">
                <div className="grid size-full place-items-center rounded-full bg-white/90 text-center shadow-inner">
                  <div><strong className="text-2xl">82%</strong><p className="text-[9px] text-slate-500">学习状态</p></div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[['8.5h','学习时长'],['32','完成题目'],['85%','正确率']].map(([value,label]) => (
                  <div key={label} className="border-l border-slate-300/70 first:border-0">
                    <strong className="text-base">{value}</strong>
                    <p className="mt-1 text-[9px] text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-[24px] border border-white/55 bg-[#dfe4e8]/72 p-3 shadow-[0_10px_28px_rgba(51,65,85,.11)] backdrop-blur-xl">
            <label htmlFor="question-upload" className="relative block cursor-pointer overflow-hidden rounded-[20px] border border-white/25 bg-[linear-gradient(135deg,#61778b_0%,#496780_48%,#31536f_100%)] p-5 text-white shadow-[0_10px_24px_rgba(51,65,85,.2)]">
              <div className="absolute -right-20 -bottom-28 size-56 rounded-full border border-white/15 bg-[radial-gradient(circle_at_32%_28%,rgba(255,255,255,.11)_0_5%,transparent_6%),radial-gradient(circle_at_58%_45%,rgba(15,23,42,.12)_0_8%,transparent_9%),linear-gradient(145deg,rgba(226,232,240,.1),rgba(30,41,59,.08))] shadow-[inset_12px_10px_28px_rgba(255,255,255,.05)]" />
              <div className="absolute -right-4 top-8 h-28 w-52 -rotate-[18deg] rounded-[50%] border-t border-white/20" />
              <Satellite className="absolute right-7 top-3 size-7 rotate-12 text-slate-200/45" strokeWidth={1.25} />
              <span className="absolute right-[104px] top-[29px] size-1 rounded-full bg-white/50 shadow-[0_0_8px_rgba(255,255,255,.55)]" />
              <div className="relative flex min-h-28 items-center justify-between gap-3">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-[11px] text-slate-200"><Sparkles className="size-3.5" /> 智能识别 · 即刻解析</div>
                  <h2 className="text-[22px] font-bold">AI拍照解析</h2>
                  <p className="mt-1.5 text-xs text-slate-200">上传题目图片，获得专业讲解</p>
                  <div className="mt-4 flex gap-2 text-[9px] text-slate-100"><span>自动识别</span><span>·</span><span>步骤讲解</span><span>·</span><span>错误分析</span></div>
                </div>
                <div className="grid size-16 shrink-0 place-items-center rounded-2xl border border-white/25 bg-slate-100/10 shadow-inner backdrop-blur-sm"><Camera className="size-8 text-slate-50" strokeWidth={1.7} /></div>
              </div>
            </label>

            <div className="mt-3 space-y-3">
              {uploadItems.map((item) => {
                const isDragging = draggingKind === item.kind;
                return (
                  <div key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-[#f8fafc] p-3">
                    <input id={item.id} type="file" accept=".jpg,.jpeg,.png,image/jpeg,image/png" className="sr-only" onChange={(event) => handleUpload(item.kind, event)} />
                    {item.draft ? (
                      <div className="space-y-3">
                        <div><h3 className="text-sm font-semibold">裁剪{item.title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">移动和缩放图片，框选需要识别的区域</p></div>
                        <ImageCropper imageSrc={item.draft.previewUrl} fileName={item.draft.fileName} inputId={item.id} onCancel={() => cancelCrop(item.kind)} onConfirm={(file, previewUrl) => confirmCrop(item.kind, file, previewUrl)} />
                      </div>
                    ) : item.upload ? (
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.upload.previewUrl} alt={`${item.title}预览`} className="size-16 rounded-xl bg-white object-cover" />
                        <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{item.title} <span className="text-emerald-500">✓</span></p><p className="mt-1 truncate text-[11px] text-slate-500">{item.upload.fileName}</p></div>
                        <div className="flex gap-1"><button type="button" aria-label="重新裁剪" onClick={() => reCrop(item.kind, item.upload!)} className="grid size-8 place-items-center rounded-full bg-white text-blue-600 shadow-sm"><RotateCcw className="size-4" /></button><button type="button" aria-label="删除图片" onClick={() => removeUpload(item.kind)} className="grid size-8 place-items-center rounded-full bg-white text-slate-500 shadow-sm"><Trash2 className="size-4" /></button></div>
                      </div>
                    ) : (
                      <label htmlFor={item.id} onDragOver={(event) => { event.preventDefault(); setDraggingKind(item.kind); }} onDragLeave={() => setDraggingKind(null)} onDrop={(event) => handleDrop(item.kind, event)} className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border border-dashed px-3 transition ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-white'}`}>
                        <div className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-600"><ImageIcon className="size-5" /></div>
                        <div><p className="text-sm font-semibold">{item.title}</p><p className="mt-0.5 text-[11px] text-slate-500">点击拍照或从相册选择</p></div>
                        <ChevronRight className="ml-auto size-4 text-slate-400" />
                      </label>
                    )}
                  </div>
                );
              })}
            </div>

            <details className="mt-3 rounded-2xl bg-slate-50 px-3 py-2">
              <summary className="cursor-pointer text-xs font-semibold text-slate-600">完善本次批改信息（选填）</summary>
              <div className="mt-3 grid grid-cols-2 gap-2"><StudentField label="学生姓名" value={studentName} onChange={setStudentName} placeholder="匿名学生" /><StudentField label="学号" value={studentId} onChange={setStudentId} placeholder="选填" /><StudentField label="课程" value={courseName} onChange={setCourseName} placeholder="工程课程" /><StudentField label="班级" value={className} onChange={setClassName} placeholder="选填" /></div>
            </details>

            <div className="mt-3 rounded-2xl border border-white/45 bg-slate-200/55 p-3">
              <div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-medium text-slate-700">{status}</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-300/80"><div className="h-full rounded-full bg-[#5f7f9d] transition-[width]" style={{ width: `${progressPercent}%` }} /></div></div><button type="button" onClick={startGrading} disabled={isGrading || !isReadyToGrade} className="shrink-0 rounded-xl bg-[#496983] px-4 py-3 text-xs font-semibold text-white shadow-[0_5px_14px_rgba(51,65,85,.2)] transition active:bg-[#3d5b73] disabled:bg-slate-300">{isGrading ? 'AI解析中...' : '开始AI批改'}</button></div>
            </div>
          </section>

          {isGrading ? <section className="rounded-[24px] bg-white p-4 shadow-[0_8px_24px_rgba(30,41,59,.08)]"><div className="mb-4 flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-blue-600 text-white"><Bot className="size-5" /></div><div><h2 className="text-sm font-bold">AI 正在解析</h2><p className="text-[10px] text-slate-500">完成后将自动进入批改结果页</p></div></div><ReportProgress progressPercent={progressPercent} steps={reportProgressSteps} /></section> : null}

          <section>
            <div className="mb-3 flex items-center justify-between px-1"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-blue-600">History</p><h2 className="mt-0.5 text-lg font-bold">最近解析</h2></div><button type="button" onClick={() => setIsHistoryDrawerOpen(true)} className="flex items-center text-xs font-medium text-slate-500">查看全部 <ChevronRight className="size-4" /></button></div>
            <div className="overflow-hidden rounded-[22px] border border-white/80 bg-white/78 shadow-[0_8px_24px_rgba(30,41,59,.09)] backdrop-blur-xl">
              {mounted && history.length ? history.slice(0, 3).map((item, index) => <button type="button" key={item.id} onClick={() => viewHistory(item)} className={`flex w-full items-center gap-3 p-3 text-left ${index ? 'border-t border-slate-100' : ''}`}><div className="grid size-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 text-slate-500"><FileText className="size-6" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.problemFileName}</p><p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400"><BookOpen className="size-3" /> {courseName || '工程课程'} <span className="mx-1">·</span><Clock3 className="size-3" /> {formatHistoryTime(item.createdAt)}</p></div><div className="text-right"><strong className="text-base text-blue-600">{item.score || '--'}</strong><p className="text-[9px] text-slate-400">得分</p></div></button>) : <div className="px-5 py-8 text-center"><div className="mx-auto grid size-11 place-items-center rounded-full bg-slate-100 text-slate-400"><FileText className="size-5" /></div><p className="mt-3 text-sm font-medium text-slate-600">还没有解析记录</p><p className="mt-1 text-[11px] text-slate-400">完成首次 AI 批改后会显示在这里</p></div>}
            </div>
          </section>
        </div>

      {isHistoryDrawerOpen ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/35"
          role="dialog"
          aria-modal="true"
          aria-label="历史记录"
        >
          <button
            type="button"
            aria-label="关闭历史记录"
            className="absolute inset-0 cursor-default"
            onClick={() => setIsHistoryDrawerOpen(false)}
          />
          <aside className="relative mx-auto flex h-full w-full max-w-[430px] flex-col bg-white shadow-2xl">
            <div className="border-b border-[#D8DEE8] bg-[#F8FAFD] px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0B4EA2]">
                    History
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-[#0B2545]">
                    历史记录
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    最近 {mounted ? history.length : 0} 条批改记录
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsHistoryDrawerOpen(false)}
                  className="grid size-9 place-items-center border border-[#D8DEE8] bg-white text-lg leading-none text-slate-500 transition-colors hover:bg-[#F0F5FB] hover:text-[#0B4EA2]"
                  aria-label="关闭历史记录"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {mounted && history.length > 0 ? (
                <div className="space-y-3">
                  {history.slice(0, maxHistoryItems).map((item) => (
                    <article
                      key={item.id}
                      className="border border-[#D8DEE8] bg-[#F8FAFD] p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-500">
                            {formatHistoryTime(item.createdAt)}
                          </p>
                          <p className="mt-2 truncate text-xs font-semibold text-[#0B2545]">
                            题目：{item.problemFileName}
                          </p>
                          <p className="mt-1 truncate text-xs text-slate-600">
                            答案：{item.answerFileName}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => viewHistory(item)}
                          className="shrink-0 border border-[#0B4EA2] bg-white px-3 py-1 text-xs font-semibold text-[#0B4EA2] transition-colors hover:bg-[#F0F5FB]"
                        >
                          查看
                        </button>
                      </div>

                      {item.score ? (
                        <p className="mt-2 text-xs font-semibold text-emerald-700">
                          评分/得分：{item.score}
                        </p>
                      ) : null}

                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">
                        {item.resultPreview}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-center">
                  <p className="max-w-52 text-sm leading-6 text-slate-500">
                    批改完成后会自动保存轻量历史记录。
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-[#D8DEE8] bg-[#F8FAFD] p-4">
              <button
                type="button"
                onClick={clearHistory}
                disabled={!mounted || history.length === 0}
                className="h-10 w-full border border-[#D8DEE8] bg-white text-sm font-semibold text-[#0B4EA2] transition-colors hover:bg-[#F0F5FB] disabled:cursor-not-allowed disabled:text-slate-400"
              >
                清空历史记录
              </button>
            </div>
          </aside>
        </div>
      ) : null}
    </MobileShell>
  );
}

function ReportProgress({
  progressPercent,
  steps,
}: {
  progressPercent: number;
  steps: Array<{ label: string; status: WorkflowStepStatus }>;
}) {
  return (
    <div className="mx-auto max-w-4xl border border-[#D8DEE8] bg-[#F8FAFD] p-5 shadow-sm sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0B4EA2]">
            Workflow Progress
          </p>
          <h3 className="mt-1 text-base font-semibold text-[#0B2545]">
            Dify 工作流实时进度
          </h3>
        </div>
        <span className="text-sm font-semibold text-[#163A70]">
          {progressPercent}%
        </span>
      </div>

      <div className="mt-4 h-2 overflow-hidden border border-[#D8DEE8] bg-white">
        <div
          className="h-full bg-[#0B4EA2] transition-[width] duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {steps.map((step) => (
          <div
            key={step.label}
            className="flex items-center justify-between border border-[#D8DEE8] bg-white px-3 py-2 text-sm"
          >
            <span className="font-medium text-[#0B2545]">{step.label}</span>
            <span
              className={`font-semibold ${
                step.status === "done"
                  ? "text-emerald-600"
                  : step.status === "running"
                    ? "text-[#0B4EA2]"
                    : "text-slate-400"
              }`}
            >
              {step.status === "done"
                ? "已完成"
                : step.status === "running"
                  ? "进行中"
                  : "等待中"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StudentField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="text-xs font-medium text-[#0B2545]">
      {label}
      <input
        type="text"
        value={value}
        maxLength={100}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-9 w-full border border-[#D8DEE8] bg-white px-2 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-[#0B4EA2]"
      />
    </label>
  );
}

function getWorkflowStatus(
  steps: WorkflowStep[],
  key: WorkflowStepKey,
): WorkflowStepStatus {
  return steps.find((step) => step.key === key)?.status ?? "idle";
}

function getReportGenerationStatus(
  steps: WorkflowStep[],
  isGrading: boolean,
): WorkflowStepStatus {
  const reportStepKeys: WorkflowStepKey[] = [
    "knowledge_retrieval",
    "knowledge_available",
    "branch",
    "standard_solution",
    "grading",
    "output",
  ];
  const reportSteps = steps.filter((step) => reportStepKeys.includes(step.key));

  if (reportSteps.every((step) => step.status === "done")) {
    return "done";
  }

  if (reportSteps.some((step) => step.status === "running")) {
    return "running";
  }

  const answerStep = steps.find((step) => step.key === "answer_recognition");

  if (isGrading && answerStep?.status === "done") {
    return "running";
  }

  return "idle";
}

async function readWorkflowStream(
  body: ReadableStream<Uint8Array>,
  handlers: {
    onNodeStarted: (payload: unknown) => void;
    onNodeFinished: (payload: unknown) => void;
    onWorkflowFinished: (payload: unknown) => void;
  },
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split(/\n\n/);
    buffer = events.pop() ?? "";

    for (const eventText of events) {
      const event = parseSseEvent(eventText);

      if (!event) {
        continue;
      }

      const payload = parseSseData(event.data);
      const eventName = getDifyEventName(payload, event.event);

      if (eventName === "error") {
        throw new Error("AI分析超时或服务繁忙，请重试");
      }

      if (eventName === "node_started") {
        handlers.onNodeStarted(payload);
      }

      if (eventName === "node_finished") {
        handlers.onNodeFinished(payload);
      }

      if (eventName === "workflow_finished") {
        console.log("Dify workflow_finished raw payload:", payload);
        handlers.onWorkflowFinished(payload);
        finalResult = normalizeReportMarkdown(extractDifyResult(payload));
      }
    }
  }

  if (!finalResult) {
    throw new Error("AI分析超时或服务繁忙，请重试");
  }

  return finalResult;
}

function parseSseEvent(eventText: string) {
  const lines = eventText.split(/\n/);
  const dataLines: string[] = [];
  let event = "";

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  return {
    event,
    data: dataLines.join("\n"),
  };
}

function parseSseData(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

function getDifyEventName(payload: unknown, fallbackEventName: string) {
  if (typeof payload === "object" && payload !== null && "event" in payload) {
    const event = (payload as { event?: unknown }).event;

    if (typeof event === "string") {
      return event;
    }
  }

  return fallbackEventName;
}

function extractDifyResult(payload: unknown) {
  const workflowData =
    typeof payload === "string" ? tryParseJson(payload) ?? payload : payload;
  const event = getRecordValue(workflowData, "event");
  const data = getRecordValue(workflowData, "data");

  if (event === "workflow_finished") {
    const status = getRecordValue(data, "status");

    if (status === "failed") {
      return "AI分析失败，请稍后重试。";
    }
  }

  const directResult = getRecordValue(workflowData, "result");
  const outputs = getRecordValue(data, "outputs");
  const candidate =
  directResult ??
  getRecordValue(outputs, "direct_text") ??
  getRecordValue(outputs, "reference_text") ??
  getRecordValue(outputs, "none_text") ??
  getRecordValue(outputs, "text") ??
  getRecordValue(outputs, "result") ??
  getRecordValue(outputs, "output") ??
  getRecordValue(outputs, "answer") ??
  getRecordValue(workflowData, "answer");
  const text = extractTextCandidate(candidate);

  return cleanDifyText(
    text || "未获取到有效批改结果，请检查 Dify 输出节点变量是否为 text。",
  );
}

function extractTextCandidate(value: unknown): string {
  if (typeof value === "string") {
    const parsedText = parseJsonTextDeep(value);
    return parsedText ?? value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (typeof value === "object" && value !== null) {
    const text = getRecordValue(value, "text");

    if (typeof text === "string") {
      return parseJsonTextDeep(text) ?? text;
    }
  }

  return "";
}

function parseJsonTextDeep(value: string): string | null {
  const trimmedValue = value.trim();

  if (!trimmedValue.startsWith("{") && !trimmedValue.startsWith("[")) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmedValue);
    const text = getRecordValue(parsed, "text");

    return typeof text === "string" ? parseJsonTextDeep(text) ?? text : null;
  } catch {
    return null;
  }
}

function cleanDifyText(value: string) {
  return value
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .trim();
}

function normalizeReportMarkdown(value: string): string {
  const cleanedValue = value
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\\"/g, '"')
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, formula: string) => {
      return `$$\n${formula.trim()}\n$$`;
    })
    .replace(/\\\(([\s\S]*?)\\\)/g, (_, formula: string) => {
      return `$${formula.trim()}$`;
    });

  let isInsideDisplayMath = false;

  return cleanedValue
    .split("\n")
    .map((line) => {
      const trimmedLine = line.trim();

      if (!trimmedLine) {
        return line;
      }

      if (trimmedLine.startsWith("$$")) {
        const displayFenceCount = (trimmedLine.match(/\$\$/g) ?? []).length;

        if (displayFenceCount % 2 === 1) {
          isInsideDisplayMath = !isInsideDisplayMath;
        }

        return line;
      }

      if (isInsideDisplayMath || trimmedLine.startsWith("$")) {
        return line;
      }

      if (looksLikeBareLatexLine(trimmedLine)) {
        return `$$\n${trimmedLine}\n$$`;
      }

      return line;
    })
    .join("\n")
    .trim();
}

function looksLikeBareLatexLine(value: string) {
  return (
    value.startsWith("\\") &&
    /\\(frac|sqrt|omega|alpha|beta|gamma|delta|varphi|phi|tau|theta|sin|cos|tan|dot|tag|cdot|times|sum|int|lim|begin|end)/.test(
      value,
    )
  );
}

function tryParseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getRecordValue(value: unknown, key: string) {
  if (typeof value !== "object" || value === null || !(key in value)) {
    return undefined;
  }

  return (value as Record<string, unknown>)[key];
}

function extractWorkflowRunId(payload: unknown) {
  const workflowData =
    typeof payload === "string" ? tryParseJson(payload) ?? payload : payload;
  const data = getRecordValue(workflowData, "data");
  const id =
    getRecordValue(workflowData, "workflow_run_id") ??
    getRecordValue(data, "workflow_run_id") ??
    getRecordValue(data, "id");

  return typeof id === "string" ? id : "";
}

function createResultPreview(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 300);
}

function extractScore(value: string) {
  const match = value.match(
    /(?:评分|得分|综合评分|总分)\s*[:：]?\s*([0-9]+(?:\.[0-9]+)?\s*(?:\/\s*[0-9]+(?:\.[0-9]+)?)?)/,
  );

  return match?.[1]?.trim() || "";
}

function extractKnowledgePoints(value: string) {
  const knowledgeText = extractReportField(value, [
    "知识点",
    "考查知识点",
    "涉及知识点",
  ]);

  return (knowledgeText ?? "")
    .replace(/[*#`]/g, "")
    .split(/[、，,；;|/\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function saveGradingResult(payload: {
  questionImage: string;
  questionFileName: string;
  result: string;
  score: string;
  questionType: string;
  difficulty: number;
  knowledgePoints: string[];
  errorLocation: string;
  errorReason: string;
  improvement: string;
}) {
  try {
    window.sessionStorage.setItem(gradingResultStorageKey, JSON.stringify(payload));
  } catch {
    try {
      window.sessionStorage.setItem(
        gradingResultStorageKey,
        JSON.stringify({ ...payload, questionImage: "" }),
      );
    } catch {
      // Navigation still works if browser storage is unavailable.
    }
  }
}

async function saveSubmission(input: {
  studentName: string;
  studentId: string;
  courseName: string;
  className: string;
  problemImageName: string;
  answerImageName: string;
  gradingResult: string;
  assignmentName: string;
}) {
  const scoreText = extractScore(input.gradingResult);
  const score = scoreText ? Number(scoreText.split("/")[0].trim()) : null;
  const payload = {
    ...input,
    studentName: input.studentName.trim() || "匿名学生",
    courseName: input.courseName.trim() || "工程课程",
    score: Number.isFinite(score) ? score : null,
    problemOcr: extractReportField(input.gradingResult, [
      "题目识别",
      "题目OCR",
      "题目内容",
    ]),
    answerOcr: extractReportField(input.gradingResult, [
      "答案识别",
      "答案OCR",
      "学生答案",
    ]),
    problemDiagram: extractReportField(input.gradingResult, ["题目图形", "题目图示"]),
    answerDiagram: extractReportField(input.gradingResult, ["答案图形", "答案图示"]),
    firstError: extractReportField(input.gradingResult, [
      "首个错误",
      "第一处错误",
      "首次错误",
    ]),
    errorType: extractReportField(input.gradingResult, ["错误类型", "错误分类"]),
    knowledgePoint: extractReportField(input.gradingResult, [
      "知识点",
      "考查知识点",
      "涉及知识点",
    ]),
    problemImages: [input.problemImageName],
    answerImages: [input.answerImageName],
    feedback: extractReportField(input.gradingResult, ["改进建议", "学习建议", "建议"]),
  };

  try {
    const response = await fetch(withBasePath("/api/submissions"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return response.ok;
  } catch {
    return false;
  }
}

function extractReportField(report: string, labels: string[]) {
  for (const label of labels) {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const inlineMatch = report.match(
      new RegExp(
        `(?:^|\\n)\\s*(?:#{1,6}\\s*)?(?:\\*\\*)?${escapedLabel}(?:\\*\\*)?\\s*[:：]\\s*([^\\n]+)`,
        "i",
      ),
    );

    if (inlineMatch?.[1]?.trim()) {
      return inlineMatch[1].replace(/\*\*/g, "").trim().slice(0, 2000);
    }

    const sectionMatch = report.match(
      new RegExp(
        `(?:^|\\n)\\s*#{1,6}\\s*${escapedLabel}\\s*\\n+([\\s\\S]*?)(?=\\n\\s*#{1,6}\\s|$)`,
        "i",
      ),
    );

    if (sectionMatch?.[1]?.trim()) {
      return sectionMatch[1].trim().slice(0, 2000);
    }
  }

  return null;
}

function saveHistorySafely(history: GradeHistoryItem[]) {
  let nextHistory = history.slice(0, maxHistoryItems);

  while (nextHistory.length >= 0) {
    try {
      window.localStorage.setItem(historyStorageKey, JSON.stringify(nextHistory));
      return nextHistory;
    } catch {
      if (nextHistory.length === 0) {
        return [];
      }

      nextHistory = nextHistory.slice(0, -1);
    }
  }

  return [];
}

function matchWorkflowStep(payload: unknown): WorkflowStepKey | null {
  const normalizedNodeText = getNodeSearchText(payload);

  if (!normalizedNodeText) {
    return null;
  }

  if (includesAny(normalizedNodeText, ["用户输入", "user input", "start"])) {
    return "user_input";
  }

  if (includesAny(normalizedNodeText, ["题目识别", "problem", "question"])) {
    return "problem_recognition";
  }

  if (includesAny(normalizedNodeText, ["答案识别", "answer"])) {
    return "answer_recognition";
  }

  if (
    includesAny(normalizedNodeText, [
      "知识检索",
      "knowledge retrieval",
      "retrieval",
      "知识库检索",
    ])
  ) {
    return "knowledge_retrieval";
  }

  if (
    includesAny(normalizedNodeText, [
      "知识库可用性判断",
      "可用性",
      "availability",
      "available",
    ])
  ) {
    return "knowledge_available";
  }

  if (
    includesAny(normalizedNodeText, [
      "direct",
      "reference",
      "none",
      "分支",
      "branch",
      "ifelse",
      "if/else",
    ])
  ) {
    return "branch";
  }

  if (
    includesAny(normalizedNodeText, [
      "标准解",
      "标准答案",
      "solution",
      "reference answer",
    ])
  ) {
    return "standard_solution";
  }

  if (includesAny(normalizedNodeText, ["批改", "评分", "grade", "grading"])) {
    return "grading";
  }

  if (includesAny(normalizedNodeText, ["输出", "output", "end"])) {
    return "output";
  }

  return null;
}

function getNodeSearchText(payload: unknown) {
  if (typeof payload !== "object" || payload === null) {
    return "";
  }

  const data = "data" in payload ? (payload as { data?: unknown }).data : null;
  const record =
    typeof data === "object" && data !== null
      ? (data as Record<string, unknown>)
      : (payload as Record<string, unknown>);
  const parts = [
    record.title,
    record.name,
    record.node_id,
    record.node_type,
    record.node_name,
    record.workflow_node_id,
  ];

  return parts
    .filter((part): part is string => typeof part === "string")
    .join(" ")
    .toLowerCase();
}

function includesAny(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword.toLowerCase()));
}

function updateWorkflowStep(
  steps: WorkflowStep[],
  key: WorkflowStepKey,
  status: WorkflowStepStatus,
) {
  return steps.map((step) => {
    if (step.key !== key) {
      return step;
    }

    if (step.status === "done" && status === "running") {
      return step;
    }

    return { ...step, status };
  });
}

function getWorkflowStepLabel(key: WorkflowStepKey) {
  return (
    workflowStepDefinitions.find((step) => step.key === key)?.label ?? "工作流节点"
  );
}

function formatHistoryTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getStoredHistory() {
  if (typeof window === "undefined") {
    return [];
  }

  const storedHistory = window.localStorage.getItem(historyStorageKey);

  if (!storedHistory) {
    return [];
  }

  try {
    const parsedHistory = JSON.parse(storedHistory);
    return Array.isArray(parsedHistory)
      ? parsedHistory.filter(isGradeHistoryItem).slice(0, maxHistoryItems)
      : [];
  } catch {
    return [];
  }
}

function isGradeHistoryItem(value: unknown): value is GradeHistoryItem {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const item = value as Partial<GradeHistoryItem>;

  return (
    typeof item.id === "string" &&
    typeof item.createdAt === "string" &&
    typeof item.problemFileName === "string" &&
    typeof item.answerFileName === "string" &&
    typeof item.resultPreview === "string" &&
    (item.workflowRunId === undefined || typeof item.workflowRunId === "string") &&
    (item.score === undefined || typeof item.score === "string")
  );
}
