"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useState } from "react";
import ImageCropper from "./components/ImageCropper";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";

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

const allowedImageTypes = new Set(["image/jpeg", "image/png"]);
const historyStorageKey = "ai-grading-history";
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
  const [mounted, setMounted] = useState(false);
  const [questionUpload, setQuestionUpload] = useState<UploadValue | null>(null);
  const [answerUpload, setAnswerUpload] = useState<UploadValue | null>(null);
  const [questionDraft, setQuestionDraft] = useState<CropDraft | null>(null);
  const [answerDraft, setAnswerDraft] = useState<CropDraft | null>(null);
  const [draggingKind, setDraggingKind] = useState<UploadKind | null>(null);
  const [status, setStatus] = useState("等待上传题目与学生答案");
  const [result, setResult] = useState("");
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
    if (!allowedImageTypes.has(file.type)) {
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
      const response = await fetch("/api/grade", {
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
      });

      if (!submissionSaved) {
        setStatus("批改完成，但数据库记录保存失败");
      }
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
        `/api/grade/history?id=${encodeURIComponent(item.workflowRunId)}`,
      );
      const data = await response.json();

      if (!response.ok || typeof data?.result !== "string") {
        throw new Error("history unavailable");
      }

      setResult(normalizeReportMarkdown(data.result));
      setStatus("已加载历史批改详情");
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
    <main className="blueprint-grid min-h-screen text-slate-950">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="border border-[#D8DEE8] bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b-4 border-[#0B4EA2] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center border border-[#0B4EA2] bg-[#0B4EA2] text-lg font-semibold text-white">
                HUST
              </div>
              <div className="min-w-0">
                <h1 className="mt-1 text-xl font-semibold tracking-normal text-[#0B2545] sm:text-2xl">
                  工程课程智能批改平台
                </h1>
                <p className="mt-1 font-sans text-xs uppercase tracking-[0.14em] text-slate-500">
                  Engineering Intelligent Grading Platform
                </p>
              </div>
            </div>
            <div className="border border-[#D8DEE8] bg-[#F5F7FA] px-4 py-2 text-xs font-medium text-[#163A70]">
              <a href="/teacher" className="transition hover:text-[#0B4EA2]">
                教师工作台 →
              </a>
            </div>
          </div>
        </header>

        <section className="grid flex-1 gap-4 py-4 lg:grid-cols-[400px_minmax(0,1fr)] lg:overflow-hidden">
          <aside className="flex flex-col border border-[#D8DEE8] bg-white shadow-sm lg:max-h-[calc(100vh-132px)]">
            <div className="shrink-0 p-4 sm:p-5">
              <div className="mb-5 border-b border-[#D8DEE8] pb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0B4EA2]">
                Input Materials
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-normal text-[#0B2545]">
                上传批改材料
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                请分别上传题目图片与学生答案图片，完成区域裁剪后启动智能批改。
              </p>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-3 border border-[#D8DEE8] bg-[#F8FAFD] p-3">
                <StudentField
                  label="学生姓名"
                  value={studentName}
                  onChange={setStudentName}
                  placeholder="匿名学生"
                />
                <StudentField
                  label="学号"
                  value={studentId}
                  onChange={setStudentId}
                  placeholder="选填"
                />
                <StudentField
                  label="课程"
                  value={courseName}
                  onChange={setCourseName}
                  placeholder="工程课程"
                />
                <StudentField
                  label="班级"
                  value={className}
                  onChange={setClassName}
                  placeholder="选填"
                />
              </div>

              <div className="space-y-3">
              {uploadItems.map((item) => {
                const isDragging = draggingKind === item.kind;

                return (
                  <div
                    key={item.id}
                    className="border border-[#D8DEE8] bg-[#F8FAFD] p-3 transition-colors duration-200"
                  >
                    <input
                      id={item.id}
                      type="file"
                      accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                      className="sr-only"
                      onChange={(event) => handleUpload(item.kind, event)}
                    />

                    {item.draft ? (
                      <div className="space-y-3">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                            裁剪{item.title}
                          </h3>
                          <p className="mt-1 text-xs leading-5 text-slate-600">
                            拖动图片调整位置，滚轮缩放后框选需要识别的区域。
                          </p>
                        </div>
                        <ImageCropper
                          imageSrc={item.draft.previewUrl}
                          fileName={item.draft.fileName}
                          inputId={item.id}
                          onCancel={() => cancelCrop(item.kind)}
                          onConfirm={(file, previewUrl) =>
                            confirmCrop(item.kind, file, previewUrl)
                          }
                        />
                      </div>
                    ) : item.upload ? (
                      <div className="space-y-3">
                        <div className="overflow-hidden border border-[#D8DEE8] bg-white">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={item.upload.previewUrl}
                            alt={`${item.title}预览`}
                            className="h-40 w-full object-contain"
                          />
                        </div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="grid size-5 place-items-center rounded-full bg-emerald-500 text-[11px] font-bold text-white">
                                ✓
                              </span>
                              <h3 className="text-sm font-semibold text-[#0B2545]">
                                {item.title} · 已裁剪完成
                              </h3>
                            </div>
                            <p className="mt-1 truncate text-xs text-slate-600">
                              当前提交图片：{item.upload.fileName}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (item.upload) {
                                  reCrop(item.kind, item.upload);
                                }
                              }}
                              className="h-9 border border-emerald-300 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                            >
                              重新裁剪
                            </button>
                            <label
                              htmlFor={item.id}
                              className="grid size-9 cursor-pointer place-items-center border border-[#D8DEE8] bg-white text-[#163A70] transition hover:border-[#0B4EA2] hover:text-[#0B4EA2]"
                              title="重新上传"
                            >
                              <UploadIcon />
                            </label>
                            <button
                              type="button"
                              onClick={() => removeUpload(item.kind)}
                              className="grid size-9 place-items-center border border-[#D8DEE8] bg-white text-slate-600 transition hover:border-red-300 hover:text-red-600"
                              title="删除"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <label
                        htmlFor={item.id}
                        onDragOver={(event) => {
                          event.preventDefault();
                          setDraggingKind(item.kind);
                        }}
                        onDragLeave={() => setDraggingKind(null)}
                        onDrop={(event) => handleDrop(item.kind, event)}
                        className={`flex min-h-44 cursor-pointer flex-col items-center justify-center border border-dashed px-4 text-center transition-colors duration-200 ${
                          isDragging
                            ? "border-[#0B4EA2] bg-[#EAF2FC]"
                            : "border-[#B9C4D4] bg-white hover:border-[#0B4EA2] hover:bg-[#F0F5FB]"
                        }`}
                      >
                        <div className="grid size-11 place-items-center border border-[#0B4EA2] bg-[#0B4EA2] text-white">
                          <UploadIcon />
                        </div>
                        <h3 className="mt-4 text-sm font-semibold text-[#0B2545]">
                          {item.title}
                        </h3>
                        <p className="mt-1 text-xs leading-5 text-slate-600">
                          {item.description}
                        </p>
                      </label>
                    )}
                  </div>
                );
              })}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto border-t border-[#D8DEE8] p-4 sm:p-5">
            <div className="border border-[#D8DEE8] bg-[#F8FAFD] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#163A70]">
                批改状态
              </p>
              <div className="mt-2 flex items-center gap-3">
                <span className="relative flex size-3">
                  {isGrading ? (
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400 opacity-75" />
                  ) : null}
                  <span className="relative inline-flex size-3 rounded-full bg-[#0B4EA2]" />
                </span>
                <p className="text-sm font-semibold text-[#0B2545]">
                  {status}
                </p>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>工作流进度</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden border border-[#D8DEE8] bg-white">
                  <div
                    className="h-full bg-[#0B4EA2] transition-[width] duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                {workflowSteps.map((step) => (
                  <div
                    key={step.key}
                    className="flex items-center justify-between border border-[#D8DEE8] bg-white px-3 py-2 text-xs"
                  >
                    <span className="font-medium text-[#0B2545]">
                      {step.label}
                    </span>
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

            </div>
          </aside>

          <section className="flex min-h-[560px] flex-col border border-[#D8DEE8] bg-white shadow-sm lg:max-h-[calc(100vh-132px)]">
            <div className="flex flex-col gap-4 border-b border-[#D8DEE8] bg-[#F8FAFD] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0B4EA2]">
                  AI Assessment Report
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[#0B2545]">
                  AI批改分析报告
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  自动评阅结论、步骤分析、扣分依据与改进建议
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <span className="flex h-10 items-center justify-center border border-[#D8DEE8] bg-white px-3 text-xs font-medium text-[#163A70]">
                  REPORT
                </span>
                <button
                  type="button"
                  onClick={() => setIsHistoryDrawerOpen(true)}
                  className="flex h-10 w-full items-center justify-center border border-[#0B4EA2] bg-white px-4 text-sm font-semibold text-[#0B4EA2] shadow-sm transition-colors hover:bg-[#F0F5FB] focus:outline-none focus:ring-4 focus:ring-[#0B4EA2]/15 sm:w-auto"
                >
                  历史记录
                </button>
                <button
                  type="button"
                  onClick={startGrading}
                  disabled={isGrading || !isReadyToGrade}
                  className="flex h-10 w-full items-center justify-center gap-2 bg-[#0B4EA2] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#163A70] focus:outline-none focus:ring-4 focus:ring-[#0B4EA2]/15 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none sm:w-auto"
                >
                  {isGrading ? (
                    <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  ) : null}
                  {isGrading
                    ? "AI分析中..."
                    : isReadyToGrade
                      ? "开始AI批改"
                      : "请先上传题目和解答图片"}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {isGrading ? (
                <ReportProgress
                  progressPercent={progressPercent}
                  steps={reportProgressSteps}
                />
              ) : null}

              {result ? (
                <div className="mx-auto mt-4 max-w-4xl border border-[#D8DEE8] bg-white p-5 shadow-sm first:mt-0 sm:p-7">
                  <div className="mb-5 flex items-center gap-3 border-b border-[#D8DEE8] pb-4">
                    <div className="grid size-9 place-items-center border border-[#0B4EA2] bg-[#0B4EA2] text-xs font-bold text-white">
                      AI
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#0B2545]">
                        工程课程智能批改模型
                      </p>
                      <p className="text-xs text-slate-500">
                        Analysis generated by Dify Workflow
                      </p>
                    </div>
                  </div>
                  <MarkdownResult content={result} />
                </div>
              ) : !isGrading ? (
                <div className="flex min-h-full items-center justify-center">
                  <div className="max-w-sm text-center">
                    <div className="mx-auto grid size-14 place-items-center border border-[#D8DEE8] bg-[#F8FAFD] text-[#0B4EA2]">
                      <SparkIcon />
                    </div>
                    <h3 className="mt-5 text-lg font-semibold text-[#0B2545]">
                      等待生成分析报告
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      完成两张图片裁剪并点击开始批改后，系统将在此输出学术报告式批改结果。
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
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
          <aside className="relative flex h-full w-full max-w-[380px] flex-col border-l border-[#D8DEE8] bg-white shadow-2xl">
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
    </main>
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

function MarkdownResult({ content }: { content: string }) {
  const normalizedContent = normalizeReportMarkdown(content);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        h1: ({ children }) => (
          <h1 className="mb-4 mt-1 border-b border-[#D8DEE8] pb-3 text-2xl font-semibold leading-tight text-[#0B2545]">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-3 mt-6 border-l-4 border-[#0B4EA2] pl-3 text-xl font-semibold leading-snug text-[#0B2545] first:mt-0">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-2 mt-5 text-lg font-semibold leading-snug text-[#163A70]">
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className="my-3 text-sm leading-7 text-slate-700">
            {children}
          </p>
        ),
        ul: ({ children }) => (
          <ul className="my-3 list-disc space-y-2 pl-5 text-sm leading-7 text-slate-700">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="my-3 list-decimal space-y-2 pl-5 text-sm leading-7 text-slate-700">
            {children}
          </ol>
        ),
        li: ({ children }) => <li>{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="my-4 border-l-4 border-[#0B4EA2] bg-[#F5F7FA] py-2 pl-4 text-sm text-slate-700">
            {children}
          </blockquote>
        ),
        code: ({ children, className }) => {
          const isBlock = Boolean(className);

          if (isBlock) {
            return <code className={`${className} text-sm`}>{children}</code>;
          }

          return (
            <code className="border border-[#D8DEE8] bg-[#F5F7FA] px-1.5 py-0.5 font-mono text-[0.9em] text-[#0B4EA2]">
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="my-4 overflow-x-auto border border-[#163A70] bg-[#0B2545] p-4 font-mono text-sm leading-6 text-slate-50">
            {children}
          </pre>
        ),
        table: ({ children }) => (
          <div className="my-4 overflow-x-auto border border-[#D8DEE8]">
            <table className="w-full border-collapse bg-white text-left text-sm text-slate-700">
              {children}
            </table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border-b border-[#D8DEE8] bg-[#F5F7FA] px-3 py-2 font-semibold text-[#0B2545]">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border-b border-[#E7EBF1] px-3 py-2">
            {children}
          </td>
        ),
      }}
    >
      {normalizedContent}
    </ReactMarkdown>
  );
}

function UploadIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 15V4m0 0 4 4m-4-4-4 4M5 15v2.5A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5V15"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6 7h12m-9 0V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7m-7.5 0 .7 11.2A2 2 0 0 0 10.2 20h3.6a2 2 0 0 0 2-1.8L16.5 7M10 11v5m4-5v5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-6"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Zm6 11 1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1 1-2.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
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

async function saveSubmission(input: {
  studentName: string;
  studentId: string;
  courseName: string;
  className: string;
  problemImageName: string;
  answerImageName: string;
  gradingResult: string;
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
  };

  try {
    const response = await fetch("/api/submissions", {
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
