import { Moon, Sun, Monitor as MonitorIcon } from "lucide-react";
import { cn } from "../../utils/cn";
import { THEME_OPTIONS, THEMES } from "../../constants/preferences";

const ICONS = {
  [THEMES.DARK]: Moon,
  [THEMES.LIGHT]: Sun,
  [THEMES.SYSTEM]: MonitorIcon,
};

export default function ThemeSelector({ value, onChange, disabled = false }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {THEME_OPTIONS.map((opt) => {
        const Icon = ICONS[opt.value];
        const active = value === opt.value;

        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border px-4 py-4 text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50",
              active
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 shadow-[0_0_0_1px_rgba(16,185,129,0.2)]"
                : "border-border-default bg-bg-elevated text-text-secondary hover:border-border-strong hover:text-white",
            )}
          >
            <Icon size={18} />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
