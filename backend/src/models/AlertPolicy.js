import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    triggerEvents: [{ type: String, required: true }],
    initialIntegrationIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "NotificationIntegration" },
    ],
    escalationSteps: [
      {
        afterMinutes: { type: Number, min: 1, max: 10_080, required: true },
        integrationIds: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: "NotificationIntegration",
          },
        ],
        priority: {
          type: String,
          enum: ["normal", "high", "critical"],
          default: "high",
        },
      },
    ],
    repeatPolicy: {
      enabled: { type: Boolean, default: false },
      intervalMinutes: { type: Number, min: 5, max: 10_080, default: 30 },
      maxRepeats: { type: Number, min: 0, max: 20, default: 3 },
      integrationIds: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "NotificationIntegration",
        },
      ],
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

schema.index({ owner: 1, isActive: 1 });
export default mongoose.model("AlertPolicy", schema);
