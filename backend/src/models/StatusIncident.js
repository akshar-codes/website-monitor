import mongoose from "mongoose";
const updateSchema = new mongoose.Schema({
  eventId: { type: String, default: null },
  message: { type: String, required: true, trim: true, maxlength: 3000 },
  status: {
    type: String,
    enum: ["investigating", "identified", "monitoring", "resolved"],
    required: true,
  },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  authorLabel: { type: String, trim: true, maxlength: 80, default: "" },
  createdAt: { type: Date, default: Date.now },
});
const schema = new mongoose.Schema(
  {
    statusPage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StatusPage",
      required: true,
      index: true,
    },
    sourceIncidentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Incident",
      default: null,
    },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 3000, default: "" },
    severity: {
      type: String,
      enum: ["minor", "major", "critical"],
      default: "minor",
    },
    status: {
      type: String,
      enum: ["investigating", "identified", "monitoring", "resolved"],
      default: "investigating",
    },
    affectedServices: [{ type: mongoose.Schema.Types.ObjectId }],
    updates: { type: [updateSchema], default: [] },
    startedAt: { type: Date, default: Date.now },
    resolvedAt: { type: Date, default: null },
    isPublished: { type: Boolean, default: false },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);
schema.index({ statusPage: 1, isPublished: 1, startedAt: -1 });
schema.index(
  { statusPage: 1, sourceIncidentId: 1 },
  {
    unique: true,
    partialFilterExpression: { sourceIncidentId: { $type: "objectId" } },
  },
);
export default mongoose.model("StatusIncident", schema);
