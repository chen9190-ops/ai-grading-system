"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, CircleUserRound, Dumbbell, FileText, Home } from "lucide-react";

const items = [
  { label: "首页", icon: Home, href: "/" },
  { label: "AI助手", icon: Bot, href: "/assistant", matches: ["/assistant", "/chat", "/grading"] },
  { label: "训练中心", icon: Dumbbell, href: "/practice" },
  { label: "错题本", icon: FileText, href: "/errors" },
  { label: "我的", icon: CircleUserRound, href: "/profile" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[430px] border-t border-white/55 bg-[#e2e6ea]/82 px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,.09)] backdrop-blur-xl" aria-label="学生端主导航">
      <div className="grid grid-cols-5">
        {items.map(({ label, icon: Icon, href, matches }) => {
          const active = matches
            ? matches.some((path) => pathname === path || pathname.startsWith(`${path}/`))
            : href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link key={label} href={href} aria-current={active ? "page" : undefined} className={`flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 text-[10px] ${active ? "font-semibold text-blue-600" : "text-slate-400"}`}>
              <span className={`grid size-8 place-items-center rounded-xl transition-colors ${active ? "bg-blue-50" : ""}`}>
                <Icon className="size-5" strokeWidth={active ? 2.4 : 1.8} />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
