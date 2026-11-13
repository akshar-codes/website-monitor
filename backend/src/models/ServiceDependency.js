import mongoose from "mongoose";
import {
  DEPENDENCY_TYPE_VALUES,
  DEPENDENCY_TARGET_TYPE_VALUES,
  DEPENDENCY_TYPES,
  DEPENDENCY_TARGET_TYPES,
} from "../config/constants.js";

const serviceDependencySchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Owner reference is required"],
      index: true,
    },
    // The downstream consumer (dependent service that relies on the upstream)
    dependentMonitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Monitor",
      required: [true, "Dependent monitor reference is required"],
      index: true,
    },
    toType: {
      type: String,
      enum: {
        values: DEPENDENCY_TARGET_TYPE_VALUES,
        message: `Target type must be one of: ${DEPENDENCY_TARGET_TYPE_VALUES.join(", ")}`,
      },
      default: DEPENDENCY_TARGET_TYPES.MONITOR,
      required: true,
    },
    // The upstream monitored service being depended upon (when toType is 'monitor')
    dependencyMonitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Monitor",
      default: null,
      index: true,
    },
    // The upstream external service being depended upon (when toType is 'external_service')
    dependencyExternalService: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ExternalService",
      default: null,
      index: true,
    },
    // 'hard' means dependent fails if dependency is down; 'soft' means degraded / non-critical
    dependencyType: {
      type: String,
      enum: {
        values: DEPENDENCY_TYPE_VALUES,
        message: `Dependency type must be one of: ${DEPENDENCY_TYPE_VALUES.join(", ")}`,
      },
      default: DEPENDENCY_TYPES.HARD,
      required: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
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

serviceDependencySchema.pre("validate", function (next) {
  if (this.toType === DEPENDENCY_TARGET_TYPES.MONITOR) {
    if (!this.dependencyMonitor) {
      this.invalidate(
        "dependencyMonitor",
        "Dependency monitor reference is required when target type is 'monitor'",
      );
    }
    if (
      this.dependentMonitor &&
      this.dependencyMonitor &&
      this.dependentMonitor.toString() === this.dependencyMonitor.toString()
    ) {
      this.invalidate(
        "dependencyMonitor",
        "A monitor cannot depend on itself (self-dependency rejected)",
      );
    }
    this.dependencyExternalService = null;
  } else if (this.toType === DEPENDENCY_TARGET_TYPES.EXTERNAL_SERVICE) {
    if (!this.dependencyExternalService) {
      this.invalidate(
        "dependencyExternalService",
        "External service reference is required when target type is 'external_service'",
      );
    }
    this.dependencyMonitor = null;
  }
  next();
});

// Explicit virtual for directional clarification
serviceDependencySchema.virtual("direction").get(function () {
  return "depends_on";
});

// Prevent duplicate edge definitions for the same dependent and target per tenant
serviceDependencySchema.index(
  { owner: 1, dependentMonitor: 1, dependencyMonitor: 1 },
  {
    unique: true,
    partialFilterExpression: { dependencyMonitor: { $type: "objectId" } },
  },
);

serviceDependencySchema.index(
  { owner: 1, dependentMonitor: 1, dependencyExternalService: 1 },
  {
    unique: true,
    partialFilterExpression: {
      dependencyExternalService: { $type: "objectId" },
    },
  },
);

// Optimize graph traversals
serviceDependencySchema.index({ owner: 1, dependentMonitor: 1, isActive: 1 });
serviceDependencySchema.index({ owner: 1, dependencyMonitor: 1, isActive: 1 });
serviceDependencySchema.index({
  owner: 1,
  dependencyExternalService: 1,
  isActive: 1,
});

const ServiceDependency = mongoose.model(
  "ServiceDependency",
  serviceDependencySchema,
);

export default ServiceDependency;
