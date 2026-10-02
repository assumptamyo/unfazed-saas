import mongoose from "mongoose";

const availabilityOverrideSchema = new mongoose.Schema(
  {
    therapist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Therapist",
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    type: {
      type: String,
      enum: ["blocked", "custom"],
      required: true,
    },
    startTime: {
      type: String, // only used if type is "custom"
    },
    endTime: {
      type: String, // only used if type is "custom"
    },
    reason: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

// A therapist shouldn't have two overrides for the same exact date
availabilityOverrideSchema.index({ therapist: 1, date: 1 }, { unique: true });

export default mongoose.model("AvailabilityOverride", availabilityOverrideSchema);