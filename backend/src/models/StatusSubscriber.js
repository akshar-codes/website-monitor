import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    statusPage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StatusPage",
      required: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    verificationTokenHash: { type: String, default: null, select: false },
    verificationExpiresAt: { type: Date, default: null, select: false },
    unsubscribeTokenHash: { type: String, default: null, select: false },
    preferences: {
      incidents: { type: Boolean, default: true },
      incidentUpdates: { type: Boolean, default: true },
      maintenance: { type: Boolean, default: true },
    },
    verifiedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
schema.index({ statusPage: 1, email: 1 }, { unique: true });
schema.index({ statusPage: 1, isVerified: 1, isActive: 1 });
export default mongoose.model("StatusSubscriber", schema);
