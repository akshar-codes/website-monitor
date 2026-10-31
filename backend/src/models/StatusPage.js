import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    monitor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Monitor",
      required: true,
    },
    displayName: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    displayOrder: { type: Number, default: 0 },
    isVisible: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const statusPageSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      maxlength: 60,
    },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    logo: { type: String, trim: true, maxlength: 500, default: "" },
    branding: {
      theme: { type: String, enum: ["light", "dark"], default: "light" },
      accentColor: {
        type: String,
        match: /^#[0-9a-fA-F]{6}$/,
        default: "#15803d",
      },
    },
    timezone: { type: String, default: "UTC", maxlength: 80 },
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
    services: { type: [serviceSchema], default: [] },
  },
  { timestamps: true },
);

statusPageSchema.index({ slug: 1 }, { unique: true });
statusPageSchema.index({ owner: 1, createdAt: -1 });

export default mongoose.model("StatusPage", statusPageSchema);
