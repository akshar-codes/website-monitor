import {
  LogIn,
  Monitor,
  AlertTriangle,
  UserCircle,
  CreditCard,
  ShieldCheck,
  SlidersHorizontal,
  KeySquare,
  Activity as ActivityIconLucide,
} from "lucide-react";
import { cn } from "../../utils/cn";
import { ACTIVITY_CATEGORIES } from "../../constants/activity";

const CATEGORY_CONFIG = {
  [ACTIVITY_CATEGORIES.AUTH]: {
    icon: LogIn,
    bg: "bg-blue-500/10",
    text: "text-blue-400",
  },
  [ACTIVITY_CATEGORIES.MONITOR]: {
    icon: Monitor,
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
  },
  [ACTIVITY_CATEGORIES.INCIDENT]: {
    icon: AlertTriangle,
    bg: "bg-amber-500/10",
    text: "text-amber-400",
  },
  [ACTIVITY_CATEGORIES.PROFILE]: {
    icon: UserCircle,
    bg: "bg-purple-500/10",
    text: "text-purple-400",
  },
  [ACTIVITY_CATEGORIES.PLAN]: {
    icon: CreditCard,
    bg: "bg-cyan-500/10",
    text: "text-cyan-400",
  },
  [ACTIVITY_CATEGORIES.ADMIN]: {
    icon: ShieldCheck,
    bg: "bg-red-500/10",
    text: "text-red-400",
  },
  [ACTIVITY_CATEGORIES.PREFERENCES]: {
    icon: SlidersHorizontal,
    bg: "bg-zinc-500/10",
    text: "text-zinc-400",
  },
  [ACTIVITY_CATEGORIES.SESSION]: {
    icon: KeySquare,
    bg: "bg-indigo-500/10",
    text: "text-indigo-400",
  },
};

export default function ActivityIcon({ category, size = "md", className }) {
  const config = CATEGORY_CONFIG[category] || {
    icon: ActivityIconLucide,
    bg: "bg-bg-overlay",
    text: "text-text-muted",
  };
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg",
        config.bg,
        size === "sm" && "h-7 w-7",
        size === "md" && "h-9 w-9",
        size === "lg" && "h-11 w-11",
        className,
      )}
    >
      <Icon
        size={size === "sm" ? 13 : size === "lg" ? 18 : 15}
        className={config.text}
      />
    </div>
  );
}
