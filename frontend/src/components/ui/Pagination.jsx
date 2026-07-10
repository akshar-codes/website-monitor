import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../utils/cn";

export default function Pagination({
  page,
  totalPages,
  onPageChange,
  className,
}) {
  if (totalPages <= 1) return null;

  return (
    <div className={cn("flex items-center justify-between", className)}>
      <p className="text-xs text-[#52525b]">
        Page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-[#27272a] bg-[#18181b] text-[#71717a] transition-colors hover:bg-[#1f1f23] hover:text-white disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronLeft size={13} />
        </button>

        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let pageNum;
          if (totalPages <= 5) {
            pageNum = i + 1;
          } else if (page <= 3) {
            pageNum = i + 1;
          } else if (page >= totalPages - 2) {
            pageNum = totalPages - 4 + i;
          } else {
            pageNum = page - 2 + i;
          }

          return (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md text-xs font-medium transition-colors",
                pageNum === page
                  ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                  : "border border-[#27272a] bg-[#18181b] text-[#71717a] hover:bg-[#1f1f23] hover:text-white",
              )}
            >
              {pageNum}
            </button>
          );
        })}

        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-[#27272a] bg-[#18181b] text-[#71717a] transition-colors hover:bg-[#1f1f23] hover:text-white disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}
