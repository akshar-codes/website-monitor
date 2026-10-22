import { useMemo } from "react";
import { LocateFixed } from "lucide-react";
import { Select } from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import { COMMON_TIMEZONES } from "../../constants/preferences";

export default function TimezoneSelector({
  value,
  onChange,
  disabled = false,
}) {
  const browserTimezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );

  // Ensure the current value is always a selectable option, even if it's
  // outside the curated COMMON_TIMEZONES list (e.g. loaded from a server
  // value the user set via a different client, or the browser-detected
  // zone not being in the preset list).
  const timezones = useMemo(() => {
    const set = new Set(COMMON_TIMEZONES);
    if (value) set.add(value);
    set.add(browserTimezone);
    return Array.from(set).sort();
  }, [value, browserTimezone]);

  return (
    <div className="flex items-center gap-2">
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="flex-1"
      >
        {timezones.map((tz) => (
          <option key={tz} value={tz}>
            {tz.replace(/_/g, " ")}
          </option>
        ))}
      </Select>
      <Button
        type="button"
        variant="outline"
        size="md"
        icon={LocateFixed}
        disabled={disabled}
        onClick={() => onChange(browserTimezone)}
        title="Detect from browser"
        className="shrink-0"
      >
        Detect
      </Button>
    </div>
  );
}
