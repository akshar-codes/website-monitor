import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    regionId: { type: String, required: true, unique: true },
    egressIps: { type: [String], default: [] },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true, versionKey: false },
);

export default mongoose.model("ProbeRegionSettings", schema);
