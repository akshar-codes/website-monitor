import { FormField, Select } from "../../components/ui/Input";
import {
  DATE_FORMAT_OPTIONS,
  TIME_FORMAT_OPTIONS,
} from "../../constants/preferences";

export default function DateTimeFormatSelector({
  dateFormat,
  timeFormat,
  onDateFormatChange,
  onTimeFormatChange,
  disabled = false,
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormField label="Date format">
        <Select
          value={dateFormat}
          onChange={(e) => onDateFormatChange(e.target.value)}
          disabled={disabled}
        >
          {DATE_FORMAT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Time format">
        <Select
          value={timeFormat}
          onChange={(e) => onTimeFormatChange(e.target.value)}
          disabled={disabled}
        >
          {TIME_FORMAT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </FormField>
    </div>
  );
}
