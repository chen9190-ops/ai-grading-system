"use client";

import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";

export default function GradingMarkdown({ content }: { content: string }) {
  return <div className="min-w-0 overflow-x-auto"><ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} components={{ p: ({ children }) => <p className="my-2 whitespace-pre-wrap text-[13px] leading-6 text-slate-600">{children}</p>, ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5 text-[13px] leading-6 text-slate-600">{children}</ul>, ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5 text-[13px] leading-6 text-slate-600">{children}</ol>, h1: ({ children }) => <h3 className="my-3 text-base font-bold">{children}</h3>, h2: ({ children }) => <h3 className="my-3 text-base font-bold">{children}</h3>, h3: ({ children }) => <h4 className="my-2 text-sm font-bold">{children}</h4>, pre: ({ children }) => <pre className="my-3 overflow-x-auto rounded-xl bg-slate-950 p-3 text-xs leading-5 text-slate-100">{children}</pre>, code: ({ children }) => <code className="rounded bg-slate-100 px-1 text-blue-700">{children}</code> }}>{content}</ReactMarkdown></div>;
}
