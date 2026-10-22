import mongoose from "mongoose";

const apiKeySchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 60,
    },
    prefix: { type: String, required: true, unique: true },
    keyHash: { type: String, required: true, select: false },
    lastUsedAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.keyHash;
        delete ret.owner;
      },
    },
  },
);

apiKeySchema.index({ owner: 1, revokedAt: 1, createdAt: -1 });
export default mongoose.model("ApiKey", apiKeySchema);
