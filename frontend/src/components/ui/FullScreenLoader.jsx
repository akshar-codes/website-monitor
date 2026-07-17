import { Loader2 } from "lucide-react";

export default function FullScreenLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-bg-base">
      <Loader2 size={22} className="animate-spin text-emerald-400" />
    </div>
  );
}
