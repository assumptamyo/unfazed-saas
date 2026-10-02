import mongoose from "mongoose";

const therapistSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please fill a valid email address",
      ],
    },
    password_hash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: String,
    },
    otpExpiresAt: {
      type: Date,
    },
    otpPurpose: {
      type: String,
      enum: ["email_verification", "password_reset"],
    },
    bio: {
      type: String,
      default: "",
    },
    specializations: {
      type: [String],
      default: [],
    },
    languages: {
      type: [String],
      default: [],
    },
    photoUrl: {
      type: String,
      default: "",
    },
    qualifications: {
      type: String,
      default: "",
    },
    yearsOfExperience: {
      type: Number,
      default: 0,
    },
    // Price per session in paise (₹1 = 100). 0 means booking is free, no online payment.
    sessionFee: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
);

export default mongoose.model("Therapist", therapistSchema);
