import { useState } from "react";

export default function RegionalMonitoringFields({ config = {}, usage }) {
  const regions = usage?.regionalMonitoring?.regions || [];
  const maxRegions = usage?.regionalMonitoring?.maxRegionsPerMonitor || 1;
  const [selected, setSelected] = useState(config.regions || []);
  const canUseRegions = usage?.features?.regionalMonitoring !== false;

  return (
    <fieldset className="settings-grid rounded-lg border p-3 md:col-span-2">
      <legend>Monitoring regions</legend>
      <p className="text-sm text-slate-600 md:col-span-2">
        Check this endpoint from independent locations. Each location adds to
        your account’s daily probe usage.
      </p>
      <label className="flex items-center gap-2 md:col-span-2">
        <input
          type="checkbox"
          name="regionalMonitoring.enabled"
          defaultChecked={config.enabled === true}
          disabled={!canUseRegions}
        />
        Enable regional monitoring
      </label>
      <div className="grid gap-2 md:col-span-2 md:grid-cols-2">
        {regions.map((region) => {
          const checked = selected.includes(region.id);
          const atLimit = !checked && selected.length >= maxRegions;
          return (
            <label
              className="flex items-start gap-2 rounded border p-2"
              key={region.id}
            >
              <input
                type="checkbox"
                name="regionalMonitoring.regions"
                value={region.id}
                defaultChecked={checked}
                disabled={
                  !canUseRegions || atLimit || (!region.operational && !checked)
                }
                onChange={(event) =>
                  setSelected((current) =>
                    event.target.checked
                      ? [...current, region.id]
                      : current.filter((id) => id !== region.id),
                  )
                }
              />
              <span>
                <b>{region.name}</b> · {region.location}
                <small className="block text-slate-500">
                  {region.operational ? "Probe online" : "Probe unavailable"}
                </small>
              </span>
            </label>
          );
        })}
      </div>
      <p className="text-sm text-slate-500 md:col-span-2">
        {selected.length} selected · plan limit {maxRegions} ·{" "}
        {usage?.regionalMonitoring?.checksUsedPerDay || 0} of{" "}
        {usage?.regionalMonitoring?.checksLimitPerDay == null
          ? "unlimited"
          : usage.regionalMonitoring.checksLimitPerDay.toLocaleString()}{" "}
        daily probes used.
      </p>
      {!canUseRegions && (
        <p className="text-sm text-amber-700 md:col-span-2">
          Regional monitoring is unavailable on your current plan.
        </p>
      )}
    </fieldset>
  );
}
