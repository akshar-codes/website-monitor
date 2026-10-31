import mongoose from "mongoose";
const schema = new mongoose.Schema(
  {
    statusPage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StatusPage",
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 3000, default: "" },
    affectedServices: [{ type: mongoose.Schema.Types.ObjectId }],
    scheduledStart: { type: Date, required: true },
    scheduledEnd: { type: Date, required: true },
    status: {
      type: String,
      enum: ["scheduled", "in_progress", "completed", "cancelled"],
      default: "scheduled",
    },
    isPublished: { type: Boolean, default: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);
schema.index({ statusPage: 1, isPublished: 1, scheduledStart: 1 });
schema.pre("validate", function validateWindow() {
  if (
    this.scheduledStart &&
    this.scheduledEnd &&
    this.scheduledEnd <= this.scheduledStart
  )
    this.invalidate("scheduledEnd", "End time must be after start time");
});
export default mongoose.model("StatusMaintenance", schema);
