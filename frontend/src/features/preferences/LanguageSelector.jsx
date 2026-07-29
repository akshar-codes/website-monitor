import { Select } from "../../components/ui/Input";
import { LANGUAGE_OPTIONS } from "../../constants/preferences";

export default function LanguageSelector({ value, onChange, disabled = false }) {
  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      {LANGUAGE_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </Select>
  );
}
