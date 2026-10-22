import { ArrowUp, ArrowDown, Save } from "lucide-react";
import { FormField, Select } from "../../components/ui/Input";
import Button from "../../components/ui/Button";
import {
  WIDGET_LABELS,
  DASHBOARD_REFRESH_OPTIONS,
  DEFAULT_WINDOW_OPTIONS,
} from "../../constants/preferences";

const widgetToggleKey = (key) =>
  `show${key.charAt(0).toUpperCase()}${key.slice(1)}`;

/**
 * `dashboard` is a draft object shaped like the backend's dashboard
 * subdocument: { defaultWindow, autoRefreshInterval, compactMode,
 * widgets: { showX: bool, ... }, widgetOrder: [...] }. This component is
 * controlled — `onChange` receives the next full dashboard object on
 * every edit, and the parent decides when to persist it via `onSave`.
 */
export default function DashboardCustomization({
  dashboard,
  onChange,
  onSave,
  saving = false,
}) {
  const {
    defaultWindow,
    autoRefreshInterval,
    compactMode,
    widgets,
    widgetOrder,
  } = dashboard;

  const setField = (field, value) => onChange({ ...dashboard, [field]: value });

  const toggleWidget = (key) => {
    const showKey = widgetToggleKey(key);
    onChange({
      ...dashboard,
      widgets: { ...widgets, [showKey]: !widgets[showKey] },
    });
  };

  const moveWidget = (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= widgetOrder.length) return;

    const next = [...widgetOrder];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    onChange({ ...dashboard, widgetOrder: next });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Default time window">
          <Select
            value={defaultWindow}
            onChange={(e) => setField("defaultWindow", e.target.value)}
          >
            {DEFAULT_WINDOW_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </FormField>

        <FormField label="Auto-refresh interval">
          <Select
            value={autoRefreshInterval}
            onChange={(e) =>
              setField("autoRefreshInterval", Number(e.target.value))
            }
          >
            {DASHBOARD_REFRESH_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-border-default bg-bg-elevated px-4 py-3">
        <input
          type="checkbox"
          id="compactMode"
          checked={!!compactMode}
          onChange={(e) => setField("compactMode", e.target.checked)}
          className="h-4 w-4 rounded border-border-strong bg-bg-subtle accent-emerald-500"
        />
        <div>
          <label
            htmlFor="compactMode"
            className="cursor-pointer text-sm font-medium text-white"
          >
            Compact mode
          </label>
          <p className="text-[11px] text-text-muted">
            Reduce spacing and card padding across the dashboard
          </p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-text-muted">
          Widgets &amp; order
        </p>
        <div className="divide-y divide-border-subtle rounded-lg border border-border-default bg-bg-elevated">
          {widgetOrder.map((key, index) => {
            const showKey = widgetToggleKey(key);

            return (
              <div key={key} className="flex items-center gap-3 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={!!widgets[showKey]}
                  onChange={() => toggleWidget(key)}
                  className="h-4 w-4 shrink-0 rounded border-border-strong bg-bg-subtle accent-emerald-500"
                  aria-label={`Show ${WIDGET_LABELS[key] || key}`}
                />
                <span className="flex-1 text-sm text-text-secondary">
                  {WIDGET_LABELS[key] || key}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveWidget(index, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${WIDGET_LABELS[key] || key} up`}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-subtle hover:text-white disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveWidget(index, 1)}
                    disabled={index === widgetOrder.length - 1}
                    aria-label={`Move ${WIDGET_LABELS[key] || key} down`}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-subtle hover:text-white disabled:pointer-events-none disabled:opacity-30"
                  >
                    <ArrowDown size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end border-t border-border-subtle pt-4">
        <Button
          type="button"
          variant="primary"
          icon={Save}
          loading={saving}
          disabled={saving}
          onClick={onSave}
        >
          Save dashboard preferences
        </Button>
      </div>
    </div>
  );
}
