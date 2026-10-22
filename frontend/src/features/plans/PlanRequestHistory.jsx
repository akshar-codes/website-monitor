import { Card } from "../../components/ui/Card";

const statusStyles = {
  pending: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  approved: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  rejected: "border-red-500/20 bg-red-500/10 text-red-300",
};

export default function PlanRequestHistory({ requests = [], getPlanName }) {
  if (!requests.length) return null;
  return (
    <Card className="mb-6">
      <h2 className="font-semibold text-white">Recent upgrade requests</h2>
      <p className="mb-4 mt-1 text-xs text-text-muted">
        Requests are reviewed by an administrator while payment processing is
        not connected.
      </p>
      <div className="divide-y divide-border-subtle">
        {requests.map((request) => (
          <div
            key={request._id || request.id}
            className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div>
              <p className="text-sm font-medium text-white">
                {getPlanName(request.requestedPlan)}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                Requested {new Date(request.createdAt).toLocaleDateString()}
              </p>
              {request.status === "rejected" && request.rejectionReason && (
                <p className="mt-1 text-xs text-red-300">
                  Reason: {request.rejectionReason}
                </p>
              )}
            </div>
            <span
              className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusStyles[request.status] || "border-border-subtle text-text-muted"}`}
            >
              {request.status}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
