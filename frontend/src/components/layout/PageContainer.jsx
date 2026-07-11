import { cn } from "../../utils/cn";

export default function PageContainer({ children, className }) {
  return (
    <main
      className={cn("flex-1 overflow-y-auto bg-bg-base px-8 py-8", className)}
    >
      <div className="mx-auto max-w-350 animate-fade-in">{children}</div>
    </main>
  );
}
