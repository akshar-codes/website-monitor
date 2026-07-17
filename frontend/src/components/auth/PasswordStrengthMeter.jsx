import { Check, Circle } from "lucide-react";
import { getPasswordStrength } from "../../hooks/useAuthForm";

function Requirement({ met, text }) {
  return (
    <div className="flex items-center gap-1.5">
      {met ? (
        <Check size={11} className="text-emerald-400" />
      ) : (
        <Circle size={11} className="text-text-disabled" />
      )}
      <span className={met ? "text-text-secondary" : "text-text-muted"}>
        {text}
      </span>
    </div>
  );
}

export default function PasswordStrengthMeter({ password, show = true }) {
  if (!show || !password) return null;

  const { score, label, color, checks } = getPasswordStrength(password);
  const segments = 4;

  return (
    <div className="mt-2">
      <div className="mb-1.5 flex gap-1">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all duration-300"
            style={{ background: i < score ? color : "#27272a" }}
          />
        ))}
      </div>

      <p className="mb-2 text-[11px] font-semibold" style={{ color }}>
        {label}
      </p>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
        <Requirement met={checks.length} text="8+ characters" />
        <Requirement met={checks.uppercase} text="Uppercase letter" />
        <Requirement met={checks.number} text="Number" />
        <Requirement met={checks.special} text="Special character" />
      </div>
    </div>
  );
}
