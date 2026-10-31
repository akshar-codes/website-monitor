import { useTranslation } from "../../i18n";

export default function SegmentedControl({ options, value, onChange, label }) {
  const t = useTranslation();
  return (
    <div className="segmented-control" role="group" aria-label={t(label)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={value === option.value ? "active" : ""}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {t(option.label)}
        </button>
      ))}
    </div>
  );
}
