import type { ReactNode } from "react";

export function PageHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0B4EA2]">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-semibold text-[#0B2545] sm:text-3xl">
        {title}
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
    </div>
  );
}

export function Panel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`border border-[#D8DEE8] bg-white shadow-sm ${className}`}>
      <h3 className="border-b border-[#D8DEE8] bg-[#F8FAFD] px-5 py-4 text-base font-semibold text-[#0B2545]">
        {title}
      </h3>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="border border-dashed border-[#B9C4D4] bg-[#F8FAFD] px-4 py-10 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

export function formatScore(score: number | null) {
  return score === null ? "—" : Number.isInteger(score) ? String(score) : score.toFixed(1);
}

export function formatDate(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
}
