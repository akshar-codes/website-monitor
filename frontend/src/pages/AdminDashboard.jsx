import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  RefreshCw,
  Users,
  Monitor,
  AlertTriangle,
  Activity,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import PageContainer from "../components/layout/PageContainer";
import PageHeader from "../components/layout/PageHeader";
import Button from "../components/ui/Button";
import EmptyState from "../components/ui/EmptyState";
import { useAdminDashboard } from "../hooks/useAdmin";

const colors = ["#34d399", "#10b981", "#059669", "#52525b"];
const card = "rounded-xl border border-[#27272a] bg-bg-surface p-5";
const title = "text-xs font-medium uppercase tracking-wider text-zinc-500";
const dateInput =
  "rounded-lg border border-[#303034] bg-bg-surface px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500";

function StatCard({ label, value, icon: Icon, detail }) {
  return (
    <div className={card}>
      <div className="flex items-start justify-between">
        <div>
          <p className={title}>{label}</p>
          <p className="mt-3 text-3xl font-semibold text-white">
            {value ?? "—"}
          </p>
          {detail && <p className="mt-1 text-xs text-zinc-500">{detail}</p>}
        </div>
        <span className="rounded-lg bg-emerald-500/10 p-2.5 text-emerald-400">
          <Icon size={18} />
        </span>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [days, setDays] = useState(30);
  // Keep the query key stable across renders. Recomputing `new Date()` here
  // changed the ISO strings on every render, causing useQuery to refetch
  // after every response and quickly exhaust the API rate limit.
  const params = useMemo(() => {
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 86400000);
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  }, [days]);
  const { data, loading, error, refetch } = useAdminDashboard(params);
  const usersByPlan = Object.entries(data?.users?.byPlan || {}).map(
    ([name, stats]) => ({
      name,
      users: stats.users || 0,
      monitors: stats.monitors || 0,
    }),
  );
  const statuses = Object.entries(data?.monitors?.statuses || {});
  const hasRows =
    data?.recentRegistrations?.length ||
    data?.incidents?.active?.length ||
    data?.recentAdminActivity?.length;

  return (
    <PageContainer>
      <PageHeader
        title="Admin Overview"
        subtitle="Platform health, usage, and recent administrative activity."
      />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor="admin-range" className="text-sm text-zinc-400">
            Activity range
          </label>
          <select
            id="admin-range"
            className={dateInput}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
        <Button variant="secondary" onClick={refetch} disabled={loading}>
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />{" "}
          Refresh
        </Button>
      </div>
      {error && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300"
        >
          Dashboard data could not be loaded.{" "}
          <button onClick={refetch} className="ml-2 underline">
            Try again
          </button>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading && !data ? (
          Array.from({ length: 4 }, (_, i) => (
            <div
              key={i}
              className={`${card} h-28 animate-pulse bg-zinc-900/70`}
            />
          ))
        ) : (
          <>
            <StatCard
              label="Total users"
              value={data?.users?.total}
              detail={`${data?.users?.active || 0} active`}
              icon={Users}
            />
            <StatCard
              label="Total monitors"
              value={data?.monitors?.total}
              detail={`${data?.monitors?.active || 0} enabled`}
              icon={Monitor}
            />
            <StatCard
              label="Active incidents"
              value={data?.incidents?.activeCount}
              icon={AlertTriangle}
            />
            <StatCard
              label="Checks in range"
              value={data?.system?.checksInRange}
              detail={`${data?.system?.failureRate || 0}% failed · ${data?.system?.averageResponseTime || 0} ms avg`}
              icon={Activity}
            />
          </>
        )}
      </div>
      {data && (
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <section className={card}>
            <h2 className="text-sm font-semibold text-white">Users by plan</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="h-48">
                {usersByPlan.some((x) => x.users) ? (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={usersByPlan}
                        dataKey="users"
                        nameKey="name"
                        innerRadius={48}
                        outerRadius={76}
                        paddingAngle={3}
                      >
                        {usersByPlan.map((item, i) => (
                          <Cell
                            key={item.name}
                            fill={colors[i % colors.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "#18181b",
                          border: "1px solid #3f3f46",
                          borderRadius: 8,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="grid h-full place-items-center text-sm text-zinc-500">
                    No users yet
                  </div>
                )}
              </div>
              <div className="flex flex-col justify-center gap-3">
                {usersByPlan.map((p, i) => (
                  <Link
                    key={p.name}
                    to={`/admin/users?plan=${p.name.toLowerCase()}`}
                    className="flex items-center justify-between text-sm rounded-lg px-2 py-1.5 transition-colors hover:bg-zinc-800/60"
                  >
                    <span className="flex items-center gap-2 capitalize text-zinc-400">
                      <i
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: colors[i % colors.length] }}
                      />
                      {p.name}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-right">
                        <b className="text-white">{p.users}</b>
                        <small className="ml-2 text-zinc-500">
                          users · {p.monitors} monitors
                        </small>
                      </span>
                      <span className="text-xs text-zinc-500 hover:text-emerald-400">
                        view &rarr;
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
          <section className={card}>
            <h2 className="text-sm font-semibold text-white">
              Monitor status breakdown
            </h2>
            <div className="mt-5 space-y-4">
              {statuses.map(([status, count]) => (
                <div key={status}>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span className="capitalize text-zinc-400">{status}</span>
                    <span className="text-zinc-200">{count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{
                        width: `${data.monitors.total ? (count / data.monitors.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
          {[
            [
              "Recent registrations",
              data.recentRegistrations,
              (u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between border-t border-zinc-800 py-3"
                >
                  <div>
                    <p className="text-sm text-zinc-200">{u.name}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">
                      {u.role === "admin"
                        ? "Admin access"
                        : `${u.role} · ${u.plan}`}
                    </p>
                  </div>
                  <time className="text-xs text-zinc-500">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </time>
                </div>
              ),
            ],
            [
              "Active incidents",
              data.incidents.active,
              (i) => (
                <div
                  key={i.id}
                  className="flex items-center justify-between border-t border-zinc-800 py-3"
                >
                  <div>
                    <p className="text-sm text-zinc-200">
                      {i.monitor?.name || "Monitor unavailable"}
                    </p>
                    <p className="mt-0.5 text-xs capitalize text-zinc-500">
                      {i.severity} · {i.status}
                    </p>
                  </div>
                  <time className="text-xs text-zinc-500">
                    {new Date(i.startedAt).toLocaleString()}
                  </time>
                </div>
              ),
            ],
            [
              "Recent admin activity",
              data.recentAdminActivity,
              (a) => (
                <div key={a.id} className="border-t border-zinc-800 py-3">
                  <p className="text-sm text-zinc-200">{a.description}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {a.actor} · {new Date(a.createdAt).toLocaleString()}
                  </p>
                </div>
              ),
            ],
          ].map(([heading, rows, render]) => (
            <section key={heading} className={card}>
              <h2 className="mb-3 text-sm font-semibold text-white">
                {heading}
              </h2>
              {rows.length ? (
                rows.map(render)
              ) : (
                <EmptyState
                  title="Nothing to show"
                  description="There are no records for this section yet."
                />
              )}
            </section>
          ))}
        </div>
      )}
      {!loading && !error && data && !hasRows && (
        <p className="mt-4 text-xs text-zinc-600">
          No recent registrations, incidents, or administrative activity for
          this date range.
        </p>
      )}
    </PageContainer>
  );
}
