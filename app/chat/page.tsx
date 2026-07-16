"use client";

import { useState } from "react";
import Image from "next/image";
import MobileShell from "../components/mobile/MobileShell";
import MobileTopBar from "../components/mobile/MobileTopBar";
import { LoaderCircle, MoreHorizontal, Paperclip, Send, Sparkles } from "lucide-react";
import { withBasePath } from "@/lib/base-path";

type Message = { id: string; role: "assistant" | "student"; content: string };

const initialMessages: Message[] = [{ id: "welcome", role: "assistant", content: "你好，我是你的航空航天 AI 助教。你可以向我提问力学概念、公式推导或错题分析。" }];
const quickQuestions = ["为什么这里取这个方向？", "请推导力矩平衡公式", "还有其他解题方法吗？"];

export default function ChatPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [loading, setLoading] = useState(false);

  async function sendMessage(value?: string) {
    const content = (value ?? input).trim();
    if (!content || loading) return;
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "student", content }]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch(withBasePath("/api/assistant/mechanics"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: content }),
      });
      const payload: unknown = await response.json();
      const answer = isRecord(payload) && typeof payload.answer === "string"
        ? payload.answer.trim()
        : "";

      if (!isRecord(payload) || !response.ok || payload.success !== true || !answer) {
        const error = isRecord(payload) && typeof payload.error === "string" ? payload.error : "AI 助教回复失败";
        throw new Error(error);
      }

      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: answer }]);
    } catch (error) {
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: "assistant", content: `暂时无法回答：${error instanceof Error ? error.message : "请稍后重试"}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <MobileShell className="h-[100dvh] min-h-0 pb-[calc(4.75rem+env(safe-area-inset-bottom))]" contentClassName="flex h-full min-w-0 flex-col overflow-hidden">
        <MobileTopBar title="AI航空助教" className="z-20 shrink-0" centerContent={<div className="flex min-w-0 items-center justify-center gap-2.5"><div className="relative size-10 shrink-0 overflow-hidden rounded-full border-2 border-white bg-slate-900 shadow-sm"><Image src={withBasePath("/assets/astronaut-ai-assistant.png")} alt="AI 航空助教" fill sizes="40px" className="object-cover object-[58%_25%]" /></div><div className="min-w-0 text-left"><h1 className="truncate text-sm font-bold">AI航空助教</h1><p className="mt-0.5 flex items-center gap-1 text-[9px] text-emerald-500"><span className="size-1.5 rounded-full bg-emerald-500" />在线</p></div></div>} rightAction={<button type="button" aria-label="更多选项" className="grid size-10 place-items-center rounded-full bg-white/80 text-slate-600 shadow-sm"><MoreHorizontal className="size-5" /></button>} />

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          <div className="mb-6 flex items-center justify-center gap-1.5 text-[9px] uppercase tracking-[.16em] text-slate-400"><Sparkles className="size-3 text-blue-500" />专业课程学习对话</div>
          <div className="space-y-5">{messages.map((message) => message.role === "assistant" ? <div key={message.id} className="flex items-end gap-2.5"><div className="relative size-8 shrink-0 overflow-hidden rounded-full border border-white bg-slate-900"><Image src={withBasePath("/assets/astronaut-ai-assistant.png")} alt="" fill sizes="32px" className="object-cover object-[58%_25%]" /></div><div className="max-w-[78%] whitespace-pre-wrap rounded-[5px_20px_20px_20px] border border-white/80 bg-white/85 px-4 py-3 text-[13px] leading-6 text-slate-700 shadow-[0_6px_18px_rgba(30,41,59,.07)] backdrop-blur-md">{message.content}</div></div> : <div key={message.id} className="flex justify-end"><div className="max-w-[78%] whitespace-pre-wrap rounded-[20px_20px_5px_20px] bg-blue-600 px-4 py-3 text-[13px] leading-6 text-white shadow-[0_7px_18px_rgba(37,99,235,.22)]">{message.content}</div></div>)}{loading ? <div className="flex items-end gap-2.5"><div className="relative size-8 shrink-0 overflow-hidden rounded-full border border-white bg-slate-900"><Image src={withBasePath("/assets/astronaut-ai-assistant.png")} alt="" fill sizes="32px" className="object-cover object-[58%_25%]" /></div><div className="flex items-center gap-2 rounded-[5px_20px_20px_20px] border border-white/80 bg-white/85 px-4 py-3 text-xs text-slate-500 shadow-sm backdrop-blur-md"><LoaderCircle className="size-4 animate-spin text-blue-600" />AI 正在思考...</div></div> : null}</div>
        </div>

        <div className="shrink-0 border-t border-slate-200/80 bg-white/90 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
          <div className="mb-2 flex gap-2 overflow-x-auto pb-1">{quickQuestions.map((question) => <button type="button" key={question} onClick={() => sendMessage(question)} disabled={loading} className="shrink-0 rounded-full border border-slate-200/80 bg-slate-100/75 px-3 py-1.5 text-[10px] text-slate-600 disabled:opacity-50">{question}</button>)}</div>
          <div className="flex items-end gap-2 rounded-[20px] border border-slate-200 bg-[#f5f6f8] p-1.5 pl-2 focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-100/60"><button type="button" aria-label="添加附件" className="grid size-10 shrink-0 place-items-center text-slate-400"><Paperclip className="size-[18px]" /></button><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} rows={1} placeholder="请输入你的力学问题..." disabled={loading} className="max-h-28 min-h-10 min-w-0 flex-1 resize-none bg-transparent py-2.5 text-sm leading-5 outline-none placeholder:text-slate-400 disabled:opacity-60" /><button type="button" onClick={() => void sendMessage()} disabled={loading || !input.trim()} aria-label="发送消息" className="grid size-10 shrink-0 place-items-center rounded-2xl bg-blue-600 text-white shadow-md disabled:bg-slate-300">{loading ? <LoaderCircle className="size-[18px] animate-spin" /> : <Send className="size-[18px]" />}</button></div>
        </div>
    </MobileShell>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
