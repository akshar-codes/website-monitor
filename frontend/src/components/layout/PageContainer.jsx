import React from "react";
import { cn } from "../../utils/cn";

export default function PageContainer({ children, className }) {
  return (
    <main
      className={cn("flex-1 overflow-y-auto bg-[#09090b] px-8 py-8", className)}
    >
      <div className="mx-auto max-w-[1400px] animate-fade-in">{children}</div>
    </main>
  );
}
