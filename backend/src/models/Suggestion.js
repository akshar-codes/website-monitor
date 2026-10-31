import mongoose from "mongoose";

const suggestionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ["feature", "improvement", "bug", "other"],
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 3000 },
    adminReply: { type: String, trim: true, maxlength: 3000, default: null },
    repliedAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ["new", "replied", "reviewed"],
      default: "new",
      index: true,
    },
  },
  { timestamps: true },
);

suggestionSchema.index({ createdAt: -1 });

export default mongoose.model("Suggestion", suggestionSchema);
