import React from "react";
import { cn } from "../../utils/cn";

export function Card({ children, className, hover = false, onClick }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-xl border border-[#1f1f23] bg-[#111113] p-6",
        hover &&
          "cursor-pointer transition-all duration-150 hover:border-[#27272a] hover:bg-[#131315] hover:shadow-lg",
        onClick && "cursor-pointer",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }) {
  return (
    <div
      className={cn("mb-4 flex items-start justify-between gap-3", className)}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className }) {
  return (
    <h3
      className={cn(
        "text-sm font-medium text-[#a1a1aa] uppercase tracking-wider",
        className,
      )}
    >
      {children}
    </h3>
  );
}

export function CardValue({ children, className }) {
  return (
    <p
      className={cn("text-2xl font-bold tracking-tight text-white", className)}
    >
      {children}
    </p>
  );
}

export function CardDescription({ children, className }) {
  return <p className={cn("text-xs text-[#52525b]", className)}>{children}</p>;
}
