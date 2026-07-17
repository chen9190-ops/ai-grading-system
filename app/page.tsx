"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useState } from "react";
import ImageCropper from "./components/ImageCropper";
import HistoryThumbnail from "./components/HistoryThumbnail";
import MobileShell from "./components/mobile/MobileShell";
import { useRouter } from "next/navigation";
import {
  Bell,
  BookOpen,
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
import { DifySseParser } from "@/lib/dify-sse";
import {
  extractScore,
  selectGradingReportFromPayload,
} from "@/lib/grading-report";
import { formatScoreWithMaximum, scoreProgress } from "@/lib/score-scale";
import { gradingHistoryPath } from "@/lib/grading-history";

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
type StudentLearningStats = {
  completedGradings: number;
  averageScore: number | null;
  aiLearningCount: number;
  currentCourse: string | null;
};
type GradeHistoryItem = {
  id: string;
  requestId: string | null;
  title: string;
  courseName: string;
  createdAt: string;
  score: number | null;
  maxScore: 10;
  hasReport: boolean;
  problemImageUrl: string | null;
};
const allowedImageTypes = new Set(["image/jpeg", "image/jpg", "image/png"]);
const allowedImageNamePattern = /\.(?:jpe?g|png)$/i;
const gradingResultStorageKey = "ai-grading-current-result";
const maxHistoryItems = 10;
const incompleteCropHint = "请先完成题目图片和学生答案图片裁剪。";
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
  const [history, setHistory] = useState<GradeHistoryItem[]>([]);
  const [studentName, setStudentName] = useState("匿名学生");
  const [studentId, setStudentId] = useState("");
  const [courseName, setCourseName] = useState("工程课程");
  const [className, setClassName] = useState("");
  const [learningStats, setLearningStats] = useState<StudentLearningStats>({ completedGradings: 0, averageScore: null, aiLearningCount: 0, currentCourse: null });

  useEffect(() => {
    let isActive = true;
    void loadGradingHistory().then((items) => {
      if (isActive) setHistory(items);
    }).finally(() => {
      if (isActive) setMounted(true);
    });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void fetch(withBasePath("/api/auth/me"), { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((payload: unknown) => {
        if (!active || !isRecord(payload) || !isRecord(payload.data)) return;
        const profile = isRecord(payload.data.studentProfile) ? payload.data.studentProfile : null;
        if (typeof payload.data.name === "string") setStudentName(payload.data.name);
        if (profile && typeof profile.studentId === "string") setStudentId(profile.studentId);
        if (profile && typeof profile.className === "string") setClassName(profile.className);
        if (isRecord(payload.data.learningStats)) {
          const stats = payload.data.learningStats;
          setLearningStats({
            completedGradings: typeof stats.completedGradings === "number" ? stats.completedGradings : 0,
            averageScore: typeof stats.averageScore === "number" ? stats.averageScore : null,
            aiLearningCount: typeof stats.aiLearningCount === "number" ? stats.aiLearningCount : 0,
            currentCourse: typeof stats.currentCourse === "string" ? stats.currentCourse : null,
          });
          if (typeof stats.currentCourse === "string") setCourseName(stats.currentCourse);
        }
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const averageScoreProgress = scoreProgress(learningStats.averageScore);

  const isReadyToGrade = Boolean(
    questionUpload?.file && answerUpload?.file && !questionDraft && !answerDraft,
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
    let gradeRequestUrl = "";
    let gradingRequestId = "";
    try {
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
      gradeRequestUrl = withBasePath("/api/grade");

    console.info("[grading][client] grade button clicked", {
      requestUrl: gradeRequestUrl,
      problemImage: {
        size: questionUpload.file.size,
        type: questionUpload.file.type,
      },
      answerImage: {
        size: answerUpload.file.size,
        type: answerUpload.file.type,
      },
    });

      setIsGrading(true);
      setStatus("正在调用 Dify 工作流...");
      setResult("");
      let latestWorkflowRunId = "";
      let recognizedTitle = "理论力学题目";
      let persistedProblemImageUrl = "";
      let persistedAnswerImageUrl = "";

      const response = await fetch(gradeRequestUrl, {
        method: "POST",
        body: formData,
      });
      gradingRequestId = response.headers.get("x-grading-request-id") ?? "";

      console.info("[grading][client] grade response received", {
        requestUrl: gradeRequestUrl,
        status: response.status,
        requestId: gradingRequestId,
      });

      if (!response.ok) {
        throw new Error(await readGradeError(response));
      }

      if (!response.body) {
        throw new Error("AI分析超时或服务繁忙，请重试");
      }

      const nextResult = await readWorkflowStream(response.body, {
        onNodeStarted: (payload) => {
          const stepLabel = matchWorkflowStepLabel(payload);
          if (stepLabel) {
            setStatus(`${stepLabel}进行中`);
          }
        },
        onNodeFinished: (payload) => {
          const stepLabel = matchWorkflowStepLabel(payload);
          if (stepLabel) {
            setStatus(`${stepLabel}已完成`);
          }
        },
        onWorkflowFinished: (payload) => {
          latestWorkflowRunId = extractWorkflowRunId(payload);
          const selectedReport = selectGradingReportFromPayload(payload);
          if (!selectedReport.markdown) {
            throw new Error(`未能读取 AI 批改正文，请使用 requestId ${gradingRequestId || "unknown"} 联系管理员。`);
          }
          const workflowResult = normalizeReportMarkdown(selectedReport.markdown);
          const gradingReport = getRecordValue(payload, "gradingReport");
          const title = getRecordValue(gradingReport, "title");
          const problemImageUrl = getRecordValue(gradingReport, "problemImageUrl");
          const answerImageUrl = getRecordValue(gradingReport, "answerImageUrl");
          if (typeof title === "string" && title.trim()) recognizedTitle = title.trim();
          if (typeof problemImageUrl === "string") persistedProblemImageUrl = problemImageUrl;
          if (typeof answerImageUrl === "string") persistedAnswerImageUrl = answerImageUrl;
          setStatus("批改完成");
          setResult(workflowResult);
        },
      });

      const normalizedResult = normalizeReportMarkdown(nextResult);
      const gradingScore = extractScore(normalizedResult);
      const createdAt = new Date().toISOString();
      setStatus("批改完成");
      setResult(normalizedResult);
      const savedSubmission = await saveSubmission({
        requestId: gradingRequestId,
        workflowRunId: latestWorkflowRunId,
        title: recognizedTitle,
        problemImageUrl: persistedProblemImageUrl,
        answerImageUrl: persistedAnswerImageUrl,
        studentName,
        studentId,
        courseName,
        className,
        problemImageName: questionUpload.fileName,
        answerImageName: answerUpload.fileName,
        gradingResult: normalizedResult,
        assignmentName: `${courseName.trim() || "工程课程"} AI拍照解析`,
      });

      if (savedSubmission) {
        addHistoryItem({ id: savedSubmission.id, requestId: gradingRequestId || null, title: recognizedTitle, courseName: courseName.trim() || "工程课程", createdAt, score: gradingScore, maxScore: 10, hasReport: true, problemImageUrl: persistedProblemImageUrl || null });
      } else {
        setStatus("批改完成，但数据库记录保存失败");
      }

      saveGradingResult({
        requestId: gradingRequestId,
        markdown: normalizedResult,
        createdAt,
        workflowRunId: latestWorkflowRunId,
        maxScore: 10,
        questionImage: questionUpload.previewUrl,
        questionFileName: questionUpload.fileName,
        score: gradingScore,
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
    } catch (error) {
      const errorMessage = error instanceof Error && error.message.trim()
        ? error.message
        : "AI分析超时或服务繁忙，请重试";
      console.error("[grading][client] grade request failed", {
        requestUrl: gradeRequestUrl,
        name: error instanceof Error ? error.name : "UnknownError",
        message: errorMessage,
      });
      setStatus(`批改失败：${errorMessage}`);
      setResult(errorMessage);
    } finally {
      setIsGrading(false);
    }
  }

  function addHistoryItem(item: GradeHistoryItem) {
    setHistory((currentHistory) => {
      return [item, ...currentHistory.filter((historyItem) => historyItem.id !== item.id)].slice(0, maxHistoryItems);
    });
  }

  function viewHistory(item: GradeHistoryItem) {
    router.push(gradingHistoryPath(item.id));
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
                <p className="text-lg font-bold tracking-tight">你好，{studentName === "匿名学生" ? "同学" : studentName}</p>
                <p className="mt-0.5 max-w-[245px] truncate text-xs text-slate-500">
                  学号 {studentId || "未绑定"} · {learningStats.currentCourse || "暂无当前课程"}
                </p>
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
                <p className="text-[11px] text-slate-500">当前课程 · {learningStats.currentCourse || "尚未开始课程"}</p>
                <h2 className="mt-1 text-[15px] font-semibold">个人学习概览</h2>
              </div>
              <span className="rounded-full border border-white/80 bg-slate-100/75 px-2.5 py-1 text-[10px] text-slate-600">持续进步中</span>
            </div>
            <div className="mt-5 grid grid-cols-[96px_1fr] items-center gap-4">
              <div className="relative grid size-24 place-items-center rounded-full p-[7px] shadow-[0_8px_22px_rgba(71,85,105,.14)]" style={{ background: `conic-gradient(#6688a8 0 ${Math.round(averageScoreProgress * 100)}%, rgba(148,163,184,.24) ${Math.round(averageScoreProgress * 100)}%)` }}>
                <div className="grid size-full place-items-center rounded-full bg-white/90 text-center shadow-inner">
                  <div><strong className="text-lg">{formatScoreWithMaximum(learningStats.averageScore)}</strong><p className="text-[9px] text-slate-500">平均成绩</p><p className="mt-0.5 text-[8px] text-slate-400">满分 10 分</p></div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[[String(learningStats.completedGradings),'批改次数'],[String(learningStats.aiLearningCount),'AI学习'],[learningStats.currentCourse || '--','当前课程']].map(([value,label]) => (
                  <div key={label} className="border-l border-slate-300/70 first:border-0">
                    <strong className="text-base">{value}</strong>
                    <p className="mt-1 text-[9px] text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-200/70 pt-4">
              <button type="button" onClick={() => router.push("/practice")} className="rounded-xl bg-blue-50 px-3 py-2.5 text-xs font-semibold text-blue-600">查看成绩分析</button>
              <button type="button" onClick={() => router.push("/errors")} className="rounded-xl bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-700">查看错题本</button>
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
              <div className="flex items-center justify-between gap-3"><p className="min-w-0 truncate text-xs font-medium text-slate-700">{status}</p><button type="button" onClick={startGrading} disabled={isGrading || !isReadyToGrade} className="shrink-0 rounded-xl bg-[#496983] px-4 py-3 text-xs font-semibold text-white shadow-[0_5px_14px_rgba(51,65,85,.2)] transition active:bg-[#3d5b73] disabled:bg-slate-300">{isGrading ? 'AI解析中...' : '开始AI批改'}</button></div>
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between px-1"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-blue-600">History</p><h2 className="mt-0.5 text-lg font-bold">最近解析</h2></div><button type="button" onClick={() => router.push("/grading/history")} className="flex items-center text-xs font-medium text-slate-500">查看全部 <ChevronRight className="size-4" /></button></div>
            <div className="overflow-hidden rounded-[22px] border border-white/80 bg-white/78 shadow-[0_8px_24px_rgba(30,41,59,.09)] backdrop-blur-xl">
              {mounted && history.length ? history.slice(0, 3).map((item, index) => <button type="button" key={item.id} onClick={() => viewHistory(item)} className={`flex w-full cursor-pointer items-center gap-3 p-3 text-left transition active:bg-blue-50 ${index ? 'border-t border-slate-100' : ''}`}><HistoryThumbnail title={item.title} imageUrl={item.problemImageUrl} /><div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-semibold leading-5">{item.title}</p><p className="mt-1 flex items-center gap-1 text-[10px] text-slate-400"><BookOpen className="size-3" /> {item.courseName} <span className="mx-1">·</span><Clock3 className="size-3" /> {formatHistoryTime(item.createdAt)}</p></div><div className="text-right"><strong className="text-base text-blue-600">{item.score === null ? "暂无评分" : formatScoreWithMaximum(item.score)}</strong><p className="text-[9px] text-slate-400">{item.hasReport ? "得分" : "无完整报告"}</p></div></button>) : <div className="px-5 py-8 text-center"><div className="mx-auto grid size-11 place-items-center rounded-full bg-slate-100 text-slate-400"><FileText className="size-5" /></div><p className="mt-3 text-sm font-medium text-slate-600">还没有解析记录</p><p className="mt-1 text-[11px] text-slate-400">完成首次 AI 批改后会显示在这里</p></div>}
            </div>
          </section>
        </div>

    </MobileShell>
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
  const parser = new DifySseParser();
  let finalResult = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      for (const event of parser.push(decoder.decode())) {
        finalResult = processWorkflowEvent(event.event, event.payload, handlers, finalResult);
      }
      break;
    }

    for (const event of parser.push(decoder.decode(value, { stream: true }))) {
      finalResult = processWorkflowEvent(event.event, event.payload, handlers, finalResult);
    }
  }

  for (const event of parser.finish()) {
    finalResult = processWorkflowEvent(event.event, event.payload, handlers, finalResult);
  }

  if (!finalResult) {
    throw new Error("AI分析超时或服务繁忙，请重试");
  }

  return finalResult;
}

function processWorkflowEvent(
  eventName: string,
  payload: unknown,
  handlers: {
    onNodeStarted: (payload: unknown) => void;
    onNodeFinished: (payload: unknown) => void;
    onWorkflowFinished: (payload: unknown) => void;
  },
  currentResult: string,
) {
  if (eventName === "error" || eventName === "workflow_failed") {
    throw new Error(extractStreamError(payload));
  }
  if (eventName === "node_started") handlers.onNodeStarted(payload);
  if (eventName === "node_finished") handlers.onNodeFinished(payload);
  if (eventName !== "workflow_finished") return currentResult;

  handlers.onWorkflowFinished(payload);
  const selectedReport = selectGradingReportFromPayload(payload);
  if (!selectedReport.markdown) {
    const gradingReport = getRecordValue(payload, "gradingReport");
    const requestId = getRecordValue(gradingReport, "requestId");
    throw new Error(`未能读取 AI 批改正文，请使用 requestId ${typeof requestId === "string" ? requestId : "unknown"} 联系管理员。`);
  }
  return normalizeReportMarkdown(selectedReport.markdown);
}

function extractStreamError(payload: unknown) {
  const data = getRecordValue(payload, "data");
  const message =
    getRecordValue(payload, "message") ??
    getRecordValue(payload, "error") ??
    getRecordValue(data, "message") ??
    getRecordValue(data, "error");
  return typeof message === "string" && message.trim()
    ? message
    : "AI分析超时或服务繁忙，请重试";
}

async function readGradeError(response: Response) {
  const payload: unknown = await response.json().catch(() => null);
  const message = getRecordValue(payload, "error") ?? getRecordValue(payload, "message");
  return typeof message === "string" && message.trim()
    ? message
    : `AI批改请求失败（${response.status}）`;
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
  requestId: string;
  markdown: string;
  createdAt: string;
  workflowRunId: string;
  maxScore: 10;
  questionImage: string;
  questionFileName: string;
  score: number | null;
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
  requestId: string;
  workflowRunId: string;
  title: string;
  problemImageUrl: string;
  answerImageUrl: string;
  studentName: string;
  studentId: string;
  courseName: string;
  className: string;
  problemImageName: string;
  answerImageName: string;
  gradingResult: string;
  assignmentName: string;
}) {
  const score = extractScore(input.gradingResult);
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
      "第一处实质性错误",
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

    if (!response.ok) return null;
    const data: unknown = await response.json();
    return isRecord(data) && isRecord(data.submission) && typeof data.submission.id === "string"
      ? { id: data.submission.id }
      : null;
  } catch {
    return null;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function matchWorkflowStepLabel(payload: unknown): string | null {
  const normalizedNodeText = getNodeSearchText(payload);

  if (!normalizedNodeText) {
    return null;
  }

  if (includesAny(normalizedNodeText, ["用户输入", "user input", "start"])) {
    return "用户输入";
  }

  if (includesAny(normalizedNodeText, ["题目识别", "problem", "question"])) {
    return "题目识别";
  }

  if (includesAny(normalizedNodeText, ["答案识别", "answer"])) {
    return "答案识别";
  }

  if (
    includesAny(normalizedNodeText, [
      "知识检索",
      "knowledge retrieval",
      "retrieval",
      "知识库检索",
    ])
  ) {
    return "知识检索";
  }

  if (
    includesAny(normalizedNodeText, [
      "知识库可用性判断",
      "可用性",
      "availability",
      "available",
    ])
  ) {
    return "知识库可用性判断";
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
    return "工作流分支";
  }

  if (
    includesAny(normalizedNodeText, [
      "标准解",
      "标准答案",
      "solution",
      "reference answer",
    ])
  ) {
    return "标准解生成";
  }

  if (includesAny(normalizedNodeText, ["批改", "评分", "grade", "grading"])) {
    return "批改";
  }

  if (includesAny(normalizedNodeText, ["输出", "output", "end"])) {
    return "输出";
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

function formatHistoryTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

async function loadGradingHistory(): Promise<GradeHistoryItem[]> {
  try {
    const response = await fetch(withBasePath("/api/grade/history"), { cache: "no-store" });
    const data: unknown = await response.json();
    if (!response.ok || !isRecord(data) || !Array.isArray(data.history)) return [];
    return data.history.filter(isGradeHistoryItem).slice(0, maxHistoryItems);
  } catch {
    return [];
  }
}

function isGradeHistoryItem(value: unknown): value is GradeHistoryItem {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && (value.requestId === null || typeof value.requestId === "string") && typeof value.title === "string" && typeof value.courseName === "string" && (value.score === null || typeof value.score === "number") && value.maxScore === 10 && typeof value.createdAt === "string" && typeof value.hasReport === "boolean" && (value.problemImageUrl === null || typeof value.problemImageUrl === "string");
}
