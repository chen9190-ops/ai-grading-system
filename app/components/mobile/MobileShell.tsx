import type { ReactNode } from "react";
import BottomNav from "./BottomNav";

type MobileShellProps = {
  children: ReactNode;
  showBottomNav?: boolean;
  padded?: boolean;
  className?: string;
  contentClassName?: string;
};

export default function MobileShell({
  children,
  showBottomNav = true,
  padded = false,
  className = "",
  contentClassName = "",
}: MobileShellProps) {
  return (
    <main className="min-h-screen bg-[#bfc6ce] text-[#17243a]">
      <div
        className={`mobile-lunar-shell relative mx-auto min-h-screen w-full max-w-[430px] overflow-hidden bg-[#d5dae0] shadow-[0_0_60px_rgba(15,23,42,.2)] ${showBottomNav ? "pb-28" : ""} ${className}`}
      >
        <div className="pointer-events-none absolute inset-0 bg-[url('/assets/lunar-home-background.png')] bg-[length:100%_auto] bg-top bg-no-repeat" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(221,226,231,.04)_0%,rgba(214,220,226,.18)_34%,rgba(205,211,218,.7)_72%,#cdd3da_100%)]" />
        <div className={`relative z-10 ${padded ? "px-4 py-4" : ""} ${contentClassName}`}>
          {children}
        </div>
        {showBottomNav ? <BottomNav /> : null}
      </div>
    </main>
  );
}
