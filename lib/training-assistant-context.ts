import type { PracticeQuestion } from "@/lib/practice-paper";

export const trainingAssistantContextKey = "training-assistant-context";

export type TrainingAssistantAction = "explain" | "hint" | "similar" | "check" | "paper";
export type TrainingAssistantContext = {
  paperId: string;
  questionId: string | null;
  questionIndex: number | null;
  questionMarkdown: string;
  knowledgePoints: string[];
  difficulty: string;
  requestedAction: TrainingAssistantAction;
};

export function createTrainingAssistantContext(paperId: string, question: PracticeQuestion | null, requestedAction: TrainingAssistantAction): TrainingAssistantContext {
  return {
    paperId,
    questionId: question?.id ?? null,
    questionIndex: question?.index ?? null,
    questionMarkdown: (question?.stemMarkdown ?? "").slice(0, 8_000),
    knowledgePoints: question?.knowledgePoints.slice(0, 10) ?? [],
    difficulty: question?.difficulty ?? "",
    requestedAction,
  };
}

export function trainingAssistantInitialRequest(context: TrainingAssistantContext): string {
  const source = context.questionMarkdown ? `\n\n题目：\n${context.questionMarkdown}` : "";
  const prompts: Record<TrainingAssistantAction, string> = {
    explain: "请分步骤讲解这道题，但先不要直接给出最终答案。",
    hint: "请只给我解决这道题的下一步提示，不要给出完整答案。",
    similar: "请保持相同知识点，改变数据和场景，生成一道同类题。",
    check: "我想检查我的答案。请先提示我输入或上传作答，再进行分析。",
    paper: "请概括这套训练试卷考查的知识结构，并给出建议的作答顺序，不要直接提供答案。",
  };
  return `${prompts[context.requestedAction]}${source}`;
}
