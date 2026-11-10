import mongoose from "mongoose";
import { SLO_SEVERITY, SLO_BURN_RATE_WINDOWS } from "../config/constants.js";

const activeAlertSchema = new mongoose.Schema(
  {
    alertType: {
      type: String,
      enum: ["burn_rate", "budget_warning", "budget_exhausted"],
      required: true,
    },
    window: {
      type: String,
      enum: [...SLO_BURN_RATE_WINDOWS, null],
      default: null,
    },
    rate: {
      type: Number,
      default: null,
    },
    thresholdRate: {
      type: Number,
      default: null,
    },
    severity: {
      type: String,
      enum: SLO_SEVERITY,
      default: "critical",
    },
    triggeredAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    lastNotifiedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    dedupeKey: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
  },
  { _id: false },
);

const sloAlertStateSchema = new mongoose.Schema(
  {
    slo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Slo",
      required: true,
      unique: true,
      index: true,
    },
    monitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Monitor",
      required: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["healthy", "warning", "breached", "exhausted"],
      default: "healthy",
      index: true,
    },
    activeAlerts: {
      type: [activeAlertSchema],
      default: [],
    },
    incidentSequence: {
      type: Number,
      default: 1,
    },
    consecutiveBreaches: {
      type: Number,
      default: 0,
    },
    consecutiveRecoveries: {
      type: Number,
      default: 0,
    },
    lastEvaluatedAt: {
      type: Date,
      default: null,
    },
    lastAlertAt: {
      type: Date,
      default: null,
    },
    lastResolvedAt: {
      type: Date,
      default: null,
    },
    lastBurnRates: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    lastExhaustionForecast: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

sloAlertStateSchema.index({ owner: 1, status: 1 });
sloAlertStateSchema.index({ monitor: 1, status: 1 });

export default mongoose.model("SloAlertState", sloAlertStateSchema);
