const mongoose = require("mongoose");

const dailyStatSchema = new mongoose.Schema(
  {
    monitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Monitor",
      required: [true, "Monitor reference is required"],
    },

    // Start-of-day (midnight UTC) — one document per monitor per day
    date: {
      type: Date,
      required: [true, "Date is required"],
    },

    // ── Counters ──

    totalChecks: {
      type: Number,
      default: 0,
      min: [0, "Total checks cannot be negative"],
    },

    successfulChecks: {
      type: Number,
      default: 0,
      min: [0, "Successful checks cannot be negative"],
    },

    failedChecks: {
      type: Number,
      default: 0,
      min: [0, "Failed checks cannot be negative"],
    },

    // ── Derived percentages ──

    uptimePercentage: {
      type: Number,
      default: 0,
      min: [0, "Uptime percentage cannot be negative"],
      max: [100, "Uptime percentage cannot exceed 100"],
    },

    // ── Response-time metrics ──

    avgResponseTime: {
      type: Number,
      default: 0,
      min: [0, "Avg response time cannot be negative"],
    },

    minResponseTime: {
      type: Number,
      default: 0,
      min: [0, "Min response time cannot be negative"],
    },

    maxResponseTime: {
      type: Number,
      default: 0,
      min: [0, "Max response time cannot be negative"],
    },

    // ── Downtime tracking ──

    downtimeSeconds: {
      type: Number,
      default: 0,
      min: [0, "Downtime seconds cannot be negative"],
    },

    degradedSeconds: {
      type: Number,
      default: 0,
      min: [0, "Degraded seconds cannot be negative"],
    },

    // ── Internal: running sum for incremental avg calculation ──
    _responseTimeSum: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,

    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret._responseTimeSum; // hide internal field
        return ret;
      },
    },

    toObject: { virtuals: true },
  },
);

// ─────────────────────────────────────────────
// Indexes
// ─────────────────────────────────────────────

// Per-monitor daily stats, newest first (dashboard charts)
dailyStatSchema.index({ monitor: 1, date: -1 }, { unique: true });

// Global daily view (all monitors for a date)
dailyStatSchema.index({ date: -1 });

// ─────────────────────────────────────────────
// Statics
// ─────────────────────────────────────────────

dailyStatSchema.statics.getDateRangeStats = function (
  monitorId,
  startDate,
  endDate,
) {
  return this.find({
    monitor: monitorId,
    date: { $gte: startDate, $lte: endDate },
  }).sort({ date: 1 });
};

dailyStatSchema.statics.calculateUptime = async function (
  monitorId,
  startDate,
  endDate,
) {
  const [result] = await this.aggregate([
    {
      $match: {
        monitor: monitorId,
        date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: null,
        totalChecks: { $sum: "$totalChecks" },
        successfulChecks: { $sum: "$successfulChecks" },
      },
    },
  ]);

  if (!result || result.totalChecks === 0) return 0;
  return parseFloat(
    ((result.successfulChecks / result.totalChecks) * 100).toFixed(2),
  );
};

const DailyStat = mongoose.model("DailyStat", dailyStatSchema);

module.exports = DailyStat;
