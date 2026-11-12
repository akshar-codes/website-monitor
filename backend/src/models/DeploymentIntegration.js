import mongoose from "mongoose";

const deploymentIntegrationSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Owner reference is required"],
      index: true,
    },
    name: {
      type: String,
      required: [true, "Integration name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [80, "Name cannot exceed 80 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
      default: null,
    },
    prefix: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    secretHash: {
      type: String,
      required: true,
      select: false,
    },
    previousSecretHash: {
      type: String,
      default: null,
      select: false,
    },
    previousPrefix: {
      type: String,
      default: null,
      select: false,
    },
    encryptedSecret: {
      type: String,
      default: null,
      select: false,
    },
    previousEncryptedSecret: {
      type: String,
      default: null,
      select: false,
    },
    secretRotatedAt: {
      type: Date,
      default: null,
    },
    environment: {
      type: String,
      trim: true,
      maxlength: 64,
      default: null,
    },
    monitors: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Monitor",
        },
      ],
      default: [],
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
    revokedAt: {
      type: Date,
      default: null,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
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
        delete ret.secretHash;
        delete ret.previousSecretHash;
        delete ret.previousPrefix;
        delete ret.encryptedSecret;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
    },
  },
);

deploymentIntegrationSchema.index({ owner: 1, revokedAt: 1, createdAt: -1 });

const DeploymentIntegration = mongoose.model(
  "DeploymentIntegration",
  deploymentIntegrationSchema,
);

export default DeploymentIntegration;
