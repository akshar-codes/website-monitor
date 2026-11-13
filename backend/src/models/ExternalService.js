import mongoose from "mongoose";
import { EXTERNAL_SERVICE_TYPE_VALUES } from "../config/constants.js";

const externalServiceSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Owner reference is required"],
      index: true,
    },
    name: {
      type: String,
      required: [true, "Service name is required"],
      trim: true,
      minlength: [1, "Name cannot be empty"],
      maxlength: [120, "Name cannot exceed 120 characters"],
    },
    type: {
      type: String,
      enum: {
        values: EXTERNAL_SERVICE_TYPE_VALUES,
        message: `Type must be one of: ${EXTERNAL_SERVICE_TYPE_VALUES.join(", ")}`,
      },
      default: "other",
      required: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
      default: "",
    },
    host: {
      type: String,
      trim: true,
      maxlength: [255, "Host cannot exceed 255 characters"],
      default: null,
    },
    status: {
      type: String,
      enum: ["healthy", "degraded", "unhealthy", "unknown"],
      default: "unknown",
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

// Prevent duplicate external services with the same name for a single tenant
externalServiceSchema.index({ owner: 1, name: 1 }, { unique: true });
externalServiceSchema.index({ owner: 1, type: 1 });
externalServiceSchema.index({ owner: 1, isActive: 1 });

const ExternalService = mongoose.model(
  "ExternalService",
  externalServiceSchema,
);

export default ExternalService;
