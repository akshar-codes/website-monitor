import { formatDateTime } from "../../utils/format";

const expectedContract = {
  status: "<string>",
  services: {
    frontend: "<string>",
    backend: "<string>",
    database: "<string>",
  },
};

export default function ExpectedResponseHistory({ checks = [] }) {
  const recentChecks = checks.slice(0, 10);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(15rem,0.7fr)_minmax(0,1.3fr)]">
      <section className="h-fit rounded-xl border border-border-subtle bg-bg-surface p-5">
        <h3 className="text-sm font-semibold text-white">Expected response</h3>
        <p className="mb-3 mt-1 text-xs text-text-muted">
          Each check is expected to return JSON with a status and all three
          service fields.
        </p>
        <pre className="overflow-x-auto rounded-lg bg-black/30 p-3 text-xs leading-5 text-emerald-200">
          {JSON.stringify(expectedContract, null, 2)}
        </pre>
      </section>

      <section className="rounded-xl border border-border-subtle bg-bg-surface p-5">
        <h3 className="text-sm font-semibold text-white">
          Current responses <span className="text-text-muted">(last 10)</span>
        </h3>
        <p className="mb-3 mt-1 text-xs text-text-muted">
          Only the health contract fields are stored and shown here.
        </p>

        {recentChecks.length ? (
          <ol className="space-y-3">
            {recentChecks.map((check) => (
              <li
                key={check.id || check._id || check.checkedAt}
                className="rounded-lg border border-border-default bg-bg-elevated p-3"
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <time
                    className="text-xs text-text-secondary"
                    dateTime={check.checkedAt}
                  >
                    {formatDateTime(check.checkedAt)}
                  </time>
                  <span className="text-xs text-text-muted">
                    HTTP {check.httpStatus ?? "no response"} · {check.status}
                  </span>
                </div>
                <pre className="max-h-52 overflow-auto rounded-md bg-black/30 p-3 text-xs leading-5 text-text-secondary">
                  {check.rawResponse
                    ? JSON.stringify(check.rawResponse, null, 2)
                    : "No response body was captured for this check."}
                </pre>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-lg border border-border-default p-4 text-sm text-text-muted">
            No health checks have been recorded yet.
          </p>
        )}
      </section>
    </div>
  );
}
