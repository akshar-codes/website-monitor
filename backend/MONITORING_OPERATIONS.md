# Monitoring engine operations

## Deployment

The monitoring workers run in the API process after MongoDB connects. The application needs a reachable shared MongoDB database. No Redis service or other queue is required. All API replicas may run the scheduler: they atomically claim due monitor documents with MongoDB `findOneAndUpdate` leases. A crashed worker's lease expires and another scheduler can reclaim the job. Each instance's HTTP worker limit is `MONITOR_JOB_CONCURRENCY`; total cluster concurrency is that value multiplied by the number of API instances. SSL/domain checks use a separate bounded pool controlled by `SSL_CHECK_CONCURRENCY`.

Create the configured MongoDB indexes before production traffic (Mongoose model index creation, or an equivalent deployment migration). The scheduler depends on the `active`, `nextCheckAt`, and `_id` monitor index; health history depends on monitor/timestamp and timestamp indexes; incident reference indexes accelerate retention protection. After deploying the health-check index change to an existing database, run `npm run optimize:monitor-storage` from `backend/` to create the replacement compound index before dropping its redundant predecessor indexes.

Required application settings remain those in `.env.example`, especially `MONGO_URI`, `COOKIE_SECRET`, `SESSION_SECRET`, `CORS_ORIGIN`, `CLIENT_URL`, and SMTP settings. Monitoring worker settings and defaults:

| Setting                           |       Default | Purpose                                                                                                               |
| --------------------------------- | ------------: | --------------------------------------------------------------------------------------------------------------------- |
| `POLL_TICK_MS`                    |     10,000 ms | Scheduler wake interval; overdue work is also checked immediately at startup.                                         |
| `POLL_TIMEOUT_MS`                 |     10,000 ms | Timeout for each HTTP/DNS attempt.                                                                                    |
| `POLL_TOTAL_TIMEOUT_MS`           |     30,000 ms | Total retry budget per health check.                                                                                  |
| `HEALTH_CHECK_MAX_RESPONSE_BYTES` |         1 MiB | Maximum response body retained in memory for parsing.                                                                 |
| `MONITOR_JOB_CONCURRENCY`         |            10 | Maximum active scheduled health-check pipelines per process.                                                          |
| `MONITOR_JOB_LEASE_MS`            |     60,000 ms | Distributed claim lease; renewed while a job is active. Must exceed `POLL_TOTAL_TIMEOUT_MS` by at least five seconds. |
| `MONITOR_JOB_RETRY_DELAY_MS`      |     30,000 ms | Retry delay for persistence/pipeline failures.                                                                        |
| `MONITOR_RETRY_COUNT`             |             2 | Maximum additional HTTP attempts (hard capped at five).                                                               |
| `MONITOR_RETRY_DELAY`             |      1,000 ms | Initial exponential retry delay (capped at 30 seconds).                                                               |
| `SSL_CHECK_TICK_MS`               |    900,000 ms | SSL scheduler wake interval.                                                                                          |
| `SSL_CHECK_INTERVAL_MS`           | 86,400,000 ms | Per-monitor SSL/domain recheck interval.                                                                              |
| `SSL_CHECK_TIMEOUT_MS`            |     10,000 ms | TLS handshake timeout.                                                                                                |
| `DOMAIN_LOOKUP_TIMEOUT_MS`        |     10,000 ms | RDAP lookup timeout.                                                                                                  |
| `SSL_CHECK_CONCURRENCY`           |             3 | Maximum SSL checks in flight per process.                                                                             |
| `CONSECUTIVE_FAILURE_THRESHOLD`   |             2 | Failures before opening an incident.                                                                                  |
| `CONSECUTIVE_SUCCESS_THRESHOLD`   |             2 | Healthy checks before resolving an incident.                                                                          |

`MONITOR_RETENTION_DAYS` defaults to 365 days for HealthCheck rows and DailyStat buckets. `MONITOR_DIAGNOSTIC_RETENTION_DAYS` defaults to 30 days for diagnostics. Response snapshots contain only the health-contract fields and are retained on each monitor's ten newest checks; the hourly maintenance pass also prunes older snapshots left by previous releases. `MONITOR_RETENTION_BATCH_SIZE` bounds cleanup work (default 500 checks/aggregates per pass, up to 100 monitors for response cleanup), and `MONITOR_MAINTENANCE_INTERVAL_MS` sets the pass cadence (default one hour). Checks referenced by an incident's trigger or recovery reference are protected from deletion.

## Scheduling and lifecycle

Monitor creation and resume/interval updates write `nextCheckAt`, so the due-query scheduler sees changes without rebuilding process-local timers. Paused monitors are excluded by the atomic claim filter. Interval changes take effect after an already claimed check completes; that completion schedules using the current interval. Before writing a scheduled result, the worker confirms that the monitor remains active and that it still owns the lease, discarding results invalidated by pause, deletion, URL edits, or lease replacement.

HTTP polling uses bounded retries and a total request budget. Each result is persisted idempotently using a scheduled execution key, then incident streak processing and the affected UTC DailyStat bucket are reconciled. Incident events are emitted only by the winning open/resolve transition, and `createNotification` applies the user's in-app/email preferences. Shutdown stops new ticks and waits for active work and maintenance; if the process is killed, MongoDB lease expiry provides recovery.

## Operations and troubleshooting

Structured logs include per-check duration/status, scheduler dispatch and job errors, lease-renewal failures, retention outcomes, and a once-per-minute scheduler metric snapshot with completed/unhealthy checks, active jobs, due queue depth, average duration, and last scheduler success. Configure `LOG_LEVEL=info` or `debug` and ship the configured `LOG_DIR` files to the normal log collector.

- Growing `queueDepth`: increase `MONITOR_JOB_CONCURRENCY` cautiously or add API worker instances; cluster concurrency scales linearly with replica count.
- Repeated `Monitor job failed` or `lease renewal failed`: check MongoDB connectivity/latency and configured lease duration.
- Repeated DNS/timeout failures: check the monitored endpoint's public DNS and network reachability. Private, loopback, link-local, and metadata destinations are blocked by the health-check SSRF policy.
- Retention failure: the next maintenance pass retries; deleted history is bounded to a single batch per pass. Incident-referenced checks are protected.
- Historical DailyStat repair: run `npm run reconcile:daily-stats -- --start=YYYY-MM-DD --end=YYYY-MM-DD` from `backend/` for a bounded window.

## Verification limits

MongoDB coordination is used for HTTP health-check jobs. SSL/domain work is streamed and bounded per process, but it does not use a distributed lease; in a multi-replica deployment, two replicas can perform the same SSL check at once. Retention is idempotent and batch-bounded but may run on more than one replica concurrently. In-app incident notifications are persisted once per transition in normal/retry operation; SMTP email delivery remains asynchronous and can fail independently, with its failure recorded on the notification.
