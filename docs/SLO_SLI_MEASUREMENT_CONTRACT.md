# SiteWatch SLO & SLI Measurement Contract (v1)

## 1. Overview and Architecture

This document defines the formal Service Level Indicator (SLI) and Service Level Objective (SLO) measurement contract for the SiteWatch Website Monitor platform.

SiteWatch measures service reliability using an **Availability SLO & Error Budget Engine**. Rather than relying on naive check counts (which skew results when polling intervals vary, retries occur, or manual checks fire), the engine evaluates reliability using a **duration-weighted observation contract** applied over a rolling time window.

---

## 2. Mathematical Model & SLI Measurement Contract

### 2.1 The Availability Indicator

The Service Level Indicator ($SLI$) over an evaluation window $W = [t_{\text{start}}, t_{\text{end}}]$ is defined as the ratio of valid good duration to total valid observed duration:

$$SLI = \frac{T_{\text{good}}}{T_{\text{good}} + T_{\text{bad}}} \times 100\%$$

Where:

- $T_{\text{good}}$ is the accumulated duration (in seconds) during which the service was verified healthy (`status === "up"`).
- $T_{\text{bad}}$ is the accumulated duration (in seconds) during which the service was verified unhealthy (`status === "down"`, or `"degraded"` under strict availability semantics).
- $T_{\text{unknown}}$ is unobserved or indeterminate duration (missing checks, worker pauses, data gaps, or `status === "unknown"`).

### 2.2 Duration Classification & Interval Attribution

Given a sequence of health checks $C_1, C_2, \dots, C_n$ occurring at timestamps $t_1 < t_2 < \dots < t_n$ within window $W$:

1. **Step Attribution**:
   The duration attributed to check $C_i$ (with timestamp $t_i$ and preceding check $C_{i-1}$ at $t_{i-1}$) is:
   $$\Delta t_i = t_i - t_{i-1}$$
   If $C_i$ is the first check in the window or the monitor configuration lacks a preceding sample, the interval defaults to the check's captured `intervalSeconds` (or the monitor's configured interval $I_{\text{monitor}}$).

2. **Maximum Interval Attribution ($\text{Cap}\_{\text{interval}}$)**:
   To prevent unobserved outages or extended offline periods from claiming unbounded downtime or uptime, each check's attributed duration is strictly bounded:
   $$\text{AttributedDuration}(C_i) = \min(\Delta t_i, \text{Cap}_{\text{interval}})$$
   Where:
   $$\text{Cap}_{\text{interval}} = \min(M_{\text{contract}}, \max(2 \times I_{\text{monitor}}, 600\text{ s}))$$
   - $M_{\text{contract}}$ is the configured maximum attribution ceiling (default: **3,600 seconds / 1 hour**).
   - Any elapsed time where $\Delta t_i > \text{Cap}_{\text{interval}}$ is classified as **Unknown / Unobserved Duration** ($T_{\text{unknown}}$).

3. **Good Duration ($T\_{\text{good}}$)**:
   A sample $C_i$ contributes to $T_{\text{good}}$ if and only if:
   - $C_i.\text{status} = \text{"up"}$
   - $C_i$ does not fall within an excluded maintenance window.

4. **Bad Duration ($T\_{\text{bad}}$)**:
   A sample $C_i$ contributes to $T_{\text{bad}}$ if:
   - $C_i.\text{status} = \text{"down"}$ (HTTP errors, transport timeouts, DNS/TLS failures, or API assertion errors/failures).
   - OR $C_i.\text{status} = \text{"degraded"}$ when `countDegradedAsDown` is `true` (default).
   - AND $C_i$ does not fall within an excluded maintenance window.

5. **Unknown / Unobserved Duration ($T\_{\text{unknown}}$)**:
   - Checks where $C_i.\text{status} = \text{"unknown"}$ (e.g. `insufficient_health_data`).
   - Gaps between checks exceeding $\text{Cap}_{\text{interval}}$.
   - Unknown duration **never** contributes to $T_{\text{good}}$ and **never** contributes to $T_{\text{bad}}$. Instead, it reduces the **Data Coverage Percentage**.

---

## 3. Minimum Data Coverage & Incomplete History

### 3.1 Data Coverage Percentage

Data Coverage measures the portion of the nominal evaluation window that was actively monitored:

$$\text{Coverage} = \frac{T_{\text{observed}}}{T_{\text{effective\_window}}} \times 100\% = \frac{T_{\text{good}} + T_{\text{bad}}}{T_{\text{effective\_window}}} \times 100\%$$

Where $T_{\text{effective\_window}} = \min(W_{\text{duration}}, \text{MonitorAge}, \text{PlanRetention})$.

### 3.2 Insufficient Data State

Each SLO configuration defines a `minimumDataCoveragePercent` (default: **95.0%**, minimum: **50.0%**, maximum: **99.9%**).

- When $\text{Coverage} \ge \text{minimumDataCoveragePercent}$:
  The SLO evaluation is marked **`CONFIDENT`** and error budget burn rates and alerts are actionable.
