import mongoose from "mongoose";
import {
  SSL_STATUS,
  SSL_STATUS_VALUES,
  DOMAIN_STATUS,
  DOMAIN_STATUS_VALUES,
} from "../config/sslConstants.js";

// ── Sub-schemas ──────────────────────────────────────────────────────────────

const certificateSchema = new mongoose.Schema(
  {
    valid: { type: Boolean, default: false },
    selfSigned: { type: Boolean, default: false },
    validFrom: { type: Date, default: null },
    validTo: { type: Date, default: null },
    issuer: { type: String, default: null, trim: true, maxlength: 300 },
    issuerOrganization: { type: String, default: null, trim: true, maxlength: 300 },
    subject: { type: String, default: null, trim: true, maxlength: 300 },
    subjectAlternativeNames: { type: [String], default: [] },
    serialNumber: { type: String, default: null, trim: true, maxlength: 200 },
    fingerprint: { type: String, default: null, trim: true, maxlength: 200 },
    fingerprint256: { type: String, default: null, trim: true, maxlength: 200 },
    signatureAlgorithm: { type: String, default: null, trim: true, maxlength: 100 },
    protocol: { type: String, default: null, trim: true, maxlength: 20 },
    keyBits: { type: Number, default: null, min: 0 },
  },
  { _id: false },
);

const domainSchema = new mongoose.Schema(
  {
    name: { type: String, default: null, trim: true, maxlength: 255 },
    registrar: { type: String, default: null, trim: true, maxlength: 300 },
    registeredAt: { type: Date, default: null },
    updatedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    nameServers: { type: [String], default: [] },
    statuses: { type: [String], default: [] },
    status: {
      type: String,
      enum: {
        values: DOMAIN_STATUS_VALUES,
        message: `Domain status must be one of: ${DOMAIN_STATUS_VALUES.join(", ")}`,
      },
      default: DOMAIN_STATUS.UNKNOWN,
    },
    daysRemaining: { type: Number, default: null },
    // Best-effort RDAP lookups fail for plenty of legitimate reasons
    // (registry doesn't run an RDAP server, rate limiting, privacy
    // redaction) — the last failure reason is kept for display rather
    // than silently discarded, without ever blocking the certificate
    // check itself.
    lookupError: { type: String, default: null, trim: true, maxlength: 500 },
  },
  { _id: false },
);

// ── Top-level schema ─────────────────────────────────────────────────────────

const sslInfoSchema = new mongoose.Schema(
  {
    // One SslInfo document per monitor — separate collection (rather than
    // embedding on Monitor) so cert/domain history can grow independently
    // of the monitor document, mirroring how DailyStat/UserPreference are
    // kept separate from their owning documents in this codebase.
    monitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Monitor",
      required: [true, "Monitor reference is required"],
      unique: true,
    },

    hostname: {
      type: String,
      required: [true, "Hostname is required"],
      trim: true,
      maxlength: 255,
    },

    status: {
      type: String,
      enum: {
        values: SSL_STATUS_VALUES,
        message: `Status must be one of: ${SSL_STATUS_VALUES.join(", ")}`,
      },
      default: SSL_STATUS.PENDING,
    },

    daysRemaining: { type: Number, default: null },

    certificate: { type: certificateSchema, default: () => ({}) },
    domain: { type: domainSchema, default: () => ({}) },

    lastCheckedAt: { type: Date, default: null },
    lastError: { type: String, default: null, trim: true, maxlength: 500 },
    consecutiveFailures: { type: Number, default: 0, min: 0 },

    // Snapshot of the status immediately before the most recent check —
    // lets the scheduler detect a transition (e.g. valid -> expiring_soon)
    // so a notification fires once per transition rather than on every
    // recheck. Not exposed as meaningful to the client beyond that.
    previousStatus: {
      type: String,
      enum: {
        values: [...SSL_STATUS_VALUES, null],
        message: `Previous status must be one of: ${SSL_STATUS_VALUES.join(", ")}`,
      },
      default: null,
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
        return ret;
      },
    },

    toObject: { virtuals: true },
  },
);

// ── Indexes ──────────────────────────────────────────────────────────────────

// One SslInfo document per monitor, and the primary lookup path.
sslInfoSchema.index({ monitor: 1 }, { unique: true });

// SSL overview status breakdown / "expiring soon" queries.
sslInfoSchema.index({ status: 1 });
sslInfoSchema.index({ "certificate.validTo": 1 });
sslInfoSchema.index({ "domain.status": 1 });
sslInfoSchema.index({ "domain.expiresAt": 1 });

// ── Statics ──────────────────────────────────────────────────────────────────

/**
 * Fetches a monitor's SSL info, lazily creating a "pending" document on
 * first access — mirrors UserPreference.getOrCreateForUser's race-safe
 * lazy-init pattern. Guards against the race where two concurrent first
 * lookups both miss the initial findOne and try to create; the unique
 * index on `monitor` rejects the loser with E11000, which is caught and
 * re-read instead of surfacing a duplicate-key error to the caller.
 */
sslInfoSchema.statics.getOrCreateForMonitor = async function (monitorId, hostname) {
  let info = await this.findOne({ monitor: monitorId });
  if (info) return info;

  try {
    info = await this.create({ monitor: monitorId, hostname });
  } catch (error) {
    if (error.code === 11000) {
      info = await this.findOne({ monitor: monitorId });
    } else {
      throw error;
    }
  }

  return info;
};

// ── Expose enums for external use ──
sslInfoSchema.statics.STATUS = SSL_STATUS;
sslInfoSchema.statics.DOMAIN_STATUS = DOMAIN_STATUS;

const SslInfo = mongoose.model("SslInfo", sslInfoSchema);

export default SslInfo;
