import mongoose from "mongoose";

const deploymentEventSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Owner reference is required"],
      index: true,
    },
    monitors: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Monitor",
        },
      ],
      required: [true, "At least one affected monitor reference is required"],
      validate: {
        validator(v) {
          return Array.isArray(v) && v.length > 0;
        },
        message: "At least one affected monitor reference is required",
      },
    },
    version: {
      type: String,
      required: [true, "Release version or name is required"],
      trim: true,
      maxlength: [128, "Version cannot exceed 128 characters"],
    },
    commitSha: {
      type: String,
      trim: true,
      maxlength: [64, "Commit SHA cannot exceed 64 characters"],
      default: null,
    },
    environment: {
      type: String,
      required: [true, "Environment is required"],
      trim: true,
      lowercase: true,
      maxlength: [64, "Environment cannot exceed 64 characters"],
      default: "production",
    },
    deployedAt: {
      type: Date,
      required: [true, "deployedAt timestamp is required"],
      default: Date.now,
    },
    receivedAt: {
      type: Date,
      required: [true, "receivedAt timestamp is required"],
      default: Date.now,
    },
    source: {
      type: String,
      trim: true,
      maxlength: [64, "Source cannot exceed 64 characters"],
      default: "custom",
    },
    url: {
      type: String,
      trim: true,
      maxlength: [2048, "Deployment URL cannot exceed 2048 characters"],
      default: null,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
      default: null,
    },
    externalId: {
      type: String,
      trim: true,
      maxlength: [256, "External deployment ID cannot exceed 256 characters"],
      default: null,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      maxlength: [256, "Idempotency key cannot exceed 256 characters"],
      default: null,
    },
    integration: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeploymentIntegration",
      default: null,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: undefined,
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
        if (ret.metadata instanceof Map) {
          ret.metadata = Object.fromEntries(ret.metadata);
        }
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  },
);

// Virtual alias for affected monitor references
deploymentEventSchema.virtual("affectedMonitors").get(function () {
  return this.monitors;
});

// Indexes for query performance and reporting
deploymentEventSchema.index({ owner: 1, deployedAt: -1 });
deploymentEventSchema.index({ monitors: 1, deployedAt: -1 });
deploymentEventSchema.index({ owner: 1, environment: 1, deployedAt: -1 });
deploymentEventSchema.index({ monitors: 1, environment: 1, deployedAt: -1 });

// Idempotency and duplicate-event prevention indexes
deploymentEventSchema.index(
  { owner: 1, externalId: 1 },
  {
    unique: true,
    partialFilterExpression: { externalId: { $type: "string" } },
  },
);

deploymentEventSchema.index(
  { owner: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
  },
);

const DeploymentEvent = mongoose.model(
  "DeploymentEvent",
  deploymentEventSchema,
);

export default DeploymentEvent;