- When $\text{Coverage} < \text{minimumDataCoveragePercent}$:
  The SLO evaluation state is **`INSUFFICIENT_DATA`**.
  In this state, error budget alerts are suppressed or annotated with low-confidence disclaimers to prevent false pages caused by missing samples.

### 3.3 Monitor Age & Plan Retention Boundary Clamping

- **New Monitors ($\text{Age} < W\_{\text{duration}}$)**:
  For monitors created recently, the evaluation window is clamped to $[ \max(t_{\text{now}} - W_{\text{duration}}, t_{\text{created}}), t_{\text{now}} ]$. The expected duration is adjusted to the elapsed lifetime of the monitor.
- **Subscription Plan Retention Boundary**:
  If a user's subscription tier restricts data retention (e.g., Free tier retains 7 days; Pro tier retains 30 days), the engine clamps the maximum queryable window to the plan's `dataRetentionDays`. Requesting an SLO window beyond plan retention is rejected during configuration validation.

---

## 4. Maintenance Handling

SiteWatch integrates SLO evaluation with scheduled maintenance windows managed via `StatusMaintenance`:

- **Maintenance Exclusion Flag**: Each SLO defines `excludeMaintenance` (default: `true`).
- **Attribution Rules**:
  When a health check $C_i$ occurs at $t_i \in [t_{\text{maintenance\_start}}, t_{\text{maintenance\_end}}]$ for an active or completed maintenance window associated with the monitor:
  1. The attributed duration of $C_i$ is accumulated as $T_{\text{maintenance}}$.
  2. $T_{\text{maintenance}}$ is excluded from $T_{\text{bad}}$ and excluded from $T_{\text{good}}$.
  3. $T_{\text{maintenance}}$ is subtracted from the nominal window duration $T_{\text{total}}$, preserving the error budget during sanctioned maintenance.

---

## 5. Regional Monitoring Semantics

For monitors with multi-region polling enabled (`regionalMonitoring.enabled = true`):

- Multi-region probes submit regional check runs from configured regions (`india-mumbai`, `us-east`, `eu-west`, `singapore`).
- The central scheduler and aggregation manager compute a **consensus status** using strict majority voting.
- **SLI Primary Target**:
  The Availability SLO evaluates the **consensus health check stream** representing global service availability.
- **Regional Outage Isolation**:
  If a single region is down while the majority confirms the target is UP, the consensus status remains UP, meaning localized network transit issues do not trigger global SLO error budget consumption unless the quorum threshold is breached.

---

## 6. Error Budget and Multi-Window Burn Rate Math

### 6.1 Total Error Budget

Given target percentage $S$ (e.g., $99.9\%$) and effective window duration $T_{\text{window}}$:

$$\text{Error Budget Total} = (1 - S / 100) \times T_{\text{window}}$$

- For a 30-day window ($2,592,000$ seconds) at $99.9\%$ availability, the total allowed downtime is:
  $$\text{Budget} = 0.001 \times 2,592,000\text{ s} = 2,592\text{ seconds} \approx 43.2\text{ minutes}$$

### 6.2 Error Budget Consumption & Remaining

$$\text{Budget Consumed} = T_{\text{bad}}$$
$$\text{Budget Remaining \%} = \max\left(0, \frac{\text{Error Budget Total} - T_{\text{bad}}}{\text{Error Budget Total}} \times 100\%\right)$$

### 6.3 Burn Rate Multipliers

Burn rate is the rate at which the error budget is consumed relative to the nominal budget rate:

$$\text{Burn Rate} = \frac{T_{\text{bad\_in\_window}} / T_{\text{short\_window}}}{1 - S / 100}$$

Standard Google SRE Multi-Window Alerting Thresholds supported by SiteWatch:

- **Critical / Page**: Burn rate $\ge 14.4$ over 1 hour (burns $2\%$ of a 30-day budget in 1 hour; exhausts budget in 2 days).
- **High / Ticket**: Burn rate $\ge 6.0$ over 6 hours (burns $5\%$ of a 30-day budget in 6 hours).
- **Budget Exhausted**: Budget Remaining $\le 0\%$.

---

## 7. Historical Configuration Changes & Audit Immutability

To prevent historical distortion when an SLO's target percentage, window, or attribution settings are updated:

1. **Configuration Immutability**:
   Updates to an SLO do **not** retroactively recalculate or alter past evaluation snapshots.
2. **Audit Trail**:
   Every mutation records an immutable audit entry in `audit.changeHistory` containing:
   - `changedAt`: UTC timestamp of the change.
   - `changedBy`: User ID who performed the update.
   - `action`: `"created" | "updated" | "status_changed"`.
   - `diff`: Captured prior values and updated values for target, window, and thresholds.
   - `reason`: Optional operator explanation for the change.
3. **Audit Attribution**:
   `createdBy` is locked upon creation. `updatedBy` is maintained automatically on every mutation.
